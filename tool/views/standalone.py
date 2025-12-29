import secrets
from datetime import timedelta

from django.conf import settings
from django.db.models import Q
from django.db import IntegrityError
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.contrib.auth.forms import SetPasswordForm
from django.contrib.auth.tokens import default_token_generator
from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect, get_object_or_404
from django.http import HttpResponseBadRequest
from django.urls import reverse
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.utils.timezone import now
from django.core.mail import send_mail

from ..models import (
    Assignment,
    AssignmentInvitation,
    AssignmentMembership,
    VivaSession,
    UserProfile,
)
from .helpers import set_standalone_session

User = get_user_model()

INVITE_EXPIRY_DAYS = 7
INSTITUTION_TYPES = [
    "Higher Education",
    "Further Education",
    "School",
    "Corporate",
    "Government",
    "Other",
]

# Shortlist of UK Higher Education Institutions (circa HESA list)
UK_HE_INSTITUTIONS = [
    "Aberystwyth University",
    "Anglia Ruskin University",
    "Aston University",
    "Bangor University",
    "Bath Spa University",
    "Birkbeck, University of London",
    "Birmingham City University",
    "Bishop Grosseteste University",
    "Bournemouth University",
    "Brunel University London",
    "Buckinghamshire New University",
    "Canterbury Christ Church University",
    "Cardiff Metropolitan University",
    "Cardiff University",
    "City, University of London",
    "Coventry University",
    "Cranfield University",
    "De Montfort University",
    "Durham University",
    "Edge Hill University",
    "Edinburgh Napier University",
    "Falmouth University",
    "Glasgow Caledonian University",
    "Goldsmiths, University of London",
    "Harper Adams University",
    "Heriot-Watt University",
    "Imperial College London",
    "Keele University",
    "King's College London",
    "Kingston University",
    "Lancaster University",
    "Leeds Arts University",
    "Leeds Beckett University",
    "Leeds Trinity University",
    "Liverpool Hope University",
    "Liverpool John Moores University",
    "London Metropolitan University",
    "London School of Economics and Political Science",
    "London South Bank University",
    "Loughborough University",
    "Manchester Metropolitan University",
    "Middlesex University",
    "Newcastle University",
    "Northumbria University",
    "Norwich University of the Arts",
    "Nottingham Trent University",
    "Open University",
    "Oxford Brookes University",
    "Plymouth Marjon University",
    "Queen Margaret University",
    "Queen Mary University of London",
    "Queen's University Belfast",
    "Ravensbourne University London",
    "Robert Gordon University",
    "Roehampton University",
    "Royal Agricultural University",
    "Royal Holloway, University of London",
    "Sheffield Hallam University",
    "SOAS University of London",
    "Solent University",
    "St George's, University of London",
    "St Mary's University, Twickenham",
    "Staffordshire University",
    "Swansea University",
    "Teesside University",
    "The Courtauld Institute of Art",
    "The London Institute of Banking & Finance",
    "The Royal Central School of Speech and Drama",
    "The University of Buckingham",
    "The University of Law",
    "Ulster University",
    "University College Birmingham",
    "University College London",
    "University for the Creative Arts",
    "University of Aberdeen",
    "University of Bath",
    "University of Bedfordshire",
    "University of Birmingham",
    "University of Bolton",
    "University of Bradford",
    "University of Brighton",
    "University of Bristol",
    "University of Cambridge",
    "University of Central Lancashire",
    "University of Chester",
    "University of Chichester",
    "University of Cumbria",
    "University of Derby",
    "University of Dundee",
    "University of East Anglia",
    "University of East London",
    "University of Edinburgh",
    "University of Essex",
    "University of Exeter",
    "University of Glasgow",
    "University of Gloucestershire",
    "University of Greenwich",
    "University of Hertfordshire",
    "University of Highlands and Islands",
    "University of Huddersfield",
    "University of Hull",
    "University of Kent",
    "University of Leeds",
    "University of Leicester",
    "University of Lincoln",
    "University of Liverpool",
    "University of Manchester",
    "University of Northampton",
    "University of Nottingham",
    "University of Oxford",
    "University of Portsmouth",
    "University of Reading",
    "University of Salford",
    "University of Sheffield",
    "University of South Wales",
    "University of Southampton",
    "University of St Andrews",
    "University of Stirling",
    "University of Strathclyde",
    "University of Suffolk",
    "University of Sunderland",
    "University of Surrey",
    "University of Sussex",
    "University of the Arts London",
    "University of the Highlands and Islands",
    "University of the West of England",
    "University of the West of Scotland",
    "University of Wales Trinity Saint David",
    "University of Warwick",
    "University of Westminster",
    "University of Winchester",
    "University of Wolverhampton",
    "University of Worcester",
    "University of York",
    "Wrexham University",
    "York St John University",
    "Other",
]


def _ensure_profile(user, role):
    profile, created = UserProfile.objects.get_or_create(
        user=user, defaults={"role": role}
    )
    return profile


def _generate_slug(title: str) -> str:
    base = (title or "assignment").strip()
    base_slug = base.lower().replace(" ", "-")[:40] or "assignment"
    for _ in range(5):
        candidate = f"{base_slug}-{secrets.token_hex(2)}"[:50]
        if not Assignment.objects.filter(slug=candidate).exists():
            return candidate
    return secrets.token_hex(8)


def _generate_self_enroll_token() -> str:
    for _ in range(5):
        token = secrets.token_urlsafe(24)
        if not Assignment.objects.filter(self_enroll_token=token).exists():
            return token
    return secrets.token_urlsafe(32)


def _normalize_domain(value: str) -> str:
    if not value:
        return ""
    domain = value.strip().lower()
    if domain.startswith("@"):
        domain = domain[1:]
    return domain


def _email_domain(email: str) -> str:
    if not email:
        return ""
    parts = email.strip().lower().rsplit("@", 1)
    return parts[1] if len(parts) == 2 else ""


def _domain_allowed(email: str, allowed_domain: str) -> bool:
    if not allowed_domain:
        return True
    return _email_domain(email) == _normalize_domain(allowed_domain)


def _get_instructor_user_by_email(email: str):
    if not email:
        return None
    return (
        User.objects.filter(
            Q(email__iexact=email) | Q(username__iexact=email),
            profile__role=UserProfile.ROLE_INSTRUCTOR,
        )
        .select_related("profile")
        .first()
    )


def _get_student_user_by_email(email: str):
    if not email:
        return None
    return (
        User.objects.filter(
            Q(email__iexact=email) | Q(username__iexact=email),
            profile__role=UserProfile.ROLE_STUDENT,
        )
        .select_related("profile")
        .first()
    )


def _get_user_from_uid(uidb64: str):
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        return User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return None


def standalone_signup(request):
    """
    Instructor-only signup.
    """
    if request.user.is_authenticated:
        try:
            if request.user.profile.role == UserProfile.ROLE_INSTRUCTOR:
                return redirect("standalone_app_home")
        except Exception:
            pass

    error = None
    if request.method == "POST":
        email = (request.POST.get("email") or "").strip().lower()
        password = (request.POST.get("password") or "").strip()
        name = (request.POST.get("name") or "").strip()
        institution_type = (request.POST.get("institution_type") or "").strip()
        institution_name = (request.POST.get("institution_name") or "").strip()

        if not email or not password:
            error = "Email and password are required."
        elif User.objects.filter(email__iexact=email).exists():
            error = "An account with that email already exists. Please log in."
        elif User.objects.filter(username__iexact=email).exists():
            error = "An account with that email already exists. Please log in."
        else:
            username = email
            try:
                user = User.objects.create_user(username=username, email=email, password=password)
            except IntegrityError:
                error = "An account with that email already exists. Please log in."
                user = None
            if error:
                return render(request, "tool/standalone_signup.html", {
                    "error": error,
                    "institution_types": INSTITUTION_TYPES,
                    "uk_he_institutions": UK_HE_INSTITUTIONS,
                })
            user.is_active = False  # require verification
            if name:
                parts = name.split(" ", 1)
                user.first_name = parts[0]
                if len(parts) > 1:
                    user.last_name = parts[1]
                user.save(update_fields=["first_name", "last_name", "is_active"])
            profile = _ensure_profile(user, UserProfile.ROLE_INSTRUCTOR)
            if institution_type:
                profile.institution_type = institution_type
            if institution_name:
                profile.institution_name = institution_name
            token = secrets.token_urlsafe(32)
            profile.verification_token = token
            profile.verification_sent_at = now()
            profile.save(update_fields=["institution_type", "institution_name", "verification_token", "verification_sent_at"])
            _send_verification_email(request, user, token)
            return render(request, "tool/standalone_signup_pending.html", {"email": email})

    return render(request, "tool/standalone_signup.html", {
        "error": error,
        "institution_types": INSTITUTION_TYPES,
        "uk_he_institutions": UK_HE_INSTITUTIONS,
    })


def standalone_login(request):
    error = None
    next_url = request.GET.get("next") or request.POST.get("next") or ""

    if request.user.is_authenticated:
        try:
            profile = request.user.profile
            if profile.role == UserProfile.ROLE_INSTRUCTOR:
                return redirect("standalone_app_home")
            return redirect("standalone_student_assignments")
        except Exception:
            pass

    if request.method == "POST":
        email = (request.POST.get("email") or "").strip().lower()
        password = (request.POST.get("password") or "").strip()
        user = None
        try:
            existing = User.objects.get(email__iexact=email)
            user = authenticate(request, username=existing.username, password=password)
        except User.DoesNotExist:
            user = authenticate(request, username=email, password=password)
        if not user:
            error = "Invalid email or password."
        else:
            login(request, user)
            try:
                profile = user.profile
            except Exception:
                profile = None
            if profile and profile.role == UserProfile.ROLE_INSTRUCTOR:
                return redirect(next_url or "standalone_app_home")
            return redirect(next_url or "standalone_student_assignments")

    return render(request, "tool/standalone_login.html", {
        "error": error,
        "next": next_url,
    })


def standalone_password_reset(request):
    if request.user.is_authenticated:
        try:
            profile = request.user.profile
            if profile.role == UserProfile.ROLE_INSTRUCTOR:
                return redirect("standalone_app_home")
            return redirect("standalone_student_assignments")
        except Exception:
            return redirect("standalone_login")

    error = None
    sent = False
    email = ""
    if request.method == "POST":
        email = (request.POST.get("email") or "").strip().lower()
        if not email:
            error = "Email is required."
        else:
            user = _get_instructor_user_by_email(email)
            if user:
                token = default_token_generator.make_token(user)
                uid = urlsafe_base64_encode(force_bytes(user.pk))
                link = request.build_absolute_uri(
                    reverse("standalone_password_reset_confirm", args=[uid, token])
                )
                _send_password_reset_email(user, link)
            sent = True

    return render(request, "tool/standalone_password_reset.html", {
        "error": error,
        "sent": sent,
        "email": email,
    })


def standalone_password_reset_confirm(request, uidb64, token):
    user = _get_user_from_uid(uidb64)
    profile = None
    if user is not None:
        try:
            profile = user.profile
        except Exception:
            profile = None
    valid_user = (
        user is not None
        and profile is not None
        and profile.role == UserProfile.ROLE_INSTRUCTOR
        and default_token_generator.check_token(user, token)
    )

    if not valid_user:
        return render(request, "tool/standalone_password_reset_confirm.html", {
            "valid": False,
        })

    form = SetPasswordForm(user, request.POST or None)
    form.fields["new_password1"].widget.attrs.update({"autocomplete": "new-password"})
    form.fields["new_password2"].widget.attrs.update({"autocomplete": "new-password"})
    complete = False

    if request.method == "POST" and form.is_valid():
        form.save()
        complete = True

    return render(request, "tool/standalone_password_reset_confirm.html", {
        "valid": True,
        "complete": complete,
        "form": form,
    })


def standalone_logout(request):
    logout(request)
    return redirect("standalone_login")


@login_required
def standalone_app_home(request):
    try:
        profile = request.user.profile
    except Exception:
        return redirect("standalone_login")
    if profile.role != UserProfile.ROLE_INSTRUCTOR:
        return redirect("standalone_student_assignments")

    assignments = Assignment.objects.filter(owner=request.user).order_by("-id")
    for assignment in assignments:
        if not assignment.self_enroll_token:
            assignment.self_enroll_token = _generate_self_enroll_token()
            assignment.save(update_fields=["self_enroll_token"])
        if assignment.self_enroll_token:
            assignment.self_enroll_link = request.build_absolute_uri(
                reverse("standalone_self_enroll", args=[assignment.self_enroll_token])
            )
            assignment.self_enroll_iframe = (
                f'<iframe src="{assignment.self_enroll_link}" width="100%" height="700" '
                f'style="border:0;" title="MachinaViva self-enrol"></iframe>'
            )
        else:
            assignment.self_enroll_link = ""
            assignment.self_enroll_iframe = ""
    return render(request, "tool/standalone_app_home.html", {
        "assignments": assignments,
    })


@login_required
def standalone_assignment_create(request):
    try:
        profile = request.user.profile
    except Exception:
        return redirect("standalone_login")
    if profile.role != UserProfile.ROLE_INSTRUCTOR:
        return redirect("standalone_student_assignments")

    if request.method != "POST":
        return redirect("standalone_app_home")

    title = (request.POST.get("title") or "Untitled assignment").strip()
    description = (request.POST.get("description") or "").strip()
    slug = _generate_slug(title)

    assignment = Assignment.objects.create(
        title=title or "Untitled assignment",
        description=description,
        slug=slug,
        owner=request.user,
    )
    AssignmentMembership.objects.get_or_create(
        assignment=assignment,
        user=request.user,
        defaults={"role": AssignmentMembership.ROLE_INSTRUCTOR},
    )

    set_standalone_session(request, request.user, assignment, force_instructor=True)
    return redirect("assignment_view")


@login_required
def standalone_assignment_entry(request, slug):
    assignment = get_object_or_404(Assignment, slug=slug, owner=request.user)
    AssignmentMembership.objects.get_or_create(
        assignment=assignment,
        user=request.user,
        defaults={"role": AssignmentMembership.ROLE_INSTRUCTOR},
    )
    set_standalone_session(request, request.user, assignment, force_instructor=True)
    request.session["standalone_from_dashboard"] = True
    return redirect("assignment_view")


@login_required
def standalone_self_enroll_manage(request, slug):
    assignment = get_object_or_404(Assignment, slug=slug, owner=request.user)
    try:
        profile = request.user.profile
    except Exception:
        return redirect("standalone_login")
    if profile.role != UserProfile.ROLE_INSTRUCTOR:
        return redirect("standalone_student_assignments")
    if request.method != "POST":
        return redirect("assignment_view")

    domain_raw = request.POST.get("self_enroll_domain", "")
    assignment.self_enroll_domain = _normalize_domain(domain_raw)
    action = request.POST.get("action") or ""
    if action == "regenerate" or not assignment.self_enroll_token:
        assignment.self_enroll_token = _generate_self_enroll_token()

    assignment.save(update_fields=["self_enroll_domain", "self_enroll_token"])
    set_standalone_session(request, request.user, assignment, force_instructor=True)
    request.session["standalone_from_dashboard"] = True
    return redirect("assignment_view")


def standalone_self_enroll(request, token):
    assignment = get_object_or_404(Assignment, self_enroll_token=token)
    allowed_domain = _normalize_domain(assignment.self_enroll_domain)
    error = None
    logged_in_user = ""

    if request.user.is_authenticated:
        logged_in_user = request.user.email or request.user.username or ""
        try:
            profile = request.user.profile
        except Exception:
            profile = None
        if profile and profile.role == UserProfile.ROLE_INSTRUCTOR:
            error = "This link is for students. Please log in with a student account."
        elif allowed_domain and not _domain_allowed(logged_in_user, allowed_domain):
            error = f"Email must end with @{allowed_domain} to join this assignment."
        else:
            _ensure_profile(request.user, UserProfile.ROLE_STUDENT)
            AssignmentMembership.objects.get_or_create(
                assignment=assignment,
                user=request.user,
                defaults={"role": AssignmentMembership.ROLE_STUDENT},
            )
            set_standalone_session(request, request.user, assignment, force_instructor=False)
            return redirect("assignment_view")

    if request.method == "POST":
        action = request.POST.get("action")
        name = (request.POST.get("name") or "").strip()
        email = (request.POST.get("email") or "").strip().lower()
        password = (request.POST.get("password") or "").strip()
        user = None

        if not email or not password:
            error = "Email and password are required."
        elif allowed_domain and not _domain_allowed(email, allowed_domain):
            error = f"Email must end with @{allowed_domain} to join this assignment."
        elif action == "register":
            if User.objects.filter(email__iexact=email).exists() or User.objects.filter(username__iexact=email).exists():
                error = "An account with that email already exists. Please log in."
            else:
                try:
                    user = User.objects.create_user(username=email, email=email, password=password)
                except IntegrityError:
                    error = "An account with that email already exists. Please log in."
                    user = None
                if user and name:
                    parts = name.split(" ", 1)
                    user.first_name = parts[0]
                    if len(parts) > 1:
                        user.last_name = parts[1]
                    user.save(update_fields=["first_name", "last_name"])
                if user:
                    _ensure_profile(user, UserProfile.ROLE_STUDENT)
        elif action == "login":
            try:
                existing = User.objects.get(email__iexact=email)
                user = authenticate(request, username=existing.username, password=password)
            except User.DoesNotExist:
                user = authenticate(request, username=email, password=password)
            if not user:
                error = "Invalid email or password."
            else:
                try:
                    profile = user.profile
                except Exception:
                    profile = None
                if profile and profile.role == UserProfile.ROLE_INSTRUCTOR:
                    error = "This link is for students. Please log in with a student account."
                    user = None
                else:
                    _ensure_profile(user, UserProfile.ROLE_STUDENT)
        else:
            error = "Choose login or register."

        if user and not error:
            login(request, user)
            AssignmentMembership.objects.get_or_create(
                assignment=assignment,
                user=user,
                defaults={"role": AssignmentMembership.ROLE_STUDENT},
            )
            set_standalone_session(request, user, assignment, force_instructor=False)
            return redirect("assignment_view")

    return render(request, "tool/standalone_self_enroll.html", {
        "assignment": assignment,
        "allowed_domain": allowed_domain,
        "error": error,
        "logged_in_user": logged_in_user,
    })


def standalone_self_enroll_password_reset(request, token):
    assignment = get_object_or_404(Assignment, self_enroll_token=token)
    allowed_domain = _normalize_domain(assignment.self_enroll_domain)
    error = None
    sent = False
    email = ""

    if request.method == "POST":
        email = (request.POST.get("email") or "").strip().lower()
        if not email:
            error = "Email is required."
        elif allowed_domain and not _domain_allowed(email, allowed_domain):
            error = f"Email must end with @{allowed_domain} to join this assignment."
        else:
            user = _get_student_user_by_email(email)
            if user:
                reset_token = default_token_generator.make_token(user)
                uid = urlsafe_base64_encode(force_bytes(user.pk))
                link = request.build_absolute_uri(
                    reverse(
                        "standalone_self_enroll_password_reset_confirm",
                        args=[assignment.self_enroll_token, uid, reset_token],
                    )
                )
                _send_student_password_reset_email(user, link, assignment.title)
            sent = True

    return render(request, "tool/standalone_self_enroll_password_reset.html", {
        "assignment": assignment,
        "allowed_domain": allowed_domain,
        "error": error,
        "sent": sent,
        "email": email,
    })


def standalone_self_enroll_password_reset_confirm(request, token, uidb64, reset_token):
    assignment = get_object_or_404(Assignment, self_enroll_token=token)
    allowed_domain = _normalize_domain(assignment.self_enroll_domain)
    user = _get_user_from_uid(uidb64)
    profile = None
    if user is not None:
        try:
            profile = user.profile
        except Exception:
            profile = None

    email_to_check = (user.email or user.username or "").strip().lower() if user else ""
    domain_ok = _domain_allowed(email_to_check, allowed_domain) if allowed_domain else True
    valid_user = (
        user is not None
        and profile is not None
        and profile.role == UserProfile.ROLE_STUDENT
        and domain_ok
        and default_token_generator.check_token(user, reset_token)
    )

    if not valid_user:
        return render(request, "tool/standalone_self_enroll_password_reset_confirm.html", {
            "assignment": assignment,
            "valid": False,
        })

    form = SetPasswordForm(user, request.POST or None)
    form.fields["new_password1"].widget.attrs.update({"autocomplete": "new-password"})
    form.fields["new_password2"].widget.attrs.update({"autocomplete": "new-password"})
    complete = False

    if request.method == "POST" and form.is_valid():
        form.save()
        complete = True

    return render(request, "tool/standalone_self_enroll_password_reset_confirm.html", {
        "assignment": assignment,
        "valid": True,
        "complete": complete,
        "form": form,
    })


@login_required
def standalone_invites(request, slug):
    assignment = get_object_or_404(Assignment, slug=slug, owner=request.user)
    error = success = None

    if request.method == "POST":
        email = (request.POST.get("email") or "").strip().lower()
        role = (request.POST.get("role") or AssignmentMembership.ROLE_STUDENT).strip()
        if not email:
            error = "Email is required."
        else:
            token = secrets.token_urlsafe(32)
            expires_at = now() + timedelta(days=INVITE_EXPIRY_DAYS)
            invite, created = AssignmentInvitation.objects.update_or_create(
                assignment=assignment,
                email=email,
                accepted_at__isnull=True,
                defaults={
                    "token": token,
                    "expires_at": expires_at,
                    "invited_by": request.user,
                    "role": role if role in dict(AssignmentMembership.ROLE_CHOICES) else AssignmentMembership.ROLE_STUDENT,
                    "last_sent_at": now(),
                }
            )
            if not created:
                invite.token = token
                invite.expires_at = expires_at
                invite.invited_by = request.user
                invite.role = role if role in dict(AssignmentMembership.ROLE_CHOICES) else AssignmentMembership.ROLE_STUDENT
                invite.last_sent_at = now()
                invite.save(update_fields=["token", "expires_at", "invited_by", "last_sent_at", "role"])
            _send_invite_email(request, invite)
            success = "Invitation sent."

    invites = assignment.invitations.order_by("-created_at")
    return render(request, "tool/standalone_invites.html", {
        "assignment": assignment,
        "invites": invites,
        "error": error,
        "success": success,
    })


@login_required
def standalone_invite_resend(request, invite_id):
    invite = get_object_or_404(AssignmentInvitation, id=invite_id, assignment__owner=request.user)
    if invite.accepted_at:
        return redirect("standalone_invites", slug=invite.assignment.slug)
    invite.token = secrets.token_urlsafe(32)
    invite.expires_at = now() + timedelta(days=INVITE_EXPIRY_DAYS)
    invite.last_sent_at = now()
    invite.invited_by = request.user
    invite.save(update_fields=["token", "expires_at", "last_sent_at", "invited_by"])
    _send_invite_email(request, invite)
    return redirect("standalone_invites", slug=invite.assignment.slug)


def accept_invite(request, token):
    invite = get_object_or_404(AssignmentInvitation, token=token)
    assignment = invite.assignment
    expired = invite.is_expired
    error = None
    profile_role = UserProfile.ROLE_INSTRUCTOR if invite.role == AssignmentMembership.ROLE_INSTRUCTOR else UserProfile.ROLE_STUDENT

    if request.method == "POST" and not expired and not invite.accepted_at:
        action = request.POST.get("action")
        password = (request.POST.get("password") or "").strip()
        name = (request.POST.get("name") or "").strip()
        user = None

        if action == "register":
            if not password:
                error = "Password is required."
            elif User.objects.filter(email__iexact=invite.email).exists():
                error = "An account with this email already exists. Please log in."
            elif User.objects.filter(username__iexact=invite.email).exists():
                error = "An account with this email already exists. Please log in."
            else:
                try:
                    user = User.objects.create_user(
                        username=invite.email.lower(),
                        email=invite.email.lower(),
                        password=password,
                    )
                except IntegrityError:
                    error = "An account with this email already exists. Please log in."
                    user = None
                if name:
                    parts = name.split(" ", 1)
                    user.first_name = parts[0]
                    if len(parts) > 1:
                        user.last_name = parts[1]
                    user.save(update_fields=["first_name", "last_name"])
                _ensure_profile(user, profile_role)
        elif action == "login":
            try:
                existing = User.objects.get(email__iexact=invite.email)
                user = authenticate(request, username=existing.username, password=password)
            except User.DoesNotExist:
                user = authenticate(request, username=invite.email.lower(), password=password)
            if not user:
                error = "Invalid password for this invite email."
            else:
                _ensure_profile(user, profile_role)
        else:
            error = "Choose login or register."

        if user and not error:
            login(request, user)
            invite.accepted_at = now()
            invite.redeemed_by = user
            invite.save(update_fields=["accepted_at", "redeemed_by"])
            AssignmentMembership.objects.get_or_create(
                assignment=assignment,
                user=user,
                defaults={"role": invite.role or AssignmentMembership.ROLE_STUDENT, "invited_by": invite.invited_by},
            )
            roles_override = ["Instructor"] if (invite.role == AssignmentMembership.ROLE_INSTRUCTOR) else ["Learner"]
            set_standalone_session(request, user, assignment, force_instructor=False, roles_override=roles_override)
            return redirect("assignment_view")

    return render(request, "tool/standalone_invite_accept.html", {
        "assignment": assignment,
        "invite": invite,
        "expired": expired,
        "error": error,
    })


@login_required
def standalone_invite_create(request, slug):
    assignment = get_object_or_404(Assignment, slug=slug, owner=request.user)
    if request.method != "POST":
        return redirect("assignment_view")

    email = (request.POST.get("email") or "").strip().lower()
    role = (request.POST.get("role") or AssignmentMembership.ROLE_STUDENT).strip()
    if email:
        token = secrets.token_urlsafe(32)
        expires_at = now() + timedelta(days=INVITE_EXPIRY_DAYS)
        invite, created = AssignmentInvitation.objects.update_or_create(
            assignment=assignment,
            email=email,
            accepted_at__isnull=True,
            defaults={
                "token": token,
                "expires_at": expires_at,
                "invited_by": request.user,
                "role": role if role in dict(AssignmentMembership.ROLE_CHOICES) else AssignmentMembership.ROLE_STUDENT,
                "last_sent_at": now(),
            }
        )
        if not created:
            invite.token = token
            invite.expires_at = expires_at
            invite.invited_by = request.user
            invite.role = role if role in dict(AssignmentMembership.ROLE_CHOICES) else AssignmentMembership.ROLE_STUDENT
            invite.last_sent_at = now()
            invite.save(update_fields=["token", "expires_at", "invited_by", "last_sent_at", "role"])
        _send_invite_email(request, invite)
    return redirect("assignment_view")


def verify_instructor(request, token):
    try:
        profile = UserProfile.objects.select_related("user").get(verification_token=token)
    except UserProfile.DoesNotExist:
        return render(request, "tool/verification_result.html", {"status": "invalid"})

    user = profile.user
    if not user.is_active:
        user.is_active = True
        user.save(update_fields=["is_active"])
    if not profile.verified_at:
        profile.verified_at = now()
    profile.verification_token = ""
    profile.save(update_fields=["verified_at", "verification_token"])

    login(request, user)
    return render(request, "tool/verification_result.html", {"status": "success"})


@login_required
def standalone_student_assignments(request):
    memberships = AssignmentMembership.objects.filter(
        user=request.user,
        role=AssignmentMembership.ROLE_STUDENT,
    ).select_related("assignment").order_by("-created_at")
    active_session_by_assignment = {}
    assignment_ids = [m.assignment_id for m in memberships]
    if assignment_ids:
        active_sessions = VivaSession.objects.filter(
            submission__assignment_id__in=assignment_ids,
            submission__user_id=str(request.user.id),
            ended_at__isnull=True,
        ).select_related("submission__assignment").order_by("-started_at")
        for session in active_sessions:
            assignment_id = session.submission.assignment_id
            if assignment_id not in active_session_by_assignment:
                active_session_by_assignment[assignment_id] = session
    for membership in memberships:
        membership.active_viva = active_session_by_assignment.get(membership.assignment_id)
    email_candidates = set()
    if request.user.email:
        email_candidates.add(request.user.email.strip().lower())
    if request.user.username:
        email_candidates.add(request.user.username.strip().lower())
    invites = AssignmentInvitation.objects.none()
    if email_candidates:
        query = Q()
        for email in email_candidates:
            query |= Q(email__iexact=email)
        invites = AssignmentInvitation.objects.filter(
            query,
            accepted_at__isnull=True,
        ).select_related("assignment").order_by("-created_at")
    return render(request, "tool/standalone_student_assignments.html", {
        "memberships": memberships,
        "invites": invites,
    })


@login_required
def standalone_invite_accept_logged_in(request, token):
    invite = get_object_or_404(AssignmentInvitation, token=token)
    if invite.is_expired or invite.accepted_at:
        return redirect("standalone_student_assignments")

    user_email = (request.user.email or "").strip().lower()
    user_username = (request.user.username or "").strip().lower()
    invite_email = (invite.email or "").strip().lower()
    if invite_email not in {user_email, user_username}:
        return HttpResponseBadRequest("Invite does not match this account")

    invite.accepted_at = now()
    invite.redeemed_by = request.user
    invite.save(update_fields=["accepted_at", "redeemed_by"])

    AssignmentMembership.objects.get_or_create(
        assignment=invite.assignment,
        user=request.user,
        defaults={"role": invite.role or AssignmentMembership.ROLE_STUDENT, "invited_by": invite.invited_by},
    )
    roles_override = ["Instructor"] if (invite.role == AssignmentMembership.ROLE_INSTRUCTOR) else ["Learner"]
    set_standalone_session(request, request.user, invite.assignment, force_instructor=False, roles_override=roles_override)
    return redirect("assignment_view")


@login_required
def standalone_student_entry(request, slug):
    assignment = get_object_or_404(Assignment, slug=slug)
    membership = AssignmentMembership.objects.filter(
        assignment=assignment,
        user=request.user,
    ).first()
    if not membership or membership.role != AssignmentMembership.ROLE_STUDENT:
        return redirect("standalone_student_assignments")

    set_standalone_session(
        request,
        request.user,
        assignment,
        force_instructor=False,
        roles_override=["Learner"],
    )
    return redirect("assignment_view")


def _send_invite_email(request, invite: AssignmentInvitation):
    link = request.build_absolute_uri(
        reverse("accept_invite", args=[invite.token])
    )
    subject = f"You're invited to a MachinaViva assignment: {invite.assignment.title}"
    body = (
        f"You have been invited to complete a viva for \"{invite.assignment.title}\".\n\n"
        f"Use this link to accept and create your account or log in:\n{link}\n\n"
        f"This link expires on {invite.expires_at.strftime('%Y-%m-%d %H:%M UTC')}."
    )
    send_mail(
        subject=subject,
        message=body,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
        recipient_list=[invite.email],
        fail_silently=True,
    )


def _send_verification_email(request, user: User, token: str):
    link = request.build_absolute_uri(reverse("verify_instructor", args=[token]))
    subject = "Verify your MachinaViva instructor account"
    body = (
        "Welcome to MachinaViva.\n\n"
        "Please verify your email to activate your instructor account:\n"
        f"{link}\n\n"
        "If you did not request this, you can ignore this email."
    )
    send_mail(
        subject=subject,
        message=body,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
        recipient_list=[user.email],
        fail_silently=True,
    )


def _send_password_reset_email(user: User, link: str):
    subject = "Reset your MachinaViva instructor password"
    body = (
        "We received a request to reset the password for your MachinaViva instructor account.\n\n"
        f"Use this link to set a new password:\n{link}\n\n"
        "If you did not request this, you can ignore this email."
    )
    send_mail(
        subject=subject,
        message=body,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
        recipient_list=[user.email],
        fail_silently=True,
    )


def _send_student_password_reset_email(user: User, link: str, assignment_title: str):
    subject = "Reset your MachinaViva student password"
    body = (
        f"We received a request to reset the password for your MachinaViva student account for \"{assignment_title}\".\n\n"
        f"Use this link to set a new password:\n{link}\n\n"
        "If you did not request this, you can ignore this email."
    )
    send_mail(
        subject=subject,
        message=body,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
        recipient_list=[user.email],
        fail_silently=True,
    )

from django.shortcuts import render, redirect
from django.http import HttpResponse, HttpResponseBadRequest, JsonResponse
from django.urls import reverse
from django.utils.text import slugify
from .helpers import is_instructor_role, is_admin_role, fetch_nrps_roster
from ..models import Assignment, Submission, VivaMessage, VivaSession, VivaSessionSubmission, InteractionLog, AssignmentResource, AssignmentResourcePreference, VivaSessionResource, AssignmentInvitation, AssignmentMembership
from datetime import datetime
from django.utils import timezone
from django.utils.timezone import now
from .viva import compute_integrity_flags
import json
import secrets


def _generate_self_enroll_token():
    for _ in range(5):
        token = secrets.token_urlsafe(24)
        if not Assignment.objects.filter(self_enroll_token=token).exists():
            return token
    return secrets.token_urlsafe(32)


def _format_feedback_author(user):
    if not user:
        return ""
    first = (user.first_name or "").strip()
    last = (user.last_name or "").strip()
    if first or last:
        return f"{first} {last}".strip()
    return user.email or user.username or ""


def assignment_edit(request):
    roles = request.session.get("lti_roles", [])
    if not (is_instructor_role(roles) or is_admin_role(roles)):
        return HttpResponse("Forbidden", status=403)

    resource_link_id = request.session.get("lti_resource_link_id")
    assignment = Assignment.objects.get(slug=resource_link_id)

    duration_minutes = int(assignment.viva_duration_seconds / 60) if assignment.viva_duration_seconds else 10
    tones = ["Supportive", "Neutral", "Probing", "Peer-like"]

    return render(request, "tool/assignment_edit.html", {
        "assignment": assignment,
        "duration_minutes": duration_minutes,
        "tones": tones,
        "now": datetime.now(),
    })


def assignment_edit_save(request):
    roles = request.session.get("lti_roles", [])
    if not (is_instructor_role(roles) or is_admin_role(roles)):
        return HttpResponse("Forbidden", status=403)

    if request.method != "POST":
        return HttpResponseBadRequest("POST only")

    resource_link_id = request.session.get("lti_resource_link_id")
    assignment = Assignment.objects.get(slug=resource_link_id)

    # Basic text fields
    assignment.description = request.POST.get("description", assignment.description)

    # Duration (minutes -> seconds)
    duration_minutes = request.POST.get("viva_duration_minutes")
    try:
        duration_int = max(1, int(duration_minutes))
        assignment.viva_duration_seconds = duration_int * 60
    except (TypeError, ValueError):
        pass

    # Attempts
    unlimited_flag = request.POST.get("unlimited_attempts") == "on"
    if unlimited_flag:
        assignment.max_attempts = 0
        assignment.allow_multiple_submissions = True
    else:
        max_attempts = request.POST.get("max_attempts")
        try:
            attempts_int = max(1, int(max_attempts))
            assignment.max_attempts = attempts_int
            assignment.allow_multiple_submissions = attempts_int > 1
        except (TypeError, ValueError):
            pass

    # Tone and feedback visibility
    assignment.viva_tone = request.POST.get("viva_tone", assignment.viva_tone)
    assignment.ai_feedback_visible = (request.POST.get("ai_feedback_visible") == "on")
    assignment.teacher_feedback_visible = (request.POST.get("teacher_feedback_visible") == "on")
    assignment.feedback_visibility = "immediate" if assignment.ai_feedback_visible else "hidden"
    assignment.feedback_released_at = None

    # Viva instructions & notes
    assignment.viva_instructions = request.POST.get("viva_instructions", "")
    assignment.instructor_notes = request.POST.get("instructor_notes", "")
    assignment.additional_prompts = request.POST.get("additional_prompts", "")

    # Report/download permission
    assignment.allow_student_report = (request.POST.get("allow_student_report") == "on")
    assignment.allow_early_submission = (request.POST.get("allow_early_submission") == "on")
    deadline_raw = (request.POST.get("deadline_at") or "").strip()
    if deadline_raw:
        try:
            deadline_naive = datetime.strptime(deadline_raw, "%Y-%m-%dT%H:%M")
            assignment.deadline_at = timezone.make_aware(
                deadline_naive,
                timezone.get_current_timezone(),
            )
        except ValueError:
            pass
    else:
        assignment.deadline_at = None

    # New tracking fields
    assignment.keystroke_tracking = (request.POST.get("keystroke_tracking") == "on")
    assignment.event_tracking = (request.POST.get("event_tracking") == "on")
    assignment.arrhythmic_typing = (request.POST.get("arrhythmic_typing") == "on")
    assignment.enable_model_answers = (request.POST.get("enable_model_answers") == "on")
    assignment.allow_student_resource_toggle = (request.POST.get("allow_student_resource_toggle") == "on")

    assignment.save()

    if request.headers.get("x-requested-with") == "XMLHttpRequest":
        return JsonResponse({"status": "ok"})

    return redirect("assignment_view")


def assignment_feedback_release(request):
    roles = request.session.get("lti_roles", [])
    if not (is_instructor_role(roles) or is_admin_role(roles)):
        return HttpResponse("Forbidden", status=403)

    if request.method != "POST":
        return HttpResponseBadRequest("POST only")

    resource_link_id = request.session.get("lti_resource_link_id")
    if not resource_link_id:
        return HttpResponseBadRequest("Missing assignment context")

    assignment = Assignment.objects.get(slug=resource_link_id)
    if assignment.feedback_visibility != "after_review":
        return HttpResponseBadRequest("Feedback release not required")
    assignment.feedback_released_at = now()
    assignment.save(update_fields=["feedback_released_at"])

    if request.headers.get("x-requested-with") == "XMLHttpRequest" or request.content_type == "application/json":
        return JsonResponse({
            "status": "ok",
            "released_at": assignment.feedback_released_at.strftime("%Y-%m-%d %H:%M"),
        })

    return redirect("assignment_view")


def student_attempt_download(request, session_id):
    try:
        session = VivaSession.objects.select_related(
            "submission__assignment",
            "teacher_feedback_author",
        ).get(id=session_id)
    except VivaSession.DoesNotExist:
        return HttpResponseBadRequest("Invalid session ID")

    assignment = session.submission.assignment
    if not assignment.allow_student_report:
        return HttpResponse("Forbidden", status=403)

    lti_user_id = request.session.get("lti_user_id")
    if lti_user_id:
        if str(lti_user_id) != str(session.submission.user_id):
            return HttpResponse("Forbidden", status=403)
    elif request.user.is_authenticated:
        if str(session.submission.user_id) != str(request.user.id):
            return HttpResponse("Forbidden", status=403)
    else:
        return HttpResponse("Forbidden", status=403)

    if not session.ended_at:
        return HttpResponseBadRequest("Attempt not completed")

    legacy_visibility = (assignment.feedback_visibility or "").lower()
    legacy_ai_visible = legacy_visibility not in ("hidden", "after_review")
    ai_visible = bool(assignment.ai_feedback_visible) or legacy_ai_visible
    teacher_visible = bool(assignment.teacher_feedback_visible)

    duration_seconds = session.duration_seconds
    if not duration_seconds and session.started_at and session.ended_at:
        duration_seconds = int((session.ended_at - session.started_at).total_seconds())

    lines = []
    lines.append(f"Assignment: {assignment.title or 'Viva assignment'}")
    if assignment.slug:
        lines.append(f"Slug: {assignment.slug}")
    lines.append(f"Attempt ID: {session.id}")
    if session.started_at:
        lines.append(f"Started: {session.started_at.isoformat()}")
    if session.ended_at:
        lines.append(f"Ended: {session.ended_at.isoformat()}")
    if duration_seconds:
        lines.append(f"Duration seconds: {duration_seconds}")
    lines.append("")
    lines.append("Transcript:")

    messages = VivaMessage.objects.filter(session=session).order_by("timestamp")
    if messages.exists():
        for msg in messages:
            sender = "AI" if (msg.sender or "").lower() == "ai" else "Student"
            text = (msg.text or "").strip()
            lines.append(f"{sender}: {text}")
    else:
        lines.append("No transcript available.")

    if ai_visible and session.feedback_text:
        lines.append("")
        lines.append("AI feedback:")
        lines.append(session.feedback_text.strip())

    if teacher_visible and session.teacher_feedback_text:
        lines.append("")
        lines.append("Teacher feedback:")
        author = _format_feedback_author(session.teacher_feedback_author)
        if author:
            lines.append(f"By {author}")
        lines.append(session.teacher_feedback_text.strip())

    content = "\n".join(lines).strip() + "\n"
    filename_base = slugify(assignment.slug or assignment.title or "viva") or "viva"
    filename = f"{filename_base}-attempt-{session.id}.txt"
    response = HttpResponse(content, content_type="text/plain; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def assignment_view(request):
    resource_link_id = request.session.get("lti_resource_link_id")
    roles = request.session.get("lti_roles", [])
    user_id = request.session.get("lti_user_id")
    view_as_student = bool(request.session.get("standalone_view_as_student"))
    view_as_student_assignment = request.session.get("standalone_view_as_student_assignment")
    print("DEBUG: nrps_url in session =", request.session.get("nrps_url"))

    if not resource_link_id:
        return HttpResponse("No LTI resource_link_id", status=400)

    # --------------------------------------------------------------
    # Create the assignment if missing (neutral fallback title)
    # --------------------------------------------------------------
    assignment, created = Assignment.objects.get_or_create(
        slug=resource_link_id,
        defaults={"title": "Untitled Assignment"}
    )

    # --------------------------------------------------------------
    # If Canvas provided a real title via LTI claims, update ours
    # --------------------------------------------------------------
    claims = request.session.get("lti_claims", {})
    deep_title = claims.get(
        "https://purl.imsglobal.org/spec/lti/claim/resource_link",
        {}
    ).get("title")

    if deep_title and assignment.title != deep_title:
        print(f"Updating assignment title → {deep_title}")
        assignment.title = deep_title
        assignment.save()

    if view_as_student and view_as_student_assignment and view_as_student_assignment != assignment.slug:
        view_as_student = False
        request.session.pop("standalone_view_as_student", None)
        request.session.pop("standalone_view_as_student_id", None)
        request.session.pop("standalone_view_as_student_assignment", None)

    assignment_roles = set()
    if request.user.is_authenticated and not request.session.get("lti_claims"):
        assignment_roles = set(
            AssignmentMembership.objects.filter(
                assignment=assignment,
                user=request.user,
            ).values_list("role", flat=True)
        )
        if assignment.owner_id == request.user.id:
            assignment_roles.add(AssignmentMembership.ROLE_INSTRUCTOR)
    has_instructor_role = AssignmentMembership.ROLE_INSTRUCTOR in assignment_roles
    has_student_role = AssignmentMembership.ROLE_STUDENT in assignment_roles
    can_switch_roles = has_instructor_role and has_student_role

    # --------------------------------------------------------------
    # Apply deep link custom settings on first creation
    # --------------------------------------------------------------
    if created:
        custom = claims.get("https://purl.imsglobal.org/spec/lti/claim/custom") or {}
        if isinstance(custom, dict) and custom:
            def as_bool(value, default=False):
                if value is None:
                    return default
                return str(value).strip().lower() in ["1", "true", "yes", "on"]

            desc = custom.get("assignment_description")
            if desc:
                assignment.description = desc

            duration_minutes = custom.get("viva_duration_minutes")
            try:
                duration_int = max(1, int(duration_minutes))
                assignment.viva_duration_seconds = duration_int * 60
            except (TypeError, ValueError):
                pass

            unlimited = as_bool(custom.get("unlimited_attempts"), default=False)
            if unlimited:
                assignment.max_attempts = 0
                assignment.allow_multiple_submissions = True
            else:
                max_attempts = custom.get("max_attempts")
                try:
                    attempts_int = max(1, int(max_attempts))
                    assignment.max_attempts = attempts_int
                    assignment.allow_multiple_submissions = attempts_int > 1
                except (TypeError, ValueError):
                    pass

            tone = custom.get("viva_tone")
            if tone:
                assignment.viva_tone = tone

            feedback_visibility = custom.get("feedback_visibility")
            if feedback_visibility:
                assignment.feedback_visibility = feedback_visibility
                if feedback_visibility == "hidden":
                    assignment.ai_feedback_visible = False
                    assignment.teacher_feedback_visible = False
                elif feedback_visibility == "after_review":
                    assignment.ai_feedback_visible = False
                    assignment.teacher_feedback_visible = True
                else:
                    assignment.ai_feedback_visible = True
                    assignment.teacher_feedback_visible = True

            ai_feedback_visible = custom.get("ai_feedback_visible")
            if ai_feedback_visible is not None:
                assignment.ai_feedback_visible = as_bool(ai_feedback_visible, default=assignment.ai_feedback_visible)
            teacher_feedback_visible = custom.get("teacher_feedback_visible")
            if teacher_feedback_visible is not None:
                assignment.teacher_feedback_visible = as_bool(teacher_feedback_visible, default=assignment.teacher_feedback_visible)

            assignment.allow_student_report = as_bool(
                custom.get("allow_student_report"),
                default=assignment.allow_student_report
            )
            assignment.allow_early_submission = as_bool(
                custom.get("allow_early_submission"),
                default=assignment.allow_early_submission
            )
            assignment.event_tracking = as_bool(
                custom.get("event_tracking"),
                default=assignment.event_tracking
            )
            assignment.keystroke_tracking = as_bool(
                custom.get("keystroke_tracking"),
                default=assignment.keystroke_tracking
            )
            assignment.arrhythmic_typing = as_bool(
                custom.get("arrhythmic_typing"),
                default=assignment.arrhythmic_typing
            )
            assignment.enable_model_answers = as_bool(
                custom.get("enable_model_answers"),
                default=assignment.enable_model_answers
            )
            assignment.allow_student_resource_toggle = as_bool(
                custom.get("allow_student_resource_toggle"),
                default=assignment.allow_student_resource_toggle
            )

            viva_instructions = custom.get("viva_instructions")
            if viva_instructions is not None:
                assignment.viva_instructions = viva_instructions

            additional_prompts = custom.get("additional_prompts")
            if additional_prompts is not None:
                assignment.additional_prompts = additional_prompts

            instructor_notes = custom.get("instructor_notes")
            if instructor_notes is not None:
                assignment.instructor_notes = instructor_notes

            assignment.save()

    # --------------------------------------------------------------
    # Instructor view
    # --------------------------------------------------------------
    standalone_instructor = False
    if request.user.is_authenticated and not request.session.get("lti_claims"):
        if is_instructor_role(roles):
            standalone_instructor = True
        elif not roles:
            standalone_instructor = (
                getattr(assignment, "owner_id", None) == getattr(request.user, "id", None)
                or AssignmentMembership.objects.filter(
                    assignment=assignment,
                    user=request.user,
                    role=AssignmentMembership.ROLE_INSTRUCTOR,
                ).exists()
            )

    from_standalone = bool(
        request.session.get("standalone_from_dashboard")
        or standalone_instructor
    )
    if view_as_student:
        from_standalone = False
        roles = ["Learner"]
        override_user_id = request.session.get("standalone_view_as_student_id")
        if override_user_id:
            user_id = override_user_id

    if is_instructor_role(roles) or is_admin_role(roles) or from_standalone:
        submissions = Submission.objects.filter(
            assignment=assignment,
            is_placeholder=False,
        ).order_by("-created_at")

        assignment_resources = AssignmentResource.objects.filter(
            assignment=assignment
        ).order_by("-created_at")
        resources_total_size = 0
        resource_payloads = []
        included_resource_entries = []
        for resource in assignment_resources:
            file_size = resource.file.size if resource.file else 0
            resources_total_size += file_size
            payload = {
                "id": resource.id,
                "file_name": resource.file.name if resource.file else "Uploaded file",
                "created_at": resource.created_at,
                "comment": resource.comment,
                "included": resource.included,
                "file_size": file_size,
            }
            resource_payloads.append(payload)
            if resource.included:
                included_resource_entries.append({
                    "file_name": payload["file_name"],
                    "comment": payload["comment"],
                })

        # Latest submission per learner
        submission_map = {}
        for sub in submissions:
            key = str(sub.user_id)
            if key not in submission_map:
                submission_map[key] = sub

        roster = []
        if from_standalone:
            memberships = AssignmentMembership.objects.filter(
                assignment=assignment,
                role=AssignmentMembership.ROLE_STUDENT,
            ).select_related("user")
            for membership in memberships:
                user = membership.user
                given = (user.first_name or "").strip()
                family = (user.last_name or "").strip()
                if family or given:
                    display_name = f"{family}, {given}".strip(", ")
                else:
                    display_name = (user.get_full_name() or "").strip()
                if not display_name:
                    display_name = user.email or user.username or str(user.id)
                roster.append({
                    "user_id": str(user.id),
                    "sortable_name": display_name,
                    "roles": ["Learner"],
                    "email": user.email or "",
                })
            roster = sorted(roster, key=lambda m: (m.get("sortable_name") or "").lower())
        else:
            nrps_url = request.session.get("nrps_url")
            roster = fetch_nrps_roster(nrps_url) if nrps_url else []

            # Build sortable_name if missing; fallback to submission names if no roster
            for m in roster:
                given = m.get("given_name", "").strip()
                family = m.get("family_name", "").strip()

                if family or given:
                    m["sortable_name"] = f"{family}, {given}".strip(", ")
                else:
                    m["sortable_name"] = m.get("name", "")

            roster = sorted(roster, key=lambda m: m["sortable_name"].lower())

            # If NRPS is unavailable, derive a basic roster from submissions
            if not roster:
                for sub in submission_map.values():
                    roster.append({
                        "user_id": sub.user_id,
                        "sortable_name": sub.user_id,
                        "roles": ["Learner"],
                    })

        pending_invites = []
        invites = []
        accepted_invite_user_ids = set()
        invite_qs_pending = []
        if from_standalone:
            invite_qs_pending = list(AssignmentInvitation.objects.filter(
                assignment=assignment,
                accepted_at__isnull=True,
                role=AssignmentMembership.ROLE_STUDENT,
            ).order_by("-created_at"))
            for inv in invite_qs_pending:
                pending_invites.append({
                    "email": inv.email,
                    "status": "Expired" if inv.is_expired else "Invite pending",
                    "invite_id": inv.id,
                })

            invites = list(AssignmentInvitation.objects.filter(
                assignment=assignment,
                role=AssignmentMembership.ROLE_STUDENT,
            ).order_by("-created_at"))

            invite_qs_accepted = AssignmentInvitation.objects.filter(
                assignment=assignment,
                accepted_at__isnull=False,
                role=AssignmentMembership.ROLE_STUDENT,
            ).select_related("redeemed_by")
            roster_user_ids = {str(m.get("user_id")) for m in roster}
            for inv in invite_qs_accepted:
                uid = str(inv.redeemed_by_id or inv.email)
                accepted_invite_user_ids.add(uid)
                display_name = inv.email
                if inv.redeemed_by:
                    first = (inv.redeemed_by.first_name or "").strip()
                    last = (inv.redeemed_by.last_name or "").strip()
                    if last or first:
                        display_name = f"{last}, {first}".strip(", ")
                if uid not in roster_user_ids:
                    roster.append({
                        "user_id": uid,
                        "sortable_name": display_name,
                        "roles": ["Learner"],
                        "email": inv.email,
                    })
                    roster_user_ids.add(uid)
            roster = sorted(roster, key=lambda m: (m.get("sortable_name") or m.get("name") or "").lower())

        students = []
        completed_count = 0
        flagged_count = 0
        now_ts = now()

        for member in roster:
            if "learner" not in ",".join(member.get("roles", [])).lower():
                continue

            candidate_ids = []
            def add_candidate(value):
                if value is None:
                    return
                val = str(value).strip()
                if not val or val in candidate_ids:
                    return
                candidate_ids.append(val)

            add_candidate(member.get("user_id"))
            add_candidate(member.get("email"))
            add_candidate(member.get("email_address"))
            add_candidate(member.get("lis_person_contact_email_primary"))
            add_candidate(member.get("lis_person_contact_email"))
            add_candidate(member.get("lis_person_sourcedid"))

            uid = candidate_ids[0] if candidate_ids else str(member.get("user_id") or "")
            sub = None
            for cid in candidate_ids:
                sub = submission_map.get(cid)
                if sub:
                    break

            sessions_qs = VivaSession.objects.filter(
                submission__assignment=assignment,
                submission__user_id__in=candidate_ids or [uid],
            ).select_related("teacher_feedback_author").order_by("-started_at")
            active_session = sessions_qs.filter(ended_at__isnull=True).first()
            latest_session = sessions_qs.first()
            session = active_session or latest_session

            flags = compute_integrity_flags(latest_session) if latest_session else []

            viva_attempts = []
            if sessions_qs.exists():
                link_qs = VivaSessionSubmission.objects.filter(
                    session__in=sessions_qs,
                    submission__is_placeholder=False,
                ).select_related("submission")
                resource_links_qs = VivaSessionResource.objects.filter(
                    session__in=sessions_qs
                ).select_related("resource")
                links_by_session = {}
                for link in link_qs:
                    if not link.included:
                        continue
                    links_by_session.setdefault(link.session_id, []).append({
                        "submission_id": link.submission_id,
                        "file_name": link.submission.file.name if link.submission.file else "",
                        "comment": link.submission.comment,
                    })
                resources_by_session = {}
                resource_sessions_seen = set()
                for link in resource_links_qs:
                    resource_sessions_seen.add(link.session_id)
                    if not link.included:
                        continue
                    res = link.resource
                    resources_by_session.setdefault(link.session_id, []).append({
                        "file_name": res.file.name if res.file else "",
                        "comment": res.comment,
                    })
                for sess in sessions_qs:
                    files = links_by_session.get(sess.id, [])
                    if sess.id in resource_sessions_seen:
                        resource_files = resources_by_session.get(sess.id, [])
                    else:
                        resource_files = included_resource_entries
                    logs_qs = InteractionLog.objects.filter(submission=sess.submission).order_by("timestamp")
                    logs_by_session = logs_qs.filter(event_data__session_id=sess.id)
                    if logs_by_session.exists():
                        logs_qs = logs_by_session
                    else:
                        logs_qs = logs_qs.filter(timestamp__gte=sess.started_at)
                        if sess.ended_at:
                            logs_qs = logs_qs.filter(timestamp__lte=sess.ended_at)
                    events = [
                        {
                            "type": log.event_type,
                            "timestamp": log.timestamp.isoformat(),
                            "data": log.event_data,
                        }
                        for log in logs_qs
                    ]
                    msgs = VivaMessage.objects.filter(
                        session=sess
                    ).order_by("timestamp")
                    messages = [
                        {
                            "sender": m.sender,
                            "text": m.text,
                            "timestamp": m.timestamp.isoformat(),
                        }
                        for m in msgs
                    ]

                    teacher_author = _format_feedback_author(sess.teacher_feedback_author)
                    feedback = {
                        "ai_text": sess.feedback_text or "",
                        "teacher_text": sess.teacher_feedback_text or "",
                        "teacher_author": teacher_author,
                    }
                    if not (feedback["ai_text"] or feedback["teacher_text"]):
                        feedback = None

                    duration_seconds = sess.duration_seconds
                    if not duration_seconds and sess.ended_at:
                        duration_seconds = int(
                            (sess.ended_at - sess.started_at).total_seconds()
                        )

                    viva_attempts.append({
                        "session_id": sess.id,
                        "assignment_title": assignment.title,
                        "duration_seconds": duration_seconds,
                        "messages": messages,
                        "feedback": feedback,
                        "flags": compute_integrity_flags(sess),
                        "created_at": sess.started_at.isoformat(),
                        "status": "completed" if sess.ended_at else "in_progress",
                        "files": files + resource_files,
                        "events": events,
                    })

            viva_payload = viva_attempts[0] if viva_attempts else None

            status = "pending"
            if session:
                status = "completed" if session.ended_at else "in_progress"
                # Remaining time
                elapsed = (now_ts - session.started_at).total_seconds()
                remaining = max(0, assignment.viva_duration_seconds - int(elapsed))
            elif sub:
                status = "submitted"
                remaining = assignment.viva_duration_seconds
            else:
                remaining = assignment.viva_duration_seconds

            submitted_at = (
                sub.created_at.isoformat() if sub else None
            )

            student_entry = {
                "user_id": uid,
                "name": member.get("sortable_name", uid),
                "submission_id": sub.id if sub else None,
                "status": status,
                "remaining_seconds": remaining,
                "submitted_at": submitted_at,
                "flags": flags,
                "viva": viva_payload,
                "vivas": viva_attempts,
            }
            student_entry["email"] = member.get("email") or member.get("email_address") or member.get("lis_person_contact_email_primary") or member.get("lis_person_contact_email")
            if from_standalone and uid in accepted_invite_user_ids:
                student_entry["accepted_invite"] = True
            students.append(student_entry)

            if status == "completed":
                completed_count += 1
            if flags:
                flagged_count += 1

        dashboard_data = {
            "assignment": {
                "title": assignment.title,
                "id": assignment.id,
                "slug": assignment.slug,
            },
            "students": students,
            "stats": {
                "total": len(students),
                "completed": completed_count,
                "flagged": flagged_count,
            },
        }

        if from_standalone:
            for inv in invite_qs_pending:
                students.append({
                    "user_id": f"invite-{inv.id}",
                    "name": inv.email,
                    "email": inv.email,
                    "submission_id": None,
                    "status": "invited",
                    "remaining_seconds": None,
                    "submitted_at": None,
                    "flags": [],
                    "viva": None,
                    "vivas": [],
                    "is_invite": True,
                    "invite_id": inv.id,
                    "invite_status": "Expired" if inv.is_expired else "Invite pending",
                })

            # Keep invite rows at the bottom while preserving alphabetical order.
            def sort_key(entry):
                is_invite = bool(entry.get("is_invite"))
                group = 2 if is_invite else (0 if entry.get("accepted_invite") else 1)
                return (group, (entry.get("name") or "").lower())

            students = sorted(students, key=sort_key)
            dashboard_data["students"] = students

        self_enroll_link = ""
        self_enroll_iframe = ""
        if from_standalone and request.user.is_authenticated and standalone_instructor:
            if not assignment.self_enroll_token:
                assignment.self_enroll_token = _generate_self_enroll_token()
                assignment.save(update_fields=["self_enroll_token"])
            if assignment.self_enroll_token:
                self_enroll_link = request.build_absolute_uri(
                    reverse("standalone_self_enroll", args=[assignment.self_enroll_token])
                )
                self_enroll_iframe = (
                    f'<iframe src="{self_enroll_link}" width="100%" height="700" '
                    f'style="border:0;" title="MachinaViva self-enrol"></iframe>'
                )

        return render(request, "tool/teacher_dashboard.html", {
            "assignment": assignment,
            "students": students,
            "dashboard_data": dashboard_data,
            "now": datetime.now(),
            "duration_minutes": int(assignment.viva_duration_seconds / 60) if assignment.viva_duration_seconds else 10,
            "tones": ["Supportive", "Neutral", "Probing", "Peer-like"],
            "assignment_resources": resource_payloads,
            "resources_total_size": resources_total_size,
            "from_standalone": from_standalone,
            "can_switch_to_student": can_switch_roles,
            "pending_invites": pending_invites,
            "self_enroll_link": self_enroll_link,
            "self_enroll_iframe": self_enroll_iframe,
            "invites": invites,
        })

    # --------------------------------------------------------------
    # Student view
    # --------------------------------------------------------------
    student_submissions_all = Submission.objects.filter(
        assignment=assignment,
        user_id=user_id
    ).order_by("-created_at")
    student_submissions = student_submissions_all.filter(is_placeholder=False)
    placeholder_submission = student_submissions_all.filter(
        is_placeholder=True
    ).order_by("-created_at").first()

    all_resources = AssignmentResource.objects.filter(
        assignment=assignment
    ).order_by("-created_at")
    included_resources = all_resources.filter(included=True)
    resource_pref_map = {}
    if assignment.allow_student_resource_toggle and user_id:
        prefs = AssignmentResourcePreference.objects.filter(
            resource__assignment=assignment,
            user_id=str(user_id),
        )
        resource_pref_map = {pref.resource_id: pref.included for pref in prefs}
    if assignment.allow_student_resource_toggle and resource_pref_map:
        has_included_resources = any(
            resource_pref_map.get(resource.id, resource.included)
            for resource in all_resources
        )
    else:
        has_included_resources = included_resources.exists()
    if not student_submissions.exists() and has_included_resources and not placeholder_submission:
        placeholder_submission = Submission.objects.create(
            assignment=assignment,
            user_id=user_id,
            file=None,
            comment="",
            is_placeholder=True,
        )
    config_files = [
        {
            "file_name": resource.file.name if resource.file else "Resource file",
            "comment": resource.comment,
        }
        for resource in included_resources
    ]

    latest = student_submissions.first() if student_submissions.exists() else None
    session = None
    active_session = None
    status = "no_submission"
    remaining_seconds = None
    ai_feedback_text = ""
    teacher_feedback_text = ""
    teacher_feedback_author = ""
    ai_feedback_visible = bool(assignment.ai_feedback_visible)
    teacher_feedback_visible = bool(assignment.teacher_feedback_visible)
    flags = []
    has_any_submission = student_submissions_all.exists() or bool(placeholder_submission)
    sessions = VivaSession.objects.filter(
        submission__assignment=assignment,
        submission__user_id=user_id
    ).select_related("teacher_feedback_author").order_by("-started_at") if has_any_submission else VivaSession.objects.none()
    active_session = sessions.filter(ended_at__isnull=True).first()
    session = active_session or sessions.first()
    latest_submission = None
    if session:
        latest_submission = session.submission
    elif latest:
        latest_submission = latest
    elif has_included_resources:
        latest_submission = placeholder_submission
    latest = latest_submission

    if session:
        elapsed = (now() - session.started_at).total_seconds()
        duration = assignment.viva_duration_seconds
        remaining_seconds = max(0, duration - int(elapsed))
        status = "completed" if session.ended_at else "in_progress"
        flags = compute_integrity_flags(session)
        if teacher_feedback_visible:
            teacher_feedback_text = session.teacher_feedback_text or ""
            teacher_feedback_author = _format_feedback_author(session.teacher_feedback_author)
        else:
            teacher_feedback_text = ""
            teacher_feedback_author = ""
    elif latest:
        status = "submitted"

    resource_payloads = []
    resource_include_map = {}
    if active_session:
        resource_links = VivaSessionResource.objects.filter(session=active_session)
        if resource_links.exists():
            resource_include_map = {
                link.resource_id: link.included
                for link in resource_links
            }
    for resource in all_resources:
        pref_included = resource_pref_map.get(resource.id, resource.included)
        resource_payloads.append({
            "id": resource.id,
            "file_name": resource.file.name if resource.file else "Resource file",
            "comment": resource.comment,
            "included": resource_include_map.get(resource.id, pref_included),
            "file_size": resource.file.size if resource.file else 0,
        })

    feedback_released = bool(assignment.feedback_released_at)

    max_attempts = assignment.max_attempts
    session_histories = {}
    session_links = {}
    session_resource_links = {}
    resource_sessions_seen = set()
    active_include_map = {}
    session_meta = {}
    if sessions:
        all_messages = VivaMessage.objects.filter(session__in=sessions).order_by("timestamp")
        msgs_by_session = {}
        for m in all_messages:
            sender = (m.sender or "").lower()
            msgs_by_session.setdefault(m.session_id, []).append({
                "sender": m.sender,
                "text": m.text,
                "ts": m.timestamp.isoformat(),
                "model_answer": m.model_answer if sender == "ai" and m.model_answer else "",
            })
        link_qs = VivaSessionSubmission.objects.filter(
            session__in=sessions,
            submission__is_placeholder=False,
        ).select_related("submission")
        resource_links_qs = VivaSessionResource.objects.filter(
            session__in=sessions
        ).select_related("resource")
        for link in link_qs:
            session_links.setdefault(link.session_id, []).append({
                "submission_id": link.submission_id,
                "file_name": link.submission.file.name if link.submission.file else "",
                "included": link.included,
                "comment": link.submission.comment,
            })
            if active_session and link.session_id == active_session.id:
                active_include_map[link.submission_id] = link.included
        session_resource_links = {}
        resource_sessions_seen = set()
        for link in resource_links_qs:
            resource_sessions_seen.add(link.session_id)
            session_resource_links.setdefault(link.session_id, []).append({
                "file_name": link.resource.file.name if link.resource and link.resource.file else "",
                "comment": link.resource.comment,
                "included": link.included,
            })
        for s in sessions:
            session_meta[s.id] = {
                "completed": bool(s.ended_at),
                "ended_at": s.ended_at.isoformat() if s.ended_at else "",
            }
            history = msgs_by_session.get(s.id, [])
            session_histories[s.id] = history

    submission_payloads = []
    used_as_primary = set(VivaSession.objects.filter(
        submission__assignment=assignment,
        submission__user_id=user_id
    ).values_list("submission_id", flat=True))

    submissions_total_size = 0
    for sub in student_submissions:
        file_size = sub.file.size if sub.file else 0
        submissions_total_size += file_size
        submission_payloads.append({
            "id": sub.id,
            "file_name": sub.file.name if sub.file else "Uploaded text",
            "created_at": sub.created_at,
            "comment": sub.comment,
            "included": active_include_map.get(sub.id, True),
            "can_delete": sub.id not in used_as_primary,
            "file_size": file_size,
        })

    existing_sessions = sessions.count()
    if max_attempts and max_attempts > 0:
        attempts_left = max(0, max_attempts - existing_sessions)
    else:
        attempts_left = -1  # unlimited

    ai_feedback_message = ""
    if not ai_feedback_visible:
        ai_feedback_message = "AI feedback is hidden for this assignment."

    duration_minutes = int(assignment.viva_duration_seconds / 60) if assignment.viva_duration_seconds else None
    deadline_passed = False
    if assignment.deadline_at:
        deadline_passed = now() >= assignment.deadline_at

    default_resource_entries = [
        {
            "file_name": resource.file.name if resource.file else "Resource file",
            "comment": resource.comment,
        }
        for resource in included_resources
    ]
    session_files_payload = {
        s.id: (
        [
            {
                "submission_id": entry["submission_id"],
                "file_name": entry["file_name"],
                "comment": entry["comment"],
            }
            for entry in session_links.get(s.id, []) if entry.get("included")
        ] + [
            {
                "file_name": entry["file_name"],
                "comment": entry["comment"],
            }
            for entry in (
                session_resource_links.get(s.id, [])
                if s.id in resource_sessions_seen
                else default_resource_entries
            ) if entry.get("included", True)
        ])
        for s in sessions
    }

    session_feedback = {}
    if sessions:
        for s in sessions:
            ai_text = s.feedback_text if ai_feedback_visible else ""
            teacher_text = s.teacher_feedback_text or ""
            if ai_text or teacher_text:
                session_feedback[str(s.id)] = {
                    "ai_text": ai_text,
                    "teacher_text": teacher_text if teacher_feedback_visible else "",
                    "teacher_author": _format_feedback_author(s.teacher_feedback_author) if teacher_feedback_visible else "",
                }

    user_email = ""
    logout_url = ""
    view_as_student_name = ""
    if view_as_student:
        view_as_student_name = request.session.get("standalone_view_as_student_name") or "Test Student"
        user_email = view_as_student_name
    elif request.user.is_authenticated:
        user_email = request.user.email or request.user.username or ""
        logout_url = "standalone_logout"

    standalone_student = bool(view_as_student or (request.user.is_authenticated and not request.session.get("lti_claims")))

    return render(request, "tool/student_submit.html", {
        "assignment": assignment,
        "user_id": user_id,
        "user_email": user_email,
        "logout_url": logout_url,
        "view_as_student": view_as_student,
        "view_as_student_name": view_as_student_name,
        "standalone_student": standalone_student,
        "can_switch_to_instructor": can_switch_roles and not view_as_student,
        "latest_submission": latest,
        "past_submissions": student_submissions,
        "submission_payloads": submission_payloads,
        "viva_status": status,
        "remaining_seconds": remaining_seconds,
        "ai_feedback": ai_feedback_text if ai_feedback_visible else "",
        "ai_feedback_message": ai_feedback_message,
        "teacher_feedback": teacher_feedback_text,
        "teacher_feedback_author": teacher_feedback_author,
        "teacher_feedback_visible": teacher_feedback_visible,
        "feedback_released": feedback_released,
        "allow_student_report": assignment.allow_student_report,
        "flags": flags,
        "duration_minutes": duration_minutes,
        "deadline_passed": deadline_passed,
        "attempts_left": attempts_left,
        "attempts_used": existing_sessions,
        "session": active_session,
        "viva_sessions": sessions,
        "session_histories": session_histories,
        "session_meta": session_meta,
        "session_files": session_files_payload,
        "session_feedback": session_feedback,
        "config_files": config_files,
        "config_files_included": True if config_files else False,
        "assignment_resources": resource_payloads,
        "submissions_total_size": submissions_total_size,
    })

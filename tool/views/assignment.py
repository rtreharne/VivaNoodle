from django.shortcuts import render, redirect
from django.http import HttpResponse, HttpResponseBadRequest, JsonResponse
from .helpers import is_instructor_role, is_admin_role, fetch_nrps_roster
from ..models import Assignment, Submission, VivaMessage, VivaSession, VivaFeedback
from datetime import datetime
from django.utils.timezone import now
from .viva import compute_integrity_flags
import json


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
    max_attempts = request.POST.get("max_attempts")
    try:
        attempts_int = max(1, int(max_attempts))
        assignment.max_attempts = attempts_int
        assignment.allow_multiple_submissions = attempts_int > 1
    except (TypeError, ValueError):
        pass

    # Tone and feedback visibility
    assignment.viva_tone = request.POST.get("viva_tone", assignment.viva_tone)
    assignment.feedback_visibility = request.POST.get("feedback_visibility", assignment.feedback_visibility)

    # Viva instructions & notes
    assignment.viva_instructions = request.POST.get("viva_instructions", "")
    assignment.instructor_notes = request.POST.get("instructor_notes", "")
    assignment.additional_prompts = request.POST.get("additional_prompts", "")

    # Report/download permission
    assignment.allow_student_report = (request.POST.get("allow_student_report") == "on")

    # New tracking fields
    assignment.keystroke_tracking = (request.POST.get("keystroke_tracking") == "on")
    assignment.event_tracking = (request.POST.get("event_tracking") == "on")
    assignment.arrhythmic_typing = (request.POST.get("arrhythmic_typing") == "on")

    assignment.save()

    if request.headers.get("x-requested-with") == "XMLHttpRequest":
        return JsonResponse({"status": "ok"})

    return redirect("assignment_view")



def assignment_view(request):
    resource_link_id = request.session.get("lti_resource_link_id")
    roles = request.session.get("lti_roles", [])
    user_id = request.session.get("lti_user_id")
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

    # --------------------------------------------------------------
    # Instructor view
    # --------------------------------------------------------------
    if is_instructor_role(roles) or is_admin_role(roles):
        submissions = Submission.objects.filter(
            assignment=assignment
        ).order_by("-created_at")

        # Latest submission per learner
        submission_map = {}
        for sub in submissions:
            key = str(sub.user_id)
            if key not in submission_map:
                submission_map[key] = sub

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

        students = []
        completed_count = 0
        flagged_count = 0
        now_ts = now()

        for member in roster:
            if "learner" not in ",".join(member.get("roles", [])).lower():
                continue

            uid = str(member.get("user_id"))
            sub = submission_map.get(uid)
            session = None
            try:
                session = sub.vivasession if sub else None
            except VivaSession.DoesNotExist:
                session = None

            flags = compute_integrity_flags(session) if session else []

            viva_payload = None
            if session:
                msgs = VivaMessage.objects.filter(
                    session=session
                ).order_by("timestamp")
                messages = [
                    {
                        "sender": m.sender,
                        "text": m.text,
                        "timestamp": m.timestamp.isoformat(),
                    }
                    for m in msgs
                ]

                try:
                    fb = session.vivafeedback
                    feedback = {
                        "strengths": fb.strengths,
                        "improvements": fb.improvements,
                        "misconceptions": fb.misconceptions,
                        "impression": fb.impression,
                    }
                except Exception:
                    feedback = None

                duration_seconds = session.duration_seconds
                if not duration_seconds and session.ended_at:
                    duration_seconds = int(
                        (session.ended_at - session.started_at).total_seconds()
                    )

                viva_payload = {
                    "session_id": session.id,
                    "assignment_title": assignment.title,
                    "duration_seconds": duration_seconds,
                    "messages": messages,
                    "feedback": feedback,
                    "flags": flags,
                    "created_at": session.started_at.isoformat(),
                }

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

            students.append({
                "user_id": uid,
                "name": member.get("sortable_name", uid),
                "submission_id": sub.id if sub else None,
                "status": status,
                "remaining_seconds": remaining,
                "submitted_at": submitted_at,
                "flags": flags,
                "viva": viva_payload,
            })

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

        return render(request, "tool/teacher_dashboard.html", {
            "assignment": assignment,
            "students": students,
            "dashboard_json": json.dumps(dashboard_data, default=str),
            "now": datetime.now(),
            "duration_minutes": int(assignment.viva_duration_seconds / 60) if assignment.viva_duration_seconds else 10,
            "tones": ["Supportive", "Neutral", "Probing", "Peer-like"],
        })

    # --------------------------------------------------------------
    # Student view
    # --------------------------------------------------------------
    student_submissions = Submission.objects.filter(
        assignment=assignment,
        user_id=user_id
    ).order_by("-created_at")

    latest = student_submissions.first() if student_submissions else None
    session = None
    status = "no_submission"
    remaining_seconds = None
    feedback = None
    flags = []

    if latest:
        status = "submitted"
        try:
            session = latest.vivasession
        except VivaSession.DoesNotExist:
            session = None

    if session:
        elapsed = (now() - session.started_at).total_seconds()
        duration = assignment.viva_duration_seconds
        remaining_seconds = max(0, duration - int(elapsed))
        status = "completed" if session.ended_at else "in_progress"
        try:
            feedback = session.vivafeedback
        except VivaFeedback.DoesNotExist:
            feedback = None
        flags = compute_integrity_flags(session)

    max_attempts = assignment.max_attempts or 1
    existing_sessions = VivaSession.objects.filter(submission=latest).count() if latest else 0
    attempts_left = max_attempts - existing_sessions if latest else max_attempts

    feedback_visible = assignment.feedback_visibility == "immediate" and feedback

    duration_minutes = int(assignment.viva_duration_seconds / 60) if assignment.viva_duration_seconds else None

    return render(request, "tool/student_submit.html", {
        "assignment": assignment,
        "user_id": user_id,
        "latest_submission": latest,
        "past_submissions": student_submissions,
        "viva_status": status,
        "remaining_seconds": remaining_seconds,
        "feedback": feedback if feedback_visible else None,
        "allow_student_report": assignment.allow_student_report,
        "flags": flags,
        "duration_minutes": duration_minutes,
        "attempts_left": attempts_left,
        "attempts_used": existing_sessions,
    })

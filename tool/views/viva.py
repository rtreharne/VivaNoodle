import json

from django.shortcuts import render, redirect
from django.http import JsonResponse, HttpResponseBadRequest
from django.utils.timezone import now
from django.views.decorators.csrf import csrf_exempt

from tool.models import Submission, VivaSession, VivaSessionSubmission, InteractionLog, VivaMessage


# ---------------------------------------------------------
# Start a viva session
# ---------------------------------------------------------
@csrf_exempt
def viva_start(request, submission_id):
    if request.method != "POST":
        return HttpResponseBadRequest("POST required")

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except Exception:
        payload = {}

    included_ids = payload.get("included_submission_ids")
    included_set = None
    if included_ids is not None:
        try:
            included_set = {int(x) for x in included_ids}
        except Exception:
            included_set = None

    try:
        sub = Submission.objects.get(id=submission_id)
    except Submission.DoesNotExist:
        return HttpResponseBadRequest("Invalid submission ID")

    if request.session.get("lti_user_id") and str(request.session.get("lti_user_id")) != str(sub.user_id):
        return HttpResponseBadRequest("Forbidden")

    # If there's an active session, reuse it
    active = VivaSession.objects.filter(submission=sub, ended_at__isnull=True).order_by("-started_at").first()
    if active:
        session = active
    else:
        # Enforce attempt limit unless unlimited (max_attempts <= 0 or None)
        existing_attempts = VivaSession.objects.filter(
            submission__assignment=sub.assignment,
            submission__user_id=sub.user_id
        ).count()
        max_attempts = sub.assignment.max_attempts
        if max_attempts and max_attempts > 0 and existing_attempts >= max_attempts:
            return HttpResponseBadRequest("No attempts remaining")

        session = VivaSession.objects.create(
            submission=sub,
            started_at=now(),
            ended_at=None,
            duration_seconds=None,
        )

    # Ensure submission links exist and apply inclusion choices
    user_subs = Submission.objects.filter(assignment=sub.assignment, user_id=sub.user_id)
    bulk_links = []
    for s in user_subs:
        default_included = True if included_set is None else s.id in included_set
        bulk_links.append(
            VivaSessionSubmission(session=session, submission=s, included=default_included)
        )
    VivaSessionSubmission.objects.bulk_create(bulk_links, ignore_conflicts=True)
    if included_set is not None:
        VivaSessionSubmission.objects.filter(session=session).exclude(
            submission_id__in=included_set
        ).update(included=False)
        VivaSessionSubmission.objects.filter(session=session, submission_id__in=included_set).update(included=True)

    attempt_count = VivaSession.objects.filter(
        submission__assignment=sub.assignment,
        submission__user_id=sub.user_id
    ).count()
    if sub.assignment.max_attempts and sub.assignment.max_attempts > 0:
        attempts_left = max(0, sub.assignment.max_attempts - attempt_count)
    else:
        attempts_left = -1

    included_payload = list(
        VivaSessionSubmission.objects.filter(session=session).values("submission_id", "included")
    )

    if request.headers.get("x-requested-with") == "XMLHttpRequest" or request.headers.get("accept") == "application/json":
        return JsonResponse({
            "session_id": session.id,
            "submission_id": sub.id,
            "status": "ok",
            "attempts_left": attempts_left,
            "attempts_used": attempt_count,
            "included_submissions": included_payload,
        })

    return redirect("viva_session", session_id=session.id)


# ---------------------------------------------------------
# Viva placeholder view
# ---------------------------------------------------------
def viva_session(request, session_id):
    try:
        session = VivaSession.objects.get(id=session_id)
    except VivaSession.DoesNotExist:
        return HttpResponseBadRequest("Invalid viva session ID")

    return render(request, "tool/viva.html", {
        "session": session,
        "remaining_seconds": 0,
        "viva_ended": True,
    })


# ---------------------------------------------------------
# Disabled endpoints (placeholder)
# ---------------------------------------------------------
@csrf_exempt
def viva_send_message(request):
    if request.method != "POST":
        return HttpResponseBadRequest("POST required")

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except Exception:
        payload = request.POST

    session_id = payload.get("session_id")
    sender = payload.get("sender", "student")
    text = (payload.get("text") or "").strip()
    ended = payload.get("ended")
    duration_seconds = payload.get("duration_seconds")
    rating = payload.get("rating")

    try:
        session = VivaSession.objects.get(id=session_id)
    except VivaSession.DoesNotExist:
        return HttpResponseBadRequest("Invalid viva session ID")

    msg = None
    if text:
        msg = VivaMessage.objects.create(
            session=session,
            sender=sender[:20],
            text=text
        )

    update_fields = []
    if rating is not None:
        try:
            session.rating = int(rating)
            update_fields.append("rating")
        except (TypeError, ValueError):
            pass

    if ended:
        session.ended_at = now()
        feedback_text = payload.get("feedback_text")
        if feedback_text is not None:
            session.feedback_text = feedback_text
        if duration_seconds is not None:
            try:
                session.duration_seconds = int(duration_seconds)
            except (TypeError, ValueError):
                session.duration_seconds = None
        if session.started_at and session.duration_seconds is None:
            session.duration_seconds = int((session.ended_at - session.started_at).total_seconds())
        update_fields.extend(["ended_at", "duration_seconds"])
        if feedback_text is not None:
            update_fields.append("feedback_text")
        session.save(update_fields=update_fields)
    elif update_fields:
        session.save(update_fields=update_fields)

    return JsonResponse({
        "status": "ok",
        "message_id": msg.id if msg else None,
    })


@csrf_exempt
def viva_toggle_submission(request):
    if request.method != "POST":
        return HttpResponseBadRequest("POST required")

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except Exception:
        payload = request.POST

    session_id = payload.get("session_id")
    submission_id = payload.get("submission_id")
    included_raw = payload.get("included")

    try:
        session = VivaSession.objects.select_related("submission__assignment").get(id=session_id)
    except VivaSession.DoesNotExist:
        return HttpResponseBadRequest("Invalid session ID")

    if request.session.get("lti_user_id") and str(request.session.get("lti_user_id")) != str(session.submission.user_id):
        return HttpResponseBadRequest("Forbidden")

    if session.ended_at:
        return HttpResponseBadRequest("Session already ended")

    try:
        submission = Submission.objects.get(
            id=submission_id,
            assignment=session.submission.assignment,
            user_id=session.submission.user_id,
        )
    except Submission.DoesNotExist:
        return HttpResponseBadRequest("Invalid submission for this session")

    try:
        included = str(included_raw).lower() in ["1", "true", "yes", "on"]
    except Exception:
        included = True

    link, created = VivaSessionSubmission.objects.get_or_create(
        session=session,
        submission=submission,
        defaults={"included": included},
    )
    if not created and link.included != included:
        link.included = included
        link.save(update_fields=["included"])

    return JsonResponse({"status": "ok", "included": link.included})


@csrf_exempt
def viva_log_event(request):
    if request.method != "POST":
        return HttpResponseBadRequest("POST required")

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except Exception:
        payload = request.POST

    session_id = payload.get("session_id")
    if not session_id:
        return HttpResponseBadRequest("Missing session ID")

    try:
        session = VivaSession.objects.select_related("submission__assignment").get(id=session_id)
    except VivaSession.DoesNotExist:
        return HttpResponseBadRequest("Invalid session ID")

    if request.session.get("lti_user_id") and str(request.session.get("lti_user_id")) != str(session.submission.user_id):
        return HttpResponseBadRequest("Forbidden")

    if session.ended_at:
        return JsonResponse({"status": "ignored", "logged": 0})

    assignment = session.submission.assignment
    allowed = set()
    if assignment.event_tracking:
        allowed.update({"blur", "focus", "visibility", "paste", "copy"})
    if assignment.keystroke_tracking:
        allowed.update({"typing_cadence"})
    if assignment.arrhythmic_typing:
        allowed.update({"arrhythmic_typing"})

    events = payload.get("events")
    if not isinstance(events, list):
        event_type = payload.get("event_type")
        event_data = payload.get("event_data", {})
        if not event_type:
            return HttpResponseBadRequest("No events provided")
        events = [{"event_type": event_type, "event_data": event_data}]

    def sanitize_event_data(data):
        if not isinstance(data, dict):
            return {}
        cleaned = {}
        for key, value in data.items():
            if isinstance(value, str):
                cleaned[key] = value[:500]
            elif isinstance(value, (int, float, bool)) or value is None:
                cleaned[key] = value
            else:
                cleaned[key] = str(value)[:500]
        return cleaned

    logs = []
    for event in events:
        event_type = event.get("event_type")
        if event_type not in allowed:
            continue
        event_data = sanitize_event_data(event.get("event_data", {}))
        if event_type == "copy" and event_data.get("source") != "ai":
            continue
        event_data["session_id"] = session.id
        logs.append(InteractionLog(
            submission=session.submission,
            event_type=event_type,
            event_data=event_data,
        ))

    if logs:
        InteractionLog.objects.bulk_create(logs)

    return JsonResponse({"status": "ok", "logged": len(logs)})


def viva_summary(request, session_id):
    try:
        session = VivaSession.objects.get(id=session_id)
    except VivaSession.DoesNotExist:
        return HttpResponseBadRequest("Invalid viva session ID")
    return render(request, "tool/viva.html", {
        "session": session,
        "remaining_seconds": 0,
        "viva_ended": True,
    })


def viva_logs(request, session_id):
    try:
        VivaSession.objects.get(id=session_id)
    except VivaSession.DoesNotExist:
        return HttpResponseBadRequest("Invalid session ID")
    return JsonResponse({"status": "disabled"}, status=503)


# ---------------------------------------------------------
# Integrity Flags (kept for dashboard summaries)
# ---------------------------------------------------------
def compute_integrity_flags(session):
    logs = InteractionLog.objects.filter(
        submission=session.submission
    ).order_by("timestamp")

    logs_by_session = logs.filter(event_data__session_id=session.id)
    if logs_by_session.exists():
        logs = logs_by_session
    else:
        logs = logs.filter(timestamp__gte=session.started_at)
        if session.ended_at:
            logs = logs.filter(timestamp__lte=session.ended_at)

    assignment = session.submission.assignment
    flags = []

    blur_count = logs.filter(event_type="blur").count()
    paste_logs = logs.filter(event_type="paste")
    copy_logs = logs.filter(event_type="copy", event_data__source="ai")
    msgs = VivaMessage.objects.filter(session=session).order_by("timestamp")

    if assignment.event_tracking and blur_count >= 3:
        flags.append(f"Frequent tab/window switching ({blur_count}×).")

    if assignment.event_tracking and paste_logs.exists():
        flags.append(f"Paste events detected ({paste_logs.count()}×).")
        large_paste_count = 0
        for p in paste_logs:
            pasted = p.event_data.get("text", "")
            length = p.event_data.get("length") or (len(pasted) if pasted else 0)
            if length and length > 20:
                large_paste_count += 1
        if large_paste_count:
            suffix = f" ({large_paste_count}x)" if large_paste_count > 1 else ""
            flags.append(f"Large pasted snippet detected (>20 chars){suffix}.")

    if assignment.event_tracking and copy_logs.exists():
        flags.append(f"AI message copied ({copy_logs.count()}×).")

    if assignment.event_tracking and session.duration_seconds:
        if session.duration_seconds < assignment.viva_duration_seconds * 0.25:
            flags.append("Viva ended unusually early (<25% of time).")

    if assignment.keystroke_tracking and msgs.count() >= 2:
        for a, b in zip(msgs, msgs[1:]):
            if (b.timestamp - a.timestamp).total_seconds() > 120:
                flags.append("Long period of no response (>120s).")
                break

    if assignment.arrhythmic_typing:
        anomaly_logs = logs.filter(event_type="arrhythmic_typing").count()
        if anomaly_logs >= 5:
            flags.append(f"Arrhythmic typing anomalies ({anomaly_logs}×).")

    return flags

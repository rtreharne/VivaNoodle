from django.shortcuts import render, redirect
from django.http import JsonResponse, HttpResponseBadRequest
from django.utils.timezone import now
from django.views.decorators.csrf import csrf_exempt

from tool.models import Submission, VivaSession, InteractionLog, VivaMessage


# ---------------------------------------------------------
# Start a viva session (placeholder)
# ---------------------------------------------------------
def viva_start(request, submission_id):
    try:
        sub = Submission.objects.get(id=submission_id)
    except Submission.DoesNotExist:
        return HttpResponseBadRequest("Invalid submission ID")

    session, _ = VivaSession.objects.get_or_create(submission=sub)
    if not session.ended_at:
        session.ended_at = now()
        session.duration_seconds = 0
        session.save(update_fields=["ended_at", "duration_seconds"])

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
    return JsonResponse({"status": "disabled", "message": "Viva messaging is temporarily offline."}, status=503)


@csrf_exempt
def viva_log_event(request):
    return JsonResponse({"status": "disabled"}, status=503)


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

    assignment = session.submission.assignment
    flags = []

    blur_count = logs.filter(event_type="blur").count()
    paste_logs = logs.filter(event_type="paste")
    msgs = VivaMessage.objects.filter(session=session).order_by("timestamp")

    if assignment.event_tracking and blur_count >= 3:
        flags.append(f"Frequent tab/window switching ({blur_count}×).")

    if assignment.event_tracking and paste_logs.exists():
        flags.append(f"Paste events detected ({paste_logs.count()}×).")
        for p in paste_logs:
            pasted = p.event_data.get("text", "")
            if pasted and len(pasted) > 20:
                flags.append("Large pasted snippet detected (>20 chars).")

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


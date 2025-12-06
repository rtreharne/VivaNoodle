from django.shortcuts import render, redirect
from django.http import JsonResponse, HttpResponseBadRequest
from django.utils.timezone import now
from django.utils import timezone
from openai import OpenAI
import json

from tool.models import (
    Submission,
    VivaSession,
    VivaMessage,
    InteractionLog,
    VivaFeedback,
)

client = OpenAI()

# ---------------------------------------------------------
# Start a viva session
# ---------------------------------------------------------
def viva_start(request, submission_id):
    try:
        sub = Submission.objects.get(id=submission_id)
    except Submission.DoesNotExist:
        return HttpResponseBadRequest("Invalid submission ID")

    session, _ = VivaSession.objects.get_or_create(submission=sub)
    return redirect("viva_session", session_id=session.id)


# ---------------------------------------------------------
# Viva UI (or polling)
# ---------------------------------------------------------
def viva_session(request, session_id):
    try:
        session = VivaSession.objects.get(id=session_id)
    except VivaSession.DoesNotExist:
        return HttpResponseBadRequest("Invalid viva session ID")

    # ------------------ POLL MODE ------------------
    if request.GET.get("poll") == "1":
        msgs = VivaMessage.objects.filter(session=session).order_by("timestamp")
        return JsonResponse({
            "messages": [{"sender": m.sender, "text": m.text} for m in msgs]
        })

    # ------------------ NORMAL RENDER ------------------
    started_at = session.started_at
    elapsed = (now() - started_at).total_seconds()

    assignment = session.submission.assignment
    duration = assignment.viva_duration_seconds

    remaining = max(0, duration - int(elapsed))
    viva_ended = remaining <= 0

    return render(request, "tool/viva.html", {
        "session": session,
        "remaining_seconds": remaining,
        "viva_ended": viva_ended,
        "time": timezone.now(),
    })


# ---------------------------------------------------------
# SEND MESSAGE (student or start signal)
# ---------------------------------------------------------
def viva_send_message(request):
    if request.method != "POST":
        return HttpResponseBadRequest("POST only")

    payload = json.loads(request.body.decode("utf-8"))
    session_id = payload.get("session_id")
    text = payload.get("text", "").strip()

    if not session_id:
        return HttpResponseBadRequest("Missing session_id")

    try:
        session = VivaSession.objects.get(id=session_id)
    except VivaSession.DoesNotExist:
        return HttpResponseBadRequest("Invalid session ID")

    assignment = session.submission.assignment

    # --------------------------------------------------
    # Special case: "__start__"
    # --------------------------------------------------
    if text == "__start__":
        # Do NOT save student message
        pass
    else:
        if not text:
            return HttpResponseBadRequest("Missing message text")

        VivaMessage.objects.create(
            session=session,
            sender="student",
            text=text
        )

    # --------------------------------------------------
    # Build context for GPT
    # --------------------------------------------------
    submission_text = session.submission.comment[:8000]

    system_prompt = (
        "You are an academic tutor conducting a viva voce examination.\n"
        "Ask clear, concise, probing questions.\n"
        "Ask only ONE question at a time.\n"
        "Do NOT give answers or explanations.\n"
        "Do NOT help the student.\n"
        "Only ask questions.\n"
    )

    if assignment.viva_instructions:
        system_prompt += (
            "\nInstructor Instructions:\n"
            f"{assignment.viva_instructions}\n"
        )

    messages_for_model = [
        {"role": "system", "content": system_prompt},
        {"role": "user",
         "content": (
            "Here is the student's submitted work:\n\n"
            f"{submission_text}\n\n"
            "Ask only questions that probe their reasoning or understanding."
         )},
    ]

    history = VivaMessage.objects.filter(session=session).order_by("timestamp")

    for msg in history:
        if msg.sender == "student":
            if msg.text == "__start__":
                continue
            messages_for_model.append({"role": "user", "content": msg.text})
        else:
            messages_for_model.append({"role": "assistant", "content": msg.text})

    # Ensure last user message included unless __start__
    if text != "__start__":
        messages_for_model.append({"role": "user", "content": text})

    # --------------------------------------------------
    # Call GPT
    # --------------------------------------------------
    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages_for_model,
            max_tokens=200,
            temperature=0.4,
        )
        ai_reply = completion.choices[0].message.content.strip()
    except Exception as e:
        ai_reply = f"[AI error: {e}]"

    VivaMessage.objects.create(
        session=session,
        sender="ai",
        text=ai_reply
    )

    return JsonResponse({"status": "ok", "message": ai_reply})


# ---------------------------------------------------------
# Behaviour logs & viva_end
# ---------------------------------------------------------
def viva_log_event(request):
    if request.method != "POST":
        return HttpResponseBadRequest("POST only")

    payload = json.loads(request.body.decode("utf-8"))
    session_id = payload.get("session_id")
    event_type = payload.get("event_type")
    event_data = payload.get("event_data", {})

    if not session_id or not event_type:
        return HttpResponseBadRequest("Missing fields")

    try:
        session = VivaSession.objects.get(id=session_id)
    except VivaSession.DoesNotExist:
        return HttpResponseBadRequest("Invalid session")

    # -------------------- END SESSION --------------------
    if event_type == "viva_end":
        if not session.ended_at:
            session.ended_at = now()
            session.duration_seconds = int(
                (session.ended_at - session.started_at).total_seconds()
            )
            session.save()

            try:
                generate_viva_feedback(session)
            except Exception as e:
                print("Error generating viva feedback:", e)

        return JsonResponse({"status": "ended"})

    # -------------------- NORMAL LOG --------------------
    InteractionLog.objects.create(
        submission=session.submission,
        event_type=event_type,
        event_data=event_data
    )
    return JsonResponse({"status": "logged"})


# ---------------------------------------------------------
# Feedback summary
# ---------------------------------------------------------
def viva_summary(request, session_id):
    try:
        session = VivaSession.objects.get(id=session_id)
    except VivaSession.DoesNotExist:
        return HttpResponseBadRequest("Invalid viva session ID")

    # ---------- AJAX POLL ----------
    if request.GET.get("poll") == "1":
        try:
            fb = session.vivafeedback
            return JsonResponse({
                "ready": True,
                "strengths": fb.strengths,
                "improvements": fb.improvements,
                "misconceptions": fb.misconceptions,
                "impression": fb.impression,
            })
        except VivaFeedback.DoesNotExist:
            return JsonResponse({"ready": False})

    # ---------- NORMAL PAGE ----------
    messages = VivaMessage.objects.filter(session=session).order_by("timestamp")
    flags = compute_integrity_flags(session)

    try:
        feedback = session.vivafeedback
    except VivaFeedback.DoesNotExist:
        feedback = None

    formatted = None
    if session.duration_seconds:
        mins = session.duration_seconds // 60
        secs = session.duration_seconds % 60
        formatted = f"{mins:02d}:{secs:02d}"

    return render(request, "tool/viva_summary.html", {
        "session": session,
        "messages": messages,
        "formatted_duration": formatted,
        "flags": flags,
        "feedback": feedback,
    })


# ---------------------------------------------------------
# Behaviour logs
# ---------------------------------------------------------
def viva_logs(request, session_id):
    try:
        session = VivaSession.objects.get(id=session_id)
    except VivaSession.DoesNotExist:
        return HttpResponseBadRequest("Invalid viva session ID")

    logs = InteractionLog.objects.filter(
        submission=session.submission
    ).order_by("timestamp")

    return render(request, "tool/viva_logs.html", {
        "session": session,
        "logs": logs,
    })


# ---------------------------------------------------------
# Integrity Flags
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

    # Blur
    if assignment.event_tracking and blur_count >= 3:
        flags.append(f"Frequent tab/window switching ({blur_count}×).")

    # Paste
    if assignment.event_tracking and paste_logs.exists():
        flags.append(f"Paste events detected ({paste_logs.count()}×).")
        for p in paste_logs:
            pasted = p.event_data.get("text", "")
            if pasted and len(pasted) > 20:
                flags.append("Large pasted snippet detected (>20 chars).")

    # Early finish
    if assignment.event_tracking and session.duration_seconds:
        if session.duration_seconds < assignment.viva_duration_seconds * 0.25:
            flags.append("Viva ended unusually early (<25% of time).")

    # Long silence
    if assignment.keystroke_tracking and msgs.count() >= 2:
        for a, b in zip(msgs, msgs[1:]):
            if (b.timestamp - a.timestamp).total_seconds() > 120:
                flags.append("Long period of no response (>120s).")
                break

    # Arrhythmic typing
    if assignment.arrhythmic_typing:
        anomaly_logs = logs.filter(event_type="arrhythmic_typing").count()
        if anomaly_logs >= 5:
            flags.append(f"Arrhythmic typing anomalies ({anomaly_logs}×).")

    return flags


# ---------------------------------------------------------
# Generate Qualitative Feedback  (JSON hardened)
# ---------------------------------------------------------
def generate_viva_feedback(session):
    submission_text = session.submission.comment[:8000]
    messages = VivaMessage.objects.filter(session=session).order_by("timestamp")

    transcript = "\n".join(
        f"{m.sender.upper()}: {m.text}" for m in messages
    )

    prompt = f"""
You are an academic tutor providing qualitative evaluation after a viva voce.
Do NOT score or grade.
Do NOT mention behavioural integrity.

Return ONLY valid JSON:
{{
  "strengths": "...",
  "improvements": "...",
  "misconceptions": "...",
  "impression": "..."
}}

Student Submission:
{submission_text}

Viva Transcript:
{transcript}
"""

    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=300,
        temperature=0.4,
    )

    raw = completion.choices[0].message.content.strip()

    # ---------- JSON hardening ----------
    cleaned = raw
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned.replace("json", "", 1).strip()
    try:
        data = json.loads(cleaned)
    except:
        data = {
            "strengths": "Unable to parse JSON feedback.",
            "improvements": "",
            "misconceptions": "",
            "impression": "",
        }

    VivaFeedback.objects.create(
        session=session,
        strengths=data.get("strengths", ""),
        improvements=data.get("improvements", ""),
        misconceptions=data.get("misconceptions", ""),
        impression=data.get("impression", "")
    )

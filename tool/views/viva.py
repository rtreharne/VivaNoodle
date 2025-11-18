from django.shortcuts import render, redirect
from django.http import JsonResponse, HttpResponseBadRequest
from tool.models import Submission, VivaSession, VivaMessage, InteractionLog

# ---------------------------------------------------------
# Start a viva session
# ---------------------------------------------------------
def viva_start(request, submission_id):
    try:
        sub = Submission.objects.get(id=submission_id)
    except Submission.DoesNotExist:
        return HttpResponseBadRequest("Invalid submission ID")

    session, created = VivaSession.objects.get_or_create(submission=sub)

    return redirect("viva_session", session_id=session.id)


# ---------------------------------------------------------
# Show viva chat UI (empty for now)
# ---------------------------------------------------------
from django.http import JsonResponse, HttpResponseBadRequest
from django.utils.timezone import now
from tool.models import VivaSession, VivaMessage

def viva_session(request, session_id):
    try:
        session = VivaSession.objects.get(id=session_id)
    except VivaSession.DoesNotExist:
        return HttpResponseBadRequest("Invalid viva session ID")

    # ---------------------------------------------------------
    # POLL MODE — return latest messages only
    # ---------------------------------------------------------
    if request.GET.get("poll") == "1":
        msgs = VivaMessage.objects.filter(session=session).order_by("timestamp")
        return JsonResponse({
            "messages": [
                {"sender": m.sender, "text": m.text}
                for m in msgs
            ]
        })

    # ---------------------------------------------------------
    # NORMAL PAGE LOAD — calculate remaining time
    # ---------------------------------------------------------
    started_at = session.started_at
    elapsed = (now() - started_at).total_seconds()

    # Per-assignment configured duration
    assignment = session.submission.assignment
    duration = assignment.viva_duration_seconds

    remaining = max(0, duration - int(elapsed))
    viva_ended = remaining <= 0

    return render(request, "tool/viva.html", {
        "session": session,
        "remaining_seconds": remaining,
        "viva_ended": viva_ended,
    })




# ---------------------------------------------------------
# Student sends a message (stub)
# ---------------------------------------------------------
import json

def viva_send_message(request):
    if request.method != "POST":
        return HttpResponseBadRequest("POST only")

    # ------------------------------------------------------------
    # Parse request JSON
    # ------------------------------------------------------------
    payload = json.loads(request.body.decode("utf-8"))
    session_id = payload.get("session_id")
    text = payload.get("text", "").strip()

    if not session_id or text is None:
        return HttpResponseBadRequest("Missing fields")

    # ------------------------------------------------------------
    # Load VivaSession and Assignment
    # ------------------------------------------------------------
    try:
        session = VivaSession.objects.get(id=session_id)
    except VivaSession.DoesNotExist:
        return HttpResponseBadRequest("Invalid session ID")

    assignment = session.submission.assignment

    # We save __start__ to DB to keep the sequence intact,
    # but we will NOT show it in the UI.
    VivaMessage.objects.create(
        session=session,
        sender="student",
        text=text
    )

    # ------------------------------------------------------------
    # Build system prompt with instructor customisation
    # ------------------------------------------------------------
    system_prompt = (
        "You are an academic tutor conducting a viva voce examination.\n"
        "Your job is to probe the student's understanding of their submitted work.\n"
        "Ask clear, concise, probing questions.\n"
        "Ask only ONE question at a time.\n"
        "Do NOT explain answers.\n"
        "Do NOT help the student.\n"
        "Do NOT reveal new information.\n"
        "Only ask questions.\n"
        "\n"
    )

    # Insert instructor viva instructions (optional)
    if assignment.viva_instructions:
        system_prompt += (
            "Instructor Viva Instructions:\n"
            f"{assignment.viva_instructions}\n\n"
        )

    # Insert rubric (internal-only context for AI)
    if assignment.rubric_text:
        system_prompt += (
            "Marking Rubric (do NOT reveal to the student):\n"
            f"{assignment.rubric_text}\n\n"
        )

    # Instructor notes are NEVER used — not even as AI context
    # (they are private to instructor only)

    # ------------------------------------------------------------
    # Build messages for OpenAI
    # ------------------------------------------------------------
    submission_text = session.submission.comment[:8000]  # safety cap

    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": (
                "Here is the student's submitted work. Use this only as context, "
                "and ask questions about the reasoning, methods, decisions, and understanding.\n\n"
                f"{submission_text}"
            )
        }
    ]

    # Include conversation history (except hiding __start__)
    history = VivaMessage.objects.filter(session=session).order_by("timestamp")

    for msg in history:
        if msg.sender == "student":
            if msg.text == "__start__":
                # Do not include "__start__" as content — but keep sequence intact
                continue
            messages.append({"role": "user", "content": msg.text})
        else:
            messages.append({"role": "assistant", "content": msg.text})

    # ------------------------------------------------------------
    # If __start__, do NOT let AI see it as a real message
    # ------------------------------------------------------------
    if text == "__start__":
        # Replace with a neutral kickoff message
        messages.append({"role": "assistant", "content": ""})
    else:
        messages.append({"role": "user", "content": text})

    # ------------------------------------------------------------
    # Call OpenAI
    # ------------------------------------------------------------
    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=200,
            temperature=0.4,
        )
        ai_reply = completion.choices[0].message.content.strip()

        if not ai_reply:
            ai_reply = "I have generated an empty response."

    except Exception as e:
        ai_reply = f"[AI error: {str(e)}]"

    # ------------------------------------------------------------
    # Save AI reply
    # ------------------------------------------------------------
    VivaMessage.objects.create(
        session=session,
        sender="ai",
        text=ai_reply
    )

    # ------------------------------------------------------------
    # Respond to frontend
    # ------------------------------------------------------------
    return JsonResponse({"status": "ok", "message": ai_reply})



# ---------------------------------------------------------
# Interaction logs (cut/copy/paste/blur)
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

    # ----------------------------------
    # Special handling: viva_end event
    # ----------------------------------
    if event_type == "viva_end":
        if not session.ended_at:
            session.ended_at = now()
            session.duration_seconds = int(
                (session.ended_at - session.started_at).total_seconds()
            )
            session.save()
        return JsonResponse({"status": "ended"})

    # ----------------------------------
    # Normal behaviour logging
    # ----------------------------------
    InteractionLog.objects.create(
        submission=session.submission,
        event_type=event_type,
        event_data=event_data
    )

    return JsonResponse({"status": "logged"})



import json
from django.http import JsonResponse, HttpResponseBadRequest
from tool.models import Submission, VivaSession, VivaMessage
from openai import OpenAI

client = OpenAI()

def viva_send_message(request):
    if request.method != "POST":
        return HttpResponseBadRequest("POST only")

    # ------------------------------------
    # Parse incoming JSON
    # ------------------------------------
    payload = json.loads(request.body.decode("utf-8"))
    session_id = payload.get("session_id")
    text = payload.get("text", "").strip()

    if not session_id:
        return HttpResponseBadRequest("Missing session_id")

    # ------------------------------------
    # Lookup viva session
    # ------------------------------------
    try:
        session = VivaSession.objects.get(id=session_id)
    except VivaSession.DoesNotExist:
        return HttpResponseBadRequest("Invalid session ID")

    # ------------------------------------
    # Special case: "__start__"
    # Do NOT save a student message.
    # Instead: generate FIRST AI QUESTION only.
    # ------------------------------------
    if text == "__start__":
        # Proceed directly to AI generation without saving anything
        student_messages = []
    else:
        # Save student message normally
        if not text:
            return HttpResponseBadRequest("Missing message text")

        VivaMessage.objects.create(
            session=session,
            sender="student",
            text=text
        )

    # ------------------------------------
    # Prepare model context
    # ------------------------------------
    submission = session.submission
    submission_text = submission.comment[:8000]  # safe cap

    # Fetch full chat history (except __start__)
    history = VivaMessage.objects.filter(session=session).order_by("timestamp")
    history = list(history)[-6:]  # limit to last 6

    # Build OpenAI messages
    messages = [
        {
            "role": "system",
            "content": (
                "You are an academic tutor conducting a viva voce examination.\n"
                "Ask clear, focused, probing questions to determine whether the student "
                "understands the work they submitted.\n"
                "Never reveal answers. Never provide explanations.\n"
                "Ask one short question at a time.\n"
            )
        },
        {
            "role": "user",
            "content": (
                "Here is the student's submitted work:\n\n"
                f"{submission_text}\n\n"
                "Use this work as context. Only ask questions about their work or the reasoning behind it."
            )
        }
    ]

    # History → model prompt
    for msg in history:
        messages.append({
            "role": "user" if msg.sender == "student" else "assistant",
            "content": msg.text
        })

    # ------------------------------------
    # Call OpenAI
    # ------------------------------------
    try:
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            max_tokens=200,
            temperature=0.4,
        )
        ai_reply = completion.choices[0].message.content.strip()

    except Exception as e:
        ai_reply = f"[AI error: {e}]"

    # ------------------------------------
    # Save AI message
    # ------------------------------------
    VivaMessage.objects.create(
        session=session,
        sender="ai",
        text=ai_reply
    )

    # ------------------------------------
    # Return reply to frontend
    # ------------------------------------
    return JsonResponse({
        "status": "ok",
        "message": ai_reply
    })



def viva_summary(request, session_id):
    try:
        session = VivaSession.objects.get(id=session_id)
    except VivaSession.DoesNotExist:
        return HttpResponseBadRequest("Invalid viva session ID")

    messages = VivaMessage.objects.filter(session=session).order_by("timestamp")
    flags = compute_integrity_flags(session)


    # Compute nice MM:SS duration (None if not finished)
    formatted_duration = None
    if session.duration_seconds:
        mins = session.duration_seconds // 60
        secs = session.duration_seconds % 60
        formatted_duration = f"{mins:02d}:{secs:02d}"

    return render(request, "tool/viva_summary.html", {
        "session": session,
        "messages": messages,
        "formatted_duration": formatted_duration,
        "flags": flags,
    })



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


def compute_integrity_flags(session):
    """
    Generate simple rule-based integrity signals.
    Returns a list of strings.
    """
    logs = InteractionLog.objects.filter(
        submission=session.submission
    ).order_by("timestamp")

    flags = []

    # Count events
    blur_count = logs.filter(event_type="blur").count()
    paste_logs = logs.filter(event_type="paste")
    copy_logs = logs.filter(event_type="copy")
    cut_logs = logs.filter(event_type="cut")

    # -------------------------------
    # RULE 1: Many blur events
    # -------------------------------
    if blur_count >= 3:
        flags.append(f"Frequent tab/window switching detected ({blur_count} times).")

    # -------------------------------
    # RULE 2: Any paste events
    # -------------------------------
    if paste_logs.exists():
        flags.append(f"Paste events detected ({paste_logs.count()} times).")

        # Inspect paste size if event_data contains 'text'
        for p in paste_logs:
            pasted = p.event_data.get("text", "")
            if pasted and len(pasted) > 20:
                flags.append("Pasted text longer than 20 characters.")

    # -------------------------------
    # RULE 3: Very early finishing
    # -------------------------------
    if session.duration_seconds:
        total = session.submission.assignment.viva_duration_seconds
        if session.duration_seconds < total * 0.25:
            flags.append("Viva ended unusually early (less than 25% of expected time).")

    # -------------------------------
    # RULE 4: Long silence (>120 sec)
    # -------------------------------
    msgs = VivaMessage.objects.filter(session=session).order_by("timestamp")

    if msgs.count() >= 2:
        for a, b in zip(msgs, msgs[1:]):
            gap = (b.timestamp - a.timestamp).total_seconds()
            if gap > 120:
                flags.append("Long period of no response (>2 minutes).")
                break

    return flags




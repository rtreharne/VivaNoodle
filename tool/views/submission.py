from django.shortcuts import render, redirect
from django.http import HttpResponseBadRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from ..models import Assignment, Submission, VivaSession
from ..utils import extract_text_from_file


# ============================================================
# Text Submission (fallback / debug mode)
# ============================================================
@csrf_exempt
def submit_text(request):
    if request.method != "POST":
        return HttpResponseBadRequest("POST only")

    user_id = request.session.get("lti_user_id")
    resource_link_id = request.session.get("lti_resource_link_id")

    if not user_id or not resource_link_id:
        return HttpResponseBadRequest("Missing LTI session info")

    assignment = Assignment.objects.get(slug=resource_link_id)

    Submission.objects.create(
        assignment=assignment,
        user_id=user_id,
        comment=request.POST.get("text", "").strip(),
        file=None,
    )

    return redirect("assignment_view")


# ============================================================
# File Upload Submission (PDF / DOCX / TXT)
# ============================================================
@csrf_exempt
def submit_file(request):
    if request.method != "POST":
        return HttpResponseBadRequest("POST only")

    user_id = request.session.get("lti_user_id")
    resource_link_id = request.session.get("lti_resource_link_id")

    if not user_id or not resource_link_id:
        return HttpResponseBadRequest("Missing LTI session info")

    assignment = Assignment.objects.get(slug=resource_link_id)

    uploads = request.FILES.getlist("file")
    if not uploads:
        return HttpResponseBadRequest("Missing file")

    existing_submissions = list(Submission.objects.filter(assignment=assignment, user_id=user_id))
    if len(existing_submissions) + len(uploads) > 10:
        if request.headers.get("accept") == "application/json":
            return JsonResponse({"status": "error", "message": "You can upload up to 10 files in total."}, status=400)
        return redirect("assignment_view")

    max_total_bytes = 50 * 1024 * 1024  # 50 MB
    existing_size = sum((s.file.size for s in existing_submissions if s.file), 0)
    new_size = sum((getattr(f, "size", 0) for f in uploads), 0)
    if existing_size + new_size > max_total_bytes:
        if request.headers.get("accept") == "application/json":
            return JsonResponse({"status": "error", "message": "Total upload size limit is 50MB across all files."}, status=400)
        return redirect("assignment_view")

    for uploaded in uploads:
        sub = Submission.objects.create(
            assignment=assignment,
            user_id=user_id,
            file=uploaded,
            comment="",  # extracted text will be added after save
        )

        # Extract text immediately for preview/status
        try:
            if sub.file and sub.file.path:
                extracted = extract_text_from_file(sub.file.path)
                sub.comment = extracted[:50000]
                sub.save()
        except Exception:
            # If extraction fails, continue without blocking the redirect
            pass

    return redirect("assignment_view")


# ============================================================
# Submission Status Page
# Automatically extracts text if needed
# ============================================================
def submission_status(request, submission_id):
    """Show extracted text and submission state."""
    try:
        sub = Submission.objects.get(id=submission_id)
    except Submission.DoesNotExist:
        return HttpResponseBadRequest("Invalid submission ID")

    # Perform extraction only if comment is empty and file exists
    if sub.file and not sub.comment:
        extracted = extract_text_from_file(sub.file.path)
        sub.comment = extracted[:50000]  # safety cap
        sub.save()

    return render(request, "tool/submission_status.html", {
        "submission": sub,
    })


@csrf_exempt
def delete_submission(request, submission_id):
    if request.method != "POST":
        return HttpResponseBadRequest("POST only")

    user_id = request.session.get("lti_user_id")
    if not user_id:
        return HttpResponseBadRequest("Missing user")

    try:
        sub = Submission.objects.get(id=submission_id, user_id=user_id)
    except Submission.DoesNotExist:
        return HttpResponseBadRequest("Invalid submission")

    if VivaSession.objects.filter(submission=sub).exists():
        return HttpResponseBadRequest("Cannot delete a submission linked to a viva session.")

    sub.delete()
    if request.headers.get("accept") == "application/json":
        return JsonResponse({"status": "ok"})
    return redirect("assignment_view")

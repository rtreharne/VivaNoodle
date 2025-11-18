from django.shortcuts import render, redirect
from django.http import HttpResponse, HttpResponseBadRequest
from .helpers import is_instructor_role, is_admin_role, fetch_nrps_roster
from ..models import Assignment, Submission

def assignment_edit(request):
    roles = request.session.get("lti_roles", [])
    if not (is_instructor_role(roles) or is_admin_role(roles)):
        return HttpResponse("Forbidden", status=403)

    resource_link_id = request.session.get("lti_resource_link_id")
    assignment = Assignment.objects.get(slug=resource_link_id)

    return render(request, "tool/assignment_edit.html", {"assignment": assignment})


def assignment_edit_save(request):
    roles = request.session.get("lti_roles", [])
    if not (is_instructor_role(roles) or is_admin_role(roles)):
        return HttpResponse("Forbidden", status=403)

    if request.method != "POST":
        return HttpResponseBadRequest("POST only")

    resource_link_id = request.session.get("lti_resource_link_id")
    assignment = Assignment.objects.get(slug=resource_link_id)

    # -------------------------------------
    # Basic fields
    # -------------------------------------
    assignment.title = request.POST.get("title", assignment.title)
    assignment.description = request.POST.get("description", assignment.description)

    # Checkbox fix: HTML checkboxes send "on" when checked
    assignment.allow_multiple_submissions = (
        request.POST.get("allow_multiple") == "on"
    )

    # Duration
    duration = request.POST.get("viva_duration_seconds")
    if duration and duration.isdigit():
        assignment.viva_duration_seconds = int(duration)

    # -------------------------------------
    # NEW: Viva customisation fields
    # -------------------------------------
    assignment.viva_instructions = request.POST.get("viva_instructions", "")
    assignment.rubric_text = request.POST.get("rubric_text", "")
    assignment.instructor_notes = request.POST.get("instructor_notes", "")

    assignment.save()

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
        submissions = Submission.objects.filter(assignment=assignment)

        nrps_url = request.session.get("nrps_url")
        roster = fetch_nrps_roster(nrps_url) if nrps_url else []

        submission_map = {s.user_id: s for s in submissions}

        return render(request, "tool/instructor_review.html", {
            "assignment": assignment,
            "submissions": submissions,
            "roster": roster,
            "submission_map": submission_map,
        })

    # --------------------------------------------------------------
    # Student view
    # --------------------------------------------------------------
    student_submissions = Submission.objects.filter(
        assignment=assignment,
        user_id=user_id
    ).order_by("-created_at")

    return render(request, "tool/student_submit.html", {
        "assignment": assignment,
        "user_id": user_id,
        "latest_submission": student_submissions.first() if student_submissions else None,
        "past_submissions": student_submissions,
    })

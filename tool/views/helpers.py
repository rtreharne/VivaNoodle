def is_instructor_role(roles):
    instructor_keywords = [
        "Instructor", "ContentDeveloper", "TeachingAssistant",
        "CourseDesigner"
    ]
    return any(any(k in r for k in instructor_keywords) for r in roles)

def is_admin_role(roles):
    admin_keywords = ["Admin", "Administrator", "SysAdmin"]
    return any(any(k in r for k in admin_keywords) for r in roles)

def is_student_role(roles):
    return not is_instructor_role(roles) and not is_admin_role(roles)

import os
import time, jwt, requests
from django.conf import settings
from tool.models import ToolConfig, UserProfile, AssignmentMembership

LTI_PRIVATE_KEY_PATH = os.getenv("LTI_PRIVATE_KEY_PATH", "lti_keys/private.pem")


def fetch_nrps_roster(nrps_url):
    print("DEBUG: fetch_nrps_roster CALLED with url:", nrps_url)

    if not nrps_url:
        print("DEBUG: No NRPS URL in session")
        return None

    # ----------------------------------------------------------
    # Load platform config (Canvas platform details)
    # ----------------------------------------------------------
    platform = ToolConfig.objects.first()
    if not platform:
        print("DEBUG: No PlatformConfig in DB")
        return None

    now = int(time.time())

    # ----------------------------------------------------------
    # Build client_assertion JWT for Canvas token endpoint
    # ----------------------------------------------------------
    private_key = open(LTI_PRIVATE_KEY_PATH, "rb").read()

    client_assertion_payload = {
        "iss": platform.client_id,          # tool's client_id
        "sub": platform.client_id,          # same as iss
        "aud": platform.token_url,          # MUST match Canvas token endpoint
        "iat": now,
        "exp": now + 60,
        "jti": str(now),
    }

    client_assertion = jwt.encode(
        client_assertion_payload,
        private_key,
        algorithm="RS256",
    )

    # ----------------------------------------------------------
    # Step 2: Exchange for service access token
    # ----------------------------------------------------------
    token_resp = requests.post(
        platform.token_url,
        data={
            "grant_type": "client_credentials",
            "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
            "client_assertion": client_assertion,
            "scope": "https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly",
        },
    )

    print("DEBUG: token_resp status =", token_resp.status_code)
    print("DEBUG: token_resp text =", token_resp.text)

    token_json = token_resp.json()
    access_token = token_json.get("access_token")

    if not access_token:
        print("DEBUG: FAILED TO OBTAIN ACCESS TOKEN")
        return None

    # ----------------------------------------------------------
    # Step 3: Call the NRPS membership service
    # ----------------------------------------------------------
    members_resp = requests.get(
        nrps_url,
        headers={"Authorization": f"Bearer {access_token}"}
    )

    print("DEBUG: members_resp status =", members_resp.status_code)
    print("DEBUG: members_resp text =", members_resp.text)

    try:
        data = members_resp.json()
        print(data)
        return data.get("members", [])
    except:
        print("DEBUG: JSON ERROR - returning None")
        return None


def user_role_labels(user, assignment=None):
    """
    Map a Django user/profile or assignment membership to LTI-like role labels.
    """
    if assignment is not None:
        roles = set(
            AssignmentMembership.objects.filter(
                assignment=assignment,
                user=user,
            ).values_list("role", flat=True)
        )
        if AssignmentMembership.ROLE_INSTRUCTOR in roles:
            return ["Instructor"]
        if AssignmentMembership.ROLE_STUDENT in roles:
            return ["Learner"]

    try:
        profile = user.profile
    except Exception:
        return []
    if profile.role == UserProfile.ROLE_INSTRUCTOR:
        return ["Instructor"]
    return ["Learner"]


def set_standalone_session(request, user, assignment, force_instructor=False, roles_override=None):
    """
    Populate session keys expected by existing LTI views so standalone flows
    can reuse the same assignment/submission/viva handlers.
    """
    roles = roles_override or user_role_labels(user, assignment=assignment)
    if force_instructor and "Instructor" not in roles:
        roles = ["Instructor"]

    request.session["lti_roles"] = roles
    request.session["lti_user_id"] = str(user.id)
    request.session["lti_user_name"] = user.get_full_name() or user.email or user.username
    request.session["lti_resource_link_id"] = assignment.slug
    request.session["lti_course_name"] = assignment.title
    request.session["nrps_url"] = None
    request.session["lti_claims"] = {}

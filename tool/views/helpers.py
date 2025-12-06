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

import time, jwt, requests
from django.conf import settings
from tool.models import ToolConfig


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
    private_key = open("lti_keys/private.pem", "rb").read()

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

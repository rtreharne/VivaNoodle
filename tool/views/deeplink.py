import secrets, jwt
from datetime import datetime, timedelta
from django.shortcuts import render
from django.http import HttpResponse, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt
from jwcrypto import jwk

from tool.models import ToolConfig   # <-- NEW


def build_deep_link_jwt(return_url, title, launch_url, description="", custom_params=None):
    now = datetime.utcnow()

    # Load private/public key
    private_key = open("lti_keys/private.pem", "rb").read()
    pub = jwk.JWK.from_pem(open("lti_keys/public.pem", "rb").read())
    kid = pub.export_public(as_dict=True)["kid"]

    # Deep linking content item
    content_item = {
        "type": "ltiResourceLink",
        "title": title,
        "url": launch_url,
        "text": description,
        "description": description,
    }

    if custom_params:
        content_item["custom"] = custom_params

    # Platform config
    platform = ToolConfig.objects.first()

    payload = {
        "iss": platform.client_id,
        "aud": platform.issuer,
        "iat": now,
        "exp": now + timedelta(minutes=5),
        "nonce": secrets.token_urlsafe(12),

        "https://purl.imsglobal.org/spec/lti/claim/message_type": "LtiDeepLinkingResponse",
        "https://purl.imsglobal.org/spec/lti/claim/version": "1.3.0",

        # Deep link return URL
        "https://purl.imsglobal.org/spec/lti/claim/target_link_uri": return_url,

        # Content items
        "https://purl.imsglobal.org/spec/lti-dl/claim/content_items": [content_item],
    }

    headers = {"alg": "RS256", "kid": kid, "typ": "JWT"}

    return jwt.encode(payload, private_key, algorithm="RS256", headers=headers)


def deeplink(request):
    claims = request.session.get("lti_claims")
    if not claims:
        return HttpResponse("Missing LTI claims", status=400)

    deep_link = claims.get("https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings")
    if not deep_link:
        return HttpResponse("Not a deep linking launch", status=400)

    tones = ["Supportive", "Neutral", "Probing", "Peer-like"]

    return render(request, "tool/deeplink.html", {
        "deep_link_return": deep_link["deep_link_return_url"],
        "tones": tones,
        "default_duration_minutes": 10,
        "default_max_attempts": 1,
        "default_feedback_visibility": "immediate",
        "default_viva_tone": "Supportive",
        "default_allow_student_report": True,
        "default_allow_early_submission": False,
        "default_enable_model_answers": True,
        "default_allow_student_resource_toggle": False,
        "default_event_tracking": True,
        "default_keystroke_tracking": True,
        "default_arrhythmic_typing": True,
    })


@csrf_exempt
def deeplink_submit(request):
    if request.method != "POST":
        return HttpResponseBadRequest("POST only")

    return_url = request.POST.get("return_url")
    title = request.POST.get("title", "Viva Assignment")
    description = request.POST.get("description", "")

    duration_minutes = request.POST.get("viva_duration_minutes", "10")
    max_attempts = request.POST.get("max_attempts", "1")
    unlimited_attempts = request.POST.get("unlimited_attempts") == "on"
    viva_tone = request.POST.get("viva_tone", "Supportive")
    feedback_visibility = request.POST.get("feedback_visibility", "immediate")
    allow_student_report = request.POST.get("allow_student_report") == "on"
    allow_early_submission = request.POST.get("allow_early_submission") == "on"
    enable_model_answers = request.POST.get("enable_model_answers") == "on"
    allow_student_resource_toggle = request.POST.get("allow_student_resource_toggle") == "on"
    event_tracking = request.POST.get("event_tracking") == "on"
    keystroke_tracking = request.POST.get("keystroke_tracking") == "on"
    arrhythmic_typing = request.POST.get("arrhythmic_typing") == "on"
    viva_instructions = request.POST.get("viva_instructions", "")
    additional_prompts = request.POST.get("additional_prompts", "")
    instructor_notes = request.POST.get("instructor_notes", "")

    custom_params = {
        "assignment_description": description,
        "viva_duration_minutes": str(duration_minutes),
        "max_attempts": "0" if unlimited_attempts else str(max_attempts),
        "unlimited_attempts": "true" if unlimited_attempts else "false",
        "viva_tone": viva_tone,
        "feedback_visibility": feedback_visibility,
        "allow_student_report": "true" if allow_student_report else "false",
        "allow_early_submission": "true" if allow_early_submission else "false",
        "enable_model_answers": "true" if enable_model_answers else "false",
        "allow_student_resource_toggle": "true" if allow_student_resource_toggle else "false",
        "event_tracking": "true" if event_tracking else "false",
        "keystroke_tracking": "true" if keystroke_tracking else "false",
        "arrhythmic_typing": "true" if arrhythmic_typing else "false",
        "viva_instructions": viva_instructions,
        "additional_prompts": additional_prompts,
        "instructor_notes": instructor_notes,
    }
    if unlimited_attempts:
        custom_params["allow_multiple_submissions"] = "true"
    else:
        try:
            attempts_int = int(max_attempts)
        except (TypeError, ValueError):
            attempts_int = 1
        custom_params["allow_multiple_submissions"] = "true" if attempts_int > 1 else "false"

    # Load from ToolConfig instead of settings
    platform = ToolConfig.objects.first()

    jwt_token = build_deep_link_jwt(
        return_url=return_url,
        title=title,
        launch_url=platform.redirect_uri,   # <-- FIXED
        description=description,
        custom_params=custom_params,
    )

    return render(request, "tool/deeplink_return.html", {
        "return_url": return_url,
        "jwt": jwt_token,
    })

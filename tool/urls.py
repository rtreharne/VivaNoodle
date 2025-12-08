from django.urls import path
from . import views

urlpatterns = [
    #path("", views.index),
    path("", views.home, name="landing_home"),

    # LTI Core
    path("login/", views.lti_login, name="lti_login"),
    path("launch/", views.lti_launch, name="lti_launch"),
    path("landing/", views.landing, name="lti_landing"),
    path("jwks/", views.jwks),

    # Deep Linking (for creating assignments only)
    path("deeplink/", views.deeplink, name="deeplink"),
    path("deeplink/submit/", views.deeplink_submit, name="deeplink_submit"),

    # Assignment main view (students + instructors)
    path("assignment/", views.assignment_view, name="assignment_view"),

    # NEW — Internal Assignment Editing (no deep linking)
    path("assignment/edit/", views.assignment_edit, name="assignment_edit"),
    path("assignment/edit/save/", views.assignment_edit_save, name="assignment_edit_save"),

    # Student Submission
    path("submit_text/", views.submit_text, name="submit_text"),
    path("submit_file/", views.submit_file, name="submit_file"),
    path("submission/<int:submission_id>/", views.submission_status, name="submission_status"),

    # nprs
    path("nrps/test/", views.nrps_test, name="nrps_test"),


    # Viva session
    path("viva/start/<int:submission_id>/", views.viva_start, name="viva_start"),
    path("viva/session/<int:session_id>/", views.viva_session, name="viva_session"),
    path("viva/send/", views.viva_send_message, name="viva_send_message"),
    path("viva/log/", views.viva_log_event, name="viva_log_event"),
    path("viva/summary/<int:session_id>/", views.viva_summary, name="viva_summary"),
    path("viva/logs/<int:session_id>/", views.viva_logs, name="viva_logs"),





]

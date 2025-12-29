from django.urls import path
from . import views

urlpatterns = [
    #path("", views.index),
    path("", views.home, name="landing_home"),

    # Standalone auth + app
    path("app/signup/", views.standalone_signup, name="standalone_signup"),
    path("app/login/", views.standalone_login, name="standalone_login"),
    path("app/password-reset/", views.standalone_password_reset, name="standalone_password_reset"),
    path("app/password-reset/<str:uidb64>/<str:token>/", views.standalone_password_reset_confirm, name="standalone_password_reset_confirm"),
    path("app/logout/", views.standalone_logout, name="standalone_logout"),
    path("app/", views.standalone_app_home, name="standalone_app_home"),
    path("app/assignments/new/", views.standalone_assignment_create, name="standalone_assignment_create"),
    path("app/assignments/<slug:slug>/", views.standalone_assignment_entry, name="standalone_assignment_entry"),
    path("app/assignments/<slug:slug>/self-enroll/", views.standalone_self_enroll_manage, name="standalone_self_enroll_manage"),
    path("app/assignments/<slug:slug>/invite/create/", views.standalone_invite_create, name="standalone_invite_create"),
    path("app/assignments/<slug:slug>/invites/", views.standalone_invites, name="standalone_invites"),
    path("app/invites/<int:invite_id>/resend/", views.standalone_invite_resend, name="standalone_invite_resend"),
    path("app/student/", views.standalone_student_assignments, name="standalone_student_assignments"),
    path("app/student/assignments/<slug:slug>/", views.standalone_student_entry, name="standalone_student_entry"),
    path("app/student/invites/<str:token>/accept/", views.standalone_invite_accept_logged_in, name="standalone_invite_accept_logged_in"),
    path("app/join/<str:token>/", views.standalone_self_enroll, name="standalone_self_enroll"),
    path("app/join/<str:token>/password-reset/", views.standalone_self_enroll_password_reset, name="standalone_self_enroll_password_reset"),
    path("app/join/<str:token>/password-reset/<str:uidb64>/<str:reset_token>/", views.standalone_self_enroll_password_reset_confirm, name="standalone_self_enroll_password_reset_confirm"),
    path("invite/<str:token>/", views.accept_invite, name="accept_invite"),
    path("app/verify/<str:token>/", views.verify_instructor, name="verify_instructor"),

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
    path("assignment/feedback/release/", views.assignment_feedback_release, name="assignment_feedback_release"),
    path("assignment/attempts/<int:session_id>/download/", views.student_attempt_download, name="student_attempt_download"),

    # Student Submission
    path("submit_text/", views.submit_text, name="submit_text"),
    path("submit_file/", views.submit_file, name="submit_file"),
    path("submission/<int:submission_id>/delete/", views.delete_submission, name="delete_submission"),
    path("submission/<int:submission_id>/", views.submission_status, name="submission_status"),
    path("assignment/resources/upload/", views.upload_assignment_resource, name="upload_assignment_resource"),
    path("assignment/resources/<int:resource_id>/toggle/", views.toggle_assignment_resource, name="toggle_assignment_resource"),
    path("assignment/resources/<int:resource_id>/preference/", views.toggle_assignment_resource_preference, name="toggle_assignment_resource_preference"),
    path("assignment/resources/<int:resource_id>/delete/", views.delete_assignment_resource, name="delete_assignment_resource"),

    # nprs
    path("nrps/test/", views.nrps_test, name="nrps_test"),


    # Viva session
    path("viva/start/<int:submission_id>/", views.viva_start, name="viva_start"),
    path("viva/session/<int:session_id>/", views.viva_session, name="viva_session"),
    path("viva/send/", views.viva_send_message, name="viva_send_message"),
    path("viva/feedback/<int:session_id>/", views.viva_feedback_update, name="viva_feedback_update"),
    path("viva/toggle_submission/", views.viva_toggle_submission, name="viva_toggle_submission"),
    path("viva/toggle_resource/", views.viva_toggle_resource, name="viva_toggle_resource"),
    path("viva/log/", views.viva_log_event, name="viva_log_event"),
    path("viva/summary/<int:session_id>/", views.viva_summary, name="viva_summary"),
    path("viva/logs/<int:session_id>/", views.viva_logs, name="viva_logs"),





]

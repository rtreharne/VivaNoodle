from .launch import index, lti_login, lti_launch, jwks, landing
from .deeplink import deeplink, deeplink_submit
from .assignment import assignment_view, assignment_edit, assignment_edit_save
from .submission import (
    submit_text,
    submit_file,
    submission_status,
    delete_submission,
    upload_assignment_resource,
    toggle_assignment_resource,
    toggle_assignment_resource_preference,
    delete_assignment_resource,
)
from .nrps_test import nrps_test
from .viva import viva_start, viva_session, viva_send_message, viva_toggle_submission, viva_toggle_resource, viva_log_event, viva_summary, viva_logs
from .home import home
from .standalone import (
    standalone_signup,
    standalone_login,
    standalone_logout,
    standalone_app_home,
    standalone_assignment_create,
    standalone_assignment_entry,
    standalone_invites,
    standalone_invite_resend,
    standalone_invite_create,
    accept_invite,
    standalone_student_assignments,
    standalone_student_entry,
    standalone_invite_accept_logged_in,
    verify_instructor,
)

from django.apps import AppConfig
from django.conf import settings


class ToolConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'tool'

    def ready(self):
        from .models import ToolConfig as PlatformConfig
        from django.db.utils import OperationalError, ProgrammingError

        try:
            if PlatformConfig.objects.exists():
                return

            required_settings = {
                "issuer": getattr(settings, "LTI_ISS", ""),
                "jwks_url": getattr(settings, "LTI_PLATFORM_JWKS_URL", ""),
                "authorize_url": getattr(settings, "LTI_PLATFORM_AUTHORIZE_URL", ""),
                "redirect_uri": getattr(settings, "LTI_REDIRECT_URI", ""),
                "client_id": getattr(settings, "LTI_CLIENT_ID", ""),
                "deployment_id": getattr(settings, "LTI_DEPLOYMENT_ID", ""),
            }

            if not all(required_settings.values()):
                print("⚠️ Skipping default ToolConfig creation: missing LTI environment variables.")
                return

            PlatformConfig.objects.create(
                platform="Canvas",
                issuer=required_settings["issuer"],
                jwks_url=required_settings["jwks_url"],
                authorize_url=required_settings["authorize_url"],
                redirect_uri=required_settings["redirect_uri"],
                token_url=required_settings["issuer"] + "/login/oauth2/token",
                client_id=required_settings["client_id"],
                deployment_id=required_settings["deployment_id"],
            )
            print("🟢 Created initial ToolConfig (Canvas).")
        except (OperationalError, ProgrammingError):
            # Happens before migrations
            pass

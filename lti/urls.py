from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve

urlpatterns = [
    # Add Django admin
    path('admin/', admin.site.urls),
    path("", include("tool.urls")),
]

# Serve static files for development even when DEBUG=False
if settings.STATICFILES_DIRS:
    urlpatterns += [
        path('static/<path:path>', serve, {'document_root': settings.STATICFILES_DIRS[0]}),
    ]
if settings.MEDIA_ROOT:
    urlpatterns += [
        path('media/<path:path>', serve, {'document_root': settings.MEDIA_ROOT}),
    ]

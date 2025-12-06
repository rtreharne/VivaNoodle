# settings.py

from pathlib import Path
import os
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env
load_dotenv(BASE_DIR / ".env")

# ----------------------------------------------------
# SECURITY
# ----------------------------------------------------

SECRET_KEY = os.getenv("SECRET_KEY", "unsafe-default-key-change-me")
DEBUG = os.getenv("DEBUG", "False").lower() == "true"

ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "").split(",")

# ----------------------------------------------------
# Application / Django
# ----------------------------------------------------

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'tool',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'lti.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'lti.wsgi.application'

# ----------------------------------------------------
# DATABASE
# ----------------------------------------------------
DATABASES = {
    'default': {
        'ENGINE': os.getenv("DB_ENGINE", "django.db.backends.sqlite3"),
        'NAME': os.getenv("DB_NAME", BASE_DIR / 'db.sqlite3'),
        'USER': os.getenv("DB_USER", ""),
        'PASSWORD': os.getenv("DB_PASSWORD", ""),
        'HOST': os.getenv("DB_HOST", ""),
        'PORT': os.getenv("DB_PORT", ""),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {"NAME": 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {"NAME": 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {"NAME": 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-uk'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True


DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# ----------------------------------------------------
# COOKIES / SECURITY for LTI
# ----------------------------------------------------

SESSION_COOKIE_SAMESITE = None
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_DOMAIN = None  # Must be None for cross-site LTI

CSRF_COOKIE_SAMESITE = None
CSRF_COOKIE_SECURE = True

CSRF_TRUSTED_ORIGINS = os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",")

SESSION_ENGINE = "django.contrib.sessions.backends.db"
X_FRAME_OPTIONS = "ALLOWALL"

STATIC_URL = "/static/"

STATICFILES_DIRS = [
    BASE_DIR / "tool" / "static",
]

# ----------------------------------------------------
# MEDIA (File uploads)
# ----------------------------------------------------

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"


# ----------------------------------------------------
# LTI Platform configuration (used for default ToolConfig)
# ----------------------------------------------------
LTI_ISS = os.getenv("LTI_ISS", "")
LTI_CLIENT_ID = os.getenv("LTI_CLIENT_ID", "")
LTI_DEPLOYMENT_ID = os.getenv("LTI_DEPLOYMENT_ID", "")
LTI_PLATFORM_JWKS_URL = os.getenv("LTI_PLATFORM_JWKS_URL", "")
LTI_PLATFORM_AUTHORIZE_URL = os.getenv("LTI_PLATFORM_AUTHORIZE_URL", "")
LTI_REDIRECT_URI = os.getenv("LTI_REDIRECT_URI", "")

# VivaNoodle – Setup Guide

This guide explains how to install VivaNoodle and integrate it with any LTI 1.3–compatible LMS.  
Canvas Cloud is used for examples, but the process is the same for Moodle, Blackboard, Brightspace, D2L, Sakai, etc.

---

## 1. Clone & Install

```bash
git clone git@github.com:rtreharne/VivaNoodle.git
cd VivaNoodle

python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

---

## 2. Migrate Database

```bash
python manage.py migrate
```

---

## 3. Generate RSA Keys

```bash
mkdir -p lti_keys
openssl genrsa -out lti_keys/private.pem 2048
openssl rsa -in lti_keys/private.pem -pubout -out lti_keys/public.pem
```

Do **not** commit these keys. They are ignored by default.

---

## 4. Create a Django Superuser

```bash
python manage.py createsuperuser
```

---

## 5. Create an LTI 1.3 Developer Key in Your LMS  
(Example: Canvas Cloud)

### In Canvas:
1. Go to **Admin → Developer Keys**
2. Click **+ Developer Key → LTI Key**
3. Choose **Manual Entry**

### Key Settings

| Field | Example |
|-------|---------|
| Key Name | VivaNoodle |
| Redirect URIs | `https://your-domain.com/launch/` |
| Privacy Level | Public |
| Owner Email | your@email |

---

### LTI Key Configuration

| Field | Example |
|-------|---------|
| **OIDC Login URL** | `https://your-domain.com/login/` |
| **Target Link URI** | `https://your-domain.com/launch/` |
| **JWKs URL** | `https://your-domain.com/jwks/` |

After saving, Canvas provides:

- **Client ID**  
- **Issuer (iss):** `https://canvas.instructure.com`  
- **Authorization URL:** `https://canvas.instructure.com/api/lti/authorize_redirect`  
- **Platform JWKS URL:** `https://canvas.instructure.com/api/lti/security/jwks`  
- **Deployment ID** (created when you install the app into a course)

---

## 6. Install the Tool in Your LMS  
(Canvas example)

1. Go to **Course → Settings → Apps**
2. Click **+ App**
3. Choose **By Client ID**
4. Paste the Client ID from the Developer Key  
5. Canvas installs the tool and shows you the **Deployment ID**

---

## 7. Create a ToolConfig Entry in VivaNoodle

Visit:

```
https://your-domain.com/admin/
```

Go to:

**VivaNoodle → Tool Configurations → Add**

Enter the values from Canvas:

| ToolConfig Field | Example |
|------------------|---------|
| Issuer | `https://canvas.instructure.com` |
| Client ID | from Canvas |
| Deployment ID | from Canvas |
| Auth Endpoint | `https://canvas.instructure.com/api/lti/authorize_redirect` |
| Platform JWKS URL | `https://canvas.instructure.com/api/lti/security/jwks` |
| Name | Canvas Production |

Save the configuration.

You may create multiple ToolConfigs for different LMSes or different environments.

---

## 8. Run the Server

```bash
python manage.py runserver 0.0.0.0:8000
```

---

## 9. Launch VivaNoodle From Your LMS

Once installed, VivaNoodle can be launched from:

- Course Navigation  
- Modules  
- Assignments (if AGS enabled)  

The flow:

1. LMS → VivaNoodle `/login/` (OIDC)  
2. VivaNoodle redirects back to LMS  
3. LMS signs and sends `id_token`  
4. VivaNoodle validates it  
5. Instructor or student interface loads automatically

---

## Troubleshooting

### ❌ “No matching ToolConfig”
One of the client/deployment/issuer values does not match.

### ❌ “invalid_state” or “invalid_nonce”
Ensure HTTPS and correct redirect URLs.

### ❌ JWKS key errors
Confirm your `/jwks/` endpoint is publicly accessible.

---

## 🎓 Credits

- **Original concept:** **Simon Bell**  
- **Design & implementation:** **Dr. Robert Treharne**

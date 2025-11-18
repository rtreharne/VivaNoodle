# VivaNoodle
### AI-powered viva/oral assessment for any LTI-enabled LMS

VivaNoodle is a next-generation assessment tool that brings authentic viva-style oral examinations into any Learning Management System that supports **LTI 1.3**.

Designed for universities, colleges, and professional training providers, VivaNoodle uses AI to generate personalised viva questions based on a learner’s own submitted work. Tutors gain deep insights, while students experience meaningful, conversational assessment.

VivaNoodle works with:

- Canvas  
- Moodle  
- Blackboard  
- Brightspace  
- D2L  
- Sakai  
- OpenLMS  
- Any IMS-certified platform

---

## 🌟 Key Benefits

### 🎓 Authentic Assessment at Scale
VivaNoodle analyses the student's submission and dynamically generates probing questions—simulating a real viva examination.

### 🔍 Academic Integrity Monitoring
Every session logs:
- keystrokes  
- copy/cut/paste events  
- tab switches  
- focus/blur behaviour  
- suspicious patterns  

Flags can be generated automatically.

### 👩‍🏫 Instructor Dashboard
Instructors can:
- review all viva submissions  
- inspect transcripts  
- analyse behaviour logs  
- toggle anonymous/deanonymised review  
- export data for moderation  

### 🔐 LTI 1.3 Secure Integration
No separate login. VivaNoodle launches inside your existing LMS using secure, standards-based authentication.

---

## 🧩 Architecture
- Works alongside any LMS that supports LTI 1.3  
- No secrets stored in environment variables  
- All LTI config stored in a UI-managed **ToolConfig** model  
- Supports multiple LMS connections simultaneously  
- JWKS-backed cryptographic signing  
- Easily deployable in academic environments  

---

## 💡 Origin & Vision
The original concept for VivaNoodle was created by **Simon Bell**.  
The platform has since evolved into a robust AI-powered assessment system focusing on authenticity, academic integrity, and student experience.

---

## 📘 Installation & Setup

Technical setup instructions—including key generation, Canvas example configuration, and creating ToolConfig entries—are available in:

👉 **[SETUP.md](SETUP.md)**

---

## 📄 License  
MIT License.

---



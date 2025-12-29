document.addEventListener("DOMContentLoaded", () => {
    const accessModal = document.querySelector("[data-access-modal]");
    const openButtons = document.querySelectorAll("[data-access-modal-open]");
    if (!accessModal || !openButtons.length) return;

    const closeButtons = accessModal.querySelectorAll("[data-access-modal-close]");
    const accessTitle = accessModal.querySelector("[data-access-title]");
    const inviteForm = accessModal.querySelector("[data-invite-form]");
    const inviteStatus = accessModal.querySelector("[data-invite-status]");
    const selfEnrollForm = accessModal.querySelector("[data-self-enroll-form]");
    const selfEnrollStatus = accessModal.querySelector("[data-self-enroll-status]");
    const selfEnrollLink = accessModal.querySelector("#self-enroll-link");
    const selfEnrollDomain = accessModal.querySelector("#self-enroll-domain");
    const selfEnrollIframe = accessModal.querySelector("#self-enroll-iframe");
    const inviteEmail = accessModal.querySelector("#invite-email");
    const copyButtons = accessModal.querySelectorAll("[data-copy-target]");
    let lastFocused = null;

    const getCookie = (name) => {
        const cookies = document.cookie ? document.cookie.split("; ") : [];
        for (const c of cookies) {
            if (c.startsWith(name + "=")) {
                return decodeURIComponent(c.split("=").slice(1).join("="));
            }
        }
        return null;
    };

    const setStatus = (el, msg, tone = "neutral") => {
        if (!el) return;
        el.textContent = msg || "";
        el.dataset.tone = tone;
        el.classList.toggle("is-hidden", !msg);
    };

    const attachAjaxForm = (form, statusEl) => {
        if (!form) return;
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const csrf = form.querySelector("input[name='csrfmiddlewaretoken']")?.value || getCookie("csrftoken");
            setStatus(statusEl, "Sending...", "neutral");
            try {
                const resp = await fetch(form.action, {
                    method: form.method || "POST",
                    headers: {
                        "X-Requested-With": "XMLHttpRequest",
                        ...(csrf ? { "X-CSRFToken": csrf } : {}),
                    },
                    body: formData,
                    redirect: "follow",
                    credentials: "same-origin",
                });
                if (resp.ok) {
                    setStatus(statusEl, "Saved. Refreshing...", "success");
                    setTimeout(() => window.location.reload(), 400);
                } else {
                    setStatus(statusEl, "Couldn't save right now. Trying again...", "error");
                    form.submit();
                }
            } catch (err) {
                setStatus(statusEl, "Connection issue. Trying again...", "error");
                form.submit();
            }
        });
    };

    const copyText = async (text) => {
        if (!text) return false;
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch (err) {
            return false;
        }
        return false;
    };

    const fallbackCopy = (text) => {
        if (!text) return false;
        const temp = document.createElement("textarea");
        temp.value = text;
        temp.setAttribute("readonly", "readonly");
        temp.style.position = "absolute";
        temp.style.left = "-9999px";
        document.body.appendChild(temp);
        temp.select();
        let copied = false;
        try {
            copied = document.execCommand("copy");
        } catch (err) {
            copied = false;
        }
        document.body.removeChild(temp);
        return copied;
    };

    copyButtons.forEach((btn) => {
        const originalLabel = btn.textContent;
        btn.dataset.copyLabel = originalLabel;
        btn.addEventListener("click", async (e) => {
            e.preventDefault();
            const targetId = btn.dataset.copyTarget;
            const targetEl = targetId ? document.getElementById(targetId) : null;
            if (!targetEl) return;
            const text = "value" in targetEl ? targetEl.value : (targetEl.textContent || "");
            if (!text) return;
            let copied = await copyText(text);
            if (!copied) {
                copied = fallbackCopy(text);
            }
            if (copied) {
                btn.textContent = "Copied";
                btn.dataset.copied = "true";
                setTimeout(() => {
                    if (btn.dataset.copied) {
                        btn.textContent = btn.dataset.copyLabel || originalLabel;
                        btn.dataset.copied = "";
                    }
                }, 1600);
            }
        });
    });

    const getFocusable = () => Array.from(accessModal.querySelectorAll(
        "a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])"
    ));

    const trapFocus = (e) => {
        if (e.key !== "Tab") return;
        const focusable = getFocusable();
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    };

    const resetStatus = () => {
        setStatus(inviteStatus, "", "neutral");
        setStatus(selfEnrollStatus, "", "neutral");
    };

    const openAccessModal = (trigger) => {
        const title = trigger?.dataset.assignmentTitle || "";
        if (accessTitle) {
            accessTitle.textContent = title ? `Manage access - ${title}` : "Manage access";
        }
        if (inviteForm && trigger?.dataset.inviteUrl) {
            inviteForm.action = trigger.dataset.inviteUrl;
        }
        if (selfEnrollForm && trigger?.dataset.selfEnrollManageUrl) {
            selfEnrollForm.action = trigger.dataset.selfEnrollManageUrl;
        }
        if (selfEnrollLink) {
            selfEnrollLink.value = trigger?.dataset.selfEnrollLink || "";
        }
        if (selfEnrollDomain) {
            selfEnrollDomain.value = trigger?.dataset.selfEnrollDomain || "";
        }
        if (selfEnrollIframe) {
            selfEnrollIframe.value = trigger?.dataset.selfEnrollIframe || "";
        }
        if (inviteEmail) inviteEmail.value = "";
        resetStatus();

        lastFocused = document.activeElement;
        accessModal.classList.add("open");
        document.addEventListener("keydown", trapFocus);
        const focusTarget = inviteEmail || getFocusable()[0] || accessModal;
        if (focusTarget && typeof focusTarget.focus === "function") {
            focusTarget.focus();
        }
    };

    const closeAccessModal = (e) => {
        e?.preventDefault();
        accessModal.classList.remove("open");
        document.removeEventListener("keydown", trapFocus);
        if (lastFocused && typeof lastFocused.focus === "function") {
            lastFocused.focus();
        }
    };

    openButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            openAccessModal(btn);
        });
    });
    closeButtons.forEach(btn => btn.addEventListener("click", closeAccessModal));
    accessModal.addEventListener("click", (e) => {
        if (e.target === accessModal) closeAccessModal(e);
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && accessModal.classList.contains("open")) {
            closeAccessModal(e);
        }
    });

    attachAjaxForm(inviteForm, inviteStatus);
    attachAjaxForm(selfEnrollForm, selfEnrollStatus);
});

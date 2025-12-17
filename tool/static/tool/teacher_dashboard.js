document.addEventListener("DOMContentLoaded", () => {
    const dataEl = document.getElementById("dashboard-data");
    if (!dataEl) return;

    const data = JSON.parse(dataEl.textContent || "{}");
    const students = data.students || [];

    const viewButtons = document.querySelectorAll("[data-view-switch]");
    const viewPanes = document.querySelectorAll("[data-view-pane]");
    const transcriptPane = document.querySelector("[data-dash-pane='transcript']");
    const tablePane = document.querySelector("[data-dash-pane='table']");
    const tableNote = document.querySelector("[data-table-note]");
    const tableNoteTop = document.querySelector("[data-table-note-top]");
    const filterInput = document.querySelector("[data-student-filter]");
    const transcriptSelect = document.querySelector("[data-transcript-select]");
    const transcriptChat = document.querySelector("[data-transcript-chat]");
    const transcriptEvents = document.querySelector("[data-transcript-events]");
    const transcriptFeedback = document.querySelector("[data-transcript-feedback]");
    const transcriptSummary = document.querySelector("[data-transcript-summary]");
    const transcriptDuration = document.querySelector("[data-transcript-duration]");
    const transcriptStatus = document.querySelector("[data-transcript-status]");
    const backBtn = document.querySelector("[data-transcript-back]");
    const backToTop = document.querySelector("[data-back-to-top]");
    const themeToggle = document.querySelector("[data-theme-toggle]");
    const settingsForm = document.querySelector("[data-settings-form]");
    const saveStatus = document.querySelector("[data-save-status]");
    const toast = document.querySelector("[data-save-toast]");

    const showPane = (target) => {
        viewButtons.forEach(btn => {
            btn.classList.toggle("active", btn.dataset.viewSwitch === target);
        });
        viewPanes.forEach(pane => {
            pane.classList.toggle("active", pane.dataset.viewPane === target);
        });
    };

    viewButtons.forEach(btn => {
        btn.addEventListener("click", () => showPane(btn.dataset.viewSwitch));
    });

    if (tableNote && data.stats) {
        const { total, completed, flagged } = data.stats;
        tableNote.textContent = `Roster: ${completed}/${total} completed · ${flagged} flagged · click a student to review.`;
    }
    if (tableNoteTop && data.stats) {
        const { total, completed, flagged } = data.stats;
        tableNoteTop.textContent = `Roster: ${completed}/${total} completed · ${flagged} flagged · click a student to review.`;
    }

    const formatDuration = (seconds) => {
        if (!seconds && seconds !== 0) return "Duration: —";
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `Duration: ${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    };

    const renderMessages = (messages = []) => {
        if (!transcriptChat) return;
        transcriptChat.innerHTML = "";

        if (!messages.length) {
            const p = document.createElement("div");
            p.className = "bubble system";
            p.textContent = "No transcript available yet.";
            transcriptChat.appendChild(p);
            return;
        }

        messages.forEach(msg => {
            const bubble = document.createElement("div");
            bubble.className = `bubble ${msg.sender === "ai" ? "ai" : "user"}`;
            bubble.textContent = msg.text;

            if (msg.timestamp) {
                const ts = document.createElement("span");
                ts.className = "msg-ts";
                ts.textContent = new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                bubble.appendChild(ts);
            }

            transcriptChat.appendChild(bubble);
        });
    };

    const renderFlags = (flags = []) => {
        if (!transcriptEvents) return;
        transcriptEvents.innerHTML = "";

        if (!flags.length) {
            const li = document.createElement("li");
            li.className = "muted";
            li.textContent = "No integrity flags recorded.";
            transcriptEvents.appendChild(li);
            return;
        }

        flags.forEach(flag => {
            const li = document.createElement("li");
            const dot = document.createElement("span");
            dot.className = "dot warn";
            li.appendChild(dot);
            li.append(flag);
            transcriptEvents.appendChild(li);
        });
    };

    const renderFeedback = (feedback) => {
        if (!transcriptFeedback || !transcriptSummary) return;

        const renderBlock = (target, text) => {
            target.innerHTML = "";
            const p = document.createElement("p");
            p.textContent = text || "Feedback pending.";
            target.appendChild(p);
        };

        if (!feedback) {
            renderBlock(transcriptFeedback, "Feedback pending.");
            renderBlock(transcriptSummary, "Feedback pending.");
            return;
        }

        renderBlock(transcriptFeedback, feedback.strengths || "Feedback pending.");

        const summaryParts = [
            feedback.impression,
            feedback.improvements,
            feedback.misconceptions,
        ].filter(Boolean);

        renderBlock(transcriptSummary, summaryParts.join(" ") || "Feedback pending.");
    };

    const populateSelect = () => {
        if (!transcriptSelect) return;
        transcriptSelect.innerHTML = `<option value="" disabled selected>Select a student</option>`;
        students
            .filter(s => s.viva)
            .forEach(s => {
                const opt = document.createElement("option");
                opt.value = s.user_id;
                opt.textContent = s.name;
                transcriptSelect.appendChild(opt);
            });
    };

    const renderTranscript = (student) => {
        if (!student) return;

        const { viva } = student;

        if (transcriptSelect && student.user_id) {
            transcriptSelect.value = student.user_id;
        }

        if (!viva) {
            renderMessages([]);
            renderFlags([]);
            renderFeedback(null);
            if (transcriptDuration) transcriptDuration.textContent = "Duration: —";
            if (transcriptStatus) transcriptStatus.textContent = "Pending";
            return;
        }

        renderMessages(viva.messages || []);
        renderFlags(viva.flags || []);
        renderFeedback(viva.feedback);

        if (transcriptDuration) {
            transcriptDuration.textContent = formatDuration(viva.duration_seconds);
        }
        if (transcriptStatus) {
            const label = (student.status || "completed").replace("_", " ");
            transcriptStatus.textContent = label.charAt(0).toUpperCase() + label.slice(1);
        }
    };

    const findStudent = (userId) => students.find(s => String(s.user_id) === String(userId));

    const attachRowHandlers = () => {
        document.querySelectorAll("[data-view-transcript]").forEach(link => {
            link.addEventListener("click", (e) => {
                e.preventDefault();
                const uid = link.dataset.viewTranscript;
                const student = findStudent(uid);
                if (!student) return;
                renderTranscript(student);
                showPane("dashboard");
                if (tablePane) tablePane.classList.remove("active");
                if (transcriptPane) transcriptPane.classList.add("active");
            });
        });
    };

    if (backBtn) {
        backBtn.addEventListener("click", () => {
            if (transcriptPane) transcriptPane.classList.remove("active");
            if (tablePane) tablePane.classList.add("active");
        });
    }

    if (transcriptSelect) {
        transcriptSelect.addEventListener("change", (e) => {
            const student = findStudent(e.target.value);
            if (student) {
                renderTranscript(student);
                if (tablePane) tablePane.classList.remove("active");
                if (transcriptPane) transcriptPane.classList.add("active");
            }
        });
    }

    if (filterInput) {
        const rows = () => Array.from(document.querySelectorAll("[data-student-row]"));
        const opts = () => Array.from(transcriptSelect ? transcriptSelect.querySelectorAll("option") : []);

        filterInput.addEventListener("input", (e) => {
            const term = e.target.value.trim().toLowerCase();

            rows().forEach(row => {
                const name = row.querySelector("div")?.textContent?.toLowerCase() || "";
                row.style.display = term && !name.includes(term) ? "none" : "";
            });

            opts().forEach(opt => {
                if (!opt.value) return;
                const label = opt.textContent.toLowerCase();
                opt.hidden = term && !label.includes(term);
            });
        });
    }

    if (backToTop) {
        const carouselTop = document.querySelector(".carousel");
        const onScroll = () => {
            const threshold = (carouselTop?.getBoundingClientRect().top || 0) + window.scrollY + 60;
            if (window.scrollY > threshold) {
                backToTop.classList.add("show");
            } else {
                backToTop.classList.remove("show");
            }
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
        onScroll();
    }

    const getCookie = (name) => {
        const cookies = document.cookie ? document.cookie.split("; ") : [];
        for (const c of cookies) {
            if (c.startsWith(name + "=")) {
                return decodeURIComponent(c.split("=").slice(1).join("="));
            }
        }
        return null;
    };

    if (settingsForm) {
        let dirty = false;
        let saveTimeout = null;

        const showToast = (msg) => {
            if (!toast) return;
            toast.textContent = msg;
            toast.classList.add("show");
            setTimeout(() => {
                toast.classList.remove("show");
            }, 2000);
        };

        const scheduleSave = () => {
            if (saveTimeout) clearTimeout(saveTimeout);
            saveTimeout = setTimeout(runSave, 800);
        };

        const markDirty = () => {
            dirty = true;
            if (saveStatus) saveStatus.textContent = "Saving…";
            scheduleSave();
        };

        const runSave = async () => {
            if (!dirty) return;
            const formData = new FormData(settingsForm);
            try {
                const resp = await fetch(settingsForm.action, {
                    method: "POST",
                    headers: {
                        "X-Requested-With": "XMLHttpRequest",
                        "X-CSRFToken": getCookie("csrftoken") || "",
                    },
                    body: formData,
                });
                if (!resp.ok) {
                    const text = await resp.text();
                    throw new Error(text || resp.statusText);
                }
                const data = await resp.json();
                if (data.status === "ok") {
                    dirty = false;
                    if (saveStatus) saveStatus.textContent = "";
                    showToast("Settings updated");
                } else {
                    if (saveStatus) saveStatus.textContent = "Save failed";
                }
            } catch (err) {
                if (saveStatus) saveStatus.textContent = "Save failed";
                console.error("Save error", err);
            }
        };

        settingsForm.addEventListener("input", markDirty, true);
        settingsForm.addEventListener("change", markDirty, true);

        settingsForm.addEventListener("submit", (e) => {
            e.preventDefault();
            markDirty();
        });
    }

    if (themeToggle) {
        const root = document.documentElement;
        const applyTheme = (mode) => {
            if (mode === "light") {
                root.setAttribute("data-theme", "light");
                themeToggle.textContent = "Dark";
            } else {
                root.setAttribute("data-theme", "dark");
                themeToggle.textContent = "Light";
            }
            localStorage.setItem("mv-theme", mode);
        };

        const saved = localStorage.getItem("mv-theme");
        applyTheme(saved === "light" ? "light" : "dark");

        themeToggle.addEventListener("click", () => {
            const current = root.getAttribute("data-theme") === "light" ? "light" : "dark";
            applyTheme(current === "light" ? "dark" : "light");
        });
    }

    populateSelect();
    attachRowHandlers();
});

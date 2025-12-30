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
    const exportBtn = document.querySelector("[data-export-csv]");
    const vivaFilterBtn = document.querySelector("[data-filter='viva']");
    const flagsFilterBtn = document.querySelector("[data-filter='flags']");
    const vivaFilterIndicator = document.querySelector("[data-filter-indicator='viva']");
    const flagsFilterIndicator = document.querySelector("[data-filter-indicator='flags']");
    const dashboardControls = document.querySelector("[data-dashboard-controls]");
    const transcriptSelect = document.querySelector("[data-transcript-select]");
    const attemptSelect = document.querySelector("[data-attempt-select]");
    const transcriptChat = document.querySelector("[data-transcript-chat]");
    const transcriptEvents = document.querySelector("[data-transcript-events]");
    const transcriptDuration = document.querySelector("[data-transcript-duration]");
    const transcriptFiles = document.querySelector("[data-transcript-files]");
    const aiFeedbackEl = document.querySelector("[data-ai-feedback]");
    const teacherFeedbackForm = document.querySelector("[data-teacher-feedback-form]");
    const teacherFeedbackInput = document.querySelector("[data-teacher-feedback-input]");
    const teacherFeedbackAuthorEl = document.querySelector("[data-teacher-feedback-author]");
    const teacherFeedbackStatus = document.querySelector("[data-teacher-feedback-status]");
    const previewModal = document.querySelector("[data-preview-modal]");
    const previewContent = document.querySelector("[data-preview-content]");
    const previewClose = document.querySelector("[data-preview-close]");
    const resourceCard = document.querySelector("[data-resource-upload]");
    const resourceList = document.querySelector("[data-resource-list]");
    const resourceUploadForm = document.querySelector("[data-resource-upload-form]");
    const resourceUploadInput = resourceUploadForm?.querySelector("[data-resource-upload-input]");
    const resourceUploadBtn = resourceUploadForm?.querySelector("[data-resource-upload-btn]");
    const resourceUploadHint = document.querySelector("[data-resource-upload-hint]");
    const resourceUploadUrl = resourceUploadForm?.dataset.uploadUrl;
    const resourceEmpty = document.querySelector("[data-resource-empty]");
    const backButtons = document.querySelectorAll("[data-transcript-back]");
    const backToTop = document.querySelector("[data-back-to-top]");
    const copyButtons = document.querySelectorAll("[data-copy-target]");
    const accessModal = document.querySelector("[data-access-modal]");
    const accessModalOpen = document.querySelector("[data-access-modal-open]");
    const accessModalClose = document.querySelectorAll("[data-access-modal-close]");
    const inviteForm = document.querySelector("[data-invite-form]");
    const inviteStatus = document.querySelector("[data-invite-status]");
    const selfEnrollForm = document.querySelector("[data-self-enroll-form]");
    const selfEnrollStatus = document.querySelector("[data-self-enroll-status]");
    const feedbackVisibilitySelect = document.querySelector("[data-feedback-visibility]");
    const feedbackReleaseRow = document.querySelector("[data-feedback-release-row]");
    const feedbackReleaseBtn = document.querySelector("[data-feedback-release]");
    const feedbackReleaseStatus = document.querySelector("[data-feedback-release-status]");
    const themeToggle = document.querySelector("[data-theme-toggle]");
    const settingsForm = document.querySelector("[data-settings-form]");
    const saveStatus = document.querySelector("[data-save-status]");
    const toast = document.querySelector("[data-save-toast]");
    let activeStudent = null;
    let activeFeedbackSessionId = null;
    if (attemptSelect) attemptSelect.disabled = true;

    const showPane = (target) => {
        viewButtons.forEach(btn => {
            btn.classList.toggle("active", btn.dataset.viewSwitch === target);
        });
        viewPanes.forEach(pane => {
            pane.classList.toggle("active", pane.dataset.viewPane === target);
        });
        if (dashboardControls) {
            dashboardControls.classList.toggle("is-hidden", target !== "dashboard");
        }
    };

    const getRowEls = () => Array.from(document.querySelectorAll("[data-student-row]"));
    const getRowHaystack = (row) => {
        const search = row.dataset.studentSearch || "";
        const name = row.querySelector("div")?.textContent?.toLowerCase() || "";
        return `${search} ${name}`.trim();
    };
    const vivaStates = ["all", "completed", "in_progress", "submitted", "pending", "invited"];
    const vivaStateLabels = {
        all: "All",
        completed: "Completed",
        in_progress: "In progress",
        submitted: "Submitted",
        pending: "Viva pending",
        invited: "Invite pending",
    };
    const flagStates = ["all", "flagged"];
    const flagStateLabels = {
        all: "All",
        flagged: "Flagged",
    };
    let vivaStateIndex = 0;
    let flagStateIndex = 0;

    const applyRowFilters = () => {
        const term = filterInput?.value.trim().toLowerCase() || "";
        const vivaState = vivaStates[vivaStateIndex];
        const flagState = flagStates[flagStateIndex];

        getRowEls().forEach((row) => {
            const matchesSearch = !term || getRowHaystack(row).includes(term);
            const status = (row.dataset.vivaStatus || "").toLowerCase();
            const hasFlags = row.dataset.hasFlags === "true";
            const matchesViva = vivaState === "all" || status === vivaState;
            const matchesFlags = flagState === "all" || (flagState === "flagged" && hasFlags);
            row.style.display = matchesSearch && matchesViva && matchesFlags ? "" : "none";
        });

        if (vivaFilterIndicator) {
            vivaFilterIndicator.textContent = vivaStateLabels[vivaStates[vivaStateIndex]] || "All";
            vivaFilterIndicator.classList.toggle("is-hidden", vivaStates[vivaStateIndex] === "all");
        }
        if (flagsFilterIndicator) {
            flagsFilterIndicator.textContent = flagStateLabels[flagStates[flagStateIndex]] || "All";
            flagsFilterIndicator.classList.toggle("is-hidden", flagStates[flagStateIndex] === "all");
        }
        if (vivaFilterBtn) {
            vivaFilterBtn.setAttribute("aria-pressed", vivaStates[vivaStateIndex] !== "all");
        }
        if (flagsFilterBtn) {
            flagsFilterBtn.setAttribute("aria-pressed", flagStates[flagStateIndex] !== "all");
        }
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

    const startCountdowns = () => {
        document.querySelectorAll("[data-remaining]").forEach(el => {
            let secs = parseInt(el.dataset.remaining, 10);
            const tick = () => {
                if (secs < 0) return;
                const m = Math.floor(secs / 60).toString().padStart(2, "0");
                const s = (secs % 60).toString().padStart(2, "0");
                el.textContent = `${m}:${s}`;
                secs -= 1;
            };
            tick();
            setInterval(tick, 1000);
        });
    };

    const formatDuration = (seconds) => {
        if (!seconds && seconds !== 0) return "Duration: —";
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `Duration: ${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return "";
        const date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) return "";
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    };

    const formatEventLabel = (event) => {
        if (!event) return "Event recorded.";
        const type = event.type || "event";
        const data = event.data || {};
        switch (type) {
            case "visibility":
                return null;
            case "blur":
            case "focus":
                return null;
            case "paste":
                return `Event: paste${data.length ? ` (${data.length} chars)` : ""}`;
            case "copy":
                if (data.source !== "ai") return null;
                return `Event: AI message copied${data.length ? ` (${data.length} chars)` : ""}`;
            case "cut":
                return null;
            case "arrhythmic_typing":
                return "Event: arrhythmic typing detected";
            case "typing_cadence":
                return "Event: typing cadence updated";
            default:
                return `Event: ${type}`;
        }
    };

    const bindPreviewLink = (link) => {
        if (!link) return;
        link.addEventListener("click", (e) => {
            e.preventDefault();
            if (!previewModal || !previewContent) return;
            previewContent.textContent = (link.dataset.previewText || "").replace(/\\u([\dA-Fa-f]{4})/g, (_, code) =>
                String.fromCharCode(parseInt(code, 16))
            );
            previewModal.classList.add("show");
        });
    };

    const setResourceHint = (msg) => {
        if (!resourceUploadHint) return;
        if (msg) {
            resourceUploadHint.textContent = msg;
            resourceUploadHint.classList.remove("is-hidden");
        } else {
            resourceUploadHint.textContent = "";
            resourceUploadHint.classList.add("is-hidden");
        }
    };

    const getResourceRows = () => resourceList ? Array.from(resourceList.querySelectorAll("[data-resource-id]")) : [];

    const recalcResourceTotals = () => {
        if (!resourceUploadForm) return { count: 0, size: 0 };
        const rows = getResourceRows();
        const count = rows.length;
        rows.forEach((row, idx) => {
            row.classList.toggle("row-alt", idx % 2 === 1);
        });
        const size = rows.reduce((acc, row) => {
            const sizeVal = parseInt(row.dataset.fileSize || "0", 10);
            return acc + (Number.isFinite(sizeVal) ? sizeVal : 0);
        }, 0);
        resourceUploadForm.dataset.existingCount = String(count);
        resourceUploadForm.dataset.existingSize = String(size);
        if (resourceEmpty) {
            resourceEmpty.classList.toggle("is-hidden", count > 0);
        }
        return { count, size };
    };

    const validateResourceSelection = () => {
        if (!resourceUploadInput || !resourceUploadForm || !resourceUploadBtn) return true;
        const maxFilesTotal = 10;
        const maxTotalBytes = 50 * 1024 * 1024;
        const existingCount = parseInt(resourceUploadForm.dataset.existingCount || "0", 10) || 0;
        const existingSize = parseInt(resourceUploadForm.dataset.existingSize || "0", 10) || 0;
        const files = resourceUploadInput.files || [];
        let selectedSize = 0;
        Array.from(files).forEach((f) => {
            selectedSize += f?.size || 0;
        });
        const totalCount = existingCount + files.length;
        const totalSize = existingSize + selectedSize;
        const overCount = totalCount > maxFilesTotal;
        const overSize = totalSize > maxTotalBytes;
        resourceUploadBtn.disabled = overCount || overSize || files.length === 0;
        if (overCount || overSize) {
            const parts = [];
            if (overCount) parts.push(`You can upload up to ${maxFilesTotal} files in total.`);
            if (overSize) parts.push("Combined size limit is 50MB.");
            setResourceHint(parts.join(" "));
        } else {
            setResourceHint("");
        }
        return !(overCount || overSize);
    };

    const toggleResourceInclude = async (resourceId, included) => {
        if (!resourceId) return;
        try {
            await fetch(`/assignment/resources/${resourceId}/toggle/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ resource_id: resourceId, included }),
            });
        } catch (err) {
            console.warn("Failed to toggle resource", err);
        }
    };

    const deleteResource = async (row, resourceId) => {
        if (!resourceId) return;
        try {
            const res = await fetch(`/assignment/resources/${resourceId}/delete/`, {
                method: "POST",
                headers: { "Accept": "application/json" },
                credentials: "same-origin",
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || "Unable to delete resource");
            }
            row?.remove();
            recalcResourceTotals();
            validateResourceSelection();
        } catch (err) {
            console.warn("Delete failed", err);
        }
    };

    const bindResourceRow = (row) => {
        if (!row) return;
        const resourceId = row.dataset.resourceId;
        const toggle = row.querySelector("[data-resource-include]");
        const deleteBtn = row.querySelector("[data-delete-resource]");
        const preview = row.querySelector(".file-preview");
        if (toggle) {
            toggle.addEventListener("change", () => {
                const included = !!toggle.checked;
                row.dataset.included = included ? "1" : "0";
                toggleResourceInclude(resourceId, included);
            });
        }
        if (deleteBtn) {
            deleteBtn.addEventListener("click", (e) => {
                e.preventDefault();
                deleteResource(row, resourceId);
            });
        }
        if (preview) {
            bindPreviewLink(preview);
        }
    };

    const appendResourceRow = (resource) => {
        if (!resourceList || !resource) return;
        const body = resourceList.querySelector(".submission-table-body");
        if (!body) return;
        const row = document.createElement("div");
        row.className = "submission-row";
        row.dataset.resourceId = resource.id;
        row.dataset.included = resource.included ? "1" : "0";
        row.dataset.fileName = resource.file_name || "Uploaded file";
        row.dataset.comment = resource.comment || "";
        row.dataset.fileSize = resource.file_size || 0;
        const fileCell = document.createElement("div");
        fileCell.className = "submission-cell file-name";
        const fileName = document.createElement("div");
        fileName.textContent = String(resource.file_name || "Uploaded file")
            .replace(/^assignment_resources\//, "")
            .slice(0, 40);
        const meta = document.createElement("div");
        meta.className = "meta";
        const preview = document.createElement("a");
        preview.href = "#";
        preview.className = "link file-preview";
        preview.textContent = "Preview text";
        preview.dataset.previewText = resource.comment || "";
        meta.appendChild(preview);
        fileCell.appendChild(fileName);
        fileCell.appendChild(meta);

        const includeCell = document.createElement("div");
        includeCell.className = "submission-cell";
        const toggleLabel = document.createElement("label");
        toggleLabel.className = "slider-toggle";
        toggleLabel.setAttribute("aria-label", "Include in viva");
        const toggleInput = document.createElement("input");
        toggleInput.type = "checkbox";
        toggleInput.dataset.resourceInclude = "";
        if (resource.included) toggleInput.checked = true;
        const track = document.createElement("span");
        track.className = "slider-track";
        const thumb = document.createElement("span");
        thumb.className = "slider-thumb";
        track.appendChild(thumb);
        toggleLabel.appendChild(toggleInput);
        toggleLabel.appendChild(track);
        includeCell.appendChild(toggleLabel);

        const actionsCell = document.createElement("div");
        actionsCell.className = "submission-cell submission-actions";
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "icon-btn danger";
        deleteBtn.type = "button";
        deleteBtn.dataset.deleteResource = resource.id;
        deleteBtn.textContent = "Delete";
        actionsCell.appendChild(deleteBtn);

        row.appendChild(fileCell);
        row.appendChild(includeCell);
        row.appendChild(actionsCell);
        body.prepend(row);
        bindResourceRow(row);
        recalcResourceTotals();
    };

    const buildEventTimeline = (events = []) => {
        const output = [];
        let lastBlur = null;
        events.forEach((evt) => {
            const ts = evt.timestamp;
            const type = evt.type;
            if (type === "visibility") return;
            if (type === "blur") {
                lastBlur = ts;
                return;
            }
            if (type === "focus") {
                if (lastBlur && ts) {
                    const awayMs = new Date(ts).getTime() - new Date(lastBlur).getTime();
                    const awaySeconds = Math.max(0, Math.round(awayMs / 1000));
                    output.push({
                        label: `Event: student navigated away from viva for ${awaySeconds} second${awaySeconds === 1 ? "" : "s"}`,
                        timestamp: ts,
                    });
                } else if (ts) {
                    output.push({ label: "Event: window focused", timestamp: ts });
                }
                lastBlur = null;
                return;
            }
            const label = formatEventLabel(evt);
            if (!label) return;
            output.push({ label, timestamp: ts });
        });
        return output;
    };

    const renderTranscriptTimeline = (messages = [], events = []) => {
        if (!transcriptChat) return;
        transcriptChat.innerHTML = "";

        const timeline = [];
        messages.forEach(msg => {
            timeline.push({
                kind: "message",
                sender: msg.sender,
                text: msg.text,
                timestamp: msg.timestamp,
            });
        });
        buildEventTimeline(events).forEach(evt => {
            timeline.push({
                kind: "event",
                label: evt.label,
                timestamp: evt.timestamp,
            });
        });

        const withTime = timeline.filter(item => item.timestamp);
        const withoutTime = timeline.filter(item => !item.timestamp);
        withTime.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const ordered = [...withTime, ...withoutTime];

        if (!ordered.length) {
            const p = document.createElement("div");
            p.className = "bubble system";
            p.textContent = "No transcript available yet.";
            transcriptChat.appendChild(p);
            transcriptChat.scrollTop = 0;
            return;
        }

        ordered.forEach(item => {
            const bubble = document.createElement("div");
            if (item.kind === "message") {
                bubble.className = `bubble ${item.sender === "ai" ? "ai" : "user"}`;
                bubble.textContent = item.text;
            } else {
                bubble.className = "bubble system";
                bubble.textContent = item.label || "Event recorded.";
            }
            const tsLabel = formatTime(item.timestamp);
            if (tsLabel) {
                const ts = document.createElement("span");
                ts.className = "msg-ts";
                ts.textContent = tsLabel;
                bubble.appendChild(ts);
            }
            transcriptChat.appendChild(bubble);
        });
        transcriptChat.scrollTop = 0;
    };

    const renderFiles = (files = []) => {
        if (!transcriptFiles) return;
        transcriptFiles.innerHTML = "";
        const title = document.createElement("div");
        title.className = "meta";
        title.style.marginBottom = "8px";
        title.textContent = "Files used for this viva:";
        transcriptFiles.appendChild(title);

        if (!files.length) {
            const empty = document.createElement("div");
            empty.className = "meta";
            empty.textContent = "No files recorded for this viva.";
            transcriptFiles.appendChild(empty);
            return;
        }

        files.forEach((file) => {
            const chip = document.createElement("div");
            chip.className = "meta file-chip";

            const name = document.createElement("span");
            name.className = "file-chip-name";
            name.textContent = (file.file_name || "").replace(/^(submissions|assignment_resources)\//, "");
            chip.appendChild(name);

            const preview = document.createElement("a");
            preview.href = "#";
            preview.className = "link file-preview";
            preview.textContent = "Preview text";
            preview.dataset.previewText = file.comment || "";
            preview.addEventListener("click", (e) => {
                e.preventDefault();
                if (previewModal && previewContent) {
                    previewContent.textContent = (preview.dataset.previewText || "").replace(/\\u([\dA-Fa-f]{4})/g, (_, code) =>
                        String.fromCharCode(parseInt(code, 16))
                    );
                    previewModal.classList.add("show");
                }
            });
            chip.appendChild(preview);
            transcriptFiles.appendChild(chip);
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

    const renderFeedback = (feedback = null, sessionId = null) => {
        activeFeedbackSessionId = sessionId || null;
        if (aiFeedbackEl) {
            aiFeedbackEl.textContent = (feedback && feedback.ai_text)
                ? feedback.ai_text
                : "AI feedback will appear once the viva ends.";
        }
        if (teacherFeedbackInput) {
            teacherFeedbackInput.value = feedback?.teacher_text || "";
            teacherFeedbackInput.disabled = !activeFeedbackSessionId;
        }
        if (teacherFeedbackAuthorEl) {
            const author = feedback?.teacher_author || "";
            const hasAuthor = !!(author && author.trim());
            const hasText = !!(feedback?.teacher_text || "").trim();
            if (hasAuthor && hasText) {
                teacherFeedbackAuthorEl.textContent = `By ${author}`;
                teacherFeedbackAuthorEl.classList.remove("is-hidden");
            } else {
                teacherFeedbackAuthorEl.textContent = "";
                teacherFeedbackAuthorEl.classList.add("is-hidden");
            }
        }
        if (teacherFeedbackForm) {
            const saveBtn = teacherFeedbackForm.querySelector("button[type='submit']");
            if (saveBtn) saveBtn.disabled = !activeFeedbackSessionId;
        }
        if (teacherFeedbackStatus) {
            setStatus(teacherFeedbackStatus, "");
        }
    };

    const getAttemptTimestamp = (attempt) => {
        if (!attempt) return 0;
        const raw = attempt.created_at || attempt.started_at || "";
        const date = raw ? new Date(raw) : null;
        if (date && !Number.isNaN(date.getTime())) return date.getTime();
        const sessionId = parseInt(attempt.session_id, 10);
        return Number.isFinite(sessionId) ? sessionId : 0;
    };

    const sortAttempts = (attempts = []) => {
        return [...attempts].sort((a, b) => getAttemptTimestamp(b) - getAttemptTimestamp(a));
    };

    const pickLatestAttemptWithMessages = (attempts = []) => {
        const sorted = sortAttempts(attempts);
        if (!sorted.length) return null;
        const withMessages = sorted.find((attempt) => Array.isArray(attempt.messages) && attempt.messages.length);
        return withMessages || sorted[0];
    };

    const getAttempts = (student) => {
        if (!student) return [];
        if (Array.isArray(student.vivas) && student.vivas.length) return sortAttempts(student.vivas);
        if (student.viva) return sortAttempts([student.viva]);
        return [];
    };

    const populateSelect = () => {
        if (!transcriptSelect) return;
        transcriptSelect.innerHTML = `<option value="" disabled selected>Select a student</option>`;
        students
            .filter(s => getAttempts(s).length)
            .forEach(s => {
                const opt = document.createElement("option");
                opt.value = s.user_id;
                opt.textContent = s.name;
                transcriptSelect.appendChild(opt);
            });
    };

    const populateAttemptSelect = (student) => {
        if (!attemptSelect) return null;
        attemptSelect.innerHTML = `<option value="" disabled selected>Select attempt</option>`;
        const attempts = getAttempts(student);
        if (!attempts.length) {
            attemptSelect.disabled = true;
            return null;
        }
        attemptSelect.disabled = false;
        const total = attempts.length;
        attempts.forEach((attempt, idx) => {
            const opt = document.createElement("option");
            opt.value = attempt.session_id;
            const createdAt = attempt.created_at ? new Date(attempt.created_at) : null;
            const dateLabel = createdAt && !Number.isNaN(createdAt.getTime())
                ? `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, "0")}-${String(createdAt.getDate()).padStart(2, "0")} ${String(createdAt.getHours()).padStart(2, "0")}:${String(createdAt.getMinutes()).padStart(2, "0")}`
                : "";
            const attemptNumber = total - idx;
            opt.textContent = `Attempt ${attemptNumber}` + (dateLabel ? ` · ${dateLabel}` : "");
            attemptSelect.appendChild(opt);
        });
        const defaultAttempt = pickLatestAttemptWithMessages(attempts);
        if (defaultAttempt) attemptSelect.value = defaultAttempt.session_id;
        return defaultAttempt?.session_id || null;
    };

    const renderTranscript = (student, sessionId = null) => {
        if (!student) return;

        const attempts = getAttempts(student);

        if (transcriptSelect && student.user_id) {
            transcriptSelect.value = student.user_id;
        }

        if (!attempts.length) {
            renderMessages([]);
            renderFlags([]);
            renderFeedback(null, null);
            if (transcriptDuration) transcriptDuration.textContent = "Duration: —";
            if (transcriptStatus) transcriptStatus.textContent = "Pending";
            return;
        }

        const defaultAttempt = pickLatestAttemptWithMessages(attempts);
        const targetId = sessionId || defaultAttempt?.session_id;
        const attempt = attempts.find(a => String(a.session_id) === String(targetId)) || defaultAttempt || attempts[0];
        if (attemptSelect) attemptSelect.value = attempt.session_id;

        renderTranscriptTimeline(attempt.messages || [], attempt.events || []);
        renderFlags(attempt.flags || []);
        renderFeedback(attempt.feedback, attempt.session_id);
        renderFiles(attempt.files || []);

        if (transcriptDuration) {
            transcriptDuration.textContent = formatDuration(attempt.duration_seconds);
        }
    };

    const scrollTranscriptTop = () => {
        requestAnimationFrame(() => {
            if (transcriptPane) {
                transcriptPane.scrollIntoView({ behavior: "auto", block: "start" });
            }
            window.scrollTo({ top: 0, behavior: "auto" });
        });
    };

    const findStudent = (userId) => students.find(s => String(s.user_id) === String(userId));

    const statusLabels = {
        completed: "Completed",
        in_progress: "In progress",
        submitted: "Submitted",
        pending: "Viva pending",
        invited: "Invite pending",
    };

    const formatStatusLabel = (status) => {
        if (!status) return "";
        return statusLabels[status] || status.replace(/_/g, " ");
    };

    const formatFlags = (flags) => {
        if (!Array.isArray(flags) || !flags.length) return "";
        return flags.filter(Boolean).join(" | ");
    };

    const formatCsvValue = (value) => {
        if (value === null || value === undefined) return "";
        const text = String(value);
        if (/[",\r\n]/.test(text)) {
            return `"${text.replace(/"/g, "\"\"")}"`;
        }
        return text;
    };

    const getVisibleStudentRows = () => getRowEls().filter(row => row.style.display !== "none");

    const getFilteredStudents = () => {
        return getVisibleStudentRows()
            .map(row => findStudent(row.dataset.studentId))
            .filter(Boolean);
    };

    const buildRosterCsvRows = (studentList) => {
        const rows = [];
        rows.push([
            "Student name",
            "Student email",
            "Student id",
            "Viva status",
            "Invite status",
            "Integrity flags",
            "Attempt number",
            "Attempt id",
            "Attempt status",
            "Attempt created at",
            "Attempt duration seconds",
            "Attempt flags",
        ]);

        studentList.forEach((student) => {
            const base = [
                student?.name || "",
                student?.email || "",
                student?.user_id || "",
                formatStatusLabel(student?.status),
                student?.invite_status || "",
                formatFlags(student?.flags),
            ];
            const attempts = getAttempts(student);
            if (!attempts.length) {
                rows.push([...base, "", "", "", "", "", ""]);
                return;
            }
            const total = attempts.length;
            attempts.forEach((attempt, idx) => {
                rows.push([
                    ...base,
                    String(total - idx),
                    attempt?.session_id || "",
                    formatStatusLabel(attempt?.status),
                    attempt?.created_at || "",
                    attempt?.duration_seconds ?? "",
                    formatFlags(attempt?.flags),
                ]);
            });
        });

        return rows;
    };

    const downloadCsv = (filename, rows) => {
        const csv = rows.map(row => row.map(formatCsvValue).join(",")).join("\r\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    if (exportBtn) {
        exportBtn.addEventListener("click", () => {
            const filteredStudents = getFilteredStudents();
            const slugRaw = data?.assignment?.slug || "assignment";
            const slug = String(slugRaw).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "assignment";
            const date = new Date().toISOString().slice(0, 10);
            const filename = `roster-${slug}-${date}.csv`;
            const rows = buildRosterCsvRows(filteredStudents);
            downloadCsv(filename, rows);
        });
    }

    const attachRowHandlers = () => {
        document.querySelectorAll("[data-view-transcript]").forEach(link => {
            link.addEventListener("click", (e) => {
                e.preventDefault();
                const uid = link.dataset.viewTranscript;
                const student = findStudent(uid);
                if (!student) return;
                activeStudent = student;
                const firstSession = populateAttemptSelect(student);
                renderTranscript(student, firstSession);
                showPane("dashboard");
                if (tablePane) tablePane.classList.remove("active");
                if (transcriptPane) transcriptPane.classList.add("active");
                scrollTranscriptTop();
            });
        });
    };

    backButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
            if (transcriptPane) transcriptPane.classList.remove("active");
            if (tablePane) tablePane.classList.add("active");
        });
    });

    if (previewModal) {
        previewModal.addEventListener("click", (e) => {
            if (e.target === previewModal) previewModal.classList.remove("show");
        });
    }
    if (previewClose) {
        previewClose.addEventListener("click", () => previewModal?.classList.remove("show"));
    }
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") previewModal?.classList.remove("show");
    });

    if (transcriptSelect) {
        transcriptSelect.addEventListener("change", (e) => {
            const student = findStudent(e.target.value);
            if (student) {
                activeStudent = student;
                const firstSession = populateAttemptSelect(student);
                renderTranscript(student, firstSession);
                if (tablePane) tablePane.classList.remove("active");
                if (transcriptPane) transcriptPane.classList.add("active");
                scrollTranscriptTop();
            }
        });
    }

    if (attemptSelect) {
        attemptSelect.addEventListener("change", (e) => {
            if (!activeStudent) return;
            renderTranscript(activeStudent, e.target.value);
        });
    }

    if (filterInput) {
        const opts = () => Array.from(transcriptSelect ? transcriptSelect.querySelectorAll("option") : []);

        filterInput.addEventListener("input", (e) => {
            const term = e.target.value.trim().toLowerCase();

            opts().forEach(opt => {
                if (!opt.value) return;
                const label = opt.textContent.toLowerCase();
                opt.hidden = term && !label.includes(term);
            });

            applyRowFilters();
        });
    }

    if (vivaFilterBtn) {
        vivaFilterBtn.addEventListener("click", () => {
            vivaStateIndex = (vivaStateIndex + 1) % vivaStates.length;
            applyRowFilters();
        });
    }

    if (flagsFilterBtn) {
        flagsFilterBtn.addEventListener("click", () => {
            flagStateIndex = (flagStateIndex + 1) % flagStates.length;
            applyRowFilters();
        });
    }

    applyRowFilters();

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

    const bindInviteResends = () => {
        const resendLinks = document.querySelectorAll("[data-invite-resend]");
        resendLinks.forEach((link) => {
            const originalText = link.textContent.trim() || "Re-send";
            link.addEventListener("click", async (e) => {
                e.preventDefault();
                if (link.dataset.sending === "true") return;
                link.dataset.sending = "true";
                link.textContent = "Sending...";
                link.classList.remove("yes", "no");
                link.classList.add("neutral");

                try {
                    const resp = await fetch(link.href, {
                        method: "GET",
                        headers: { "X-Requested-With": "XMLHttpRequest" },
                        credentials: "same-origin",
                    });
                    if (!resp.ok) {
                        const text = await resp.text();
                        throw new Error(text || "Resend failed");
                    }
                    link.textContent = "Re-sent";
                    link.classList.remove("neutral");
                    link.classList.add("yes");
                    const row = link.closest("[data-student-row]");
                    const statusPill = row?.querySelector("[data-invite-status-pill]");
                    if (statusPill) {
                        statusPill.textContent = "Invite pending";
                        statusPill.classList.remove("no");
                        statusPill.classList.add("neutral");
                    }
                    setTimeout(() => {
                        link.textContent = originalText;
                        link.classList.remove("yes");
                        link.classList.add("neutral");
                        link.dataset.sending = "";
                    }, 60000);
                } catch (err) {
                    link.textContent = "Failed";
                    link.classList.remove("neutral");
                    link.classList.add("no");
                    setTimeout(() => {
                        link.textContent = originalText;
                        link.classList.remove("no");
                        link.classList.add("neutral");
                        link.dataset.sending = "";
                    }, 60000);
                }
            });
        });
    };

    const updateFeedbackReleaseRow = () => {
        if (!feedbackReleaseRow || !feedbackVisibilitySelect) return;
        const show = feedbackVisibilitySelect.value === "after_review";
        feedbackReleaseRow.classList.toggle("is-hidden", !show);
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

        const markDirty = (event) => {
            if (event?.target && event.target.closest("[data-resource-upload]")) {
                return;
            }
            dirty = true;
            if (saveStatus) saveStatus.textContent = "Saving…";
            scheduleSave();
        };

        const runSave = async () => {
            if (!dirty) return;
            const formData = new FormData(settingsForm);
            formData.delete("file");
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

    if (resourceList) {
        getResourceRows().forEach(bindResourceRow);
        recalcResourceTotals();
    }

    if (resourceUploadInput) {
        resourceUploadInput.addEventListener("change", validateResourceSelection);
        validateResourceSelection();
    }

    if (resourceUploadBtn) {
        resourceUploadBtn.addEventListener("click", async () => {
            if (!resourceUploadInput || !resourceUploadUrl) return;
            if (!validateResourceSelection()) return;
            const files = resourceUploadInput.files || [];
            if (!files.length) {
                setResourceHint("Select at least one file to upload.");
                return;
            }
            const formData = new FormData();
            Array.from(files).forEach((file) => formData.append("file", file));
            try {
                const res = await fetch(resourceUploadUrl, {
                    method: "POST",
                    headers: { "Accept": "application/json" },
                    credentials: "same-origin",
                    body: formData,
                });
                const data = await res.json().catch(() => null);
                if (!res.ok || data?.status !== "ok") {
                    const msg = data?.message || "Upload failed";
                    setResourceHint(msg);
                    return;
                }
                (data.resources || []).forEach(appendResourceRow);
                resourceUploadInput.value = "";
                validateResourceSelection();
            } catch (err) {
                console.warn("Upload failed", err);
                setResourceHint("Upload failed. Please try again.");
            }
        });
    }

    if (themeToggle) {
        const root = document.documentElement;
        const applyTheme = (mode) => {
            if (mode === "light") {
                root.setAttribute("data-theme", "light");
                themeToggle.textContent = "☾";
            } else {
                root.setAttribute("data-theme", "dark");
                themeToggle.textContent = "☀";
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

    if (copyButtons.length) {
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
    }

    if (accessModal && accessModalOpen) {
        let lastFocused = null;
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

        const openAccessModal = (e) => {
            e?.preventDefault();
            lastFocused = document.activeElement;
            accessModal.classList.add("open");
            document.addEventListener("keydown", trapFocus);
            const emailField = accessModal.querySelector("#invite-email");
            (emailField || getFocusable()[0] || accessModal).focus();
        };
        const closeAccessModal = (e) => {
            e?.preventDefault();
            accessModal.classList.remove("open");
            document.removeEventListener("keydown", trapFocus);
            if (lastFocused && typeof lastFocused.focus === "function") {
                lastFocused.focus();
            }
        };
        accessModalOpen.addEventListener("click", openAccessModal);
        accessModalClose.forEach(btn => btn.addEventListener("click", closeAccessModal));
        accessModal.addEventListener("click", (e) => {
            if (e.target === accessModal) closeAccessModal(e);
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && accessModal.classList.contains("open")) {
                closeAccessModal(e);
            }
        });
    }

    attachAjaxForm(inviteForm, inviteStatus);
    attachAjaxForm(selfEnrollForm, selfEnrollStatus);
    bindInviteResends();

    if (teacherFeedbackForm && teacherFeedbackInput) {
        teacherFeedbackForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!activeFeedbackSessionId) {
                setStatus(teacherFeedbackStatus, "Select a completed attempt first.", "error");
                return;
            }
            const csrf = getCookie("csrftoken");
            setStatus(teacherFeedbackStatus, "Saving...", "neutral");
            try {
                const res = await fetch(`/viva/feedback/${activeFeedbackSessionId}/`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...(csrf ? { "X-CSRFToken": csrf } : {}),
                    },
                    credentials: "same-origin",
                    body: JSON.stringify({
                        teacher_feedback: teacherFeedbackInput.value || "",
                    }),
                });
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(text || "Save failed");
                }
                const data = await res.json().catch(() => ({}));
                setStatus(teacherFeedbackStatus, "Saved", "success");
                if (teacherFeedbackAuthorEl) {
                    const author = data.teacher_feedback_author || "";
                    const text = data.teacher_feedback || "";
                    if (author && text) {
                        teacherFeedbackAuthorEl.textContent = `By ${author}`;
                        teacherFeedbackAuthorEl.classList.remove("is-hidden");
                    } else {
                        teacherFeedbackAuthorEl.textContent = "";
                        teacherFeedbackAuthorEl.classList.add("is-hidden");
                    }
                }
            } catch (err) {
                setStatus(teacherFeedbackStatus, "Unable to save right now.", "error");
            }
        });
    }

    if (feedbackReleaseBtn) {
        feedbackReleaseBtn.addEventListener("click", async () => {
            const csrf = getCookie("csrftoken");
            setStatus(feedbackReleaseStatus, "Releasing...", "neutral");
            try {
                const res = await fetch("/assignment/feedback/release/", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...(csrf ? { "X-CSRFToken": csrf } : {}),
                    },
                    credentials: "same-origin",
                    body: JSON.stringify({}),
                });
                if (!res.ok) {
                    const text = await res.text();
                    throw new Error(text || "Release failed");
                }
                const data = await res.json().catch(() => ({}));
                setStatus(feedbackReleaseStatus, data.released_at ? `Released on ${data.released_at}` : "Released", "success");
                feedbackReleaseBtn.disabled = true;
            } catch (err) {
                setStatus(feedbackReleaseStatus, "Unable to release right now.", "error");
            }
        });
    }

    if (feedbackVisibilitySelect) {
        feedbackVisibilitySelect.addEventListener("change", updateFeedbackReleaseRow);
        updateFeedbackReleaseRow();
    }

    populateSelect();
    attachRowHandlers();
    startCountdowns();
});

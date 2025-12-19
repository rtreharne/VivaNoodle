document.addEventListener("DOMContentLoaded", () => {
    const themeToggle = document.querySelector("[data-theme-toggle]");
    const root = document.documentElement;

    const applyTheme = (mode) => {
        if (!root) return;
        if (mode === "light") {
            root.setAttribute("data-theme", "light");
            if (themeToggle) themeToggle.textContent = "Dark";
        } else {
            root.setAttribute("data-theme", "dark");
            if (themeToggle) themeToggle.textContent = "Light";
        }
        localStorage.setItem("mv-theme", mode);
    };

    const saved = localStorage.getItem("mv-theme");
    applyTheme(saved === "light" ? "light" : "dark");

    if (themeToggle) {
        themeToggle.addEventListener("click", () => {
            const current = root.getAttribute("data-theme") === "light" ? "light" : "dark";
            applyTheme(current === "light" ? "dark" : "light");
        });
    }

    const modal = document.querySelector("[data-preview-modal]");
    const modalContent = document.querySelector("[data-preview-content]");
    const modalClose = document.querySelector("[data-preview-close]");
    const previewLinks = document.querySelectorAll(".file-preview");

    const closeModal = () => {
        if (modal) modal.classList.remove("show");
    };

    previewLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            let text = link.dataset.previewText || "(No preview available)";
            // Decode common unicode escape sequences (\uXXXX)
            text = text.replace(/\\u([\dA-Fa-f]{4})/g, (_, code) =>
                String.fromCharCode(parseInt(code, 16))
            );
            if (modalContent) {
                modalContent.textContent = text;
            }
            if (modal) modal.classList.add("show");
        });
    });

    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) closeModal();
        });
    }
    if (modalClose) {
        modalClose.addEventListener("click", closeModal);
    }
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeModal();
    });

    const pageEl = document.querySelector(".page");
    const initialVivaStatus = pageEl?.dataset.vivaStatus || "";
    const initialSessionId = pageEl?.dataset.vivaSessionId || null;
    let lastSessionId = initialSessionId;
    const vivaTotalSeconds = parseInt(pageEl?.dataset.vivaDuration || "", 10) || 600;
    let attemptsLeft = parseInt(pageEl?.dataset.attemptsLeft || "", 10);
    attemptsLeft = Number.isFinite(attemptsLeft) ? attemptsLeft : 0;
    let attemptsUsed = parseInt(pageEl?.dataset.attemptsUsed || "", 10);
    attemptsUsed = Number.isFinite(attemptsUsed) ? attemptsUsed : 0;
    const feedbackVisibility = pageEl?.dataset.feedbackVisibility || "immediate";
    const feedbackPlaceholder = "Thanks for finishing the viva. Placeholder feedback: Solid structure, tighten evidence in section 2, and clarify limitations in your conclusion.";
    const historiesScript = document.getElementById("session-histories-data");
    const sessionHistories = historiesScript ? JSON.parse(historiesScript.textContent || "{}") : {};
    const filesScript = document.getElementById("session-files-data");
    const sessionFiles = filesScript ? JSON.parse(filesScript.textContent || "{}") : {};
    const eventTracking = pageEl?.dataset.eventTracking === "true";
    const keystrokeTracking = pageEl?.dataset.keystrokeTracking === "true";
    const arrhythmicTracking = pageEl?.dataset.arrhythmicTyping === "true";
    const summaryCard = document.querySelector("[data-viva-summary-card]");
    const summaryPanel = summaryCard;
    const chatCard = document.querySelector("[data-viva-chat-card]");
    const settingsGrid = document.querySelector(".settings-grid");
    const backBtn = document.querySelector("[data-back-summary]");
    const backDashboardBtn = document.querySelector("[data-back-dashboard]");
    const startVivaBtns = document.querySelectorAll("[data-start-viva]");
    const startVivaBlocks = document.querySelectorAll("[data-start-viva-block]");
    const summaryCta = document.querySelector("[data-summary-cta]");
    const backToVivaBtns = document.querySelectorAll("[data-back-to-viva]");
    const attemptsMeta = document.querySelector("[data-attempts-meta]");
    const layoutToggle = document.querySelector("[data-layout-toggle]");
    const layoutIconColumns = document.querySelector(".layout-columns");
    const layoutIconRows = document.querySelector(".layout-rows");
    const vivaChatWindow = document.querySelector("[data-viva-chat-window]");
    const vivaInput = document.querySelector("[data-viva-input]");
    const vivaSend = document.querySelector("[data-viva-send]");
    const uploadForms = document.querySelectorAll("[data-reupload-form],[data-upload-form]");
    const uploadForm = document.querySelector("[data-upload-form]");
    const uploadInput = uploadForm?.querySelector('input[type="file"]');
    const uploadSubmit = uploadForm?.querySelector('button[type="submit"]');
    const uploadHint = document.querySelector("[data-upload-hint]");
    const vivaInputRow = document.querySelector(".viva-input");
    const navBar = document.querySelector(".nav");
    const submissionList = document.querySelector("[data-submission-list]");
    const initialAiMessage = vivaChatWindow?.dataset.initialAi || "... Before we begin: answer in your own words, keep replies concise, stay focused on your submission. The viva will start as soon as you respond to this message.";
    const vivaFilesBox = document.querySelector("[data-viva-files]");
    let vivaIntroStarted = false;
    let vivaReplyIndex = 0;
    let vivaSessionActive = initialVivaStatus === "in_progress";
    let vivaSessionId = initialSessionId;
    const vivaTimerEl = document.querySelector("[data-viva-timer]");
    const vivaMinutes = parseInt(vivaTimerEl?.dataset.vivaMinutes || "", 10);
    const vivaPresetSeconds = parseInt(vivaTimerEl?.dataset.vivaSeconds || "", 10);
    let vivaTimeRemaining = Number.isFinite(vivaPresetSeconds)
        ? Math.max(0, vivaPresetSeconds)
        : (Number.isFinite(vivaMinutes) ? vivaMinutes * 60 : vivaTotalSeconds);
    let vivaTimerStarted = false;
    let vivaTimerInterval = null;
    let vivaExpired = false;
    let viewingHistory = false;
    let startUrlDefault = summaryCta?.dataset.startUrl || null;
    const pendingInclusions = {};
    const maxFilesTotal = 10;
    const maxTotalBytes = 50 * 1024 * 1024;
    let uploadSizeInvalid = false;
    const unlimitedAttempts = pageEl?.dataset.unlimitedAttempts === "true";
    const hasUnlimitedAttempts = () => unlimitedAttempts || attemptsLeft < 0;
    const logQueue = [];
    let logTimer = null;
    let lastArrhythmicLog = 0;

    const setUploadHint = (msg) => {
        if (!uploadHint) return;
        if (msg) {
            uploadHint.textContent = msg;
            uploadHint.classList.remove("is-hidden");
        } else {
            uploadHint.textContent = "";
            uploadHint.classList.add("is-hidden");
        }
    };

    const shouldLogEvent = (eventType) => {
        if (["blur", "focus", "visibility", "paste", "copy"].includes(eventType)) {
            return eventTracking;
        }
        if (eventType === "arrhythmic_typing") {
            return arrhythmicTracking;
        }
        if (eventType === "typing_cadence") {
            return keystrokeTracking;
        }
        return false;
    };

    const queueLog = (eventType, eventData = {}) => {
        if (!shouldLogEvent(eventType)) return;
        if (!vivaSessionActive || !vivaSessionId) return;
        const payload = {
            event_type: eventType,
            event_data: {
                ...eventData,
                client_ts: new Date().toISOString(),
            },
        };
        if (logQueue.length > 50) logQueue.shift();
        logQueue.push(payload);
        if (!logTimer) {
            logTimer = setTimeout(flushLogs, 800);
        }
    };

    const flushLogs = async (useKeepalive = false) => {
        if (logTimer) {
            clearTimeout(logTimer);
            logTimer = null;
        }
        if (!vivaSessionActive || !vivaSessionId || !logQueue.length) return;
        const batch = logQueue.splice(0, 20);
        try {
            await fetch("/viva/log/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                keepalive: useKeepalive,
                body: JSON.stringify({
                    session_id: vivaSessionId,
                    events: batch,
                }),
            });
        } catch (err) {
            // Re-queue on failure, best-effort
            logQueue.unshift(...batch);
        }
        if (logQueue.length) {
            logTimer = setTimeout(flushLogs, 1000);
        }
    };

    const getSubmissionRows = () => submissionList ? Array.from(submissionList.querySelectorAll("[data-submission-id]")) : [];
    const buildSelectedFiles = () => {
        return getSubmissionRows().reduce((acc, row) => {
            const toggle = row.querySelector("[data-toggle-include]");
            if (!toggle?.checked) return acc;
            acc.push({
                file_name: row.dataset.fileName || row.querySelector(".file-name")?.textContent?.trim() || "Uploaded file",
                comment: row.dataset.comment || "",
            });
            return acc;
        }, []);
    };
    const formatAttemptDate = (iso) => {
        if (!iso) return "";
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        const hh = String(d.getHours()).padStart(2, "0");
        const min = String(d.getMinutes()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
    };
    const ensureAttemptTable = () => {
        let table = summaryCard?.querySelector(".attempt-table");
        if (table) return table;
        const column = summaryCard?.querySelector(".settings-row.split > div");
        if (!column) return null;
        const wrapper = document.createElement("div");
        wrapper.className = "viva-action";
        wrapper.style.marginTop = "8px";
        const label = document.createElement("label");
        label.className = "meta";
        label.style.display = "block";
        label.style.marginBottom = "6px";
        label.textContent = "Previous viva attempts";
        table = document.createElement("div");
        table.className = "attempt-table";
        wrapper.appendChild(label);
        wrapper.appendChild(table);
        column.appendChild(wrapper);
        return table;
    };
    const refreshAttemptLabels = () => {
        const table = ensureAttemptTable();
        if (!table) return;
        const rows = Array.from(table.querySelectorAll("[data-attempt-row]"));
        const total = rows.length;
        rows.forEach((row, idx) => {
            const label = row.querySelector(".meta");
            const stamp = formatAttemptDate(row.dataset.startedAt || "");
            const number = total - idx;
            if (label) {
                label.textContent = `Attempt ${number}` + (stamp ? ` · ${stamp}` : "");
            }
        });
    };
    const bindViewAttempt = (link) => {
        if (!link || link.dataset.bound) return;
        link.dataset.bound = "true";
        link.addEventListener("click", (e) => {
            e.preventDefault();
            const sessionId = link.dataset.viewSession;
            if (sessionId) showHistory(sessionId);
        });
    };
    const appendAttemptRow = (sessionId, startedAt) => {
        const table = ensureAttemptTable();
        if (!table || !sessionId) return;
        if (table.querySelector(`[data-view-session="${sessionId}"]`)) return;
        const row = document.createElement("div");
        row.className = "attempt-row";
        row.dataset.attemptRow = "true";
        row.dataset.startedAt = startedAt || new Date().toISOString();
        const label = document.createElement("span");
        label.className = "meta";
        const actions = document.createElement("span");
        actions.className = "attempt-actions";
        const link = document.createElement("a");
        link.className = "link view-attempt";
        link.href = "#";
        link.dataset.viewSession = sessionId;
        link.textContent = "View";
        actions.appendChild(link);
        row.appendChild(label);
        row.appendChild(actions);
        table.prepend(row);
        bindViewAttempt(link);
        refreshAttemptLabels();
    };
    const captureChatHistory = () => {
        if (!vivaChatWindow) return [];
        return Array.from(vivaChatWindow.querySelectorAll(".bubble"))
            .filter((bubble) => !bubble.classList.contains("thinking") && !bubble.classList.contains("rating-bubble"))
            .map((bubble) => {
                const isAi = bubble.classList.contains("ai");
                return { sender: isAi ? "ai" : "student", text: bubble.textContent || "" };
            });
    };
    const renderSessionFiles = (sessionId, allowFallback = false) => {
        if (!vivaFilesBox) return;
        let files = sessionFiles[String(sessionId)] || [];
        if (!files.length && allowFallback) {
            files = buildSelectedFiles();
        }
        vivaFilesBox.innerHTML = "";
        const title = document.createElement("div");
        title.className = "meta";
        title.style.marginBottom = "6px";
        title.textContent = "Files used for this viva:";
        vivaFilesBox.appendChild(title);

        if (!files.length) {
            const none = document.createElement("div");
            none.className = "meta";
            none.textContent = "No files recorded for this viva.";
            vivaFilesBox.appendChild(none);
            vivaFilesBox.classList.remove("is-hidden");
            return;
        }

        files.forEach((f) => {
            const chip = document.createElement("div");
            chip.className = "meta file-chip";
            const name = document.createElement("span");
            name.className = "file-chip-name";
            name.textContent = (f.file_name || "").replace(/^submissions\//, "");
            chip.appendChild(name);

            const preview = document.createElement("a");
            preview.href = "#";
            preview.className = "link file-preview";
            preview.textContent = "Preview text";
            preview.dataset.previewText = f.comment || "";
            preview.addEventListener("click", (e) => {
                e.preventDefault();
                if (modalContent && modal) {
                    modalContent.textContent = (preview.dataset.previewText || "").replace(/\\u([\dA-Fa-f]{4})/g, (_, code) =>
                        String.fromCharCode(parseInt(code, 16))
                    );
                    modal.classList.add("show");
                }
            });
            chip.appendChild(preview);
            vivaFilesBox.appendChild(chip);
        });

        vivaFilesBox.classList.remove("is-hidden");
    };
    const collectSelectedSubmissionIds = () => {
        const ids = [];
        getSubmissionRows().forEach((row) => {
            const toggle = row.querySelector("[data-toggle-include]");
            const id = parseInt(row.dataset.submissionId, 10);
            if (toggle?.checked && Number.isFinite(id)) ids.push(id);
        });
        return ids;
    };
    const getRowSize = (row) => {
        const size = parseInt(row.dataset.fileSize || "0", 10);
        return Number.isFinite(size) ? size : 0;
    };

    const recalcSubmissionTotals = () => {
        const rows = getSubmissionRows();
        const count = rows.length;
        const size = rows.reduce((acc, row) => acc + getRowSize(row), 0);
        if (uploadForm) {
            uploadForm.dataset.existingCount = String(count);
            uploadForm.dataset.existingSize = String(size);
        }
        return { count, size };
    };

    const syncInclusionState = (payload = []) => {
        payload.forEach((entry) => {
            const sid = parseInt(entry.submission_id ?? entry.submissionId, 10);
            if (!Number.isFinite(sid)) return;
            const included = !!entry.included;
            pendingInclusions[sid] = included;
            const row = submissionList?.querySelector(`[data-submission-id="${sid}"]`);
            const toggle = row?.querySelector("[data-toggle-include]");
            if (toggle) toggle.checked = included;
            if (row) row.dataset.included = included ? "1" : "0";
        });
    };

    const updateStartUrlFromList = () => {
        const firstRow = getSubmissionRows()[0];
        if (!firstRow) {
            if (summaryCta) summaryCta.classList.add("is-hidden");
            return;
        }
        const newUrl = firstRow.dataset.startUrl;
        if (newUrl) {
            startUrlDefault = newUrl;
            if (summaryCta) summaryCta.dataset.startUrl = newUrl;
            startVivaBtns.forEach((btn) => {
                btn.dataset.startUrl = newUrl;
            });
        }
        if (summaryCta) summaryCta.classList.remove("is-hidden");
    };

    recalcSubmissionTotals();
    getSubmissionRows().forEach((row) => {
        const id = parseInt(row.dataset.submissionId, 10);
        if (!Number.isFinite(id)) return;
        const toggle = row.querySelector("[data-toggle-include]");
        pendingInclusions[id] = toggle ? toggle.checked : true;
    });

    const resetVivaForNewAttempt = () => {
        vivaExpired = false;
        vivaSessionId = null;
        vivaSessionActive = true;
        vivaTimeRemaining = vivaTotalSeconds;
        vivaIntroStarted = false;
        vivaReplyIndex = 0;
        viewingHistory = false;
        clearInterval(vivaTimerInterval);
        vivaTimerInterval = null;
        vivaTimerStarted = false;
        updateVivaTimerDisplay();
        vivaTimerEl?.classList.add("is-hidden");
        navBar?.classList.remove("viva-active");
        setVivaInputDisabled(true);
        clearVivaChat();
        if (vivaSend) {
            vivaSend.textContent = "Send";
            vivaSend.disabled = true;
            vivaSend.classList.remove("submit-mode");
        }
        vivaInputRow?.classList.remove("is-hidden");
        vivaInput.value = "";
    };

    const formatTime = (seconds) => {
        const m = String(Math.floor(seconds / 60)).padStart(2, "0");
        const s = String(seconds % 60).padStart(2, "0");
        return `${m}:${s}`;
    };

    const updateVivaTimerDisplay = () => {
        if (!vivaTimerEl) return;
        vivaTimerEl.textContent = formatTime(Math.max(0, vivaTimeRemaining));
    };

    const startVivaTimer = () => {
        if (!vivaTimerEl || vivaTimerStarted) return;
        vivaTimerStarted = true;
        vivaTimerEl.classList.remove("throb");
        vivaTimerEl.classList.remove("is-hidden");
        navBar?.classList.add("viva-active");
        updateVivaTimerDisplay();
        vivaTimerInterval = setInterval(() => {
            if (vivaTimeRemaining <= 0) {
                clearInterval(vivaTimerInterval);
                vivaTimerEl.classList.add("throb");
                navBar?.classList.remove("viva-active");
                enterSubmitMode();
                return;
            }
            vivaTimeRemaining -= 1;
            updateVivaTimerDisplay();
        }, 1000);
    };
    updateVivaTimerDisplay();

    const scrollVivaChat = () => {
        if (!vivaChatWindow) return;
        vivaChatWindow.scrollTop = vivaChatWindow.scrollHeight;
    };

    const setVivaInputDisabled = (disabled) => {
        if (vivaInput) {
            vivaInput.disabled = disabled;
            vivaInput.parentElement?.classList.toggle("disabled", disabled);
        }
        if (vivaSend) {
            vivaSend.disabled = disabled;
        }
    };

    const addVivaBubble = (sender, text) => {
        if (!vivaChatWindow) return;
        const bubble = document.createElement("div");
        bubble.className = `bubble ${sender}`;
        bubble.textContent = text;
        vivaChatWindow.appendChild(bubble);
        scrollVivaChat();
    };

    const showVivaThinking = () => {
        if (!vivaChatWindow) return null;
        const bubble = document.createElement("div");
        bubble.className = "bubble ai thinking";
        bubble.innerHTML = `<span class="dots"><span></span><span></span><span></span></span>`;
        vivaChatWindow.appendChild(bubble);
        scrollVivaChat();
        return bubble;
    };

    const addRatingBar = () => {
        if (!vivaChatWindow) return;
        const bubble = document.createElement("div");
        bubble.className = "bubble ai rating-bubble";
        bubble.innerHTML = `
            <div class="rating-title">Rate this viva experience:</div>
            <div class="rating-scale" role="group" aria-label="Rate viva experience">
                <button type="button" class="rating-btn" aria-label="Very unhappy" data-rating="1">😞</button>
                <button type="button" class="rating-btn" aria-label="Unhappy" data-rating="2">🙁</button>
                <button type="button" class="rating-btn" aria-label="Neutral" data-rating="3">😐</button>
                <button type="button" class="rating-btn" aria-label="Happy" data-rating="4">🙂</button>
                <button type="button" class="rating-btn" aria-label="Very happy" data-rating="5">😊</button>
            </div>
        `;
        vivaChatWindow.appendChild(bubble);
        bubble.querySelectorAll("[data-rating]").forEach((el) => {
            el.addEventListener("click", (e) => {
                e.preventDefault();
                const val = parseInt(el.dataset.rating, 10);
                if (!Number.isNaN(val)) handleRatingClick(val);
            });
        });
        scrollVivaChat();
    };

    const clearVivaChat = () => {
        if (!vivaChatWindow) return;
        vivaChatWindow.innerHTML = "";
    };

    const playVivaIntro = () => {
        if (vivaIntroStarted || !vivaChatWindow) return;
        vivaIntroStarted = true;
        vivaChatWindow.innerHTML = "";
        setVivaInputDisabled(true);
        const thinking = showVivaThinking();
        const delay = 900 + Math.random() * 900;
        setTimeout(() => {
            thinking?.remove();
            addVivaBubble("ai", initialAiMessage);
            setVivaInputDisabled(false);
            vivaInput?.focus();
        }, delay);
    };

    const openSubmissionPreview = () => {
        const firstPreview = document.querySelector(".file-preview");
        if (firstPreview) {
            firstPreview.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
        } else if (modal) {
            modal.classList.add("show");
        }
    };

    const updateVivaControls = () => {
        const hasSubmissions = getSubmissionRows().length > 0;
        const includedCount = collectSelectedSubmissionIds().length;
        startVivaBlocks.forEach((block) => {
            block.classList.toggle("is-hidden", true);
        });
        startVivaBtns.forEach((btn) => {
            btn.disabled = vivaSessionActive || (!vivaSessionActive && (includedCount === 0 || (!hasUnlimitedAttempts() && attemptsLeft <= 0) || !hasSubmissions));
        });
        backToVivaBtns.forEach((btn) => {
            btn.classList.toggle("is-hidden", !vivaSessionActive);
        });
        if (backDashboardBtn) {
            backDashboardBtn.classList.toggle("is-hidden", vivaSessionActive);
            backDashboardBtn.disabled = vivaSessionActive;
        }
        if (summaryCta) {
            summaryCta.dataset.action = vivaSessionActive ? "resume" : "start";
            summaryCta.textContent = vivaSessionActive ? "Return to viva" : "Start Viva";
            summaryCta.classList.toggle("is-hidden", (!vivaSessionActive && !hasUnlimitedAttempts() && attemptsLeft <= 0) || !hasSubmissions);
            summaryCta.disabled = (!vivaSessionActive && (includedCount === 0 || (!hasUnlimitedAttempts() && attemptsLeft <= 0) || !hasSubmissions));
        }
        if (attemptsMeta) {
            if (hasUnlimitedAttempts()) {
                attemptsMeta.textContent = "Unlimited viva attempts";
            } else if (attemptsLeft > 0) {
                attemptsMeta.textContent = `${attemptsLeft} viva attempt${attemptsLeft !== 1 ? "s" : ""} left`;
            } else {
                attemptsMeta.textContent = "No viva attempts remaining";
            }
        }
        uploadForms.forEach((form) => {
            form.classList.toggle("is-hidden", (!hasUnlimitedAttempts() && attemptsLeft <= 0));
        });
        const sizeOk = validateUploadSelection();
        if (!uploadSizeInvalid) {
            setUploadHint(includedCount === 0 && hasSubmissions ? "Select at least one file to start a viva." : "");
        }
    };

    const firstSimulatedQuestion = "Thanks for responding. Let's start: in two sentences, what is the main argument of your submission and why did you choose this approach?";
    const placeholderReplies = [
        "What evidence best backs that choice, and what would you strengthen first?",
        "Where did you consider an alternative approach, and why did you reject it?",
        "Name one limitation in your work and how you'd address it next."
    ];

    const sendToServer = async (payload, endpoint = "/viva/send/") => {
        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "same-origin",
                body: JSON.stringify(payload),
            });
            return await res.json();
        } catch (err) {
            console.warn("Failed to send viva message", err);
            return null;
        }
    };

    const ensureSession = async (startUrl) => {
        if (vivaSessionId) return vivaSessionId;
        if (!startUrl) return null;
        const selectedIds = collectSelectedSubmissionIds();
        if (!selectedIds.length) {
            setUploadHint("Select at least one file to start a viva.");
            return null;
        }
        const bodyPayload = { included_submission_ids: selectedIds };
        try {
            const res = await fetch(startUrl, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                },
                credentials: "same-origin",
                body: JSON.stringify(bodyPayload),
            });
            const data = await res.json();
            if (data.session_id) {
                vivaSessionId = data.session_id;
                lastSessionId = vivaSessionId;
                if (typeof data.attempts_left === "number") attemptsLeft = data.attempts_left;
                if (typeof data.attempts_used === "number") attemptsUsed = data.attempts_used;
                if (Array.isArray(data.included_submissions)) {
                    syncInclusionState(data.included_submissions);
                }
                updateVivaControls();
            }
        } catch (err) {
            console.warn("Failed to start viva session", err);
        }
        return vivaSessionId;
    };

    const logMessage = (sender, text, extra = {}) => {
        if (!vivaSessionId || !text) return;
        sendToServer({
            session_id: vivaSessionId,
            sender,
            text,
            ...extra,
        });
    };

    const toggleSubmissionInclude = (submissionId, included) => {
        const targetSession = vivaSessionId || lastSessionId;
        if (!targetSession) return;
        sendToServer({
            session_id: targetSession,
            submission_id: submissionId,
            included,
        }, "/viva/toggle_submission/");
    };

    const deleteSubmission = async (row, submissionId) => {
        try {
            const res = await fetch(`/submission/${submissionId}/delete/`, {
                method: "POST",
                headers: { "Accept": "application/json" },
                credentials: "same-origin",
            });
            if (!res.ok) {
                const text = await res.text();
                throw new Error(text || "Unable to delete submission");
            }
            row?.remove();
            delete pendingInclusions[submissionId];
            recalcSubmissionTotals();
            updateStartUrlFromList();
            updateVivaControls();
            validateUploadSelection();
        } catch (err) {
            console.warn("Delete failed", err);
            alert("Cannot delete this file because it is linked to a viva attempt.");
        }
    };

    const endSession = async (finalText = "", feedbackText = null) => {
        await ensureSession(startUrlDefault);
        const duration = Math.max(0, vivaTotalSeconds - vivaTimeRemaining);
        const closingSessionId = vivaSessionId || lastSessionId;
        if (!closingSessionId) return;
        sendToServer({
            session_id: closingSessionId,
            sender: "student",
            text: finalText || undefined,
            ended: true,
            duration_seconds: duration,
            feedback_text: feedbackText || undefined,
        });
        clearInterval(vivaTimerInterval);
        vivaTimerInterval = null;
        vivaTimerStarted = false;
        vivaTimerEl?.classList.add("is-hidden");
        navBar?.classList.remove("viva-active");
        lastSessionId = closingSessionId;
        vivaSessionId = null;
        if (!vivaExpired && attemptsLeft > 0) {
            // Completed a run; allow another attempt
            updateVivaControls();
        }
        return closingSessionId;
    };

    const respondPlaceholder = () => {
        const thinking = showVivaThinking();
        setVivaInputDisabled(true);
        const delay = 1100 + Math.random() * 700;
        setTimeout(() => {
            thinking?.remove();
            const reply = vivaReplyIndex === 0
                ? firstSimulatedQuestion
                : placeholderReplies[(vivaReplyIndex - 1) % placeholderReplies.length];
            vivaReplyIndex += 1;
            addVivaBubble("ai", reply);
            logMessage("ai", reply);
            if (!vivaTimerStarted) startVivaTimer();
            setVivaInputDisabled(false);
            vivaInput?.focus();
        }, delay);
    };

    const enterSubmitMode = () => {
        vivaExpired = true;
        setVivaInputDisabled(false);
        if (vivaSend) {
            vivaSend.disabled = false;
            vivaSend.textContent = "Submit";
            vivaSend.classList.add("submit-mode");
        }
    };

    const handleVivaSend = async () => {
        if (!vivaInput || !vivaSend) return;
        if (vivaInput.disabled && !vivaExpired) return;
        const text = (vivaInput.value || "").trim();
        if (vivaExpired) {
            if (text) {
                addVivaBubble("user", text);
            }
            const feedbackText = feedbackVisibility === "immediate" ? feedbackPlaceholder : null;
            const sessionId = await endSession(text, feedbackText);
            if (sessionId) {
                const historySnapshot = captureChatHistory();
                if (feedbackVisibility === "immediate") {
                    historySnapshot.push({ sender: "ai", text: feedbackPlaceholder });
                }
                sessionHistories[String(sessionId)] = historySnapshot;
                sessionFiles[String(sessionId)] = buildSelectedFiles();
                appendAttemptRow(String(sessionId));
            }
            vivaInput.value = "";
            vivaSend.textContent = "Submitted";
            vivaSend.disabled = true;
            vivaSend.classList.remove("submit-mode");
            vivaSessionActive = false;
            setVivaInputDisabled(true);
            if (feedbackVisibility === "immediate") {
                clearVivaChat();
                const thinking = showVivaThinking();
                setTimeout(() => {
                    thinking?.remove();
                    addVivaBubble("ai", feedbackPlaceholder);
                    addRatingBar();
                }, 900);
            } else {
                showSummary();
            }
            updateVivaControls();
            return;
        }
        if (!text) return;
        await ensureSession(startUrlDefault);
        addVivaBubble("user", text);
        logMessage("student", text);
        vivaInput.value = "";
        respondPlaceholder();
    };

    const handleRatingClick = (value) => {
        const targetSession = vivaSessionId || lastSessionId;
        if (!targetSession) return;
        sendToServer({
            session_id: targetSession,
            rating: value,
        });
        vivaSessionActive = false;
        showSummary();
        updateVivaControls();
    };

    const showHistory = (sessionId) => {
        const history = sessionHistories[String(sessionId)] || [];
        viewingHistory = true;
        vivaSessionActive = false;
        clearVivaChat();
        history.forEach((m) => {
            const sender = (m.sender || "").toLowerCase() === "ai" ? "ai" : "user";
            addVivaBubble(sender, m.text || "");
        });
        renderSessionFiles(sessionId);
        vivaInputRow?.classList.add("is-hidden");
        setVivaInputDisabled(true);
        navBar?.classList.remove("viva-active");
        vivaTimerEl?.classList.add("is-hidden");
        showChat(false);
        updateVivaControls();
    };

    const showActiveSession = () => {
        const activeId = vivaSessionId || lastSessionId || initialSessionId;
        if (!activeId) return;
        vivaSessionId = activeId;
        lastSessionId = activeId;
        if (vivaTimerEl) {
            const dsRem = parseInt(vivaTimerEl.dataset.vivaSeconds || "", 10);
            if (Number.isFinite(dsRem)) vivaTimeRemaining = Math.max(0, dsRem);
        }
        const history = sessionHistories[String(activeId)] || [];
        viewingHistory = false;
        vivaSessionActive = true;
        clearVivaChat();
        if (history.length === 0) {
            vivaIntroStarted = false;
            playVivaIntro();
        } else {
            vivaIntroStarted = true; // prevent intro reset
            history.forEach((m) => {
                const sender = (m.sender || "").toLowerCase() === "ai" ? "ai" : "user";
                addVivaBubble(sender, m.text || "");
            });
        }
        renderSessionFiles(activeId, true);
        setVivaInputDisabled(false);
        vivaInputRow?.classList.remove("is-hidden");
        navBar?.classList.add("viva-active");
        if (vivaTimeRemaining <= 0) {
            enterSubmitMode();
        } else {
            startVivaTimer();
        }
        showChat(false);
        updateVivaControls();
    };

    vivaSend?.addEventListener("click", handleVivaSend);
    vivaInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleVivaSend();
        }
    });
    vivaInput?.addEventListener("paste", (e) => {
        if (!eventTracking) return;
        const text = e.clipboardData?.getData("text") || "";
        queueLog("paste", { length: text.length });
    });
    if (vivaInput && arrhythmicTracking) {
        let lastKeyTs = null;
        const intervals = [];
        vivaInput.addEventListener("keydown", () => {
            if (!vivaSessionActive || !vivaSessionId) return;
            const now = Date.now();
            if (lastKeyTs) {
                const interval = now - lastKeyTs;
                intervals.push(interval);
                if (intervals.length > 8) intervals.shift();
                if (intervals.length >= 6) {
                    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                    const spike = interval > avg * 3 && interval > 1200;
                    const rush = interval < avg / 3 && avg > 120;
                    if ((spike || rush) && now - lastArrhythmicLog > 15000) {
                        lastArrhythmicLog = now;
                        queueLog("arrhythmic_typing", {
                            interval_ms: Math.round(interval),
                            avg_ms: Math.round(avg),
                        });
                    }
                }
            }
            lastKeyTs = now;
        });
    }

    const showChat = (scroll = false) => {
        if (!summaryCard || !chatCard) return;
        summaryCard.classList.add("is-hidden");
        chatCard.classList.remove("is-hidden");
        if (!viewingHistory && !vivaIntroStarted) {
            vivaInputRow?.classList.remove("is-hidden");
            playVivaIntro();
        }
        renderSessionFiles(vivaSessionId || lastSessionId || initialSessionId, true);
        if (scroll) chatCard.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const showSummary = () => {
        if (!summaryCard || !chatCard) return;
        chatCard.classList.add("is-hidden");
        summaryCard.classList.remove("is-hidden");
        viewingHistory = false;
        vivaInputRow?.classList.remove("is-hidden");
        vivaIntroStarted = false;
    };

    const applyLayout = (mode) => {
        if (!settingsGrid) return;
        const single = mode === "single";
        settingsGrid.classList.toggle("single-column", single);
        // Swap icons to reflect what the button will do next
        layoutIconColumns?.classList.toggle("is-hidden", !single);
        layoutIconRows?.classList.toggle("is-hidden", single);
        layoutToggle?.setAttribute("aria-pressed", single ? "true" : "false");
        localStorage.setItem("mv-layout", single ? "single" : "grid");
    };

    const savedLayout = localStorage.getItem("mv-layout");
    applyLayout(savedLayout === "single" ? "single" : "grid");

    if (layoutToggle) {
        layoutToggle.addEventListener("click", () => {
            const currentSingle = settingsGrid?.classList.contains("single-column");
            applyLayout(currentSingle ? "grid" : "single");
        });
    }

    startVivaBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            if (!hasUnlimitedAttempts() && attemptsLeft <= 0) return;
            if (!validateUploadSelection()) return;
            if (!collectSelectedSubmissionIds().length) {
                setUploadHint("Select at least one file to start a viva.");
                return;
            }
            resetVivaForNewAttempt();
            updateVivaControls();
            showChat(false);
        });
    });

    backToVivaBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            vivaSessionActive = true;
            if (vivaSessionId || lastSessionId) {
                showActiveSession();
            } else {
                updateVivaControls();
                showChat(false);
            }
        });
    });

    if (vivaSessionActive && (vivaSessionId || lastSessionId)) {
        showActiveSession();
    } else if (chatCard && !chatCard.classList.contains("is-hidden")) {
        playVivaIntro();
    } else {
        updateVivaControls();
    }

    if (backBtn) {
        backBtn.addEventListener("click", () => {
            openSubmissionPreview();
        });
    }
    if (backDashboardBtn) {
        backDashboardBtn.addEventListener("click", () => {
            showSummary();
            summaryCard?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }

    if (summaryCta) {
        summaryCta.addEventListener("click", (e) => {
            const action = summaryCta.dataset.action;
            if (action === "preview") {
                openSubmissionPreview();
            } else if (action === "start") {
                if (!hasUnlimitedAttempts() && attemptsLeft <= 0) return;
                if (!validateUploadSelection()) return;
                if (!collectSelectedSubmissionIds().length) {
                    setUploadHint("Select at least one file to start a viva.");
                    return;
                }
                resetVivaForNewAttempt();
                updateVivaControls();
                showChat(false);
            } else if (action === "resume") {
                showActiveSession();
            }
        });
    }

    getSubmissionRows().forEach((row) => {
        const toggle = row.querySelector("[data-toggle-include]");
        const deleteBtn = row.querySelector("[data-delete-submission]");
        const submissionId = parseInt(row.dataset.submissionId, 10);
        if (toggle) {
            toggle.addEventListener("change", () => {
                const included = !!toggle.checked;
                pendingInclusions[submissionId] = included;
                toggleSubmissionInclude(submissionId, included);
                updateVivaControls();
            });
        }
        if (deleteBtn && Number.isFinite(submissionId)) {
            deleteBtn.addEventListener("click", (e) => {
                e.preventDefault();
                deleteSubmission(row, submissionId);
            });
        }
    });
    updateStartUrlFromList();

    document.querySelectorAll(".view-attempt").forEach(bindViewAttempt);

    function validateUploadSelection() {
        if (!uploadForm || !uploadInput) return true;
        const existingCount = parseInt(uploadForm.dataset.existingCount || "0", 10) || 0;
        const existingSize = parseInt(uploadForm.dataset.existingSize || "0", 10) || 0;
        const files = uploadInput.files || [];
        let selectedSize = 0;
        Array.from(files).forEach((f) => {
            selectedSize += f?.size || 0;
        });
        const totalCount = existingCount + files.length;
        const totalSize = existingSize + selectedSize;
        const overCount = totalCount > maxFilesTotal;
        const overSize = totalSize > maxTotalBytes;
        uploadSizeInvalid = overCount || overSize;
        if (uploadSubmit) {
            uploadSubmit.disabled = uploadSizeInvalid;
        }
        if (uploadSizeInvalid) {
            const parts = [];
            if (overCount) parts.push(`You can upload up to ${maxFilesTotal} files in total.`);
            if (overSize) parts.push("Combined size limit is 50MB.");
            setUploadHint(parts.join(" "));
        }
        return !uploadSizeInvalid;
    }

    if (uploadInput) {
        uploadInput.addEventListener("change", validateUploadSelection);
    }
    if (uploadForm) {
        uploadForm.addEventListener("submit", (e) => {
            if (!validateUploadSelection()) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
        validateUploadSelection();
    }

    if (eventTracking) {
        window.addEventListener("blur", () => queueLog("blur"));
        window.addEventListener("focus", () => queueLog("focus"));
        document.addEventListener("visibilitychange", () => {
            queueLog("visibility", { state: document.visibilityState });
        });
        const isWithinAiBubble = (node) => {
            if (!node) return false;
            const el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
            if (!el) return false;
            return !!el.closest(".bubble.ai");
        };
        document.addEventListener("copy", () => {
            const selection = window.getSelection?.();
            const text = selection?.toString() || "";
            if (!text) return;
            const anchor = selection?.anchorNode;
            const focus = selection?.focusNode;
            if (!isWithinAiBubble(anchor) && !isWithinAiBubble(focus)) return;
            queueLog("copy", { length: text.length, source: "ai" });
        });
    }
    window.addEventListener("beforeunload", () => {
        flushLogs(true);
    });

    startCountdowns();
});

const startCountdowns = () => {
    document.querySelectorAll("[data-remaining]").forEach(el => {
        let secs = parseInt(el.dataset.remaining, 10);
        const tick = () => {
            if (isNaN(secs)) return;
            const m = Math.floor(secs / 60).toString().padStart(2, "0");
            const s = (secs % 60).toString().padStart(2, "0");
            el.textContent = `${m}:${s}`;
            secs = Math.max(0, secs - 1);
        };
        tick();
        setInterval(tick, 1000);
    });
};

// ---------------------------------------------------------------------
// VivaNoodle – Viva Session Frontend Logic (external JS)
// ---------------------------------------------------------------------

let sessionId;
let sendUrl;
let pollUrl;

let vivaStarted = false;
let shownMessages = 0;
let typingBubble = null;
let typingStart = null;

const MIN_TYPING_TIME = 3000; // 3 seconds

// ---------------------------------------------------------------------
// INITIALISATION (filled by template via inline initialisation call)
// ---------------------------------------------------------------------

window.initViva = function(config) {
    sessionId = config.sessionId;
    sendUrl = config.sendUrl;
    pollUrl = config.pollUrl;

    // Bind Start button
    document.getElementById("startVivaBtn")
        .addEventListener("click", startViva);

    // Bind send logic
    document.getElementById("sendBtn")
        .addEventListener("click", sendMessage);

    document.getElementById("messageInput")
        .addEventListener("keypress", e => {
            if (e.key === "Enter") sendMessage();
        });

    attachBehaviourLogging();
    attachArrhythmicTypingDetection();
}



// ---------------------------------------------------------------------
// START
// ---------------------------------------------------------------------
function startViva() {
    vivaStarted = true;
    document.getElementById("vivaIntro").style.display = "none";

    startPolling();
    startTimer();

    // Show typing bubble immediately for first AI question
    showTypingBubble();

    // Ask backend to generate first question
    fetch(sendUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCookie("csrftoken")
        },
        body: JSON.stringify({
            session_id: sessionId,
            text: "__start__"
        })
    });
}



// ---------------------------------------------------------------------
// BEHAVIOUR LOGGING (ALWAYS ON)
// ---------------------------------------------------------------------
function logEvent(eventType, extra = {}) {
    fetch("/viva/log/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCookie('csrftoken')
        },
        body: JSON.stringify({
            session_id: sessionId,
            event_type: eventType,
            event_data: extra
        })
    });
}

function attachBehaviourLogging() {
    document.addEventListener("copy", () => logEvent("copy"));
    document.addEventListener("cut", () => logEvent("cut"));
    document.addEventListener("paste", e => {
        logEvent("paste", {
            text: (e.clipboardData?.getData("text") || "").slice(0, 200)
        });
    });

    window.addEventListener("blur", () => logEvent("blur"));
    window.addEventListener("focus", () => logEvent("focus"));

    document.addEventListener("keydown", e => {
        logEvent("keypress", {
            key: e.key,
            code: e.code,
            ts: Date.now()
        });
    });
}



// ---------------------------------------------------------------------
// ARRHYTHMIC TYPING DETECTION (ALWAYS ON)
// ---------------------------------------------------------------------
function attachArrhythmicTypingDetection() {
    let lastKeyTime = null;
    let anomalyCount = 0;

    document.addEventListener("keydown", () => {
        const now = performance.now();

        if (lastKeyTime !== null) {
            const delta = now - lastKeyTime;

            if (delta < 40 || delta > 800) {
                anomalyCount++;
                if (anomalyCount % 5 === 0) {
                    logEvent("arrhythmic_typing", {
                        interval: delta.toFixed(1),
                        anomalies: anomalyCount
                    });
                }
            }
        }

        lastKeyTime = now;
    });
}



// ---------------------------------------------------------------------
// SEND MESSAGE
// ---------------------------------------------------------------------
function sendMessage() {
    if (!vivaStarted) return;

    const input = document.getElementById("messageInput");
    const text = input.value.trim();
    if (!text) return;

    input.value = "";

    addMessage("student", text);

    showTypingBubble();

    fetch(sendUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCookie("csrftoken")
        },
        body: JSON.stringify({
            session_id: sessionId,
            text: text
        })
    });
}



// ---------------------------------------------------------------------
// POLLING (AI responses)
// ---------------------------------------------------------------------
function startPolling() {
    setInterval(() => {
        if (!vivaStarted) return;

        fetch(pollUrl)
            .then(r => r.json())
            .then(data => {
                if (!data.messages) return;

                const msgs = data.messages;
                const newMessages = msgs.slice(shownMessages);

                newMessages.forEach(msg => {
                    if (msg.sender === "student" && msg.text === "__start__") return;

                    if (msg.sender === "student") return;

                    if (msg.sender === "ai") {
                        if (!typingBubble) showTypingBubble();

                        const elapsed = Date.now() - (typingStart || Date.now());
                        const wait = Math.max(0, MIN_TYPING_TIME - elapsed);

                        setTimeout(() => {
                            if (typingBubble) {
                                typingBubble.remove();
                                typingBubble = null;
                            }
                            addMessage("ai", msg.text);
                        }, wait);
                    }
                });

                shownMessages = msgs.length;
            });
    }, 800);
}



// ---------------------------------------------------------------------
// MESSAGE BUBBLES
// ---------------------------------------------------------------------
function showTypingBubble() {
    if (typingBubble) return;

    const messagesDiv = document.getElementById("messages");
    const bubble = document.createElement("div");

    bubble.style.margin = "10px 0";
    bubble.style.padding = "10px 15px";
    bubble.style.borderRadius = "10px";
    bubble.style.maxWidth = "80%";
    bubble.style.background = "#eee";
    bubble.style.marginRight = "auto";
    bubble.style.opacity = "0.7";

    bubble.innerHTML = `
        <span style="display:inline-block;width:40px;">
            <span style="animation: blink 1s infinite;">.</span>
            <span style="animation: blink 1s infinite .25s;">.</span>
            <span style="animation: blink 1s infinite .5s;">.</span>
        </span>
    `;

    typingBubble = bubble;
    typingStart = Date.now();

    messagesDiv.appendChild(bubble);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function addMessage(sender, text) {
    const messagesDiv = document.getElementById("messages");
    const bubble = document.createElement("div");

    bubble.style.margin = "10px 0";
    bubble.style.padding = "10px 15px";
    bubble.style.borderRadius = "10px";
    bubble.style.maxWidth = "80%";

    if (sender === "student") {
        bubble.style.background = "#e0ffe0";
        bubble.style.marginLeft = "auto";
    } else {
        bubble.style.background = "#eee";
        bubble.style.marginRight = "auto";
    }

    bubble.textContent = text;
    messagesDiv.appendChild(bubble);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}



// ---------------------------------------------------------------------
// TIMER
// ---------------------------------------------------------------------
let timeLeft;
let sessionEnded;

window.initTimer = function(seconds, endedFlag) {
    timeLeft = seconds;
    sessionEnded = endedFlag;
}

function startTimer() {
    if (sessionEnded) {
        disableInput();
        document.getElementById("timeLeft").textContent = "00:00";
        return;
    }

    document.getElementById("timeLeft").textContent = formatTime(timeLeft);

    const interval = setInterval(() => {
        if (!vivaStarted) return;

        if (timeLeft <= 0) {
            clearInterval(interval);
            disableInput();
            document.getElementById("timeLeft").textContent = "00:00";
            return;
        }

        timeLeft -= 1;
        document.getElementById("timeLeft").textContent = formatTime(timeLeft);

        if (timeLeft === 0) disableInput();

    }, 1000);
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}



// ---------------------------------------------------------------------
// END SESSION
// ---------------------------------------------------------------------
function disableInput() {
    document.getElementById("messageInput").disabled = true;
    document.getElementById("sendBtn").disabled = true;

    logEvent("viva_end");

    setTimeout(() => {
        window.location.href = "/viva/summary/" + sessionId + "/";
    }, 800);
}



// ---------------------------------------------------------------------
// CSRF
// ---------------------------------------------------------------------
function getCookie(name) {
    const cookieValue = document.cookie
        .split("; ")
        .find(row => row.startsWith(name + "="))
        ?.split("=")[1];
    return cookieValue || "";
}

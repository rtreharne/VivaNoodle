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

    const summaryCard = document.querySelector("[data-viva-summary-card]");
    const chatCard = document.querySelector("[data-viva-chat-card]");
    const settingsGrid = document.querySelector(".settings-grid");
    const backBtn = document.querySelector("[data-back-summary]");
    const startVivaBtns = document.querySelectorAll("[data-start-viva]");
    const layoutToggle = document.querySelector("[data-layout-toggle]");
    const layoutIconColumns = document.querySelector(".layout-columns");
    const layoutIconRows = document.querySelector(".layout-rows");

    const showChat = (scroll = true) => {
        if (!summaryCard || !chatCard) return;
        summaryCard.classList.add("is-hidden");
        chatCard.classList.remove("is-hidden");
        if (scroll) chatCard.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const showSummary = () => {
        if (!summaryCard || !chatCard) return;
        chatCard.classList.add("is-hidden");
        summaryCard.classList.remove("is-hidden");
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
            showChat(true);
        });
    });

    if (backBtn) {
        backBtn.addEventListener("click", () => {
            showSummary();
            summaryPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }

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

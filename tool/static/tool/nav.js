document.addEventListener("DOMContentLoaded", () => {
    const toggles = document.querySelectorAll("[data-nav-toggle]");
    toggles.forEach((toggle) => {
        const nav = toggle.closest(".nav");
        const links = nav ? nav.querySelector("[data-nav-links]") : null;
        if (!links) return;
        toggle.addEventListener("click", () => {
            links.classList.toggle("open");
        });
        links.addEventListener("click", (event) => {
            const link = event.target.closest("a");
            if (link) {
                links.classList.remove("open");
            }
        });
    });
});

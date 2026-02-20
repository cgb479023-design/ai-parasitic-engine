(function () {
    try {
        window.onbeforeunload = null;
        window.onunload = null;
        console.log("🛡️ [Suppressor] Page context listeners cleared.");
    } catch (e) {
        console.error("🛡️ [Suppressor] Failed to clear listeners:", e);
    }
})();

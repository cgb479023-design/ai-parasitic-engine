// ═══════════════════════════════════════════════════════════════════════════
// 📥 DOWNLOAD SERVICE MODULE
// ═══════════════════════════════════════════════════════════════════════════

const DownloadService = {
    async downloadVideo(url) {
        console.log("📥 [DownloadService] Fetching video from URL:", url?.substring(0, 80));

        if (!url) {
            throw new Error("No URL provided");
        }

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const buffer = await response.arrayBuffer();
            const len = buffer.byteLength;
            console.log("✅ [DownloadService] Video fetched successfully, size:", (len / 1024 / 1024).toFixed(2), "MB");

            // Robust base64 conversion using chunked approach
            const bytes = new Uint8Array(buffer);
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < bytes.length; i += chunkSize) {
                binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
            }
            const base64 = btoa(binary);

            console.log("✅ [DownloadService] Base64 conversion complete");
            return base64;
        } catch (error) {
            console.error("❌ [DownloadService] Video fetch failed:", error);
            throw error;
        }
    }
};

// GeminiGen Native Auto-Pilot (v3.5 - Timestamped)
console.log(`🚀 [Native Extension] Loaded & Ready! (Version: v3.5 - ${new Date().toLocaleTimeString()})`);

(function () {
    if (window.__GEMINI_EXT_LOADED) return;
    window.__GEMINI_EXT_LOADED = true;

    const hostname = window.location.hostname;
    console.log(`📍 [Native Extension] Current Hostname: "${hostname}"`);

    // --- 1. Universal Message Bridge (Runs everywhere, including localhost) ---

    // Helper: Get Video ID from URL (Safe)
    function getURLVideoID() {
        try {
            if (!window.location.hostname.includes('youtube.com')) return null;
            const params = new URLSearchParams(window.location.search);
            if (params.has('v')) return params.get('v');
            const path = window.location.pathname;
            if (path.includes('/video/')) return path.split('/video/')[1].split('/')[0];
            if (path.includes('/shorts/')) return path.split('/shorts/')[1].split('/')[0];
            return null;
        } catch (e) {
            return null;
        }
    }

    window.addEventListener('message', (event) => {
        // Filter out React DevTools messages
        if (event.data && event.data.source === 'react-devtools-bridge') return;

        // LOG EVERYTHING for debugging (Except large payloads)
        if (event.data && event.data.type === 'PREPARE_YOUTUBE_UPLOAD') {
            console.log("📨 [Content Debug] Message received: PREPARE_YOUTUBE_UPLOAD (Payload hidden)");
        } else {
            console.log("📨 [Content Debug] Message received (Type: " + (event.data ? event.data.type : 'unknown') + ")");
        }

        // Log Interceptor
        if (event.data && event.data.type === 'GEMINI_LOG_INTERCEPT') {
            const videoUrl = event.data.payload.url;
            console.log("🕵️‍♂️ Captured Video URL from Logs:", videoUrl);
            if (videoUrl && !window._hasDownloadedVideo) {
                window._hasDownloadedVideo = true;
                downloadVideo(videoUrl);
            }
        }

        // YouTube Upload Data Store
        if (event.data && event.data.type === 'PREPARE_YOUTUBE_UPLOAD') {
            console.log("📦 Received YouTube Upload Data (Size: " + (event.data.payload.videoData ? event.data.payload.videoData.length : 'unknown') + " chars)");
            if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
                showReloadOverlay();
                return;
            }
            try {
                chrome.runtime.sendMessage({
                    action: 'storeVideoData',
                    data: event.data.payload
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("❌ Failed to store data:", chrome.runtime.lastError.message);
                        if (chrome.runtime.lastError.message.includes("invalidated")) showReloadOverlay();
                    } else {
                        console.log("✅ Data sent to background memory.");
                        if (event.source) event.source.postMessage({ type: 'YOUTUBE_DATA_SAVED' }, '*');
                    }
                });
            } catch (e) {
                console.error("❌ Extension communication error:", e);
                showReloadOverlay();
            }
        }

        // LMArena Prompt Store
        if (event.data && event.data.type === 'STORE_LMARENA_PROMPT') {
            console.log("📦 [Content] Received LMArena Prompt. Storing...");
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                try {
                    chrome.runtime.sendMessage({
                        action: 'storeLMArenaPrompt',
                        prompt: event.data.payload.prompt
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error("❌ Failed to store prompt:", chrome.runtime.lastError.message);
                            if (chrome.runtime.lastError.message.includes("invalidated")) showReloadOverlay();
                        }
                    });
                } catch (e) {
                    console.error("❌ Extension communication error:", e);
                    showReloadOverlay();
                }
            } else {
                showReloadOverlay();
            }
        }

        // YouTube Analytics Bridge (Localhost -> Background)
        if (event.data && event.data.type === 'REQUEST_YOUTUBE_ANALYTICS') {
            console.log("🌉 [Bridge] 1. Received Request from React:", event.data.payload);

            try {
                chrome.runtime.sendMessage({
                    action: 'relayAnalyticsRequest',
                    payload: event.data.payload
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("❌ [Bridge] Runtime Error:", chrome.runtime.lastError.message);
                        if (chrome.runtime.lastError.message.includes("invalidated")) {
                            showReloadOverlay();
                        }
                    } else {
                        console.log("🌉 [Bridge] 2. Sent to Background. Response:", response);
                    }
                });
            } catch (error) {
                console.error("❌ [Bridge] Communication Error:", error);
                if (error.message.includes("invalidated")) {
                    showReloadOverlay();
                }
            }
        }

        // Open Tab Request (Localhost -> Background)
        if (event.data && event.data.type === 'OPEN_YOUTUBE_UPLOAD_TAB') {
            console.log("🌐 [Bridge] Requesting Background to Open Tab:", event.data.url);
            chrome.runtime.sendMessage({
                action: 'openTab',
                url: event.data.url
            }, (response) => {
                if (chrome.runtime.lastError || !response || !response.success) {
                    console.warn("⚠️ Background openTab failed (Extension might need reload), trying direct window.open...", chrome.runtime.lastError);
                    window.open(event.data.url, '_blank');
                }
            });
        }
    });

    // Listen for Analytics Results (Background -> Localhost)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'YOUTUBE_ANALYTICS_RESULT') {
            console.log("🌉 [Bridge] Received Analytics Result via Background:", message.data);
            window.postMessage({
                type: 'YOUTUBE_ANALYTICS_RESULT',
                data: message.data,
                category: message.category
            }, '*');
        }

        // Listen for LMArena Response (Background -> Localhost)
        if (message.type === 'LMARENA_RESPONSE_RESULT') {
            console.log("🌉 [Bridge] Received LMArena Response via Background:", message.payload);
            window.postMessage({
                type: 'LMARENA_RESPONSE_RESULT',
                payload: message.payload
            }, '*');
        }

        // Listen for YouTube Upload Complete (Background -> Localhost)
        if (message.type === 'YOUTUBE_UPLOAD_COMPLETE') {
            console.log("🎉 [Bridge] Received Upload Complete:", message.videoUrl);
            window.postMessage({
                type: 'YOUTUBE_UPLOAD_COMPLETE',
                videoUrl: message.videoUrl
            }, '*');
        }
    });


    // --- Helpers ---
    const showReloadOverlay = () => {
        if (document.getElementById('gemini-reload-overlay')) return;
        const div = document.createElement('div');
        div.id = 'gemini-reload-overlay';
        div.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); z-index: 2147483647; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; font-family: sans-serif; text-align: center; pointer-events: all;';
        div.innerHTML = `
            <div style="font-size: 50px; margin-bottom: 20px;">⚠️</div>
            <h1 style="font-size: 30px; margin-bottom: 10px;">Extension Updated</h1>
            <p style="font-size: 18px; margin-bottom: 30px; opacity: 0.8;">Please refresh the page to apply changes.</p>
            <button onclick="window.location.reload()" style="padding: 15px 30px; font-size: 18px; background: #7c3aed; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold;">Refresh Page</button>
        `;
        document.body.appendChild(div);
    };

    const downloadVideo = (url) => {
        console.log("⬇️ Starting Download for:", url);
        chrome.runtime.sendMessage({ action: "downloadVideo", url: url }, (response) => {
            if (chrome.runtime.lastError) {
                console.warn("⚠️ Background fetch failed, trying direct fetch...", chrome.runtime.lastError.message);
                fetch(url).then(res => res.blob()).then(blob => {
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `gemini_video_${Date.now()}.mp4`;
                    a.click();
                });
            } else if (response && response.success) {
                const a = document.createElement('a');
                a.href = "data:video/mp4;base64," + response.data;
                a.download = `gemini_video_${Date.now()}.mp4`;
                a.click();
            }
        });
    };

    // --- 2. YouTube Specific Logic (ONLY runs on youtube.com) ---
    // STRICT CHECK: Must end with youtube.com to avoid matching "youtube.com.local" or similar
    if (hostname === 'www.youtube.com' || hostname === 'studio.youtube.com' || hostname.endsWith('.youtube.com')) {
        console.log("📺 [GeminiGen Ext] Detected YouTube Domain - Initializing Features...");

        // Helper to get video ID from URL (The source of the previous error)
        const getURLVideoID = () => {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('v');
        };

        // Only run upload logic if we are on the upload page
        if (window.location.href.includes('/upload')) {
            const runYouTubeUpload = () => {
                // Request data from background
                console.log("📺 Requesting video data from background...");

                const processUpload = async (data) => {
                    console.log("🚀 Starting YouTube Upload Automation for:", data.title);

                    // Convert Base64 to File
                    // Handle both pure base64 and data URL format
                    let base64String = data.videoData;
                    if (base64String.startsWith('data:')) {
                        // Extract base64 part from "data:video/mp4;base64,XXXXX"
                        base64String = base64String.split(',')[1];
                    }

                    console.log("📊 Base64 Data Length:", base64String.length, "chars");

                    const byteCharacters = atob(base64String);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: 'video/mp4' });
                    const file = new File([blob], data.fileName || `video_${Date.now()}.mp4`, { type: 'video/mp4' });

                    console.log("✅ Video File Created:", file.name, "Size:", file.size, "bytes");

                    // Helper: Deep Query Selector (Traverses Shadow DOM)
                    const deepQuery = (root, selector) => {
                        if (!root) return null;
                        if (root.querySelector && root.querySelector(selector)) return root.querySelector(selector);

                        // Traverse children and shadow roots
                        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
                        let node;
                        while (node = walker.nextNode()) {
                            if (node.shadowRoot) {
                                const found = deepQuery(node.shadowRoot, selector);
                                if (found) return found;
                            }
                        }
                        return null;
                    };
                    const deepQuerySelector = deepQuery;

                    // Find Upload Input with Shadow DOM Support
                    const findAndUpload = async () => {
                        // 1. Try standard check first
                        let uploadInput = document.querySelector('input[type="file"]');

                        if (!uploadInput) {
                            console.warn("⚠️ Upload input not found. Attempting Shadow DOM click sequence...");

                            // 2. Find "Create" button (Shadow DOM aware)
                            // It's usually inside <ytcp-header> -> <ytcp-icon-button>
                            const createBtn = deepQuery(document.body, '#create-icon') ||
                                deepQuery(document.body, '[aria-label="Create"]');

                            if (createBtn) {
                                console.log("✅ Found Create button via Deep Query. Clicking...");
                                createBtn.click();
                                await new Promise(r => setTimeout(r, 1000));

                                // 3. Find "Upload videos" in the dropdown
                                // The dropdown is often appended to the body or a specific overlay container
                                const menuItems = Array.from(document.querySelectorAll('tp-yt-paper-item, ytcp-text-menu-item'));
                                const uploadOption = menuItems.find(el => el.textContent.trim().includes('Upload videos'));

                                if (uploadOption) {
                                    console.log("✅ Found 'Upload videos' option. Clicking...");
                                    uploadOption.click();
                                    await new Promise(r => setTimeout(r, 2000)); // Wait for dialog
                                } else {
                                    console.warn("⚠️ 'Upload videos' option not found in open menu.");
                                }
                            } else {
                                console.error("❌ Could not find 'Create' button even with Deep Query.");
                            }

                            // Re-check for input (it might be in Shadow DOM too, but usually it's light DOM once dialog opens)
                            uploadInput = document.querySelector('input[type="file"]');
                        }

                        if (uploadInput) {
                            const dataTransfer = new DataTransfer();
                            dataTransfer.items.add(file);
                            uploadInput.files = dataTransfer.files;
                            const event = new Event('change', { bubbles: true });
                            uploadInput.dispatchEvent(event);
                            console.log("📂 File input set and change event dispatched.");
                        } else {
                            console.error("❌ Upload input STILL not found. Please manually click 'Create' -> 'Upload videos' if the dialog is not open.");
                            // alert("Auto-Upload Stuck: Please click 'Create' -> 'Upload videos' manually!");
                            return;
                        }
                    };

                    await findAndUpload();

                    // Wait for Wizard and Fill Data
                    const waitFor = (selector, timeout = 30000) => {
                        return new Promise((resolve, reject) => {
                            const interval = setInterval(() => {
                                const el = document.querySelector(selector);
                                if (el) {
                                    clearInterval(interval);
                                    resolve(el);
                                }
                            }, 1000);
                            setTimeout(() => {
                                clearInterval(interval);
                                reject(`Timeout waiting for ${selector}`);
                            }, timeout);
                        });
                    };

                    try {
                        // 1. Wait for Title Box (Metadata)
                        console.log("⏳ Waiting for metadata dialog...");
                        // Try multiple selectors for title box
                        let titleBox = null;
                        try {
                            titleBox = await waitFor('#textbox[aria-label*="Add a title"]', 10000);
                        } catch (e) {
                            console.log("⚠️ Primary title selector failed, trying fallback...");
                            titleBox = await waitFor('#title-textarea #textbox', 10000);
                        }

                        if (titleBox) {
                            // Clear existing title (defaults to filename)
                            titleBox.textContent = '';
                            titleBox.dispatchEvent(new Event('input', { bubbles: true }));

                            // Type new title
                            titleBox.textContent = data.title;
                            titleBox.dispatchEvent(new Event('input', { bubbles: true }));
                        }

                        // Description
                        const descBox = await waitFor('#description-textarea #textbox');
                        if (descBox) {
                            descBox.textContent = data.description;
                            descBox.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                        console.log("📝 Metadata filled.");

                        // Helper: Scroll and Click
                        const scrollAndClick = async (element) => {
                            if (element) {
                                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                await new Promise(r => setTimeout(r, 500));
                                element.click();
                                return true;
                            }
                            return false;
                        };

                        // Helper: Find by Text (Deep Search)
                        const findElementByText = (selector, text) => {
                            const elements = Array.from(document.querySelectorAll(selector));
                            return elements.find(el => el.textContent.trim().includes(text));
                        };

                        // --- 2. Custom Selections ---


                        // Helper: Find Element by Text Content (Deep)
                        const findElementByTextDeep = (root, text) => {
                            const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
                            let node;
                            const lowerText = text.toLowerCase();
                            while (node = walker.nextNode()) {
                                if (node.nodeType === Node.TEXT_NODE && node.textContent.trim().toLowerCase() === lowerText) return node.parentElement;
                                if (node.nodeType === Node.ELEMENT_NODE && node.shadowRoot) {
                                    const found = findElementByTextDeep(node.shadowRoot, text);
                                    if (found) return found;
                                }
                            }
                            return null;
                        };

                        // A. Playlists
                        try {
                            console.log("📂 Attempting to select Playlists...");
                            // Target the specific container for playlists
                            const playlistSection = document.querySelector('ytcp-video-metadata-playlists');
                            let playlistTrigger = null;

                            if (playlistSection) {
                                // The trigger is usually inside the shadow root of ytcp-video-metadata-playlists
                                // or inside a child component like ytcp-text-dropdown-trigger
                                playlistTrigger = deepQuerySelector(playlistSection, '#trigger');

                                // Fallback: Look for "Select" text or specific class
                                if (!playlistTrigger) {
                                    console.log("⚠️ Playlist #trigger not found, trying text search...");
                                    const selectText = findElementByTextDeep(playlistSection, 'Select');
                                    if (selectText) playlistTrigger = selectText;
                                }
                            }

                            if (playlistTrigger) {
                                console.log("Found Playlist trigger, clicking...");
                                playlistTrigger.click();
                                await new Promise(r => setTimeout(r, 2000)); // Wait for dialog

                                const targetPlaylists = (data.playlists && Array.isArray(data.playlists) && data.playlists.length > 0)
                                    ? data.playlists
                                    : ["Case Studies: Community Power Anomalies"];

                                // The dialog is usually appended to document.body, so we search globally
                                const playlistDialog = document.querySelector('ytcp-playlist-dialog');

                                // Scroll the list to ensure ALL items are rendered (Virtual Scrolling)
                                if (playlistDialog) {
                                    const list = playlistDialog.querySelector('#playlists-list') || playlistDialog.querySelector('iron-list');
                                    if (list) {
                                        // Scroll to top first
                                        list.scrollTop = 0;
                                        await new Promise(r => setTimeout(r, 500));

                                        // Scroll to bottom to load all items
                                        list.scrollTop = list.scrollHeight;
                                        await new Promise(r => setTimeout(r, 1000));

                                        // Scroll back to top for visibility
                                        list.scrollTop = 0;
                                        await new Promise(r => setTimeout(r, 500));
                                    }
                                }

                                for (const target of targetPlaylists) {
                                    // Search for the text inside the dialog or globally if dialog var is null
                                    const searchRoot = playlistDialog || document.body;

                                    // Use a partial match for the label (Case Insensitive)
                                    const labelEl = findElementByTextDeep(searchRoot, target) ||
                                        Array.from(searchRoot.querySelectorAll('span, div, tp-yt-paper-checkbox, label')).find(el => el.textContent.toLowerCase().includes(target.toLowerCase()));

                                    if (labelEl) {
                                        // Try to find the checkbox component
                                        const checkbox = labelEl.closest('tp-yt-paper-checkbox') ||
                                            labelEl.parentElement.querySelector('tp-yt-paper-checkbox');
                                        if (checkbox) {
                                            checkbox.click();
                                            console.log("✅ Selected playlist:", target);
                                            await new Promise(r => setTimeout(r, 500)); // Wait for selection to register
                                        } else {
                                            console.warn("⚠️ Playlist checkbox NOT found for:", target);
                                        }
                                    } else {
                                        console.warn("⚠️ Playlist label NOT found for:", target);
                                    }
                                }

                                // Close the dialog by clicking "Done" button
                                await new Promise(r => setTimeout(r, 1000));
                                const doneButton = document.querySelector('ytcp-playlist-dialog ytcp-button#done-button, ytcp-playlist-dialog button[aria-label="Done"]');
                                if (doneButton) {
                                    doneButton.click();
                                    console.log("✅ Closed playlist dialog");
                                    await new Promise(r => setTimeout(r, 1500)); // Wait for dialog to close completely
                                }
                            }
                        } catch (e) { console.warn("Playlist selection failed", e); }

                        // B. Audience (CRITICAL - REQUIRED FIELD)
                        try {
                            console.log("👶 Setting Audience (Not Made for Kids)...");
                            await new Promise(r => setTimeout(r, 1000));

                            // Strategy 1: Find radio button by name attribute
                            let notForKidsRadio = document.querySelector('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]');

                            // Strategy 2: Find by aria-label or text content
                            if (!notForKidsRadio) {
                                console.log("⚠️ Trying text-based search for 'No, it's not made for kids'...");
                                const radioButtons = Array.from(document.querySelectorAll('tp-yt-paper-radio-button'));
                                notForKidsRadio = radioButtons.find(btn => {
                                    const text = btn.textContent || '';
                                    return text.includes("No") && text.includes("not made for kids");
                                });
                            }

                            // Strategy 3: Deep search in shadow DOM
                            if (!notForKidsRadio) {
                                console.log("⚠️ Trying deep search in Audience section...");
                                const audienceSection = document.querySelector('ytcp-video-metadata-editor-sidepanel') ||
                                    document.querySelector('[id*="audience"]') ||
                                    document.body;

                                // Find "No" label under audience context
                                const noLabel = findElementByTextDeep(audienceSection, "No, it's not made for kids");
                                if (noLabel) {
                                    // Try to find the radio button associated with this label
                                    notForKidsRadio = noLabel.closest('tp-yt-paper-radio-button') ||
                                        noLabel.querySelector('tp-yt-paper-radio-button') ||
                                        noLabel.parentElement.querySelector('tp-yt-paper-radio-button');
                                }
                            }

                            if (notForKidsRadio) {
                                console.log("✅ Found 'Not for Kids' radio button, clicking...");
                                notForKidsRadio.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                await new Promise(r => setTimeout(r, 500));
                                notForKidsRadio.click();
                                console.log("✅ Selected 'Not Made for Kids'");
                                await new Promise(r => setTimeout(r, 1000));
                            } else {
                                console.error("❌ Could not find 'Not Made for Kids' radio button!");
                                console.warn("⚠️ Upload may be stuck - Audience is a required field!");
                            }
                        } catch (e) {
                            console.error("❌ Audience selection FAILED:", e);
                            console.warn("⚠️ This is a critical error - video upload cannot proceed without Audience selection!");
                        }

                        // B1. Age Restriction (Advanced)
                        try {
                            console.log("🔞 Setting Age Restriction (Advanced)...");
                            await new Promise(r => setTimeout(r, 1000));

                            // 1. Find the "Age restriction (advanced)" toggle/button
                            // It's often a button with text "Age restriction (advanced)"
                            const ageAdvanceButton = findElementByTextDeep(document.body, 'Age restriction (advanced)');

                            if (ageAdvanceButton) {
                                // Check if we need to expand it. 
                                // Usually if the radio buttons aren't visible, we need to click.
                                // Let's try to find the target radio button first.
                                let noRestrictRadio = document.querySelector('tp-yt-paper-radio-button[name="VIDEO_AGE_RESTRICTION_NOT_RESTRICTED"]');

                                if (!noRestrictRadio) {
                                    console.log("Expanding Age Restriction section...");
                                    ageAdvanceButton.click();
                                    await new Promise(r => setTimeout(r, 1000));

                                    // Try finding again after expansion
                                    noRestrictRadio = document.querySelector('tp-yt-paper-radio-button[name="VIDEO_AGE_RESTRICTION_NOT_RESTRICTED"]');
                                }

                                // Fallback: Text search if name attribute fails
                                if (!noRestrictRadio) {
                                    console.log("⚠️ Trying text-based search for Age Restriction...");
                                    const radioButtons = Array.from(document.querySelectorAll('tp-yt-paper-radio-button'));
                                    noRestrictRadio = radioButtons.find(btn => {
                                        const text = (btn.textContent || '').trim();
                                        return text.includes("No, don't restrict my video to viewers over 18 only");
                                    });
                                }

                                if (noRestrictRadio) {
                                    console.log("✅ Found 'No restrict' radio button, clicking...");
                                    noRestrictRadio.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    await new Promise(r => setTimeout(r, 500));
                                    noRestrictRadio.click();
                                    console.log("✅ Selected 'No, don't restrict my video to viewers over 18 only'");
                                } else {
                                    console.warn("⚠️ Could not find 'No restrict' radio button.");
                                }
                            } else {
                                console.warn("⚠️ 'Age restriction (advanced)' toggle not found.");
                            }
                        } catch (e) {
                            console.warn("Age restriction selection failed", e);
                        }


                        // B2. Playlists (New)
                        try {
                            console.log("📂 Setting Playlists...");
                            // Find Playlists dropdown trigger
                            const playlistSection = document.querySelector('ytcp-video-metadata-playlists');
                            if (playlistSection) {
                                const trigger = playlistSection.querySelector('.ytcp-text-dropdown-trigger') ||
                                    playlistSection.querySelector('#trigger');
                                if (trigger) {
                                    trigger.click();
                                    console.log("Clicked Playlists dropdown");
                                    await new Promise(r => setTimeout(r, 4000)); // Wait for dialog (Increased)

                                    // Define target playlists
                                    const targetPlaylists = ["Digital Forensics Reports: Full Case Files", "Evidence Chain Analysis"];

                                    // Find all checkbox items in the dialog
                                    const checkboxes = Array.from(document.querySelectorAll('ytcp-playlist-dialog tp-yt-paper-checkbox, ytcp-checkbox-group tp-yt-paper-checkbox'));

                                    for (const checkbox of checkboxes) {
                                        const label = (checkbox.textContent || '').trim().toLowerCase();
                                        if (targetPlaylists.some(t => label.includes(t.toLowerCase()))) {
                                            if (checkbox.getAttribute('aria-checked') !== 'true' && !checkbox.checked) {
                                                checkbox.click();
                                                console.log(`✅ Selected Playlist: ${label}`);
                                                await new Promise(r => setTimeout(r, 500));
                                            } else {
                                                console.log(`ℹ️ Playlist already selected: ${label}`);
                                            }
                                        }
                                    }
                                }
                            }
                        } catch (e) { console.warn("Playlists failed", e); }

                        // C. Show More (CRITICAL STEP)
                        try {
                            console.log("展开 'Show more'...");
                            let showMoreClicked = false;

                            // The "Show more" button is usually a generic button or inside ytcp-video-metadata-editor
                            // ID: toggle-button is very common for this specific element
                            let toggleBtn = deepQuerySelector(document.body, '#toggle-button');

                            // Fallback: Find by text "Show more"
                            if (!toggleBtn) {
                                console.log("⚠️ '#toggle-button' not found, searching by text 'Show more'...");
                                const allButtons = Array.from(document.querySelectorAll('button, div[role="button"], ytcp-button'));
                                toggleBtn = allButtons.find(b => b.textContent.trim().toLowerCase() === 'show more');
                            }

                            if (toggleBtn && toggleBtn.textContent.toLowerCase().includes('show more')) {
                                toggleBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                await new Promise(r => setTimeout(r, 500));
                                toggleBtn.click();
                                showMoreClicked = true;
                            } else {
                                // Text search fallback
                                const showMoreBtn = findElementByTextDeep(document.body, 'Show more');
                                if (showMoreBtn) {
                                    showMoreBtn.click();
                                    showMoreClicked = true;
                                }
                            }

                            if (showMoreClicked) {
                                console.log("✅ Clicked 'Show more', waiting for expansion...");
                                await new Promise(r => setTimeout(r, 3000));
                            } else {
                                console.warn("⚠️ 'Show more' button not found.");
                            }
                        } catch (e) { console.warn("Show more failed", e); }

                        // D. Altered Content
                        try {
                            console.log("🤖 Setting Altered Content...");
                            // Strategy 1: Find the specific radio group
                            const alteredSection = document.querySelector('ytcp-altered-content-select');
                            let yesRadio = null;

                            if (alteredSection) {
                                yesRadio = deepQuerySelector(alteredSection, '[name="ALTERED_CONTENT_YES"]') ||
                                    deepQuerySelector(alteredSection, '#radioLabel');
                            }

                            // Strategy 2: Text Search
                            if (!yesRadio) {
                                const question = findElementByTextDeep(document.body, 'Do any of the following describe your content?');
                                if (question) {
                                    const container = question.closest('ytcp-altered-content-select') || question.parentElement.parentElement;
                                    if (container) {
                                        const yesLabel = findElementByTextDeep(container, 'Yes');
                                        if (yesLabel) yesRadio = yesLabel;
                                    }
                                }
                            }

                            if (yesRadio) {
                                yesRadio.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                yesRadio.click();
                                console.log("✅ Selected 'Altered Content: Yes'");
                            } else {
                                console.warn("⚠️ Altered Content 'Yes' option not found.");
                            }
                        } catch (e) { console.warn("Altered content failed", e); }

                        // E. Tags
                        try {
                            console.log("🏷️ Filling Tags...");
                            const tagsToFill = (data.tags && Array.isArray(data.tags)) ? data.tags : [];

                            if (tagsToFill.length > 0) {
                                console.log(`📝 Tags to fill: ${tagsToFill.join(', ')}`);
                                await new Promise(r => setTimeout(r, 1000));

                                let tagInput = null;
                                let attempts = 0;

                                while (!tagInput && attempts < 3) {
                                    attempts++;
                                    const chipBar = document.querySelector('ytcp-chip-bar');
                                    if (chipBar) {
                                        tagInput = chipBar.querySelector('#text-input') || chipBar.querySelector('input');
                                    }

                                    // Fallback: Find input by aria-label "Tags"
                                    if (!tagInput) {
                                        tagInput = document.querySelector('input[aria-label="Tags"]');
                                    }

                                    if (!tagInput) await new Promise(r => setTimeout(r, 1000));
                                }

                                if (tagInput) {
                                    tagInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    tagInput.click();
                                    tagInput.focus();

                                    // Set tags iteratively
                                    for (const tag of tagsToFill) {
                                        tagInput.value = tag;
                                        tagInput.dispatchEvent(new Event('input', { bubbles: true }));
                                        await new Promise(r => setTimeout(r, 300));
                                        tagInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
                                        await new Promise(r => setTimeout(r, 500)); // Increased wait for tag to register
                                    }
                                    console.log("✅ Tags filled iteratively.");
                                    await new Promise(r => setTimeout(r, 1000)); // Wait before moving to next section
                                } else {
                                    console.warn("⚠️ Tag input field not found after 3 attempts");
                                }
                            }
                        } catch (e) { console.warn("Tags failed", e); }

                        // F. Language
                        try {
                            console.log("🗣️ Setting Language to English (United States)...");
                            const allLabels = Array.from(document.querySelectorAll('.ytcp-form-select-search-label, .label-text, span'));
                            const langLabel = allLabels.find(el => el.textContent.trim() === 'Video language');

                            if (langLabel) {
                                langLabel.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                // The select is usually a sibling or parent
                                const formSelect = langLabel.closest('ytcp-form-select') || langLabel.parentElement.querySelector('ytcp-form-select');

                                if (formSelect) {
                                    const trigger = formSelect.querySelector('#trigger');
                                    if (trigger) {
                                        trigger.click();
                                        await new Promise(r => setTimeout(r, 1500));

                                        const searchBox = document.querySelector('ytcp-text-menu-picker input, #text-input');
                                        if (searchBox) {
                                            searchBox.focus();
                                            document.execCommand('insertText', false, "English (United States)");
                                            await new Promise(r => setTimeout(r, 1000));
                                        }

                                        const options = Array.from(document.querySelectorAll('ytcp-ve tp-yt-paper-item'));
                                        const target = options.find(el => el.textContent.trim() === 'English (United States)');
                                        if (target) {
                                            target.click();
                                            console.log("✅ Selected Language: English (United States)");
                                            await new Promise(r => setTimeout(r, 1000)); // Wait for selection to register
                                        } else {
                                            console.warn("⚠️ Language option 'English (United States)' not found");
                                        }
                                    }
                                }
                            }
                        } catch (e) { console.warn("Language selection failed", e); }


                        // --- 3. Navigation to Visibility ---
                        console.log("➡️ Navigating to Visibility step...");
                        const clickNext = async () => {
                            const nextBtn = deepQuery(document.body, '#next-button') ||
                                deepQuery(document.body, '[test-id="next-button"]') ||
                                Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Next');

                            if (nextBtn) {
                                if (nextBtn.disabled || nextBtn.getAttribute('aria-disabled') === 'true') {
                                    return false;
                                }
                                nextBtn.click();
                                await new Promise(r => setTimeout(r, 2000));
                                return true;
                            }
                            return false;
                        };

                        let attempts = 0;
                        while (attempts < 5) {
                            const publicRadio = document.querySelector('tp-yt-paper-radio-button[name="PUBLIC"]');
                            if (publicRadio && publicRadio.offsetParent !== null) {
                                break;
                            }
                            await clickNext();
                            attempts++;
                        }

                        // --- 4. Visibility & Scheduling ---
                        console.log("⏳ Waiting for visibility options...");
                        await new Promise(r => setTimeout(r, 2000));

                        let dateValue = null;
                        let timeValue = null;

                        if (data.scheduleTime) {
                            console.log(`📅 Scheduling Mode Detected. Time: ${data.scheduleTime}`);

                            // Try dropdown approach first (new YouTube UI)
                            const visibilitySelect = document.querySelector('ytcp-video-visibility-select');
                            if (visibilitySelect) {
                                const trigger = visibilitySelect.querySelector('#trigger, ytcp-text-dropdown-trigger, [role="button"]');
                                if (trigger && trigger.textContent.toLowerCase().includes('save or publish')) {
                                    console.log("✅ Found visibility dropdown, clicking...");
                                    trigger.click();
                                    await new Promise(r => setTimeout(r, 1500));

                                    const scheduleOption = Array.from(document.querySelectorAll('tp-yt-paper-item, [role="menuitem"]'))
                                        .find(item => item.textContent.trim().toLowerCase().includes('schedule'));

                                    if (scheduleOption) {
                                        console.log("✅ Clicking 'Schedule' from dropdown");
                                        scheduleOption.click();
                                        await new Promise(r => setTimeout(r, 2000));
                                    }
                                }
                            }

                            // Fallback to radio button approach
                            let scheduleRadio = deepQuery(document.body, 'tp-yt-paper-radio-button[name="SCHEDULE"]');

                            // Fallback: Text search
                            if (!scheduleRadio) {
                                console.log("⚠️ 'Schedule' radio by name not found, trying text search...");

                                // Strategy 1: User provided hint - <p id="visibility-title">Schedule</p>
                                const visibilityTitle = document.querySelector('#visibility-title');
                                if (visibilityTitle && visibilityTitle.textContent.trim() === 'Schedule') {
                                    console.log("Found #visibility-title 'Schedule', searching for parent radio...");

                                    // Try to find parent radio button (walk up the tree)
                                    let parent = visibilityTitle.parentElement;
                                    let depth = 0;
                                    while (parent && depth < 5) {
                                        if (parent.tagName === 'TP-YT-PAPER-RADIO-BUTTON') {
                                            scheduleRadio = parent;
                                            console.log("✅ Found parent radio button via tree walk");
                                            break;
                                        }
                                        parent = parent.parentElement;
                                        depth++;
                                    }

                                    // If still not found, try clicking the container
                                    if (!scheduleRadio) {
                                        console.log("Parent radio not found, trying to click container...");
                                        const container = visibilityTitle.closest('div[role="radio"], ytcp-radio-button, [role="radiogroup"] > div');
                                        if (container) {
                                            container.click();
                                            await new Promise(r => setTimeout(r, 1000));
                                        } else {
                                            visibilityTitle.click();
                                            await new Promise(r => setTimeout(r, 1000));
                                        }
                                    }
                                }

                                // Strategy 2: Text-based search in all radio buttons
                                if (!scheduleRadio) {
                                    const allRadioButtons = Array.from(document.querySelectorAll('tp-yt-paper-radio-button'));
                                    scheduleRadio = allRadioButtons.find(rb => rb.textContent.trim().includes('Schedule'));
                                }
                            }

                            if (scheduleRadio) {
                                scheduleRadio.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                await new Promise(r => setTimeout(r, 500));
                                scheduleRadio.click();
                                console.log("✅ Clicked 'Schedule' radio button.");
                                await new Promise(r => setTimeout(r, 1500)); // Increased wait for schedule options to appear
                            } else {
                                console.warn("❌ Could not find 'Schedule' radio button.");
                            }

                            // 2. Parse Date and Time
                            if (data.scheduleTime) {
                                // Handle "YYYY/MM/DD HH:mm"
                                if (data.scheduleTime.includes('/')) {
                                    const parts = data.scheduleTime.split(' ');
                                    if (parts.length >= 2) {
                                        // Date Part: 2025/12/01 -> Dec 1, 2025
                                        const datePart = parts[0];
                                        const [yyyy, mm, dd] = datePart.split('/');
                                        const d = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
                                        if (!isNaN(d.getTime())) {
                                            dateValue = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                        }

                                        // Time Part: 04:00 -> 4:00 AM
                                        const timePart = parts[1];
                                        const [hours, minutes] = timePart.split(':');
                                        let h = parseInt(hours, 10);
                                        const m = minutes;
                                        const ampm = h >= 12 ? 'PM' : 'AM';
                                        h = h % 12;
                                        h = h ? h : 12;
                                        timeValue = `${h}:${m} ${ampm}`;
                                    }
                                }
                                // Handle ISO
                                else if (data.scheduleTime.includes('T')) {
                                    const d = new Date(data.scheduleTime);
                                    if (!isNaN(d.getTime())) {
                                        dateValue = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                        timeValue = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                                    }
                                }
                                // Handle time-only format (e.g., "8:00 PM")
                                else if (data.scheduleTime.match(/^\d{1,2}:\d{2}\s*(AM|PM)$/i)) {
                                    console.log("⏰ Time-only format detected, using tomorrow's date");
                                    const tomorrow = new Date();
                                    tomorrow.setDate(tomorrow.getDate() + 1);
                                    dateValue = tomorrow.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                                    timeValue = data.scheduleTime;
                                }
                            }

                            console.log(`📅 Parsed Date: ${dateValue}, Time: ${timeValue}`);

                            // 3. Set Date
                            if (dateValue) {
                                const datetimePicker = document.querySelector('ytcp-datetime-picker');
                                if (datetimePicker) {
                                    const inputs = Array.from(datetimePicker.querySelectorAll('input'));
                                    const dateInput = inputs[0]; // Usually first
                                    if (dateInput) {
                                        dateInput.click();
                                        dateInput.focus();
                                        document.execCommand('selectAll');
                                        document.execCommand('delete');
                                        await new Promise(r => setTimeout(r, 200));
                                        document.execCommand('insertText', false, dateValue);
                                        dateInput.dispatchEvent(new Event('input', { bubbles: true }));
                                        dateInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
                                        await new Promise(r => setTimeout(r, 500));
                                        console.log("✅ Date set.");
                                    }
                                }
                            }

                            // 4. Set Time
                            if (timeValue) {
                                const datetimePicker = document.querySelector('ytcp-datetime-picker');
                                if (datetimePicker) {
                                    const inputs = Array.from(datetimePicker.querySelectorAll('input'));
                                    // Time input is usually second, or has specific attributes
                                    let timeInput = inputs.find(i => (i.getAttribute('aria-label') || '').toLowerCase().includes('time')) || inputs[1];

                                    if (timeInput) {
                                        timeInput.click();
                                        timeInput.focus();
                                        document.execCommand('selectAll');
                                        document.execCommand('delete');
                                        await new Promise(r => setTimeout(r, 200));

                                        document.execCommand('insertText', false, timeValue);
                                        timeInput.dispatchEvent(new Event('input', { bubbles: true }));

                                        await new Promise(r => setTimeout(r, 1000));

                                        // Try to click option
                                        const options = Array.from(document.querySelectorAll('tp-yt-paper-item'));
                                        const targetOption = options.find(opt => opt.textContent.trim() === timeValue);
                                        if (targetOption) {
                                            targetOption.click();
                                        } else {
                                            // Simulate Enter
                                            timeInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
                                        }
                                        console.log("✅ Time set.");
                                    }
                                }
                            }
                        } else {
                            // No schedule, so we must select a visibility (Private, Unlisted, Public)
                            // Default to Public as per user request
                            console.log("🌍 No schedule time provided. Selecting 'Public' visibility...");
                            await new Promise(r => setTimeout(r, 1000));

                            const publicRadio = document.querySelector('tp-yt-paper-radio-button[name="PUBLIC"]');
                            if (publicRadio) {
                                publicRadio.click();
                                console.log("✅ Selected 'Public'");
                            } else {
                                // Fallback
                                const labels = Array.from(document.querySelectorAll('div, span')).filter(el => el.textContent.trim() === 'Public');
                                const label = labels.find(l => l.closest('tp-yt-paper-radio-button'));
                                if (label) {
                                    label.click();
                                    console.log("✅ Selected 'Public' (via text)");
                                } else {
                                    console.warn("⚠️ Could not find 'Public' radio button.");
                                }
                            }
                        }

                        // Click Schedule/Publish
                        await new Promise(r => setTimeout(r, 2000));
                        await new Promise(r => setTimeout(r, 2000));
                        let doneBtn = deepQuery(document.body, '#done-button');

                        if (!doneBtn) {
                            console.log("⚠️ '#done-button' not found, trying text search...");
                            const buttons = Array.from(document.querySelectorAll('button, ytcp-button'));
                            doneBtn = buttons.find(b => {
                                const text = (b.textContent || '').trim().toLowerCase();
                                return text === 'save' || text === 'publish' || text === 'schedule';
                            });
                        }

                        if (doneBtn) {
                            doneBtn.click();
                            console.log("✅ Clicked Schedule/Publish!");

                            // Capture Link
                            await new Promise(r => setTimeout(r, 5000));
                            const linkEl = Array.from(document.querySelectorAll('a')).find(a => a.href && a.href.includes('youtu.be'));
                            if (linkEl) {
                                console.log("🚀 RELAYING SUCCESS:", linkEl.href);
                                chrome.runtime.sendMessage({ action: 'relayYouTubeUploadComplete', videoUrl: linkEl.href });
                            }
                        }

                        chrome.runtime.sendMessage({ action: "clearVideoData" });


                    } catch (e) {
                        console.error("❌ Process Upload Wizard Failed:", e);
                    }
                };

                chrome.runtime.sendMessage({ action: "getVideoData" }, (response) => {
                    if (!response || !response.success || !response.data) {
                        console.log("ℹ️ No pending upload data found.");
                        return;
                    }
                    processUpload(response.data);
                });
            };
            // Delay slightly to ensure page load
            setTimeout(runYouTubeUpload, 2000);




        }
    }

    // --- 3. GeminiGen Specific Logic (ONLY runs on geminigen.ai) ---
    else if (hostname.includes('geminigen.ai') || hostname.includes('gmicloud.ai')) {
        console.log("🤖 [GeminiGen Ext] Detected Generation Site - Initializing Auto-Pilot...");
        let hasClickedGenerate = false;

        // Monitor for Result and Send Back
        const monitorResult = () => {
            console.log("👀 [Auto-Pilot] Monitoring for video result...");

            const checkVideo = setInterval(() => {
                // Strategy 1: Look for any video tag with a valid src
                const videos = Array.from(document.querySelectorAll('video'));
                // Filter out small preview videos or background videos if any (heuristic: duration > 0)
                const generatedVideo = videos.find(v => v.src && v.src.startsWith('http') && v.readyState >= 1 && v.duration > 0);

                if (generatedVideo) {
                    console.log("🎉 [Auto-Pilot] Video found!", generatedVideo.src);
                    clearInterval(checkVideo);

                    // Fetch and Convert to Base64 via Background Script (Avoids CORS)
                    console.log("⬇️ Fetching video blob via Background...");

                    chrome.runtime.sendMessage({ action: "downloadVideo", url: generatedVideo.src }, (response) => {
                        if (response && response.success) {
                            console.log("✅ [Auto-Pilot] Video fetched successfully!");
                            const base64Content = response.data;

                            if (window.opener) {
                                console.log("📤 [Auto-Pilot] Sending Base64 result to opener...");
                                window.opener.postMessage({
                                    type: 'GEMINI_VIDEO_RESULT',
                                    payload: base64Content
                                }, '*');

                                // Close window after a short delay
                                setTimeout(() => {
                                    console.log("👋 [Auto-Pilot] Closing window...");
                                    window.close();
                                }, 3000);
                            } else {
                                console.warn("⚠️ [Auto-Pilot] No opener window found. Cannot send result back.");
                            }
                        } else {
                            console.error("❌ [Auto-Pilot] Background fetch failed:", response ? response.error : "Unknown error");
                            // Fallback to direct fetch if background fails (unlikely but good safety)
                            fetch(generatedVideo.src)
                                .then(res => res.blob())
                                .then(blob => {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                        const base64data = reader.result;
                                        const directBase64 = base64data.split(',')[1];
                                        if (window.opener) {
                                            window.opener.postMessage({ type: 'GEMINI_VIDEO_RESULT', payload: directBase64 }, '*');
                                            setTimeout(() => window.close(), 3000);
                                        }
                                    };


                                    reader.readAsDataURL(blob);
                                })
                                .catch(e => console.error("❌ [Auto-Pilot] Direct fetch also failed:", e));
                        }
                    });
                }
            }, 2000);
        };

        const runGenAutomation = () => {
            if (hasClickedGenerate) return;

            const params = new URLSearchParams(window.location.search);
            const prompt = params.get('prompt');

            if (prompt) {
                console.log("📝 Found prompt in URL, attempting to inject...");

                // 1. Find Textarea
                const textarea = document.querySelector('textarea') ||
                    document.querySelector('input[type="text"][placeholder*="Describe"]');

                if (textarea) {
                    // Only fill if empty or different (to avoid fighting user/site)
                    if (textarea.value !== prompt) {
                        textarea.value = prompt;
                        textarea.dispatchEvent(new Event('input', { bubbles: true }));
                        textarea.dispatchEvent(new Event('change', { bubbles: true }));
                        // Simulate a keypress to wake up any listeners
                        textarea.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, bubbles: true }));
                        textarea.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space', keyCode: 32, bubbles: true }));
                        console.log("✅ Prompt injected into textarea.");
                    }

                    // Wait a moment for the UI to update (enable button)
                    setTimeout(() => {
                        // 2. Find and Click Generate Button
                        // Strategy 1: Contextual Search (Button next to textarea)
                        let generateBtn = null;
                        if (textarea.parentElement) {
                            const siblings = Array.from(textarea.parentElement.querySelectorAll('button, div[role="button"]'));
                            generateBtn = siblings.find(b => !b.disabled && (b.querySelector('svg') || b.innerText.trim().length === 0));
                        }

                        // Strategy 2: Global Search for "Generate" or "Send"
                        if (!generateBtn) {
                            const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
                            generateBtn = buttons.find(b => {
                                const label = (b.getAttribute('aria-label') || b.innerText || '').toLowerCase();
                                const isAriaDisabled = b.getAttribute('aria-disabled') === 'true';
                                return (label.includes('generate') || label.includes('send') || label.includes('create')) && !b.disabled && !isAriaDisabled;
                            });
                        }

                        // Strategy 3: Any button with type="submit"
                        if (!generateBtn) {
                            generateBtn = document.querySelector('button[type="submit"]');
                        }

                        // Strategy 4: Fallback to ANY button with an SVG (likely an icon button)
                        if (!generateBtn) {
                            const allButtons = Array.from(document.querySelectorAll('button'));
                            // Filter for buttons that look like icon buttons (small, contain svg, no text)
                            generateBtn = allButtons.find(b => b.querySelector('svg') && b.innerText.trim().length === 0 && !b.disabled && b.getAttribute('aria-disabled') !== 'true');
                        }

                        if (generateBtn) {
                            console.log("🚀 Generate button found!", generateBtn);

                            // Visual Feedback: Highlight the button
                            generateBtn.style.border = "3px solid red";
                            generateBtn.style.boxShadow = "0 0 10px red";

                            // Strategy: Aggressive Click Sequence
                            const triggerClick = (element) => {
                                const eventOptions = { bubbles: true, cancelable: true, view: window, buttons: 1 };
                                element.dispatchEvent(new PointerEvent('pointerdown', eventOptions));
                                element.dispatchEvent(new MouseEvent('mousedown', eventOptions));
                                element.dispatchEvent(new PointerEvent('pointerup', eventOptions));
                                element.dispatchEvent(new MouseEvent('mouseup', eventOptions));
                                element.click();
                            };

                            // 1. Click the button itself
                            triggerClick(generateBtn);

                            // 2. Click the inner SVG/Icon if present (sometimes the listener is on the icon)
                            const innerIcon = generateBtn.querySelector('svg, path, span');
                            if (innerIcon) {
                                console.log("👉 Also clicking inner icon...", innerIcon);
                                triggerClick(innerIcon);
                            }

                            hasClickedGenerate = true;
                            monitorResult(); // Start monitoring explicitly after click

                            // Retry Logic: If prompt is still there after 3 seconds, assume click failed and retry
                            setTimeout(() => {
                                if (textarea && textarea.value === prompt) {
                                    console.warn("⚠️ Prompt still present after click. Retrying...");
                                    hasClickedGenerate = false;
                                }
                            }, 3000);

                        } else {
                            console.log("⚠️ Generate button not found. Attempting ENTER key simulation...");
                            // Strategy 5: Simulate ENTER key on textarea
                            textarea.focus();
                            const enterEvent = new KeyboardEvent('keydown', {
                                bubbles: true, cancelable: true, keyCode: 13, key: 'Enter', code: 'Enter'
                            });
                            textarea.dispatchEvent(enterEvent);

                            // Also try keyup
                            const enterUp = new KeyboardEvent('keyup', {
                                bubbles: true, cancelable: true, keyCode: 13, key: 'Enter', code: 'Enter'
                            });
                            textarea.dispatchEvent(enterUp);

                            // Retry logic for Enter key as well
                            hasClickedGenerate = true;
                            monitorResult(); // Start monitoring

                            setTimeout(() => {
                                if (textarea.value === prompt) {
                                    hasClickedGenerate = false;
                                }
                            }, 3000);
                        }
                    }, 2000); // Increased delay to 2000ms to ensure button is ready

                } else {
                    // Retry if textarea not found yet
                    setTimeout(runGenAutomation, 1000);
                }
            }
        };

        // Start automation
        runGenAutomation();
        // Also start monitoring immediately in case the video is already there (e.g. reload)
        monitorResult();
    }

    // --- 4. LMArena Specific Logic (ONLY runs on lmarena.ai) ---
    else if (hostname.includes('lmarena.ai')) {
        console.log("🧠 [LMArena Ext] Detected LMArena - Checking for pending prompts...");

        const startResponseMonitoring = () => {
            console.log("👀 [LMArena] Starting Response Monitoring... (Enhanced v2.1)");
            let stabilityCount = 0;
            let lastTextLength = 0;
            let attempts = 0;
            let foundResponse = false;

            const monitorInterval = setInterval(() => {
                attempts++;
                let capturedText = null;
                let sourceElement = null;

                // === STRATEGY 1: Code/Pre Block Search (Primary) ===
                const codeBlocks = Array.from(document.querySelectorAll('code, pre'));

                // RELAXED Filter: Accept ANY block that looks like our JSON
                const candidateBlock = codeBlocks.reverse().find(block => {
                    const text = block.innerText || '';
                    const hasSchedule = text.includes('"schedule"') || text.includes("'schedule'") || text.includes('schedule:');
                    const hasPillar = text.includes('"pillar"') || text.includes("'pillar'") || text.includes('pillar:');
                    const hasArray = text.includes('[') && text.includes(']');

                    // Anti-Hallucination: Ignore schema placeholders
                    const isPlaceholder = text.includes('"pillar": "string"') ||
                        text.includes('"type": "string"') ||
                        text.includes('"algorithmStage": "string"');

                    return (hasSchedule || hasPillar) && hasArray && text.length > 100 && !isPlaceholder;
                });

                if (candidateBlock) {
                    capturedText = candidateBlock.innerText;
                    sourceElement = candidateBlock;
                    console.log(`✨ Found candidate via CODE block (Length: ${capturedText.length})`);

                    // Visual Feedback (Yellow while monitoring)
                    candidateBlock.style.border = "2px solid #fbbf24";
                }
                // === STRATEGY 2: Full Page Text Search (Fallback with Smart Extraction) ===
                if (!capturedText && attempts > 5) {
                    const bodyText = document.body.innerText;

                    // 1. Find the keyword "schedule" OR "pillar" - Search from BOTTOM
                    let keywordIndex = bodyText.lastIndexOf('"schedule"');
                    let matchedKeyword = 'schedule';

                    if (keywordIndex === -1) {
                        keywordIndex = bodyText.lastIndexOf('"pillar"');
                        matchedKeyword = 'pillar';
                    }

                    if (keywordIndex !== -1) {
                        // Iterative Search: Walk backwards to find the enclosing structure
                        let searchCursor = keywordIndex;
                        let bestCandidate = null;
                        let loops = 0;

                        // Helper: Robust JSON Extractor (State Machine)
                        const extractJSON = (text, start) => {
                            let balance = 0;
                            let inString = false;
                            let escaped = false;
                            const startChar = text[start];
                            const endChar = startChar === '{' ? '}' : ']';

                            for (let i = start; i < text.length; i++) {
                                const char = text[i];

                                if (inString) {
                                    if (escaped) {
                                        escaped = false;
                                    } else if (char === '\\') {
                                        escaped = true;
                                    } else if (char === '"') {
                                        inString = false;
                                    }
                                } else {
                                    if (char === '"') {
                                        inString = true;
                                    } else if (char === startChar) {
                                        balance++;
                                    } else if (char === endChar) {
                                        balance--;
                                        if (balance === 0) {
                                            return text.substring(start, i + 1);
                                        }
                                    }
                                }
                            }
                            return null;
                        };

                        while (searchCursor >= 0 && loops < 5000) { // Drastically increased loop limit for long lists
                            loops++;

                            // Find nearest brackets before cursor
                            const lastBrace = bodyText.lastIndexOf('{', searchCursor);
                            const lastBracket = bodyText.lastIndexOf('[', searchCursor);

                            let startIndex = -1;

                            // Determine which one is the current candidate
                            if (lastBrace === -1 && lastBracket === -1) break; // Nothing left

                            if (lastBrace > lastBracket) startIndex = lastBrace;
                            else startIndex = lastBracket;

                            // Extract using Robust Parser
                            if (startIndex !== -1) {
                                const extracted = extractJSON(bodyText, startIndex);

                                if (extracted) {
                                    // CRITICAL: The block MUST contain the keyword we found!
                                    if (extracted.includes(matchedKeyword)) {
                                        const isPlaceholder = extracted.includes('"pillar": "string"');
                                        if (!isPlaceholder && extracted.length > 100) {
                                            if (bodyText[startIndex] === '[') {
                                                bestCandidate = extracted;
                                                break; // Found the Holy Grail (Outer Array), stop searching.
                                            } else {
                                                if (!bestCandidate) bestCandidate = extracted;
                                            }
                                        }
                                    }
                                }

                                // Continue search backwards
                                searchCursor = startIndex - 1;
                            }
                        }

                        if (bestCandidate) {
                            capturedText = bestCandidate;
                            console.log(`✨ Found candidate via ROBUST STATE MACHINE (Length: ${capturedText.length})`);
                        }
                    }
                }

                // === STABILITY CHECK ===
                if (capturedText) {
                    if (capturedText.length === lastTextLength && capturedText.length > 50) {
                        stabilityCount++;
                        console.log(`⏱️ Stability check: ${stabilityCount}/3 (Length: ${capturedText.length})`);
                    } else {
                        stabilityCount = 0;
                        lastTextLength = capturedText.length;
                    }

                    // === SEND RESPONSE (Stable for 3 seconds) ===
                    if (stabilityCount >= 3 && !foundResponse) {
                        foundResponse = true;
                        console.log("✅ [LMArena] Response captured and STABLE!");
                        clearInterval(monitorInterval);

                        // Visual Feedback (Green = Success)
                        if (sourceElement) {
                            sourceElement.style.border = "3px solid #4ade80";
                            sourceElement.style.boxShadow = "0 0 20px rgba(74, 222, 128, 0.5)";
                        }

                        // Send to Background
                        console.log("📤 Sending to background...", capturedText.substring(0, 200) + "...");
                        chrome.runtime.sendMessage({
                            action: 'relayLMArenaResponse',
                            data: capturedText
                        }, (res) => {
                            if (chrome.runtime.lastError) {
                                console.error("❌ Failed to relay:", chrome.runtime.lastError.message);
                            } else {
                                console.log("✅ Response relayed to background:", res);
                            }
                        });
                    }
                } else {
                    if (attempts % 5 === 0) {
                        console.log(`⏳ Still waiting... (${attempts}s elapsed)`);
                    }
                }
            }, 1000);

            // Timeout after 120s (2 minutes)
            setTimeout(() => {
                if (!foundResponse) {
                    clearInterval(monitorInterval);
                    console.log("⏱️ [LMArena] Monitoring timed out after 120s.");
                }
            }, 120000);
        };

        const runLMArenaAutomation = () => {
            chrome.storage.local.get(['pendingLMArenaPrompt'], (result) => {
                if (result.pendingLMArenaPrompt) {
                    console.log("📝 Found pending prompt! Injecting...");
                    const prompt = result.pendingLMArenaPrompt;

                    // Try to find the input box (it's usually a textarea)
                    const inputBox = document.querySelector('textarea[placeholder*="Type a message"]') ||
                        document.querySelector('textarea[data-testid="chat-input"]') ||
                        document.querySelector('#chat-input') ||
                        document.querySelector('textarea');

                    if (inputBox) {
                        // Focus and simulate typing
                        inputBox.focus();
                        inputBox.value = prompt;

                        // Dispatch multiple events to ensure React/Frameworks pick it up
                        inputBox.dispatchEvent(new Event('input', { bubbles: true }));
                        inputBox.dispatchEvent(new Event('change', { bubbles: true }));

                        // Simulate a key press (like space) to wake up the UI
                        inputBox.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
                        inputBox.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true }));

                        // Wait a bit for the UI to update
                        setTimeout(() => {
                            console.log("🔍 Searching for Send button (V2 Logic)...");
                            let sendBtn = null;

                            // Strategy 1: Specific Selectors
                            sendBtn = document.querySelector('button[data-testid="send-button"]') ||
                                document.querySelector('button[aria-label="Send message"]') ||
                                document.querySelector('button.send-button');

                            // Strategy 2: Heuristic Search
                            if (!sendBtn && inputBox) {
                                let parent = inputBox.parentElement;
                                for (let i = 0; i < 5; i++) {
                                    if (parent) {
                                        const buttons = Array.from(parent.querySelectorAll('button'));
                                        const candidates = buttons.filter(b => {
                                            const isVisible = !b.disabled && b.offsetParent !== null;
                                            const label = (b.getAttribute('aria-label') || '').toLowerCase();
                                            const isAddButton = label.includes('add') || label.includes('file') || label.includes('upload') || label.includes('attach') || label.includes('image');
                                            const hasIcon = b.querySelector('svg') !== null || b.querySelector('i') !== null;
                                            return isVisible && !isAddButton;
                                        });

                                        if (candidates.length > 0) {
                                            const explicitSend = candidates.find(b => {
                                                const label = (b.getAttribute('aria-label') || '').toLowerCase();
                                                return label.includes('send') || label.includes('submit');
                                            });
                                            sendBtn = explicitSend || candidates[candidates.length - 1];
                                            break;
                                        }
                                        parent = parent.parentElement;
                                    }
                                }
                            }

                            if (sendBtn) {
                                console.log("🚀 Clicking send button:", sendBtn);
                                sendBtn.click();

                                // Clear prompt and START MONITORING
                                chrome.storage.local.remove(['pendingLMArenaPrompt'], () => {
                                    console.log("✅ Prompt submitted. Starting response monitor.");
                                    startResponseMonitoring();
                                });
                            } else {
                                console.warn("❌ Send button not found.");
                            }
                        }, 2000);
                    } else {
                        console.warn("⚠️ Input box not found!");
                    }
                }
            });
        };

        // Check every second for a few seconds after load
        const checkInterval = setInterval(runLMArenaAutomation, 1000);
        setTimeout(() => clearInterval(checkInterval), 15000);
    }

})();

// GeminiGen Native Auto-Pilot (v4.10 - ULTIMATE FUSION: All Features + Robust Scheduling)
console.log(`🚀 [Native Extension] Loaded & Ready! (Version: v4.10 - ${new Date().toLocaleTimeString()})`);

(function () {
    if (window.__GEMINI_EXT_LOADED) return;
    window.__GEMINI_EXT_LOADED = true;

    const hostname = window.location.hostname;
    console.log(`📍 [Native Extension] Current Hostname: "${hostname}"`);

    // ==========================================================================
    // 🛠️ 核心工具库 (CORE UTILS)
    // ==========================================================================

    // 1. Shadow DOM 穿透查找器 (单元素)
    const deepQuery = (root, selector) => {
        if (!root) return null;
        let res = root.querySelector ? root.querySelector(selector) : null;
        if (res) return res;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
        let node;
        while (node = walker.nextNode()) {
            if (node.shadowRoot) {
                res = deepQuery(node.shadowRoot, selector);
                if (res) return res;
            }
        }
        return null;
    };

    // 2. Shadow DOM 穿透查找器 (多元素)
    const deepQueryAll = (root, selector) => {
        let results = [];
        if (!root) return results;
        if (root.querySelectorAll) results = [...results, ...Array.from(root.querySelectorAll(selector))];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
        let node;
        while (node = walker.nextNode()) {
            if (node.shadowRoot) {
                results = [...results, ...deepQueryAll(node.shadowRoot, selector)];
            }
        }
        return results;
    };

    // 3. 文本查找器
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

    // 4. 智能日期解析器
    const parseFlexibleDate = (input) => {
        if (!input) return null;
        let date = new Date(input);
        if (!isNaN(date.getTime())) return date;
        if (typeof input === 'string') {
            const isoLike = input.replace(' ', 'T');
            date = new Date(isoLike);
            if (!isNaN(date.getTime())) return date;
            const parts = input.match(/\d+/g);
            if (parts && parts.length >= 3) {
                const y = parseInt(parts[0]);
                const m = parseInt(parts[1]) - 1;
                const d = parseInt(parts[2]);
                const h = parts.length > 3 ? parseInt(parts[3]) : 0;
                const min = parts.length > 4 ? parseInt(parts[4]) : 0;
                date = new Date(y, m, d, h, min);
                if (!isNaN(date.getTime())) return date;
            }
        }
        return null;
    };

    // 5. 强力输入模拟器 (新增: 确保数据被 Polymer 框架捕获)
    const simulateInput = (inputElement, value) => {
        if (!inputElement) return;
        inputElement.focus();

        // Handle contenteditable (YouTube Title/Description divs)
        if (inputElement.getAttribute('contenteditable') === 'true' || inputElement.tagName === 'DIV') {
            // Use execCommand for robust text insertion in rich text editors
            // This mimics user typing much better than setting innerText
            try {
                // Ensure we don't append if we meant to replace (caller should have cleared it, but just in case)
                if (!document.execCommand('insertText', false, value)) {
                    // Fallback if insertText fails
                    inputElement.textContent = value;
                }
            } catch (e) {
                inputElement.textContent = value;
            }
        } else {
            // Standard input/textarea
            // React 16+ hack to ensure onChange is triggered
            try {
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                if (nativeInputValueSetter) {
                    nativeInputValueSetter.call(inputElement, value);
                } else {
                    inputElement.value = value;
                }
            } catch (e) {
                // Fallback if nativeInputValueSetter fails (Illegal invocation)
                console.log("ℹ️ nativeInputValueSetter fallback triggered (non-fatal):", e);
                inputElement.value = value;
            }
        }

        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));

        try {
            const evt = document.createEvent('TextEvent');
            evt.initTextEvent('textInput', true, true, window, value);
            inputElement.dispatchEvent(evt);
        } catch (e) { }

        inputElement.blur();
    };

    // 6. 扩展通信辅助
    const showReloadOverlay = () => {
        if (document.getElementById('gemini-reload-overlay')) return;
        const div = document.createElement('div');
        div.id = 'gemini-reload-overlay';
        div.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); z-index: 99999; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; font-family: sans-serif; text-align: center; pointer-events: all;';
        div.innerHTML = `<h1 style="font-size:30px;margin-bottom:20px">Extension Updated</h1><button onclick="window.location.reload()" style="padding:15px 30px;font-size:18px;cursor:pointer">Refresh Page</button>`;
        document.body.appendChild(div);
    };

    // 7. 安全消息发送 (Safe Send Message)
    const safeSendMessage = (message, callback) => {
        if (chrome.runtime?.id) {
            try {
                chrome.runtime.sendMessage(message, (response) => {
                    const lastError = chrome.runtime.lastError;
                    if (lastError) {
                        console.warn("Extension communication error:", lastError.message);
                    }
                    if (callback) callback(response);
                });
            } catch (e) {
                console.warn("Extension context invalidated. Please reload the page.");
            }
        } else {
            console.warn("Extension context missing. Please reload the page.");
        }
    };

    const downloadVideo = (url) => {
        safeSendMessage({ action: "downloadVideo", url }, (res) => {
            if (res?.success) {
                const a = document.createElement('a');
                a.href = "data:video/mp4;base64," + res.data;
                a.download = `gemini_video_${Date.now()}.mp4`;
                a.click();
            } else {
                fetch(url).then(r => r.blob()).then(b => {
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(b);
                    a.download = `gemini_video_${Date.now()}.mp4`;
                    a.click();
                });
            }
        });
    };

    // ==========================================================================
    // 📡 消息监听 (MESSAGE LISTENERS)
    // ==========================================================================
    window.addEventListener('message', (event) => {
        if (!event.data || event.data.source === 'react-devtools-bridge') return;

        // YouTube Upload Request
        if (event.data.type === 'PREPARE_YOUTUBE_UPLOAD') {
            console.log("📦 [Upload] Received Data. ID:", event.data.payload.id);
            // Store in localStorage as backup (Only if small enough)
            try {
                const jsonStr = JSON.stringify(event.data.payload);
                if (jsonStr.length < 4500000) { // ~4.5MB safety limit
                    localStorage.setItem('__YOUTUBE_UPLOAD_DATA__', jsonStr);
                    console.log("✅ [Upload] Data saved to localStorage backup");
                } else {
                    console.log(`ℹ️ [Upload] Video too large for localStorage (${(jsonStr.length / 1024 / 1024).toFixed(2)} MB). Using Background Storage only.`);
                }
            } catch (e) {
                console.warn("⚠️ [Upload] localStorage backup skipped:", e);
            }
            // Also try to store via extension
            safeSendMessage({ action: 'storeVideoData', data: event.data.payload }, () => {
                if (event.source) event.source.postMessage({ type: 'YOUTUBE_DATA_SAVED' }, '*');
            });
        }

        // Analytics Request
        // Analytics Request
        if (event.data.type === 'REQUEST_YOUTUBE_ANALYTICS') {
            console.log("📨 [Content] Received REQUEST_YOUTUBE_ANALYTICS from Window");
            if (hostname === 'studio.youtube.com') {
                runAnalyticsAgent(event.data.payload);
            } else {
                console.log("📤 [Content] Relaying to Background...");
                safeSendMessage({ action: 'relayAnalyticsRequest', payload: event.data.payload }, (response) => {
                    console.log("✅ [Content] Relay response:", response);
                });
            }
        }

        // Open Tab
        if (event.data.type === 'OPEN_YOUTUBE_UPLOAD_TAB') {
            safeSendMessage({ action: 'openTab', url: event.data.url });
        }

        // LMArena Prompt Store
        if (event.data.type === 'STORE_LMARENA_PROMPT') {
            try { safeSendMessage({ action: 'storeLMArenaPrompt', prompt: event.data.payload.prompt }); } catch (e) { }
        }

        // Log Intercept
        if (event.data.type === 'GEMINI_LOG_INTERCEPT') {
            const videoUrl = event.data.payload.url;
            if (videoUrl && !window._hasDownloadedVideo) {
                window._hasDownloadedVideo = true;
                downloadVideo(videoUrl);
            }
        }
    });

    // Only register runtime message listener if chrome.runtime is available
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((message) => {
            console.log("📨 [Content] Runtime Message Received:", message);
            // Handle Analytics Request (Standard)
            if (message.type === 'REQUEST_YOUTUBE_ANALYTICS' && hostname === 'studio.youtube.com') {
                console.log("📨 [Content] Received Analytics Request via Runtime");
                // Use window.runAnalyticsAgent from youtube-analytics.js
                if (typeof window.runAnalyticsAgent === 'function') {
                    window.runAnalyticsAgent(message.payload);
                } else {
                    console.warn("⚠️ [Content] runAnalyticsAgent not yet available, retrying...");
                    setTimeout(() => {
                        if (typeof window.runAnalyticsAgent === 'function') {
                            window.runAnalyticsAgent(message.payload);
                        } else {
                            console.error("❌ [Content] runAnalyticsAgent still not available!");
                        }
                    }, 1000);
                }
            }

            if (message.action === 'executeAnalytics' && hostname === 'studio.youtube.com') {
                if (typeof window.runAnalyticsAgent === 'function') {
                    window.runAnalyticsAgent(message.payload);
                }
            }
            if (message.type === 'YOUTUBE_ANALYTICS_RESULT' ||
                message.type === 'YOUTUBE_UPLOAD_COMPLETE' ||
                message.type === 'LMARENA_RESPONSE_RESULT') {
                window.postMessage(message, '*');
            }
        });
        console.log("✅ [Content] Runtime message listener registered for:", hostname);
    } else {
        console.warn("⚠️ [Content] chrome.runtime not available, skipping listener");
    }

    // ==========================================================================
    // 🧩 模块 1: YOUTUBE STUDIO AUTOMATION (All Features)
    // ==========================================================================
    const runAnalyticsAgent = async (payload) => {
        console.log("🕵️‍♂️ [Analytics Agent] Starting...");
        const findAskButton = () => {
            const buttons = Array.from(document.querySelectorAll('ytcp-icon-button, button'));
            return buttons.find(b => {
                const label = (b.getAttribute('aria-label') || '').toLowerCase();
                return label.includes('ask') || label.includes('analytics assistant');
            }) || document.querySelector('#analytics-assistant-button');
        };

        let askBtn = findAskButton() || deepQuery(document.body, '[aria-label="Ask YouTube Studio"]');
        if (askBtn) {
            askBtn.click();
            await new Promise(r => setTimeout(r, 1500));

            // 🚀 OPTIMIZED YPP PROMPTS PER CATEGORY
            let query = payload.customQuery;
            if (!query) {
                const now = new Date();
                const timeStr = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
                const dateStr = `${now.getMonth() + 1}/${now.getDate()}`;
                const timeContext = `从昨天到现在(GMT+8 ${timeStr} ${dateStr})`;

                switch (payload.category) {
                    case 'channelOverview':
                        query = `给我列出${timeContext}频道的总 Views, 新增 Subscribers, 和平均 AVP。算法判断：基于流量趋势，频道目前处于上升期还是平稳期？`;
                        break;
                    case 'videoPerformance':
                        query = `列出${timeContext}表现最好的 5 个视频，分别给出 Views, AWD, 和 Like Rate。算法判断：哪些视频触发了算法推荐机制？`;
                        break;
                    case 'audience':
                        query = `分析${timeContext}观众的活跃时间段和主要来源地区。算法建议：为了最大化 YPP 转化，我应该在什么时间发布下一个视频？`;
                        break;
                    case 'traffic':
                        query = `列出${timeContext}流量来源占比 (Shorts Feed vs Search vs Browse)。算法判断：Shorts Feed 的流量是否健康？`;
                        break;
                    case 'engagement':
                        query = `统计${timeContext}的总 Likes, Comments, 和 Shares。算法判断：当前的互动率是否足以支撑视频进入下一个流量池？`;
                        break;
                    case 'comments':
                        query = `分析${timeContext}评论区的情感倾向和高频关键词。算法建议：我应该回复哪些评论以最大化观众粘性（提升 Session Time）？`;
                        break;
                    case 'yppSprint':
                    default:
                        query = `给我列出${timeContext}的 所有视频Views, AWD, 0-3s Hook, Source。 算法阶段判断： 基于 AWD 和 Views，给出算法当前处于的阶段。`;
                        break;
                }
            }
            const inputField = deepQuery(document.body, 'ytcp-omnibox input') || document.querySelector('input[placeholder*="Ask"]');

            if (inputField) {
                simulateInput(inputField, query);
                inputField.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));

                let attempts = 0;
                const checkResponse = setInterval(() => {
                    attempts++;
                    const responses = deepQueryAll(document.body, 'ytcp-chat-bubble[is-bot]');
                    const lastResponse = responses[responses.length - 1];
                    if (lastResponse && lastResponse.innerText.length > 10 && !lastResponse.hasAttribute('generating')) {
                        clearInterval(checkResponse);
                        safeSendMessage({
                            action: 'relayAnalyticsResult',
                            data: {
                                category: payload.category,
                                results: [{ success: true, question: query, response: lastResponse.innerText, timestamp: Date.now() }],
                                successCount: 1,
                                totalCount: 1
                            },
                            category: payload.category
                        });
                        console.log("✅ [Analytics] Data sent to background relay");
                    } else if (attempts > 30) clearInterval(checkResponse);
                }, 1000);
            }
        }
    };

    if (hostname.endsWith('youtube.com')) {
        if (window.location.href.includes('/upload')) {
            // 🛑 SKIP UPLOAD LOGIC IF IN ANALYTICS MODE
            if (window.location.href.includes('gemini_action=')) {
                console.log("📊 [Content] Analytics Mode detected. Skipping Upload initialization.");
                return;
            }

            // --- 📅 Advanced Date Picker Helpers (Ported from UserScript) ---
            const datePickerHelpers = {
                scanDates: (root) => {
                    const dateCells = [];
                    const els = root.querySelectorAll('*');
                    for (let j = 0; j < els.length; j++) {
                        const el = els[j];
                        const text = el.textContent.trim();
                        const rect = el.getBoundingClientRect();
                        const isDay = /^([1-9]|[12][0-9]|3[01])$/.test(text);
                        const goodSize = rect.width > 20 && rect.width < 60 && rect.height > 20 && rect.height < 60;
                        const isLeaf = el.children.length < 3;
                        if (isDay && goodSize && isLeaf) {
                            dateCells.push({ el: el, day: parseInt(text) });
                        }
                    }
                    // Deduplicate
                    const unique = [];
                    const seen = {};
                    for (let k = 0; k < dateCells.length; k++) {
                        const d = dateCells[k].day;
                        if (!seen[d]) {
                            seen[d] = true;
                            unique.push(dateCells[k]);
                        }
                    }
                    return unique;
                },
                getNavButtons: (root) => {
                    const buttons = root.querySelectorAll('ytcp-button, tp-yt-paper-icon-button, [role="button"]');
                    const nav = { prev: null, next: null };
                    for (let i = 0; i < buttons.length; i++) {
                        const btn = buttons[i];
                        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
                        if (label.includes('previous')) nav.prev = btn;
                        if (label.includes('next')) nav.next = btn;
                    }
                    return nav;
                }
            };

            const runYouTubeUpload = () => {
                const processUpload = async (data) => {
                    console.log("🚀 Starting Upload for:", data.title);

                    // File Upload Logic
                    let base64String = data.videoData;
                    if (base64String.startsWith('data:')) base64String = base64String.split(',')[1];
                    const byteCharacters = atob(base64String);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
                    const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'video/mp4' });
                    const file = new File([blob], data.fileName || "video.mp4", { type: 'video/mp4' });

                    let uploadInput = document.querySelector('input[type="file"]');
                    if (!uploadInput) {
                        let createBtn = deepQuery(document.body, '#create-icon') || deepQuery(document.body, '[aria-label="Create"]');
                        if (createBtn) {
                            createBtn.click();
                            await new Promise(r => setTimeout(r, 1000));
                            const menuItems = deepQueryAll(document.body, 'tp-yt-paper-item');
                            const uploadOption = menuItems.find(el => el.textContent.toLowerCase().includes('upload videos'));
                            if (uploadOption) { uploadOption.click(); await new Promise(r => setTimeout(r, 2000)); }
                        }
                        uploadInput = document.querySelector('input[type="file"]');
                    }
                    if (uploadInput) {
                        const dt = new DataTransfer(); dt.items.add(file);
                        uploadInput.files = dt.files;
                        uploadInput.dispatchEvent(new Event('change', { bubbles: true }));
                        uploadInput.dispatchEvent(new Event('input', { bubbles: true }));
                    } else { console.error("❌ Upload input not found"); return; }

                    const waitFor = (selector, timeout = 30000) => {
                        return new Promise((resolve) => {
                            const i = setInterval(() => {
                                const el = document.querySelector(selector);
                                if (el) { clearInterval(i); resolve(el); }
                            }, 1000);
                            setTimeout(() => { clearInterval(i); resolve(null); }, timeout);
                        });
                    };

                    // Metadata (Enhanced with multiple attempts)
                    console.log("📝 [Upload] Filling Title:", data.title);
                    console.log("📝 [Upload] Filling Description:", data.description);

                    // Title - Try multiple selectors and clear existing value
                    let titleBox = await waitFor('#textbox[aria-label*="title"]', 15000);
                    if (!titleBox) titleBox = await waitFor('[aria-label*="Title"]', 5000);
                    if (!titleBox) titleBox = await waitFor('#title-textarea #textbox', 5000);
                    if (titleBox) {
                        titleBox.focus();
                        // Fix: Use execCommand for contenteditable divs (YouTube uses divs, not inputs)
                        document.execCommand('selectAll', false, null);
                        document.execCommand('delete', false, null);
                        await new Promise(r => setTimeout(r, 200));
                        simulateInput(titleBox, data.title);
                        console.log("✅ [Upload] Title filled");
                    } else {
                        console.error("❌ [Upload] Title box not found!");
                    }

                    // Description
                    const descBox = await waitFor('#description-textarea #textbox', 5000);
                    if (!descBox) descBox = await waitFor('[aria-label*="Description"]', 5000);
                    if (descBox) {
                        descBox.focus();
                        simulateInput(descBox, data.description);
                        console.log("✅ [Upload] Description filled");
                    } else {
                        console.error("❌ [Upload] Description box not found!");
                    }

                    // Playlists
                    try {
                        const playlistSection = document.querySelector('ytcp-video-metadata-playlists');
                        if (playlistSection) {
                            const trigger = deepQuery(playlistSection, '.ytcp-text-dropdown-trigger') || deepQuery(playlistSection, '#trigger');
                            if (trigger) {
                                trigger.click();
                                await new Promise(r => setTimeout(r, 2000));
                                const targetPlaylists = data.playlists || ["Case Studies"];
                                const dialog = document.querySelector('ytcp-playlist-dialog');
                                for (const target of targetPlaylists) {
                                    const searchRoot = dialog || document.body;
                                    let labelEl = findElementByTextDeep(searchRoot, target);
                                    if (!labelEl) {
                                        const labels = deepQueryAll(searchRoot, 'label');
                                        labelEl = labels.find(l => l.textContent.toLowerCase().includes(target.toLowerCase()));
                                    }
                                    if (labelEl) { labelEl.click(); await new Promise(r => setTimeout(r, 500)); }
                                }
                                const doneBtn = deepQuery(document.body, '#done-button');
                                if (doneBtn) doneBtn.click();
                            }
                        }
                    } catch (e) { }

                    // Audience
                    try {
                        await new Promise(r => setTimeout(r, 1000));
                        const notForKids = deepQuery(document.body, 'tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]');
                        if (notForKids) notForKids.click();
                    } catch (e) { }

                    // --- ADVANCED SETTINGS ---
                    console.log("⚙️ [Upload] Handling Advanced Settings...");

                    // 1. Click "Show More"
                    try {
                        let toggleBtn = document.querySelector('#toggle-button');
                        if (!toggleBtn) {
                            const buttons = Array.from(document.querySelectorAll('div.label'));
                            toggleBtn = buttons.find(b => b.textContent.trim() === 'Show more');
                        }

                        if (toggleBtn) {
                            console.log("🔽 Clicking 'Show more'...");
                            toggleBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            toggleBtn.click();
                            await new Promise(r => setTimeout(r, 2000));
                        } else {
                            console.warn("⚠️ 'Show more' button not found");
                        }
                    } catch (e) { console.warn("⚠️ Error clicking Show more:", e); }

                    // 2. Altered Content -> Yes
                    try {
                        console.log("🤖 Setting Altered Content to YES...");

                        // Wait a bit for section to be visible
                        await new Promise(r => setTimeout(r, 1000));

                        // Strategy: Find the container first
                        // Retry finding the element for up to 5 seconds
                        let alteredSection = null;
                        for (let i = 0; i < 10; i++) {
                            alteredSection = document.querySelector('ytcp-altered-content-select');
                            if (alteredSection) break;
                            await new Promise(r => setTimeout(r, 500));
                        }

                        if (alteredSection) {
                            // Try to find the radio button within this section
                            // It might be a tp-yt-paper-radio-button
                            const radios = Array.from(alteredSection.querySelectorAll('tp-yt-paper-radio-button'));
                            let targetRadio = null;

                            for (let radio of radios) {
                                // Check for name attribute
                                if (radio.getAttribute('name') === 'ALTERED_CONTENT_YES') {
                                    targetRadio = radio;
                                    break;
                                }
                                // Check for text content
                                const text = radio.textContent.trim();
                                if (text === 'Yes' || text === '是') {
                                    targetRadio = radio;
                                    break;
                                }
                            }

                            if (targetRadio) {
                                console.log("🎯 Found Yes Radio:", targetRadio);
                                targetRadio.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                targetRadio.click();
                                console.log("✅ Altered Content set to YES");
                            } else {
                                console.warn("⚠️ Radio button not found inside ytcp-altered-content-select");
                                // Try clicking any element with text "Yes" inside the section
                                const allElements = alteredSection.querySelectorAll('*');
                                for (let el of allElements) {
                                    const text = el.textContent.trim();
                                    if (text === 'Yes' || text === '是') {
                                        el.click();
                                        console.log("✅ Clicked 'Yes' element as fallback");
                                        break;
                                    }
                                }
                            }
                        } else {
                            console.warn("⚠️ ytcp-altered-content-select not found");
                        }
                    } catch (e) { console.warn("⚠️ Error setting Altered Content:", e); }

                    // 3. Tags
                    if (data.tags && data.tags.length > 0) {
                        try {
                            console.log("🏷️ Setting Tags:", data.tags);
                            // Try multiple selectors for tags input
                            const tagInput = document.querySelector('input[aria-label="Tags"]') ||
                                document.querySelector('#tags-container input');

                            if (tagInput) {
                                tagInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                tagInput.focus();
                                const tagsString = data.tags.join(',');
                                simulateInput(tagInput, tagsString);
                                tagInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                                console.log("✅ Tags filled");
                            } else {
                                console.warn("⚠️ Tags input not found");
                            }
                        } catch (e) { console.warn("⚠️ Error setting Tags:", e); }
                    }

                    // 4. Language -> English (United States)
                    try {
                        console.log("🗣️ Setting Language...");
                        const languageSection = document.querySelector('ytcp-video-metadata-editor-advanced');
                        if (languageSection) {
                            const languageInputs = languageSection.querySelectorAll('ytcp-form-language-input');

                            for (let input of languageInputs) {
                                const dropdown = input.querySelector('ytcp-dropdown-trigger');
                                if (dropdown) {
                                    dropdown.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    dropdown.click();
                                    await new Promise(r => setTimeout(r, 1000));

                                    const options = document.querySelectorAll('tp-yt-paper-item');
                                    let found = false;
                                    for (let opt of options) {
                                        if (opt.textContent.includes('English (United States)')) {
                                            opt.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            opt.click();
                                            found = true;
                                            break;
                                        }
                                    }
                                    if (found) console.log("✅ Language set to English (US)");
                                    else document.body.click(); // Close dropdown
                                    await new Promise(r => setTimeout(r, 500));
                                }
                            }
                        }
                    } catch (e) { console.warn("⚠️ Error setting Language:", e); }

                    // --- WAIT FOR UPLOAD PROGRESS ---
                    console.log("⏳ Waiting for upload to initialize...");
                    for (let i = 0; i < 30; i++) {
                        const progressEl = document.querySelector('ytcp-video-upload-progress');
                        if (progressEl) {
                            const text = progressEl.textContent || "";
                            // "Uploading 0%" is the state we want to move PAST.
                            // Acceptable states: "Uploading 1%...", "Processing...", "Checks complete", "Upload complete"
                            if (text.includes('%') && !text.includes('0%')) {
                                console.log("✅ Upload progress detected:", text);
                                break;
                            }
                            if (text.includes('Processing') || text.includes('complete') || text.includes('Checks')) {
                                console.log("✅ Upload processing/complete detected:", text);
                                break;
                            }
                        }
                        await new Promise(r => setTimeout(r, 1000));
                    }

                    const nextBtn = deepQuery(document.body, '#next-button');
                    if (nextBtn) { nextBtn.click(); await new Promise(r => setTimeout(r, 1500)); }
                    if (nextBtn) { nextBtn.click(); await new Promise(r => setTimeout(r, 1500)); }
                    if (nextBtn) { nextBtn.click(); await new Promise(r => setTimeout(r, 1500)); }

                    // Check for video processing errors
                    await new Promise(r => setTimeout(r, 2000));
                    const errorMessages = document.querySelectorAll('[class*="error"], [class*="Error"], [class*="abandoned"]');
                    for (let msg of errorMessages) {
                        const text = msg.textContent;
                        if (text.includes('could not be processed') || text.includes('Processing abandoned') || text.includes('error')) {
                            console.error("❌ Video processing failed:", text);
                            throw new Error(`Video processing failed: ${text}`);
                        }
                    }

                    // --- 📅 ROBUST SCHEDULER \(v5\.0 - UserScript Logic\) ---
                    if (data.scheduleTime) {
                        try {
                            console.log("🕒 Scheduling (Advanced Logic)...");

                            // 1. Activate Schedule Radio (V3 - Context & Position Strategy)
                            console.log("🔍 Looking for Schedule button (V3)...");
                            let scheduleClicked = false;

                            // Strategy A: Click Schedule Header to Expand
                            const visSelect = document.querySelector('ytcp-video-visibility-select');
                            if (visSelect) {
                                // Look for the Schedule header/title
                                const scheduleHeaders = visSelect.querySelectorAll('*');
                                for (let el of scheduleHeaders) {
                                    const text = el.textContent.trim();

                                    // Find element with text exactly "Schedule" or contains "Schedule"
                                    if (text === 'Schedule' || (text.includes('Schedule') && text.length < 20)) {
                                        console.log("✅ Found Schedule Header:", el);

                                        // Click it to expand
                                        el.click();

                                        // Also try clicking parent
                                        if (el.parentElement) el.parentElement.click();

                                        scheduleClicked = true;
                                        break;
                                    }
                                }

                                // Fallback: Look for the description and click its parent
                                if (!scheduleClicked) {
                                    const allDivs = visSelect.querySelectorAll('div');
                                    for (let div of allDivs) {
                                        if (div.textContent.includes('Select a date to make your video public')) {
                                            console.log("✅ Found Schedule Description, clicking parent");

                                            // Click the parent container
                                            if (div.parentElement) div.parentElement.click();

                                            scheduleClicked = true;
                                            break;
                                        }
                                    }
                                }
                            }

                            // Strategy B: Click the 2nd Main Option (Position based)
                            if (!scheduleClicked) {
                                // Usually "Save or publish" is first, "Schedule" is second.
                                // They are often direct children of ytcp-video-visibility-select or a wrapper.
                                if (visSelect) {
                                    // Look for elements that look like headers/options
                                    // This is a heuristic: direct children divs or paper-radio-groups
                                    const directChildren = Array.from(visSelect.children).filter(el => el.tagName === 'DIV' || el.tagName.includes('PAPER'));
                                    if (directChildren.length >= 2) {
                                        console.log("✅ Clicking 2nd child of Visibility Select (Strategy B)");
                                        // The second child is likely the Schedule section
                                        const scheduleSection = directChildren[1];
                                        scheduleSection.click();
                                        // Also try clicking its first child (header)
                                        if (scheduleSection.firstElementChild) scheduleSection.firstElementChild.click();
                                        scheduleClicked = true;
                                    }
                                }
                            }

                            // Strategy C: Brute force "Schedule" text match (Relaxed)
                            if (!scheduleClicked) {
                                const allEls = document.querySelectorAll('ytcp-video-visibility-select div, ytcp-video-visibility-select span');
                                for (let el of allEls) {
                                    if (el.textContent.trim() === 'Schedule' && el.offsetParent) {
                                        console.log("✅ Found 'Schedule' text element (Strategy C)");
                                        el.click();
                                        scheduleClicked = true;
                                        break;
                                    }
                                }
                            }

                            if (scheduleClicked) {
                                await new Promise(r => setTimeout(r, 2000)); // Wait for expansion
                            } else {
                                console.error("❌ All Schedule strategies failed.");
                                // Don't throw immediately, let's see if the date picker is already visible
                            }

                            // 2. Parse Target Date (Handle separate date and time)
                            let dateObj = null;

                            // Check if we have separate date and time
                            if (data.scheduleDate && data.scheduleTime) {
                                // Combine them: "2025/12/02" + " " + "11:00 PM" = "2025/12/02 11:00 PM"
                                const combined = `${data.scheduleDate} ${data.scheduleTime}`;
                                console.log("📅 Combined schedule:", combined);
                                dateObj = parseFlexibleDate(combined);
                            } else if (data.scheduleTime) {
                                // Fallback: try to parse scheduleTime alone
                                dateObj = parseFlexibleDate(data.scheduleTime);
                            }

                            if (!dateObj) {
                                console.error("❌ Failed to parse date. scheduleDate:", data.scheduleDate, "scheduleTime:", data.scheduleTime);
                                throw new Error("Invalid Date format");
                            }

                            const targetDay = dateObj.getDate();
                            const timeStr = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); // "3:00 PM"

                            const now = new Date();
                            const monthOffset = (dateObj.getFullYear() - now.getFullYear()) * 12 + (dateObj.getMonth() - now.getMonth());

                            console.log(`📅 Target: Day ${targetDay}, Time ${timeStr}, MonthOffset ${monthOffset}`);

                            // 3. Set Date FIRST (to avoid being overwritten)
                            console.log("📅 Setting Date First (V10)...");

                            // Wait for Shadow DOM
                            await new Promise(r => setTimeout(r, 2000));

                            let picker = document.querySelector('ytcp-datetime-picker');

                            // Open Date Picker
                            let dateTrigger = null;
                            if (picker) {
                                const triggers = picker.querySelectorAll('ytcp-dropdown-trigger, ytcp-text-dropdown-trigger');
                                if (triggers.length > 0) dateTrigger = triggers[0];
                            }

                            if (dateTrigger) {
                                dateTrigger.click();
                                await new Promise(r => setTimeout(r, 1000));

                                // Handle Month Navigation
                                const calendarRoot = document.querySelector('ytcp-date-picker') || document.body;
                                const nav = datePickerHelpers.getNavButtons(calendarRoot);

                                if (monthOffset > 0 && nav.next) {
                                    for (let i = 0; i < monthOffset; i++) {
                                        nav.next.click();
                                        await new Promise(r => setTimeout(r, 500));
                                    }
                                } else if (monthOffset < 0 && nav.prev) {
                                    for (let i = 0; i < Math.abs(monthOffset); i++) {
                                        nav.prev.click();
                                        await new Promise(r => setTimeout(r, 500));
                                    }
                                }

                                // Find and Click Day
                                const dateCells = datePickerHelpers.scanDates(calendarRoot);
                                const targetCell = dateCells.find(c => c.day === targetDay);

                                if (targetCell) {
                                    targetCell.el.click();
                                    console.log(`✅ Selected Day: ${targetDay}`);
                                    await new Promise(r => setTimeout(r, 1000));
                                } else {
                                    console.warn(`⚠️ Day ${targetDay} not found in calendar`);
                                }
                            }

                            // 4. NOW Set Time via Dropdown (V10 - PROVEN METHOD)
                            console.log("🕒 Setting Time via Dropdown (V10)...");
                            await new Promise(r => setTimeout(r, 1000));

                            // Find time input in picker
                            const findInputsInPicker = (root) => {
                                let all = [];
                                const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
                                let node;
                                while (node = walker.nextNode()) {
                                    if (node.tagName === 'INPUT') all.push(node);
                                    if (node.shadowRoot) {
                                        const walker2 = document.createTreeWalker(node.shadowRoot, NodeFilter.SHOW_ELEMENT, null);
                                        let node2;
                                        while (node2 = walker2.nextNode()) {
                                            if (node2.tagName === 'INPUT') all.push(node2);
                                        }
                                    }
                                }
                                return all;
                            };

                            picker = document.querySelector('ytcp-datetime-picker');
                            if (picker) {
                                const inputs = findInputsInPicker(picker);
                                const timeInput = inputs[0]; // Only one input in picker

                                if (timeInput) {
                                    console.log("🎯 Time Input Found");

                                    // Click to open dropdown
                                    timeInput.click();
                                    await new Promise(r => setTimeout(r, 800)); // Wait for dropdown to open

                                    // Find and click the time option
                                    const options = document.querySelectorAll('[role="option"]');
                                    console.log(`🔍 Found ${options.length} time options`);

                                    let found = false;


                                    // Log first 10 options for debugging
                                    console.log("📋 First 10 time options:");
                                    for (let i = 0; i < Math.min(10, options.length); i++) {
                                        console.log(`  [${i}] "${options[i].textContent.trim()}"`);
                                    }

                                    // Log options around index 20 (5:00 AM)
                                    console.log("📋 Options around index 20:");
                                    for (let i = 15; i < Math.min(25, options.length); i++) {
                                        console.log(`  [${i}] "${options[i].textContent.trim()}"`);
                                    }

                                    console.log(`🎯 Looking for timeStr: "${timeStr}"`);
                                    console.log(`📊 Total options available: ${options.length}`);

                                    for (let opt of options) {
                                        const text = opt.textContent.trim();

                                        // Normalize for comparison: remove all spaces, lowercase
                                        const normText = text.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                                        const normTarget = timeStr.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

                                        // Debug specific target
                                        if (text.includes("5:00")) {
                                            console.log(`🔍 Checking "5:00" candidate: "${text}" vs "${timeStr}"`);
                                            console.log(`   Norm: "${normText}" vs "${normTarget}"`);
                                        }

                                        if (normText === normTarget || text === timeStr || text.includes(timeStr)) {
                                            console.log(`✅ MATCH FOUND!`);
                                            console.log(`   Option text: "${text}"`);

                                            // Scroll the option into view before clicking
                                            opt.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            await new Promise(r => setTimeout(r, 500)); // Wait longer for scroll

                                            opt.click();
                                            console.log("✅ Clicked time option");
                                            found = true;
                                            break;
                                        }
                                    }


                                    if (!found) {
                                        console.warn(`⚠️ Time option "${timeStr}" not found in dropdown`);
                                    }

                                    await new Promise(r => setTimeout(r, 1000));
                                } else {
                                    console.error("❌ Time input not found in picker");
                                }
                            }

                        } catch (e) {
                            console.error("❌ Scheduling failed:", e);
                        }
                    }



                    // Finish
                    await new Promise(r => setTimeout(r, 1000));
                    const doneBtn = deepQuery(document.body, '#done-button');
                    if (doneBtn) {
                        doneBtn.click();
                        await new Promise(r => setTimeout(r, 4000));
                        const linkEl = deepQuery(document.body, 'a.style-scope.ytcp-video-info') || document.querySelector('a[href*="youtu.be"]');
                        if (linkEl && linkEl.href) {
                            console.log("🚀 Success Link:", linkEl.href);
                            safeSendMessage({
                                action: 'relayYouTubeUploadComplete',
                                videoUrl: linkEl.href,
                                videoId: data.id,
                                dbId: data.id
                            }, () => {
                                console.log("👋 Upload complete! Closing tab in 3 seconds...");
                                setTimeout(() => {
                                    safeSendMessage({ action: "closeTab" });
                                }, 3000);
                            });
                        }
                    }
                    safeSendMessage({ action: "clearVideoData" });
                };

                console.log("📞 [YouTube Upload] Requesting video data...");
                safeSendMessage({ action: "getVideoData" }, (res) => {
                    console.log("📦 [YouTube Upload] Response:", res);
                    if (res?.success && res.data) {
                        console.log("✅ [YouTube Upload] Got data from extension");
                        processUpload(res.data);
                    } else {
                        // Fallback to localStorage
                        console.log("🔄 [YouTube Upload] Trying localStorage fallback...");
                        try {
                            const stored = localStorage.getItem('__YOUTUBE_UPLOAD_DATA__');
                            if (stored) {
                                const data = JSON.parse(stored);
                                console.log("✅ [YouTube Upload] Got data from localStorage!");
                                processUpload(data);
                                // Clear after use
                                localStorage.removeItem('__YOUTUBE_UPLOAD_DATA__');
                            } else {
                                console.warn("⚠️ [YouTube Upload] No data in localStorage either");
                            }
                        } catch (e) {
                            console.error("❌ [YouTube Upload] localStorage fallback failed:", e);
                        }
                    }
                });
            };
            setTimeout(runYouTubeUpload, 2000);
        }
    }

    // ==========================================================================
    // 🧩 模块 2: GEMINIGEN AUTOMATION (恢复)
    // ==========================================================================
    else if (hostname.includes('geminigen.ai') || hostname.includes('gmicloud.ai')) {
        console.log("🤖 [GeminiGen Ext] Automation Active");
        let hasClickedGenerate = false;

        const monitorResult = () => {
            const checkVideo = setInterval(() => {
                const videos = Array.from(document.querySelectorAll('video'));
                const generatedVideo = videos.find(v => {
                    const src = v.src || '';
                    return (src.startsWith('http') || src.startsWith('blob:')) && v.readyState >= 1 && v.duration > 0 && v.duration !== Infinity;
                });

                if (generatedVideo) {
                    clearInterval(checkVideo);
                    chrome.runtime.sendMessage({ action: "downloadVideo", url: generatedVideo.src }, (response) => {
                        if (response?.success) {
                            if (window.opener) {
                                window.opener.postMessage({ type: 'GEMINI_VIDEO_RESULT', payload: response.data }, '*');
                                setTimeout(() => window.close(), 3000);
                            }
                        } else {
                            fetch(generatedVideo.src).then(r => r.blob()).then(blob => {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                    const base64 = reader.result.split(',')[1];
                                    if (window.opener) {
                                        window.opener.postMessage({ type: 'GEMINI_VIDEO_RESULT', payload: base64 }, '*');
                                        setTimeout(() => window.close(), 3000);
                                    }
                                };
                                reader.readAsDataURL(blob);
                            });
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
                const injectPromptAndGenerate = () => {
                    const textarea = document.querySelector('textarea') || document.querySelector('input[type="text"][placeholder*="Describe"]');
                    if (textarea) {
                        if (textarea.value !== prompt) simulateInput(textarea, prompt);

                        setTimeout(() => {
                            let generateBtn = null;
                            const allButtons = Array.from(document.querySelectorAll('button, div[role="button"]'));
                            generateBtn = allButtons.find(b => {
                                const text = (b.textContent || '').trim().toLowerCase();
                                return (text === 'generate' || text === 'create') && !b.disabled;
                            });

                            if (generateBtn) {
                                generateBtn.click();
                                const innerIcon = generateBtn.querySelector('svg, path, span');
                                if (innerIcon) innerIcon.click();
                                hasClickedGenerate = true;
                                monitorResult();
                            } else {
                                simulateInput(textarea, prompt);
                                textarea.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, keyCode: 13, key: 'Enter' }));
                                hasClickedGenerate = true;
                                monitorResult();
                            }
                        }, 2500);
                    } else {
                        setTimeout(runGenAutomation, 1000);
                    }
                };
                const handleSettings = async () => { injectPromptAndGenerate(); };
                if (params.get('model') || params.get('ratio')) setTimeout(handleSettings, 2000);
                else injectPromptAndGenerate();
            }
        };
        runGenAutomation();
        monitorResult();
    }

    // ==========================================================================
    // 🧩 模块 3: LMARENA AUTOMATION (恢复)
    // ==========================================================================
    else if (hostname.includes('lmarena.ai')) {
        console.log("🧠 [LMArena Ext] Automation Active");

        const startResponseMonitoring = () => {
            console.log("👀 [LMArena] Starting Response Monitoring...");

            // 🛠️ Inject Manual Send Button (Fallback)
            if (!document.getElementById('gemini-manual-send')) {
                const btn = document.createElement('button');
                btn.id = 'gemini-manual-send';
                btn.innerHTML = '🚀 Send Plan to App';
                btn.style.cssText = `
                    position: fixed;
                    bottom: 80px;
                    right: 20px;
                    z-index: 10000;
                    padding: 10px 20px;
                    background: linear-gradient(to right, #8b5cf6, #ec4899);
                    color: white;
                    border: none;
                    border-radius: 50px;
                    font-weight: bold;
                    cursor: pointer;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                    transition: transform 0.2s;
                    font-family: sans-serif;
                `;
                btn.onmouseover = () => btn.style.transform = 'scale(1.05)';
                btn.onmouseout = () => btn.style.transform = 'scale(1)';

                btn.onclick = () => {
                    console.log("👆 [LMArena] Manual Send Clicked");
                    const bodyText = document.body.innerText;
                    // Find JSON array: look for last [...] block that contains "schedule"
                    const lastBracket = bodyText.lastIndexOf(']');
                    if (lastBracket !== -1) {
                        // Search backwards for opening bracket
                        let openBracket = -1;
                        let balance = 0;
                        for (let i = lastBracket; i >= 0; i--) {
                            if (bodyText[i] === ']') balance++;
                            if (bodyText[i] === '[') balance--;
                            if (balance === 0) {
                                openBracket = i;
                                break;
                            }
                        }

                        if (openBracket !== -1) {
                            const jsonText = bodyText.substring(openBracket, lastBracket + 1);
                            if (jsonText.includes('schedule') || jsonText.includes('pillar')) {
                                chrome.runtime.sendMessage({ action: 'relayLMArenaResponse', data: jsonText });
                                btn.innerHTML = '✅ Sent to App!';
                                setTimeout(() => btn.innerHTML = '🚀 Send Plan to App', 3000);
                                return;
                            }
                        }
                    }

                    // Fallback: Just send the whole body text and let React parse it
                    chrome.runtime.sendMessage({ action: 'relayLMArenaResponse', data: bodyText });
                    btn.innerHTML = '⚠️ Sent Full Text';
                };
                document.body.appendChild(btn);
            }

            let stabilityCount = 0;
            let lastTextLength = 0;
            let foundResponse = false;

            const monitorInterval = setInterval(() => {
                if (foundResponse) { clearInterval(monitorInterval); return; }

                let capturedText = null;
                let sourceElement = null;

                // 1. Check Code Blocks (Standard Markdown)
                const codeBlocks = Array.from(document.querySelectorAll('code, pre'));

                // 2. Check all text containers (Fallback for raw text)
                // LMArena sometimes outputs raw text in divs
                const textDivs = Array.from(document.querySelectorAll('.markdown-body div, .markdown-body p, .message-content div, .prose p, .prose div'));

                const allCandidates = [...codeBlocks, ...textDivs];

                const candidateBlock = allCandidates.reverse().find(block => {
                    const text = block.innerText || '';

                    // 🛡️ CRITICAL: Exclude Prompt Template Text
                    if (text.includes("输出格式") || text.includes("JSON 结构必须如下") ||
                        text.includes("S-Tier V3.0") || text.includes("任务 1：算法阶段诊断")) {
                        return false;
                    }
                    if (text.includes('"algorithmStage": "string"') || text.includes('algorithmStage: "string"')) {
                        return false;
                    }
                    if (text.includes('"publishTimeLocal": "YYYY') || text.includes('publishTimeLocal: "YYYY')) {
                        return false;
                    }

                    // Loose check for JSON array containing our keywords
                    return (text.includes('"schedule"') || text.includes('"pillar"')) &&
                        (text.includes('[') || text.includes('{')) &&
                        text.length > 50;
                });

                if (candidateBlock) {
                    capturedText = candidateBlock.innerText;
                    sourceElement = candidateBlock;
                    // Visual feedback
                    candidateBlock.style.border = "2px solid #fbbf24";
                }

                if (capturedText) {
                    // console.log(`[LMArena] Monitoring length: ${capturedText.length}`);
                    if (capturedText.length === lastTextLength && capturedText.length > 100) {
                        stabilityCount++;
                    } else {
                        stabilityCount = 0;
                        lastTextLength = capturedText.length;
                    }

                    // Wait for 3 seconds of stability (streaming complete)
                    if (stabilityCount >= 3 && !foundResponse) {
                        console.log("✅ [LMArena] Captured Stable Response!");
                        foundResponse = true;
                        clearInterval(monitorInterval);
                        if (sourceElement) sourceElement.style.border = "3px solid #4ade80";

                        // Send to Background -> React
                        chrome.runtime.sendMessage({
                            action: 'relayLMArenaResponse',
                            data: capturedText
                        }, (response) => {
                            console.log("📤 [LMArena] Sent response to background:", response);
                        });
                    }
                }
            }, 1000);
        };

        const runLMArenaAutomation = async () => {
            try {
                if (!chrome.runtime?.id) return;

                // 1. 🔍 Check Mode: Battle vs Direct Chat
                const buttons = Array.from(document.querySelectorAll('button'));
                const modeDropdown = buttons.find(b => {
                    const text = b.textContent.trim();
                    return text === 'Battle' || text === 'Arena (Battle)';
                });

                if (modeDropdown) {
                    const url = new URL(window.location.href);
                    if (url.searchParams.get('mode') !== 'direct') {
                        url.searchParams.set('mode', 'direct');
                        if (!url.searchParams.has('gemini_action')) url.searchParams.set('gemini_action', 'generate_plan');
                        window.location.href = url.toString();
                        return;
                    }
                    modeDropdown.click();
                    await new Promise(r => setTimeout(r, 600));
                    const menuItems = Array.from(document.querySelectorAll('[role="menuitem"], li, div'));
                    const directChatOption = menuItems.find(el => el.textContent.trim() === 'Direct Chat');
                    if (directChatOption) { directChatOption.click(); return; }
                }

                // 2. 🤖 Auto-Select "Gemini-3-Pro"
                // Check current model
                const modelBtn = buttons.find(b => b.querySelector('svg') && !b.textContent.includes('Direct Chat') && !b.textContent.includes('New Chat') && !b.textContent.includes('Leaderboard'));
                const currentModelName = modelBtn ? modelBtn.textContent.toLowerCase() : '';

                let isModelCorrect = currentModelName.includes('gemini-3-pro');

                if (!isModelCorrect) {
                    console.log(`🤔 [LMArena] Current model is ${currentModelName}, switching to Gemini-3-Pro...`);

                    let searchInput = document.querySelector('input[placeholder="Search models"]');
                    if (!searchInput) {
                        // Open dropdown
                        if (modelBtn) {
                            modelBtn.click();
                            await new Promise(r => setTimeout(r, 500));
                            searchInput = document.querySelector('input[placeholder="Search models"]');
                        }
                    }

                    if (searchInput) {
                        searchInput.value = '';
                        simulateInput(searchInput, "gemini-3-pro");
                        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                        await new Promise(r => setTimeout(r, 1200)); // Wait for filter

                        const listItems = Array.from(document.querySelectorAll('[role="option"], li, div'));
                        const targetItem = listItems.find(el => {
                            const t = el.textContent.trim();
                            return t === 'gemini-3-pro' || (t.includes('gemini-3-pro') && t.length < 20);
                        });

                        if (targetItem) {
                            console.log("✅ [LMArena] Clicking Gemini-3-Pro...");
                            targetItem.click();
                            await new Promise(r => setTimeout(r, 1000));
                            return; // Wait for model switch
                        }
                    }
                }

                // 3. 📝 Inject Prompt & Send
                chrome.storage.local.get(['pendingLMArenaPrompt'], (res) => {
                    if (res && res.pendingLMArenaPrompt) {
                        const prompt = res.pendingLMArenaPrompt;
                        const inputBox = document.querySelector('textarea[placeholder*="Type"]') ||
                            document.querySelector('textarea') ||
                            document.querySelector('#chat-input');

                        if (inputBox) {
                            // Inject if not already there
                            if (!inputBox.value.includes(prompt.substring(0, 20))) {
                                console.log("✅ [LMArena] Injecting prompt...");
                                inputBox.focus();
                                inputBox.value = prompt;
                                inputBox.dispatchEvent(new Event('input', { bubbles: true }));
                                try { document.execCommand('insertText', false, prompt); } catch (e) { }
                            }

                            // Try Sending (Click + Enter)
                            setTimeout(() => {
                                const btns = Array.from(document.querySelectorAll('button'));
                                const sendBtn = btns.find(b => {
                                    if (b.disabled) return false;
                                    const svg = b.querySelector('svg');
                                    if (!svg) return false;
                                    const rect = b.getBoundingClientRect();
                                    const inputRect = inputBox.getBoundingClientRect();
                                    return rect.top >= inputRect.top && rect.left > inputRect.left + (inputRect.width * 0.5);
                                });

                                if (sendBtn) {
                                    console.log("🚀 [LMArena] Clicking Send...");
                                    sendBtn.click();

                                    // ALSO Try Enter Key
                                    inputBox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));

                                    chrome.storage.local.remove(['pendingLMArenaPrompt'], () => { startResponseMonitoring(); });
                                }
                            }, 1000);
                        }
                    }
                });
            } catch (e) {
                console.log("⚠️ [LMArena] Automation error:", e);
            }
        };
        const checkInterval = setInterval(runLMArenaAutomation, 1000);
        setTimeout(() => clearInterval(checkInterval), 15000);
    }

})();
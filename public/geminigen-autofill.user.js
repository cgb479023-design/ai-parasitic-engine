// ==UserScript==
// @name         GeminiGen Auto-Pilot (Final Debug)
// @namespace    http://tampermonkey.net/
// @version      1.6
// @description  Auto-fill parameters on GeminiGen.ai - Debug Version with Alert
// @author       Smart Editor AI
// @match        *://geminigen.ai/*
// @match        *://www.geminigen.ai/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // 🛑 调试弹窗：这是最直接的验证方式
    // 如果您刷新页面后没有看到这个弹窗，说明脚本根本没有被浏览器加载！
    alert("✅ 脚本已成功注入！\n\n点击确定后将开始自动填充...");

    console.log("🚀 [Auto-Pilot] Script Loaded on: " + window.location.href);

    // 1. 无论在哪个页面，只要 URL 里有 prompt 参数，就开始尝试
    const params = new URLSearchParams(window.location.search);
    const targetPrompt = params.get('prompt');

    if (!targetPrompt) {
        console.log("ℹ️ [Auto-Pilot] No 'prompt' parameter found. Standing by.");
        return;
    }

    console.log("✅ [Auto-Pilot] Target Prompt Found:", targetPrompt);

    const targetProvider = params.get('provider');
    const targetAspectRatio = params.get('aspect_ratio');
    const targetDuration = params.get('duration');

    // ── React Input Setter ──
    const setNativeValue = (element, value) => {
        const valueSetter = Object.getOwnPropertyDescriptor(element, 'value').set;
        const prototype = Object.getPrototypeOf(element);
        const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value').set;

        if (valueSetter && valueSetter !== prototypeValueSetter) {
            prototypeValueSetter.call(element, value);
        } else {
            valueSetter.call(element, value);
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));
    };

    // ── Main Logic ──
    const run = async () => {
        console.log("⚡ [Auto-Pilot] Searching for elements...");

        // 1. Provider
        if (targetProvider) {
            const allDivs = Array.from(document.querySelectorAll('div, label, span'));
            const providerEl = allDivs.find(el =>
                el.textContent.trim().toLowerCase() === targetProvider.toLowerCase() &&
                (el.className.includes('Card') || el.closest('[role="radio"]'))
            );
            if (providerEl) {
                console.log(`✅ [Auto-Pilot] Clicking Provider: ${targetProvider}`);
                providerEl.click();
            }
        }

        // 2. Prompt (尝试多种选择器)
        const textarea = document.querySelector('textarea[placeholder*="Describe"]') ||
            document.querySelector('textarea[placeholder*="Prompt"]') ||
            document.querySelector('textarea');

        if (textarea) {
            console.log("✅ [Auto-Pilot] Filling Prompt...");
            textarea.value = targetPrompt;
            setNativeValue(textarea, targetPrompt);
            textarea.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
            console.warn("⚠️ [Auto-Pilot] Textarea NOT found yet.");
        }

        // 3. Aspect Ratio & Duration
        const allButtons = Array.from(document.querySelectorAll('button, div[role="button"], label'));

        if (targetAspectRatio) {
            const ratioBtn = allButtons.find(b => b.textContent.includes(targetAspectRatio));
            if (ratioBtn) {
                console.log(`✅ [Auto-Pilot] Clicking Ratio: ${targetAspectRatio}`);
                ratioBtn.click();
            }
        }

        if (targetDuration) {
            const durText = `${targetDuration}s`;
            const durBtn = allButtons.find(b => b.textContent.trim() === durText);
            if (durBtn) {
                console.log(`✅ [Auto-Pilot] Clicking Duration: ${durText}`);
                durBtn.click();
            }
        }

        // 5. Monitor for Result
        const monitorResult = () => {
            console.log("👀 [Auto-Pilot] Monitoring for video result...");

            const checkVideo = setInterval(() => {
                // Strategy 1: Look for any video tag with a valid src
                const videos = Array.from(document.querySelectorAll('video'));
                // Filter out small preview videos or background videos if any (heuristic: duration > 0)
                const generatedVideo = videos.find(v => v.src && v.src.startsWith('http') && v.readyState >= 1);

                if (generatedVideo) {
                    console.log("🎉 [Auto-Pilot] Video found!", generatedVideo.src);
                    clearInterval(checkVideo);

                    if (window.opener) {
                        console.log("📤 [Auto-Pilot] Sending result to opener...");
                        window.opener.postMessage({
                            type: 'GEMINI_VIDEO_RESULT',
                            url: generatedVideo.src
                        }, '*');

                        // Optional: Close window after a delay
                        setTimeout(() => {
                            console.log("👋 [Auto-Pilot] Closing window...");
                            window.close();
                        }, 5000);
                    } else {
                        console.warn("⚠️ [Auto-Pilot] No opener window found. Cannot send result back.");
                        // alert("Video Generated! URL: " + generatedVideo.src);
                    }
                }
            }, 2000);
        };

        // 4. Generate
        setTimeout(() => {
            const genBtn = Array.from(document.querySelectorAll('button'))
                .find(b => b.textContent.includes('Generate') && !b.disabled);
            if (genBtn) {
                console.log("🚀 [Auto-Pilot] Clicking Generate!");
                genBtn.click();
                monitorResult();
            } else {
                console.warn("⚠️ [Auto-Pilot] Generate button not found or disabled.");
                // Still try to monitor in case it was already clicked or auto-started
                monitorResult();
            }
        }, 1500);
    };

    // 循环尝试 3 次，防止页面加载慢
    setTimeout(run, 1000);
    setTimeout(run, 3000);
    setTimeout(run, 5000);

})();

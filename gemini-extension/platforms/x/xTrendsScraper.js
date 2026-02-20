/**
 * X/Twitter Trends Scraper
 * 
 * Scrapes trending topics from X.com/Twitter.com using Shadow DOM traversal.
 * Runs as a content script on x.com pages.
 * 
 * @module platforms/x/xTrendsScraper
 * @version 1.0.0
 * @date 2026-01-08
 */

(function () {
    'use strict';

    const CONFIG = {
        // Selectors for X.com trends (may change with X updates)
        TRENDS_CONTAINER_SELECTORS: [
            '[data-testid="trend"]',
            '[data-testid="trendItem"]',
            'div[aria-label*="Trending"]',
            'section[aria-labelledby*="accessible-list"]',
            // 🎯 NEW: Sidebar selectors
            '[data-testid="sidebarColumn"] [role="link"]',
            'div[aria-label="Timeline: Trending now"] [role="link"]'
        ],
        TREND_NAME_SELECTORS: [
            '[data-testid="trendName"]',
            'span[dir="ltr"]',
            'div[dir="ltr"] > span'
        ],
        TREND_VOLUME_SELECTORS: [
            '[data-testid="tweetCount"]',
            'span[dir="ltr"]'  // Text matching done in JS, not CSS
        ],

        // Scrape interval (5 minutes)
        SCRAPE_INTERVAL_MS: 5 * 60 * 1000,

        // Max trends to collect
        MAX_TRENDS: 20
    };

    // ═══════════════════════════════════════════════════════════════════════
    // SHADOW DOM TRAVERSAL
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Recursively search through Shadow DOM
     */
    function querySelectorAllDeep(selector, root = document) {
        const results = [];

        // Search in current root
        const elements = root.querySelectorAll(selector);
        results.push(...Array.from(elements));

        // Search in shadow roots
        const allElements = root.querySelectorAll('*');
        for (const el of allElements) {
            if (el.shadowRoot) {
                results.push(...querySelectorAllDeep(selector, el.shadowRoot));
            }
        }

        return results;
    }

    /**
     * Find first matching element in Shadow DOM
     */
    function querySelectorDeep(selector, root = document) {
        const results = querySelectorAllDeep(selector, root);
        return results.length > 0 ? results[0] : null;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // TREND SCRAPING
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Extract text content, handling nested spans
     */
    function extractText(element) {
        if (!element) return '';
        return element.textContent?.trim() || '';
    }

    /**
     * Parse volume string like "50K posts" to number
     */
    function parseVolume(volumeStr) {
        if (!volumeStr) return null;
        const match = volumeStr.match(/([0-9,.]+)\s*([KMB])?/i);
        if (!match) return null;

        let num = parseFloat(match[1].replace(/,/g, ''));
        const suffix = (match[2] || '').toUpperCase();

        if (suffix === 'K') num *= 1000;
        else if (suffix === 'M') num *= 1000000;
        else if (suffix === 'B') num *= 1000000000;

        return Math.round(num);
    }

    /**
     * Scrape trends from the current page
     */
    function scrapeTrends() {
        console.log('📱 [XTrendsScraper] Scraping trends from X.com...');

        const trends = [];

        // Try each container selector
        for (const containerSelector of CONFIG.TRENDS_CONTAINER_SELECTORS) {
            const containers = querySelectorAllDeep(containerSelector);

            for (const container of containers) {
                // Try to extract trend name
                let trendName = '';
                for (const nameSelector of CONFIG.TREND_NAME_SELECTORS) {
                    const nameEl = container.querySelector(nameSelector) ||
                        querySelectorDeep(nameSelector, container);
                    if (nameEl) {
                        trendName = extractText(nameEl);
                        break;
                    }
                }

                // Fallback: get main text content
                if (!trendName) {
                    const spans = container.querySelectorAll('span');
                    for (const span of spans) {
                        const text = extractText(span);
                        if (text.startsWith('#') || text.length > 3) {
                            trendName = text;
                            break;
                        }
                    }
                }

                if (!trendName || trendName.length < 2) {
                    // 🎯 NEW: Try to find text in child spans if direct name not found
                    const allSpans = Array.from(container.querySelectorAll('span'));
                    const potentialName = allSpans.find(s => s.textContent?.length > 3 && !s.textContent?.includes('posts'));
                    if (potentialName) trendName = extractText(potentialName);
                }

                if (!trendName || trendName.length < 2 || trendName.includes('Trending') || trendName.includes('Show more')) continue;

                // Extract volume if available
                let volume = null;
                for (const volSelector of CONFIG.TREND_VOLUME_SELECTORS) {
                    const volEl = container.querySelector(volSelector) ||
                        querySelectorDeep(volSelector, container);
                    if (volEl) {
                        volume = parseVolume(extractText(volEl));
                        break;
                    }
                }

                // Avoid duplicates
                if (!trends.find(t => t.name === trendName)) {
                    trends.push({
                        name: trendName,
                        volume: volume,
                        source: 'x.com',
                        timestamp: new Date().toISOString()
                    });
                }

                if (trends.length >= CONFIG.MAX_TRENDS) break;
            }

            if (trends.length >= CONFIG.MAX_TRENDS) break;
        }

        // Alternative: Try to find trends in explore page structure
        if (trends.length === 0) {
            console.log('📱 [XTrendsScraper] Trying alternative selectors...');

            // Look for any element with "trending" in aria-label
            const trendingSection = querySelectorDeep('[aria-label*="rending"]');
            if (trendingSection) {
                const spans = trendingSection.querySelectorAll('span');
                const seenTexts = new Set();

                for (const span of spans) {
                    const text = extractText(span);
                    if (text.startsWith('#') || (text.length > 3 && text.length < 50)) {
                        if (!seenTexts.has(text) && !text.includes('Trending') && !text.includes('Show more')) {
                            seenTexts.add(text);
                            trends.push({
                                name: text,
                                volume: null,
                                source: 'x.com',
                                timestamp: new Date().toISOString()
                            });
                        }
                    }
                    if (trends.length >= CONFIG.MAX_TRENDS) break;
                }
            }
        }

        console.log(`📱 [XTrendsScraper] Found ${trends.length} trends`);
        return trends;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MESSAGE HANDLING
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Listen for scrape requests from background script
     */
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'scrapeXTrends') {
            console.log('📱 [XTrendsScraper] Received scrape request');

            const trends = scrapeTrends();

            sendResponse({
                success: true,
                trends: trends,
                timestamp: new Date().toISOString(),
                url: window.location.href
            });

            return true; // Async response
        }
    });

    /**
     * Auto-scrape on page load after delay
     */
    function autoScrapeOnLoad() {
        // Wait for page to fully load
        setTimeout(() => {
            const trends = scrapeTrends();

            if (trends.length > 0) {
                // Send to background for storage
                chrome.runtime.sendMessage({
                    action: 'xTrendsScraped',
                    trends: trends,
                    timestamp: new Date().toISOString()
                });
            }
        }, 3000); // 3 second delay for dynamic content
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════

    // Check if we're on a page with trends
    if (window.location.hostname.includes('x.com') ||
        window.location.hostname.includes('twitter.com')) {

        console.log('📱 [XTrendsScraper] Initialized on X.com');

        // Auto-scrape on load
        if (document.readyState === 'complete') {
            autoScrapeOnLoad();
        } else {
            window.addEventListener('load', autoScrapeOnLoad);
        }

        // Re-scrape when navigating within X
        let lastUrl = window.location.href;
        const urlObserver = new MutationObserver(() => {
            if (window.location.href !== lastUrl) {
                lastUrl = window.location.href;
                console.log('📱 [XTrendsScraper] URL changed, re-scraping...');
                setTimeout(() => {
                    const trends = scrapeTrends();
                    if (trends.length > 0) {
                        chrome.runtime.sendMessage({
                            action: 'xTrendsScraped',
                            trends: trends,
                            timestamp: new Date().toISOString()
                        });
                    }
                }, 2000);
            }
        });

        urlObserver.observe(document.body, { childList: true, subtree: true });
    }

})();

/**
 * X (Twitter) Analytics Scraper
 * 
 * Scrapes post performance data from X.com profile/analytics pages.
 * Part of the Closed-Loop Feedback System for DFL.
 * 
 * @module platforms/x/xAnalyticsScraper
 * @version 1.0.0
 * @date 2026-01-08
 */

(function () {
    'use strict';

    // Skip if not on X.com
    if (!window.location.hostname.includes('x.com') &&
        !window.location.hostname.includes('twitter.com')) {
        return;
    }

    const CONFIG = {
        // Selectors for X.com post metrics
        POST_SELECTORS: {
            // Individual post/tweet container
            POST_CONTAINER: [
                'article[data-testid="tweet"]',
                '[data-testid="cellInnerDiv"]',
                'div[data-testid="tweetText"]'
            ],
            // Post text content
            POST_TEXT: [
                '[data-testid="tweetText"]',
                'div[lang]'
            ],
            // Metrics group
            METRICS_GROUP: [
                '[role="group"]',
                '[data-testid="tweet"] div[role="group"]'
            ],
            // Individual metrics
            REPLY_COUNT: '[data-testid="reply"]',
            REPOST_COUNT: '[data-testid="retweet"]',
            LIKE_COUNT: '[data-testid="like"]',
            VIEW_COUNT: 'a[href*="/analytics"]',
            BOOKMARK_COUNT: '[data-testid="bookmark"]'
        },
        // Analytics page specific
        ANALYTICS_SELECTORS: {
            IMPRESSIONS: '[data-testid="impressions"]',
            ENGAGEMENTS: '[data-testid="engagements"]',
            DETAIL_EXPANDS: '[data-testid="detail-expands"]'
        }
    };

    // ═══════════════════════════════════════════════════════════════════════
    // SHADOW DOM UTILITIES
    // ═══════════════════════════════════════════════════════════════════════

    function querySelectorAllDeep(selector, root = document) {
        const results = [];
        const elements = root.querySelectorAll(selector);
        results.push(...Array.from(elements));

        const allElements = root.querySelectorAll('*');
        for (const el of allElements) {
            if (el.shadowRoot) {
                results.push(...querySelectorAllDeep(selector, el.shadowRoot));
            }
        }
        return results;
    }

    function querySelectorDeep(selector, root = document) {
        const results = querySelectorAllDeep(selector, root);
        return results.length > 0 ? results[0] : null;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // METRIC PARSING
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Parse metric string like "1.2K" or "500" to number
     */
    function parseMetric(metricStr) {
        if (!metricStr) return 0;

        const cleaned = metricStr.trim().replace(/,/g, '');
        const match = cleaned.match(/([0-9.]+)\s*([KMB])?/i);

        if (!match) return 0;

        let num = parseFloat(match[1]);
        const suffix = (match[2] || '').toUpperCase();

        if (suffix === 'K') num *= 1000;
        else if (suffix === 'M') num *= 1000000;
        else if (suffix === 'B') num *= 1000000000;

        return Math.round(num);
    }

    /**
     * Extract metric from an element's aria-label or text
     */
    function extractMetricFromElement(element) {
        if (!element) return 0;

        // Try aria-label first (e.g., "5 likes")
        const ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel) {
            const match = ariaLabel.match(/([0-9,.]+[KMB]?)/i);
            if (match) return parseMetric(match[1]);
        }

        // Try text content
        const text = element.textContent?.trim();
        return parseMetric(text);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // POST SCRAPING
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Scrape analytics from visible posts on the page
     */
    function scrapePostAnalytics() {
        console.log('📊 [XAnalytics] Scraping post analytics...');

        const posts = [];
        const articles = querySelectorAllDeep('article[data-testid="tweet"]');

        for (const article of articles) {
            try {
                // Get post text
                const textEl = article.querySelector('[data-testid="tweetText"]');
                const text = textEl?.textContent?.substring(0, 100) || '';

                // Get post link
                const timeLink = article.querySelector('time')?.closest('a');
                const postUrl = timeLink?.href || '';

                // Get metrics
                const metricsGroup = article.querySelector('[role="group"]');

                let replies = 0, reposts = 0, likes = 0, views = 0, bookmarks = 0;

                if (metricsGroup) {
                    // Find each metric button
                    const buttons = metricsGroup.querySelectorAll('button, a');

                    for (const btn of buttons) {
                        const testId = btn.getAttribute('data-testid');
                        const ariaLabel = btn.getAttribute('aria-label') || '';
                        const text = btn.textContent?.trim() || '';

                        if (testId === 'reply' || ariaLabel.includes('repl')) {
                            replies = extractMetricFromElement(btn);
                        } else if (testId === 'retweet' || ariaLabel.includes('Repost')) {
                            reposts = extractMetricFromElement(btn);
                        } else if (testId === 'like' || ariaLabel.includes('Like')) {
                            likes = extractMetricFromElement(btn);
                        } else if (testId === 'bookmark' || ariaLabel.includes('Bookmark')) {
                            bookmarks = extractMetricFromElement(btn);
                        } else if (ariaLabel.includes('View') || text.includes('Views')) {
                            views = parseMetric(text);
                        }
                    }

                    // Views might be in analytics link
                    const viewsLink = metricsGroup.querySelector('a[href*="/analytics"]');
                    if (viewsLink) {
                        views = parseMetric(viewsLink.textContent);
                    }
                }

                // Only add if we got some metrics
                if (replies > 0 || reposts > 0 || likes > 0 || views > 0) {
                    posts.push({
                        text: text,
                        url: postUrl,
                        metrics: {
                            views: views,
                            likes: likes,
                            reposts: reposts,
                            replies: replies,
                            bookmarks: bookmarks
                        },
                        engagementRate: views > 0 ? ((likes + reposts + replies) / views * 100).toFixed(2) : 0,
                        timestamp: new Date().toISOString()
                    });
                }
            } catch (e) {
                console.error('📊 [XAnalytics] Error parsing post:', e);
            }
        }

        console.log(`📊 [XAnalytics] Found ${posts.length} posts with metrics`);
        return posts;
    }

    /**
     * Get profile-level analytics
     */
    function scrapeProfileAnalytics() {
        console.log('📊 [XAnalytics] Scraping profile analytics...');

        const profile = {
            name: '',
            handle: '',
            followers: 0,
            following: 0,
            posts: 0,
            timestamp: new Date().toISOString()
        };

        try {
            // Name
            const nameEl = querySelectorDeep('[data-testid="UserName"]') ||
                document.querySelector('h1[role="heading"]');
            profile.name = nameEl?.textContent?.split('@')[0]?.trim() || '';

            // Handle
            const handleEl = document.querySelector('a[href*="/followers"]')?.closest('div')?.querySelector('span');
            profile.handle = handleEl?.textContent || '';

            // Followers/Following
            const followLinks = document.querySelectorAll('a[href*="/followers"], a[href*="/following"]');
            for (const link of followLinks) {
                const text = link.textContent || '';
                if (link.href.includes('/followers')) {
                    profile.followers = parseMetric(text.match(/[\d,.]+[KMB]?/)?.[0] || '0');
                } else if (link.href.includes('/following')) {
                    profile.following = parseMetric(text.match(/[\d,.]+[KMB]?/)?.[0] || '0');
                }
            }
        } catch (e) {
            console.error('📊 [XAnalytics] Error parsing profile:', e);
        }

        return profile;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MESSAGE HANDLING
    // ═══════════════════════════════════════════════════════════════════════

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'scrapeXAnalytics') {
            console.log('📊 [XAnalytics] Received scrape request');

            const data = {
                profile: scrapeProfileAnalytics(),
                posts: scrapePostAnalytics(),
                timestamp: new Date().toISOString(),
                url: window.location.href
            };

            sendResponse({ success: true, data: data });
            return true;
        }
    });

    // Auto-scrape and send to background after page load
    function autoScrape() {
        setTimeout(() => {
            const data = {
                profile: scrapeProfileAnalytics(),
                posts: scrapePostAnalytics(),
                timestamp: new Date().toISOString(),
                url: window.location.href
            };

            if (data.posts.length > 0) {
                chrome.runtime.sendMessage({
                    action: 'xAnalyticsScraped',
                    data: data
                });
                console.log('📊 [XAnalytics] Auto-scraped and sent to background');
            }
        }, 5000);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════

    // Only auto-scrape on profile pages
    if (window.location.pathname.match(/^\/[^/]+\/?$/)) {
        console.log('📊 [XAnalytics] Profile page detected, initializing auto-scrape');

        if (document.readyState === 'complete') {
            autoScrape();
        } else {
            window.addEventListener('load', autoScrape);
        }
    }

    // Export for manual use
    window.XAnalyticsScraper = {
        scrapePostAnalytics,
        scrapeProfileAnalytics
    };

    console.log('📊 [XAnalytics] Analytics Scraper module loaded');

})();

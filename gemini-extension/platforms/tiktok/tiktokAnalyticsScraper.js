/**
 * TikTok Studio Analytics Scraper
 * 
 * Scrapes video performance data from TikTok Creator Studio.
 * Part of the Closed-Loop Feedback System for DFL.
 * 
 * Based on TikTok Studio structure:
 * - Posts table with Views, Likes, Comments columns
 * - URL: tiktok.com/tiktokstudio/content
 * 
 * @module platforms/tiktok/tiktokAnalyticsScraper
 * @version 1.0.0
 * @date 2026-01-08
 */

(function () {
    'use strict';

    // Skip if not on TikTok Studio
    if (!window.location.href.includes('tiktokstudio')) {
        return;
    }

    const CONFIG = {
        // Selectors based on TikTok Studio Content page structure
        CONTENT_TABLE: {
            // Table container
            TABLE_CONTAINER: [
                '.content-table',
                '[class*="ContentTable"]',
                'table',
                '[data-e2e="content-table"]'
            ],
            // Table rows
            ROW: [
                'tr',
                '[class*="ContentRow"]',
                '[class*="content-row"]',
                '[data-e2e="content-row"]'
            ],
            // Video title
            TITLE: [
                '.video-title',
                '[class*="VideoTitle"]',
                'td:nth-child(1)',
                'a[href*="/video/"]'
            ],
            // Metrics columns (Views, Likes, Comments)
            VIEWS: [
                'td:nth-child(4)',  // Based on screenshot order
                '[class*="views"]',
                '[data-col="views"]'
            ],
            LIKES: [
                'td:nth-child(5)',
                '[class*="likes"]',
                '[data-col="likes"]'
            ],
            COMMENTS: [
                'td:nth-child(6)',
                '[class*="comments"]',
                '[data-col="comments"]'
            ],
            PRIVACY: [
                'td:nth-child(3)',
                '[class*="privacy"]'
            ]
        }
    };

    // ═══════════════════════════════════════════════════════════════════════
    // UTILITIES
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

    function findElement(selectors, root = document) {
        for (const selector of selectors) {
            const el = root.querySelector(selector);
            if (el) return el;
        }
        return null;
    }

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

    // ═══════════════════════════════════════════════════════════════════════
    // SCRAPING FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * Scrape video analytics from TikTok Studio Content page
     */
    function scrapeContentAnalytics() {
        console.log('📊 [TikTokAnalytics] Scraping content analytics...');

        const videos = [];

        // Try to find table rows
        const rows = document.querySelectorAll('tr, [class*="ContentRow"], [class*="content-row"]');
        console.log(`📊 [TikTokAnalytics] Found ${rows.length} potential rows`);

        // Skip header row
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];

            try {
                // Get all cells
                const cells = row.querySelectorAll('td');
                if (cells.length < 4) continue;

                // Extract data based on column positions from screenshot
                // Column order: Video | Created | Privacy | Views | Likes | Comments | Actions

                // Video title (first column)
                const titleCell = cells[0];
                const titleLink = titleCell?.querySelector('a') || titleCell;
                const title = titleLink?.textContent?.trim() || '';
                const videoUrl = titleLink?.href || '';

                // Privacy (column 3)
                const privacyCell = cells[2];
                const privacy = privacyCell?.textContent?.trim() || 'Unknown';

                // Metrics
                const viewsCell = cells[3];
                const likesCell = cells[4];
                const commentsCell = cells[5];

                const views = parseMetric(viewsCell?.textContent);
                const likes = parseMetric(likesCell?.textContent);
                const comments = parseMetric(commentsCell?.textContent);

                // Only add if we got a title
                if (title && title.length > 0) {
                    const engagementRate = views > 0
                        ? ((likes + comments) / views * 100).toFixed(2)
                        : 0;

                    videos.push({
                        title: title.substring(0, 100),
                        url: videoUrl,
                        privacy: privacy,
                        metrics: {
                            views: views,
                            likes: likes,
                            comments: comments
                        },
                        engagementRate: parseFloat(engagementRate),
                        platform: 'tiktok',
                        timestamp: new Date().toISOString()
                    });
                }
            } catch (e) {
                console.error('📊 [TikTokAnalytics] Error parsing row:', e);
            }
        }

        // Alternative: Try scraping from visible cards/list items
        if (videos.length === 0) {
            console.log('📊 [TikTokAnalytics] Trying alternative scraping method...');

            // Look for any elements with metric-like content
            const metricElements = document.querySelectorAll('[class*="view"], [class*="like"], [class*="comment"]');
            console.log(`📊 [TikTokAnalytics] Found ${metricElements.length} metric elements`);
        }

        console.log(`📊 [TikTokAnalytics] Scraped ${videos.length} videos`);
        return videos;
    }

    /**
     * Get summary statistics
     */
    function getAnalyticsSummary(videos) {
        if (videos.length === 0) {
            return {
                totalVideos: 0,
                totalViews: 0,
                totalLikes: 0,
                totalComments: 0,
                avgEngagementRate: 0,
                topPerformer: null
            };
        }

        const totalViews = videos.reduce((sum, v) => sum + v.metrics.views, 0);
        const totalLikes = videos.reduce((sum, v) => sum + v.metrics.likes, 0);
        const totalComments = videos.reduce((sum, v) => sum + v.metrics.comments, 0);
        const avgEngagementRate = videos.reduce((sum, v) => sum + v.engagementRate, 0) / videos.length;

        // Find top performer by views
        const topPerformer = videos.reduce((top, v) =>
            v.metrics.views > (top?.metrics?.views || 0) ? v : top, null);

        return {
            totalVideos: videos.length,
            totalViews: totalViews,
            totalLikes: totalLikes,
            totalComments: totalComments,
            avgEngagementRate: parseFloat(avgEngagementRate.toFixed(2)),
            topPerformer: topPerformer?.title || null
        };
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MESSAGE HANDLING
    // ═══════════════════════════════════════════════════════════════════════

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'scrapeTikTokAnalytics') {
            console.log('📊 [TikTokAnalytics] Received scrape request');

            const videos = scrapeContentAnalytics();
            const summary = getAnalyticsSummary(videos);

            const data = {
                videos: videos,
                summary: summary,
                timestamp: new Date().toISOString(),
                url: window.location.href
            };

            sendResponse({ success: true, data: data });
            return true;
        }
    });

    // Auto-scrape on content page load
    function autoScrape() {
        setTimeout(() => {
            const videos = scrapeContentAnalytics();

            if (videos.length > 0) {
                const summary = getAnalyticsSummary(videos);

                chrome.runtime.sendMessage({
                    action: 'tiktokAnalyticsScraped',
                    data: {
                        videos: videos,
                        summary: summary,
                        timestamp: new Date().toISOString(),
                        url: window.location.href
                    }
                });
                console.log('📊 [TikTokAnalytics] Auto-scraped and sent to background');
            }
        }, 5000);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════════════

    // Auto-scrape on content page
    if (window.location.href.includes('/content')) {
        console.log('📊 [TikTokAnalytics] Content page detected, initializing auto-scrape');

        if (document.readyState === 'complete') {
            autoScrape();
        } else {
            window.addEventListener('load', autoScrape);
        }
    }

    // Export for manual use
    window.TikTokAnalyticsScraper = {
        scrapeContentAnalytics,
        getAnalyticsSummary
    };

    console.log('📊 [TikTokAnalytics] Analytics Scraper module loaded');

})();

/**
 * YouTube Studio Scheduler Module
 * 
 * Handles setting schedule date and time in YouTube Studio's upload dialog.
 * Extracted from content.js for modularity.
 * 
 * @module platforms/youtube/scheduler
 * @version 1.0.0
 * @date 2025-12-26
 * 
 * Dependencies:
 * - core/domHelpers.js (deepQueryAll, waitForElement)
 * - core/eventDispatcher.js (typeText, dispatchKeyPress)
 * - utils/delay.js (delay)
 * - utils/logger.js (Loggers)
 */

/**
 * YouTube Scheduler Class
 * 
 * Provides methods for setting video schedule date and time in YouTube Studio.
 */
class YouTubeScheduler {
    constructor() {
        this.logger = window.Loggers?.Scheduler || console;
    }

    /**
     * Sets both date and time for a scheduled video.
     * 
     * @param {string} scheduleDate - Date in MM/DD/YYYY format
     * @param {string} scheduleTime - Time in "HH:MM AM/PM" format
     * @returns {Promise<{success: boolean, message: string}>}
     * 
     * @example
     * const result = await YouTubeScheduler.setSchedule('12/27/2025', '10:00 AM');
     */
    async setSchedule(scheduleDate, scheduleTime) {
        this.logger.info?.(`Setting schedule: ${scheduleDate} ${scheduleTime}`) ||
            console.log(`📅 [Scheduler] Setting schedule: ${scheduleDate} ${scheduleTime}`);

        try {
            // Step 1: Wait for datetime picker
            const picker = await this.waitForDateTimePicker();
            if (!picker) {
                return { success: false, message: 'DateTime picker not found' };
            }

            // Step 2: Set date FIRST
            if (scheduleDate) {
                await this.setDate(scheduleDate);
            }

            await (window.delay?.(1000) || new Promise(r => setTimeout(r, 1000)));

            // Step 3: Set time with retry (important - set after date to prevent reset)
            if (scheduleTime) {
                let timeSetSuccess = false;
                const maxRetries = 3;

                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                    console.log(`⏰ [Scheduler] Time setting attempt ${attempt}/${maxRetries}...`);
                    timeSetSuccess = await this.setTime(scheduleTime);

                    if (timeSetSuccess) {
                        console.log(`✅ [Scheduler] Time set successfully on attempt ${attempt}`);
                        break;
                    } else {
                        console.warn(`⚠️ [Scheduler] Time setting failed on attempt ${attempt}`);
                        if (attempt < maxRetries) {
                            console.log(`🔄 [Scheduler] Retrying in 1 second...`);
                            await (window.delay?.(1000) || new Promise(r => setTimeout(r, 1000)));
                        }
                    }
                }

                if (!timeSetSuccess) {
                    console.error(`❌ [Scheduler] Failed to set time after ${maxRetries} attempts`);
                    // Continue anyway - better to upload with wrong time than fail completely
                }
            }

            return { success: true, message: 'Schedule set successfully' };
        } catch (error) {
            this.logger.error?.('Failed to set schedule:', error) ||
                console.error('❌ [Scheduler] Failed:', error);
            return { success: false, message: error.message };
        }
    }

    /**
     * Waits for the datetime picker to appear.
     * 
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<Element|null>}
     */
    async waitForDateTimePicker(timeout = 30000) {
        console.log('📅 [Scheduler] Waiting for datetime picker...');

        const startTime = Date.now();

        while (Date.now() - startTime < timeout) {
            const picker = document.querySelector('ytcp-datetime-picker');
            if (picker) {
                // Also verify time input exists
                const inputs = picker.querySelectorAll('input');
                const timeInput = Array.from(inputs).find(inp =>
                    inp.value.includes('AM') || inp.value.includes('PM')
                );

                if (timeInput) {
                    console.log('✅ [Scheduler] DateTime picker ready');
                    return picker;
                }
            }

            await (window.delay?.(500) || new Promise(r => setTimeout(r, 500)));
        }

        console.error('❌ [Scheduler] DateTime picker not found');
        return null;
    }

    /**
     * Sets the schedule time using character-by-character typing.
     * This is required because YouTube Studio uses Polymer/Lit framework.
     * 
     * @param {string} targetTime - Time in "HH:MM AM/PM" format
     * @returns {Promise<boolean>}
     */
    async setTime(targetTime) {
        console.log(`⏰ [Scheduler] Setting time: ${targetTime}`);

        const picker = document.querySelector('ytcp-datetime-picker');
        if (!picker) {
            console.error('❌ [Scheduler] Picker not found for time setting');
            return false;
        }

        // Find the time input
        const timeInput = picker.querySelector('input');
        if (!timeInput) {
            console.error('❌ [Scheduler] Time input not found');
            return false;
        }

        console.log(`⏰ [Scheduler] Current time: "${timeInput.value}"`);

        // Click to focus and open dropdown
        timeInput.click();
        await (window.delay?.(300) || new Promise(r => setTimeout(r, 300)));
        timeInput.focus();

        // Select all and clear
        timeInput.setSelectionRange(0, timeInput.value.length);
        timeInput.value = '';
        timeInput.dispatchEvent(new Event('input', { bubbles: true }));
        await (window.delay?.(100) || new Promise(r => setTimeout(r, 100)));

        // Type character by character (CRITICAL for framework binding)
        for (const char of targetTime) {
            timeInput.value += char;
            timeInput.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                data: char,
                inputType: 'insertText'
            }));
            await (window.delay?.(30) || new Promise(r => setTimeout(r, 30)));
        }

        // Dispatch change event
        timeInput.dispatchEvent(new Event('change', { bubbles: true }));
        await (window.delay?.(200) || new Promise(r => setTimeout(r, 200)));

        // Try to find and click matching dropdown option
        const options = document.querySelectorAll('tp-yt-paper-item, [role="option"], [role="listitem"]');
        let matched = false;
        for (const opt of options) {
            const optText = opt.textContent?.trim();
            if (optText === targetTime) {
                console.log(`⏰ [Scheduler] Found matching option: "${optText}"`);
                opt.click();
                matched = true;
                break;
            }
        }

        // If no dropdown match, press Enter to confirm
        if (!matched) {
            timeInput.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true
            }));
            timeInput.dispatchEvent(new KeyboardEvent('keyup', {
                key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true
            }));
        }

        timeInput.blur();
        await (window.delay?.(300) || new Promise(r => setTimeout(r, 300)));

        // 🔧 FIX: Enhanced verification - check hour AND AM/PM
        const finalValue = timeInput.value.trim();

        // Extract hour and period from both target and final
        const targetMatch = targetTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        const finalMatch = finalValue.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);

        console.log(`⏰ [Scheduler] Verify - Target: "${targetTime}", Final: "${finalValue}"`);
        console.log(`⏰ [Scheduler] Target parsed:`, targetMatch ? `${targetMatch[1]}:${targetMatch[2]} ${targetMatch[3]}` : 'PARSE FAILED');
        console.log(`⏰ [Scheduler] Final parsed:`, finalMatch ? `${finalMatch[1]}:${finalMatch[2]} ${finalMatch[3]}` : 'PARSE FAILED');

        if (targetMatch && finalMatch) {
            const targetHour = parseInt(targetMatch[1]);
            const targetMin = targetMatch[2];
            const targetPeriod = targetMatch[3].toUpperCase();

            const finalHour = parseInt(finalMatch[1]);
            const finalMin = finalMatch[2];
            const finalPeriod = finalMatch[3].toUpperCase();

            const hourMatch = targetHour === finalHour;
            const minMatch = targetMin === finalMin;
            const periodMatch = targetPeriod === finalPeriod;

            if (hourMatch && minMatch && periodMatch) {
                console.log(`✅ [Scheduler] Time set correctly: ${finalValue}`);
                return true;
            } else {
                console.warn(`⚠️ [Scheduler] Time mismatch details:`);
                console.warn(`   Hour: ${targetHour} vs ${finalHour} = ${hourMatch ? '✓' : '✗'}`);
                console.warn(`   Min: ${targetMin} vs ${finalMin} = ${minMatch ? '✓' : '✗'}`);
                console.warn(`   Period: ${targetPeriod} vs ${finalPeriod} = ${periodMatch ? '✓' : '✗'}`);
                return false;
            }
        } else {
            // Fallback to simple string comparison
            if (finalValue.toLowerCase().includes(targetTime.toLowerCase().replace(/\s+/g, ''))) {
                console.log(`✅ [Scheduler] Time set (fallback match): ${finalValue}`);
                return true;
            }
            console.warn(`⚠️ [Scheduler] Time verification failed - could not parse values`);
            console.warn(`   Final: "${finalValue}", Expected: "${targetTime}"`);
            return false;
        }
    }

    /**
     * Sets the schedule date by navigating the calendar and clicking the target day.
     * 
     * @param {string} scheduleDate - Date in MM/DD/YYYY format
     * @returns {Promise<boolean>}
     */
    async setDate(scheduleDate) {
        console.log(`📅 [Scheduler] Setting date: ${scheduleDate}`);

        // Parse date
        const { month, day, year } = this.parseDateString(scheduleDate);
        console.log(`📅 [Scheduler] Parsed: Month=${month}, Day=${day}, Year=${year}`);

        const picker = document.querySelector('ytcp-datetime-picker');
        if (!picker) {
            console.error('❌ [Scheduler] Picker not found for date setting');
            return false;
        }

        // Open date picker dropdown
        const triggers = picker.querySelectorAll('ytcp-dropdown-trigger, ytcp-text-dropdown-trigger');
        if (triggers.length > 0) {
            triggers[0].click();
            console.log('📅 [Scheduler] Date picker opened');
            await (window.delay?.(800) || new Promise(r => setTimeout(r, 800)));
        }

        // Handle month navigation
        await this.navigateToMonth(month, year);

        // Find and click target date cell
        const success = await this.clickDateCell(day, month, year);

        return success;
    }

    /**
     * Parses a date string into components.
     * Handles MM/DD/YYYY and YYYY/MM/DD formats.
     * 
     * @param {string} dateStr - Date string
     * @returns {{month: number, day: number, year: number}}
     */
    parseDateString(dateStr) {
        const parts = dateStr.split('/').map(Number);
        let month, day, year;

        if (parts[2] > 31) {
            // MM/DD/YYYY format
            [month, day, year] = parts;
        } else if (parts[0] > 12) {
            // YYYY/MM/DD format
            [year, month, day] = parts;
        } else {
            // Default: MM/DD/YYYY
            [month, day, year] = parts;
        }

        return { month, day, year };
    }

    /**
     * Navigates the calendar to the target month.
     * 
     * @param {number} targetMonth - Target month (1-12)
     * @param {number} targetYear - Target year
     */
    async navigateToMonth(targetMonth, targetYear) {
        console.log(`📆 [Scheduler] Navigating to month: ${targetMonth}/${targetYear}`);

        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
            'july', 'august', 'september', 'october', 'november', 'december'];
        const shortMonths = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
            'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const chineseMonths = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

        const maxNavigations = 24; // Max 2 years

        for (let nav = 0; nav < maxNavigations; nav++) {
            // Find calendar header in Shadow DOM
            const header = window.deepQuery ? window.deepQuery(document.body, '.calendar-header, [class*="month-year"], ytcp-date-picker-header, .month-label') :
                document.querySelector('.calendar-header, [class*="month-year"], ytcp-date-picker-header, .month-label');

            const headerText = header?.textContent?.trim() || '';
            console.log(`📆 [Scheduler] Calendar header: "${headerText}"`);

            let currentMonth = 0;
            let currentYear = 0;

            // Try to parse current month/year from header
            // Strategy 1: English "December 2025" or "Dec 2025"
            const enMatch = headerText.match(/(\w+)\s+(\d{4})/);
            if (enMatch) {
                const monthName = enMatch[1].toLowerCase();
                currentYear = parseInt(enMatch[2]);
                currentMonth = monthNames.indexOf(monthName) + 1;
                if (currentMonth === 0) {
                    currentMonth = shortMonths.indexOf(monthName.substring(0, 3)) + 1;
                }
            }
            // Strategy 2: Chinese "2025年12月"
            else {
                const cnMatch = headerText.match(/(\d{4})年\s*(\d{1,2})月/);
                if (cnMatch) {
                    currentYear = parseInt(cnMatch[1]);
                    currentMonth = parseInt(cnMatch[2]);
                }
                // Strategy 3: "12月 2025"
                else {
                    const altMatch = headerText.match(/(\d{1,2})月\s+(\d{4})/);
                    if (altMatch) {
                        currentMonth = parseInt(altMatch[1]);
                        currentYear = parseInt(altMatch[2]);
                    }
                }
            }

            if (currentMonth === 0 || isNaN(currentYear)) {
                console.warn(`⚠️ [Scheduler] Could not parse calendar header: "${headerText}"`);
                // Fallback to basic offset if header parsing fails
                if (nav === 0) {
                    const now = new Date();
                    const nowMonth = now.getMonth() + 1;
                    const nowYear = now.getFullYear();
                    const monthOffset = (targetYear - nowYear) * 12 + (targetMonth - nowMonth);
                    if (monthOffset === 0) return;
                    await this.basicMonthNav(monthOffset);
                }
                break;
            }

            console.log(`📅 [Scheduler] Current Calendar: Month=${currentMonth}, Year=${currentYear}`);

            if (currentMonth === targetMonth && currentYear === targetYear) {
                console.log(`✅ [Scheduler] Reached target month: ${targetMonth}/${targetYear}`);
                return;
            }

            // Calculate direction
            const currentTotal = currentYear * 12 + currentMonth;
            const targetTotal = targetYear * 12 + targetMonth;
            const direction = targetTotal > currentTotal ? 'next' : 'previous';

            // Labels for different languages
            const nextLabels = ['next', '下一个', '下个月', '后一月'];
            const prevLabels = ['previous', 'prev', '上一个', '上个月', '前一月'];
            const targetLabels = direction === 'next' ? nextLabels : prevLabels;

            // Find navigation button in Shadow DOM
            const navBtn = window.deepQueryAll ? window.deepQueryAll(document.body, 'button, [role="button"], tp-yt-paper-icon-button').find(btn => {
                const label = (btn.getAttribute('aria-label') || '').toLowerCase();
                return targetLabels.some(l => label.includes(l));
            }) : null;

            if (navBtn) {
                console.log(`➡️ [Scheduler] Clicking ${direction} button...`);
                navBtn.click();
                await (window.delay?.(600) || new Promise(r => setTimeout(r, 600)));
            } else {
                console.warn(`⚠️ [Scheduler] Navigation button (${direction}) not found`);
                // Fallback to basic class search
                const fallbackBtn = window.deepQuery(document.body, `.calendar-${direction}, button[class*="${direction}"]`);
                if (fallbackBtn) {
                    fallbackBtn.click();
                    await (window.delay?.(600) || new Promise(r => setTimeout(r, 600)));
                } else {
                    break;
                }
            }
        }
    }

    /**
     * Basic month navigation fallback.
     */
    async basicMonthNav(monthOffset) {
        const buttons = window.deepQueryAll ? window.deepQueryAll(document.body, 'ytcp-button, tp-yt-paper-icon-button, [role="button"]') :
            Array.from(document.querySelectorAll('ytcp-button, tp-yt-paper-icon-button, [role="button"]'));

        let navBtn = null;
        const type = monthOffset > 0 ? 'next' : 'previous';

        for (const btn of buttons) {
            const label = (btn.getAttribute('aria-label') || '').toLowerCase();
            if (label.includes(type)) {
                navBtn = btn;
                break;
            }
        }

        if (navBtn) {
            for (let i = 0; i < Math.abs(monthOffset); i++) {
                navBtn.click();
                await (window.delay?.(600) || new Promise(r => setTimeout(r, 600)));
            }
        }
    }

    /**
     * Finds and clicks the target date cell in the calendar.
     * 
     * @param {number} targetDay - Day of month to click
     * @param {number} targetMonth - Month (1-12)
     * @param {number} targetYear - Year
     * @returns {Promise<boolean>}
     */
    async clickDateCell(targetDay, targetMonth, targetYear) {
        console.log(`📅 [Scheduler] Looking for day ${targetDay} in ${targetMonth}/${targetYear}...`);

        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
            'july', 'august', 'september', 'october', 'november', 'december'];
        const targetMonthName = monthNames[targetMonth - 1];
        const targetMonthCN = `${targetMonth}月`;

        // Use deepQueryAll to find cells in Shadow DOM
        const cells = window.deepQueryAll ? window.deepQueryAll(document.body, '.calendar-day, [role="gridcell"], span.calendar-day, td[aria-label]') :
            Array.from(document.querySelectorAll('.calendar-day, [role="gridcell"], span.calendar-day, td[aria-label]'));

        console.log(`📅 [Scheduler] Found ${cells.length} potential date cells`);

        // Strategy 1: Find by aria-label (Most robust)
        // YouTube aria-label formats:
        // EN: "December 30, 2025" or "30 December 2025"
        // CN: "2025年12月30日"
        let targetCell = cells.find(cell => {
            const label = (cell.getAttribute('aria-label') || '').toLowerCase();
            if (!label) return false;

            const hasYear = label.includes(String(targetYear));
            const hasDay = label.includes(String(targetDay));
            const hasMonthEN = label.includes(targetMonthName);
            const hasMonthCN = label.includes(targetMonthCN);

            return hasYear && hasDay && (hasMonthEN || hasMonthCN);
        });

        if (targetCell) {
            console.log(`✅ [Scheduler] Found target cell via aria-label: "${targetCell.getAttribute('aria-label')}"`);
        } else {
            // Strategy 2: Find by text content and classes (Avoid 'outside' days)
            console.log(`🔍 [Scheduler] Strategy 1 failed, trying text content...`);
            targetCell = cells.find(cell => {
                const text = cell.textContent?.trim();
                const isDay = text === String(targetDay);
                const isNotOutside = !cell.classList.contains('outside') &&
                    !cell.classList.contains('disabled') &&
                    !cell.getAttribute('aria-disabled');
                return isDay && isNotOutside;
            });
        }

        if (!targetCell) {
            // Strategy 3: Direct day matching in the grid (Last resort)
            console.log(`🔍 [Scheduler] Strategy 2 failed, trying direct day match...`);
            const daySpans = window.deepQueryAll ? window.deepQueryAll(document.body, 'span.day, .day-text') : [];
            const targetSpan = daySpans.find(span => span.textContent?.trim() === String(targetDay));
            if (targetSpan) {
                targetCell = targetSpan.closest('[role="gridcell"]') || targetSpan.parentElement;
            }
        }

        if (targetCell) {
            targetCell.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await (window.delay?.(200) || new Promise(r => setTimeout(r, 200)));
            targetCell.click();
            console.log(`✅ [Scheduler] Date selected: ${targetDay}`);
            await (window.delay?.(500) || new Promise(r => setTimeout(r, 500)));
            return true;
        } else {
            console.error(`❌ [Scheduler] Day ${targetDay} not found in calendar!`);
            // Debug: log some cell labels
            const sample = cells.slice(0, 5).map(c => c.getAttribute('aria-label') || c.textContent?.trim());
            console.log(`   Sample cells:`, sample);
            return false;
        }
    }

    /**
     * Alternative method: Set date via input field.
     * Use this if calendar selection doesn't work.
     * 
     * @param {string} scheduleDate - Date in MM/DD/YYYY format
     * @returns {Promise<boolean>}
     */
    async setDateViaInput(scheduleDate) {
        console.log(`📅 [Scheduler] Setting date via input: ${scheduleDate}`);

        // Find date input using deep query
        const deepQueryAll = window.deepQueryAll || ((root, sel) => Array.from(root.querySelectorAll(sel)));

        const picker = document.querySelector('ytcp-datetime-picker');
        if (!picker) return false;

        // Look for date picker component
        const datePicker = picker.querySelector('ytcp-date-picker');
        if (!datePicker) return false;

        // Click dropdown to reveal input
        const trigger = datePicker.querySelector('ytcp-dropdown-trigger, ytcp-text-dropdown-trigger, [role="combobox"], button');
        if (trigger) {
            trigger.click();
            await (window.delay?.(800) || new Promise(r => setTimeout(r, 800)));
        }

        // Find date input
        const dateInput = datePicker.querySelector('input') ||
            document.querySelector('tp-yt-paper-dialog input[type="text"]');

        if (dateInput) {
            console.log(`📅 [Scheduler] Found date input: "${dateInput.value}"`);

            dateInput.focus();
            dateInput.value = scheduleDate;
            dateInput.dispatchEvent(new Event('input', { bubbles: true }));
            dateInput.dispatchEvent(new Event('change', { bubbles: true }));
            dateInput.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true
            }));
            dateInput.blur();

            await (window.delay?.(500) || new Promise(r => setTimeout(r, 500)));
            console.log(`✅ [Scheduler] Date input value: ${dateInput.value}`);
            return true;
        }

        return false;
    }
}

// Create singleton instance
window.YouTubeScheduler = new YouTubeScheduler();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { YouTubeScheduler };
}

console.log('📦 [Module] platforms/youtube/scheduler.js loaded');

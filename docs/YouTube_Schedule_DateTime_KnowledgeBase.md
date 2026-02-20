# YouTube Schedule Date/Time Setting Knowledge Base

> **Version:** 1.0  
> **Last Updated:** 2025-12-26  
> **Purpose:** NotebookLM Reference Document for Setting YouTube Video Schedule Date and Time
> **File:** `gemini-extension/content.js`

---

## 1. Overview

This document details the **complete, working implementation** for setting the schedule date and time in YouTube Studio's upload dialog. The scheduling process is complex due to YouTube Studio's custom Polymer/Lit-based components.

**Key Challenges:**
- YouTube Studio uses Shadow DOM extensively
- Date picker is a dropdown button, NOT a traditional input
- Time input requires character-by-character typing to trigger framework bindings
- Month navigation is required for future dates

---

## 2. Data Flow

### 2.1 From React to Content Script

```
React (YouTubeAnalytics.tsx)
    ↓
publishTimeLocal: "12/27/2025 10:00 AM"
    ↓
Split into:
    scheduleDate: "12/27/2025" (MM/DD/YYYY)
    scheduleTime: "10:00 AM"
    ↓
window.postMessage({ type: 'YOUTUBE_UPLOAD', ... })
    ↓
content.js receives and processes
```

### 2.2 Data Format

| Field | Format | Example |
|-------|--------|---------|
| `scheduleDate` | `MM/DD/YYYY` | `12/27/2025` |
| `scheduleTime` | `HH:MM AM/PM` | `10:00 AM` |

---

## 3. DOM Structure Analysis

### 3.1 YouTube Studio Scheduler Components

```
ytcp-uploads-dialog (Main Upload Dialog)
├── ytcp-menu-service-item-renderer (Visibility Selector)
│   └── "Schedule" option
├── ytcp-datetime-picker (Main DateTime Container)
│   ├── ytcp-dropdown-trigger (Date Picker Trigger)
│   │   └── ytcp-date-picker
│   │       ├── <input> (Date Input - appears after click)
│   │       └── Calendar popup (.calendar-day cells)
│   └── <input> (Time Input)
│       └── Paper dropdown for time selection
└── ytcp-button (Save/Schedule button)
```

### 3.2 Key Selectors

| Purpose | Selector |
|---------|----------|
| DateTime Picker Container | `ytcp-datetime-picker` |
| Date Picker Component | `ytcp-date-picker` |
| Date Dropdown Trigger | `ytcp-dropdown-trigger, ytcp-text-dropdown-trigger` |
| Time Input (in picker) | `ytcp-datetime-picker input` |
| Calendar Day Cells | `.calendar-day, [role="gridcell"], span.calendar-day` |
| Navigation Buttons | `[aria-label*="next"], [aria-label*="previous"]` |

---

## 4. Complete Implementation Code

### 4.1 Helper Function: Shadow DOM Traversal

YouTube Studio uses Shadow DOM extensively. This helper function searches through shadow roots:

```javascript
const deepQueryAll = (root, selector) => {
    const results = [];
    
    // 1. Check current root's light DOM children
    const nodes = Array.from(root.querySelectorAll('*'));
    
    // Also include the root itself if it matches
    if (root.matches && root.matches(selector)) results.push(root);
    
    // Add matching light DOM nodes
    nodes.forEach(node => {
        if (node.matches && node.matches(selector)) results.push(node);
    });
    
    // 2. Dive into Shadow Roots
    const allNodes = [root, ...nodes];
    allNodes.forEach(node => {
        if (node.shadowRoot) {
            results.push(...deepQueryAll(node.shadowRoot, selector));
        }
    });
    
    return results;
};
```

### 4.2 Step 1: Wait for DateTime Picker

```javascript
const waitForTimeInput = async () => {
    for (let i = 0; i < 20; i++) {
        const dateTimePicker = document.querySelector('ytcp-datetime-picker');
        
        if (dateTimePicker) {
            // Find the time input (contains AM/PM)
            const allInputs = deepQueryAll(dateTimePicker, 'input');
            const timeInput = allInputs.find(inp => 
                inp.value.includes('AM') || inp.value.includes('PM')
            );
            
            if (timeInput) {
                console.log(`✅ Found time input: "${timeInput.value}"`);
                return { timeInput, dateTimePicker };
            }
        }
        
        await new Promise(r => setTimeout(r, 500));
    }
    
    return null;
};
```

### 4.3 Step 2: Set Date (Primary Method)

```javascript
// 🔧 CRITICAL: Date is a DROPDOWN BUTTON, not an input field!
if (data.scheduleDate) {
    console.log(`📅 [Schedule] Setting date: ${data.scheduleDate}`);
    
    const datetimePicker = document.querySelector('ytcp-datetime-picker');
    if (datetimePicker) {
        // 1. Find the date picker component
        const datePicker = datetimePicker.querySelector('ytcp-date-picker');
        
        if (datePicker) {
            // 2. Find and click the dropdown button
            const dropdownBtn = datePicker.querySelector(
                'ytcp-dropdown-trigger, ytcp-text-dropdown-trigger, #textbox, ' +
                '.dropdown-trigger, [role="combobox"], button'
            );
            
            if (dropdownBtn) {
                // 3. Click to open calendar dropdown
                dropdownBtn.click();
                await new Promise(r => setTimeout(r, 800));
                
                // 4. Look for input that appears after clicking
                const dateInputAfterClick = datePicker.querySelector('input') ||
                    document.querySelector('tp-yt-paper-dialog input[type="text"]');
                
                if (dateInputAfterClick) {
                    // Set the date value
                    dateInputAfterClick.focus();
                    dateInputAfterClick.value = data.scheduleDate;
                    dateInputAfterClick.dispatchEvent(new Event('input', { bubbles: true }));
                    dateInputAfterClick.dispatchEvent(new Event('change', { bubbles: true }));
                    dateInputAfterClick.dispatchEvent(new KeyboardEvent('keydown', {
                        key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true
                    }));
                    dateInputAfterClick.blur();
                }
            }
        }
    }
}
```

### 4.4 Step 3: Calendar Cell Selection (Fallback Method)

If direct input doesn't work, click the calendar day cell:

```javascript
// Parse date parts
const dateParts = data.scheduleDate.split('/').map(Number);
let month, day, year;

if (dateParts[2] > 31) {
    [month, day, year] = dateParts; // MM/DD/YYYY
} else if (dateParts[0] > 12) {
    [year, month, day] = dateParts; // YYYY/MM/DD
} else {
    [month, day, year] = dateParts; // Default: MM/DD/YYYY
}

// Handle month navigation (if target month differs from current)
const now = new Date();
const currentMonth = now.getMonth() + 1;
const currentYear = now.getFullYear();
const monthOffset = (year - currentYear) * 12 + (month - currentMonth);

if (monthOffset !== 0) {
    // Find navigation button
    const buttons = document.querySelectorAll('ytcp-button, tp-yt-paper-icon-button, [role="button"]');
    let navBtn = null;
    
    for (const btn of buttons) {
        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
        if (monthOffset > 0 && label.includes('next')) {
            navBtn = btn;
            break;
        }
        if (monthOffset < 0 && label.includes('previous')) {
            navBtn = btn;
            break;
        }
    }
    
    // Click navigation button to reach target month
    if (navBtn) {
        for (let i = 0; i < Math.abs(monthOffset); i++) {
            navBtn.click();
            await new Promise(r => setTimeout(r, 600));
        }
    }
}

// Scan and select date cell
const dateCells = [];
const allElements = document.querySelectorAll('*');

for (const el of allElements) {
    const text = el.textContent?.trim();
    const rect = el.getBoundingClientRect();
    
    // Identify day cells by: numeric 1-31, size ~40x40px, minimal children
    const isDay = /^([1-9]|[12][0-9]|3[01])$/.test(text);
    const goodSize = rect.width > 20 && rect.width < 60 && rect.height > 20 && rect.height < 60;
    const isLeaf = el.children.length < 3;
    
    if (isDay && goodSize && isLeaf) {
        dateCells.push({ el, day: parseInt(text) });
    }
}

// Deduplicate (same day may appear in multiple elements)
const seen = new Set();
const uniqueCells = dateCells.filter(cell => {
    if (seen.has(cell.day)) return false;
    seen.add(cell.day);
    return true;
});

// Click target date
const targetCell = uniqueCells.find(c => c.day === day);
if (targetCell) {
    targetCell.el.click();
    console.log(`✅ Date selected: ${day}`);
}
```

### 4.5 Step 4: Set Time (Character-by-Character Method)

```javascript
const picker = document.querySelector('ytcp-datetime-picker');
const timeInput = picker.querySelector('input');

if (timeInput) {
    console.log(`⏰ [Time] Current: "${timeInput.value}", Target: "${data.scheduleTime}"`);
    
    // 1. Click to focus and open dropdown
    timeInput.click();
    await new Promise(r => setTimeout(r, 300));
    timeInput.focus();
    
    // 2. Select all and clear
    timeInput.setSelectionRange(0, timeInput.value.length);
    timeInput.value = '';
    timeInput.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 100));
    
    // 3. Type the new time character by character
    // This is CRITICAL - YouTube's framework requires individual keystrokes
    for (const char of data.scheduleTime) {
        timeInput.value += char;
        timeInput.dispatchEvent(new InputEvent('input', { 
            bubbles: true, 
            data: char, 
            inputType: 'insertText' 
        }));
        await new Promise(r => setTimeout(r, 30));
    }
    
    // 4. Dispatch change event
    timeInput.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 200));
    
    // 5. Try to find matching dropdown option and click it
    const options = document.querySelectorAll(
        'tp-yt-paper-item, [role="option"], [role="listitem"]'
    );
    let matched = false;
    for (const opt of options) {
        const optText = opt.textContent?.trim();
        if (optText === data.scheduleTime) {
            opt.click();
            matched = true;
            break;
        }
    }
    
    // 6. If no dropdown match, press Enter to confirm
    if (!matched) {
        timeInput.dispatchEvent(new KeyboardEvent('keydown', { 
            key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true 
        }));
        timeInput.dispatchEvent(new KeyboardEvent('keyup', { 
            key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true 
        }));
    }
    
    timeInput.blur();
}
```

---

## 5. Critical Implementation Notes

### 5.1 Why Character-by-Character Typing?

YouTube Studio uses Polymer/Lit framework. **Direct value assignment DOES NOT trigger framework bindings.**

```javascript
// ❌ DOES NOT WORK - framework doesn't detect change
timeInput.value = "10:00 AM";

// ✅ WORKS - framework bindings are triggered
for (const char of "10:00 AM") {
    timeInput.value += char;
    timeInput.dispatchEvent(new InputEvent('input', { 
        bubbles: true, 
        data: char, 
        inputType: 'insertText' 
    }));
    await new Promise(r => setTimeout(r, 30));
}
```

### 5.2 Date Picker Order Matters

Always set **TIME FIRST**, then **DATE**. This prevents race conditions where the date picker closing resets the time.

### 5.3 Event Sequence

For inputs to be recognized by YouTube Studio's framework:

```javascript
// Required event sequence:
input.focus();
input.value = newValue;
input.dispatchEvent(new Event('input', { bubbles: true }));
input.dispatchEvent(new Event('change', { bubbles: true }));
input.dispatchEvent(new KeyboardEvent('keydown', { 
    key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true 
}));
input.blur();
```

### 5.4 Shadow DOM Traversal

Many YouTube Studio components use Shadow DOM. Use the `deepQueryAll` helper:

```javascript
// Instead of:
document.querySelector('ytcp-date-picker input') // May not find shadow content

// Use:
deepQueryAll(document.body, 'input') // Searches through shadow roots
```

---

## 6. Debugging Tips

### 6.1 Console Commands for Testing

```javascript
// Find datetime picker
document.querySelector('ytcp-datetime-picker');

// List all inputs in picker
const picker = document.querySelector('ytcp-datetime-picker');
Array.from(picker.querySelectorAll('input')).forEach((inp, i) => {
    console.log(`Input ${i}: value="${inp.value}"`);
});

// Find date cells
document.querySelectorAll('.calendar-day, [role="gridcell"]').forEach(el => {
    console.log(`Cell: ${el.textContent}`);
});
```

### 6.2 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Date not changing | Click input but no dropdown appeared | Add delay after click |
| Time shows wrong value | Direct assignment without events | Use character-by-character method |
| Wrong month selected | Month navigation not triggered | Calculate monthOffset and navigate |
| Day cell not found | Looking in wrong calendar | Wait for calendar popup to appear |

---

## 7. Complete Flow Summary

```
1. Wait for ytcp-datetime-picker to appear
   ↓
2. Find time input (contains AM/PM)
   ↓
3. Set TIME:
   - Click and focus input
   - Clear existing value
   - Type characters one-by-one
   - Find dropdown option and click (or press Enter)
   ↓
4. Set DATE:
   - Find date picker dropdown trigger
   - Click to open calendar
   - Navigate months if needed
   - Find day cell by text content
   - Click target day
   ↓
5. Verification:
   - Check input values
   - Click outside to close dropdowns
```

---

## 8. Related Files

| File | Purpose |
|------|---------|
| `gemini-extension/content.js` | Main implementation (lines 4680-5150) |
| `gemini-extension/youtube-analytics.js` | Alternative implementation |
| `components/YouTubeAnalytics.tsx` | React side data preparation |

---

## 9. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-26 | Initial documented version (Proven Working) |

---

*End of Knowledge Base Document*

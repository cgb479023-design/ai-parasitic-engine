# Ask Studio JSON Parsing Knowledge Base

> **Version:** 1.0  
> **Last Updated:** 2025-12-26  
> **Purpose:** NotebookLM Reference Document for Ask Studio JSON Extraction

---

## Overview

This document details the technical implementation for extracting JSON responses from YouTube Studio's **Ask Studio** feature. The Ask Studio dialog returns AI-generated content plans in JSON format, which must be captured and parsed by our Chrome extension.

---

## 1. Ask Studio DOM Structure

### 1.1 Container Hierarchy

```
.ytcpCreatorChatContentWrapper (Main Dialog Container)
├── .ytcpCreatorChatScrollContainer
│   └── .ytcpCreatorChatTurns (Message Container)
│       ├── UI Elements (Suggestions, Welcome Text)
│       ├── User Message
│       └── AI Response
│           └── <code class="language-json"> ← TARGET ELEMENT
│               └── JSON Content (clean, parseable)
```

### 1.2 Key Selectors

| Selector | Purpose | Notes |
|----------|---------|-------|
| `.ytcpCreatorChatContentWrapper` | Main dialog container | Contains all messages and UI |
| `code.language-json` | JSON code block | **Primary extraction target** |
| `code` (fallback) | Any code element | Search for one containing `"algorithmStage"` |

### 1.3 Important Discovery

**The JSON response is rendered inside a `<code class="language-json">` element.** This element contains clean, parseable JSON without UI interference.

---

## 2. The Problem: DOM Order ≠ Visual Order

### 2.1 Initial Approach (Failed)

```javascript
// WRONG: Using innerText of container
const container = document.querySelector('.ytcpCreatorChatContentWrapper');
const text = container.innerText;
```

**Problem:** `innerText` returns text in **DOM order**, not **visual order**. CSS positioning can change visual layout without changing DOM structure.

### 2.2 Symptoms of the Problem

1. **Truncated JSON:** Only 118 characters extracted instead of 13,000+
2. **Wrong content order:** JSON ended with content that should be at the beginning
3. **Parse errors:** "Expected property name or '}' at position 85"
4. **UI text mixed in:** Extracted text included "How can I help you?" and suggestions

### 2.3 Character Encoding Issues

When using `innerText`, we observed non-ASCII characters:
```
Char codes 80-90: [116, 115, 34, 58, 123, 45, 46, 46, 228, 64]
                                               ↑     ↑
                                        Non-standard characters!
```

These characters (code 228, 64) were UI formatting markers that broke JSON parsing.

---

## 3. The Solution: Extract from CODE Element

### 3.1 Correct Approach

```javascript
// CORRECT: Find and use the CODE element
let codeElement = document.querySelector('code.language-json');

if (!codeElement) {
    // Fallback: search all code elements
    const allCodes = document.querySelectorAll('code');
    for (const c of allCodes) {
        if (c.textContent?.includes('"algorithmStage"')) {
            codeElement = c;
            break;
        }
    }
}

if (codeElement) {
    const jsonText = codeElement.textContent; // Clean JSON!
    const parsed = JSON.parse(jsonText);
}
```

### 3.2 Why This Works

1. **CODE elements contain raw text:** No formatting interference
2. **`textContent` vs `innerText`:** `textContent` returns raw text without CSS considerations
3. **Single element:** The JSON is contained entirely within one CODE element
4. **No UI contamination:** CODE element contains ONLY the JSON response

---

## 4. Timing Considerations

### 4.1 The Timing Problem

The CODE element is rendered **after** the initial response loads. If we check too early:
- Container exists ✓
- `innerText` contains JSON markers ✓
- But CODE element doesn't exist yet ✗

### 4.2 Solution: Wait for CODE Element

```javascript
const checkResponse = setInterval(() => {
    attempts++;
    
    // Look for CODE element
    let codeElement = document.querySelector('code.language-json');
    
    if (!codeElement) {
        const allCodes = document.querySelectorAll('code');
        for (const c of allCodes) {
            if (c.textContent?.includes('"algorithmStage"')) {
                codeElement = c;
                break;
            }
        }
    }
    
    // Wait specifically for CODE element if container has JSON but no code yet
    if (!codeElement && containerText.includes('"algorithmStage"') && attempts < 60) {
        console.log('Waiting for CODE element to render...');
        return; // Keep waiting
    }
    
    // Only use container fallback after timeout (120 seconds)
    if (codeElement) {
        text = codeElement.textContent;
    } else if (attempts > 120) {
        text = containerText; // Fallback
    } else {
        return; // Keep waiting
    }
}, 1000);
```

---

## 5. JSON Structure Expected

### 5.1 Full Plan Structure

```json
{
    "algorithmStage": "Saturation Attack V5.0 - Algorithm Domination",
    "channelInsights": {
        "targetMetrics": { ... },
        "currentPerformance": { ... }
    },
    "algorithmScores": {
        "PSI": 0.2,
        "predictedRetentions": 92.0,
        "predictedLoopRate": 33.0,
        "controversyQuotient": 3.5
    },
    "schedule": [
        {
            "pillar": "...",
            "title": "...",
            "publishTimeLocal": "2025-12-26 14:00:00",
            "promptBlock": { ... }
        }
    ]
}
```

### 5.2 Key Fields for Validation

| Field | Purpose | Example |
|-------|---------|---------|
| `algorithmStage` | Current strategy phase | "Saturation Attack V5.0" |
| `schedule` | Array of content items | Array with 6 items |
| `schedule[].publishTimeLocal` | Publication time | "2025-12-26 14:00:00" |
| `schedule[].promptBlock` | Video generation prompt | Object with HOOK, CONTEXT, etc. |

---

## 6. Debugging Techniques

### 6.1 DOM Exploration Script

```javascript
// Run in YouTube Studio console to explore DOM
(function() {
    const wrapper = document.querySelector('.ytcpCreatorChatContentWrapper');
    
    // Check for code elements
    const codes = wrapper?.querySelectorAll('code');
    console.log(`Found ${codes?.length} code elements`);
    
    for (const c of codes) {
        console.log('Code element:', {
            class: c.className,
            length: c.textContent?.length,
            hasJSON: c.textContent?.includes('"algorithmStage"')
        });
    }
})();
```

### 6.2 JSON Extraction Test Script

```javascript
// Test JSON extraction from CODE element
(function() {
    const wrapper = document.querySelector('.ytcpCreatorChatContentWrapper');
    const codes = wrapper?.querySelectorAll('code');
    
    for (const c of codes) {
        if (c.textContent?.includes('"algorithmStage"')) {
            const text = c.textContent;
            console.log('Found JSON, length:', text.length);
            
            try {
                const parsed = JSON.parse(text);
                console.log('✅ Valid JSON!');
                console.log('Schedule items:', parsed.schedule?.length);
            } catch (e) {
                console.error('❌ Parse failed:', e.message);
            }
            break;
        }
    }
})();
```

### 6.3 Common Error Patterns

| Error | Cause | Solution |
|-------|-------|----------|
| "position 85" parse error | DOM ordering issue | Use CODE element |
| Only 118 chars extracted | Wrong end index | Wait for CODE element |
| "controversyQuotient" at end | Reversed content order | Don't use innerText |
| Non-ASCII characters | UI formatting | Use textContent from CODE |

---

## 7. Implementation in content.js

### 7.1 Key Code Location

**File:** `gemini-extension/content.js`  
**Function:** Inside `setInterval` callback for Ask Studio response capture  
**Lines:** ~2350-2450

### 7.2 Flow Summary

```
1. Poll every 1 second
2. Look for code.language-json element
3. If not found, search all code elements for one with "algorithmStage"
4. Wait up to 60 seconds for CODE element if container has JSON markers
5. Extract textContent from CODE element
6. Validate JSON starts with { and contains algorithmStage
7. Parse and relay to React application
```

### 7.3 Fallback Strategy

```
Priority 1: code.language-json selector
Priority 2: Any code element with "algorithmStage"
Priority 3: Container innerText (after 120 second timeout)
```

---

## 8. Related Files

| File | Purpose |
|------|---------|
| `gemini-extension/content.js` | Main extraction logic |
| `gemini-extension/background.js` | Message relay to React |
| `components/YouTubeAnalytics.tsx` | React handler for plan data |

---

## 9. Lessons Learned

1. **Never trust `innerText`** for structured data extraction
2. **Find the cleanest source:** Look for code blocks, pre elements, or specific containers
3. **Timing matters:** DOM elements may render after initial page load
4. **Test with real data:** Console scripts can validate logic before implementation
5. **Log extensively:** Position markers, character codes, and content snippets help debugging

---

## 10. Quick Reference

### Selector for JSON:
```javascript
document.querySelector('code.language-json')
```

### Validate JSON:
```javascript
const text = codeElement.textContent;
if (text.trim().startsWith('{') && text.includes('"algorithmStage"')) {
    const parsed = JSON.parse(text);
}
```

### Wait for element:
```javascript
if (!codeElement && containerText.includes('"algorithmStage"') && attempts < 60) {
    return; // Keep waiting
}
```

---

*End of Knowledge Base Document*

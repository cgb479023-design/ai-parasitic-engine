const fs = require('fs');
const path = 'e:\\ai-内容创作智能化平台\\gemini-extension\\content.js';

try {
    const data = fs.readFileSync(path, 'utf8');
    const lines = data.split('\n');

    // Find the time setting logic block
    let startLine = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('// STRATEGY: Type -> Wait for Dropdown -> Click Match')) {
            startLine = i;
            break;
        }
    }

    if (startLine !== -1) {
        // We will replace the entire try block with a new strategy: Type + Click List
        const newCode = `                                                try {
                                                    // STRATEGY: Type -> Wait for Dropdown -> Click Match
                                                    console.log(\`🕒 [Schedule] Setting time to: \${data.scheduleTime}\`);
                                                    
                                                    timeInput.focus();
                                                    timeInput.select();
                                                    document.execCommand('selectAll', false, null);
                                                    document.execCommand('insertText', false, data.scheduleTime);
                                                    
                                                    // Dispatch input to trigger dropdown
                                                    timeInput.dispatchEvent(new Event('input', { bubbles: true }));
                                                    
                                                    await new Promise(r => setTimeout(r, 800)); // Wait for dropdown
                                                    
                                                    // Try to find the item in the dropdown
                                                    // FIX: Use a more inclusive selector for the dropdown items
                                                    const timeListItems = deepQueryAll(document.body, 'tp-yt-paper-item, .ytcp-text-dropdown-trigger, .item');
                                                    
                                                    // FIX: Use includes() instead of exact match to handle hidden characters or whitespace
                                                    const matchingItem = timeListItems.find(item => {
                                                        const text = item.textContent.trim();
                                                        return text === data.scheduleTime || text.includes(data.scheduleTime);
                                                    });
                                                    
                                                    if (matchingItem && matchingItem.offsetParent) {
                                                        console.log("✅ [Schedule] Found matching time in dropdown, clicking...");
                                                        matchingItem.click();
                                                    } else {
                                                        console.warn("⚠️ [Schedule] Dropdown item not found, relying on text input...");
                                                        // Fallback to blur + enter
                                                        timeInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
                                                        timeInput.blur();
                                                    }

                                                    // Final verification
                                                    await new Promise(r => setTimeout(r, 1000));
                                                    if (timeInput.value !== data.scheduleTime) {
                                                        console.warn(\`⚠️ [Schedule] Mismatch! Retrying force set...\`);
                                                        timeInput.value = data.scheduleTime;
                                                        timeInput.dispatchEvent(new Event('change', { bubbles: true }));
                                                    }
                                                    
                                                    console.log(\`✅ [Schedule] Final time value: \${timeInput.value}\`);

                                                } catch (e) {
                                                    console.error("❌ Error setting time:", e);
                                                }`;

        // Find end of the block (catch block)
        let endLine = -1;
        for (let i = startLine; i < lines.length; i++) {
            if (lines[i].includes('} catch (e) {')) {
                endLine = i + 2;
                break;
            }
        }

        if (endLine !== -1) {
            lines.splice(startLine - 1, endLine - (startLine - 1) + 1, newCode); // -1 to include try {
            const newContent = lines.join('\n');
            fs.writeFileSync(path, newContent, 'utf8');
            console.log('Successfully updated time setting logic to Type+Click strategy');
        } else {
            console.error('Could not find end of block');
        }
    } else {
        console.error('Could not find start of block');
    }

} catch (err) {
    console.error('Error updating file:', err);
}

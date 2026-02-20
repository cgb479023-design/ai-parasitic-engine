const fs = require('fs');
const path = 'e:\\ai-内容创作智能化平台\\gemini-extension\\content.js';

try {
    const data = fs.readFileSync(path, 'utf8');
    const lines = data.split('\n');

    // We want to replace the execCommand block with the direct value setting block
    // but with robust event dispatching.

    const newCode = `                                                try {
                                                    // HYBRID APPROACH: Direct Value + Events (Restored & Enhanced)
                                                    timeInput.focus();
                                                    
                                                    // 1. Try Direct Assignment first (User reported this worked better previously)
                                                    timeInput.value = data.scheduleTime;
                                                    
                                                    // 2. Dispatch ALL the events
                                                    timeInput.dispatchEvent(new Event('input', { bubbles: true }));
                                                    timeInput.dispatchEvent(new Event('change', { bubbles: true }));
                                                    
                                                    // 3. Simulate Key Events (Enter) to confirm selection
                                                    timeInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
                                                    timeInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));
                                                    
                                                    timeInput.blur();

                                                    console.log(\`✅ [Schedule] Time set via direct value to: \${timeInput.value}\`);

                                                    // Verify
                                                    await new Promise(r => setTimeout(r, 500));
                                                    if (timeInput.value === data.scheduleTime) {
                                                        console.log(\`✅ [Schedule] Time verified: \${timeInput.value}\`);
                                                        break; // Success!
                                                    } else {
                                                        console.warn(\`⚠️ [Schedule] Time mismatch after set. Expected: \${data.scheduleTime}, Got: \${timeInput.value}\`);
                                                        
                                                        // Fallback: Try execCommand if direct failed
                                                        console.log("🔄 Retrying with execCommand...");
                                                        timeInput.focus();
                                                        timeInput.select();
                                                        document.execCommand('insertText', false, data.scheduleTime);
                                                        timeInput.dispatchEvent(new Event('input', { bubbles: true }));
                                                        timeInput.dispatchEvent(new Event('change', { bubbles: true }));
                                                        timeInput.blur();
                                                    }
                                                } catch (e) {
                                                    console.error("❌ Error setting time:", e);
                                                }`;

    let startLine = -1;
    let endLine = -1;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('// DIRECT VALUE SETTING via execCommand (More robust)')) {
            startLine = i - 1; // Include the try {
            // Find the closing brace of the catch block
            for (let j = i; j < lines.length; j++) {
                if (lines[j].includes('console.error("?Error setting time:", e);')) {
                    endLine = j + 1; // Include the closing brace
                    break;
                }
            }
            break;
        }
    }

    if (startLine !== -1 && endLine !== -1) {
        console.log(`Found block at lines ${startLine + 1} to ${endLine + 1}`);
        lines.splice(startLine, endLine - startLine + 1, newCode);
        const newContent = lines.join('\n');
        fs.writeFileSync(path, newContent, 'utf8');
        console.log('Successfully reverted time input logic');
    } else {
        console.error('Could not find the code block to replace.');
    }

} catch (err) {
    console.error('Error updating file:', err);
}

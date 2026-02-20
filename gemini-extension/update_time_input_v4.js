const fs = require('fs');
const path = 'e:\\ai-内容创作智能化平台\\gemini-extension\\content.js';

try {
    const data = fs.readFileSync(path, 'utf8');
    const lines = data.split('\n');

    const newCode = `                                                try {
                                                    // DIRECT VALUE SETTING via execCommand (More robust)
                                                    timeInput.focus();
                                                    // Select all existing text
                                                    timeInput.select(); 
                                                    document.execCommand('selectAll', false, null);
                                                    
                                                    // Insert the new time
                                                    document.execCommand('insertText', false, data.scheduleTime);
                                                    
                                                    // Dispatch events to ensure framework picks it up
                                                    timeInput.dispatchEvent(new Event('input', { bubbles: true }));
                                                    timeInput.dispatchEvent(new Event('change', { bubbles: true }));
                                                    timeInput.blur();`;

    let startLine = -1;
    let endLine = -1;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('// DIRECT VALUE SETTING (Verified to work!)')) {
            startLine = i;
            // We replace until the timeInput.blur() line
            for (let j = i; j < lines.length; j++) {
                if (lines[j].includes('timeInput.blur();')) {
                    endLine = j;
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
        console.log('Successfully updated content.js');
    } else {
        console.error('Could not find the code block to replace.');
    }

} catch (err) {
    console.error('Error updating file:', err);
}

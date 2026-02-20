const fs = require('fs');
const path = require('path');

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const snapshotDir = path.join('.gemini', 'snapshots', timestamp);

if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir, { recursive: true });
}

const filesToSnapshot = [
    { src: 'gemini-extension/youtube-analytics.js', dest: 'youtube-analytics.js' },
    { src: 'gemini-extension/content.js', dest: 'content.js' },
    { src: 'gemini-extension/background.js', dest: 'background.js' },
    { src: 'gemini-extension/platforms/youtube/studioAgent.js', dest: 'studioAgent.js' },
    { src: 'gemini-extension/platforms/youtube/studioUploader.js', dest: 'studioUploader.js' },
    { src: 'components/YouTubeAnalytics.tsx', dest: 'YouTubeAnalytics.tsx' }
];

console.log(`Creating snapshot in: ${snapshotDir}`);

filesToSnapshot.forEach(file => {
    const srcPath = path.resolve(file.src);
    const destPath = path.join(snapshotDir, file.dest);

    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`[OK] Copied: ${file.src}`);
    } else {
        console.error(`[ERROR] File not found: ${file.src}`);
    }
});

const manifestPath = path.join(snapshotDir, 'MANIFEST.txt');
const manifestContent = `Snapshot: ${timestamp}\nCreated: ${new Date().toISOString()}\nFiles:\n` +
    filesToSnapshot.map(f => {
        const p = path.resolve(f.src);
        return fs.existsSync(p) ? `  - ${f.src}: ${fs.statSync(p).size} bytes` : `  - ${f.src}: MISSING`;
    }).join('\n');

fs.writeFileSync(manifestPath, manifestContent);
console.log('[SUCCESS] Snapshot created.');

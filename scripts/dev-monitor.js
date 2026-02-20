import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { execSync } from 'child_process';

// Configuration
const WATCH_DIRS = ['gemini-extension', 'src'];
const GOLDEN_FILES = [
    'gemini-extension/content.js',
    'gemini-extension/background.js',
    'gemini-extension/platforms/youtube/studioAgent.js',
    'gemini-extension/platforms/youtube/commentAutomation.js',
    'src/components/YouTubeAnalytics.tsx'
];

const SNAPSHOT_DIR = path.join(__dirname, '../.gemini/snapshots');
const DEBOUNCE_MS = 1000;

let lastTrigger = 0;

function getLatestSnapshotTime() {
    if (!fs.existsSync(SNAPSHOT_DIR)) return 0;
    const files = fs.readdirSync(SNAPSHOT_DIR);
    if (files.length === 0) return 0;

    // Snapshots are named like snapshot-YYYY-MM-DDTHH-mm-ss
    // We can just sort by name to get the latest
    files.sort().reverse();
    const latest = files[0];

    try {
        const stat = fs.statSync(path.join(SNAPSHOT_DIR, latest));
        return stat.mtimeMs;
    } catch (e) {
        return 0;
    }
}

function checkSafety(filename) {
    const now = Date.now();
    if (now - lastTrigger < DEBOUNCE_MS) return;
    lastTrigger = now;

    // Normalize filename for cross-platform check
    const relativePath = filename.replace(/\\/g, '/');

    // Check if it's a golden file
    const isGolden = GOLDEN_FILES.some(gf => relativePath.endsWith(gf) || gf.endsWith(relativePath));

    if (isGolden) {
        console.log(`\n🔔 Detected change in Golden File: ${filename}`);

        const lastSnapshotTime = getLatestSnapshotTime();
        const timeSinceSnapshot = now - lastSnapshotTime;
        const ONE_HOUR = 60 * 60 * 1000;

        if (timeSinceSnapshot > ONE_HOUR) {
            console.log('\x1b[31m%s\x1b[0m', '⚠️  WARNING: No recent snapshot found! (Last one > 1 hour ago)');
            console.log('\x1b[33m%s\x1b[0m', '👉 Suggestion: Run /create_snapshot immediately to save your state.');
        } else {
            console.log('\x1b[32m%s\x1b[0m', '✅ Recent snapshot exists. Safe to proceed.');
        }

        console.log('\x1b[36m%s\x1b[0m', '👉 Suggestion: Run `npm run verify:quick` to check for regressions.');
    }
}

function startMonitor() {
    console.log('👀 Dev Monitor started...');
    console.log('   Watching for changes in Golden Files...');

    WATCH_DIRS.forEach(dir => {
        const dirPath = path.join(process.cwd(), dir);
        if (fs.existsSync(dirPath)) {
            console.log(`   - Watching ${dir}`);
            fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
                if (filename && (filename.endsWith('.js') || filename.endsWith('.tsx') || filename.endsWith('.ts'))) {
                    checkSafety(path.join(dir, filename));
                }
            });
        } else {
            console.log(`   ⚠️ Directory not found: ${dir}`);
        }
    });
}

startMonitor();

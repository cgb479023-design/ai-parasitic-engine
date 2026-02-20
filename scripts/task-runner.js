import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const TASKS = [
    {
        name: 'VITE',
        command: 'npm',
        args: ['run', 'dev'],
        color: '\x1b[36m' // Cyan
    },
    {
        name: 'MONITOR',
        command: 'npm',
        args: ['run', 'dev:monitor'],
        color: '\x1b[35m' // Magenta
    },
    {
        name: 'TSC',
        command: 'npx',
        args: ['tsc', '--noEmit', '--watch', '--preserveWatchOutput'],
        color: '\x1b[33m' // Yellow
    }
];

const processes = [];

function startTask(task) {
    console.log(`${task.color}[${task.name}] Starting...${'\x1b[0m'}`);

    const cmd = process.platform === 'win32' ? `${task.command}.cmd` : task.command;

    const child = spawn(cmd, task.args, {
        cwd: process.cwd(),
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    processes.push(child);

    child.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
            if (line.trim()) {
                console.log(`${task.color}[${task.name}] ${line.trim()}${'\x1b[0m'}`);
            }
        });
    });

    child.stderr.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
            if (line.trim()) {
                console.log(`${task.color}[${task.name}] \x1b[31m${line.trim()}${'\x1b[0m'}`);
            }
        });
    });

    child.on('close', (code) => {
        if (code !== 0 && code !== null) {
            console.log(`${task.color}[${task.name}] Exited with code ${code}${'\x1b[0m'}`);
        }
    });
}

function stopAll() {
    console.log('\n🛑 Stopping all tasks...');
    processes.forEach(p => p.kill());
    process.exit(0);
}

// Handle termination signals
process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);

// Start tasks
console.log('🚀 Mission Control Started');
console.log('==========================');
TASKS.forEach(startTask);

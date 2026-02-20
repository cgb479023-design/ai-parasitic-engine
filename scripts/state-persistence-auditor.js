#!/usr/bin/env node
/**
 * State Persistence Auditor - 状态持久化脏数据检查工具
 * 
 * 检测 localStorage/sessionStorage 的使用是否有清理逻辑，
 * 防止重启后状态不一致导致 UI 锁死等问题。
 * 
 * 用法: node scripts/state-persistence-auditor.js
 * 
 * @version 1.0.0
 * @date 2026-01-15
 */

const fs = require('fs');
const path = require('path');

// ANSI 颜色码
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

// 配置
const CONFIG = {
    scanDirs: [
        path.join(__dirname, '..', 'components'),
        path.join(__dirname, '..', 'src'),
        path.join(__dirname, '..', 'gemini-extension')
    ],
    excludeDirs: ['node_modules', '.git', 'backup', 'dist'],
    // 已知有清理逻辑的 key（白名单）
    whitelistedKeys: [
        'gemini_pending_comments',      // commentAutomation handles cleanup
        'extension_settings',            // User settings, intentional persistence
        'ypp_plan_cache',                // Cache with TTL
        'analytics_cache'                // Cache with TTL
    ],
    // 已知的危险模式
    dangerousPatterns: [
        { key: 'isExecutingPlan', reason: 'Boolean flag that blocks UI if stale' },
        { key: 'isGenerating', reason: 'Boolean flag that can block UI' },
        { key: 'isProcessing', reason: 'Boolean flag that can block UI' },
        { key: 'isLoading', reason: 'Boolean flag that can block UI' },
        { key: 'isUploading', reason: 'Boolean flag that can block UI' },
        { key: 'pendingUpload', reason: 'May reference stale data' },
        { key: 'currentVideoIndex', reason: 'May be out of sync with queue' }
    ]
};

/**
 * 递归获取所有文件
 */
function getAllFiles(dir, extensions = ['.tsx', '.ts', '.jsx', '.js'], fileList = []) {
    if (!fs.existsSync(dir)) return fileList;

    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            if (!CONFIG.excludeDirs.includes(file)) {
                getAllFiles(filePath, extensions, fileList);
            }
        } else {
            const ext = path.extname(file);
            if (extensions.includes(ext)) {
                fileList.push(filePath);
            }
        }
    }

    return fileList;
}

/**
 * 从文件中提取 localStorage 操作
 */
function extractStorageOperations(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const operations = [];

    // 匹配 localStorage.getItem('key') 或 localStorage.getItem("key")
    const getItemRegex = /localStorage\.getItem\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    let match;
    while ((match = getItemRegex.exec(content)) !== null) {
        operations.push({
            type: 'read',
            key: match[1],
            file: filePath,
            line: content.substring(0, match.index).split('\n').length
        });
    }

    // 匹配 localStorage.setItem('key', ...)
    const setItemRegex = /localStorage\.setItem\s*\(\s*['"`]([^'"`]+)['"`]/g;
    while ((match = setItemRegex.exec(content)) !== null) {
        operations.push({
            type: 'write',
            key: match[1],
            file: filePath,
            line: content.substring(0, match.index).split('\n').length
        });
    }

    // 匹配 localStorage.removeItem('key')
    const removeItemRegex = /localStorage\.removeItem\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    while ((match = removeItemRegex.exec(content)) !== null) {
        operations.push({
            type: 'remove',
            key: match[1],
            file: filePath,
            line: content.substring(0, match.index).split('\n').length
        });
    }

    // sessionStorage 也检查
    const sessionGetRegex = /sessionStorage\.getItem\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    while ((match = sessionGetRegex.exec(content)) !== null) {
        operations.push({
            type: 'session-read',
            key: match[1],
            file: filePath,
            line: content.substring(0, match.index).split('\n').length
        });
    }

    return operations;
}

/**
 * 检查是否有 mount 时的清理逻辑
 */
function hasCleanupLogic(key, allOperations, fileContent) {
    // 检查是否有 removeItem
    const hasRemove = allOperations.some(op => op.key === key && op.type === 'remove');

    // 检查是否在 useEffect 中有清理逻辑
    const hasUseEffectCleanup = fileContent.includes(`localStorage.removeItem('${key}')`) ||
        fileContent.includes(`localStorage.removeItem("${key}")`);

    // 检查是否有条件验证
    const hasValidation = fileContent.includes(`if (!${key}`) ||
        fileContent.includes(`if (${key} === null`) ||
        fileContent.includes(`if (!queueHasItems`);

    return hasRemove || hasUseEffectCleanup || hasValidation;
}

/**
 * 检查是否是危险的布尔标志
 */
function isDangerousPattern(key) {
    return CONFIG.dangerousPatterns.find(p => key.toLowerCase().includes(p.key.toLowerCase()));
}

/**
 * 主审计函数
 */
function runAudit() {
    console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}🔍 状态持久化审计工具${colors.reset}`);
    console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}\n`);

    // 1. 扫描所有文件
    let allFiles = [];
    for (const dir of CONFIG.scanDirs) {
        allFiles = allFiles.concat(getAllFiles(dir));
    }
    console.log(`${colors.blue}📁 Scanning ${allFiles.length} files...${colors.reset}\n`);

    // 2. 提取所有 localStorage 操作
    const allOperations = [];
    const fileContents = {};

    for (const file of allFiles) {
        const ops = extractStorageOperations(file);
        allOperations.push(...ops);
        if (ops.length > 0) {
            fileContents[file] = fs.readFileSync(file, 'utf-8');
        }
    }

    // 3. 按 key 分组
    const keyMap = {};
    for (const op of allOperations) {
        if (!keyMap[op.key]) {
            keyMap[op.key] = { reads: [], writes: [], removes: [] };
        }
        if (op.type === 'read' || op.type === 'session-read') {
            keyMap[op.key].reads.push(op);
        } else if (op.type === 'write') {
            keyMap[op.key].writes.push(op);
        } else if (op.type === 'remove') {
            keyMap[op.key].removes.push(op);
        }
    }

    console.log(`${colors.blue}📋 Found ${Object.keys(keyMap).length} unique storage keys${colors.reset}\n`);

    // 4. 分析每个 key
    const issues = [];
    const safe = [];

    for (const [key, ops] of Object.entries(keyMap)) {
        // 跳过白名单
        if (CONFIG.whitelistedKeys.includes(key)) {
            safe.push({ key, reason: 'Whitelisted' });
            continue;
        }

        // 检查危险模式
        const dangerPattern = isDangerousPattern(key);

        // 检查是否有读取但没有清理
        const hasReads = ops.reads.length > 0;
        const hasRemoves = ops.removes.length > 0;
        const hasWrites = ops.writes.length > 0;

        // 获取文件内容检查清理逻辑
        const filesWithOps = [...new Set(ops.reads.map(r => r.file))];
        let hasCleanup = false;

        for (const file of filesWithOps) {
            if (fileContents[file] && hasCleanupLogic(key, allOperations, fileContents[file])) {
                hasCleanup = true;
                break;
            }
        }

        // 判断问题
        if (dangerPattern && hasReads && !hasCleanup) {
            issues.push({
                key,
                severity: 'high',
                reason: dangerPattern.reason,
                hasRemove: hasRemoves,
                locations: ops.reads
            });
        } else if (hasReads && hasWrites && !hasRemoves && key.includes('is') && !hasCleanup) {
            // 布尔标志没有清理
            issues.push({
                key,
                severity: 'medium',
                reason: 'Boolean flag without cleanup logic',
                hasRemove: false,
                locations: ops.reads
            });
        } else {
            safe.push({ key, reason: hasCleanup ? 'Has cleanup' : 'No obvious issue' });
        }
    }

    // 5. 报告结果
    console.log(`${colors.cyan}${'─'.repeat(60)}${colors.reset}`);
    console.log(`${colors.bold}📊 审计结果${colors.reset}`);
    console.log(`${colors.cyan}${'─'.repeat(60)}${colors.reset}\n`);

    console.log(`${colors.green}✅ 安全: ${safe.length} 个 key${colors.reset}`);
    console.log(`${colors.red}⚠️ 潜在问题: ${issues.length} 个 key${colors.reset}\n`);

    if (issues.length > 0) {
        console.log(`${colors.yellow}${colors.bold}🚨 潜在脏状态问题:${colors.reset}\n`);

        for (const issue of issues) {
            const severityColor = issue.severity === 'high' ? colors.red : colors.yellow;
            const severityIcon = issue.severity === 'high' ? '🔴' : '🟡';

            console.log(`${severityColor}${severityIcon} ${issue.key}${colors.reset}`);
            console.log(`   原因: ${issue.reason}`);
            console.log(`   有清理逻辑: ${issue.hasRemove ? '✅' : '❌'}`);

            for (const loc of issue.locations.slice(0, 2)) {
                const relPath = path.relative(process.cwd(), loc.file);
                console.log(`   位置: ${relPath}:${loc.line}`);
            }
            console.log('');
        }

        // 生成修复建议
        console.log(`${colors.cyan}${'─'.repeat(60)}${colors.reset}`);
        console.log(`${colors.bold}🔧 修复建议:${colors.reset}\n`);

        console.log(`${colors.yellow}在组件 mount 时添加状态校验:`);
        console.log(`
useEffect(() => {
    // 校验 localStorage 状态是否有效
    const savedState = localStorage.getItem('yourKey');
    if (savedState === 'true') {
        // 验证是否有实际数据支持这个状态
        const hasValidData = /* 你的验证逻辑 */;
        if (!hasValidData) {
            console.log("🔧 [Cleanup] Stale state detected, resetting...");
            localStorage.removeItem('yourKey');
            setState(defaultValue);
        }
    }
}, []);${colors.reset}
`);
    } else {
        console.log(`${colors.green}${colors.bold}🎉 未发现明显的脏状态问题!${colors.reset}\n`);
    }

    // 6. 可选：显示所有 key
    if (process.argv.includes('--verbose') || process.argv.includes('-v')) {
        console.log(`${colors.cyan}${'─'.repeat(60)}${colors.reset}`);
        console.log(`${colors.bold}📋 所有 Storage Key:${colors.reset}\n`);

        for (const [key, ops] of Object.entries(keyMap)) {
            const status = issues.find(i => i.key === key) ? '⚠️' : '✅';
            console.log(`${status} ${key} (R:${ops.reads.length} W:${ops.writes.length} D:${ops.removes.length})`);
        }
    }

    console.log(`\n${colors.cyan}${'═'.repeat(60)}${colors.reset}`);

    // 返回退出码
    const hasHighSeverity = issues.some(i => i.severity === 'high');
    process.exit(hasHighSeverity ? 1 : 0);
}

// 运行审计
runAudit();

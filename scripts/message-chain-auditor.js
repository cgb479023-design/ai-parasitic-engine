#!/usr/bin/env node
/**
 * Message Chain Auditor - 消息链完整性检查工具
 * 
 * 自动检测所有 chrome.runtime.sendMessage 调用，
 * 并验证 background.js 中是否有对应的处理器。
 * 
 * 用法: node scripts/message-chain-auditor.js
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
    extensionDir: path.join(__dirname, '..', 'gemini-extension'),
    backgroundFile: 'background.js',
    excludeDirs: ['node_modules', '.git', 'backup'],
    excludeFiles: ['*.backup', '*.bak', '*-before-*', '*- *.js'] // 排除备份文件
};

/**
 * 递归获取所有 JS 文件
 */
function getAllJsFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            // 排除特定目录
            if (!CONFIG.excludeDirs.includes(file)) {
                getAllJsFiles(filePath, fileList);
            }
        } else if (file.endsWith('.js')) {
            // 排除备份文件
            const isBackup = CONFIG.excludeFiles.some(pattern => {
                if (pattern.includes('*')) {
                    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                    return regex.test(file);
                }
                return file === pattern;
            });

            if (!isBackup && file !== CONFIG.backgroundFile) {
                fileList.push(filePath);
            }
        }
    }

    return fileList;
}

/**
 * 从文件中提取所有 sendMessage 调用的 action
 */
function extractSendMessageActions(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const actions = [];

    // 匹配模式 1: chrome.runtime.sendMessage({ action: 'xxx' })
    const actionRegex = /chrome\.runtime\.sendMessage\s*\(\s*\{[^}]*action:\s*['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = actionRegex.exec(content)) !== null) {
        actions.push({
            action: match[1],
            file: filePath,
            line: content.substring(0, match.index).split('\n').length
        });
    }

    // 匹配模式 2: chrome.runtime.sendMessage({ action: EXT_CONSTANTS.ACTIONS.XXX })
    const constantRegex = /chrome\.runtime\.sendMessage\s*\(\s*\{[^}]*action:\s*EXT_CONSTANTS\.ACTIONS\.([A-Z_]+)/g;
    while ((match = constantRegex.exec(content)) !== null) {
        actions.push({
            action: `EXT_CONSTANTS.ACTIONS.${match[1]}`,
            constantName: match[1],
            file: filePath,
            line: content.substring(0, match.index).split('\n').length
        });
    }

    return actions;
}

/**
 * 从 background.js 提取所有处理器
 */
function extractHandlers(backgroundPath) {
    const content = fs.readFileSync(backgroundPath, 'utf-8');
    const handlers = new Set();

    // 匹配模式: request.action === 'xxx' 或 request.action === "xxx"
    const handlerRegex = /request\.action\s*===\s*['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = handlerRegex.exec(content)) !== null) {
        handlers.add(match[1]);
    }

    // 匹配模式: request.action === EXT_CONSTANTS.ACTIONS.XXX
    const constantHandlerRegex = /request\.action\s*===\s*EXT_CONSTANTS\.ACTIONS\.([A-Z_]+)/g;
    while ((match = constantHandlerRegex.exec(content)) !== null) {
        handlers.add(`EXT_CONSTANTS.ACTIONS.${match[1]}`);
    }

    return handlers;
}

/**
 * 加载 constants.js 获取常量映射
 */
function loadConstants() {
    const constantsPath = path.join(CONFIG.extensionDir, 'core', 'constants.js');
    if (!fs.existsSync(constantsPath)) {
        console.warn(`${colors.yellow}⚠️ constants.js not found${colors.reset}`);
        return {};
    }

    const content = fs.readFileSync(constantsPath, 'utf-8');
    const actionsMatch = content.match(/ACTIONS:\s*\{([^}]+)\}/s);

    if (!actionsMatch) return {};

    const actionsBlock = actionsMatch[1];
    const constants = {};

    // 提取常量: KEY: 'value'
    const constRegex = /([A-Z_]+):\s*['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = constRegex.exec(actionsBlock)) !== null) {
        constants[match[1]] = match[2];
    }

    return constants;
}

/**
 * 主审计函数
 */
function runAudit() {
    console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
    console.log(`${colors.cyan}${colors.bold}🔍 消息链完整性审计工具${colors.reset}`);
    console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}\n`);

    const backgroundPath = path.join(CONFIG.extensionDir, CONFIG.backgroundFile);

    if (!fs.existsSync(backgroundPath)) {
        console.error(`${colors.red}❌ background.js not found: ${backgroundPath}${colors.reset}`);
        process.exit(1);
    }

    // 1. 加载常量映射
    const constants = loadConstants();
    console.log(`${colors.blue}📋 Loaded ${Object.keys(constants).length} action constants${colors.reset}`);

    // 2. 提取 background.js 中的所有处理器
    const handlers = extractHandlers(backgroundPath);
    console.log(`${colors.blue}📋 Found ${handlers.size} handlers in background.js${colors.reset}\n`);

    // 3. 扫描所有 content script 文件
    const jsFiles = getAllJsFiles(CONFIG.extensionDir);
    console.log(`${colors.blue}📁 Scanning ${jsFiles.length} JavaScript files...${colors.reset}\n`);

    // 4. 提取所有 sendMessage 调用
    const allSendMessages = [];
    for (const file of jsFiles) {
        const actions = extractSendMessageActions(file);
        allSendMessages.push(...actions);
    }

    console.log(`${colors.blue}📤 Found ${allSendMessages.length} sendMessage calls${colors.reset}\n`);

    // 5. 检查每个发送的 action 是否有对应的处理器
    const missing = [];
    const matched = [];

    for (const msg of allSendMessages) {
        let actionToCheck = msg.action;

        // 如果是常量引用，解析实际值
        if (msg.constantName && constants[msg.constantName]) {
            actionToCheck = constants[msg.constantName];
        }

        // 检查是否有处理器
        const hasHandler = handlers.has(actionToCheck) ||
            handlers.has(msg.action) ||
            (msg.constantName && handlers.has(`EXT_CONSTANTS.ACTIONS.${msg.constantName}`));

        if (hasHandler) {
            matched.push({ ...msg, resolvedAction: actionToCheck });
        } else {
            missing.push({ ...msg, resolvedAction: actionToCheck });
        }
    }

    // 6. 报告结果
    console.log(`${colors.cyan}${'─'.repeat(60)}${colors.reset}`);
    console.log(`${colors.bold}📊 审计结果${colors.reset}`);
    console.log(`${colors.cyan}${'─'.repeat(60)}${colors.reset}\n`);

    console.log(`${colors.green}✅ 已匹配: ${matched.length} 个 action${colors.reset}`);
    console.log(`${colors.red}❌ 缺失处理器: ${missing.length} 个 action${colors.reset}\n`);

    if (missing.length > 0) {
        console.log(`${colors.red}${colors.bold}🚨 缺失的消息处理器:${colors.reset}\n`);

        // 按文件分组
        const byFile = {};
        for (const m of missing) {
            const relPath = path.relative(CONFIG.extensionDir, m.file);
            if (!byFile[relPath]) byFile[relPath] = [];
            byFile[relPath].push(m);
        }

        for (const [file, msgs] of Object.entries(byFile)) {
            console.log(`${colors.yellow}📄 ${file}${colors.reset}`);
            for (const m of msgs) {
                console.log(`   ${colors.red}└─ Line ${m.line}: action='${m.resolvedAction}'${colors.reset}`);
            }
            console.log('');
        }

        // 生成修复建议
        console.log(`${colors.cyan}${'─'.repeat(60)}${colors.reset}`);
        console.log(`${colors.bold}🔧 修复建议 (复制到 background.js):${colors.reset}\n`);

        const uniqueActions = [...new Set(missing.map(m => m.resolvedAction))];
        for (const action of uniqueActions) {
            console.log(`${colors.yellow}// TODO: Add handler for '${action}'`);
            console.log(`if (request.action === '${action}') {`);
            console.log(`    console.log(\`[Background] Handling ${action}\`);`);
            console.log(`    // TODO: Implement handler`);
            console.log(`    sendResponse({ success: true });`);
            console.log(`    return false;`);
            console.log(`}${colors.reset}\n`);
        }

        process.exit(1); // 有缺失，返回非零退出码
    } else {
        console.log(`${colors.green}${colors.bold}🎉 所有消息链完整!${colors.reset}\n`);
    }

    // 7. 可选：显示所有已匹配的 action
    if (process.argv.includes('--verbose') || process.argv.includes('-v')) {
        console.log(`${colors.cyan}${'─'.repeat(60)}${colors.reset}`);
        console.log(`${colors.bold}📋 已匹配的 Action 列表:${colors.reset}\n`);

        for (const m of matched) {
            const relPath = path.relative(CONFIG.extensionDir, m.file);
            console.log(`${colors.green}✓${colors.reset} ${m.resolvedAction} (${relPath}:${m.line})`);
        }
    }

    console.log(`\n${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
}

// 运行审计
runAudit();

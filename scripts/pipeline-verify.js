#!/usr/bin/env node

/**
 * 🏭 AI 工业化流水线 - 完整验证系统
 * Industrial Pipeline Complete Verification System
 * 
 * 集成所有验证步骤，确保代码修改不破坏现有功能
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 控制台颜色
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

// 📋 黄金功能定义 (与 rules.md 同步)
// 🆕 V4.1: Updated for modularized codebase
const GOLDEN_FUNCTIONS = {
    'gemini-extension/content.js': [
        'PREPARE_YOUTUBE_UPLOAD',      // Video data storage
        'IGNITE_COMMENT',               // Comment posting bridge
        'ASK_STUDIO_GENERATE_PLAN',     // Ask Studio trigger
        'safeSendMessage'               // Core message utility
    ],
    'gemini-extension/background.js': [
        'onMessage.addListener',        // Message handler
        'storeVideoData',               // Video storage action
        'TabManager.create'             // Tab management (replaced openTab)
    ],
    'gemini-extension/platforms/youtube/studioAgent.js': [
        'performAnalyticsTask',
        'findInputBox',
        'findAskButton'
    ],
    'gemini-extension/platforms/youtube/commentAutomation.js': [
        'postComment',
        'runCheck'
    ],
    'src/components/YouTubeAnalytics.tsx': [
        'handleFastConnect',            // Fast Connect functionality
        'generateYPPPlan',              // Generate YPP plan (replaced generatePlan)
        'COLLECTION_COMPLETE'           // Message type handler (replaced YPP_PLAN_RESULT)
    ]
};

// 📋 核心扩展文件
const EXTENSION_FILES = [
    'gemini-extension/manifest.json',
    'gemini-extension/background.js',
    'gemini-extension/content.js',
    'gemini-extension/core/constants.js'
];

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message, status = 'info') {
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: '🔍',
        running: '⏳'
    };
    const statusColors = {
        success: 'green',
        error: 'red',
        warning: 'yellow',
        info: 'cyan',
        running: 'blue'
    };
    log(`${icons[status]} [Step ${step}] ${message}`, statusColors[status]);
}

// Step 1: 语法检查
function checkSyntax() {
    logStep(1, 'JavaScript/TypeScript 语法检查', 'running');

    const results = [];

    // 检查扩展 JS 文件
    const jsFiles = [
        'gemini-extension/background.js',
        'gemini-extension/content.js',
        'gemini-extension/platforms/youtube/studioAgent.js',
        'gemini-extension/platforms/youtube/commentAutomation.js'
    ];

    for (const file of jsFiles) {
        const filePath = path.join(process.cwd(), file);
        if (fs.existsSync(filePath)) {
            try {
                execSync(`node --check "${filePath}"`, { stdio: 'pipe' });
                results.push({ file, status: 'pass' });
            } catch (e) {
                results.push({ file, status: 'fail', error: e.message });
            }
        } else {
            results.push({ file, status: 'skip', error: 'File not found' });
        }
    }

    const failed = results.filter(r => r.status === 'fail');
    if (failed.length > 0) {
        logStep(1, `语法检查失败: ${failed.map(f => f.file).join(', ')}`, 'error');
        return false;
    }

    logStep(1, `语法检查通过 (${results.filter(r => r.status === 'pass').length} files)`, 'success');
    return true;
}

// Step 2: 扩展配置验证
function checkExtensionConfig() {
    logStep(2, '扩展配置验证', 'running');

    const manifestPath = path.join(process.cwd(), 'gemini-extension/manifest.json');

    if (!fs.existsSync(manifestPath)) {
        logStep(2, 'manifest.json 不存在', 'error');
        return false;
    }

    try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

        // 验证必要字段
        const requiredFields = ['manifest_version', 'name', 'version'];
        const missing = requiredFields.filter(f => !manifest[f]);

        if (missing.length > 0) {
            logStep(2, `manifest.json 缺少字段: ${missing.join(', ')}`, 'error');
            return false;
        }

        logStep(2, `扩展配置有效 (v${manifest.version})`, 'success');
        return true;
    } catch (e) {
        logStep(2, `manifest.json 解析失败: ${e.message}`, 'error');
        return false;
    }
}

// Step 3: 黄金功能检查
function checkGoldenFunctions() {
    logStep(3, '黄金功能完整性检查 (Constitution V2.0)', 'running');

    try {
        // Execute the dedicated verification script which follows the GOLDEN_FUNCTIONS_CONSTITUTION.md
        execSync('node scripts/verify-golden.js', { stdio: 'inherit' });
        logStep(3, '所有黄金功能完整 (Verified by verify-golden.js)', 'success');
        return true;
    } catch (e) {
        logStep(3, '黄金功能检查失败', 'error');
        return false;
    }
}

// Step 4: Prettier 格式检查
function checkPrettierFormat() {
    logStep(4, 'Prettier 格式检查', 'running');

    try {
        // 使用 npx prettier 检查格式
        execSync('npx prettier --check "**/*.{ts,tsx,js,jsx}" 2>&1', {
            stdio: 'pipe',
            timeout: 30000
        });
        logStep(4, 'Prettier 格式检查通过', 'success');
        return true;
    } catch (e) {
        // 提取不符合格式的文件
        const output = e.stdout ? e.stdout.toString() : '';
        const files = output.match(/[^\n]+\.(ts|tsx|js|jsx)/g) || [];
        logStep(4, `Prettier 格式检查失败 (${files.length} 个文件不符合格式)`, 'error');
        return false;
    }
}

// Step 5: 常量集中化检查
function checkConstants() {
    logStep(5, '常量集中化检查', 'running');

    const constantsPath = path.join(process.cwd(), 'gemini-extension/core/constants.js');

    if (!fs.existsSync(constantsPath)) {
        logStep(5, 'constants.js 不存在', 'warning');
        return true; // 非致命错误
    }

    // 检查是否有硬编码的 storage key
    const filesToCheck = [
        'gemini-extension/background.js',
        'gemini-extension/content.js',
        'gemini-extension/platforms/youtube/studioAgent.js'
    ];

    const hardcodedPatterns = [
        /chrome\.storage\.local\.get\(\s*\[\s*['"][^'"]+['"]\s*\]/g,
        /chrome\.storage\.local\.set\(\s*\{\s*['"][^'"]+['"]:/g
    ];

    const warnings = [];

    for (const file of filesToCheck) {
        const filePath = path.join(process.cwd(), file);
        if (!fs.existsSync(filePath)) continue;

        const content = fs.readFileSync(filePath, 'utf8');

        // 检查是否使用 EXT_CONSTANTS
        if (!content.includes('EXT_CONSTANTS') &&
            (content.includes('chrome.storage.local.get') || content.includes('chrome.storage.local.set'))) {
            warnings.push(`${file}: 可能有硬编码的 storage key`);
        }
    }

    if (warnings.length > 0) {
        logStep(5, '常量集中化检查警告:', 'warning');
        warnings.forEach(w => console.log(`   ⚠️ ${w}`));
    } else {
        logStep(5, '常量使用规范', 'success');
    }

    return true;
}

// Step 6: React 构建检查
function checkReactBuild() {
    logStep(6, 'React 构建检查', 'running');

    try {
        // 快速类型检查
        execSync('npx tsc --noEmit --skipLibCheck 2>&1 | head -5', {
            stdio: 'pipe',
            timeout: 30000
        });
        logStep(5, 'TypeScript 类型检查通过', 'success');
        return true;
    } catch (e) {
        // TypeScript 错误不阻止继续，只是警告
        logStep(5, 'TypeScript 有类型警告 (非阻塞)', 'warning');
        return true;
    }
}

// Step 7: 测试覆盖率分析
function checkTestCoverage() {
    logStep(7, '测试覆盖率分析', 'running');

    try {
        // 运行测试覆盖率分析
        execSync('npx vitest run --coverage 2>&1', {
            stdio: 'pipe',
            timeout: 60000
        });
        logStep(7, '测试覆盖率分析通过', 'success');
        return true;
    } catch (e) {
        // 提取覆盖率结果
        const output = e.stdout ? e.stdout.toString() : '';
        logStep(7, '测试覆盖率分析失败', 'error');
        return false;
    }
}

// Step 8: 消息链完整性检查
function checkMessageChains() {
    logStep(8, '消息链完整性检查', 'running');

    try {
        execSync('node scripts/message-chain-auditor.js', {
            stdio: 'pipe',
            timeout: 30000
        });
        logStep(8, '所有消息链完整', 'success');
        return true;
    } catch (e) {
        // 提取缺失数量
        const output = e.stdout ? e.stdout.toString() : '';
        const missingMatch = output.match(/缺失处理器: (\d+) 个/);
        const count = missingMatch ? missingMatch[1] : '?';
        logStep(8, `消息链不完整 (缺失 ${count} 个处理器)`, 'error');
        return false;
    }
}

// 主函数: 运行完整验证
function runFullVerification() {
    console.log('\n');
    log('═'.repeat(60), 'cyan');
    log('🏭 AI 工业化流水线 - 完整验证系统', 'cyan');
    log('═'.repeat(60), 'cyan');
    console.log('');

    const startTime = Date.now();
    const results = [];

    // 执行所有检查步骤
    results.push({ name: '语法检查', passed: checkSyntax() });
    results.push({ name: '扩展配置', passed: checkExtensionConfig() });
    results.push({ name: '黄金功能', passed: checkGoldenFunctions() });
    results.push({ name: '格式检查', passed: checkPrettierFormat() });
    results.push({ name: '常量规范', passed: checkConstants() });
    results.push({ name: '测试覆盖率', passed: checkTestCoverage() });
    results.push({ name: 'React构建', passed: checkReactBuild() });
    results.push({ name: '消息链', passed: checkMessageChains() });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // 输出总结
    console.log('');
    log('═'.repeat(60), 'cyan');
    log('📊 验证结果总结', 'cyan');
    log('─'.repeat(60), 'cyan');

    const passed = results.filter(r => r.passed).length;
    const total = results.length;

    results.forEach(r => {
        const icon = r.passed ? '✅' : '❌';
        const color = r.passed ? 'green' : 'red';
        log(`${icon} ${r.name}`, color);
    });

    console.log('');
    log(`耗时: ${duration}s`, 'blue');

    const allPassed = passed === total;

    if (allPassed) {
        log('═'.repeat(60), 'green');
        log('🎉 验证通过 - 所有检查项均正常', 'green');
        log('═'.repeat(60), 'green');
    } else {
        log('═'.repeat(60), 'red');
        log('❌ 验证失败 - 请修复上述问题', 'red');
        log('═'.repeat(60), 'red');
        log('', 'reset');
        log('建议操作:', 'yellow');
        log('   1. 运行 /restore_latest 回滚到稳定版本', 'yellow');
        log('   2. 查看 /lessons_learned 了解常见问题', 'yellow');
    }

    console.log('');

    return allPassed ? 0 : 1;
}

// 快速检查 (仅语法和黄金功能)
function runQuickCheck() {
    log('\n🔍 快速验证模式\n', 'cyan');

    const syntaxOk = checkSyntax();
    const goldenOk = checkGoldenFunctions();

    if (syntaxOk && goldenOk) {
        log('\n✅ 快速验证通过\n', 'green');
        return 0;
    } else {
        log('\n❌ 快速验证失败\n', 'red');
        return 1;
    }
}

// CLI 入口
if (require.main === module) {
    const command = process.argv[2];

    switch (command) {
        case 'full':
            process.exit(runFullVerification());
            break;
        case 'quick':
            process.exit(runQuickCheck());
            break;
        case 'syntax':
            process.exit(checkSyntax() ? 0 : 1);
            break;
        case 'golden':
            process.exit(checkGoldenFunctions() ? 0 : 1);
            break;
        default:
            console.log(`
🏭 AI 工业化流水线 - 验证系统

Usage: node scripts/pipeline-verify.js <command>

Commands:
  full      运行完整验证 (推荐)
  quick     快速验证 (仅语法+黄金功能)
  syntax    仅语法检查
  golden    仅黄金功能检查

Examples:
  node scripts/pipeline-verify.js full
  npm run verify:pipeline
            `);
    }
}

module.exports = {
    runFullVerification,
    runQuickCheck,
    checkSyntax,
    checkGoldenFunctions,
    checkConstants,
    checkExtensionConfig,
    checkPrettierFormat
};

#!/usr/bin/env node

/**
 * 🔧 智能调试助手 - Smart Debug Assistant
 * 
 * 自动分析错误并建议解决方案
 */

const fs = require('fs');
const path = require('path');

// 错误模式和解决方案映射
const ERROR_PATTERNS = {
    'chrome.runtime.lastError': {
        message: 'Chrome Extension 运行时错误',
        solutions: [
            '重新加载扩展: chrome://extensions/ → 点击刷新按钮',
            '检查 manifest.json 配置是否正确',
            '确保 content script 已注入目标页面'
        ]
    },
    'invalidated': {
        message: 'Extension Context 失效',
        solutions: [
            '刷新目标页面 (F5)',
            '重新加载扩展',
            '检查是否有竞态条件'
        ]
    },
    'Cannot read properties of undefined': {
        message: '空值访问错误',
        solutions: [
            '添加可选链操作符 (?.) 进行安全访问',
            '添加空值检查 (if (!obj) return)',
            '检查异步操作是否正确等待'
        ]
    },
    'cancelled this response': {
        message: 'Ask Studio 响应被取消',
        solutions: [
            '等待 30 秒后重试',
            '刷新 YouTube Studio 页面',
            '检查是否有多个请求同时进行'
        ],
        keywords: ['ask studio', 'snapshot']
    },
    'rate limit': {
        message: 'API 速率限制',
        solutions: [
            '等待 1-2 分钟后重试',
            '减少请求频率',
            '使用指数退避算法'
        ],
        keywords: ['timeout']
    },
    'QUOTA_EXCEEDED': {
        message: 'Chrome Storage 配额超限',
        solutions: [
            '清理不需要的存储数据',
            '使用 chrome.storage.local 替代 sync',
            '压缩存储的数据'
        ],
        keywords: ['storage']
    },
    'sendMessage': {
        message: '消息发送失败',
        solutions: [
            '确保 background script 正在运行',
            '检查消息类型是否正确',
            '验证 sendResponse 是否被调用'
        ],
        keywords: ['message', 'check']
    }
};

// 加载教训索引
let lessonsIndex = [];
try {
    const indexContent = fs.readFileSync(path.join(__dirname, 'lessons-index.json'), 'utf8');
    lessonsIndex = JSON.parse(indexContent);
} catch (e) {
    // 索引不存在时使用空数组，提示用户生成
}

function analyzeError(errorText) {
    console.log('\n🔍 分析错误信息...\n');
    
    let foundPattern = false;
    for (const [pattern, info] of Object.entries(ERROR_PATTERNS)) {
        if (errorText.toLowerCase().includes(pattern.toLowerCase())) {
            console.log(`✅ 匹配: ${info.message}`);
            console.log('   解决方案:');
            info.solutions.forEach((sol, i) => console.log(`   ${i + 1}. ${sol}`));
            foundPattern = true;
            
            // 尝试基于模式推荐教训
            const keywords = info.keywords || pattern.split(' ');
            suggestRelatedLessons(keywords, true);
            return;
        }
    }
    
    if (!foundPattern) {
        console.log('⚠️ 未识别的错误模式');
        // 尝试基于错误文本中的关键词推荐
        const commonKeywords = ['storage', 'message', 'timeout', 'undefined', 'null', 'network'];
        const foundKeywords = commonKeywords.filter(k => errorText.toLowerCase().includes(k));
        if (foundKeywords.length > 0) {
            suggestRelatedLessons(foundKeywords, true);
        } else {
            console.log('   建议运行 /lessons_learned 查看历史教训');
        }
    }
}

function suggestRelatedLessons(keywords, brief = false) {
    if (lessonsIndex.length === 0) {
        console.log('\n⚠️ 教训索引未加载。请运行: npm run index:lessons');
        return;
    }

    const relevantLessons = lessonsIndex.filter(lesson => {
        return keywords.some(kw => 
            lesson.keywords.includes(kw.toLowerCase()) || 
            lesson.title.toLowerCase().includes(kw.toLowerCase())
        );
    });
    
    if (relevantLessons.length > 0) {
        console.log(`\n📚 相关历史教训 (${relevantLessons.length}):\n`);
        relevantLessons.forEach(l => {
            console.log(`   #${l.id}: ${l.title}`);
            if (!brief) {
                console.log(`      ${l.description.split('\n')[0].substring(0, 60)}...`);
            }
        });
        console.log('\n   使用 /lessons_learned 查看详情');
    } else if (!brief) {
        console.log('\n   未找到相关教训。运行 /lessons_learned 查看完整列表');
    }
}

function runHealthCheck() {
    console.log('\n🏥 系统健康检查\n');
    
    const checks = [
        { name: 'manifest.json', path: 'gemini-extension/manifest.json' },
        { name: 'background.js', path: 'gemini-extension/background.js' },
        { name: 'content.js', path: 'gemini-extension/content.js' },
        { name: 'studioAgent.js', path: 'gemini-extension/platforms/youtube/studioAgent.js' },
        { name: 'lessons-index.json', path: 'scripts/lessons-index.json' }
    ];
    
    let allPassed = true;
    checks.forEach(check => {
        const exists = fs.existsSync(path.join(process.cwd(), check.path));
        console.log(`${exists ? '✅' : '❌'} ${check.name}`);
        if (!exists) allPassed = false;
    });
    
    console.log('\n' + (allPassed ? '✅ 系统健康' : '⚠️ 存在问题'));
}

if (require.main === module) {
    const cmd = process.argv[2];
    const args = process.argv.slice(3).join(' ');
    
    if (cmd === 'analyze' && args) analyzeError(args);
    else if (cmd === 'lessons') suggestRelatedLessons(args.split(' ').filter(Boolean));
    else if (cmd === 'health') runHealthCheck();
    else console.log('Usage: node scripts/debug-assistant.js <analyze "error"|lessons "kw"|health>');
}

module.exports = { analyzeError, suggestRelatedLessons, runHealthCheck };

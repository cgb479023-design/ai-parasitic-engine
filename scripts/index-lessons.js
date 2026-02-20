const fs = require('fs');
const path = require('path');

const LESSONS_FILE = path.join(__dirname, '../.agent/workflows/lessons_learned.md');
const INDEX_FILE = path.join(__dirname, 'lessons-index.json');

function parseLessons() {
    if (!fs.existsSync(LESSONS_FILE)) {
        console.error('❌ Lessons file not found:', LESSONS_FILE);
        process.exit(1);
    }

    const content = fs.readFileSync(LESSONS_FILE, 'utf8');
    const lines = content.split('\n');
    const lessons = [];
    
    let currentLesson = null;
    let currentSection = null;

    for (const line of lines) {
        // Match Lesson Header: ## 🔴 教训 #1: Title
        const lessonMatch = line.match(/^##\s+.*教训\s*#(\d+)[:：]\s*(.*)/);
        if (lessonMatch) {
            if (currentLesson) {
                lessons.push(currentLesson);
            }
            currentLesson = {
                id: lessonMatch[1],
                title: lessonMatch[2].trim(),
                description: '',
                rootCause: '',
                prevention: '',
                keywords: []
            };
            currentSection = null;
            continue;
        }

        if (!currentLesson) continue;

        // Match Sections
        if (line.match(/^###\s+故障描述/)) {
            currentSection = 'description';
            continue;
        } else if (line.match(/^###\s+根因分析/)) {
            currentSection = 'rootCause';
            continue;
        } else if (line.match(/^###\s+预防机制/)) {
            currentSection = 'prevention';
            continue;
        } else if (line.startsWith('###')) {
            currentSection = null; // Other sections
            continue;
        }

        // Append content to current section
        if (currentSection && line.trim()) {
            // Remove markdown bullets
            const text = line.replace(/^[-*]\s+/, '').trim();
            if (text) {
                if (currentLesson[currentSection]) {
                    currentLesson[currentSection] += '\n' + text;
                } else {
                    currentLesson[currentSection] = text;
                }
            }
        }
    }

    if (currentLesson) {
        lessons.push(currentLesson);
    }

    // Generate keywords
    lessons.forEach(lesson => {
        const text = `${lesson.title} ${lesson.description} ${lesson.rootCause}`.toLowerCase();
        const keywords = new Set();
        
        // Common keywords mapping
        const keywordMap = {
            'storage': ['storage', '存储', 'set', 'get'],
            'message': ['message', '消息', '通信', 'sendmessage', 'onmessage'],
            'constant': ['constant', '常量', '硬编码', 'hardcode'],
            'module': ['module', '模块', 'import', 'export'],
            'snapshot': ['snapshot', '快照', '回滚', 'restore'],
            'encoding': ['encoding', '编码', '中文', '乱码', 'powershell'],
            'race': ['race', '竞态', '时序', '异步', 'async'],
            'timeout': ['timeout', '超时', '挂起'],
            'check': ['check', '检查', 'verify', '验证'],
            'ask studio': ['ask studio', 'studio', 'cancelled', 'cancel']
        };

        for (const [key, patterns] of Object.entries(keywordMap)) {
            if (patterns.some(p => text.includes(p))) {
                keywords.add(key);
            }
        }
        
        lesson.keywords = Array.from(keywords);
    });

    return lessons;
}

function main() {
    console.log('📚 Indexing lessons learned...');
    const lessons = parseLessons();
    
    fs.writeFileSync(INDEX_FILE, JSON.stringify(lessons, null, 2));
    console.log(`✅ Indexed ${lessons.length} lessons to ${INDEX_FILE}`);
    
    // Print summary
    lessons.forEach(l => {
        console.log(`   #${l.id}: ${l.title} [${l.keywords.join(', ')}]`);
    });
}

main();

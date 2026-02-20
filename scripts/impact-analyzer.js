const fs = require('fs');
const path = require('path');

// Configuration
const EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx'];
const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', '.gemini', 'coverage'];
const ROOT_DIR = path.resolve(__dirname, '..');

// Golden Functions Definition (Synced with pipeline-verify.js)
const GOLDEN_FUNCTIONS = [
    { name: 'performAnalyticsTask', file: 'gemini-extension/platforms/youtube/studioAgent.js' },
    { name: 'findInputBox', file: 'gemini-extension/platforms/youtube/studioAgent.js' },
    { name: 'findAskButton', file: 'gemini-extension/platforms/youtube/studioAgent.js' },
    { name: 'postComment', file: 'gemini-extension/platforms/youtube/commentAutomation.js' },
    { name: 'runCheck', file: 'gemini-extension/platforms/youtube/commentAutomation.js' },
    { name: 'PREPARE_YOUTUBE_UPLOAD', file: 'gemini-extension/content.js' },
    { name: 'IGNITE_COMMENT', file: 'gemini-extension/content.js' },
    { name: 'ASK_STUDIO_GENERATE_PLAN', file: 'gemini-extension/content.js' },
    { name: 'safeSendMessage', file: 'gemini-extension/content.js' },
    { name: 'onMessage.addListener', file: 'gemini-extension/background.js' },
    { name: 'storeVideoData', file: 'gemini-extension/background.js' },
    { name: 'openTab', file: 'gemini-extension/background.js' },
    { name: 'handleManualPlanSubmit', file: 'src/components/YouTubeAnalytics.tsx' },
    { name: 'generatePlan', file: 'src/components/YouTubeAnalytics.tsx' },
    { name: 'YPP_PLAN_RESULT', file: 'src/components/YouTubeAnalytics.tsx' }
];

// Helper: Normalize path
function normalizePath(p) {
    return path.resolve(p).toLowerCase(); // Windows case-insensitive
}

// Helper: Get all files recursively
function getAllFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            if (!IGNORE_DIRS.includes(file)) {
                getAllFiles(filePath, fileList);
            }
        } else {
            if (EXTENSIONS.includes(path.extname(file))) {
                fileList.push(filePath);
            }
        }
    });
    return fileList;
}

// Helper: Parse dependencies
function getDependencies(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const dependencies = new Set();
    const dir = path.dirname(filePath);

    // Regex for import/require
    const importRegex = /import\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g;
    const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
    const dynamicImportRegex = /import\(['"]([^'"]+)['"]\)/g;

    const regexes = [importRegex, requireRegex, dynamicImportRegex];

    regexes.forEach(regex => {
        let match;
        while ((match = regex.exec(content)) !== null) {
            const importPath = match[1];
            if (importPath.startsWith('.')) {
                // Resolve relative path
                try {
                    let resolvedPath = path.resolve(dir, importPath);
                    
                    // Try adding extensions
                    if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
                        dependencies.add(normalizePath(resolvedPath));
                    } else {
                        for (const ext of EXTENSIONS) {
                            if (fs.existsSync(resolvedPath + ext)) {
                                dependencies.add(normalizePath(resolvedPath + ext));
                                break;
                            }
                            // Check index files
                            const indexPath = path.join(resolvedPath, 'index' + ext);
                            if (fs.existsSync(indexPath)) {
                                dependencies.add(normalizePath(indexPath));
                                break;
                            }
                        }
                    }
                } catch (e) {
                    // Ignore resolution errors
                }
            }
        }
    });

    return Array.from(dependencies);
}

// Helper: Parse manifest.json dependencies
function getManifestDependencies(targetFile, files) {
    const manifestPath = path.join(ROOT_DIR, 'gemini-extension/manifest.json');
    if (!fs.existsSync(manifestPath)) return [];

    const content = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(content);
    const dependents = new Set();
    const normTarget = normalizePath(targetFile);
    const relativeTarget = path.relative(path.join(ROOT_DIR, 'gemini-extension'), normTarget).replace(/\\/g, '/');

    // Check background
    if (manifest.background && manifest.background.service_worker === relativeTarget) {
        dependents.add(normalizePath(manifestPath));
    }

    // Check content scripts
    if (manifest.content_scripts) {
        manifest.content_scripts.forEach(cs => {
            if (cs.js && cs.js.includes(relativeTarget)) {
                dependents.add(normalizePath(manifestPath));
                
                // Add implicit dependents (scripts loaded after this one in the same group)
                const index = cs.js.indexOf(relativeTarget);
                if (index !== -1) {
                    for (let i = index + 1; i < cs.js.length; i++) {
                        const nextScript = path.join(ROOT_DIR, 'gemini-extension', cs.js[i]);
                        if (fs.existsSync(nextScript)) {
                            dependents.add(normalizePath(nextScript));
                        }
                    }
                }
            }
        });
    }

    return Array.from(dependents);
}

// Build Dependency Graph
function buildGraph() {
    const files = getAllFiles(ROOT_DIR);
    const graph = {}; // file -> [dependencies]
    const reverseGraph = {}; // file -> [dependents]

    files.forEach(file => {
        const normFile = normalizePath(file);
        graph[normFile] = getDependencies(file);
        
        // Initialize reverse graph
        if (!reverseGraph[normFile]) reverseGraph[normFile] = [];
    });

    // Add Manifest Dependencies
    files.forEach(file => {
        const manifestDeps = getManifestDependencies(file, files);
        manifestDeps.forEach(dep => {
            const normFile = normalizePath(file);
            const normDep = normalizePath(dep);
            
            // Treat manifest dependencies as reverse dependencies (dep depends on file)
            // But getManifestDependencies returns files that depend on targetFile
            // So we add them directly to reverseGraph
            if (!reverseGraph[normFile]) reverseGraph[normFile] = [];
            if (!reverseGraph[normFile].includes(normDep)) {
                reverseGraph[normFile].push(normDep);
            }
        });
    });

    // Populate reverse graph from standard imports
    Object.entries(graph).forEach(([file, deps]) => {
        deps.forEach(dep => {
            if (reverseGraph[dep]) {
                if (!reverseGraph[dep].includes(file)) {
                    reverseGraph[dep].push(file);
                }
            }
        });
    });

    return { graph, reverseGraph, files };
}

// Analyze Impact
function analyzeImpact(targetFile) {
    const { reverseGraph } = buildGraph();
    const normTarget = normalizePath(targetFile);

    if (!reverseGraph[normTarget]) {
        // Try fuzzy match
        const keys = Object.keys(reverseGraph);
        const match = keys.find(k => k.endsWith(normalizePath(targetFile)) || k.includes(normalizePath(targetFile)));
        if (match) {
            console.log(`ℹ️  Resolved '${targetFile}' to '${path.relative(ROOT_DIR, match)}'`);
            return analyzeImpact(match);
        }
        console.log(`❌ File not found in dependency graph: ${targetFile}`);
        return;
    }

    console.log(`\n🔍 Analyzing impact for: ${path.relative(ROOT_DIR, normTarget)}`);

    // 1. Direct Dependents
    const directDependents = reverseGraph[normTarget];
    
    // 2. Transitive Dependents (BFS)
    const allDependents = new Set();
    const queue = [...directDependents];
    while (queue.length > 0) {
        const current = queue.shift();
        if (!allDependents.has(current)) {
            allDependents.add(current);
            if (reverseGraph[current]) {
                queue.push(...reverseGraph[current]);
            }
        }
    }

    // 3. Golden Functions Impact
    const affectedGoldenFunctions = [];
    const affectedFiles = [normTarget, ...allDependents];
    
    GOLDEN_FUNCTIONS.forEach(gf => {
        const gfPath = normalizePath(path.join(ROOT_DIR, gf.file));
        if (affectedFiles.includes(gfPath)) {
            affectedGoldenFunctions.push(gf);
        }
    });

    // Output Results
    console.log('\n💥 Impact Summary:');
    console.log(`   - Direct Dependents: ${directDependents.length}`);
    console.log(`   - Total Affected Files: ${allDependents.size}`);
    console.log(`   - Golden Functions at Risk: ${affectedGoldenFunctions.length}`);

    if (affectedGoldenFunctions.length > 0) {
        console.log('\n🛡️  Golden Functions Affected:');
        affectedGoldenFunctions.forEach(gf => {
            console.log(`   - ${gf.name} (${gf.file})`);
        });
    }

    if (directDependents.length > 0) {
        console.log('\n🔗 Direct Dependents:');
        directDependents.forEach(f => console.log(`   - ${path.relative(ROOT_DIR, f)}`));
    }
    
    // Message Chain Analysis (Simple String Match)
    const content = fs.readFileSync(normTarget, 'utf8');
    const messageTypes = (content.match(/type\s*[:=]\s*['"]([^'"]+)['"]/g) || [])
        .map(m => m.match(/['"]([^'"]+)['"]/)[1]);
        
    if (messageTypes.length > 0) {
        console.log('\n📨 Message Types Detected:');
        messageTypes.forEach(type => console.log(`   - ${type}`));
        console.log('   (Check if receivers handle these types correctly)');
    }
}

// CLI
if (require.main === module) {
    const targetFile = process.argv[2];
    if (!targetFile) {
        console.log('Usage: node scripts/impact-analyzer.js <file_path>');
        process.exit(1);
    }
    analyzeImpact(targetFile);
}

module.exports = { analyzeImpact };

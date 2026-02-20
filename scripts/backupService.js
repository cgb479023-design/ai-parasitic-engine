#!/usr/bin/env node

/**
 * 🏭 AI 工业化流水线 - 修复前备份服务
 * Pre-fix Backup Service
 * 
 * 在代码修复前自动备份所有要修改的文件，确保可以随时回滚到修复前的状态
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

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

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * 创建备份目录
 */
function createBackupDir() {
    const backupDir = path.join(process.cwd(), 'backup');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir);
        log(`📁 创建备份目录: ${backupDir}`, 'green');
    }
    return backupDir;
}

/**
 * 生成备份文件名
 */
function generateBackupFileName(originalPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const relativePath = path.relative(process.cwd(), originalPath);
    const sanitizedPath = relativePath.replace(/[/\\]/g, '__');
    return `${sanitizedPath}_${timestamp}.bak`;
}

/**
 * 备份单个文件
 */
function backupFile(filePath) {
    if (!fs.existsSync(filePath)) {
        log(`⚠️ 文件不存在，跳过备份: ${filePath}`, 'yellow');
        return null;
    }

    const backupDir = createBackupDir();
    const backupFileName = generateBackupFileName(filePath);
    const backupPath = path.join(backupDir, backupFileName);

    // 复制文件到备份目录
    fs.copyFileSync(filePath, backupPath);
    log(`✅ 备份文件: ${filePath} → ${backupPath}`, 'green');

    return backupPath;
}

/**
 * 备份目录下的所有文件
 */
function backupDirectory(dirPath, excludePatterns = []) {
    if (!fs.existsSync(dirPath)) {
        log(`⚠️ 目录不存在，跳过备份: ${dirPath}`, 'yellow');
        return [];
    }

    const backupPaths = [];
    const files = fs.readdirSync(dirPath, { recursive: true });

    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const stats = fs.statSync(fullPath);

        if (stats.isFile()) {
            // 检查是否需要排除
            const shouldExclude = excludePatterns.some(pattern => {
                const relativePath = path.relative(process.cwd(), fullPath);
                return new RegExp(pattern).test(relativePath);
            });

            if (!shouldExclude) {
                const backupPath = backupFile(fullPath);
                if (backupPath) {
                    backupPaths.push(backupPath);
                }
            }
        }
    }

    return backupPaths;
}

/**
 * 备份整个项目的关键文件
 */
function backupProject() {
    log('\n🔄 开始项目备份...', 'cyan');

    const backupPaths = [];

    // 备份关键目录
    const directoriesToBackup = [
        'components',
        'src',
        'services',
        'gemini-extension'
    ];

    const excludePatterns = [
        'node_modules',
        '.git',
        'backup',
        'dist',
        '.vscode',
        '.idea',
        '*.log',
        '*.tmp',
        'package-lock.json',
        'yarn.lock',
        'pnpm-lock.yaml'
    ];

    for (const dir of directoriesToBackup) {
        const dirPath = path.join(process.cwd(), dir);
        const dirBackups = backupDirectory(dirPath, excludePatterns);
        backupPaths.push(...dirBackups);
    }

    // 备份关键配置文件
    const configFiles = [
        'package.json',
        'tsconfig.json',
        'vite.config.ts',
        'vitest.config.ts',
        '.eslintrc.cjs',
        '.prettierrc.cjs'
    ];

    for (const file of configFiles) {
        const filePath = path.join(process.cwd(), file);
        const backupPath = backupFile(filePath);
        if (backupPath) {
            backupPaths.push(backupPath);
        }
    }

    log(`\n📋 备份完成，共备份 ${backupPaths.length} 个文件`, 'green');
    return backupPaths;
}

/**
 * 恢复最近的备份
 */
function restoreLatestBackup() {
    log('\n🔄 开始恢复最近备份...', 'cyan');

    const backupDir = path.join(process.cwd(), 'backup');
    if (!fs.existsSync(backupDir)) {
        log('⚠️ 备份目录不存在，无法恢复', 'yellow');
        return false;
    }

    // 获取所有备份文件
    const backupFiles = fs.readdirSync(backupDir).filter(f => f.endsWith('.bak'));
    if (backupFiles.length === 0) {
        log('⚠️ 没有找到备份文件，无法恢复', 'yellow');
        return false;
    }

    // 按修改时间排序，获取最新的备份文件
    const sortedFiles = backupFiles.sort((a, b) => {
        const aTime = fs.statSync(path.join(backupDir, a)).mtime.getTime();
        const bTime = fs.statSync(path.join(backupDir, b)).mtime.getTime();
        return bTime - aTime;
    });

    const latestFile = sortedFiles[0];
    const latestFilePath = path.join(backupDir, latestFile);
    const restorePath = path.join(process.cwd(), latestFile.replace(/__/g, path.sep).replace(/_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.bak$/, ''));

    // 恢复文件
    fs.copyFileSync(latestFilePath, restorePath);
    log(`✅ 恢复文件: ${latestFilePath} → ${restorePath}`, 'green');

    return true;
}

/**
 * 列出所有备份
 */
function listBackups() {
    const backupDir = path.join(process.cwd(), 'backup');
    if (!fs.existsSync(backupDir)) {
        log('⚠️ 备份目录不存在', 'yellow');
        return [];
    }

    const backupFiles = fs.readdirSync(backupDir).filter(f => f.endsWith('.bak'));
    if (backupFiles.length === 0) {
        log('⚠️ 没有找到备份文件', 'yellow');
        return [];
    }

    // 按修改时间排序
    const sortedFiles = backupFiles.sort((a, b) => {
        const aTime = fs.statSync(path.join(backupDir, a)).mtime.getTime();
        const bTime = fs.statSync(path.join(backupDir, b)).mtime.getTime();
        return bTime - aTime;
    });

    log('\n📋 备份列表:', 'cyan');
    sortedFiles.forEach((file, index) => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        const size = (stats.size / 1024).toFixed(2);
        const mtime = stats.mtime.toLocaleString();
        log(`${index + 1}. ${file} (${size} KB, ${mtime})`, 'blue');
    });

    return sortedFiles;
}

/**
 * CLI 入口
 */
function main() {
    const command = process.argv[2] || 'backup';

    switch (command) {
        case 'backup':
            backupProject();
            break;
        case 'restore':
            restoreLatestBackup();
            break;
        case 'list':
            listBackups();
            break;
        default:
            log('\n🔧 使用方法:', 'cyan');
            log('   node scripts/backupService.js backup   - 备份整个项目', 'yellow');
            log('   node scripts/backupService.js restore - 恢复最近的备份', 'yellow');
            log('   node scripts/backupService.js list    - 列出所有备份', 'yellow');
            break;
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export {
    backupFile,
    backupDirectory,
    backupProject,
    restoreLatestBackup,
    listBackups
};
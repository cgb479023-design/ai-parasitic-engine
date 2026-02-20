#!/usr/bin/env node

/**
 * Fast Collect功能备份脚本
 * 用于备份当前稳定的Fast Collect功能实现，确保可以恢复到当前完美状态
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 备份配置
const BACKUP_CONFIG = {
  backupDir: path.join(__dirname, '../backups'),
  version: '1.0.0',
  backupName: `fast-collect-v${new Date().getTime()}`,
  lockedFiles: [
    'src/components/YouTubeAnalytics.tsx',
    'components/YouTubeAnalytics/hooks/useDataCollectionState.tsx',
    'components/YouTubeAnalytics/BatchCollectionPanel.tsx',
    'src/utils/JsonUtils.ts'
  ],
  description: 'Fast Collect功能稳定版本备份'
};

// 创建备份目录
function createBackupDir() {
  if (!fs.existsSync(BACKUP_CONFIG.backupDir)) {
    fs.mkdirSync(BACKUP_CONFIG.backupDir, { recursive: true });
  }
  const backupPath = path.join(BACKUP_CONFIG.backupDir, BACKUP_CONFIG.backupName);
  if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupPath, { recursive: true });
  }
  return backupPath;
}

// 复制文件到备份目录
function copyFiles(backupPath) {
  console.log('📋 正在备份Fast Collect相关文件...');
  BACKUP_CONFIG.lockedFiles.forEach(filePath => {
    const fullPath = path.join(__dirname, '../', filePath);
    if (fs.existsSync(fullPath)) {
      const destPath = path.join(backupPath, filePath.replace(/\//g, path.sep));
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.copyFileSync(fullPath, destPath);
      console.log(`✅ 备份成功: ${filePath}`);
    } else {
      console.warn(`⚠️ 文件不存在: ${filePath}`);
    }
  });
}

// 创建备份元数据
function createBackupMetadata(backupPath) {
  const metadata = {
    ...BACKUP_CONFIG,
    backupTime: new Date().toISOString(),
    gitCommit: getCurrentGitCommit(),
    gitBranch: getCurrentGitBranch()
  };
  fs.writeFileSync(
    path.join(backupPath, 'metadata.json'),
    JSON.stringify(metadata, null, 2),
    'utf8'
  );
  console.log('✅ 备份元数据创建成功');
}

// 获取当前Git提交
function getCurrentGitCommit() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch (error) {
    return 'unknown';
  }
}

// 获取当前Git分支
function getCurrentGitBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch (error) {
    return 'unknown';
  }
}

// 更新锁定文件
function updateLockFile(backupPath) {
  const lockFilePath = path.join(__dirname, 'fast-collect-lock.json');
  if (fs.existsSync(lockFilePath)) {
    const lockData = JSON.parse(fs.readFileSync(lockFilePath, 'utf8'));
    lockData.fastCollectLock.backupInfo = {
      backupPath: backupPath.replace(path.join(__dirname, '../'), ''),
      backupTime: new Date().toISOString()
    };
    fs.writeFileSync(lockFilePath, JSON.stringify(lockData, null, 2), 'utf8');
    console.log('✅ 锁定文件更新成功');
  }
}

// 主函数
function main() {
  console.log('🚀 Fast Collect功能备份开始...');
  console.log('=============================');
  
  try {
    const backupPath = createBackupDir();
    copyFiles(backupPath);
    createBackupMetadata(backupPath);
    updateLockFile(backupPath);
    
    console.log('\n✅ Fast Collect功能备份成功！');
    console.log(`📁 备份路径: ${backupPath}`);
    console.log(`📋 备份版本: ${BACKUP_CONFIG.version}`);
    console.log(`🔒 备份文件数: ${BACKUP_CONFIG.lockedFiles.length}`);
    console.log('\n💡 恢复命令: node scripts/restore-fast-collect.js <backup-name>');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Fast Collect功能备份失败:', error.message);
    process.exit(1);
  }
}

// 执行主函数
main();

#!/usr/bin/env node

/**
 * Fast Collect功能恢复脚本
 * 用于恢复之前备份的Fast Collect功能实现，确保可以回到稳定状态
 */

const fs = require('fs');
const path = require('path');

// 恢复配置
const RESTORE_CONFIG = {
  backupDir: path.join(__dirname, '../backups'),
  description: 'Fast Collect功能恢复脚本'
};

// 获取备份列表
function getBackupList() {
  if (!fs.existsSync(RESTORE_CONFIG.backupDir)) {
    console.error('❌ 备份目录不存在:', RESTORE_CONFIG.backupDir);
    process.exit(1);
  }
  return fs.readdirSync(RESTORE_CONFIG.backupDir).filter(name => 
    name.startsWith('fast-collect-') && 
    fs.lstatSync(path.join(RESTORE_CONFIG.backupDir, name)).isDirectory()
  ).sort((a, b) => {
    return parseInt(b.split('-v')[1]) - parseInt(a.split('-v')[1]);
  });
}

// 显示备份列表
function showBackupList() {
  console.log('📋 可用的Fast Collect备份列表:');
  console.log('=============================');
  const backups = getBackupList();
  if (backups.length === 0) {
    console.log('❌ 没有找到任何Fast Collect备份');
    process.exit(0);
  }
  
  backups.forEach((backup, index) => {
    try {
      const metadataPath = path.join(RESTORE_CONFIG.backupDir, backup, 'metadata.json');
      if (fs.existsSync(metadataPath)) {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        console.log(`${index + 1}. ${backup}`);
        console.log(`   📅 创建时间: ${new Date(metadata.backupTime).toLocaleString()}`);
        console.log(`   📋 版本: ${metadata.version}`);
        console.log(`   📁 文件数: ${metadata.lockedFiles.length}`);
        console.log(`   💡 描述: ${metadata.description}`);
      } else {
        console.log(`${index + 1}. ${backup} (缺少元数据)`);
      }
      console.log('   ---');
    } catch (error) {
      console.log(`${index + 1}. ${backup} (解析错误: ${error.message})`);
      console.log('   ---');
    }
  });
}

// 恢复指定备份
function restoreBackup(backupName) {
  console.log(`🚀 正在恢复Fast Collect备份: ${backupName}`);
  console.log('=============================');
  
  const backupPath = path.join(RESTORE_CONFIG.backupDir, backupName);
  if (!fs.existsSync(backupPath)) {
    console.error('❌ 备份不存在:', backupPath);
    process.exit(1);
  }
  
  // 读取备份元数据
  const metadataPath = path.join(backupPath, 'metadata.json');
  if (!fs.existsSync(metadataPath)) {
    console.error('❌ 备份元数据不存在');
    process.exit(1);
  }
  
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  console.log(`📋 恢复版本: ${metadata.version}`);
  console.log(`📅 备份时间: ${new Date(metadata.backupTime).toLocaleString()}`);
  console.log(`🔒 恢复文件数: ${metadata.lockedFiles.length}`);
  
  // 恢复文件
  let restoredCount = 0;
  let skippedCount = 0;
  
  metadata.lockedFiles.forEach(filePath => {
    const backupFilePath = path.join(backupPath, filePath.replace(/\//g, path.sep));
    const destPath = path.join(__dirname, '../', filePath);
    
    try {
      if (fs.existsSync(backupFilePath)) {
        // 确保目标目录存在
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        
        // 备份当前文件（以防万一）
        const backupDestPath = `${destPath}.bak.${Date.now()}`;
        if (fs.existsSync(destPath)) {
          fs.copyFileSync(destPath, backupDestPath);
          console.log(`⚠️  已备份当前文件: ${filePath} -> ${backupDestPath}`);
        }
        
        // 恢复备份文件
        fs.copyFileSync(backupFilePath, destPath);
        console.log(`✅ 恢复成功: ${filePath}`);
        restoredCount++;
      } else {
        console.warn(`⚠️  备份文件不存在: ${filePath}`);
        skippedCount++;
      }
    } catch (error) {
      console.error(`❌ 恢复失败: ${filePath} - ${error.message}`);
      skippedCount++;
    }
  });
  
  console.log('\n📊 恢复结果:');
  console.log(`✅ 成功恢复: ${restoredCount} 个文件`);
  console.log(`⚠️  跳过/失败: ${skippedCount} 个文件`);
  console.log(`🔒 总文件数: ${metadata.lockedFiles.length}`);
  
  // 更新锁定文件
  const lockFilePath = path.join(__dirname, 'fast-collect-lock.json');
  if (fs.existsSync(lockFilePath)) {
    const lockData = JSON.parse(fs.readFileSync(lockFilePath, 'utf8'));
    lockData.fastCollectLock.restoredFrom = backupName;
    lockData.fastCollectLock.restoredAt = new Date().toISOString();
    lockData.fastCollectLock.status = 'restored';
    fs.writeFileSync(lockFilePath, JSON.stringify(lockData, null, 2), 'utf8');
    console.log('✅ 锁定文件已更新');
  }
  
  console.log('\n🎉 Fast Collect功能恢复成功！');
  console.log('💡 建议运行验证脚本: npm run verify:syntax');
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('🚀 Fast Collect功能恢复脚本');
    console.log('=============================');
    console.log('用法: node scripts/restore-fast-collect.js <backup-name>');
    console.log('   或: node scripts/restore-fast-collect.js --list');
    console.log('\n');
    showBackupList();
    process.exit(0);
  }
  
  if (args[0] === '--list') {
    showBackupList();
    process.exit(0);
  }
  
  const backupName = args[0];
  restoreBackup(backupName);
  process.exit(0);
}

// 执行主函数
main();

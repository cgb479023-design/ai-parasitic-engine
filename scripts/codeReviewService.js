#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const projectRoot = path.resolve(__dirname, '..');

// 支持的命令类型
const COMMANDS = {
  SCAN: 'scan',
  FIX: 'fix'
};

// 安全检查配置
const SECURITY_CONFIG = {
  // 禁止使用的危险函数
  dangerousFunctions: [
    'eval',
    'Function',
    'setTimeout',
    'setInterval',
    'setImmediate',
    'exec',
    'spawn',
    'fork',
    'execSync',
    'spawnSync',
    'forkSync'
  ],
  // 禁止使用的危险属性
  dangerousProperties: [
    '__proto__',
    'constructor',
    'prototype',
    'process',
    'global',
    'window',
    'document'
  ],
  // 禁止使用的危险模式
  dangerousPatterns: [
    /\beval\s*\(/,
    /\bFunction\s*\(/,
    /\bsetTimeout\s*\(/,
    /\bsetInterval\s*\(/,
    /\bsetImmediate\s*\(/,
    /\bexec\s*\(/,
    /\bspawn\s*\(/,
    /\bfork\s*\(/,
    /\bexecSync\s*\(/,
    /\bspawnSync\s*\(/,
    /\bforkSync\s*\(/,
    /__proto__/,
    /constructor/,
    /prototype/,
    /process\./,
    /global\./,
    /window\./,
    /document\./,
    /localStorage/,
    /sessionStorage/,
    /cookies/,
    /XMLHttpRequest/,
    /fetch\s*\(/,
    /axios\./,
    /http\./,
    /https\./
  ]
};

// 代码质量检查配置
const QUALITY_CONFIG = {
  // 最大函数长度
  maxFunctionLength: 50,
  // 最大文件长度
  maxFileLength: 500,
  // 最大嵌套深度
  maxNestingDepth: 5,
  // 禁止的变量名
  forbiddenVariableNames: [
    'var',
    'const',
    'let',
    'function',
    'class',
    'import',
    'export'
  ],
  // 必须的注释比例
  minCommentRatio: 0.1
};

// 扫描结果类型
const SCAN_RESULT = {
  PASS: 'PASS',
  WARNING: 'WARNING',
  ERROR: 'ERROR'
};

/**
 * 执行命令并返回结果
 * @param {string} cmd 命令字符串
 * @returns {string} 命令输出
 */
function executeCommand(cmd) {
  try {
    return execSync(cmd, { cwd: projectRoot, encoding: 'utf8' });
  } catch (error) {
    return error.stdout || error.stderr || '';
  }
}

/**
 * 读取文件内容
 * @param {string} filePath 文件路径
 * @returns {string} 文件内容
 */
function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return '';
  }
}

/**
 * 获取所有源代码文件
 * @returns {string[]} 文件路径数组
 */
function getSourceFiles() {
  const cmd = `find ${projectRoot} -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | grep -v "node_modules" | grep -v "dist" | grep -v ".git"`;
  const output = executeCommand(cmd);
  return output.split('\n').filter(file => file.trim() !== '');
}

/**
 * 检查单个文件的安全问题
 * @param {string} filePath 文件路径
 * @returns {Array} 安全问题数组
 */
function checkFileSecurity(filePath) {
  const content = readFile(filePath);
  const issues = [];

  // 检查危险模式
  SECURITY_CONFIG.dangerousPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      issues.push({
        file: filePath,
        type: 'security',
        severity: SCAN_RESULT.WARNING,
        message: `Potentially dangerous pattern found: ${pattern}`,
        line: content.split('\n').findIndex(line => line.match(pattern)) + 1
      });
    }
  });

  return issues;
}

/**
 * 检查单个文件的代码质量
 * @param {string} filePath 文件路径
 * @returns {Array} 代码质量问题数组
 */
function checkFileQuality(filePath) {
  const content = readFile(filePath);
  const lines = content.split('\n');
  const issues = [];

  // 检查文件长度
  if (lines.length > QUALITY_CONFIG.maxFileLength) {
    issues.push({
      file: filePath,
      type: 'quality',
      severity: SCAN_RESULT.WARNING,
      message: `File too long (${lines.length} lines, max ${QUALITY_CONFIG.maxFileLength})`,
      line: 1
    });
  }

  // 检查函数长度
  const functionRegex = /function\s+\w+\s*\(|const\s+\w+\s*=\s*\(.*\)\s*=>|let\s+\w+\s*=\s*\(.*\)\s*=>|var\s+\w+\s*=\s*\(.*\)\s*=>|\bfunction\s*\(/g;
  let match;
  while ((match = functionRegex.exec(content)) !== null) {
    // 简单的函数长度检查（这里只是示例，实际需要更复杂的逻辑）
    const functionStart = match.index;
    const functionLines = content.substring(functionStart).split('\n').length;
    if (functionLines > QUALITY_CONFIG.maxFunctionLength) {
      issues.push({
        file: filePath,
        type: 'quality',
        severity: SCAN_RESULT.WARNING,
        message: `Function too long (${functionLines} lines, max ${QUALITY_CONFIG.maxFunctionLength})`,
        line: content.substring(0, functionStart).split('\n').length + 1
      });
    }
  }

  return issues;
}

/**
 * 执行静态代码分析
 * @returns {Object} 静态代码分析结果
 */
function runStaticAnalysis() {
  console.log('🔍 Running static code analysis...');
  
  const eslintOutput = executeCommand('npm run lint -- --output-file eslint-report.json');
  const typeCheckOutput = executeCommand('npm run type-check -- --pretty false --noEmit > type-check-report.txt 2>&1');
  
  return {
    eslint: eslintOutput,
    typeCheck: typeCheckOutput
  };
}

/**
 * 执行依赖漏洞扫描
 * @returns {Object} 依赖漏洞扫描结果
 */
function runDependencyScan() {
  console.log('🔍 Running dependency vulnerability scan...');
  
  // 使用 npm audit 检查依赖漏洞
  const npmAuditOutput = executeCommand('npm audit --json > npm-audit-report.json');
  
  // 使用 npm outdated 检查过时的依赖
  const npmOutdatedOutput = executeCommand('npm outdated --json > npm-outdated-report.json');
  
  return {
    npmAudit: npmAuditOutput,
    npmOutdated: npmOutdatedOutput
  };
}

/**
 * 执行安全扫描
 * @returns {Array} 安全扫描结果
 */
function runSecurityScan() {
  console.log('🔍 Running security scan...');
  
  const files = getSourceFiles();
  const issues = [];
  
  files.forEach(file => {
    const securityIssues = checkFileSecurity(file);
    const qualityIssues = checkFileQuality(file);
    issues.push(...securityIssues, ...qualityIssues);
  });
  
  return issues;
}

/**
 * 执行性能测试
 * @returns {Object} 性能测试结果
 */
function runPerformanceTest() {
  console.log('⚡ Running performance test...');
  
  // 这里可以添加性能测试逻辑，比如使用 Lighthouse 或其他性能测试工具
  // 目前只是一个简单的示例
  const performanceStartTime = Date.now();
  
  // 简单的性能测试：测量文件数量统计的时间
  const fileCount = getSourceFiles().length;
  const buildTime = Date.now() - performanceStartTime;
  
  return {
    timestamp: new Date().toISOString(),
    results: {
      buildTime: buildTime,
      fileCount: fileCount,
      // 可以添加更多性能指标
    }
  };
}

/**
 * 生成扫描报告
 * @param {Array} issues 问题数组
 * @param {Object} staticAnalysis 静态代码分析结果
 * @param {Object} dependencyScan 依赖漏洞扫描结果
 * @param {Object} performanceTest 性能测试结果
 */
function generateReport(issues, staticAnalysis, dependencyScan, performanceTest) {
  const report = {
    timestamp: new Date().toISOString(),
    project: {
      name: process.env.npm_package_name || 'ai-content-creation-platform',
      version: process.env.npm_package_version || '0.0.0'
    },
    summary: {
      totalIssues: issues.length,
      securityIssues: issues.filter(i => i.type === 'security').length,
      qualityIssues: issues.filter(i => i.type === 'quality').length,
      errorIssues: issues.filter(i => i.severity === SCAN_RESULT.ERROR).length,
      warningIssues: issues.filter(i => i.severity === SCAN_RESULT.WARNING).length
    },
    issues: issues,
    staticAnalysis: staticAnalysis,
    dependencyScan: dependencyScan,
    performanceTest: performanceTest
  };
  
  try {
    // 生成JSON报告
    const reportPath = path.join(projectRoot, 'code-review-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📊 Report generated: ${reportPath}`);
    
    // 生成人类可读的报告
    const humanReportPath = path.join(projectRoot, 'code-review-report.txt');
    let humanReport = 'Code Review Report\n';
    humanReport += '==================\n\n';
    humanReport += `Project: ${report.project.name} v${report.project.version}\n`;
    humanReport += `Generated: ${report.timestamp}\n\n`;
    humanReport += 'Summary\n';
    humanReport += '-------\n';
    humanReport += `Total Issues: ${report.summary.totalIssues}\n`;
    humanReport += `Security Issues: ${report.summary.securityIssues}\n`;
    humanReport += `Quality Issues: ${report.summary.qualityIssues}\n`;
    humanReport += `Errors: ${report.summary.errorIssues}\n`;
    humanReport += `Warnings: ${report.summary.warningIssues}\n\n`;
    
    if (issues.length > 0) {
      humanReport += 'Issues\n';
      humanReport += '------\n';
      issues.forEach((issue, index) => {
        humanReport += `${index + 1}. [${issue.severity}] ${issue.file}:${issue.line} - ${issue.message}\n`;
      });
    } else {
      humanReport += 'No issues found! 🎉\n';
    }
    
    fs.writeFileSync(humanReportPath, humanReport);
    console.log(`📄 Human-readable report generated: ${humanReportPath}`);
  } catch (error) {
    console.error('❌ Error generating report:', error.message);
    // 继续执行，不中断流程
  }
  
  return report;
}

/**
 * 扫描代码
 */
function scan() {
  const startTime = Date.now();
  console.log('🚀 Starting code review scan...');
  
  try {
    // 执行静态代码分析
    const staticAnalysis = runStaticAnalysis();
    
    // 执行依赖漏洞扫描
    const dependencyScan = runDependencyScan();
    
    // 执行安全扫描
    const securityIssues = runSecurityScan();
    
    // 执行性能测试
    const performanceTest = runPerformanceTest();
    
    // 生成报告
    const report = generateReport(securityIssues, staticAnalysis, dependencyScan, performanceTest);
    
    console.log('✅ Code review scan completed successfully!');
    console.log(`⏱️  Duration: ${Date.now() - startTime}ms`);
    console.log(`📊 Total issues found: ${report.summary.totalIssues}`);
    
    // 如果有错误级别的问题，返回非零退出码
    if (report.summary.errorIssues > 0) {
      process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Code review scan failed:', error.message);
    process.exit(1);
  }
}

/**
 * 修复代码问题
 */
function fix() {
  console.log('🚀 Starting code review fix...');
  
  try {
    // 运行 ESLint 自动修复
    console.log('🔧 Running ESLint auto-fix...');
    executeCommand('npm run lint -- --fix');
    
    // 运行 TypeScript 类型检查（只检查，不修复）
    console.log('🔧 Running TypeScript type check...');
    executeCommand('npm run type-check');
    
    console.log('✅ Code review fix completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Code review fix failed:', error.message);
    process.exit(1);
  }
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  const command = args[0] || COMMANDS.SCAN;
  
  switch (command) {
    case COMMANDS.SCAN:
      scan();
      break;
    case COMMANDS.FIX:
      fix();
      break;
    default:
      console.error(`❌ Unknown command: ${command}`);
      console.error(`✅ Available commands: ${Object.values(COMMANDS).join(', ')}`);
      process.exit(1);
  }
}

// 启动主函数
main();
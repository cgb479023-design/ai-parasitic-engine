/**
 * Security Scanner Service
 * 主动发现安全漏洞和潜在问题
 */

interface SecurityIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'chrome-api' | 'api-security' | 'xss' | 'input-validation' | 'network' | 'data-protection' | 'code-quality';
  file: string;
  line?: number;
  message: string;
  recommendation: string;
  autoFix?: string;
}

interface ScanResult {
  critical: SecurityIssue[];
  high: SecurityIssue[];
  medium: SecurityIssue[];
  low: SecurityIssue[];
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

import { readFile } from 'fs/promises';
import { glob } from 'glob';

const SCAN_RULES = {
  // Chrome API 安全
  chromeApi: {
    unsafeDirectDOM: {
      regex: /document\.createElement|document\.write|innerHTML\s*=/i,
      category: 'chrome-api' as const,
      severity: 'high' as const,
      message: 'Direct DOM manipulation from content script',
      recommendation: 'Use chrome.storage.managed or message passing instead'
    },
    unsafeEval: {
      regex: /\beval\s*\(|Function\s*\(|setTimeout\s*\(\s*['"]/i,
      category: 'chrome-api' as const,
      severity: 'critical' as const,
      message: 'Use of eval() or Function() with dynamic input',
      recommendation: 'Never use eval() with user input. Validate and sanitize all inputs.'
    },
    unsafeInnerHtml: {
      regex: /innerHTML\s*=\s*['"][^']*]/i,
      category: 'chrome-api' as const,
      severity: 'critical' as const,
      message: 'Setting innerHTML with user input without sanitization',
      recommendation: 'Use textContent or create text nodes with document.createTextNode()!'
    },
    unsafeStorage: {
      regex: /chrome\.storage\.(local|sync)\.set\s*\(\s*[^)]*\)\s*(?!.*validate|!.*check|typeof.*!==)/i,
      category: 'chrome-api' as const,
      severity: 'high' as const,
      message: 'Storing data in chrome.storage without validation',
      recommendation: 'Always validate data before storing. Add null/undefined checks.'
    }
  },

  // API Key 安全
  apiSecurity: {
    exposedApiKey: {
      regex: /api(?:_)?key\s*[=:]['"][^'\s]*(?!.*(?:\*){5,10}|\/\/.*SECRET|\/\/.*PRIVATE)/i,
      category: 'api-security' as const,
      severity: 'critical' as const,
      message: 'API key exposed in client-side code',
      recommendation: 'Move API key to chrome.storage.managed or environment variables. Never hardcode keys.'
    },
    hardcodedApiKey: {
      regex: /['"][^'\s]*(?:AIza|sk-|gpt_|gemini_|claude_|anthropic_)[a-zA-Z0-9_-]{20,}['"]/i,
      category: 'api-security' as const,
      severity: 'critical' as const,
      message: 'Hardcoded API key detected',
      recommendation: 'Remove hardcoded keys. Use chrome.storage.managed or backend proxy.'
    },
    apiKeyInUrl: {
      regex: /https?:\/\/[^/\s]*\?(?:api_key|key|token|secret)=['"][^'\s]*/i,
      category: 'api-security' as const,
      severity: 'critical' as const,
      message: 'API key in URL parameter',
      recommendation: 'Never pass API keys in URLs. Use proper authentication headers.'
    },
    apiKeyInLocalStorage: {
      regex: /localStorage\.(?:getItem|setItem)\s*\(\s*['"](?:api_key|key|token|secret)['"]/i,
      category: 'api-security' as const,
      severity: 'high' as const,
      message: 'API key stored in localStorage',
      recommendation: 'Use chrome.storage.managed or backend session storage instead of localStorage.'
    }
  },

  // XSS 防护
  xss: {
    userInputWithoutSanitization: {
      regex: /<(?:script|iframe|object|embed)\b[^<]*>|javascript:/i,
      category: 'xss' as const,
      severity: 'critical' as const,
      message: 'User input used without sanitization',
      recommendation: 'Always sanitize user input with DOMPurify or similar library before rendering.'
    },
    dangerouslySetInnerHTML: {
      regex: /\.innerHTML\s*=\s*(?!.*sanitize|DOMPurify|createTextNode)/i,
      category: 'xss' as const,
      severity: 'critical' as const,
      message: 'Setting innerHTML without sanitization',
      recommendation: 'Use textContent, createElement, or sanitize with DOMPurify before using innerHTML.'
    },
    unsafeHref: {
      regex: /(href\s*=\s*['"]javascript:)/i,
      category: 'xss' as const,
      severity: 'high' as const,
      message: 'Anchor tag with javascript: URI in href attribute',
      recommendation: 'Remove javascript: URIs from href attributes. Use event listeners instead.'
    },
    dataAttributeXss: {
      regex: /data-\w+\s*=\s*['"][^']*](?!.*sanitize)/i,
      category: 'xss' as const,
      severity: 'medium' as const,
      message: 'Data attribute may contain unescaped content',
      recommendation: 'Always escape or sanitize data attribute values.'
    },
    missingRelNoopener: {
      regex: /<a\s+([^>]*?\btarget=['"]_blank['"])(?!.*?\brel\s*=\s*['"][^"']*\b(noopener)\b[^"']*['"])[^>]*>/i,
      category: 'xss' as const,
      severity: 'medium' as const,
      message: 'Missing rel="noopener noreferrer" on external links with target="_blank"',
      recommendation: 'Add rel="noopener noreferrer" to all <a> tags with target="_blank" to prevent tabnapping attacks.'
    }
  },

  // 输入验证
  inputValidation: {
    missingNullCheck: {
      regex: /\be(?:const|let|var)\s+\w+\s*(?!s*(?:null|undefined)\s*\))/i,
      category: 'input-validation' as const,
      severity: 'high' as const,
      message: 'Variable used without null/undefined check',
      recommendation: 'Add null checks before accessing properties. Use optional chaining (?.) or explicit null checks.'
    },
    apiCallWithoutValidation: {
      regex: /fetch\s*\(\s*['"][^'\s]*\)\s*(?!.*validate|sanitize)/i,
      category: 'input-validation' as const,
      severity: 'high' as const,
      message: 'API call without input validation',
      recommendation: 'Always validate and sanitize inputs before API calls.'
    },
    typeSafetyAny: {
      regex: /:\s*any(?!s*\w*\s*\[)|let\s+\w+\s*:\s*any(?!s*\w)/i,
      category: 'code-quality' as const,
      severity: 'medium' as const,
      message: 'Using any type without specific type definition',
      recommendation: 'Use proper TypeScript types or interfaces instead of any.'
    }
  },

  // 网络安全
  network: {
    insecureHttp: {
      regex: /http:\/\/(?![^/\s]*api\.)[^/\s]*/i,
      category: 'network' as const,
      severity: 'medium' as const,
      message: 'Using HTTP instead of HTTPS',
      recommendation: 'Use HTTPS for all API calls in production. Implement HTTPS redirect.'
    },
    missingCors: {
      regex: /fetch\s*\(\s*['"][^'\s]*\)\s*(?!.*headers:.*['"]Access-Control-Allow-Origin['"])/i,
      category: 'network' as const,
      severity: 'medium' as const,
      message: 'Missing CORS headers',
      recommendation: 'Add proper CORS headers: Access-Control-Allow-Origin, Access-Control-Allow-Methods, etc.'
    },
    missingTimeout: {
      regex: /fetch\s*\(\s*['"][^'\s]*\)\s*(?!.*timeout:\s*\d+)/i,
      category: 'network' as const,
      severity: 'medium' as const,
      message: 'Fetch without timeout',
      recommendation: 'Always set timeout for fetch requests to prevent hanging.'
    },
    broadPostMessageTarget: {
      regex: /postMessage\s*\([^,]+,\s*['"]\*['"]\)/i,
      category: 'network' as const,
      severity: 'high' as const,
      message: 'Using "*" as targetOrigin in postMessage, allowing any window to receive the message',
      recommendation: 'Specify a precise targetOrigin (e.g., window.location.origin) to prevent message interception by malicious scripts.'
    }
  },

  // 数据保护
  dataProtection: {
    sensitiveDataInLogs: {
      regex: /console\.(log|debug|info)\s*\(\s*(?:api(?:_)?key|token|secret|password|credential)['"]/i,
      category: 'data-protection' as const,
      severity: 'critical' as const,
      message: 'Sensitive data logged to console',
      recommendation: 'Never log sensitive data. Use proper logging service that redacts sensitive values.'
    },
    sensitiveDataInStorage: {
      regex: /chrome\.storage\.(local|sync)\.set\s*\(\s*(?:api(?:_)?key|token|secret|password|credential)['"]/i,
      category: 'data-protection' as const,
      severity: 'high' as const,
      message: 'Sensitive data stored in chrome.storage',
      recommendation: 'Never store sensitive data in chrome.storage.local. Use chrome.storage.managed or backend proxy.'
    }
  },

  // 代码质量
  codeQuality: {
    unusedVariables: {
      regex: /(?:const|let|var)\s+\w+(?:,\s*\w+){2,}\s*[;}]?\s*(?!.*\w)/i,
      category: 'code-quality' as const,
      severity: 'low' as const,
      message: 'Unused variables detected',
      recommendation: 'Remove unused variables to improve code clarity.'
    },
    potentialXss: {
      regex: /[`]['"][^'\s]*\s*\$(?:(?:\w+)|(?:\{[^}]+\}))/i,
      category: 'xss' as const,
      severity: 'medium' as const,
      message: 'Potential XSS via template literals',
      recommendation: 'Escape or sanitize template literal values before rendering.'
    },
    missingErrorHandling: {
      regex: /(?:fetch|await|chrome\.[^;\s]+\s*)(?!s*(?:try\s*{|catch\s*{))/i,
      category: 'code-quality' as const,
      severity: 'high' as const,
      message: 'Async operation without error handling',
      recommendation: 'Always wrap async operations in try-catch blocks.'
    },
    insecureReactLifecycle: {
      regex: /(componentWillMount|componentWillReceiveProps|componentWillUpdate)/i,
      category: 'code-quality' as const,
      severity: 'medium' as const,
      message: 'Using deprecated and potentially insecure React lifecycle methods',
      recommendation: 'Refactor to use componentDidMount, componentDidUpdate, or getDerivedStateFromProps.'
    }
  }
};

export class SecurityScanner {
  private issues: SecurityIssue[] = [];
  private scanCache: Map<string, SecurityIssue[]> = new Map();

  /**
   * 扫描文件中的安全问题
   */
  async scanFile(filePath: string, content: string): Promise<SecurityIssue[]> {
    const fileIssues: SecurityIssue[] = [];
    let lineCount = 1;

    // 逐行扫描
    const lines = content.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue; // Use line.trim() for the check, but not for regex test

      // 检查每个规则
      Object.values(SCAN_RULES).forEach(category => {
        Object.entries(category).forEach(([ruleName, rule]) => {
          if (rule.regex.test(line)) { // Test against the original line
            const issue: SecurityIssue = {
              id: `${filePath}_${ruleName}_${lineCount}`,
              severity: rule.severity,
              category: rule.category,
              file: filePath,
              line: lineCount,
              message: rule.message,
              recommendation: rule.recommendation
            };
            fileIssues.push(issue);
          }
        });
      });

      lineCount++;
    }

    return fileIssues;
  }

  /**
   * 扫描整个项目
   */
  async scanProject(): Promise<ScanResult> {
    console.log('\n🔍 Scanning project for security issues...');

    // 获取所有源文件
    const sourceFiles = await this.getSourceFiles();

    // 扫描每个文件
    for (const file of sourceFiles) {
      const content = await this.readFile(file.path);
      const fileIssues = await this.scanFile(file.path, content);

      this.issues.push(...fileIssues);
    }

    // 分类问题
    const result = this.classifyIssues(this.issues);

    // 输出报告
    this.printReport(result);

    return result;
  }

  /**
   * 获取源文件列表
   */
  private async getSourceFiles(): Promise<{ path: string; type: string }[]> {
    const files = await glob('**/*.{ts,tsx,js,jsx}', {
      ignore: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**', 'scripts/**', 'backups/**', 'tests/**', '__tests__/**', '*.test.*'],
    });

    return files.map(f => ({
      path: f,
      type: f.endsWith('.tsx') || f.endsWith('.ts') ? 'typescript' : 'javascript'
    }));
  }

  /**
   * 读取文件内容
   */
  private async readFile(filePath: string): Promise<string> {
    return readFile(filePath, 'utf8');
  }

  /**
   * 分类问题
   */
  private classifyIssues(issues: SecurityIssue[]): ScanResult {
    const summary = {
      total: issues.length,
      critical: issues.filter(i => i.severity === 'critical').length,
      high: issues.filter(i => i.severity === 'high').length,
      medium: issues.filter(i => i.severity === 'medium').length,
      low: issues.filter(i => i.severity === 'low').length
    };

    return {
      critical: issues.filter(i => i.severity === 'critical'),
      high: issues.filter(i => i.severity === 'high'),
      medium: issues.filter(i => i.severity === 'medium'),
      low: issues.filter(i => i.severity === 'low'),
      summary
    };
  }

  /**
   * 打印安全扫描报告
   */
  private printReport(result: ScanResult): void {
    console.log('\n' + '='.repeat(60));
    console.log('🔒 SECURITY SCAN REPORT');
    console.log('='.repeat(60) + '\n');

    // 按严重程度输出
    console.log('\n🔴 Critical Issues (Must Fix Immediately):');
    result.critical.forEach((issue, i) => {
      console.log(`\n   [${i + 1}] ${issue.file}:${issue.line || '?'}`);
      console.log(`      Category: ${issue.category}`);
      console.log(`      Message: ${issue.message}`);
      console.log(`      💡 ${issue.recommendation}`);
    });

    if (result.critical.length === 0) {
      console.log('   (None)\n');
    }

    console.log('\n🟠 High Priority Issues:');
    result.high.forEach((issue, i) => {
      console.log(`\n   [${i + 1}] ${issue.file}:${issue.line || '?'}`);
      console.log(`      Category: ${issue.category}`);
      console.log(`      Message: ${issue.message}`);
      console.log(`      💡 ${issue.recommendation}`);
    });

    if (result.high.length === 0) {
      console.log('   (None)\n');
    }

    console.log('\n🟡 Medium Priority Issues:');
    result.medium.forEach((issue, i) => {
      console.log(`\n   [${i + 1}] ${issue.file}:${issue.line || '?'}`);
      console.log(`      Category: ${issue.category}`);
      console.log(`      Message: ${issue.message}`);
      console.log(`      💡 ${issue.recommendation}`);
    });

    if (result.medium.length === 0) {
      console.log('   (None)\n');
    }

    console.log('\n🟢 Low Priority Issues:');
    result.low.forEach((issue, i) => {
      console.log(`\n   [${i + 1}] ${issue.file}:${issue.line || '?'}`);
      console.log(`      Category: ${issue.category}`);
      console.log(`      Message: ${issue.message}`);
      console.log(`      💡 ${issue.recommendation}`);
    });

    if (result.low.length === 0) {
      console.log('   (None)\n');
    }

    // 摘要
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60) + '\n');
    console.log(`Total Issues: ${result.summary.total}`);
    console.log(`Critical: ${result.summary.critical}`);
    console.log(`High: ${result.summary.high}`);
    console.log(`Medium: ${result.summary.medium}`);
    console.log(`Low: ${result.summary.low}`);
    console.log('\n' + '='.repeat(60));
  }

  /**
   * 生成修复报告
   */
  generateFixReport(): string {
    let report = '\n# Security Fix Recommendations\n\n';
    report += 'Based on the security scan, here are prioritized fixes:\n\n';

    const bySeverity = {
      critical: this.issues.filter(i => i.severity === 'critical'),
      high: this.issues.filter(i => i.severity === 'high'),
      medium: this.issues.filter(i => i.severity === 'medium')
    };

    // Critical issues
    if (bySeverity.critical.length > 0) {
      report += '## 🔴 CRITICAL (Fix Immediately)\n\n';
      bySeverity.critical.forEach((issue, i) => {
        report += `### ${i + 1}. ${issue.file}:${issue.line}\n`;
        report += `**Category:** ${issue.category}\n`;
        report += `**Issue:** ${issue.message}\n`;
        report += `**Fix:** ${issue.recommendation}\n\n`;
      });
    }

    // High issues
    if (bySeverity.high.length > 0) {
      report += '## 🟠 HIGH PRIORITY\n\n';
      bySeverity.high.forEach((issue, i) => {
        report += `### ${i + 1}. ${issue.file}:${issue.line}\n`;
        report += `**Category:** ${issue.category}\n`;
        report += `**Issue:** ${issue.message}\n`;
        report += `**Fix:** ${issue.recommendation}\n\n`;
      });
    }

    // Medium issues
    if (bySeverity.medium.length > 0) {
      report += '## 🟡 MEDIUM PRIORITY\n\n';
      bySeverity.medium.forEach((issue, i) => {
        report += `### ${i + 1}. ${issue.file}:${issue.line}\n`;
        report += `**Category:** ${issue.category}\n`;
        report += `**Issue:** ${issue.message}\n`;
        report += `**Fix:** ${issue.recommendation}\n\n`;
      });
    }

    if (this.issues.length === 0) {
      report += '✅ No security issues found!\n';
    }

    return report;
  }

  /**
   * 清除扫描缓存
   */
  clearCache(): void {
    this.scanCache.clear();
    this.issues = [];
    console.log('🔄 Security scan cache cleared');
  }
}

// 导出单例实例
export const securityScanner = new SecurityScanner();

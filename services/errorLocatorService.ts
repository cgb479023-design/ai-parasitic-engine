/**
 * Error Locator Service
 * 增强的错误定位服务，精确到行和列的错误定位
 */

import * as ts from 'typescript';
import * as es from 'eslint';

interface ErrorLocation {
  file: string;
  line: number;
  column: number;
  offset: number;
}

interface ErrorPattern {
  id: string;
  name: string;
  pattern: RegExp;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  fixSuggestion: string;
}

interface DetailedError {
  id: string;
  location: ErrorLocation;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  pattern?: ErrorPattern;
  stackTrace?: string[];
  fixSuggestion: string;
  confidence: number;
}

interface ErrorAnalysis {
  errors: DetailedError[];
  patternsDetected: Set<string>;
  severityDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  categoryDistribution: Map<string, number>;
}

const COMMON_ERROR_PATTERNS: ErrorPattern[] = [
  {
    id: 'missing-semicolon',
    name: 'Missing Semicolon',
    pattern: /(\w|\}|\]|\))\s*(\}|\]|\)|$)/,
    description: 'Missing semicolon at the end of statement',
    severity: 'low',
    fixSuggestion: 'Add a semicolon at the end of the statement'
  },
  {
    id: 'unused-variable',
    name: 'Unused Variable',
    pattern: /const\s+([a-zA-Z_$]\w*)\s*=/, // Simplified pattern
    description: 'Variable declared but never used',
    severity: 'medium',
    fixSuggestion: 'Remove unused variable or use it'
  },
  {
    id: 'no-undef',
    name: 'Undefined Variable',
    pattern: /([a-zA-Z_$]\w*)\s*[=+\-*/]/,
    description: 'Variable used before declaration',
    severity: 'high',
    fixSuggestion: 'Declare variable before use or check spelling'
  },
  {
    id: 'type-mismatch',
    name: 'Type Mismatch',
    pattern: /([a-zA-Z_$]\w*)\s*:\s*(string|number|boolean|object|array|any)/,
    description: 'Type mismatch in assignment or return',
    severity: 'high',
    fixSuggestion: 'Ensure consistent types'
  },
  {
    id: 'null-pointer',
    name: 'Potential Null Pointer',
    pattern: /(\w+)\.(\w+)/,
    description: 'Potential null or undefined access',
    severity: 'high',
    fixSuggestion: 'Add null check before accessing property'
  },
  {
    id: 'unreachable-code',
    name: 'Unreachable Code',
    pattern: /return\s+.*?\s*\n[^}\s]/,
    description: 'Code after return statement',
    severity: 'medium',
    fixSuggestion: 'Remove unreachable code'
  },
  {
    id: 'infinite-loop',
    name: 'Potential Infinite Loop',
    pattern: /while\s*\(\s*(true|1)\s*\)/,
    description: 'Potential infinite loop',
    severity: 'critical',
    fixSuggestion: 'Add exit condition to loop'
  },
  {
    id: 'callback-hell',
    name: 'Callback Hell',
    pattern: /}\s*\).*?\s*function\s*\(/,
    description: 'Nested callbacks making code hard to read',
    severity: 'medium',
    fixSuggestion: 'Use async/await or promises'
  }
];

export class ErrorLocatorService {
  private readonly errorPatterns: ErrorPattern[];
  private readonly tsProgram: ts.Program | null;

  constructor() {
    this.errorPatterns = COMMON_ERROR_PATTERNS;
    this.tsProgram = this.createTSProgram();
  }

  /**
   * 创建TypeScript程序用于AST分析
   */
  private createTSProgram(): ts.Program | null {
    try {
      const tsConfigPath = ts.findConfigFile('.', ts.sys.fileExists);
      if (tsConfigPath) {
        const tsConfig = ts.readConfigFile(tsConfigPath, ts.sys.readFile).config;
        const parsedCmdLine = ts.parseJsonConfigFileContent(tsConfig, ts.sys, './');
        return ts.createProgram(parsedCmdLine.fileNames, parsedCmdLine.options);
      }
      return null;
    } catch (error) {
      console.warn('Failed to create TypeScript program:', error);
      return null;
    }
  }

  /**
   * 分析文件中的错误
   */
  async analyzeFile(filePath: string, content: string): Promise<ErrorAnalysis> {
    console.log(`🔍 Analyzing errors in: ${filePath}`);

    const errors: DetailedError[] = [];
    const patternsDetected = new Set<string>();
    const categoryDistribution = new Map<string, number>();

    // 1. 使用正则表达式匹配常见错误模式
    const regexErrors = this.detectPatterns(filePath, content);
    errors.push(...regexErrors);

    // 2. 使用TypeScript编译器进行类型检查
    if (this.tsProgram) {
      const tsErrors = this.detectTSErrors(filePath);
      errors.push(...tsErrors);
    }

    // 3. 统计分析结果
    const severityDistribution = {
      critical: errors.filter(e => e.severity === 'critical').length,
      high: errors.filter(e => e.severity === 'high').length,
      medium: errors.filter(e => e.severity === 'medium').length,
      low: errors.filter(e => e.severity === 'low').length
    };

    // 4. 统计检测到的模式和类别
    errors.forEach(error => {
      if (error.pattern) {
        patternsDetected.add(error.pattern.id);
      }
      const count = categoryDistribution.get(error.category) || 0;
      categoryDistribution.set(error.category, count + 1);
    });

    return {
      errors,
      patternsDetected,
      severityDistribution,
      categoryDistribution
    };
  }

  /**
   * 使用正则表达式检测常见错误模式
   */
  private detectPatterns(filePath: string, content: string): DetailedError[] {
    const errors: DetailedError[] = [];
    const lines = content.split('\n');

    this.errorPatterns.forEach(pattern => {
      let match;
      const regex = new RegExp(pattern.pattern.source, 'g');

      while ((match = regex.exec(content)) !== null) {
        // 计算匹配位置的行号和列号
        const line = this.getLineNumber(content, match.index) + 1;
        const column = this.getColumnNumber(content, match.index) + 1;
        const lineContent = lines[line - 1];

        const error: DetailedError = {
          id: `${pattern.id}_${line}_${column}`,
          location: {
            file: filePath,
            line,
            column,
            offset: match.index
          },
          message: `Pattern match: ${pattern.description}`,
          severity: pattern.severity,
          category: 'regex-pattern',
          pattern,
          fixSuggestion: pattern.fixSuggestion,
          confidence: 0.75
        };

        errors.push(error);
      }
    });

    return errors;
  }

  /**
   * 使用TypeScript编译器检测类型错误
   */
  private detectTSErrors(filePath: string): DetailedError[] {
    const errors: DetailedError[] = [];

    if (!this.tsProgram) {
      return errors;
    }

    try {
      const diagnostics = this.tsProgram.getSemanticDiagnostics();
      
      diagnostics.forEach(diagnostic => {
        if (diagnostic.file && diagnostic.start !== undefined && diagnostic.messageText) {
          const location = this.tsProgram!.getFileLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
          const message = typeof diagnostic.messageText === 'string' 
            ? diagnostic.messageText 
            : diagnostic.messageText.messageText;

          // 映射TypeScript错误级别到我们的 severity
          let severity: 'critical' | 'high' | 'medium' | 'low' = 'medium';
          switch (diagnostic.category) {
            case ts.DiagnosticCategory.Error:
              severity = 'high';
              break;
            case ts.DiagnosticCategory.Warning:
              severity = 'medium';
              break;
            case ts.DiagnosticCategory.Suggestion:
              severity = 'low';
              break;
            case ts.DiagnosticCategory.Message:
              severity = 'low';
              break;
          }

          const error: DetailedError = {
            id: `ts_${diagnostic.code}_${location.line + 1}_${location.character + 1}`,
            location: {
              file: diagnostic.file.fileName,
              line: location.line + 1,
              column: location.character + 1,
              offset: diagnostic.start
            },
            message,
            severity,
            category: 'typescript',
            fixSuggestion: this.getTSFixSuggestion(diagnostic.code),
            confidence: 0.95
          };

          errors.push(error);
        }
      });
    } catch (error) {
      console.warn('Error detecting TypeScript errors:', error);
    }

    return errors;
  }

  /**
   * 根据TypeScript错误代码提供修复建议
   */
  private getTSFixSuggestion(code: number): string {
    const fixMap: Record<number, string> = {
      2322: 'Check type compatibility between assignment and variable type',
      2339: 'Check if property exists on object or add type guard',
      2532: 'Add null/undefined check before accessing property',
      2554: 'Provide all required arguments to function',
      7006: 'Add type annotation to variable',
      7030: 'Use return statement in function that should return a value',
      2304: 'Check spelling of variable or add declaration',
      2375: 'Ensure consistent return types in function',
      2454: 'Initialize variable before use',
      2345: 'Check argument types when calling function'
    };

    return fixMap[code] || 'Check TypeScript documentation for more details';
  }

  /**
   * 获取字符串中指定偏移量的行号
   */
  private getLineNumber(content: string, offset: number): number {
    return content.substring(0, offset).split('\n').length - 1;
  }

  /**
   * 获取字符串中指定偏移量的列号
   */
  private getColumnNumber(content: string, offset: number): number {
    const line = content.substring(0, offset).split('\n').pop() || '';
    return line.length;
  }

  /**
   * 解析堆栈跟踪，提取错误位置
   */
  parseStackTrace(stackTrace: string, sourceMap?: any): DetailedError[] {
    const errors: DetailedError[] = [];
    const stackLines = stackTrace.split('\n');
    
    const stackPattern = /at\s+.*?\s+\((.*?):(\d+):(\d+)\)/;
    
    stackLines.forEach(line => {
      const match = stackPattern.exec(line);
      if (match) {
        const [, file, lineStr, columnStr] = match;
        const line = parseInt(lineStr, 10);
        const column = parseInt(columnStr, 10);
        
        const error: DetailedError = {
          id: `stack_${line}_${column}`,
          location: {
            file,
            line,
            column,
            offset: 0 // 无法从堆栈跟踪获取偏移量
          },
          message: 'Error from stack trace',
          severity: 'high',
          category: 'runtime-error',
          fixSuggestion: 'Check the error at the specified location',
          confidence: 0.85,
          stackTrace: stackLines.slice(0, 5) // 保留前5行堆栈跟踪
        };
        
        errors.push(error);
      }
    });
    
    return errors;
  }

  /**
   * 分析错误并提供详细报告
   */
  generateErrorReport(analysis: ErrorAnalysis): string {
    let report = '\n' + '='.repeat(70);
    report += '\n🔍 ERROR LOCATION REPORT';
    report += '\n' + '='.repeat(70) + '\n';
    
    report += `\n📊 Error Summary:\n`;
    report += `   Total Errors: ${analysis.errors.length}\n`;
    report += `   Critical: ${analysis.severityDistribution.critical}\n`;
    report += `   High: ${analysis.severityDistribution.high}\n`;
    report += `   Medium: ${analysis.severityDistribution.medium}\n`;
    report += `   Low: ${analysis.severityDistribution.low}\n`;
    
    report += '\n📋 Errors by Category:\n';
    analysis.categoryDistribution.forEach((count, category) => {
      report += `   ${category}: ${count}\n`;
    });
    
    if (analysis.patternsDetected.size > 0) {
      report += '\n🔍 Patterns Detected:\n';
      analysis.patternsDetected.forEach(patternId => {
        const pattern = this.errorPatterns.find(p => p.id === patternId);
        if (pattern) {
          report += `   - ${pattern.name}\n`;
        }
      });
    }
    
    if (analysis.errors.length > 0) {
      report += '\n💡 Top Errors (by severity):\n';
      const sortedErrors = [...analysis.errors]
        .sort((a, b) => {
          const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          return severityOrder[a.severity] - severityOrder[b.severity];
        })
        .slice(0, 10);
      
      sortedErrors.forEach((error, index) => {
        report += `\n   ${index + 1}. ${error.message}`;
        report += `\n      Location: ${error.location.file}:${error.location.line}:${error.location.column}`;
        report += `\n      Severity: ${error.severity}`;
        report += `\n      Suggestion: ${error.fixSuggestion}`;
        report += `\n      Confidence: ${(error.confidence * 100).toFixed(0)}%`;
      });
    }
    
    report += '\n' + '='.repeat(70);
    report += '\n🚀 Recommendations:\n';
    report += '1. Fix all Critical and High severity errors immediately\n';
    report += '2. Address Medium severity errors in the next sprint\n';
    report += '3. Use linters and type checkers in CI/CD pipeline\n';
    report += '4. Add unit tests for critical code paths\n';
    report += '5. Consider implementing error monitoring in production\n';
    
    report += '\n' + '='.repeat(70);
    
    return report;
  }

  /**
   * 集成到代码审查流程
   */
  async integrateWithCodeReview(filePath: string, content: string): Promise<ErrorAnalysis> {
    return this.analyzeFile(filePath, content);
  }
}

// 导出单例实例
export const errorLocatorService = new ErrorLocatorService();
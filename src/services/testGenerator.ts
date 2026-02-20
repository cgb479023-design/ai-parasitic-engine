import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

// 定义测试生成相关接口
export interface TestCase {
  id: string;
  name: string;
  description: string;
  testCode: string;
  expectedResult: any;
  priority: 'low' | 'medium' | 'high';
  coverage: {
    lines: number[];
    branches: number[];
  };
}

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  testCases: TestCase[];
  filePath: string;
  targetFile: string;
  testFramework: 'vitest' | 'jest' | 'mocha';
}

export interface TestGenerationConfig {
  testFramework: 'vitest' | 'jest' | 'mocha';
  outputDirectory: string;
  generateMocks: boolean;
  generateEdgeCases: boolean;
  generateRegressionTests: boolean;
  coverageThreshold: number;
}

export interface FixInfo {
  filePath: string;
  line: number;
  column: number;
  oldCode: string;
  newCode: string;
  fixType: 'bug' | 'feature' | 'refactor' | 'performance';
  description: string;
}

export interface TestGenerationResult {
  success: boolean;
  testSuite: TestSuite;
  generatedTests: number;
  coverage: number;
  warnings: string[];
}

/**
 * 自动测试生成服务
 * 根据修复内容自动生成单元测试用例
 */
export class TestGenerator {
  private readonly config: TestGenerationConfig;

  constructor(config?: Partial<TestGenerationConfig>) {
    this.config = {
      testFramework: config?.testFramework || 'vitest',
      outputDirectory: config?.outputDirectory || '__tests__',
      generateMocks: config?.generateMocks || true,
      generateEdgeCases: config?.generateEdgeCases || true,
      generateRegressionTests: config?.generateRegressionTests || true,
      coverageThreshold: config?.coverageThreshold || 80
    };
  }

  /**
   * 根据修复信息生成测试用例
   */
  async generateTestsForFix(fixInfo: FixInfo): Promise<TestGenerationResult> {
    console.log(`生成测试用例: ${fixInfo.description}`);

    try {
      const sourceFile = this.getSourceFile(fixInfo.filePath);
      if (!sourceFile) {
        throw new Error(`无法读取文件: ${fixInfo.filePath}`);
      }

      // 分析修复内容
      const fixAnalysis = this.analyzeFix(sourceFile, fixInfo);
      
      // 生成测试套件
      const testSuite = this.createTestSuite(fixInfo, fixAnalysis);
      
      // 生成测试用例
      const testCases = this.generateTestCases(fixInfo, fixAnalysis);
      testSuite.testCases = testCases;
      
      // 写入测试文件
      const testFilePath = this.writeTestFile(testSuite);
      
      return {
        success: true,
        testSuite,
        generatedTests: testCases.length,
        coverage: this.calculateExpectedCoverage(testCases),
        warnings: []
      };
    } catch (error) {
      console.error(`生成测试失败: ${error.message}`);
      return {
        success: false,
        testSuite: this.createEmptyTestSuite(fixInfo),
        generatedTests: 0,
        coverage: 0,
        warnings: [error.message]
      };
    }
  }

  /**
   * 分析修复内容
   */
  private analyzeFix(sourceFile: ts.SourceFile, fixInfo: FixInfo) {
    // 查找修复位置的父节点（函数、类等）
    const fixPosition = sourceFile.getPositionOfLineAndCharacter(fixInfo.line - 1, fixInfo.column - 1);
    const fixNode = this.findEnclosingNode(sourceFile, fixPosition);
    
    let functionInfo: any = null;
    let classInfo: any = null;

    // 如果修复在函数内
    if (ts.isFunctionDeclaration(fixNode) || ts.isFunctionExpression(fixNode) || ts.isArrowFunction(fixNode)) {
      functionInfo = this.extractFunctionInfo(fixNode as ts.FunctionDeclaration, sourceFile);
    } 
    // 如果修复在类内
    else if (ts.isClassDeclaration(fixNode)) {
      classInfo = this.extractClassInfo(fixNode, sourceFile);
    }

    return {
      fixNode,
      functionInfo,
      classInfo,
      affectedLines: this.getAffectedLines(sourceFile, fixInfo)
    };
  }

  /**
   * 查找包含指定位置的节点
   */
  private findEnclosingNode(sourceFile: ts.SourceFile, position: number): ts.Node | undefined {
    const currentNode: ts.Node | undefined = sourceFile;
    let enclosingNode: ts.Node | undefined;

    const visitor = (node: ts.Node) => {
      if (ts.isSourceFile(node)) {
        // 跳过源文件节点，直接处理其子节点
        ts.forEachChild(node, visitor);
        return;
      }

      if (position >= node.getStart() && position <= node.getEnd()) {
        enclosingNode = node;
        ts.forEachChild(node, visitor);
      }
    };

    visitor(sourceFile);
    return enclosingNode;
  }

  /**
   * 提取函数信息
   */
  private extractFunctionInfo(func: ts.FunctionDeclaration, sourceFile: ts.SourceFile) {
    if (!func.name) return null;

    const funcName = func.name.getText();
    const parameters = func.parameters.map(param => ({
      name: param.name.getText(),
      type: param.type ? param.type.getText() : 'any',
      isOptional: param.questionToken !== undefined
    }));

    const returnType = func.type ? func.type.getText() : 'void';
    const isAsync = func.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword) || false;

    return {
      name: funcName,
      parameters,
      returnType,
      isAsync,
      location: {
        filePath: sourceFile.fileName,
        line: sourceFile.getLineAndCharacterOfPosition(func.getStart()).line + 1,
        column: sourceFile.getLineAndCharacterOfPosition(func.getStart()).character + 1
      },
      body: func.body?.getText() || ''
    };
  }

  /**
   * 提取类信息
   */
  private extractClassInfo(cls: ts.ClassDeclaration, sourceFile: ts.SourceFile) {
    if (!cls.name) return null;

    const className = cls.name.getText();
    const methods = cls.members
      .filter(member => ts.isMethodDeclaration(member) || ts.isFunctionDeclaration(member))
      .map(method => {
        if (ts.isMethodDeclaration(method) || ts.isFunctionDeclaration(method)) {
          return {
            name: method.name?.getText() || 'anonymous',
            isPublic: !method.modifiers?.some(mod => mod.kind === ts.SyntaxKind.PrivateKeyword || mod.kind === ts.SyntaxKind.ProtectedKeyword),
            isStatic: method.modifiers?.some(mod => mod.kind === ts.SyntaxKind.StaticKeyword) || false
          };
        }
        return null;
      })
      .filter((method): method is NonNullable<typeof method> => method !== null);

    return {
      name: className,
      methods,
      location: {
        filePath: sourceFile.fileName,
        line: sourceFile.getLineAndCharacterOfPosition(cls.getStart()).line + 1,
        column: sourceFile.getLineAndCharacterOfPosition(cls.getStart()).character + 1
      }
    };
  }

  /**
   * 获取受影响的行号
   */
  private getAffectedLines(sourceFile: ts.SourceFile, fixInfo: FixInfo): number[] {
    const affectedLines = new Set<number>();
    const oldLines = fixInfo.oldCode.split('\n').length;
    
    // 计算受影响的行范围
    for (let i = 0; i < oldLines; i++) {
      affectedLines.add(fixInfo.line + i);
    }
    
    return Array.from(affectedLines).sort((a, b) => a - b);
  }

  /**
   * 创建测试套件
   */
  private createTestSuite(fixInfo: FixInfo, fixAnalysis: any): TestSuite {
    const fileName = path.basename(fixInfo.filePath);
    const testFileName = fileName.replace(/\.(ts|tsx|js|jsx)$/, '.test.$1');
    
    return {
      id: `test_suite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `${path.parse(fileName).name} Tests`,
      description: `自动生成的测试套件，用于验证 ${fixInfo.description} 的修复`,
      testCases: [],
      filePath: path.join(this.config.outputDirectory, testFileName),
      targetFile: fixInfo.filePath,
      testFramework: this.config.testFramework
    };
  }

  /**
   * 创建空测试套件
   */
  private createEmptyTestSuite(fixInfo: FixInfo): TestSuite {
    const fileName = path.basename(fixInfo.filePath);
    const testFileName = fileName.replace(/\.(ts|tsx|js|jsx)$/, '.test.$1');
    
    return {
      id: `test_suite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `${path.parse(fileName).name} Tests`,
      description: `自动生成的测试套件，用于验证 ${fixInfo.description} 的修复`,
      testCases: [],
      filePath: path.join(this.config.outputDirectory, testFileName),
      targetFile: fixInfo.filePath,
      testFramework: this.config.testFramework
    };
  }

  /**
   * 生成测试用例
   */
  private generateTestCases(fixInfo: FixInfo, fixAnalysis: any): TestCase[] {
    const testCases: TestCase[] = [];
    
    // 根据修复类型生成不同的测试用例
    switch (fixInfo.fixType) {
      case 'bug':
        testCases.push(...this.generateBugFixTests(fixInfo, fixAnalysis));
        break;
      case 'feature':
        testCases.push(...this.generateFeatureTests(fixInfo, fixAnalysis));
        break;
      case 'refactor':
        testCases.push(...this.generateRefactorTests(fixInfo, fixAnalysis));
        break;
      case 'performance':
        testCases.push(...this.generatePerformanceTests(fixInfo, fixAnalysis));
        break;
    }
    
    // 生成边界情况测试
    if (this.config.generateEdgeCases) {
      testCases.push(...this.generateEdgeCaseTests(fixInfo, fixAnalysis));
    }
    
    // 生成回归测试
    if (this.config.generateRegressionTests) {
      testCases.push(...this.generateRegressionTests(fixInfo, fixAnalysis));
    }
    
    return testCases;
  }

  /**
   * 生成Bug修复测试
   */
  private generateBugFixTests(fixInfo: FixInfo, fixAnalysis: any): TestCase[] {
    const testCases: TestCase[] = [];
    
    if (fixAnalysis.functionInfo) {
      const func = fixAnalysis.functionInfo;
      
      // 生成基本的功能测试
      const testCase: TestCase = {
        id: `test_case_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `should ${func.name} work correctly after fix`,
        description: `验证 ${func.name} 函数在修复后能正确工作`,
        testCode: this.generateFunctionTestCode(fixAnalysis, func),
        expectedResult: this.generateExpectedResult(func),
        priority: 'high',
        coverage: {
          lines: fixAnalysis.affectedLines,
          branches: []
        }
      };
      
      testCases.push(testCase);
    }
    
    return testCases;
  }

  /**
   * 生成功能测试
   */
  private generateFeatureTests(fixInfo: FixInfo, fixAnalysis: any): TestCase[] {
    const testCases: TestCase[] = [];
    
    if (fixAnalysis.functionInfo) {
      const func = fixAnalysis.functionInfo;
      
      // 生成新功能的测试用例
      const testCase: TestCase = {
        id: `test_case_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `should ${func.name} implement the new feature`,
        description: `验证 ${func.name} 函数实现了新功能`,
        testCode: this.generateFunctionTestCode(fixAnalysis, func, true),
        expectedResult: this.generateExpectedResult(func),
        priority: 'high',
        coverage: {
          lines: fixAnalysis.affectedLines,
          branches: []
        }
      };
      
      testCases.push(testCase);
    }
    
    return testCases;
  }

  /**
   * 生成重构测试
   */
  private generateRefactorTests(fixInfo: FixInfo, fixAnalysis: any): TestCase[] {
    const testCases: TestCase[] = [];
    
    if (fixAnalysis.functionInfo) {
      const func = fixAnalysis.functionInfo;
      
      // 生成重构后的功能验证测试
      const testCase: TestCase = {
        id: `test_case_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `should ${func.name} maintain functionality after refactor`,
        description: `验证 ${func.name} 函数在重构后保持原有功能`,
        testCode: this.generateFunctionTestCode(fixAnalysis, func),
        expectedResult: this.generateExpectedResult(func),
        priority: 'medium',
        coverage: {
          lines: fixAnalysis.affectedLines,
          branches: []
        }
      };
      
      testCases.push(testCase);
    }
    
    return testCases;
  }

  /**
   * 生成性能测试
   */
  private generatePerformanceTests(fixInfo: FixInfo, fixAnalysis: any): TestCase[] {
    const testCases: TestCase[] = [];
    
    if (fixAnalysis.functionInfo) {
      const func = fixAnalysis.functionInfo;
      
      // 生成性能测试用例
      const testCase: TestCase = {
        id: `test_case_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `should ${func.name} perform efficiently after fix`,
        description: `验证 ${func.name} 函数在修复后性能得到提升`,
        testCode: this.generatePerformanceTestCode(fixAnalysis, func),
        expectedResult: { executionTime: '< 100ms' },
        priority: 'medium',
        coverage: {
          lines: fixAnalysis.affectedLines,
          branches: []
        }
      };
      
      testCases.push(testCase);
    }
    
    return testCases;
  }

  /**
   * 生成边界情况测试
   */
  private generateEdgeCaseTests(fixInfo: FixInfo, fixAnalysis: any): TestCase[] {
    const testCases: TestCase[] = [];
    
    if (fixAnalysis.functionInfo) {
      const func = fixAnalysis.functionInfo;
      
      // 生成边界情况测试用例
      const edgeCases = this.generateEdgeCases(func);
      
      for (const edgeCase of edgeCases) {
        const testCase: TestCase = {
          id: `test_case_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: `should ${func.name} handle edge case: ${edgeCase.description}`,
          description: `验证 ${func.name} 函数能正确处理 ${edgeCase.description} 边界情况`,
          testCode: this.generateEdgeCaseTestCode(fixAnalysis, func, edgeCase),
          expectedResult: edgeCase.expectedResult,
          priority: 'medium',
          coverage: {
            lines: fixAnalysis.affectedLines,
            branches: []
          }
        };
        
        testCases.push(testCase);
      }
    }
    
    return testCases;
  }

  /**
   * 生成回归测试
   */
  private generateRegressionTests(fixInfo: FixInfo, fixAnalysis: any): TestCase[] {
    const testCases: TestCase[] = [];
    
    if (fixAnalysis.functionInfo) {
      const func = fixAnalysis.functionInfo;
      
      // 生成回归测试用例
      const testCase: TestCase = {
        id: `test_case_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: `should ${func.name} not regress after fix`,
        description: `验证 ${func.name} 函数在修复后不会出现回归问题`,
        testCode: this.generateRegressionTestCode(fixAnalysis, func),
        expectedResult: this.generateExpectedResult(func),
        priority: 'medium',
        coverage: {
          lines: fixAnalysis.affectedLines,
          branches: []
        }
      };
      
      testCases.push(testCase);
    }
    
    return testCases;
  }

  /**
   * 生成函数测试代码
   */
  private generateFunctionTestCode(fixAnalysis: any, func: any, isNewFeature: boolean = false): string {
    const parameters = func.parameters.map((param: any) => {
      const defaultValue = this.getDefaultValue(param.type);
      return param.isOptional ? `${param.name} = ${defaultValue}` : param.name;
    }).join(', ');

    const importStatement = `import { ${func.name} } from '../${path.relative(this.config.outputDirectory, func.location.filePath.replace(/\.(ts|tsx)$/, ''))}';`;
    
    const testCode = `
${importStatement}

describe('${func.name}', () => {
  it('should ${isNewFeature ? 'implement the new feature' : 'work correctly after fix'}', () => {
    // Arrange
    ${func.parameters.map((param: any) => {
      const defaultValue = this.getDefaultValue(param.type);
      return `const ${param.name} = ${defaultValue};`;
    }).join('\n    ')}
    
    // Act
    const result = ${func.name}(${parameters});
    
    // Assert
    expect(result).toBeDefined();
    // Add more specific assertions here based on the function's expected behavior
  });
});
`;
    
    return testCode;
  }

  /**
   * 生成性能测试代码
   */
  private generatePerformanceTestCode(fixAnalysis: any, func: any): string {
    const parameters = func.parameters.map((param: any) => {
      const defaultValue = this.getDefaultValue(param.type);
      return param.isOptional ? `${param.name} = ${defaultValue}` : param.name;
    }).join(', ');

    const importStatement = `import { ${func.name} } from '../${path.relative(this.config.outputDirectory, func.location.filePath.replace(/\.(ts|tsx)$/, ''))}';`;
    
    const testCode = `
${importStatement}

describe('${func.name} Performance', () => {
  it('should execute within acceptable time limit', () => {
    // Arrange
    ${func.parameters.map((param: any) => {
      const defaultValue = this.getDefaultValue(param.type);
      return `const ${param.name} = ${defaultValue};`;
    }).join('\n    ')}
    
    // Act
    const startTime = performance.now();
    ${func.name}(${parameters});
    const endTime = performance.now();
    const executionTime = endTime - startTime;
    
    // Assert
    expect(executionTime).toBeLessThan(100); // 100ms threshold
  });
});
`;
    
    return testCode;
  }

  /**
   * 生成边界情况测试代码
   */
  private generateEdgeCaseTestCode(fixAnalysis: any, func: any, edgeCase: any): string {
    const parameters = func.parameters.map((param: any, index: number) => {
      const edgeValue = edgeCase.values[index] || this.getDefaultValue(param.type);
      return `${param.name} = ${edgeValue}`;
    }).join(', ');

    const importStatement = `import { ${func.name} } from '../${path.relative(this.config.outputDirectory, func.location.filePath.replace(/\.(ts|tsx)$/, ''))}';`;
    
    const testCode = `
${importStatement}

describe('${func.name} Edge Cases', () => {
  it('should handle ${edgeCase.description}', () => {
    // Arrange
    ${func.parameters.map((param: any, index: number) => {
      const edgeValue = edgeCase.values[index] || this.getDefaultValue(param.type);
      return `const ${param.name} = ${edgeValue};`;
    }).join('\n    ')}
    
    // Act
    const result = ${func.name}(${parameters});
    
    // Assert
    expect(result).toEqual(${JSON.stringify(edgeCase.expectedResult)});
  });
});
`;
    
    return testCode;
  }

  /**
   * 生成回归测试代码
   */
  private generateRegressionTestCode(fixAnalysis: any, func: any): string {
    const parameters = func.parameters.map((param: any) => {
      const defaultValue = this.getDefaultValue(param.type);
      return param.isOptional ? `${param.name} = ${defaultValue}` : param.name;
    }).join(', ');

    const importStatement = `import { ${func.name} } from '../${path.relative(this.config.outputDirectory, func.location.filePath.replace(/\.(ts|tsx)$/, ''))}';`;
    
    const testCode = `
${importStatement}

describe('${func.name} Regression', () => {
  it('should not regress after fix', () => {
    // Arrange
    const testCases = [
      // Add test cases that cover the previous behavior
      { ${func.parameters.map((param: any) => param.name).join(', ')} },
      // Add more test cases here
    ];
    
    // Act & Assert
    testCases.forEach(testCase => {
      const result = ${func.name}(${func.parameters.map((param: any) => `testCase.${param.name} || ${this.getDefaultValue(param.type)}`).join(', ')});
      expect(result).toBeDefined();
      // Add more specific assertions here
    });
  });
});
`;
    
    return testCode;
  }

  /**
   * 生成边界情况
   */
  private generateEdgeCases(func: any): any[] {
    const edgeCases: any[] = [];
    
    // 为每个参数生成边界情况
    func.parameters.forEach((param: any, index: number) => {
      switch (param.type) {
        case 'number':
          edgeCases.push(
            {
              description: `negative number for ${param.name}`,
              values: func.parameters.map((p: any, i: number) => i === index ? -1 : this.getDefaultValue(p.type)),
              expectedResult: this.generateExpectedResult(func)
            },
            {
              description: `zero for ${param.name}`,
              values: func.parameters.map((p: any, i: number) => i === index ? 0 : this.getDefaultValue(p.type)),
              expectedResult: this.generateExpectedResult(func)
            },
            {
              description: `large number for ${param.name}`,
              values: func.parameters.map((p: any, i: number) => i === index ? 1000000 : this.getDefaultValue(p.type)),
              expectedResult: this.generateExpectedResult(func)
            }
          );
          break;
        
        case 'string':
          edgeCases.push(
            {
              description: `empty string for ${param.name}`,
              values: func.parameters.map((p: any, i: number) => i === index ? "''" : this.getDefaultValue(p.type)),
              expectedResult: this.generateExpectedResult(func)
            },
            {
              description: `long string for ${param.name}`,
              values: func.parameters.map((p: any, i: number) => i === index ? '"'.repeat(1000) + '"' : this.getDefaultValue(p.type)),
              expectedResult: this.generateExpectedResult(func)
            }
          );
          break;
        
        case 'boolean':
          edgeCases.push(
            {
              description: `true for ${param.name}`,
              values: func.parameters.map((p: any, i: number) => i === index ? true : this.getDefaultValue(p.type)),
              expectedResult: this.generateExpectedResult(func)
            },
            {
              description: `false for ${param.name}`,
              values: func.parameters.map((p: any, i: number) => i === index ? false : this.getDefaultValue(p.type)),
              expectedResult: this.generateExpectedResult(func)
            }
          );
          break;
        
        case 'object':
          edgeCases.push(
            {
              description: `null for ${param.name}`,
              values: func.parameters.map((p: any, i: number) => i === index ? 'null' : this.getDefaultValue(p.type)),
              expectedResult: this.generateExpectedResult(func)
            },
            {
              description: `empty object for ${param.name}`,
              values: func.parameters.map((p: any, i: number) => i === index ? '{}' : this.getDefaultValue(p.type)),
              expectedResult: this.generateExpectedResult(func)
            }
          );
          break;
        
        case 'array':
          edgeCases.push(
            {
              description: `empty array for ${param.name}`,
              values: func.parameters.map((p: any, i: number) => i === index ? '[]' : this.getDefaultValue(p.type)),
              expectedResult: this.generateExpectedResult(func)
            },
            {
              description: `large array for ${param.name}`,
              values: func.parameters.map((p: any, i: number) => i === index ? '[...Array(1000).keys()]' : this.getDefaultValue(p.type)),
              expectedResult: this.generateExpectedResult(func)
            }
          );
          break;
      }
    });
    
    return edgeCases;
  }

  /**
   * 获取默认值
   */
  private getDefaultValue(type: string): any {
    switch (type) {
      case 'number':
        return 1;
      case 'string':
        return "'test'";
      case 'boolean':
        return true;
      case 'object':
        return '{}';
      case 'array':
        return '[]';
      case 'any':
        return 1;
      default:
        return 1;
    }
  }

  /**
   * 生成预期结果
   */
  private generateExpectedResult(func: any): any {
    switch (func.returnType) {
      case 'number':
        return 0;
      case 'string':
        return "''";
      case 'boolean':
        return true;
      case 'object':
        return '{}';
      case 'array':
        return '[]';
      case 'void':
        return undefined;
      case 'any':
        return undefined;
      default:
        return undefined;
    }
  }

  /**
   * 写入测试文件
   */
  private writeTestFile(testSuite: TestSuite): string {
    // 确保输出目录存在
    const outputDir = path.dirname(testSuite.filePath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // 生成测试文件内容
    const testFileContent = testSuite.testCases.map(testCase => testCase.testCode).join('\n');
    
    // 写入文件
    fs.writeFileSync(testSuite.filePath, testFileContent, 'utf8');
    
    return testSuite.filePath;
  }

  /**
   * 计算预期覆盖率
   */
  private calculateExpectedCoverage(testCases: TestCase[]): number {
    if (testCases.length === 0) return 0;
    
    // 计算所有测试用例覆盖的行总数
    const totalLines = new Set<number>();
    testCases.forEach(testCase => {
      testCase.coverage.lines.forEach(line => totalLines.add(line));
    });
    
    // 简单的覆盖率计算，实际实现需要更复杂的逻辑
    return Math.min(100, totalLines.size * 5); // 假设每行覆盖贡献5%的覆盖率
  }

  /**
   * 获取源文件
   */
  private getSourceFile(filePath: string): ts.SourceFile | undefined {
    try {
      if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return undefined;
      }
      
      const content = fs.readFileSync(filePath, 'utf8');
      return ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.ES2020,
        true
      );
    } catch (error) {
      console.error(`Failed to get source file ${filePath}:`, error);
      return undefined;
    }
  }
}

// 创建单例实例
export const testGenerator = new TestGenerator();

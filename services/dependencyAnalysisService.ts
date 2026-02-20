/**
 * Dependency Analysis Service
 * 深度依赖分析服务，自动检测修复可能影响的其他组件和函数
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

interface Dependency {  
  from: string; // 依赖源（文件或函数）
  to: string;   // 依赖目标（文件或函数）
  type: 'direct' | 'indirect';
  line?: number;
  column?: number;
  confidence: number;
}

interface FunctionDependency {
  functionName: string;
  file: string;
  dependencies: string[];
  dependents: string[];
  line: number;
  column: number;
  complexity: number;
}

interface FileDependency {
  file: string;
  imports: string[];
  exports: string[];
  dependencies: string[];
  dependents: string[];
  functionDependencies: FunctionDependency[];
}

interface DependencyGraph {
  files: Map<string, FileDependency>;
  functions: Map<string, FunctionDependency>;
  dependencies: Dependency[];
  cycles: string[][];
}

interface DependencyAnalysisResult {
  graph: DependencyGraph;
  affectedFiles: Set<string>;
  affectedFunctions: Set<string>;
  criticalPaths: string[][];
  breakingChanges: string[];
}

export class DependencyAnalysisService {
  private readonly tsProgram: ts.Program | null;
  private readonly sourceFiles: string[];

  constructor() {
    this.tsProgram = this.createTSProgram();
    this.sourceFiles = this.getSourceFiles();
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
   * 获取源文件列表
   */
  private getSourceFiles(): string[] {
    const sourceFiles: string[] = [];
    const directories = ['components', 'src', 'services', 'gemini-extension'];

    directories.forEach(dir => {
      const dirPath = path.join(process.cwd(), dir);
      if (fs.existsSync(dirPath)) {
        this.walkDirectory(dirPath, (filePath) => {
          if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
            sourceFiles.push(filePath);
          }
        });
      }
    });

    return sourceFiles;
  }

  /**
   * 遍历目录
   */
  private walkDirectory(dirPath: string, callback: (filePath: string) => void): void {
    const files = fs.readdirSync(dirPath);
    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        this.walkDirectory(filePath, callback);
      } else {
        callback(filePath);
      }
    });
  }

  /**
   * 分析单个文件的依赖关系 - 使用AST分析
   */
  private analyzeFileDependencies(filePath: string): FileDependency {
    console.log(`🔍 Analyzing dependencies for: ${filePath}`);

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const imports: string[] = [];
    const exports: string[] = [];
    const functionDependencies: FunctionDependency[] = [];
    const declaredFunctions = new Set<string>();
    
    // 使用AST进行精确分析
    const sourceFile = ts.createSourceFile(
      filePath,
      fileContent,
      ts.ScriptTarget.Latest,
      true
    );
    
    // 遍历AST节点
    const visitNode = (node: ts.Node) => {
      switch (node.kind) {
        // 处理导入语句
        case ts.SyntaxKind.ImportDeclaration:
          const importNode = node as ts.ImportDeclaration;
          if (importNode.moduleSpecifier && ts.isStringLiteral(importNode.moduleSpecifier)) {
            imports.push(importNode.moduleSpecifier.text);
          }
          break;
          
        // 处理导出语句
        case ts.SyntaxKind.ExportDeclaration:
          const exportNode = node as ts.ExportDeclaration;
          // 处理具名导出
          if (exportNode.exportClause) {
            exportNode.exportClause.elements.forEach(element => {
              exports.push(element.name.getText(sourceFile));
            });
          }
          break;
          
        case ts.SyntaxKind.ExportAssignment:
          // 处理默认导出
          exports.push('default');
          break;
          
        case ts.SyntaxKind.FunctionDeclaration:
          // 处理函数声明
          const funcNode = node as ts.FunctionDeclaration;
          if (funcNode.name) {
            const functionName = funcNode.name.getText(sourceFile);
            const line = sourceFile.getLineAndCharacterOfPosition(funcNode.pos).line + 1;
            const column = sourceFile.getLineAndCharacterOfPosition(funcNode.pos).character + 1;
            
            exports.push(functionName);
            declaredFunctions.add(functionName);
            
            // 分析函数体
            const calledFunctions = this.analyzeFunctionBody(funcNode, sourceFile, declaredFunctions);
            const complexity = this.calculateFunctionComplexity(funcNode);
            
            functionDependencies.push({
              functionName,
              file: filePath,
              dependencies: calledFunctions,
              dependents: [],
              line,
              column,
              complexity
            });
          }
          break;
          
        case ts.SyntaxKind.VariableDeclaration:
          // 处理变量声明
          const varNode = node as ts.VariableDeclaration;
          if (varNode.name && ts.isIdentifier(varNode.name)) {
            const varName = varNode.name.getText(sourceFile);
            // 检查是否是函数表达式
            if (varNode.initializer && (ts.isFunctionExpression(varNode.initializer) || ts.isArrowFunction(varNode.initializer))) {
              const line = sourceFile.getLineAndCharacterOfPosition(varNode.pos).line + 1;
              const column = sourceFile.getLineAndCharacterOfPosition(varNode.pos).character + 1;
              
              exports.push(varName);
              declaredFunctions.add(varName);
              
              // 分析函数体
              const funcBody = varNode.initializer;
              let calledFunctions: string[] = [];
              let complexity = 0;
              
              if (ts.isFunctionExpression(funcBody) || ts.isArrowFunction(funcBody)) {
                calledFunctions = this.analyzeFunctionBody(funcBody, sourceFile, declaredFunctions);
                complexity = this.calculateFunctionComplexity(funcBody);
              }
              
              functionDependencies.push({
                functionName: varName,
                file: filePath,
                dependencies: calledFunctions,
                dependents: [],
                line,
                column,
                complexity
              });
            }
          }
          break;
          
        case ts.SyntaxKind.ClassDeclaration:
          // 处理类声明
          const classNode = node as ts.ClassDeclaration;
          if (classNode.name) {
            const className = classNode.name.getText(sourceFile);
            exports.push(className);
          }
          break;
          
        case ts.SyntaxKind.InterfaceDeclaration:
          // 处理接口声明
          const interfaceNode = node as ts.InterfaceDeclaration;
          if (interfaceNode.name) {
            const interfaceName = interfaceNode.name.getText(sourceFile);
            exports.push(interfaceName);
          }
          break;
      }
      
      // 遍历子节点
      ts.forEachChild(node, visitNode);
    };
    
    // 开始遍历AST
    visitNode(sourceFile);

    return {
      file: filePath,
      imports,
      exports,
      dependencies: [],
      dependents: [],
      functionDependencies
    };
  }
  
  /**
   * 分析函数体，找出调用的函数
   */
  private analyzeFunctionBody(
    func: ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction,
    sourceFile: ts.SourceFile,
    declaredFunctions: Set<string>
  ): string[] {
    const calledFunctions = new Set<string>();
    
    const visitFunctionBody = (node: ts.Node) => {
      // 处理函数调用
      if (node.kind === ts.SyntaxKind.CallExpression) {
        const callNode = node as ts.CallExpression;
        if (ts.isIdentifier(callNode.expression)) {
          const funcName = callNode.expression.getText(sourceFile);
          if (declaredFunctions.has(funcName)) {
            calledFunctions.add(funcName);
          }
        }
      }
      
      // 遍历子节点
      ts.forEachChild(node, visitFunctionBody);
    };
    
    // 分析函数体
    if (func.body) {
      visitFunctionBody(func.body);
    }
    
    return Array.from(calledFunctions);
  }
  
  /**
   * 使用AST计算函数复杂度
   */
  private calculateFunctionComplexity(func: ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction): number {
    let complexity = 1; // 基础复杂度
    
    const visitNode = (node: ts.Node) => {
      switch (node.kind) {
        // 条件语句
        case ts.SyntaxKind.IfStatement:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.DoStatement:
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.CaseClause:
        case ts.SyntaxKind.CatchClause:
          complexity++;
          break;
          
        // 逻辑运算符
        case ts.SyntaxKind.BinaryExpression:
          const binNode = node as ts.BinaryExpression;
          if (binNode.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken || 
              binNode.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
            complexity++;
          }
          break;
          
        // 三元运算符
        case ts.SyntaxKind.ConditionalExpression:
          complexity++;
          break;
      }
      
      // 遍历子节点
      ts.forEachChild(node, visitNode);
    };
    
    // 分析函数体
    if (func.body) {
      visitNode(func.body);
    }
    
    return complexity;
  }

  /**
   * 获取函数内容
   */
  private getFunctionContent(content: string, functionStart: number): string {
    let braceCount = 0;
    let inFunction = false;
    let functionContent = '';

    for (let i = functionStart; i < content.length; i++) {
      const char = content[i];
      functionContent += char;

      if (char === '{') {
        braceCount++;
        inFunction = true;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0 && inFunction) {
          break;
        }
      }
    }

    return functionContent;
  }

  /**
   * 查找函数内部调用的其他函数
   */
  private findCalledFunctions(functionContent: string, availableFunctions: string[]): string[] {
    const calledFunctions: string[] = [];
    availableFunctions.forEach(func => {
      const pattern = new RegExp(`\b${func}\s*\(`, 'g');
      if (pattern.test(functionContent)) {
        calledFunctions.push(func);
      }
    });
    return calledFunctions;
  }

  /**
   * 计算函数复杂度
   */
  private calculateComplexity(functionContent: string): number {
    const ifCount = (functionContent.match(/\bif\s*\(/g) || []).length;
    const forCount = (functionContent.match(/\bfor\s*\(/g) || []).length;
    const whileCount = (functionContent.match(/\bwhile\s*\(/g) || []).length;
    const switchCount = (functionContent.match(/\bswitch\s*\(/g) || []).length;
    const caseCount = (functionContent.match(/\bcase\s+/g) || []).length;
    const andCount = (functionContent.match(/&&/g) || []).length;
    const orCount = (functionContent.match(/\|\|/g) || []).length;

    return ifCount + forCount + whileCount + switchCount + caseCount + andCount + orCount;
  }

  /**
   * 构建完整的依赖图
   */
  async buildDependencyGraph(): Promise<DependencyGraph> {
    console.log('🔄 Building dependency graph...');

    const files = new Map<string, FileDependency>();
    const functions = new Map<string, FunctionDependency>();
    const dependencies: Dependency[] = [];

    // 分析所有源文件
    this.sourceFiles.forEach(file => {
      const fileDep = this.analyzeFileDependencies(file);
      files.set(file, fileDep);

      // 添加函数到函数映射
      fileDep.functionDependencies.forEach(funcDep => {
        const funcKey = `${file}:${funcDep.functionName}`;
        functions.set(funcKey, funcDep);
      });
    });

    // 建立文件间依赖关系
    files.forEach((fileDep, filePath) => {
      fileDep.imports.forEach(importPath => {
        // 解析导入路径对应的实际文件
        const resolvedFile = this.resolveImportPath(filePath, importPath);
        if (resolvedFile && files.has(resolvedFile)) {
          // 添加文件依赖
          fileDep.dependencies.push(resolvedFile);
          files.get(resolvedFile)!.dependents.push(filePath);

          // 添加依赖记录
          dependencies.push({
            from: filePath,
            to: resolvedFile,
            type: 'direct',
            confidence: 0.95
          });
        }
      });
    });

    // 建立函数间依赖关系
    this.buildFunctionDependencies(files, functions, dependencies);

    // 检测依赖循环
    const cycles = this.detectCycles(files);

    return {
      files,
      functions,
      dependencies,
      cycles
    };
  }
  
  /**
   * 建立函数间依赖关系
   */
  private buildFunctionDependencies(
    files: Map<string, FileDependency>,
    functions: Map<string, FunctionDependency>,
    dependencies: Dependency[]
  ): void {
    console.log('🔗 Building function dependencies...');
    
    // 遍历所有文件
    files.forEach((fileDep, filePath) => {
      // 遍历文件中的所有函数
      fileDep.functionDependencies.forEach(funcDep => {
        const funcKey = `${filePath}:${funcDep.functionName}`;
        
        // 遍历函数的依赖
        funcDep.dependencies.forEach(calledFuncName => {
          // 查找被调用函数的实际位置
          let found = false;
          
          // 首先在当前文件中查找
          const currentFileFunctions = fileDep.functionDependencies;
          const calledFunc = currentFileFunctions.find(f => f.functionName === calledFuncName);
          
          if (calledFunc) {
            const calledFuncKey = `${filePath}:${calledFuncName}`;
            // 添加函数依赖
            if (!funcDep.dependencies.includes(calledFuncName)) {
              funcDep.dependencies.push(calledFuncName);
            }
            if (!functions.get(calledFuncKey)?.dependents.includes(funcKey)) {
              functions.get(calledFuncKey)?.dependents.push(funcKey);
            }
            
            // 添加函数间依赖记录
            dependencies.push({
              from: funcKey,
              to: calledFuncKey,
              type: 'direct',
              confidence: 0.98
            });
            found = true;
          }
          
          // 如果当前文件中没有找到，检查导入的文件
          if (!found) {
            fileDep.imports.forEach(importPath => {
              const resolvedFile = this.resolveImportPath(filePath, importPath);
              if (resolvedFile && files.has(resolvedFile)) {
                const importedFileDep = files.get(resolvedFile)!;
                const importedFunc = importedFileDep.functionDependencies.find(f => f.functionName === calledFuncName);
                
                if (importedFunc) {
                  const importedFuncKey = `${resolvedFile}:${calledFuncName}`;
                  // 添加函数依赖
                  if (!funcDep.dependencies.includes(calledFuncName)) {
                    funcDep.dependencies.push(calledFuncName);
                  }
                  if (!functions.get(importedFuncKey)?.dependents.includes(funcKey)) {
                    functions.get(importedFuncKey)?.dependents.push(funcKey);
                  }
                  
                  // 添加函数间依赖记录
                  dependencies.push({
                    from: funcKey,
                    to: importedFuncKey,
                    type: 'direct',
                    confidence: 0.95
                  });
                }
              }
            });
          }
        });
      });
    });
  }
  
  /**
   * 查找关键依赖路径
   */
  private findCriticalPaths(graph: DependencyGraph): string[][] {
    console.log('🔍 Finding critical paths...');
    
    const criticalPaths: string[][] = [];
    const visited = new Set<string>();
    
    // 查找入口文件（没有依赖的文件）
    const entryFiles = [...graph.files.entries()].filter(([_, fileDep]) => 
      fileDep.dependents.length === 0
    ).map(([file]) => file);
    
    // 查找出口文件（被最多文件依赖的文件）
    const exitFiles = [...graph.files.entries()]
      .sort((a, b) => b[1].dependents.length - a[1].dependents.length)
      .slice(0, 5)
      .map(([file]) => file);
    
    // 对于每个入口文件，查找所有到出口文件的路径
    entryFiles.forEach(entry => {
      exitFiles.forEach(exit => {
        const paths = this.findAllPaths(graph, entry, exit);
        criticalPaths.push(...paths);
      });
    });
    
    // 按路径长度排序，返回最长的5条路径
    return criticalPaths
      .sort((a, b) => b.length - a.length)
      .slice(0, 5);
  }
  
  /**
   * 查找两个文件之间的所有路径
   */
  private findAllPaths(graph: DependencyGraph, start: string, end: string): string[][] {
    const paths: string[][] = [];
    const visited = new Set<string>();
    
    const dfs = (current: string, path: string[]) => {
      visited.add(current);
      path.push(current);
      
      if (current === end) {
        paths.push([...path]);
      } else {
        const fileDep = graph.files.get(current);
        if (fileDep) {
          fileDep.dependencies.forEach(dep => {
            if (!visited.has(dep)) {
              dfs(dep, [...path]);
            }
          });
        }
      }
      
      visited.delete(current);
    };
    
    dfs(start, []);
    return paths;
  }

  /**
   * 解析导入路径到实际文件路径
   */
  private resolveImportPath(fromFile: string, importPath: string): string | null {
    // 简单的导入路径解析，实际项目中应该使用更复杂的逻辑
    const fromDir = path.dirname(fromFile);
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];

    // 尝试相对路径
    for (const ext of extensions) {
      const absPath = path.join(fromDir, importPath + ext);
      if (fs.existsSync(absPath)) {
        return absPath;
      }
    }

    return null;
  }

  /**
   * 检测依赖循环
   */
  private detectCycles(files: Map<string, FileDependency>): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Map<string, string[]>();

    const dfs = (file: string, path: string[]): void => {
      visited.add(file);
      recursionStack.set(file, [...path, file]);

      const fileDep = files.get(file);
      if (fileDep) {
        fileDep.dependencies.forEach(dep => {
          if (!visited.has(dep)) {
            dfs(dep, [...path, file]);
          } else if (recursionStack.has(dep)) {
            // 检测到循环
            const cyclePath = [...recursionStack.get(dep)!, file];
            cycles.push(cyclePath);
          }
        });
      }

      recursionStack.delete(file);
    };

    files.forEach((_, file) => {
      if (!visited.has(file)) {
        dfs(file, []);
      }
    });

    return cycles;
  }

  /**
   * 分析修复可能影响的文件和函数
   */
  async analyzeImpact(modifiedFiles: string[], modifiedFunctions: string[]): Promise<DependencyAnalysisResult> {
    console.log('📊 Analyzing impact of changes...');

    const graph = await this.buildDependencyGraph();
    const affectedFiles = new Set<string>();
    const affectedFunctions = new Set<string>();
    const breakingChanges: string[] = [];
    
    // 查找关键依赖路径
    const criticalPaths = this.findCriticalPaths(graph);

    // 分析受影响的文件（直接和间接）
    const calculateAffectedFiles = (file: string, visited: Set<string>) => {
      if (visited.has(file)) return;
      visited.add(file);
      affectedFiles.add(file);
      
      const fileDep = graph.files.get(file);
      if (fileDep) {
        fileDep.dependents.forEach(dependent => {
          calculateAffectedFiles(dependent, visited);
        });
      }
    };
    
    modifiedFiles.forEach(file => {
      calculateAffectedFiles(file, new Set());
    });

    // 分析受影响的函数
    const calculateAffectedFunctions = (funcKey: string, visited: Set<string>) => {
      if (visited.has(funcKey)) return;
      visited.add(funcKey);
      affectedFunctions.add(funcKey);
      
      const funcDep = graph.functions.get(funcKey);
      if (funcDep) {
        funcDep.dependents.forEach(dependent => {
          calculateAffectedFunctions(dependent, visited);
        });
      }
    };
    
    modifiedFunctions.forEach(func => {
      calculateAffectedFunctions(func, new Set());
      
      // 查找包含该函数的文件，并分析该文件的影响
      const file = func.split(':')[0];
      if (file) {
        calculateAffectedFiles(file, new Set());
      }
    });

    // 检测可能的破坏性变更
    breakingChanges.push(...this.detectBreakingChanges(modifiedFiles, graph));
    
    // 检测关键路径上的变更
    criticalPaths.forEach(path => {
      const hasModifiedFile = path.some(file => modifiedFiles.includes(file));
      if (hasModifiedFile) {
        breakingChanges.push(`Critical path affected: ${path.join(' → ')}`);
      }
    });

    return {
      graph,
      affectedFiles,
      affectedFunctions,
      criticalPaths,
      breakingChanges
    };
  }
  
  /**
   * 检测可能的破坏性变更 - 增强版
   */
  private detectBreakingChanges(modifiedFiles: string[], graph: DependencyGraph): string[] {
    const breakingChanges: string[] = [];
    
    const criticalFiles = new Set<string>();
    
    // 找出关键文件（被多个文件依赖或在关键路径上）
    graph.files.forEach((fileDep, file) => {
      if (fileDep.dependents.length > 5) {
        criticalFiles.add(file);
      }
    });
    
    modifiedFiles.forEach(file => {
      const fileDep = graph.files.get(file);
      if (fileDep) {
        // 检查是否有很多依赖文件
        if (fileDep.dependents.length > 10) {
          breakingChanges.push(`File ${file} has many dependents (${fileDep.dependents.length}), changes may cause widespread impact`);
        }

        // 检查是否在循环依赖中
        const isInCycle = graph.cycles.some(cycle => cycle.includes(file));
        if (isInCycle) {
          breakingChanges.push(`File ${file} is in a dependency cycle, changes may cause circular dependency issues`);
        }
        
        // 检查是否是关键文件
        if (criticalFiles.has(file)) {
          breakingChanges.push(`File ${file} is a critical file, changes require careful review`);
        }
        
        // 检查依赖深度
        const depth = this.calculateDependencyDepth(file, graph);
        if (depth > 5) {
          breakingChanges.push(`File ${file} has high dependency depth (${depth}), changes may have cascading effects`);
        }
      }
    });

    return breakingChanges;
  }
  
  /**
   * 计算文件的依赖深度
   */
  private calculateDependencyDepth(file: string, graph: DependencyGraph): number {
    let maxDepth = 0;
    const visited = new Set<string>();
    
    const dfs = (current: string, depth: number) => {
      visited.add(current);
      maxDepth = Math.max(maxDepth, depth);
      
      const fileDep = graph.files.get(current);
      if (fileDep) {
        fileDep.dependencies.forEach(dep => {
          if (!visited.has(dep)) {
            dfs(dep, depth + 1);
          }
        });
      }
    };
    
    dfs(file, 0);
    return maxDepth;
  }

  /**
   * DUPLICATE METHOD - REMOVE THIS BLOCK AFTER VERIFICATION
   * The method 'verifyDependenciesAfterFix' is duplicated.
   * Refer to the definition around line 1051 for the correct implementation.
   */

  /**
   * 生成依赖图报告
   */
  generateDependencyReport(graph: DependencyGraph): string {
    let report = '\n' + '='.repeat(70);
    report += '\n🔍 DEPENDENCY ANALYSIS REPORT';
    report += '\n' + '='.repeat(70) + '\n';

    // 文件依赖统计
    const totalFiles = graph.files.size;
    const totalDependencies = graph.dependencies.length;
    const totalFunctions = graph.functions.size;
    const totalCycles = graph.cycles.length;

    report += `\n📊 Dependency Summary:\n`;
    report += `   Total Files: ${totalFiles}\n`;
    report += `   Total Dependencies: ${totalDependencies}\n`;
    report += `   Total Functions: ${totalFunctions}\n`;
    report += `   Total Cycles: ${totalCycles}\n`;

    // 最大依赖深度
    const maxDependencyDepth = this.calculateMaxDependencyDepth(graph);
    report += `   Max Dependency Depth: ${maxDependencyDepth}\n`;

    // 文件依赖分布
    report += '\n📋 File Dependency Distribution:\n';
    let avgDependencies = 0;
    let avgDependents = 0;
    graph.files.forEach((fileDep, file) => {
      avgDependencies += fileDep.dependencies.length;
      avgDependents += fileDep.dependents.length;
    });
    avgDependencies /= totalFiles;
    avgDependents /= totalFiles;
    report += `   Average Dependencies per File: ${avgDependencies.toFixed(2)}\n`;
    report += `   Average Dependents per File: ${avgDependents.toFixed(2)}\n`;

    // 循环依赖警告
    if (totalCycles > 0) {
      report += '\n⚠️  Circular Dependencies Detected:\n';
      graph.cycles.forEach((cycle, index) => {
        report += `   ${index + 1}. ${cycle.join(' → ')}\n`;
      });
    }

    // 最复杂的函数
    report += '\n💡 Most Complex Functions:\n';
    const sortedFunctions = [...graph.functions.values()]
      .sort((a, b) => b.complexity - a.complexity)
      .slice(0, 5);
    sortedFunctions.forEach((func, index) => {
      report += `   ${index + 1}. ${func.functionName} (${func.file}:${func.line}) - Complexity: ${func.complexity}\n`;
    });

    report += '\n' + '='.repeat(70);
    report += '\n🚀 Recommendations:\n';
    report += '1. Reduce circular dependencies to improve maintainability\n';
    report += '2. Split files with high dependency counts\n';
    report += '3. Simplify complex functions to reduce cognitive load\n';
    report += '4. Use dependency injection to reduce coupling\n';
    report += '5. Add tests for critical dependency paths\n';

    report += '\n' + '='.repeat(70);

    return report;
  }

  /**
   * 计算最大依赖深度
   */
  private calculateMaxDependencyDepth(graph: DependencyGraph): number {
    let maxDepth = 0;
    const visited = new Map<string, number>();

    const dfs = (file: string): number => {
      if (visited.has(file)) {
        return visited.get(file)!;
      }

      let depth = 0;
      const fileDep = graph.files.get(file);
      if (fileDep) {
        fileDep.dependencies.forEach(dep => {
          const depDepth = dfs(dep);
          depth = Math.max(depth, depDepth + 1);
        });
      }

      visited.set(file, depth);
      return depth;
    };

    graph.files.forEach((_, file) => {
      const depth = dfs(file);
      maxDepth = Math.max(maxDepth, depth);
    });

    return maxDepth;
  }

  /**
   * 生成影响分析报告
   */
  generateImpactReport(analysis: DependencyAnalysisResult): string {
    let report = '\n' + '='.repeat(70);
    report += '\n📊 IMPACT ANALYSIS REPORT';
    report += '\n' + '='.repeat(70) + '\n';

    report += `\n📋 Impact Summary:\n`;
    report += `   Affected Files: ${analysis.affectedFiles.size}\n`;
    report += `   Affected Functions: ${analysis.affectedFunctions.size}\n`;
    report += `   Critical Paths: ${analysis.criticalPaths.length}\n`;
    report += `   Breaking Changes: ${analysis.breakingChanges.length}\n`;

    if (analysis.breakingChanges.length > 0) {
      report += '\n⚠️  Breaking Changes Detected:\n';
      analysis.breakingChanges.forEach((change, index) => {
        report += `   ${index + 1}. ${change}\n`;
      });
    }

    if (analysis.criticalPaths.length > 0) {
      report += '\n🔗 Critical Dependencies:\n';
      analysis.criticalPaths.slice(0, 10).forEach((path, index) => {
        report += `   ${index + 1}. ${path.join(' → ')}\n`;
      });
    }

    if (analysis.affectedFiles.size > 0) {
      report += '\n📁 Affected Files:\n';
      [...analysis.affectedFiles].slice(0, 10).forEach((file, index) => {
        report += `   ${index + 1}. ${file}\n`;
      });
      if (analysis.affectedFiles.size > 10) {
        report += `   ... and ${analysis.affectedFiles.size - 10} more\n`;
      }
    }

    report += '\n' + '='.repeat(70);
    report += '\n🚀 Recommendations:\n';
    report += '1. Review all affected files for potential issues\n';
    report += '2. Add regression tests for critical paths\n';
    report += '3. Consider refactoring to reduce coupling\n';
    report += '4. Validate changes with integration tests\n';
    report += '5. Monitor production closely after deployment\n';

    report += '\n' + '='.repeat(70);

    return report;
  }

  /**
   * 验证修复后的依赖关系
   */
  async verifyDependenciesAfterFix(preFixGraph: DependencyGraph, postFixGraph: DependencyGraph): Promise<{ success: boolean; issues: string[] }> {
    console.log('✅ Verifying dependencies after fix...');

    const issues: string[] = [];

    // 检查是否有新的循环依赖
    if (postFixGraph.cycles.length > preFixGraph.cycles.length) {
      const newCycles = postFixGraph.cycles.filter(cycle => 
        !preFixGraph.cycles.some(preCycle => 
          cycle.length === preCycle.length && 
          cycle.every((file, index) => file === preCycle[index])
        )
      );
      newCycles.forEach(cycle => {
        issues.push(`New circular dependency introduced: ${cycle.join(' → ')}`);
      });
    }

    // 检查是否有文件丢失了依赖
    preFixGraph.dependencies.forEach(preDep => {
      const stillExists = postFixGraph.dependencies.some(postDep => 
        postDep.from === preDep.from && postDep.to === preDep.to
      );
      if (!stillExists) {
        issues.push(`Dependency removed: ${preDep.from} → ${preDep.to}`);
      }
    });

    // 检查关键文件的依赖变化
    const criticalFiles = [...preFixGraph.files.values()]
      .filter(fileDep => fileDep.dependents.length > 5)
      .map(fileDep => fileDep.file);

    criticalFiles.forEach(file => {
      const preDeps = preFixGraph.files.get(file)?.dependencies || [];
      const postDeps = postFixGraph.files.get(file)?.dependencies || [];
      
      const addedDeps = postDeps.filter(dep => !preDeps.includes(dep));
      const removedDeps = preDeps.filter(dep => !postDeps.includes(dep));
      
      if (addedDeps.length > 0) {
        issues.push(`Critical file ${file} gained new dependencies: ${addedDeps.join(', ')}`);
      }
      if (removedDeps.length > 0) {
        issues.push(`Critical file ${file} lost dependencies: ${removedDeps.join(', ')}`);
      }
    });

    return {
      success: issues.length === 0,
      issues
    };
  }

  /**
   * 集成到代码审查流程
   */
  async integrateWithCodeReview(modifiedFiles: string[], modifiedFunctions: string[]): Promise<DependencyAnalysisResult> {
    return this.analyzeImpact(modifiedFiles, modifiedFunctions);
  }
}

// 导出单例实例
export const dependencyAnalysisService = new DependencyAnalysisService();
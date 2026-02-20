import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

// 定义动态分析相关接口
export interface ExecutionPath {
  id: string;
  nodes: ExecutionNode[];
  edges: ExecutionEdge[];
  entryPoint: string;
  exitPoints: string[];
  hasLoop: boolean;
  loopCount: number;
}

export interface ExecutionNode {
  id: string;
  type: 'function' | 'condition' | 'loop' | 'statement' | 'return' | 'throw';
  location: CodeLocation;
  code: string;
  variables?: VariableState[];
  condition?: string;
  isTrueBranch?: boolean;
}

export interface ExecutionEdge {
  from: string;
  to: string;
  type: 'call' | 'return' | 'throw' | 'branch' | 'loop';
  condition?: boolean;
  loopIteration?: number;
}

export interface VariableState {
  name: string;
  type: string;
  value?: any;
  isDefined: boolean;
  isModified: boolean;
  location: CodeLocation;
}

export interface CodeLocation {
  filePath: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

export interface DynamicAnalysisResult {
  executionPaths: ExecutionPath[];
  potentialIssues: PotentialIssue[];
  coverage: {
    lines: number;
    branches: number;
    functions: number;
  };
}

export interface PotentialIssue {
  id: string;
  type: 'null-pointer' | 'undefined-value' | 'type-mismatch' | 'infinite-loop' | 'unhandled-exception';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location: CodeLocation;
  pathId: string;
}

export interface DynamicAnalyzerConfig {
  maxExecutionDepth: number;
  maxLoopIterations: number;
  timeout: number;
  enableVariableTracking: boolean;
  enableLoopDetection: boolean;
  enableExceptionAnalysis: boolean;
}

/**
 * 动态行为模拟服务
 * 能够模拟修复后的代码执行路径，预测可能的运行时行为
 */
export class DynamicAnalyzer {
  private readonly config: DynamicAnalyzerConfig;
  private readonly tsProgram: ts.Program | null;

  constructor() {
    this.config = {
      maxExecutionDepth: 10,
      maxLoopIterations: 5,
      timeout: 5000,
      enableVariableTracking: true,
      enableLoopDetection: true,
      enableExceptionAnalysis: true
    };

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
   * 分析文件的动态行为
   */
  async analyzeFile(filePath: string): Promise<DynamicAnalysisResult> {
    try {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
      
      if (!fs.existsSync(absolutePath)) {
        console.error(`File not found: ${absolutePath}`);
        return this.createEmptyResult();
      }

      const sourceFile = this.getSourceFile(absolutePath);
      if (!sourceFile) {
        console.error(`Failed to get source file: ${absolutePath}`);
        return this.createEmptyResult();
      }

      // 分析文件中的函数
      const functions = this.extractFunctions(sourceFile);
      const executionPaths: ExecutionPath[] = [];
      const potentialIssues: PotentialIssue[] = [];

      // 对每个函数进行执行路径分析
      for (const func of functions) {
        const paths = this.analyzeFunctionExecution(func, sourceFile);
        executionPaths.push(...paths);
      }

      // 检测潜在问题
      for (const path of executionPaths) {
        const issues = this.detectPotentialIssues(path);
        potentialIssues.push(...issues);
      }

      // 计算覆盖率
      const coverage = this.calculateCoverage(sourceFile, executionPaths);

      return {
        executionPaths,
        potentialIssues,
        coverage
      };
    } catch (error) {
      console.error(`Error analyzing file ${filePath}:`, error);
      return this.createEmptyResult();
    }
  }

  /**
   * 提取文件中的所有函数
   */
  private extractFunctions(sourceFile: ts.SourceFile): ts.FunctionDeclaration[] {
    const functions: ts.FunctionDeclaration[] = [];

    const visitor = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name) {
        functions.push(node);
      }
      ts.forEachChild(node, visitor);
    };

    visitor(sourceFile);
    return functions;
  }

  /**
   * 分析函数的执行路径
   */
  private analyzeFunctionExecution(func: ts.FunctionDeclaration, sourceFile: ts.SourceFile): ExecutionPath[] {
    const paths: ExecutionPath[] = [];
    const entryPoint = `${sourceFile.fileName}:${func.name?.getText() || 'anonymous'}`;

    // 创建初始执行路径
    const initialPath: ExecutionPath = {
      id: `path_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      nodes: [],
      edges: [],
      entryPoint,
      exitPoints: [],
      hasLoop: false,
      loopCount: 0
    };

    // 分析函数体
    if (func.body) {
      this.analyzeStatement(func.body, sourceFile, initialPath, 0);
      paths.push(initialPath);
    }

    return paths;
  }

  /**
   * 分析语句的执行
   */
  private analyzeStatement(
    statement: ts.Statement,
    sourceFile: ts.SourceFile,
    path: ExecutionPath,
    depth: number
  ): void {
    // 检查执行深度限制
    if (depth > this.config.maxExecutionDepth) {
      return;
    }

    const location = this.getLocation(sourceFile, statement);
    const code = statement.getText();

    switch (statement.kind) {
      case ts.SyntaxKind.IfStatement:
        this.analyzeIfStatement(statement as ts.IfStatement, sourceFile, path, depth);
        break;
      
      case ts.SyntaxKind.ForStatement:
      case ts.SyntaxKind.ForInStatement:
      case ts.SyntaxKind.ForOfStatement:
        this.analyzeForLoop(statement as ts.ForStatement | ts.ForInStatement | ts.ForOfStatement, sourceFile, path, depth);
        break;
      
      case ts.SyntaxKind.WhileStatement:
        this.analyzeWhileLoop(statement as ts.WhileStatement, sourceFile, path, depth);
        break;
      
      case ts.SyntaxKind.DoStatement:
        this.analyzeDoLoop(statement as ts.DoStatement, sourceFile, path, depth);
        break;
      
      case ts.SyntaxKind.ReturnStatement:
        this.analyzeReturnStatement(statement as ts.ReturnStatement, sourceFile, path, depth);
        break;
      
      case ts.SyntaxKind.ThrowStatement:
        this.analyzeThrowStatement(statement as ts.ThrowStatement, sourceFile, path, depth);
        break;
      
      case ts.SyntaxKind.TryStatement:
        this.analyzeTryStatement(statement as ts.TryStatement, sourceFile, path, depth);
        break;
      
      case ts.SyntaxKind.Block:
        this.analyzeBlock(statement as ts.Block, sourceFile, path, depth);
        break;
      
      default:
        // 处理普通语句
        this.addExecutionNode(path, {
          id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'statement',
          location,
          code
        });
    }
  }

  /**
   * 分析If语句
   */
  private analyzeIfStatement(
    ifStmt: ts.IfStatement,
    sourceFile: ts.SourceFile,
    path: ExecutionPath,
    depth: number
  ): void {
    const condition = ifStmt.expression.getText();
    const location = this.getLocation(sourceFile, ifStmt);

    // 添加条件节点
    const conditionNode: ExecutionNode = {
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'condition',
      location,
      code: ifStmt.getText(),
      condition
    };
    this.addExecutionNode(path, conditionNode);

    // 分析真分支
    this.analyzeStatement(ifStmt.thenStatement, sourceFile, path, depth + 1);

    // 分析假分支（如果存在）
    if (ifStmt.elseStatement) {
      this.analyzeStatement(ifStmt.elseStatement, sourceFile, path, depth + 1);
    }
  }

  /**
   * 分析For循环
   */
  private analyzeForLoop(
    loopStmt: ts.ForStatement | ts.ForInStatement | ts.ForOfStatement,
    sourceFile: ts.SourceFile,
    path: ExecutionPath,
    depth: number
  ): void {
    const location = this.getLocation(sourceFile, loopStmt);
    const code = loopStmt.getText();

    // 添加循环节点
    const loopNode: ExecutionNode = {
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'loop',
      location,
      code
    };
    this.addExecutionNode(path, loopNode);

    // 标记路径包含循环
    path.hasLoop = true;
    path.loopCount++;

    // 分析循环体（限制迭代次数）
    let body: ts.Statement | undefined;
    if (ts.isForStatement(loopStmt)) {
      body = loopStmt.statement;
    } else if (ts.isForInStatement(loopStmt) || ts.isForOfStatement(loopStmt)) {
      body = loopStmt.statement;
    }

    if (body) {
      // 限制循环迭代次数
      for (let i = 0; i < this.config.maxLoopIterations; i++) {
        this.analyzeStatement(body, sourceFile, path, depth + 1);
      }
    }
  }

  /**
   * 分析While循环
   */
  private analyzeWhileLoop(
    whileStmt: ts.WhileStatement,
    sourceFile: ts.SourceFile,
    path: ExecutionPath,
    depth: number
  ): void {
    const location = this.getLocation(sourceFile, whileStmt);
    const code = whileStmt.getText();

    // 添加循环节点
    const loopNode: ExecutionNode = {
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'loop',
      location,
      code
    };
    this.addExecutionNode(path, loopNode);

    // 标记路径包含循环
    path.hasLoop = true;
    path.loopCount++;

    // 分析循环体（限制迭代次数）
    for (let i = 0; i < this.config.maxLoopIterations; i++) {
      this.analyzeStatement(whileStmt.statement, sourceFile, path, depth + 1);
    }
  }

  /**
   * 分析Do-While循环
   */
  private analyzeDoLoop(
    doStmt: ts.DoStatement,
    sourceFile: ts.SourceFile,
    path: ExecutionPath,
    depth: number
  ): void {
    const location = this.getLocation(sourceFile, doStmt);
    const code = doStmt.getText();

    // 添加循环节点
    const loopNode: ExecutionNode = {
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'loop',
      location,
      code
    };
    this.addExecutionNode(path, loopNode);

    // 标记路径包含循环
    path.hasLoop = true;
    path.loopCount++;

    // 分析循环体（限制迭代次数）
    for (let i = 0; i < this.config.maxLoopIterations; i++) {
      this.analyzeStatement(doStmt.statement, sourceFile, path, depth + 1);
    }
  }

  /**
   * 分析Return语句
   */
  private analyzeReturnStatement(
    returnStmt: ts.ReturnStatement,
    sourceFile: ts.SourceFile,
    path: ExecutionPath,
    depth: number
  ): void {
    const location = this.getLocation(sourceFile, returnStmt);
    const code = returnStmt.getText();

    // 添加返回节点
    const returnNode: ExecutionNode = {
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'return',
      location,
      code
    };
    this.addExecutionNode(path, returnNode);

    // 添加到退出点
    path.exitPoints.push(returnNode.id);
  }

  /**
   * 分析Throw语句
   */
  private analyzeThrowStatement(
    throwStmt: ts.ThrowStatement,
    sourceFile: ts.SourceFile,
    path: ExecutionPath,
    depth: number
  ): void {
    const location = this.getLocation(sourceFile, throwStmt);
    const code = throwStmt.getText();

    // 添加抛出异常节点
    const throwNode: ExecutionNode = {
      id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'throw',
      location,
      code
    };
    this.addExecutionNode(path, throwNode);

    // 添加到退出点
    path.exitPoints.push(throwNode.id);
  }

  /**
   * 分析Try-Catch语句
   */
  private analyzeTryStatement(
    tryStmt: ts.TryStatement,
    sourceFile: ts.SourceFile,
    path: ExecutionPath,
    depth: number
  ): void {
    // 分析try块
    this.analyzeStatement(tryStmt.tryBlock, sourceFile, path, depth + 1);

    // 分析catch块（如果存在）
    if (tryStmt.catchClause) {
      this.analyzeStatement(tryStmt.catchClause.block, sourceFile, path, depth + 1);
    }

    // 分析finally块（如果存在）
    if (tryStmt.finallyBlock) {
      this.analyzeStatement(tryStmt.finallyBlock, sourceFile, path, depth + 1);
    }
  }

  /**
   * 分析代码块
   */
  private analyzeBlock(
    block: ts.Block,
    sourceFile: ts.SourceFile,
    path: ExecutionPath,
    depth: number
  ): void {
    // 分析块中的每个语句
    for (const statement of block.statements) {
      this.analyzeStatement(statement, sourceFile, path, depth);
    }
  }

  /**
   * 添加执行节点到路径
   */
  private addExecutionNode(path: ExecutionPath, node: ExecutionNode): void {
    path.nodes.push(node);

    // 添加边（如果不是第一个节点）
    if (path.nodes.length > 1) {
      const previousNode = path.nodes[path.nodes.length - 2];
      path.edges.push({
        from: previousNode.id,
        to: node.id,
        type: 'branch' // 默认分支类型，可根据实际情况调整
      });
    }
  }

  /**
   * 检测潜在问题
   */
  private detectPotentialIssues(path: ExecutionPath): PotentialIssue[] {
    const issues: PotentialIssue[] = [];

    // 检测空指针和未定义值
    issues.push(...this.detectNullPointerIssues(path));

    // 检测无限循环
    if (this.config.enableLoopDetection) {
      issues.push(...this.detectInfiniteLoopIssues(path));
    }

    // 检测未处理的异常
    if (this.config.enableExceptionAnalysis) {
      issues.push(...this.detectUnhandledExceptionIssues(path));
    }

    return issues;
  }

  /**
   * 检测空指针和未定义值问题
   */
  private detectNullPointerIssues(path: ExecutionPath): PotentialIssue[] {
    const issues: PotentialIssue[] = [];

    // 简单的空指针检测：检查可能的空值访问模式
    for (const node of path.nodes) {
      const code = node.code.toLowerCase();
      
      // 检测常见的空指针访问模式
      if (code.includes('null.') || code.includes('undefined.') || 
          code.includes('.') && (code.includes('if (!') || code.includes('if (!!'))) {
        issues.push({
          id: `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'null-pointer',
          severity: 'medium',
          description: '可能存在空指针或未定义值访问',
          location: node.location,
          pathId: path.id
        });
      }
    }

    return issues;
  }

  /**
   * 检测无限循环问题
   */
  private detectInfiniteLoopIssues(path: ExecutionPath): PotentialIssue[] {
    const issues: PotentialIssue[] = [];

    // 检测循环次数过多的情况
    if (path.loopCount > this.config.maxLoopIterations * 2) {
      issues.push({
        id: `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'infinite-loop',
        severity: 'high',
        description: '可能存在无限循环',
        location: path.nodes[0].location,
        pathId: path.id
      });
    }

    return issues;
  }

  /**
   * 检测未处理的异常问题
   */
  private detectUnhandledExceptionIssues(path: ExecutionPath): PotentialIssue[] {
    const issues: PotentialIssue[] = [];

    // 检测throw语句是否被try-catch包裹
    for (let i = 0; i < path.nodes.length; i++) {
      const node = path.nodes[i];
      
      if (node.type === 'throw') {
        // 检查是否在try块内
        let inTryBlock = false;
        for (let j = i - 1; j >= 0; j--) {
          const prevNode = path.nodes[j];
          // 简单的try块检测，实际实现需要更复杂的逻辑
          if (prevNode.code.includes('try {')) {
            inTryBlock = true;
            break;
          }
          if (prevNode.code.includes('} catch (')) {
            break;
          }
        }
        
        if (!inTryBlock) {
          issues.push({
            id: `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'unhandled-exception',
            severity: 'medium',
            description: '可能存在未处理的异常',
            location: node.location,
            pathId: path.id
          });
        }
      }
    }

    return issues;
  }

  /**
   * 计算代码覆盖率
   */
  private calculateCoverage(sourceFile: ts.SourceFile, paths: ExecutionPath[]): {
    lines: number;
    branches: number;
    functions: number;
  } {
    // 简单的覆盖率计算：统计执行路径覆盖的节点比例
    const totalNodes = paths.reduce((sum, path) => sum + path.nodes.length, 0);
    const coveredNodes = new Set<string>();
    
    // 统计唯一覆盖的节点
    for (const path of paths) {
      for (const node of path.nodes) {
        coveredNodes.add(node.id);
      }
    }

    // 简单的覆盖率计算，实际实现需要更复杂的逻辑
    const coverage = {
      lines: totalNodes > 0 ? Math.round((coveredNodes.size / totalNodes) * 100) : 0,
      branches: 0, // 暂未实现分支覆盖率
      functions: 0  // 暂未实现函数覆盖率
    };

    return coverage;
  }

  /**
   * 获取代码位置信息
   */
  private getLocation(sourceFile: ts.SourceFile, node: ts.Node): CodeLocation {
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

    return {
      filePath: sourceFile.fileName,
      line: start.line + 1,
      column: start.character + 1,
      endLine: end.line + 1,
      endColumn: end.character + 1
    };
  }

  /**
   * 获取源文件
   */
  private getSourceFile(filePath: string): ts.SourceFile | undefined {
    try {
      if (this.tsProgram) {
        return this.tsProgram.getSourceFile(filePath);
      }
      
      // 如果没有tsProgram，直接创建源文件
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

  /**
   * 创建空的分析结果
   */
  private createEmptyResult(): DynamicAnalysisResult {
    return {
      executionPaths: [],
      potentialIssues: [],
      coverage: {
        lines: 0,
        branches: 0,
        functions: 0
      }
    };
  }
}

// 创建单例实例
export const dynamicAnalyzer = new DynamicAnalyzer();

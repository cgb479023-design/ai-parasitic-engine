import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

// 定义依赖图接口
export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

export interface DependencyNode {
  id: string; // 文件路径或函数名
  type: 'file' | 'function' | 'component' | 'class' | 'interface' | 'variable';
  name: string;
  filePath: string;
  line?: number;
  column?: number;
  dependencies: string[];
  dependents: string[];
  sourceCode?: string;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'import' | 'call' | 'reference' | 'inheritance' | 'implementation';
  line?: number;
  column?: number;
}

export interface ImpactAnalysisResult {
  affectedNodes: string[];
  criticalPaths: string[][];
  impactScore: number;
  warnings: string[];
}

export interface DependencyVerificationResult {
  success: boolean;
  issues: string[];
  brokenDependencies: string[];
  circularDependencies: string[][];
}

export interface DependencyConfig {
  includeDirs: string[];
  excludeDirs: string[];
  includeExtensions: string[];
  excludePatterns: string[];
}

/**
 * 深度依赖分析服务
 * 用于自动检测修复可能影响的其他组件和函数，生成依赖图，并在修复后验证依赖关系未被破坏
 */
export class DependencyAnalysisService {
  private readonly config: DependencyConfig;
  private readonly tsProgram: ts.Program | null;
  private readonly cache: Map<string, DependencyGraph> = new Map();

  constructor() {
    this.config = {
      includeDirs: ['components', 'src', 'services', 'gemini-extension'],
      excludeDirs: ['node_modules', '.git', 'dist', 'backup', '.vscode', '.idea'],
      includeExtensions: ['.ts', '.tsx', '.js', '.jsx'],
      excludePatterns: ['*.test.ts', '*.spec.ts', '*.test.js', '*.spec.js']
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
   * 分析单个文件的依赖关系
   */
  async analyzeFile(filePath: string): Promise<DependencyGraph> {
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath)!;
    }

    try {
      const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);

      if (!fs.existsSync(absolutePath)) {
        console.error(`File not found: ${absolutePath}`);
        return { nodes: [], edges: [] };
      }

      const sourceFile = this.getSourceFile(absolutePath);
      if (!sourceFile) {
        console.error(`Failed to get source file: ${absolutePath}`);
        return { nodes: [], edges: [] };
      }

      const graph: DependencyGraph = { nodes: [], edges: [] };
      const declaredFunctions = new Set<string>();
      const declaredClasses = new Set<string>();

      // 分析导入语句
      this.analyzeImports(sourceFile, graph);

      // 分析函数声明和调用
      this.analyzeFunctions(sourceFile, graph, declaredFunctions, declaredClasses);

      // 分析类声明和继承关系
      this.analyzeClasses(sourceFile, graph, declaredClasses, declaredFunctions);

      this.cache.set(filePath, graph);
      return graph;
    } catch (error) {
      console.error(`Error analyzing file ${filePath}:`, error);
      return { nodes: [], edges: [] };
    }
  }

  /**
   * 分析目录中的所有文件
   */
  async analyzeDirectory(directoryPath: string): Promise<DependencyGraph> {
    const graph: DependencyGraph = { nodes: [], edges: [] };
    const processedFiles = new Set<string>();

    // 递归分析目录中的所有文件
    const processFile = async (filePath: string) => {
      if (processedFiles.has(filePath)) return;

      const fileExt = path.extname(filePath);
      if (!this.config.includeExtensions.includes(fileExt)) return;

      processedFiles.add(filePath);
      const fileGraph = await this.analyzeFile(filePath);

      // 合并节点
      for (const node of fileGraph.nodes) {
        if (!graph.nodes.some(n => n.id === node.id)) {
          graph.nodes.push(node);
        }
      }

      // 合并边
      for (const edge of fileGraph.edges) {
        if (!graph.edges.some(e => e.from === edge.from && e.to === edge.to && e.type === edge.type)) {
          graph.edges.push(edge);
        }
      }
    };

    // 遍历目录
    const traverseDirectory = async (dir: string) => {
      const files = fs.readdirSync(dir);

      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
          // 检查是否需要排除该目录
          const dirName = path.basename(fullPath);
          if (!this.config.excludeDirs.includes(dirName)) {
            await traverseDirectory(fullPath);
          }
        } else {
          await processFile(fullPath);
        }
      }
    };

    await traverseDirectory(directoryPath);
    return graph;
  }

  /**
   * 分析导入语句
   */
  private analyzeImports(sourceFile: ts.SourceFile, graph: DependencyGraph): void {
    ts.forEachChild(sourceFile, (node) => {
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier;
        if (!moduleSpecifier) {
          console.warn(`Skipping import with undefined module specifier in ${sourceFile.fileName}`);
          return;
        }
        if (!ts.isStringLiteral(moduleSpecifier)) {
          console.warn(`Skipping import with non-string literal module specifier: ${moduleSpecifier.getText()} in ${sourceFile.fileName}`);
          return;
        }
        let importPath: string;
        try {
          importPath = moduleSpecifier.getText().slice(1, -1); // 去除引号
        } catch (e) {
          console.warn(`Error getting text for module specifier in ${sourceFile.fileName}: ${e}`);
          return;
        }
        const fromNode: DependencyNode = {
          id: sourceFile.fileName,
          type: 'file',
          name: sourceFile.fileName.split('/').pop() || '',
          filePath: sourceFile.fileName,
          dependencies: [],
          dependents: []
        };

        // 添加节点
        if (!graph.nodes.some(n => n.id === fromNode.id)) {
          graph.nodes.push(fromNode);
        }

        // 添加导入依赖
        const toNode: DependencyNode = {
          id: importPath,
          type: 'file',
          name: importPath.split('/').pop() || '',
          filePath: importPath,
          dependencies: [],
          dependents: []
        };

        if (!graph.nodes.some(n => n.id === toNode.id)) {
          graph.nodes.push(toNode);
        }

        graph.edges.push({
          from: fromNode.id,
          to: toNode.id,
          type: 'import',
          line: sourceFile.getLineAndCharacterOfPosition(node.pos).line + 1,
          column: sourceFile.getLineAndCharacterOfPosition(node.pos).character + 1
        });

        // 更新依赖关系
        const fromGraphNode = graph.nodes.find(n => n.id === fromNode.id);
        if (fromGraphNode && !fromGraphNode.dependencies.includes(toNode.id)) {
          fromGraphNode.dependencies.push(toNode.id);
        }

        const toGraphNode = graph.nodes.find(n => n.id === toNode.id);
        if (toGraphNode && !toGraphNode.dependents.includes(fromNode.id)) {
          toGraphNode.dependents.push(fromNode.id);
        }
      }
    });
  }

  /**
   * 分析函数声明和调用
   */
  private analyzeFunctions(
    sourceFile: ts.SourceFile,
    graph: DependencyGraph,
    declaredFunctions: Set<string>,
    declaredClasses: Set<string>
  ): void {
    // 收集所有函数声明
    ts.forEachChild(sourceFile, (node) => {
      if (ts.isFunctionDeclaration(node) && node.name) {
        const funcName = node.name.getText();
        declaredFunctions.add(funcName);

        const funcNode: DependencyNode = {
          id: `${sourceFile.fileName}:${funcName}`,
          type: 'function',
          name: funcName,
          filePath: sourceFile.fileName,
          line: sourceFile.getLineAndCharacterOfPosition(node.pos).line + 1,
          column: sourceFile.getLineAndCharacterOfPosition(node.pos).character + 1,
          dependencies: [],
          dependents: [],
          sourceCode: node.getText()
        };

        if (!graph.nodes.some(n => n.id === funcNode.id)) {
          graph.nodes.push(funcNode);
        }
      }
    });

    // 分析函数调用
    const visitor = (node: ts.Node) => {
      if (ts.isCallExpression(node) && node.expression) { // Added null check for node.expression
        if (ts.isIdentifier(node.expression)) {
          let calledFuncName: string;
          try {
            calledFuncName = node.expression.getText();
          } catch (e) {
            console.warn(`Error getting text for called function expression in ${sourceFile.fileName}: ${e}`);
            return;
          }
          if (declaredFunctions.has(calledFuncName)) {
            // 查找调用所在的函数
            const callingFunc = this.findParentFunction(node, sourceFile);
            if (callingFunc && callingFunc.name) {
              const fromId = `${sourceFile.fileName}:${callingFunc.name.getText()}`;
              const toId = `${sourceFile.fileName}:${calledFuncName}`;

              graph.edges.push({
                from: fromId,
                to: toId,
                type: 'call',
                line: sourceFile.getLineAndCharacterOfPosition(node.pos).line + 1,
                column: sourceFile.getLineAndCharacterOfPosition(node.pos).character + 1
              });

              // 更新依赖关系
              const fromGraphNode = graph.nodes.find(n => n.id === fromId);
              if (fromGraphNode && !fromGraphNode.dependencies.includes(toId)) {
                fromGraphNode.dependencies.push(toId);
              }

              const toGraphNode = graph.nodes.find(n => n.id === toId);
              if (toGraphNode && !toGraphNode.dependents.includes(fromId)) {
                toGraphNode.dependents.push(fromId);
              }
            }
          }
        }
      }
      ts.forEachChild(node, visitor);
    };

    ts.forEachChild(sourceFile, visitor);
  }

  /**
   * 分析类声明和继承关系
   */
  private analyzeClasses(
    sourceFile: ts.SourceFile,
    graph: DependencyGraph,
    declaredClasses: Set<string>,
    declaredFunctions: Set<string>
  ): void {
    // 收集所有类声明
    ts.forEachChild(sourceFile, (node) => {
      if (ts.isClassDeclaration(node) && node.name) {
        const className = node.name.getText();
        declaredClasses.add(className);

        const classNode: DependencyNode = {
          id: `${sourceFile.fileName}:${className}`,
          type: 'class',
          name: className,
          filePath: sourceFile.fileName,
          line: sourceFile.getLineAndCharacterOfPosition(node.pos).line + 1,
          column: sourceFile.getLineAndCharacterOfPosition(node.pos).character + 1,
          dependencies: [],
          dependents: [],
          sourceCode: node.getText()
        };

        if (!graph.nodes.some(n => n.id === classNode.id)) {
          graph.nodes.push(classNode);
        }

        // 分析继承关系
        if (node.heritageClauses) {
          for (const clause of node.heritageClauses) {
            if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
              for (const type of clause.types) {
                if (ts.isIdentifier(type.expression)) {
                  const baseClassName = type.expression.getText();
                  const baseClassId = `${sourceFile.fileName}:${baseClassName}`;

                  graph.edges.push({
                    from: classNode.id,
                    to: baseClassId,
                    type: 'inheritance',
                    line: sourceFile.getLineAndCharacterOfPosition(clause.pos).line + 1,
                    column: sourceFile.getLineAndCharacterOfPosition(clause.pos).character + 1
                  });

                  // 更新依赖关系
                  if (!classNode.dependencies.includes(baseClassId)) {
                    classNode.dependencies.push(baseClassId);
                  }

                  const baseClassNode = graph.nodes.find(n => n.id === baseClassId);
                  if (baseClassNode && !baseClassNode.dependents.includes(classNode.id)) {
                    baseClassNode.dependents.push(classNode.id);
                  }
                }
              }
            }
          }
        }
      }
    });
  }

  /**
   * 查找父函数
   */
  private findParentFunction(
    node: ts.Node,
    sourceFile: ts.SourceFile
  ): ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction | undefined {
    let current = node.parent;
    while (current) {
      if (ts.isFunctionDeclaration(current) ||
        ts.isFunctionExpression(current) ||
        ts.isArrowFunction(current)) {
        return current;
      }
      current = current.parent;
    }
    return undefined;
  }

  /**
   * 分析函数体中的函数调用
   */
  private analyzeFunctionBody(
    func: ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction,
    sourceFile: ts.SourceFile,
    declaredFunctions: Set<string>
  ): string[] {
    const calledFunctions: string[] = [];

    const visitor = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const calledFuncName = node.expression.getText();
        if (declaredFunctions.has(calledFuncName)) {
          calledFunctions.push(calledFuncName);
        }
      }
      ts.forEachChild(node, visitor);
    };

    visitor(func.body!);
    // 使用Array.from替代展开运算符，兼容旧版TypeScript编译目标
    return Array.from(new Set(calledFunctions)); // 去重
  }

  /**
   * 构建完整的依赖图
   */
  async buildDependencyGraph(filePaths: string[]): Promise<DependencyGraph> {
    const graph: DependencyGraph = { nodes: [], edges: [] };

    for (const filePath of filePaths) {
      const fileGraph = await this.analyzeFile(filePath);

      // 合并节点
      for (const node of fileGraph.nodes) {
        if (!graph.nodes.some(n => n.id === node.id)) {
          graph.nodes.push(node);
        }
      }

      // 合并边
      for (const edge of fileGraph.edges) {
        if (!graph.edges.some(e => e.from === edge.from && e.to === edge.to)) {
          graph.edges.push(edge);
        }
      }
    }

    return graph;
  }

  /**
   * 查找关键路径
   */
  private findCriticalPaths(graph: DependencyGraph): string[][] {
    // 拓扑排序
    const inDegree: Map<string, number> = new Map();
    const adjacencyList: Map<string, string[]> = new Map();

    // 初始化入度和邻接表
    for (const node of graph.nodes) {
      inDegree.set(node.id, 0);
      adjacencyList.set(node.id, []);
    }

    for (const edge of graph.edges) {
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
      adjacencyList.get(edge.from)?.push(edge.to);
    }

    // Kahn's算法进行拓扑排序
    const queue: string[] = [];
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) {
        queue.push(nodeId);
      }
    });

    const topologicalOrder: string[] = [];
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      topologicalOrder.push(nodeId);

      for (const neighbor of adjacencyList.get(nodeId) || []) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    // 构建关键路径
    const criticalPaths: string[][] = [];
    const visited = new Set<string>();

    const dfs = (nodeId: string, path: string[]) => {
      visited.add(nodeId);
      const neighbors = adjacencyList.get(nodeId) || [];

      if (neighbors.length === 0) {
        // 叶子节点，保存路径
        criticalPaths.push([...path]);
      } else {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            dfs(neighbor, [...path, neighbor]);
          }
        }
      }

      visited.delete(nodeId);
    };

    // 从所有入度为0的节点开始DFS
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) {
        dfs(nodeId, [nodeId]);
      }
    });

    return criticalPaths;
  }

  /**
   * 分析修复的影响范围
   */
  async analyzeImpact(
    filePath: string,
    line: number,
    column: number,
    dependencyGraph: DependencyGraph
  ): Promise<ImpactAnalysisResult> {
    // 查找受影响的节点
    const affectedNodes = new Set<string>();
    const warnings: string[] = [];

    // 1. 查找直接受影响的节点
    const targetNode = dependencyGraph.nodes.find(node =>
      node.filePath === filePath &&
      (!node.line || (node.line <= line && (node.line + 50 >= line))) // 50行范围内
    );

    if (!targetNode) {
      warnings.push(`未找到文件 ${filePath} 中的目标节点`);
      return {
        affectedNodes: [],
        criticalPaths: [],
        impactScore: 0,
        warnings
      };
    }

    affectedNodes.add(targetNode.id);

    // 2. 使用BFS查找所有依赖该节点的节点
    const queue: string[] = [targetNode.id];
    const visited = new Set<string>([targetNode.id]);

    while (queue.length > 0) {
      const currentId = queue.shift()!;

      // 查找所有依赖当前节点的节点
      const dependents = dependencyGraph.edges
        .filter(edge => edge.to === currentId)
        .map(edge => edge.from);

      for (const dependentId of dependents) {
        if (!visited.has(dependentId)) {
          visited.add(dependentId);
          affectedNodes.add(dependentId);
          queue.push(dependentId);
        }
      }
    }

    // 3. 查找关键路径
    const criticalPaths = this.findCriticalPaths(dependencyGraph)
      .filter(path => path.some(nodeId => affectedNodes.has(nodeId)));

    // 4. 计算影响分数
    const impactScore = affectedNodes.size * 10 + criticalPaths.length * 5;

    return {
      affectedNodes: Array.from(affectedNodes),
      criticalPaths,
      impactScore,
      warnings
    };
  }

  /**
   * 检测循环依赖
   */
  private detectCircularDependencies(graph: DependencyGraph): string[][] {
    const circularPaths: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Map<string, string[]>();

    const dfs = (nodeId: string, path: string[]) => {
      visited.add(nodeId);
      recursionStack.set(nodeId, path);

      const neighbors = graph.edges
        .filter(edge => edge.from === nodeId)
        .map(edge => edge.to);

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path, neighbor]);
        } else if (recursionStack.has(neighbor)) {
          // 找到循环依赖
          const cycleStartIndex = path.indexOf(neighbor);
          if (cycleStartIndex !== -1) {
            const cycle = [...path.slice(cycleStartIndex), neighbor];
            circularPaths.push(cycle);
          }
        }
      }

      recursionStack.delete(nodeId);
    };



    for (const node of graph.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, [node.id]);
      }
    }

    return circularPaths;
  }

  /**
   * 修复后验证依赖关系
   */
  async verifyDependenciesAfterFix(
    preFixGraph: DependencyGraph,
    postFixGraph: DependencyGraph
  ): Promise<DependencyVerificationResult> {
    const issues: string[] = [];
    const brokenDependencies: string[] = [];

    // 1. 检测缺失的依赖
    const preFixEdges = new Set(preFixGraph.edges.map(e => `${e.from}->${e.to}->${e.type}`));
    const postFixEdges = new Set(postFixGraph.edges.map(e => `${e.from}->${e.to}->${e.type}`));

    preFixEdges.forEach(edgeStr => {
      if (!postFixEdges.has(edgeStr)) {
        brokenDependencies.push(edgeStr);
        issues.push(`依赖关系已断开: ${edgeStr}`);
      }
    });

    // 2. 检测循环依赖
    const circularDependencies = this.detectCircularDependencies(postFixGraph);
    if (circularDependencies.length > 0) {
      circularDependencies.forEach(cycle => {
        issues.push(`发现循环依赖: ${cycle.join(' -> ')}`);
      });
    }

    // 3. 检测节点缺失
    const preFixNodeIds = new Set(preFixGraph.nodes.map(n => n.id));
    const postFixNodeIds = new Set(postFixGraph.nodes.map(n => n.id));

    preFixNodeIds.forEach(nodeId => {
      if (!postFixNodeIds.has(nodeId)) {
        issues.push(`节点已缺失: ${nodeId}`);
      }
    });

    return {
      success: issues.length === 0,
      issues,
      brokenDependencies,
      circularDependencies
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
   * 生成依赖图的可视化数据
   */
  generateVisualizationData(graph: DependencyGraph): any {
    return {
      nodes: graph.nodes.map(node => ({
        id: node.id,
        label: node.name,
        type: node.type,
        filePath: node.filePath,
        line: node.line,
        column: node.column
      })),
      edges: graph.edges.map(edge => ({
        from: edge.from,
        to: edge.to,
        label: edge.type,
        type: edge.type,
        line: edge.line,
        column: edge.column
      }))
    };
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// 创建单例实例
export const dependencyAnalysisService = new DependencyAnalysisService();

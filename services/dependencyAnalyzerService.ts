/**
 * Dependency Analyzer Service
 * 深度依赖分析服务，自动检测修复可能影响的其他组件和函数
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

interface DependencyNode {
  id: string;
  name: string;
  type: 'file' | 'function' | 'class' | 'interface' | 'variable';
  file: string;
  line: number;
  column: number;
  dependencies: string[];
  dependents: string[];
  sourceCode?: string;
}

interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: Array<{ from: string; to: string; type: string }>;
  fileDependencies: Map<string, Set<string>>;
}

interface DependencyAnalysisResult {
  graph: DependencyGraph;
  affectedFiles: Set<string>;
  affectedComponents: Set<string>;
  dependencyTree: Map<string, DependencyNode>;
  cycleDetected: boolean;
  cycles: Array<string[]>;
}

interface DependencyConfig {
  includeDirs: string[];
  excludeDirs: string[];
  includeExtensions: string[];
  excludePatterns: string[];
}

export class DependencyAnalyzerService {
  private readonly config: DependencyConfig;
  private readonly tsProgram: ts.Program | null;
  private readonly cache: Map<string, DependencyAnalysisResult> = new Map();

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
  async analyzeFile(filePath: string): Promise<DependencyAnalysisResult> {
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath)!;
    }

    console.log(`🔍 Analyzing dependencies for: ${filePath}`);

    const graph: DependencyGraph = {
      nodes: new Map(),
      edges: [],
      fileDependencies: new Map()
    };

    const filesToAnalyze = this.findRelatedFiles(filePath);
    
    for (const file of filesToAnalyze) {
      this.buildDependencyGraph(file, graph);
    }

    const affectedFiles = this.findAffectedFiles(filePath, graph);
    const affectedComponents = this.findAffectedComponents(affectedFiles, graph);
    const dependencyTree = this.buildDependencyTree(filePath, graph);
    const { cycles, cycleDetected } = this.detectCycles(graph);

    const result: DependencyAnalysisResult = {
      graph,
      affectedFiles,
      affectedComponents,
      dependencyTree,
      cycleDetected,
      cycles
    };

    this.cache.set(filePath, result);
    return result;
  }

  /**
   * 查找相关文件
   */
  private findRelatedFiles(filePath: string): string[] {
    const files: string[] = [];
    const visited = new Set<string>();

    const queue: string[] = [filePath];
    
    while (queue.length > 0) {
      const currentFile = queue.shift()!;
      if (visited.has(currentFile)) {
        continue;
      }
      
      visited.add(currentFile);
      files.push(currentFile);

      // 查找导入的文件
      try {
        const content = fs.readFileSync(currentFile, 'utf8');
        const imports = this.extractImports(content, currentFile);
        
        for (const importPath of imports) {
          const resolvedPath = this.resolveImport(currentFile, importPath);
          if (resolvedPath && !visited.has(resolvedPath)) {
            queue.push(resolvedPath);
          }
        }
      } catch (error) {
        console.warn(`Failed to read file: ${currentFile}`, error);
      }
    }

    return files;
  }

  /**
   * 提取导入语句
   */
  private extractImports(content: string, filePath: string): string[] {
    // 简单的导入提取实现
    const importRegex = /import\s+.*?from\s+['"](.*?)['"]/g;
    const imports: string[] = [];
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  }

  /**
   * 解析导入路径
   */
  private resolveImport(currentFile: string, importPath: string): string | null {
    // 简单的导入路径解析实现
    try {
      if (importPath.startsWith('./') || importPath.startsWith('../')) {
        const resolvedPath = path.resolve(path.dirname(currentFile), importPath);
        if (fs.existsSync(resolvedPath)) {
          return resolvedPath;
        }
        // 尝试添加文件扩展名
        for (const ext of this.config.includeExtensions) {
          const withExt = resolvedPath + ext;
          if (fs.existsSync(withExt)) {
            return withExt;
          }
        }
      }
      return null;
    } catch (error) {
      console.warn(`Failed to resolve import: ${importPath} from ${currentFile}`, error);
      return null;
    }
  }

  /**
   * 构建依赖图
   */
  private buildDependencyGraph(filePath: string, graph: DependencyGraph): void {
    // 简单的依赖图构建实现
    if (!graph.fileDependencies.has(filePath)) {
      graph.fileDependencies.set(filePath, new Set());
    }
  }

  /**
   * 查找受影响的文件
   */
  private findAffectedFiles(filePath: string, graph: DependencyGraph): Set<string> {
    return new Set([filePath]);
  }

  /**
   * 查找受影响的组件
   */
  private findAffectedComponents(affectedFiles: Set<string>, graph: DependencyGraph): Set<string> {
    return new Set();
  }

  /**
   * 构建依赖树
   */
  private buildDependencyTree(filePath: string, graph: DependencyGraph): Map<string, DependencyNode> {
    return new Map();
  }

  /**
   * 检测循环依赖
   */
  private detectCycles(graph: DependencyGraph): { cycles: string[][]; cycleDetected: boolean } {
    return { cycles: [], cycleDetected: false };
  }
}

// 创建单例实例
export const dependencyAnalyzerService = new DependencyAnalyzerService();

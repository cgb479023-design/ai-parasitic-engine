import { describe, it, expect, vi } from 'vitest';
import { DependencyAnalysisService, DependencyGraph, ImpactAnalysisResult, DependencyVerificationResult } from './dependencyAnalysisService';

describe('DependencyAnalysisService', () => {
  let service: DependencyAnalysisService;

  beforeEach(() => {
    service = new DependencyAnalysisService();
  });

  describe('analyzeFile', () => {
    it('should analyze a simple TypeScript file', async () => {
      // 创建一个简单的测试文件路径
      const testFilePath = 'I:/ai-内容创作智能化平台/src/App.tsx';

      // 调用 analyzeFile 方法
      const graph = await service.analyzeFile(testFilePath);

      // 验证返回结果的基本结构
      expect(graph).toBeDefined();
      expect(Array.isArray(graph.nodes)).toBe(true);
      expect(Array.isArray(graph.edges)).toBe(true);

      // 至少应该有一个节点（当前文件）
      expect(graph.nodes.length).toBeGreaterThan(0);
    });

    it('should handle non-existent files gracefully', async () => {
      const graph = await service.analyzeFile('non-existent-file.ts');

      expect(graph).toBeDefined();
      expect(graph.nodes).toEqual([]);
      expect(graph.edges).toEqual([]);
    });
  });

  describe('buildDependencyGraph', () => {
    it('should build a dependency graph from multiple files', async () => {
      const testFiles = [
        'I:/ai-内容创作智能化平台/src/App.tsx',
        'I:/ai-内容创作智能化平台/src/components/YouTubeAnalytics.tsx'
      ];

      const graph = await service.buildDependencyGraph(testFiles);

      expect(graph).toBeDefined();
      expect(Array.isArray(graph.nodes)).toBe(true);
      expect(Array.isArray(graph.edges)).toBe(true);
    });
  });

  describe('analyzeImpact', () => {
    it('should analyze impact of a change', async () => {
      // 创建一个简单的依赖图用于测试
      const testGraph: DependencyGraph = {
        nodes: [
          { id: 'file1.ts', type: 'file', name: 'file1.ts', filePath: 'file1.ts', dependencies: [], dependents: [] },
          { id: 'file2.ts', type: 'file', name: 'file2.ts', filePath: 'file2.ts', dependencies: [], dependents: [] },
          { id: 'file3.ts', type: 'file', name: 'file3.ts', filePath: 'file3.ts', dependencies: [], dependents: [] }
        ],
        edges: [
          { from: 'file1.ts', to: 'file2.ts', type: 'import' },
          { from: 'file2.ts', to: 'file3.ts', type: 'import' }
        ]
      };

      const result: ImpactAnalysisResult = await service.analyzeImpact(
        'file1.ts',
        10,
        5,
        testGraph
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result.affectedNodes)).toBe(true);
      expect(Array.isArray(result.criticalPaths)).toBe(true);
      expect(typeof result.impactScore).toBe('number');
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe('verifyDependenciesAfterFix', () => {
    it('should verify dependencies after fix', async () => {
      // 创建修复前后的依赖图
      const preFixGraph: DependencyGraph = {
        nodes: [
          { id: 'file1.ts', type: 'file', name: 'file1.ts', filePath: 'file1.ts', dependencies: [], dependents: [] },
          { id: 'file2.ts', type: 'file', name: 'file2.ts', filePath: 'file2.ts', dependencies: [], dependents: [] }
        ],
        edges: [
          { from: 'file1.ts', to: 'file2.ts', type: 'import' }
        ]
      };

      const postFixGraph: DependencyGraph = {
        nodes: [
          { id: 'file1.ts', type: 'file', name: 'file1.ts', filePath: 'file1.ts', dependencies: [], dependents: [] },
          { id: 'file2.ts', type: 'file', name: 'file2.ts', filePath: 'file2.ts', dependencies: [], dependents: [] }
        ],
        edges: [
          { from: 'file1.ts', to: 'file2.ts', type: 'import' }
        ]
      };

      const result: DependencyVerificationResult = await service.verifyDependenciesAfterFix(
        preFixGraph,
        postFixGraph
      );

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(Array.isArray(result.issues)).toBe(true);
      expect(Array.isArray(result.brokenDependencies)).toBe(true);
      expect(Array.isArray(result.circularDependencies)).toBe(true);

      // 修复前后依赖图相同，验证应该成功
      expect(result.success).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it('should detect broken dependencies', async () => {
      // 创建修复前后的依赖图，其中修复后缺失了一个依赖
      const preFixGraph: DependencyGraph = {
        nodes: [
          { id: 'file1.ts', type: 'file', name: 'file1.ts', filePath: 'file1.ts', dependencies: [], dependents: [] },
          { id: 'file2.ts', type: 'file', name: 'file2.ts', filePath: 'file2.ts', dependencies: [], dependents: [] }
        ],
        edges: [
          { from: 'file1.ts', to: 'file2.ts', type: 'import' }
        ]
      };

      const postFixGraph: DependencyGraph = {
        nodes: [
          { id: 'file1.ts', type: 'file', name: 'file1.ts', filePath: 'file1.ts', dependencies: [], dependents: [] },
          { id: 'file2.ts', type: 'file', name: 'file2.ts', filePath: 'file2.ts', dependencies: [], dependents: [] }
        ],
        edges: [] // 缺失了依赖
      };

      const result: DependencyVerificationResult = await service.verifyDependenciesAfterFix(
        preFixGraph,
        postFixGraph
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.brokenDependencies.length).toBeGreaterThan(0);
    });
  });

  describe('generateVisualizationData', () => {
    it('should generate visualization data', () => {
      const testGraph: DependencyGraph = {
        nodes: [
          { id: 'file1.ts', type: 'file', name: 'file1.ts', filePath: 'file1.ts', dependencies: [], dependents: [] },
          { id: 'file2.ts', type: 'file', name: 'file2.ts', filePath: 'file2.ts', dependencies: [], dependents: [] }
        ],
        edges: [
          { from: 'file1.ts', to: 'file2.ts', type: 'import' }
        ]
      };

      const visualizationData = service.generateVisualizationData(testGraph);

      expect(visualizationData).toBeDefined();
      expect(Array.isArray(visualizationData.nodes)).toBe(true);
      expect(Array.isArray(visualizationData.edges)).toBe(true);
      expect(visualizationData.nodes.length).toBe(testGraph.nodes.length);
      expect(visualizationData.edges.length).toBe(testGraph.edges.length);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { DependencyAnalysisService } from './dependencyAnalysisService';

describe('DependencyAnalysisService - 简单测试', () => {
  let service: DependencyAnalysisService;

  beforeEach(() => {
    service = new DependencyAnalysisService();
  });

  it('should create an instance successfully', () => {
    expect(service).toBeDefined();
  });

  it('should generate visualization data for an empty graph', () => {
    const emptyGraph = { nodes: [], edges: [] };
    const visualizationData = service.generateVisualizationData(emptyGraph);

    expect(visualizationData).toBeDefined();
    expect(Array.isArray(visualizationData.nodes)).toBe(true);
    expect(Array.isArray(visualizationData.edges)).toBe(true);
    expect(visualizationData.nodes.length).toBe(0);
    expect(visualizationData.edges.length).toBe(0);
  });

  it('should detect no circular dependencies in an empty graph', () => {
    const emptyGraph = { nodes: [], edges: [] };
    const circularDependencies = (service as any).detectCircularDependencies(emptyGraph);

    expect(Array.isArray(circularDependencies)).toBe(true);
    expect(circularDependencies.length).toBe(0);
  });

  it('should clear cache successfully', () => {
    // 这里我们只是测试方法是否存在且可调用
    expect(() => service.clearCache()).not.toThrow();
  });
});

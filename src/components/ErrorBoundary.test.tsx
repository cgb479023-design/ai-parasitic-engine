/**
 * ErrorBoundary Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

// 模拟一个会抛出错误的组件
const ErrorThrowingComponent = () => {
  throw new Error('Test error');
};

// 模拟一个不会抛出错误的组件
const NormalComponent = () => {
  return <div>Normal Component</div>;
};

describe('ErrorBoundary', () => {
  it('should render children normally when no error occurs', () => {
    render(
      <ErrorBoundary>
        <NormalComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText('Normal Component')).toBeInTheDocument();
  });

  it('should render fallback UI when error occurs', () => {
    // 使用spyOn来阻止控制台错误
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

    render(
      <ErrorBoundary>
        <ErrorThrowingComponent />
      </ErrorBoundary>
    );

    // 检查是否显示了错误信息
    expect(screen.getByText('应用出错了')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('should call onError callback when error occurs', () => {
    const onErrorMock = vi.fn();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

    render(
      <ErrorBoundary onError={onErrorMock}>
        <ErrorThrowingComponent />
      </ErrorBoundary>
    );

    expect(onErrorMock).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

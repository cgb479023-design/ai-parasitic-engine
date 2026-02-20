/**
 * Virtual List Component
 * 用于优化长列表渲染性能，只渲染可见区域内的列表项
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface VirtualListProps<T> {
  /** 数据列表 */
  items: T[];
  /** 列表项渲染函数 */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** 列表项高度（固定高度） */
  itemHeight: number;
  /** 容器高度 */
  containerHeight?: number;
  /** 额外渲染的列表项数量（缓冲区） */
  overscan?: number;
  /** 列表项唯一标识符键名 */
  keyProp?: keyof T;
  /** 加载更多数据回调 */
  onLoadMore?: () => void;
  /** 是否正在加载更多 */
  isLoadingMore?: boolean;
  /** 加载更多时的渲染内容 */
  renderLoading?: () => React.ReactNode;
  /** 空列表时的渲染内容 */
  renderEmpty?: () => React.ReactNode;
  /** 容器类名 */
  className?: string;
  /** 列表项容器类名 */
  itemClassName?: string;
}

export function VirtualList<T>({
  items,
  renderItem,
  itemHeight,
  containerHeight = 400,
  overscan = 5,
  keyProp,
  onLoadMore,
  isLoadingMore = false,
  renderLoading,
  renderEmpty,
  className = '',
  itemClassName = ''
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 计算可见区域的起始和结束索引
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  // 计算可见区域内的列表项
  const visibleItems = items.slice(startIndex, endIndex + 1);

  // 计算滚动容器的总高度
  const totalHeight = items.length * itemHeight;

  // 计算可见区域的偏移量
  const offsetY = startIndex * itemHeight;

  // 处理滚动事件
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop);

      // 触底加载更多
      if (onLoadMore) {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollTop + clientHeight >= scrollHeight - 100 && !isLoadingMore) {
          onLoadMore();
        }
      }
    },
    [onLoadMore, isLoadingMore]
  );

  // 清空滚动位置当数据变化时
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
      setScrollTop(0);
    }
  }, [items.length]);

  // 渲染空列表
  if (items.length === 0) {
    return renderEmpty ? (
      <div className={`virtual-list-container ${className}`} style={{ height: containerHeight }}>
        {renderEmpty()}
      </div>
    ) : null;
  }

  return (
    <div
      ref={containerRef}
      className={`virtual-list-container overflow-y-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      {/* 虚拟滚动容器 */}
      <div className="virtual-list" style={{ height: totalHeight }}>
        {/* 可见区域的列表项 */}
        <div
          className="virtual-list-items"
          style={{ transform: `translateY(${offsetY}px)` }}
        >
          {visibleItems.map((item, index) => {
            const actualIndex = startIndex + index;
            const key = keyProp ? String(item[keyProp]) : actualIndex;
            
            return (
              <div
                key={key}
                className={`virtual-list-item ${itemClassName}`}
                style={{ height: itemHeight }}
              >
                {renderItem(item, actualIndex)}
              </div>
            );
          })}
        </div>
      </div>

      {/* 加载更多 */}
      {isLoadingMore && renderLoading && (
        <div className="virtual-list-loading">
          {renderLoading()}
        </div>
      )}
    </div>
  );
}

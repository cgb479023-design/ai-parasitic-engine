/**
 * Lazy Image Component
 * 图片懒加载组件，用于优化图片加载性能
 */

import React, { useState, useEffect, useRef } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  placeholder?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onLoad?: (event: React.SyntheticEvent<HTMLImageElement>) => void;
  onError?: (event: React.SyntheticEvent<HTMLImageElement>) => void;
  fallbackSrc?: string;
  threshold?: number;
  rootMargin?: string;
  width?: number | string;
  height?: number | string;
  [key: string]: any; // 允许其他img标签属性
}

export function LazyImage({
  src,
  alt,
  placeholder = <div className="lazy-image-placeholder bg-gray-200 animate-pulse"></div>,
  className = '',
  style = {},
  onLoad,
  onError,
  fallbackSrc,
  threshold = 0.1,
  rootMargin = '0px',
  width,
  height,
  ...rest
}: LazyImageProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // 创建IntersectionObserver
  useEffect(() => {
    if (!isVisible) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIsVisible(true);
              observerRef.current?.unobserve(entry.target);
              observerRef.current?.disconnect();
              observerRef.current = null;
            }
          });
        },
        {
          threshold,
          rootMargin
        }
      );

      if (imgRef.current) {
        observerRef.current.observe(imgRef.current);
      }
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [isVisible, threshold, rootMargin]);

  // 当图片可见时，设置图片源
  useEffect(() => {
    if (isVisible) {
      setImageSrc(src);
    }
  }, [isVisible, src]);

  // 处理图片加载成功
  const handleLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    setIsError(false);
    if (onLoad) {
      onLoad(event);
    }
  };

  // 处理图片加载失败
  const handleError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    setIsError(true);
    if (fallbackSrc) {
      setImageSrc(fallbackSrc);
    }
    if (onError) {
      onError(event);
    }
  };

  // 计算容器样式
  const containerStyle: React.CSSProperties = {
    ...style,
    width,
    height,
    position: 'relative',
    overflow: 'hidden'
  };

  return (
    <div className={`lazy-image-container ${className}`} style={containerStyle}>
      {/* 占位符 */}
      {!imageSrc && placeholder}

      {/* 实际图片 */}
      {imageSrc && (
        <img
          ref={imgRef}
          src={imageSrc}
          alt={alt}
          className="lazy-image transition-opacity duration-300"
          style={{
            opacity: isError ? 0.5 : 1,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            position: 'absolute',
            top: 0,
            left: 0
          }}
          onLoad={handleLoad}
          onError={handleError}
          {...rest}
        />
      )}

      {/* 加载错误时显示的内容 */}
      {isError && !fallbackSrc && (
        <div className="lazy-image-error absolute inset-0 flex items-center justify-center bg-gray-100">
          <span className="text-gray-500">图片加载失败</span>
        </div>
      )}
    </div>
  );
}

// 便捷的图片懒加载钩子
export function useLazyImage(src: string, options?: {
  threshold?: number;
  rootMargin?: string;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!isVisible) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIsVisible(true);
              observerRef.current?.unobserve(entry.target);
              observerRef.current?.disconnect();
              observerRef.current = null;
            }
          });
        },
        {
          threshold: options?.threshold || 0.1,
          rootMargin: options?.rootMargin || '0px'
        }
      );

      if (ref.current) {
        observerRef.current.observe(ref.current);
      }
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [isVisible, options?.threshold, options?.rootMargin]);

  return { ref, isVisible };
}

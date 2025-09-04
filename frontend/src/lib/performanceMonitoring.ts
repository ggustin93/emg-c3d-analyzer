// Performance monitoring utilities for React components
// Provides measurement, profiling, and optimization helpers

import React from 'react';

interface PerformanceMark {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

class PerformanceMonitor {
  private marks: Map<string, PerformanceMark> = new Map();
  private enabled: boolean = process.env.NODE_ENV === 'development';
  
  // Start timing a performance mark
  mark(name: string, metadata?: Record<string, any>) {
    if (!this.enabled) return;
    
    this.marks.set(name, {
      name,
      startTime: performance.now(),
      metadata
    });
  }
  
  // End timing and calculate duration
  measure(name: string): number | null {
    if (!this.enabled) return null;
    
    const mark = this.marks.get(name);
    if (!mark) {
      console.warn(`Performance mark "${name}" not found`);
      return null;
    }
    
    const endTime = performance.now();
    const duration = endTime - mark.startTime;
    
    mark.endTime = endTime;
    mark.duration = duration;
    
    return duration;
  }
  
  // Get performance report
  getReport(): PerformanceMark[] {
    return Array.from(this.marks.values()).filter(mark => mark.duration !== undefined);
  }
  
  // Clear all marks
  clear() {
    this.marks.clear();
  }
  
  // Log performance report to console
  logReport(prefix = 'Performance Report') {
    if (!this.enabled) return;
    
    const report = this.getReport();
    if (report.length === 0) return;
    
    console.group(prefix);
    report.forEach(mark => {
      const duration = mark.duration!.toFixed(2);
      const color = mark.duration! > 100 ? 'color: red' : 
                   mark.duration! > 50 ? 'color: orange' : 'color: green';
      console.log(`%c${mark.name}: ${duration}ms`, color, mark.metadata || {});
    });
    console.groupEnd();
  }
}

// Global performance monitor instance
export const perfMonitor = new PerformanceMonitor();

// React hook for component performance measurement
export const usePerformanceTracker = (componentName: string) => {
  const startRender = () => perfMonitor.mark(`${componentName}-render`);
  const endRender = () => perfMonitor.measure(`${componentName}-render`);
  
  const startEffect = (effectName: string) => perfMonitor.mark(`${componentName}-${effectName}`);
  const endEffect = (effectName: string) => perfMonitor.measure(`${componentName}-${effectName}`);
  
  const getReport = () => perfMonitor.getReport().filter(mark => mark.name.startsWith(componentName));
  
  return { startRender, endRender, startEffect, endEffect, getReport };
};

// HOC for automatic component performance tracking
export const withPerformanceTracking = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string
) => {
  const name = componentName || WrappedComponent.displayName || WrappedComponent.name || 'Anonymous';
  
  const TrackedComponent: React.FC<P> = (props) => {
    const { startRender, endRender } = usePerformanceTracker(name);
    
    React.useEffect(() => {
      startRender();
      return () => {
        endRender();
      };
    });
    
    return React.createElement(WrappedComponent, props);
  };
  
  TrackedComponent.displayName = `withPerformanceTracking(${name})`;
  return TrackedComponent;
};

// Web Vitals integration
export const measureWebVitals = (onPerfEntry?: (metric: any) => void) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(onPerfEntry);
      getFID(onPerfEntry);
      getFCP(onPerfEntry);
      getLCP(onPerfEntry);
      getTTFB(onPerfEntry);
    });
  }
};

// Component-specific performance utilities
export const componentPerformanceUtils = {
  // Measure hook execution time
  measureHook: <T extends any[], R>(hook: (...args: T) => R, name: string) => {
    return (...args: T): R => {
      perfMonitor.mark(name);
      const result = hook(...args);
      perfMonitor.measure(name);
      return result;
    };
  },
  
  // Measure async operation
  measureAsync: async <T>(operation: () => Promise<T>, name: string): Promise<T> => {
    perfMonitor.mark(name);
    try {
      const result = await operation();
      perfMonitor.measure(name);
      return result;
    } catch (error) {
      perfMonitor.measure(name);
      throw error;
    }
  },
  
  // Debounced performance logging
  debouncedLog: (() => {
    let timeoutId: NodeJS.Timeout;
    return (delay = 1000) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        perfMonitor.logReport('Component Performance');
        perfMonitor.clear();
      }, delay);
    };
  })(),
};

// Loading performance thresholds
export const PERFORMANCE_THRESHOLDS = {
  FAST: 100,      // < 100ms - Fast loading
  ACCEPTABLE: 300, // < 300ms - Acceptable loading
  SLOW: 1000,     // < 1000ms - Slow loading
  CRITICAL: 3000,  // > 3000ms - Critical performance issue
} as const;

// Performance classification helper
export const classifyPerformance = (duration: number) => {
  if (duration < PERFORMANCE_THRESHOLDS.FAST) return 'fast';
  if (duration < PERFORMANCE_THRESHOLDS.ACCEPTABLE) return 'acceptable';
  if (duration < PERFORMANCE_THRESHOLDS.SLOW) return 'slow';
  return 'critical';
};

// Export performance data for analysis
export const exportPerformanceData = () => {
  const report = perfMonitor.getReport();
  const data = {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    measurements: report,
    summary: {
      totalMarks: report.length,
      averageDuration: report.reduce((sum, mark) => sum + (mark.duration || 0), 0) / report.length,
      slowOperations: report.filter(mark => (mark.duration || 0) > PERFORMANCE_THRESHOLDS.SLOW),
    }
  };
  
  return data;
};

export default perfMonitor;
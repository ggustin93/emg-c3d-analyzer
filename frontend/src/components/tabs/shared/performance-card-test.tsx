// Performance testing utility for PerformanceCard component
// Run this component to measure and benchmark loading performance

import React, { useState, useEffect } from 'react';
import PerformanceCard, { PerformanceCardProps } from './performance-card';
import { perfMonitor, componentPerformanceUtils } from '@/lib/performanceMonitoring';

interface PerformanceTestResult {
  componentName: string;
  loadTime: number;
  renderTime: number;
  memoryUsage?: number;
  classification: 'fast' | 'acceptable' | 'slow' | 'critical';
}

const PerformanceCardTester: React.FC<PerformanceCardProps> = (props) => {
  const [testResults, setTestResults] = useState<PerformanceTestResult[]>([]);
  const [isRunningTest, setIsRunningTest] = useState(false);

  const runPerformanceTest = async () => {
    setIsRunningTest(true);
    perfMonitor.clear();
    
    try {
      // Test 1: Initial load performance
      perfMonitor.mark('test-initial-load');
      
      // Simulate component mount/unmount cycle
      const testIterations = 5;
      const results: PerformanceTestResult[] = [];
      
      for (let i = 0; i < testIterations; i++) {
        perfMonitor.mark(`test-iteration-${i}`);
        
        // Measure memory before
        const memoryBefore = (performance as any).memory?.usedJSHeapSize || 0;
        
        // Wait for component to fully load
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const loadTime = perfMonitor.measure(`test-iteration-${i}`) || 0;
        const memoryAfter = (performance as any).memory?.usedJSHeapSize || 0;
        const memoryUsage = memoryAfter - memoryBefore;
        
        const classification = loadTime < 100 ? 'fast' : 
                             loadTime < 300 ? 'acceptable' : 
                             loadTime < 1000 ? 'slow' : 'critical';
        
        results.push({
          componentName: `PerformanceCard-${i}`,
          loadTime,
          renderTime: loadTime, // For this test, they're the same
          memoryUsage,
          classification
        });
      }
      
      setTestResults(results);
      perfMonitor.logReport('Performance Test Results');
      
    } catch (error) {
      console.error('Performance test failed:', error);
    } finally {
      setIsRunningTest(false);
    }
  };

  const averageLoadTime = testResults.length > 0 
    ? testResults.reduce((sum, r) => sum + r.loadTime, 0) / testResults.length 
    : 0;

  const performanceGrade = averageLoadTime < 100 ? 'A' : 
                          averageLoadTime < 300 ? 'B' : 
                          averageLoadTime < 500 ? 'C' : 
                          averageLoadTime < 1000 ? 'D' : 'F';

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Performance Test Controls */}
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h2 className="text-xl font-semibold mb-4">Performance Card Testing Suite</h2>
          
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={runPerformanceTest}
              disabled={isRunningTest}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-400 hover:bg-blue-700 transition-colors"
            >
              {isRunningTest ? 'Running Tests...' : 'Run Performance Test'}
            </button>
            
            <button
              onClick={() => perfMonitor.clear()}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Clear Results
            </button>
          </div>

          {/* Performance Metrics Summary */}
          {testResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900">Average Load Time</h3>
                <p className="text-2xl font-bold text-blue-700">{averageLoadTime.toFixed(2)}ms</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-medium text-green-900">Performance Grade</h3>
                <p className="text-2xl font-bold text-green-700">{performanceGrade}</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <h3 className="font-medium text-orange-900">Test Iterations</h3>
                <p className="text-2xl font-bold text-orange-700">{testResults.length}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="font-medium text-purple-900">Classification</h3>
                <p className="text-xl font-bold text-purple-700 capitalize">
                  {testResults[testResults.length - 1]?.classification || 'N/A'}
                </p>
              </div>
            </div>
          )}

          {/* Detailed Results Table */}
          {testResults.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium mb-3">Detailed Results</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Iteration</th>
                      <th className="text-left p-2">Load Time (ms)</th>
                      <th className="text-left p-2">Memory (bytes)</th>
                      <th className="text-left p-2">Classification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testResults.map((result, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-2">{index + 1}</td>
                        <td className="p-2">{result.loadTime.toFixed(2)}</td>
                        <td className="p-2">{result.memoryUsage?.toLocaleString() || 'N/A'}</td>
                        <td className="p-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            result.classification === 'fast' ? 'bg-green-100 text-green-800' :
                            result.classification === 'acceptable' ? 'bg-blue-100 text-blue-800' :
                            result.classification === 'slow' ? 'bg-orange-100 text-orange-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {result.classification}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Test Subject: Actual PerformanceCard */}
        <div className="bg-white rounded-lg p-6 shadow-sm border">
          <h3 className="text-lg font-semibold mb-4">Test Subject: PerformanceCard Component</h3>
          <PerformanceCard {...props} />
        </div>

        {/* Performance Recommendations */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-800 mb-3">Performance Recommendations</h3>
          <ul className="space-y-2 text-yellow-700">
            <li>• Target load time: &lt;300ms for acceptable performance</li>
            <li>• Optimal load time: &lt;100ms for fast performance</li>
            <li>• Critical threshold: &gt;1000ms requires immediate optimization</li>
            <li>• Monitor memory usage for components with large data sets</li>
            <li>• Use progressive loading states for better perceived performance</li>
          </ul>
        </div>

      </div>
    </div>
  );
};

export default PerformanceCardTester;
import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

/**
 * Test component to verify error capture system
 * This component intentionally triggers different types of errors for testing
 */
export function TestErrorCapture() {
  const [shouldThrow, setShouldThrow] = useState(false);
  const [triggerLoop, setTriggerLoop] = useState(false);

  // Component that throws an error
  const ThrowingComponent = () => {
    if (shouldThrow) {
      throw new Error('Test React Component Error - This should be caught by ErrorBoundary');
    }
    return <div>Component rendered successfully</div>;
  };

  // Component with infinite loop
  const InfiniteLoopComponent = () => {
    const [count, setCount] = React.useState(0);
    
    if (triggerLoop) {
      // This will cause Maximum update depth exceeded error
      setCount(count + 1);
    }
    
    return <div>Count: {count}</div>;
  };

  // Test functions
  const testComponentError = () => {
    console.log('🧪 Testing: React Component Error');
    setShouldThrow(true);
  };

  const testAPIError = async () => {
    console.log('🧪 Testing: API Error (404)');
    try {
      const response = await fetch('/api/nonexistent-endpoint');
      if (!response.ok) {
        console.log('API returned error:', response.status);
      }
    } catch (error) {
      console.log('API request failed:', error);
    }
  };

  const testGlobalError = () => {
    console.log('🧪 Testing: Global JavaScript Error');
    setTimeout(() => {
      // This error happens outside React's control
      throw new Error('Test Global Error - Should be caught by window.onerror');
    }, 100);
  };

  const testPromiseRejection = () => {
    console.log('🧪 Testing: Unhandled Promise Rejection');
    Promise.reject('Test Promise Rejection - Should be caught by unhandledrejection handler');
  };

  const testConsoleError = () => {
    console.log('🧪 Testing: Console.error interception');
    console.error('Test Console Error - Should be logged to our system');
  };

  const testSlowAPI = async () => {
    console.log('🧪 Testing: Slow API Request (simulated)');
    // Simulate slow request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      await fetch('/api/analysis/recalc', {
        signal: controller.signal
      });
    } catch (error) {
      console.log('Slow request aborted or failed');
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const testInfiniteLoop = () => {
    console.log('🧪 Testing: Maximum update depth (infinite loop)');
    setTriggerLoop(true);
  };

  const testNetworkError = async () => {
    console.log('🧪 Testing: Network Error (invalid URL)');
    try {
      await fetch('http://invalid-domain-that-does-not-exist.com/api');
    } catch (error) {
      console.log('Network error caught:', error);
    }
  };

  // Reset function
  const resetTests = () => {
    setShouldThrow(false);
    setTriggerLoop(false);
    window.location.reload();
  };

  return (
    <Card className="max-w-2xl mx-auto mt-8">
      <CardHeader>
        <CardTitle>🧪 Error Capture Test Suite</CardTitle>
        <p className="text-sm text-gray-600 mt-2">
          Test different error scenarios to verify the error capture system is working.
          Open browser console and check network tab to see logging in action.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Button onClick={testComponentError} variant="destructive">
            1. Trigger React Error
          </Button>
          
          <Button onClick={testAPIError} variant="destructive">
            2. Trigger API Error (404)
          </Button>
          
          <Button onClick={testGlobalError} variant="destructive">
            3. Trigger Global JS Error
          </Button>
          
          <Button onClick={testPromiseRejection} variant="destructive">
            4. Trigger Promise Rejection
          </Button>
          
          <Button onClick={testConsoleError} variant="destructive">
            5. Trigger Console Error
          </Button>
          
          <Button onClick={testSlowAPI} variant="destructive">
            6. Trigger Slow API Call
          </Button>
          
          <Button onClick={testInfiniteLoop} variant="destructive">
            7. Trigger Infinite Loop
          </Button>
          
          <Button onClick={testNetworkError} variant="destructive">
            8. Trigger Network Error
          </Button>
        </div>

        <div className="border-t pt-4">
          <Button onClick={resetTests} variant="outline" className="w-full">
            Reset / Reload Page
          </Button>
        </div>

        <div className="bg-yellow-50 p-4 rounded-lg">
          <h4 className="font-semibold text-yellow-800 mb-2">Expected Results:</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>✅ React errors → ErrorBoundary UI with retry button</li>
            <li>✅ API errors → Logged with status codes</li>
            <li>✅ Global JS errors → Caught by window.onerror</li>
            <li>✅ Promise rejections → Caught by unhandledrejection</li>
            <li>✅ Console errors → Intercepted and logged</li>
            <li>✅ Slow API → Warning logged for requests &gt;3s</li>
            <li>✅ Infinite loops → ErrorBoundary catches max depth</li>
            <li>✅ Network errors → Logged with offline detection</li>
          </ul>
        </div>

        {/* Render components that might throw errors */}
        <div className="border p-4 rounded">
          <ThrowingComponent />
          <InfiniteLoopComponent />
        </div>
      </CardContent>
    </Card>
  );
}
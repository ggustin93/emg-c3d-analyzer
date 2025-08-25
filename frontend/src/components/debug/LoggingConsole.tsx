/**
 * Logging Console Debug Component
 * Shows real-time logging output from the EMG chart
 */

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface LogEntry {
  timestamp: string;
  level: string;
  category: string;
  message: string;
  data?: any;
}

const LoggingConsole: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [filter, setFilter] = useState<string>('');
  const logEndRef = useRef<HTMLDivElement>(null);
  const originalConsole = useRef<any>({});

  useEffect(() => {
    // Store original console methods
    originalConsole.current = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
      info: console.info
    };

    if (isCapturing) {
      // Intercept console methods
      const interceptConsole = (level: string, originalMethod: Function) => {
        return (...args: any[]) => {
          // Call original method
          originalMethod.apply(console, args);
          
          // Capture for our display
          const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
          ).join(' ');
          
          // Only capture EMG-related logs
          if (message.includes('contraction') || message.includes('MVC') || 
              message.includes('duration') || message.includes('Area') ||
              message.includes('Color') || message.includes('🎯') ||
              message.includes('🟡') || message.includes('🔴')) {
            
            const entry: LogEntry = {
              timestamp: new Date().toLocaleTimeString(),
              level,
              category: 'EMG',
              message,
              data: args.length > 1 ? args.slice(1) : undefined
            };
            
            setLogs(prev => [...prev.slice(-49), entry]); // Keep last 50 entries
          }
        };
      };

      console.log = interceptConsole('log', originalConsole.current.log);
      console.warn = interceptConsole('warn', originalConsole.current.warn);
      console.error = interceptConsole('error', originalConsole.current.error);
      console.debug = interceptConsole('debug', originalConsole.current.debug);
      console.info = interceptConsole('info', originalConsole.current.info);
    }

    return () => {
      // Restore original console methods
      if (originalConsole.current.log) {
        console.log = originalConsole.current.log;
        console.warn = originalConsole.current.warn;
        console.error = originalConsole.current.error;
        console.debug = originalConsole.current.debug;
        console.info = originalConsole.current.info;
      }
    };
  }, [isCapturing]);

  useEffect(() => {
    // Auto-scroll to bottom
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const filteredLogs = filter 
    ? logs.filter(log => 
        log.message.toLowerCase().includes(filter.toLowerCase()) ||
        log.category.toLowerCase().includes(filter.toLowerCase())
      )
    : logs;

  const clearLogs = () => setLogs([]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'bg-red-100 text-red-800';
      case 'warn': return 'bg-yellow-100 text-yellow-800';
      case 'info': return 'bg-blue-100 text-blue-800';
      case 'debug': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="border-l-4 border-l-purple-500">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          📝 EMG Logging Console
          <div className="flex gap-2">
            <Button
              variant={isCapturing ? "destructive" : "default"}
              size="sm"
              onClick={() => setIsCapturing(!isCapturing)}
            >
              {isCapturing ? 'Stop Capture' : 'Start Capture'}
            </Button>
            <Button variant="outline" size="sm" onClick={clearLogs}>
              Clear
            </Button>
          </div>
        </CardTitle>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter logs..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-2 py-1 text-xs border rounded flex-1"
          />
          <Badge variant="outline">
            {filteredLogs.length} / {logs.length} entries
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-black text-green-400 p-4 rounded font-mono text-xs h-96 overflow-y-auto">
          {!isCapturing && (
            <div className="text-gray-500 text-center py-8">
              Click "Start Capture" to begin logging EMG chart activity...
            </div>
          )}
          
          {isCapturing && filteredLogs.length === 0 && (
            <div className="text-gray-500 text-center py-8">
              Waiting for EMG chart activity...<br/>
              Try interacting with the chart, changing settings, or uploading data.
            </div>
          )}
          
          {filteredLogs.map((log, idx) => (
            <div key={idx} className="mb-2 border-b border-gray-800 pb-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-gray-400">[{log.timestamp}]</span>
                <Badge className={`text-xs ${getLevelColor(log.level)}`}>
                  {log.level.toUpperCase()}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {log.category}
                </Badge>
              </div>
              <div className="text-green-400 whitespace-pre-wrap break-words">
                {log.message}
              </div>
            </div>
          ))}
          
          <div ref={logEndRef} />
        </div>
        
        <div className="mt-4 text-xs text-gray-600 space-y-1">
          <p><strong>Usage:</strong> Start capture, then interact with the EMG chart to see real-time logging.</p>
          <p><strong>Look for:</strong> Messages containing "contraction", "MVC", "duration", "Area", "Color", or emoji indicators (🎯🟡🔴)</p>
          <p><strong>Debug Focus:</strong> Check if backend `is_good`, `meets_mvc`, `meets_duration` values match your visual expectations</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default LoggingConsole;
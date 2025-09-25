import React from 'react';
import Spinner from './Spinner';

/**
 * HydrateFallback Component
 * 
 * Provides a fallback UI during React 19 hydration process.
 * Resolves: "No `HydrateFallback` element provided to render during initial hydration"
 */
export function HydrateFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center space-y-4">
        <Spinner />
        <div className="text-muted-foreground text-sm">
          Loading application...
        </div>
      </div>
    </div>
  );
}

export default HydrateFallback;
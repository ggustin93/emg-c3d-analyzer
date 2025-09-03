import React from 'react';
import { cn } from '@/lib/utils';

// Enhanced loading states with better UX and animation performance

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'green' | 'orange' | 'red' | 'slate';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'blue',
  className
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };
  
  const colorClasses = {
    blue: 'text-blue-500',
    green: 'text-green-500',
    orange: 'text-orange-500',
    red: 'text-red-500',
    slate: 'text-slate-500'
  };
  
  return (
    <svg
      className={cn(
        'animate-spin',
        sizeClasses[size],
        colorClasses[color],
        className
      )}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="60"
        strokeLinecap="round"
      />
    </svg>
  );
};

interface ProgressBarProps {
  progress: number;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'green' | 'orange' | 'red';
  className?: string;
  animated?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  showPercentage = true,
  size = 'md',
  color = 'blue',
  className,
  animated = true
}) => {
  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };
  
  const colorClasses = {
    blue: 'bg-gradient-to-r from-blue-500 to-indigo-600',
    green: 'bg-gradient-to-r from-green-500 to-emerald-600',
    orange: 'bg-gradient-to-r from-orange-500 to-amber-600',
    red: 'bg-gradient-to-r from-red-500 to-rose-600'
  };
  
  return (
    <div className={cn('w-full', className)}>
      <div className={cn('bg-slate-200 rounded-full overflow-hidden', sizeClasses[size])}>
        <div 
          className={cn(
            colorClasses[color],
            animated && 'transition-all duration-300 ease-out'
          )}
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        />
      </div>
      {showPercentage && (
        <div className="flex justify-between text-sm text-slate-600 mt-1">
          <span>Loading...</span>
          <span>{Math.round(progress)}%</span>
        </div>
      )}
    </div>
  );
};

interface SkeletonProps {
  className?: string;
  animate?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  animate = true
}) => (
  <div 
    className={cn(
      'bg-slate-200 rounded',
      animate && 'animate-pulse',
      className
    )}
  />
);

// Specific loading states for performance components

export const MuscleCardSkeleton: React.FC = () => (
  <div className="lg:col-span-4 xl:col-span-4">
    <div className="bg-gradient-to-br from-slate-100 to-slate-50 rounded-xl p-6 border border-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      
      {/* Score circle */}
      <div className="flex justify-center mb-4">
        <Skeleton className="h-16 w-16 rounded-full" />
      </div>
      
      {/* Metrics */}
      <div className="space-y-3">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-14" />
        </div>
      </div>
      
      {/* Progress bars */}
      <div className="mt-4 space-y-2">
        <div className="space-y-1">
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="flex justify-between">
            <Skeleton className="h-2 w-12" />
            <Skeleton className="h-2 w-8" />
          </div>
        </div>
        <div className="space-y-1">
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="flex justify-between">
            <Skeleton className="h-2 w-16" />
            <Skeleton className="h-2 w-10" />
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const OverallCardSkeleton: React.FC = () => (
  <div className="lg:col-span-4 xl:col-span-4">
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
      {/* Header */}
      <div className="text-center mb-4">
        <Skeleton className="h-4 w-32 mx-auto mb-2" />
        <Skeleton className="h-12 w-20 rounded-full mx-auto" />
      </div>
      
      {/* Performance breakdown */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-3 w-10" />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-3 w-14" />
          </div>
          <Skeleton className="h-3 w-8" />
        </div>
      </div>
      
      {/* Driver info */}
      <div className="mt-4 pt-3 border-t border-blue-200">
        <div className="text-center">
          <Skeleton className="h-3 w-28 mx-auto mb-1" />
          <Skeleton className="h-4 w-20 mx-auto" />
        </div>
      </div>
    </div>
  </div>
);

export const SupportingMetricsSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
    {/* Symmetry Card */}
    <div className="lg:col-span-4">
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <div className="text-center">
          <Skeleton className="h-10 w-16 mx-auto mb-2" />
          <Skeleton className="h-3 w-32 mx-auto" />
        </div>
      </div>
    </div>
    
    {/* RPE Card */}
    <div className="lg:col-span-4">
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-12 rounded-full" />
        </div>
        <div className="flex justify-center mb-4">
          <Skeleton className="h-12 w-12 rounded-full" />
        </div>
        <Skeleton className="h-3 w-28 mx-auto" />
      </div>
    </div>
    
    {/* Game Card */}
    <div className="lg:col-span-4">
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-8" />
          </div>
        </div>
      </div>
    </div>
  </div>
);

interface LoadingStateProps {
  phase: string;
  progress: number;
  description?: string;
  showSpinner?: boolean;
  minHeight?: string;
}

export const EnhancedLoadingState: React.FC<LoadingStateProps> = ({
  phase,
  progress,
  description,
  showSpinner = true,
  minHeight = "400px"
}) => (
  <div 
    className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-8 shadow-sm border border-slate-200 text-center flex flex-col items-center justify-center"
    style={{ minHeight }}
  >
    {showSpinner && (
      <div className="mb-6">
        <LoadingSpinner size="lg" color="blue" />
      </div>
    )}
    
    <h3 className="text-lg font-semibold text-slate-800 mb-2">{phase}</h3>
    
    {description && (
      <p className="text-slate-600 mb-6 max-w-md">{description}</p>
    )}
    
    <div className="w-full max-w-xs">
      <ProgressBar 
        progress={progress} 
        color="blue" 
        size="md"
        showPercentage={true}
      />
    </div>
    
    {/* Performance hint */}
    {progress > 70 && (
      <p className="text-xs text-slate-500 mt-4 animate-pulse">
        Almost ready... finalizing calculations
      </p>
    )}
  </div>
);

// Error state component
interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  minHeight?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Unable to load performance metrics",
  message = "Please try refreshing or contact support if the issue persists.",
  onRetry,
  minHeight = "400px"
}) => (
  <div 
    className="bg-gradient-to-br from-red-50 to-white rounded-2xl p-8 shadow-sm border border-red-200 text-center flex flex-col items-center justify-center"
    style={{ minHeight }}
  >
    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
      <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.098 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    </div>
    
    <h3 className="text-lg font-semibold text-red-800 mb-2">{title}</h3>
    <p className="text-red-600 mb-6 max-w-md">{message}</p>
    
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors duration-200"
      >
        Try Again
      </button>
    )}
  </div>
);

export default {
  LoadingSpinner,
  ProgressBar,
  Skeleton,
  MuscleCardSkeleton,
  OverallCardSkeleton,
  SupportingMetricsSkeleton,
  EnhancedLoadingState,
  ErrorState
};
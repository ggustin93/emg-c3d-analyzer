import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { cn } from '@/lib/utils';
import { formatPercentage } from '@/lib/formatUtils';

interface CircleDisplayProps {
  value: number;
  total?: number;
  label?: string;
  color: string;
  size?: "sm" | "md" | "lg";
  showPercentage?: boolean;
  showExpected?: boolean;
}

/**
 * Shared circular gauge/progress display component
 * Used across Performance Analysis components for consistent visual representation
 * 
 * Features:
 * - Partial gauge fills for values < 100%
 * - Consistent formatting using formatPercentage utility
 * - Responsive sizing (sm/md/lg)
 * - Optional expected value display
 */
const CircleDisplay: React.FC<CircleDisplayProps> = ({ 
  value, 
  total, 
  label, 
  color, 
  size = "md",
  showPercentage = true,
  showExpected = false
}) => {
  const sizeClass = {
    sm: "w-16 h-16",
    md: "w-24 h-24",
    lg: "w-32 h-32"
  };
  
  const textSizeClass = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-3xl"
  };
  
  // Calculate percentage for display and gauge fill
  const actualPercentage = total && total > 0 
    ? Math.round((value / total) * 100)
    : Math.round(value);
  
  // Only show full circle if value is at or near 100%
  const fillPercentage = actualPercentage >= 98 ? 100 : actualPercentage;
  
  // Format display value consistently
  const displayValue = showPercentage 
    ? formatPercentage(actualPercentage)
    : value.toString();
  
  return (
    <div className="flex flex-col items-center">
      <div className={cn("relative", sizeClass[size])}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={[{ value: fillPercentage }, { value: Math.max(0, 100 - fillPercentage) }]}
              cx="50%"
              cy="50%"
              innerRadius={size === "sm" ? 28 : size === "md" ? 38 : 48}
              outerRadius={size === "sm" ? 30 : size === "md" ? 42 : 52}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              stroke="none"
            >
              <Cell fill={color} />
              <Cell fill="#e5e7eb" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-bold", textSizeClass[size])} style={{ color }}>
            {displayValue}
          </span>
          {total && showExpected && (
            <span className="text-xs text-gray-500">of {total}</span>
          )}
        </div>
      </div>
      {label && (
        <p className="text-xs text-gray-500 mt-2">
          {label}
        </p>
      )}
    </div>
  );
};

export default CircleDisplay;
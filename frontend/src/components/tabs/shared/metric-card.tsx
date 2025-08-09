import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import React from 'react';
import { ExclamationTriangleIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { formatMetricValue } from '@/lib/formatters';

interface MetricCardProps {
  title: string;
  value: number | string | null;
  unit: string;
  description: string;
  icon?: React.ReactNode;
  isInteger?: boolean;
  precision?: number;
  useScientificNotation?: boolean;
  descriptionClassName?: string;
  error?: string | null;
  validationStatus?: 'validated' | 'to-be-validated' | 'strong-assumption';
  tooltipContent?: string;
  // Visual hierarchy and auxiliary content
  variant?: 'primary' | 'secondary';
  subtext?: string;
  valueClassName?: string;
  /** Force unit to render even when value is not a finite number */
  forceShowUnit?: boolean;
  /** Compact layout reduces paddings and font sizes */
  compact?: boolean;
  /** Controls value size; defaults to md */
  size?: 'sm' | 'md' | 'lg';
}

export default function MetricCard({
  title,
  value,
  unit,
  description,
  icon,
  isInteger,
  precision,
  useScientificNotation,
  descriptionClassName,
  error,
  validationStatus,
  tooltipContent,
  variant = 'secondary',
  subtext,
  valueClassName,
  forceShowUnit = false,
  compact = false,
  size = 'md',
}: MetricCardProps) {
  const formattedValue = error
    ? '---'
    : formatMetricValue(typeof value === 'string' ? parseFloat(value) : value, {
        isInteger,
        precision,
        useScientificNotation,
      });

  const titleClass = variant === 'primary'
    ? 'text-sm font-semibold'
    : 'text-sm font-medium';

  const baseSize = size === 'sm' ? 'text-xl' : size === 'lg' ? 'text-4xl' : 'text-3xl';
  const valueTextClass = `${baseSize} font-bold ${valueClassName ?? ''}`.trim();

  const renderCardContent = () => (
    <Card className="relative flex flex-col justify-between h-full">
      <CardHeader className={`flex flex-row items-center justify-between space-y-0 ${compact ? 'pb-1' : 'pb-2'}`}>
        <div className="flex items-center">
          <CardTitle className={titleClass}>{title}</CardTitle>
          {(tooltipContent || description) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="ml-1.5 text-slate-400 hover:text-slate-600 focus:outline-none">
                  <InfoCircledIcon className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs p-3 text-sm bg-amber-50 border border-amber-100 shadow-md rounded-md">
                <p>{tooltipContent || description}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </CardHeader>
      <CardContent className={`flex flex-col items-center justify-center flex-grow ${compact ? 'py-2' : ''}`}>
        <div className={valueTextClass}>{formattedValue}</div>
        {(forceShowUnit || (typeof value === 'number' && isFinite(value) && value !== null)) && !error && unit && (
          <div className="text-md text-muted-foreground">{unit}</div>
        )}
        {subtext && (
          <div className="text-xs text-slate-500 mt-1 text-center">
            {subtext}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <TooltipProvider delayDuration={100}>
      {error ? (
        <Tooltip>
          <TooltipTrigger asChild>{renderCardContent()}</TooltipTrigger>
          <TooltipContent className="bg-destructive text-destructive-foreground max-w-xs">
            <p>Error: {error}</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        renderCardContent()
      )}
    </TooltipProvider>
  );
} 
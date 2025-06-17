import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import React from 'react';
import { ExclamationTriangleIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { formatMetricValue } from '../../utils/formatters';

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
}: MetricCardProps) {
  const formattedValue = error
    ? '---'
    : formatMetricValue(typeof value === 'string' ? parseFloat(value) : value, {
        isInteger,
        precision,
        useScientificNotation,
      });

  const renderCardContent = () => (
    <Card className="relative flex flex-col justify-between h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
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
      <CardContent className="flex flex-col items-center justify-center flex-grow">
        <div className="text-3xl font-bold">
          {formattedValue}
        </div>
        {typeof value === 'number' && !isNaN(value) && value !== null && !error && (
          <div className="text-md text-muted-foreground">{unit}</div>
        )}
      </CardContent>
    </Card>
  );

  if (error) {
    return (
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>{renderCardContent()}</TooltipTrigger>
          <TooltipContent className="bg-destructive text-destructive-foreground max-w-xs">
            <p>Error: {error}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return renderCardContent();
} 
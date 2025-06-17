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
    <Card className="relative">
      {validationStatus === 'strong-assumption' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-foreground p-0 m-0 h-4 w-4 flex items-center justify-center">
              <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="bg-amber-50 border-amber-100">
            <p>Work in Progress: based on strong biomedical assumptions.</p>
          </TooltipContent>
        </Tooltip>
      )}
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {(tooltipContent || description) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="ml-1.5 text-slate-400 hover:text-slate-600 focus:outline-none">
                  <InfoCircledIcon className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs p-3 text-sm bg-amber-50 border border-amber-100 shadow-md rounded-md">
                <p>{tooltipContent || description}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {icon && <div className="h-4 w-4 text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold flex items-center">
          {formattedValue}
          {typeof value === 'number' && !isNaN(value) && value !== null && !error && (
            <span className="ml-1 text-lg text-muted-foreground">{unit}</span>
          )}
        </div>
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
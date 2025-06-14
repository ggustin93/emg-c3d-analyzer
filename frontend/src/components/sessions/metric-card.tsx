import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import React, { useState } from 'react';
import { Badge } from '../ui/badge';
import { formatMetricValue } from '../../utils/formatters';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { ExclamationTriangleIcon, ChevronDownIcon } from '@radix-ui/react-icons';

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
}: MetricCardProps) {
  const [isOpen, setIsOpen] = useState(false);
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
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button className="absolute top-2.5 right-2.5 text-muted-foreground hover:text-foreground p-0 m-0 h-4 w-4 flex items-center justify-center">
                <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Work in Progress: based on strong biomedical assumptions.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon && <div className="h-4 w-4 text-muted-foreground">{icon}</div>}
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold flex items-center cursor-pointer">
              {formattedValue}
              {typeof value === 'number' && !isNaN(value) && value !== null && !error && (
                <span className="ml-1 text-lg text-muted-foreground">{unit}</span>
              )}
            </div>
            <CollapsibleTrigger asChild>
              <button className="absolute bottom-2 right-2 text-muted-foreground hover:text-foreground">
                <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </button>
            </CollapsibleTrigger>
          <CollapsibleContent>
            <p className={`text-xs text-muted-foreground pt-2 ${descriptionClassName || ''}`}>
              {description}
            </p>
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  );

  if (error) {
    return (
      <TooltipProvider>
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
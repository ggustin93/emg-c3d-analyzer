import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { InfoCircledIcon } from '@radix-ui/react-icons';

interface CompactMetricCardProps {
  title: string;
  value: number | string;
  unit?: string;
  icon: React.ReactNode;
  color: string;
  tooltip: React.ReactNode;
  subtitle?: string;
  badge?: React.ReactNode;
}

const CompactMetricCard: React.FC<CompactMetricCardProps> = ({
  title,
  value,
  unit = '%',
  icon,
  color,
  tooltip,
  subtitle,
  badge,
}) => {
  return (
    <Card className="bg-white shadow-sm hover:shadow-md transition-shadow duration-200 border-gray-200">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={color}>{icon}</span>
            <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoCircledIcon className="h-3.5 w-3.5 text-gray-400 cursor-help hover:text-gray-600 transition-colors" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          </div>
          {badge}
        </div>
        <div className="flex items-baseline gap-1 mb-2">
          <span className={`text-3xl font-bold ${color}`}>
            {typeof value === 'number' ? value.toFixed(0) : value}
          </span>
          {unit && <span className="text-base text-gray-500 font-medium">{unit}</span>}
        </div>
        {subtitle && (
          <p className="text-sm text-gray-600 leading-relaxed">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
};

export default CompactMetricCard;
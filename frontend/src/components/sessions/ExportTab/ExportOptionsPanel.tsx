/**
 * Export Options Panel Component
 * Handles export configuration options
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { QuestionMarkCircledIcon } from '@radix-ui/react-icons';
import { ExportOptions } from './types';
import { FILE_SIZE_INFO } from './constants';

interface ExportOptionsPanelProps {
  options: ExportOptions;
  onChange: (options: ExportOptions) => void;
}

export const ExportOptionsPanel: React.FC<ExportOptionsPanelProps> = ({
  options,
  onChange,
}) => {
  const handleOptionChange = (key: keyof ExportOptions, value: boolean) => {
    onChange({ ...options, [key]: value });
  };

  const exportOptionItems = [
    {
      key: 'includeAnalytics' as keyof ExportOptions,
      label: 'Analytics',
      description: 'EMG metrics and contraction analysis',
      tooltip: FILE_SIZE_INFO.tooltips.analytics,
    },
    {
      key: 'includeSessionParams' as keyof ExportOptions,
      label: 'Session Parameters',
      description: 'MVC values, thresholds, and configuration',
      tooltip: FILE_SIZE_INFO.tooltips.sessionParams,
    },
    {
      key: 'includePerformanceAnalysis' as keyof ExportOptions,
      label: 'Performance Analysis',
      description: 'Compliance scores and quality metrics',
      tooltip: FILE_SIZE_INFO.tooltips.performanceAnalysis,
    },
    {
      key: 'includeC3dMetadata' as keyof ExportOptions,
      label: 'C3D Metadata',
      description: 'Original game metadata and session info',
      tooltip: FILE_SIZE_INFO.tooltips.c3dMetadata,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Export Options</CardTitle>
        <CardDescription>
          Choose what data to include in your export
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {exportOptionItems.map((item) => (
          <div key={item.key} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  id={`export-${item.key}`}
                  checked={options[item.key]}
                  onCheckedChange={(checked) => handleOptionChange(item.key, checked)}
                />
                <Label 
                  htmlFor={`export-${item.key}`} 
                  className="text-sm font-medium cursor-pointer"
                >
                  {item.label}
                  {item.tooltip && (
                    <Tooltip>
                      <TooltipTrigger className="ml-1">
                        <QuestionMarkCircledIcon className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{item.tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </Label>
              </div>
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              {item.description}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
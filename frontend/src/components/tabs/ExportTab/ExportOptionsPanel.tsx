/**
 * Export Options Panel Component
 * Handles export configuration options
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { QuestionMarkCircledIcon, FileTextIcon, TableIcon } from '@radix-ui/react-icons';
import { ExportOptions } from './types';
import { FILE_SIZE_INFO } from './constants';

interface ExportOptionsPanelProps {
  options: ExportOptions;
  onChange: (options: ExportOptions) => void;
}

type BooleanExportKeys = {
  [K in keyof ExportOptions]: ExportOptions[K] extends boolean ? K : never;
}[keyof ExportOptions];

export const ExportOptionsPanel: React.FC<ExportOptionsPanelProps> = ({
  options,
  onChange,
}) => {
  const handleOptionChange = (key: BooleanExportKeys, value: boolean) => {
    onChange({ ...options, [key]: value });
  };

  const handleFormatChange = (format: 'json' | 'csv') => {
    onChange({ ...options, format });
  };

  const exportOptionItems = [
    {
      key: 'includeAnalytics' as BooleanExportKeys,
      label: 'Analytics',
      description: 'EMG metrics and contraction analysis',
      tooltip: FILE_SIZE_INFO.tooltips.analytics,
    },
    {
      key: 'includeSessionParams' as BooleanExportKeys,
      label: 'Session Parameters',
      description: 'MVC values, thresholds, and configuration',
      tooltip: FILE_SIZE_INFO.tooltips.sessionParams,
    },
    {
      key: 'includePerformanceAnalysis' as BooleanExportKeys,
      label: 'Performance Analysis',
      description: 'Compliance scores and quality metrics',
      tooltip: FILE_SIZE_INFO.tooltips.performanceAnalysis,
    },
    {
      key: 'includeC3dMetadata' as BooleanExportKeys,
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
      <CardContent className="space-y-6">
        {/* Format Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Export Format</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={options.format === 'json' ? 'default' : 'outline'}
              onClick={() => handleFormatChange('json')}
              className="flex items-center justify-start space-x-2 h-auto p-3"
            >
              <FileTextIcon className="h-4 w-4 text-blue-600" />
              <div className="flex-1 text-left">
                <div className="font-medium">JSON</div>
                <div className="text-xs opacity-70">
                  Complete data structure
                </div>
              </div>
            </Button>
            <Button
              variant={options.format === 'csv' ? 'default' : 'outline'}
              onClick={() => handleFormatChange('csv')}
              className="flex items-center justify-start space-x-2 h-auto p-3"
            >
              <TableIcon className="h-4 w-4 text-green-600" />
              <div className="flex-1 text-left">
                <div className="font-medium">CSV</div>
                <div className="text-xs opacity-70">
                  Research-ready format
                </div>
              </div>
            </Button>
          </div>
          <div className="text-xs text-muted-foreground pl-1">
            {options.format === 'json' 
              ? 'Ideal for analysis tools and complete data structure'
              : 'Opens directly in Excel/Python, perfect for research workflows'
            }
          </div>
        </div>

        {/* Data Options */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">Data to Include</Label>
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
        </div>
      </CardContent>
    </Card>
  );
};
/**
 * Export Options Panel Component
 * Handles export configuration options
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { QuestionMarkCircledIcon, FileTextIcon, TableIcon, ChevronDownIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { ExportOptions, AvailableChannel, ChannelSelectionMap, DownsamplingOptions } from './types';
import { FILE_SIZE_INFO } from './constants';
import { ChannelSelector } from './ChannelSelector';
import { DownsamplingControl } from './DownsamplingControl';

interface ExportOptionsPanelProps {
  options: ExportOptions;
  onChange: (options: ExportOptions) => void;
  // EMG Channel props
  availableChannels: AvailableChannel[];
  channelSelection: ChannelSelectionMap;
  onChannelSelectionChange: (channelName: string, field: 'includeRaw' | 'includeActivated' | 'includeProcessedRms', value: boolean) => void;
  hasSelectedChannels: boolean;
  // Downsampling props
  downsamplingOptions: DownsamplingOptions;
  onDownsamplingChange: (options: DownsamplingOptions) => void;
}

type BooleanExportKeys = {
  [K in keyof ExportOptions]: ExportOptions[K] extends boolean ? K : never;
}[keyof ExportOptions];

export const ExportOptionsPanel: React.FC<ExportOptionsPanelProps> = ({
  options,
  onChange,
  availableChannels,
  channelSelection,
  onChannelSelectionChange,
  hasSelectedChannels,
  downsamplingOptions,
  onDownsamplingChange,
}) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  
  const handleOptionChange = (key: BooleanExportKeys, value: boolean) => {
    onChange({ ...options, [key]: value });
  };

  const handleFormatChange = (format: 'json' | 'csv') => {
    // Force JSON if signals are selected
    if (hasSelectedChannels && format === 'csv') {
      return; // Don't change format if CSV is disabled
    }
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
          All data included by default. Customize format and content below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Format Selection - Always Visible */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Export Format</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={options.format === 'json' ? 'secondary' : 'outline'}
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
              variant={options.format === 'csv' ? 'secondary' : 'outline'}
              onClick={() => handleFormatChange('csv')}
              disabled={hasSelectedChannels}
              className={`flex items-center justify-start space-x-2 h-auto p-3 ${
                hasSelectedChannels ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <TableIcon className="h-4 w-4 text-green-600" />
              <div className="flex-1 text-left">
                <div className="font-medium">CSV</div>
                <div className="text-xs opacity-70">
                  {hasSelectedChannels ? 'Not available with signals' : 'Research-ready format'}
                </div>
              </div>
            </Button>
          </div>
          <div className="text-xs text-muted-foreground pl-1">
            {hasSelectedChannels ? (
              'Signal data requires JSON format. CSV only supports analytics and metadata.'
            ) : options.format === 'json' ? (
              'Ideal for analysis tools and complete data structure'
            ) : (
              'Opens directly in Excel/Python, perfect for research workflows'
            )}
          </div>
        </div>

        {/* Advanced Options - Collapsible */}
        <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full justify-between p-2 h-auto"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Advanced Options</span>
                <span className="text-xs text-muted-foreground">
                  Customize data content
                </span>
              </div>
              {isAdvancedOpen ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : (
                <ChevronRightIcon className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-6 pt-2">
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

            {/* EMG Channels Section */}
            <div className="space-y-4">
              <ChannelSelector
                availableChannels={availableChannels}
                channelSelection={channelSelection}
                onChannelSelectionChange={onChannelSelectionChange}
              />
              
              {/* Downsampling Control */}
              <DownsamplingControl
                options={downsamplingOptions}
                onChange={onDownsamplingChange}
                hasSelectedChannels={hasSelectedChannels}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};
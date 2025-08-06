/**
 * Downsampling Control Component
 * Handles EMG signal downsampling configuration
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { QuestionMarkCircledIcon } from '@radix-ui/react-icons';
import { DownsamplingOptions } from './types';
import { DOWNSAMPLING_RATES, FILE_SIZE_INFO, TOGGLE_STYLES } from './constants';

interface DownsamplingControlProps {
  options: DownsamplingOptions;
  onChange: (options: DownsamplingOptions) => void;
  hasSelectedChannels: boolean;
}

export const DownsamplingControl: React.FC<DownsamplingControlProps> = ({
  options,
  onChange,
  hasSelectedChannels,
}) => {
  if (!hasSelectedChannels) {
    return null;
  }

  const handleEnabledChange = (enabled: boolean) => {
    onChange({ ...options, enabled });
  };

  const handleRateChange = (value: string) => {
    onChange({ ...options, samplingRate: parseInt(value) });
  };

  return (
    <Card className={TOGGLE_STYLES.control}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          Reduce File Size
          <Tooltip>
            <TooltipTrigger>
              <QuestionMarkCircledIcon className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p>{FILE_SIZE_INFO.tooltips.downsampling}</p>
            </TooltipContent>
          </Tooltip>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center space-x-2">
          <Switch
            id="downsampling-enabled"
            checked={options.enabled}
            onCheckedChange={handleEnabledChange}
          />
          <Label htmlFor="downsampling-enabled" className="text-sm">
            Enable downsampling
          </Label>
        </div>

        {options.enabled && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Sampling Rate ({FILE_SIZE_INFO.perChannel.min}-{FILE_SIZE_INFO.perChannel.max}MB → smaller)
            </Label>
            <Select 
              value={options.samplingRate.toString()} 
              onValueChange={handleRateChange}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOWNSAMPLING_RATES.map((rate) => (
                  <SelectItem key={rate.value} value={rate.value.toString()}>
                    <div className="flex items-center justify-between w-full">
                      <span>{rate.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {rate.size}
                        {'recommended' in rate && rate.recommended && " (recommended)"}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
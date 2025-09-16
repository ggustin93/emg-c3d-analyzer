/**
 * C3D Metadata Display Component
 * 
 * Displays technical details about C3D files when processing fails,
 * presenting metadata in a user-friendly format for troubleshooting.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ClockIcon, 
  PersonIcon, 
  FileIcon,
  GearIcon,
  InfoCircledIcon
} from '@radix-ui/react-icons';

interface C3DMetadata {
  duration_seconds: number;
  sampling_rate: number;
  frame_count: number;
  channel_count: number;
  game_name: string;
  player_name: string;
  therapist_id: string;
  level: string;
  time: string;
}

interface FileInfo {
  filename: string;
  contains_motion_data: boolean;
  emg_channels: number;
  file_type: string;
  processing_attempted: boolean;
  processing_successful: boolean;
  failure_stage?: string;
}

interface C3DMetadataDisplayProps {
  metadata: C3DMetadata;
  fileInfo: FileInfo;
  className?: string;
}

export const C3DMetadataDisplay: React.FC<C3DMetadataDisplayProps> = ({
  metadata,
  fileInfo,
  className
}) => {
  const formatDuration = (seconds: number): string => {
    if (seconds < 1) {
      return `${(seconds * 1000).toFixed(0)}ms`;
    } else if (seconds < 60) {
      return `${seconds.toFixed(2)} seconds`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = (seconds % 60).toFixed(0);
      return `${minutes}:${remainingSeconds.padStart(2, '0')}`;
    }
  };

  const formatSamplingRate = (rate: number): string => {
    if (rate >= 1000) {
      return `${(rate / 1000).toFixed(1)}kHz`;
    }
    return `${rate}Hz`;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileIcon className="h-5 w-5" />
          File Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic File Information */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Filename</span>
            <span className="font-medium">{fileInfo.filename}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">File Type</span>
            <Badge variant="secondary">{fileInfo.file_type.toUpperCase()}</Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Contains Motion Data</span>
            <Badge variant={fileInfo.contains_motion_data ? "default" : "secondary"}>
              {fileInfo.contains_motion_data ? "Yes" : "No"}
            </Badge>
          </div>
        </div>

        <Separator />

        {/* EMG Signal Information */}
        <div className="space-y-2">
          <h4 className="font-semibold flex items-center gap-2">
            <GearIcon className="h-4 w-4" />
            EMG Signal Details
          </h4>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Duration</span>
            <span className="font-medium text-right">
              {formatDuration(metadata.duration_seconds)}
              <br />
              <span className="text-xs text-muted-foreground">
                ({metadata.frame_count.toLocaleString()} samples)
              </span>
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Sampling Rate</span>
            <span className="font-medium">{formatSamplingRate(metadata.sampling_rate)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">EMG Channels</span>
            <span className="font-medium">{metadata.channel_count} channels</span>
          </div>
        </div>

        <Separator />

        {/* Game Session Information */}
        <div className="space-y-2">
          <h4 className="font-semibold flex items-center gap-2">
            <PersonIcon className="h-4 w-4" />
            Session Details
          </h4>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Game</span>
            <span className="font-medium">{metadata.game_name}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Level</span>
            <span className="font-medium">{metadata.level}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Player</span>
            <span className="font-medium">{metadata.player_name}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Therapist ID</span>
            <span className="font-medium">{metadata.therapist_id}</span>
          </div>

          {metadata.time !== 'Unknown' && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <ClockIcon className="h-3 w-3" />
                Recorded
              </span>
              <span className="font-medium text-xs">
                {new Date(metadata.time).toLocaleDateString()} {new Date(metadata.time).toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>

        {/* Processing Status */}
        {fileInfo.failure_stage && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2 text-destructive">
                <InfoCircledIcon className="h-4 w-4" />
                Processing Status
              </h4>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Failed At</span>
                <Badge variant="destructive">{fileInfo.failure_stage.replace('_', ' ')}</Badge>
              </div>
            </div>
          </>
        )}

        {/* File Size Discrepancy Warning */}
        {fileInfo.contains_motion_data && metadata.duration_seconds < 1 && (
          <>
            <Separator />
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <InfoCircledIcon className="h-4 w-4 text-amber-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Large File, Minimal EMG Data
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    This file appears to contain motion capture data but very little EMG signal data. 
                    The EMG portion is too short for analysis.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default C3DMetadataDisplay;
import React from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { getEffectiveDurationThreshold } from '@/lib/durationThreshold';

interface Props {
  muscleChannels: string[];
  disabled?: boolean;
}

const PerMuscleDurationThresholds: React.FC<Props> = ({ muscleChannels, disabled }) => {
  const { sessionParams, setSessionParams } = useSessionStore();

  const handleChange = (channel: string, seconds: number | null) => {
    setSessionParams(prev => {
      const current = prev.session_duration_thresholds_per_muscle || {};
      const next = { ...current };
      if (seconds === null) delete next[channel]; else next[channel] = seconds;
      return { session_duration_thresholds_per_muscle: next } as any;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Per-Muscle Duration Thresholds</CardTitle>
        <CardDescription>Override duration threshold per muscle (seconds). Leave unset to use backend/global.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {muscleChannels.map((ch) => {
          const effectiveMs = getEffectiveDurationThreshold(ch, sessionParams, sessionParams && (sessionParams as any).analytics?.[ch]);
          const perMuscleSec = sessionParams.session_duration_thresholds_per_muscle?.[ch] ?? null;
          const value = perMuscleSec ?? effectiveMs / 1000;
          return (
            <div key={ch} className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={`thr-${ch}`}>{ch}</Label>
                <span className="text-xs text-muted-foreground">{value.toFixed(1)}s (effective {Math.round(effectiveMs)}ms)</span>
              </div>
              <Slider
                id={`thr-${ch}`}
                min={0}
                max={10}
                step={0.5}
                value={[value]}
                onValueChange={(vals) => handleChange(ch, vals?.[0] ?? null)}
                disabled={disabled}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default PerMuscleDurationThresholds;



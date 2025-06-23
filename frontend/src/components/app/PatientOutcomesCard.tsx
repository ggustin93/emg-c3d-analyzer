import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { GameSessionParameters } from '@/types/emg';

interface PatientOutcomesCardProps {
  sessionParams: GameSessionParameters;
  onParamsChange: (params: GameSessionParameters) => void;
  disabled: boolean;
}

const PatientOutcomesCard: React.FC<PatientOutcomesCardProps> = ({
  sessionParams,
  onParamsChange,
  disabled,
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Patient Reported Outcomes</CardTitle>
        <CardDescription>
          Configure subjective metrics reported by the patient.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="subjective-fatigue">Perceived Exertion Level (0-10)</Label>
              <span className="text-sm font-medium">
                {sessionParams.subjective_fatigue_level ?? 5}
              </span>
            </div>
            <Slider
              id="subjective-fatigue"
              min={0}
              max={10}
              step={1}
              value={[sessionParams.subjective_fatigue_level ?? 5]}
              onValueChange={(values: number[]) => {
                onParamsChange({
                  ...sessionParams,
                  subjective_fatigue_level: values[0]
                });
              }}
              disabled={disabled}
              className="py-4"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>No/Very Light (0-1)</span>
              <span>Moderate (4-5)</span>
              <span>Maximum (10)</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Based on the Borg CR-10 Scale for Rating of Perceived Exertion:
              0 (rest) to 10 (maximum effort). This will eventually be extracted from C3D file metadata.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PatientOutcomesCard; 
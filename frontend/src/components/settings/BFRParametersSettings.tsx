import React, { useState } from 'react';
import { useSessionStore } from '../../store/sessionStore';
import UnifiedSettingsCard from './UnifiedSettingsCard';
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { HeartIcon, InfoCircledIcon } from '@radix-ui/react-icons';

interface BFRParametersSettingsProps {
  disabled: boolean;
  isDebugMode: boolean;
}

const BFRParametersSettings: React.FC<BFRParametersSettingsProps> = ({ disabled, isDebugMode }) => {
  const { sessionParams, setSessionParams } = useSessionStore();
  const [isBFRParametersOpen, setIsBFRParametersOpen] = useState(false);

  // Get BFR parameters or set defaults
  const bfrParams = sessionParams.bfr_parameters || {
    aop_measured: 180,
    applied_pressure: 90,
    percentage_aop: 50,
    is_compliant: true,
    application_time_minutes: 15
  };

  // Calculate percentage and compliance
  const calculateBFRMetrics = (aop: number, applied: number) => {
    const percentage = aop > 0 ? (applied / aop) * 100 : 0;
    const isCompliant = percentage >= 40 && percentage <= 60;
    return { percentage, isCompliant };
  };

  const updateBFRParameters = (field: keyof typeof bfrParams, value: number) => {
    const newParams = { ...bfrParams, [field]: value };
    
    // Recalculate percentage and compliance
    const { percentage, isCompliant } = calculateBFRMetrics(
      newParams.aop_measured, 
      newParams.applied_pressure
    );
    
    newParams.percentage_aop = percentage;
    newParams.is_compliant = isCompliant;

    setSessionParams({
      ...sessionParams,
      bfr_parameters: newParams
    });
  };

  const getComplianceStatus = () => {
    if (bfrParams.is_compliant) {
      return {
        badge: "PASS",
        color: "bg-green-100 text-green-800",
        message: "Within therapeutic range (40-60% AOP)"
      };
    } else {
      return {
        badge: "FAIL",
        color: "bg-red-100 text-red-800",
        message: bfrParams.percentage_aop > 60 ? "TOO HIGH - Risk of tissue damage" : "TOO LOW - Ineffective therapy"
      };
    }
  };

  const complianceStatus = getComplianceStatus();

  return (
    <UnifiedSettingsCard
      title="BFR Parameters"
      description={isDebugMode ? 'Blood Flow Restriction settings (editable in debug mode)' : 'BFR parameters from clinical assessment'}
      isOpen={isBFRParametersOpen}
      onOpenChange={setIsBFRParametersOpen}
      icon={<HeartIcon className="h-5 w-5 text-red-500" />}
      accentColor="red-500"
      badge={<Badge variant="outline" className={`text-xs ${complianceStatus.color}`}>{complianceStatus.badge}</Badge>}
    >
      <TooltipProvider>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-gray-700">Blood Flow Restriction</h4>
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoCircledIcon className="h-4 w-4 text-gray-500 cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="w-[300px] text-xs">
                  Blood Flow Restriction (BFR) training applies partial pressure to limbs during low-intensity exercise. 
                  The therapeutic range is 40-60% of Arterial Occlusion Pressure (AOP). 
                  Pressures outside this range may be ineffective or unsafe.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          
          <div className="p-4 bg-slate-50 rounded-lg space-y-4">
            {/* AOP Measured */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Arterial Occlusion Pressure (AOP)</Label>
                {isDebugMode ? (
                  <Input
                    type="number"
                    value={bfrParams.aop_measured}
                    onChange={(e) => updateBFRParameters('aop_measured', parseFloat(e.target.value) || 0)}
                    placeholder="180"
                    min="0"
                    max="300"
                    step="1"
                    disabled={disabled}
                    className="h-8 text-xs"
                  />
                ) : (
                  <div className="h-8 px-3 py-2 bg-white border rounded-md text-xs text-slate-500">
                    {bfrParams.aop_measured} mmHg
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">Applied Pressure</Label>
                {isDebugMode ? (
                  <Input
                    type="number"
                    value={bfrParams.applied_pressure}
                    onChange={(e) => updateBFRParameters('applied_pressure', parseFloat(e.target.value) || 0)}
                    placeholder="90"
                    min="0"
                    max="300"
                    step="1"
                    disabled={disabled}
                    className="h-8 text-xs"
                  />
                ) : (
                  <div className="h-8 px-3 py-2 bg-white border rounded-md text-xs text-slate-500">
                    {bfrParams.applied_pressure} mmHg
                  </div>
                )}
              </div>
            </div>

            {/* Application Time */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Application Time (minutes)</Label>
              {isDebugMode ? (
                <Input
                  type="number"
                  value={bfrParams.application_time_minutes || ''}
                  onChange={(e) => updateBFRParameters('application_time_minutes', parseFloat(e.target.value) || 0)}
                  placeholder="15"
                  min="0"
                  max="60"
                  step="1"
                  disabled={disabled}
                  className="h-8 text-xs"
                />
              ) : (
                <div className="h-8 px-3 py-2 bg-white border rounded-md text-xs text-slate-500">
                  {bfrParams.application_time_minutes || 'N/A'} minutes
                </div>
              )}
            </div>

            {/* Calculated Values */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-slate-600">Percentage of AOP</Label>
                <div className="h-8 px-3 py-2 bg-white border rounded-md text-xs font-medium">
                  {bfrParams.percentage_aop.toFixed(1)}%
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs text-slate-600">Compliance Status</Label>
                <div className="h-8 flex items-center">
                  <Badge className={`${complianceStatus.color} text-xs`}>
                    {complianceStatus.badge}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Status Message */}
            <div className={`p-3 rounded-md ${bfrParams.is_compliant ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className={`text-xs ${bfrParams.is_compliant ? 'text-green-800' : 'text-red-800'}`}>
                <strong>{bfrParams.is_compliant ? 'Safe:' : 'Warning:'}</strong> {complianceStatus.message}
              </p>
            </div>
          </div>
          
          {!isDebugMode && (
            <div className="p-3 bg-blue-50 rounded-md">
              <p className="text-xs text-blue-800">
                <strong>Note:</strong> BFR parameters are measured during clinical assessment and imported from the GHOSTLY+ mobile app. 
                Enable Debug Mode to manually adjust these values for testing.
              </p>
            </div>
          )}
        </div>
      </TooltipProvider>
    </UnifiedSettingsCard>
  );
};

export default BFRParametersSettings;
import React, { useState } from 'react';
import { useSessionStore } from '@/store/sessionStore';
import UnifiedSettingsCard from './UnifiedSettingsCard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HeartIcon, MixerHorizontalIcon, TargetIcon, GearIcon } from '@radix-ui/react-icons';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ClinicalTooltip, { AppliedPressureTooltip, AOPTooltip } from '@/components/ui/clinical-tooltip';

interface BFRParametersSettingsProps {
  disabled: boolean;
  isDebugMode: boolean;
}

const BFRParametersSettings: React.FC<BFRParametersSettingsProps> = ({ disabled, isDebugMode }) => {
  const { sessionParams, setSessionParams } = useSessionStore();
  const [isBFRParametersOpen, setIsBFRParametersOpen] = useState(false); // Collapsed by default

  // Get BFR parameters from session store - should always be defined due to store defaults
  const bfrParams = sessionParams.bfr_parameters;
  
  // Safety check - should not be needed with proper store defaults
  if (!bfrParams) {
    console.error('BFR parameters not found in session store - check store initialization');
    return null;
  }

  // Calculate percentage and compliance
  const calculateBFRMetrics = (aop: number, applied: number, minRange: number = 40, maxRange: number = 60) => {
    const percentage = aop > 0 ? (applied / aop) * 100 : 0;
    const isCompliant = percentage >= minRange && percentage <= maxRange;
    return { percentage, isCompliant };
  };

  const updateBFRParameters = (side: 'left' | 'right', field: string, value: number) => {
    const newParams = { ...bfrParams };
    
    // Update the specific side's parameters (including application_time_minutes)
    newParams[side] = { ...newParams[side], [field]: value };
    
    // Recalculate percentage and compliance for this side if pressure-related
    if (field !== 'application_time_minutes') {
      const { percentage, isCompliant } = calculateBFRMetrics(
        newParams[side].aop_measured, 
        newParams[side].applied_pressure,
        newParams[side].therapeutic_range_min,
        newParams[side].therapeutic_range_max
      );
      
      newParams[side].percentage_aop = percentage;
      newParams[side].is_compliant = isCompliant;
    }

    setSessionParams({
      ...sessionParams,
      bfr_parameters: newParams
    });
  };

  const getComplianceStatus = (side: 'left' | 'right') => {
    const sideParams = bfrParams[side];
    if (sideParams.is_compliant) {
      return {
        badge: "PASS",
        color: "bg-green-100 text-green-800",
        message: `Within therapeutic range (${sideParams.therapeutic_range_min}-${sideParams.therapeutic_range_max}% AOP)`
      };
    } else {
      return {
        badge: "FAIL",
        color: "bg-red-100 text-red-800",
        message: sideParams.percentage_aop > sideParams.therapeutic_range_max ? "TOO HIGH - Risk of tissue damage" : "TOO LOW - Ineffective therapy"
      };
    }
  };

  const getOverallComplianceStatus = () => {
    const leftCompliant = bfrParams.left.is_compliant;
    const rightCompliant = bfrParams.right.is_compliant;
    
    if (leftCompliant && rightCompliant) {
      return {
        badge: "PASS",
        color: "bg-green-100 text-green-800",
        message: "Both sides compliant"
      };
    } else if (!leftCompliant && !rightCompliant) {
      return {
        badge: "FAIL",
        color: "bg-red-100 text-red-800",
        message: "Both sides non-compliant"
      };
    } else {
      return {
        badge: "PARTIAL",
        color: "bg-amber-100 text-amber-800",
        message: `${leftCompliant ? 'Right' : 'Left'} needs adjustment`
      };
    }
  };

  const overallStatus = getOverallComplianceStatus();

  // Component to render parameters for one side
  const BFRSidePanel = ({ side, title, colorIndicator }: { side: 'left' | 'right', title: string, colorIndicator: string }) => {
    const sideParams = bfrParams[side];
    const complianceStatus = getComplianceStatus(side);

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <div className={`w-4 h-4 ${colorIndicator} rounded-full`}></div>
          <h4 className="text-sm font-medium text-gray-700">{title}</h4>
          <Badge variant="outline" className={`text-xs ${complianceStatus.color}`}>
            {complianceStatus.badge}
          </Badge>
        </div>
        
        <div className="space-y-6">
          {/* Measured Values Section */}
          <div className="space-y-4 p-4 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2">
              <MixerHorizontalIcon className="h-4 w-4 text-blue-600" />
              <h5 className="text-sm font-semibold text-gray-800">Measured Values</h5>
              {isDebugMode && <span className="text-xs font-normal text-gray-500">(Editable in debug mode)</span>}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">Arterial Occlusion Pressure (</Label>
                  <AOPTooltip aopValue={sideParams.aop_measured} side="top">
                    <span className="text-sm font-medium text-blue-600 cursor-help hover:text-blue-800 underline decoration-dotted">AOP</span>
                  </AOPTooltip>
                  <Label className="text-sm font-medium">)</Label>
                  <ClinicalTooltip
                    title="Arterial Occlusion Pressure (AOP)"
                    description="The minimum pressure required to completely occlude arterial blood flow to the limb"
                    sections={[
                      {
                        title: "Clinical Measurement:",
                        type: "list",
                        items: [
                          { description: "Determined using Doppler ultrasound during clinical assessment" },
                          { description: "Typically ranges 120-250 mmHg depending on limb circumference" },
                          { description: "Patient factors: age, fitness level, limb composition affect measurement" },
                          { description: "Must be measured individually for each limb due to anatomical variations" }
                        ]
                      },
                      {
                        title: "Clinical Significance:",
                        type: "list", 
                        items: [
                          { description: "Baseline for calculating therapeutic BFR pressures" },
                          { description: "Essential for safe and effective blood flow restriction training" }
                        ]
                      }
                    ]}
                    side="right"
                    triggerClassName="h-3 w-3"
                  />
                </div>
                {isDebugMode ? (
                  <Input
                    type="number"
                    value={sideParams.aop_measured}
                    onChange={(e) => updateBFRParameters(side, 'aop_measured', parseFloat(e.target.value) || 0)}
                    placeholder="180"
                    min="0"
                    max="300"
                    step="1"
                    disabled={disabled}
                    className="h-8 text-xs"
                  />
                ) : (
                  <div className="h-8 px-3 py-2 bg-white border rounded-md text-xs text-slate-500">
                    {sideParams.aop_measured} mmHg
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AppliedPressureTooltip pressureValue={sideParams.applied_pressure} side="top">
                    <span className="text-sm font-medium text-green-600 cursor-help hover:text-green-800 underline decoration-dotted">Applied</span>
                  </AppliedPressureTooltip>
                  <Label className="text-sm font-medium"> Pressure</Label>
                  <ClinicalTooltip
                    title="Applied Pressure"
                    description="The actual pressure applied to the limb during BFR training"
                    sections={[
                      {
                        title: "Clinical Formula:",
                        type: "formula",
                        items: [
                          { value: "Applied Pressure = AOP × Target Percentage" }
                        ]
                      },
                      {
                        title: "Therapeutic Range:",
                        type: "list",
                        items: [
                          { description: "Typically 40-60% of AOP for safe and effective therapy" },
                          { description: "Can be adjusted based on patient tolerance and treatment goals" },
                          { description: "Lower pressures may be used for injured or sensitive areas" },
                          { description: "Progressive increases over treatment course for adaptation" }
                        ]
                      }
                    ]}
                    side="left"
                    triggerClassName="h-3 w-3"
                  />
                </div>
                {isDebugMode ? (
                  <Input
                    type="number"
                    value={sideParams.applied_pressure}
                    onChange={(e) => updateBFRParameters(side, 'applied_pressure', parseFloat(e.target.value) || 0)}
                    placeholder="90"
                    min="0"
                    max="300"
                    step="1"
                    disabled={disabled}
                    className="h-8 text-xs"
                  />
                ) : (
                  <div className="h-8 px-3 py-2 bg-white border rounded-md text-xs text-slate-500">
                    {sideParams.applied_pressure} mmHg
                  </div>
                )}
              </div>
            </div>

            {/* Session Duration */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Session Duration</Label>
                <ClinicalTooltip
                  title={`${title} Session Duration`}
                  description="Independent application time for optimized muscle-specific therapy"
                  sections={[
                    {
                      title: "Clinical Benefits:",
                      type: "list",
                      items: [
                        { description: "Different fatigue management protocols per muscle group" },
                        { description: "Asymmetric injury accommodation and protection" },
                        { description: "Progressive training phases with individual progression" },
                        { description: "Patient tolerance optimization per limb" }
                      ]
                    },
                    {
                      title: "Typical Protocols:",
                      type: "list",
                      items: [
                        { description: "Standard sessions: 10-20 minutes with rest periods" },
                        { description: "Injured limb: Reduced duration for protection" },
                        { description: "Progressive increase: 2-5 minutes per week" }
                      ]
                    }
                  ]}
                  side="right"
                  triggerClassName="h-3 w-3"
                />
              </div>
              {isDebugMode ? (
                <Input
                  type="number"
                  value={sideParams.application_time_minutes || ''}
                  onChange={(e) => updateBFRParameters(side, 'application_time_minutes', parseFloat(e.target.value) || 0)}
                  placeholder="15"
                  min="0"
                  max="60"
                  step="1"
                  disabled={disabled}
                  className="h-8 text-xs"
                />
              ) : (
                <div className="h-8 px-3 py-2 bg-white border rounded-md text-xs text-slate-500">
                  {sideParams.application_time_minutes || 'N/A'} minutes
                </div>
              )}
            </div>
          </div>

          {/* Calculated Values Section */}
          <div className="space-y-4 p-4 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2">
              <TargetIcon className="h-4 w-4 text-green-600" />
              <h5 className="text-sm font-semibold text-gray-800">Calculated Values</h5>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-slate-600">Percentage of AOP</Label>
                  <ClinicalTooltip
                    title="BFR Percentage Calculation"
                    sections={[
                      {
                        title: "Clinical Formula:",
                        type: "formula",
                        items: [
                          { value: `${sideParams.applied_pressure} ÷ ${sideParams.aop_measured} × 100 = ${sideParams.percentage_aop.toFixed(1)}%` }
                        ]
                      },
                      {
                        title: "Therapeutic Guidelines:",
                        type: "list",
                        items: [
                          { label: "Target: 50%", description: "Optimal therapeutic effectiveness" },
                          { label: "Range: 40-60%", description: "Safe and effective therapy zone" },
                          { description: "This ratio determines both safety and therapeutic effectiveness" }
                        ]
                      }
                    ]}
                    side="top"
                    triggerClassName="h-2.5 w-2.5"
                    variant="compact"
                  />
                </div>
                <div className="h-8 px-3 py-2 bg-white border rounded-md text-xs font-medium">
                  {sideParams.percentage_aop.toFixed(1)}%
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label className="text-xs text-slate-600">Compliance Status</Label>
                  <ClinicalTooltip
                    title="BFR Compliance Status"
                    description="Real-time safety assessment based on therapeutic range compliance"
                    sections={[
                      {
                        title: "Status Indicators:",
                        type: "list",
                        items: [
                          { label: "PASS", description: "Within therapeutic range - safe and effective", color: "text-green-600" },
                          { label: "FAIL", description: "Outside safe range - adjustment required", color: "text-red-600" }
                        ]
                      },
                      {
                        title: "Clinical Importance:",
                        type: "list",
                        items: [
                          { description: "Continuous monitoring prevents unsafe pressure levels" },
                          { description: "Ensures optimal therapeutic outcomes while maintaining safety" }
                        ]
                      }
                    ]}
                    side="top"
                    triggerClassName="h-2.5 w-2.5"
                    variant="compact"
                  />
                </div>
                <div className="h-8 flex items-center">
                  <Badge className={`${complianceStatus.color} text-xs`}>
                    {complianceStatus.badge}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Status Message */}
            <div className={`p-3 rounded-md ${sideParams.is_compliant ? 'bg-green-50' : 'bg-red-50'}`}>
              <p className={`text-xs ${sideParams.is_compliant ? 'text-green-800' : 'text-red-800'}`}>
                <strong>{sideParams.is_compliant ? 'Safe:' : 'Warning:'}</strong> {complianceStatus.message}
              </p>
            </div>
          </div>

          {/* Therapeutic Range Configuration Section */}
          <div className="space-y-4 p-4 border border-purple-200 rounded-lg">
            <div className="flex items-center gap-2">
              <GearIcon className="h-4 w-4 text-purple-600" />
              <h5 className="text-sm font-semibold text-gray-800">Therapeutic Range</h5>
              <Badge variant="outline" className="text-xs bg-purple-100 text-purple-800">Customizable</Badge>
              <ClinicalTooltip
                title="Therapeutic Range Customization"
                description="Adjustable safety and effectiveness parameters for individualized treatment"
                sections={[
                  {
                    title: "Clinical Rationale:",
                    type: "list",
                    items: [
                      { description: "Standard range: 40-60% AOP for most patients" },
                      { description: "May be modified based on patient condition and clinical protocol" },
                      { description: "Lower ranges for sensitive or injured tissues" },
                      { description: "Higher ranges may be used for advanced training phases" }
                    ]
                  },
                  {
                    title: "Safety Considerations:",
                    type: "list",  
                    items: [
                      { description: "Always maintain minimum effective pressure (≥40%)" },
                      { description: "Never exceed maximum safe pressure (≤80%)" },
                      { description: "Monitor patient response and adjust accordingly" }
                    ]
                  }
                ]}
                side="right"
                triggerClassName="h-3 w-3"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-slate-600">Minimum % AOP</Label>
                <Input
                  type="number"
                  value={sideParams.therapeutic_range_min}
                  onChange={(e) => updateBFRParameters(side, 'therapeutic_range_min', parseFloat(e.target.value) || 20)}
                  min="20"
                  max="50"
                  step="1"
                  disabled={disabled}
                  className="h-8 text-xs"
                  placeholder="40"
                />
                <p className="text-xs text-gray-500">Range: 20-50% (1% increments)</p>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs text-slate-600">Maximum % AOP</Label>
                <Input
                  type="number"
                  value={sideParams.therapeutic_range_max}
                  onChange={(e) => updateBFRParameters(side, 'therapeutic_range_max', parseFloat(e.target.value) || 60)}
                  min="50"
                  max="80"
                  step="1"
                  disabled={disabled}
                  className="h-8 text-xs"
                  placeholder="60"
                />
                <p className="text-xs text-gray-500">Range: 50-80% (1% increments)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <UnifiedSettingsCard
      title="BFR Parameters"
      description="Blood Flow Restriction settings for left and right muscles with therapeutic compliance monitoring"
      isOpen={isBFRParametersOpen}
      onOpenChange={setIsBFRParametersOpen}
      icon={<HeartIcon className="h-5 w-5 text-red-600" />}
      accentColor="red-600"
      badge={<Badge variant="outline" className={`text-xs ${overallStatus.color}`}>{overallStatus.badge}</Badge>}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h4 className="text-base font-semibold text-gray-800">Blood Flow Restriction - Left & Right Monitoring</h4>
          <ClinicalTooltip
            title="BFR Independent Monitoring System"
            description="Advanced bilateral monitoring for enhanced clinical control and patient safety"
            sections={[
              {
                title: "Clinical Advantages:",
                type: "list",
                items: [
                  { description: "Each muscle group has independent pressure settings and therapeutic ranges" },
                  { description: "Accommodates asymmetric injuries and bilateral strength imbalances" },
                  { description: "Enables progressive rehabilitation with differential loading" },
                  { description: "Enhanced safety through individual compliance monitoring" }
                ]
              },
              {
                title: "Compliance Status:",
                type: "list",
                items: [
                  { label: "PASS", description: "Both sides within therapeutic range", color: "text-green-600" },
                  { label: "PARTIAL", description: "One side needs adjustment", color: "text-amber-600" },
                  { label: "FAIL", description: "Both sides outside therapeutic range", color: "text-red-600" }
                ]
              }
            ]}
            side="right"
          />
        </div>

        {/* Left/Right Muscle Tabs */}
        <Tabs defaultValue="left" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="left" className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              Left Muscle
            </TabsTrigger>
            <TabsTrigger value="right" className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              Right Muscle
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="left" className="mt-4">
            <BFRSidePanel side="left" title="Left Muscle BFR Parameters" colorIndicator="bg-blue-500" />
          </TabsContent>
          
          <TabsContent value="right" className="mt-4">
            <BFRSidePanel side="right" title="Right Muscle BFR Parameters" colorIndicator="bg-red-500" />
          </TabsContent>
        </Tabs>
      </div>
    </UnifiedSettingsCard>
  );
};

export default BFRParametersSettings;
import React from 'react';
import { useSessionStore } from '@/store/sessionStore';
import { Badge } from "@/components/ui/badge";
import ClinicalTooltip, { AppliedPressureTooltip, AOPTooltip } from "@/components/ui/clinical-tooltip";
import { CheckCircledIcon } from "@radix-ui/react-icons";

interface BFRMonitoringTabProps {
  className?: string;
}

const BFRMonitoringTab: React.FC<BFRMonitoringTabProps> = ({ className }) => {
  const { sessionParams } = useSessionStore();

  // Get BFR parameters or use defaults for display with left/right structure
  const bfrParams = sessionParams.bfr_parameters || {
    left: {
      aop_measured: 180,
      applied_pressure: 90,
      percentage_aop: 50,
      is_compliant: true,
      therapeutic_range_min: 40,
      therapeutic_range_max: 60,
      application_time_minutes: 15
    },
    right: {
      aop_measured: 180,
      applied_pressure: 90,
      percentage_aop: 50,
      is_compliant: true,
      therapeutic_range_min: 40,
      therapeutic_range_max: 60,
      application_time_minutes: 15
    }
  };

  // Get safety compliance status from database with TRUE as default fallback
  const safetyCompliant = sessionParams.bfr_monitoring?.safety_compliant ?? true;

  // TODO: Link to bfr_monitoring table to get real-time sensor data
  // TODO: Get target_aop value per patient from the database
  // Currently using hardcoded 50% as target - should be personalized per patient
  // Need to fetch from: sessionParams.bfr_monitoring?.target_aop or patient_specific_settings

  const getComplianceStatus = (side: 'left' | 'right') => {
    const sideParams = bfrParams[side];
    if (sideParams.is_compliant) {
      return {
        badge: "PASS",
        color: "bg-emerald-100 text-emerald-800 border-emerald-200",
        message: "BFR pressure is within the safe and effective therapeutic range",
        gaugeColor: "#059669"
      };
    } else {
      return {
        badge: "FAIL",
        color: "bg-red-100 text-red-800 border-red-200",
        message: sideParams.percentage_aop > 60 ? "TOO HIGH - Risk of tissue damage" : "TOO LOW - Ineffective therapy",
        gaugeColor: "#dc2626"
      };
    }
  };

  // Overall compliance status based on both sides
  const getOverallComplianceStatus = () => {
    const leftCompliant = bfrParams.left.is_compliant;
    const rightCompliant = bfrParams.right.is_compliant;
    
    if (leftCompliant && rightCompliant) {
      return {
        badge: "PASS",
        color: "bg-emerald-100 text-emerald-800 border-emerald-200",
        message: "Both left and right BFR pressures are within therapeutic range"
      };
    } else if (!leftCompliant && !rightCompliant) {
      return {
        badge: "FAIL",
        color: "bg-red-100 text-red-800 border-red-200",
        message: "Both left and right BFR pressures are outside therapeutic range"
      };
    } else {
      return {
        badge: "PARTIAL",
        color: "bg-amber-100 text-amber-800 border-amber-200",
        message: `${leftCompliant ? 'Right' : 'Left'} BFR pressure needs adjustment`
      };
    }
  };

  const overallStatus = getOverallComplianceStatus();

  // Create gauge component for reuse
  const createGaugeParams = (side: 'left' | 'right') => {
    const sideParams = bfrParams[side];
    const percentage = Math.min(Math.max(sideParams.percentage_aop, 0), 100);
    const radius = 65; // Adjusted for optimized display
    const circumference = 2 * Math.PI * radius;
    const complianceStatus = getComplianceStatus(side);
    return {
      percentage,
      radius,
      circumference,
      strokeDasharray: `${(percentage / 100) * circumference} ${circumference}`,
      complianceStatus,
      sideParams
    };
  };

  // Enhanced muscle card component with integrated session duration
  const MuscleCard = ({ side, title, colorIndicator }: { side: 'left' | 'right', title: string, colorIndicator: string }) => {
    const params = createGaugeParams(side);
    const radius = 65; // Optimized gauge size
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = `${(50 / 100) * circumference} ${circumference}`; // Fixed at 50% target
    
    return (
      <div className="bg-white rounded-xl p-6 border-2 border-gray-200 shadow-sm hover:shadow-md transition-shadow">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-5 h-5 ${colorIndicator} rounded-full`}></div>
            <h3 className="text-xl font-bold text-gray-900">{title}</h3>
            <ClinicalTooltip
              title={`${title} BFR Monitoring`}
              description="Independent pressure monitoring for enhanced clinical control and safety"
              sections={[
                {
                  title: "Clinical Advantages:",
                  type: "list",
                  items: [
                    { label: "Asymmetric treatment", description: "Different pressures for each limb based on injury patterns" },
                    { label: "Injury accommodation", description: "Reduced pressure on affected side during rehabilitation" },
                    { label: "Progressive training", description: "Gradual pressure increases per side for optimal adaptation" },
                    { label: "Safety monitoring", description: "Individual compliance checking prevents bilateral overload" }
                  ]
                }
              ]}
              side="right"
            />
          </div>
          
          {/* Status Badge */}
          <ClinicalTooltip
            title={`${side.charAt(0).toUpperCase() + side.slice(1)} Muscle BFR Compliance`}
            description={params.complianceStatus.message}
            sections={[
              {
                title: "Safety Guidelines:",
                type: "list",
                items: [
                  { label: `Below ${params.sideParams.therapeutic_range_min}%`, description: "Ineffective therapy - insufficient vascular occlusion" },
                  { label: `${params.sideParams.therapeutic_range_min}-${params.sideParams.therapeutic_range_max}%`, description: "Therapeutic range - optimal muscle adaptation stimulus" },
                  { label: `Above ${params.sideParams.therapeutic_range_max}%`, description: "Risk of tissue damage - excessive vascular occlusion" }
                ]
              }
            ]}
            side="bottom"
          >
            <div className={`${params.complianceStatus.color} px-4 py-2 text-sm font-semibold rounded-full border-2 shadow-sm cursor-help`}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${params.sideParams.is_compliant ? 'bg-emerald-600' : 'bg-red-600'}`}></div>
                {params.complianceStatus.badge}
              </div>
            </div>
          </ClinicalTooltip>
        </div>
        
        <div className="flex items-center justify-between">
           {/* Larger Gauge with color indicator */}
          <div className="relative">
            <svg width="180" height="180" className="transform -rotate-90">
              {/* Background circle */}
              <circle
                cx="90"
                cy="90"
                r={radius}
                stroke="#e5e7eb"
                strokeWidth="12"
                fill="none"
              />
              {/* Target 50% colored arc - gray tones */}
              <circle
                cx="90"
                cy="90"
                r={radius}
                stroke="#6b7280"
                strokeWidth="12"
                fill="none"
                strokeDasharray={strokeDasharray}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out opacity-80"
              />
              {/* Marker at 50% position - subtle gray */}
              <circle
                cx="90"
                cy="25"
                r="5"
                fill="#374151"
                className="drop-shadow-sm"
              />
            </svg>
            
            {/* Center text with clinical tooltip */}
            <ClinicalTooltip
              title="BFR Target Pressure"
              sections={[
                {
                  title: "Sensor Status:",
                  type: "list",
                  items: [
                    { description: "BFR sensors not automatically synchronized" },
                    { description: "Target pressure set at 50% of Arterial Occlusion Pressure (AOP)" },
                    { description: "Patient compliance based on self-reported feedback" }
                  ]
                }
              ]}
              side="top"
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center cursor-help">
                <div className="text-4xl font-bold mb-1 text-gray-700">
                  {/* TODO: Replace with dynamic target_aop from patient settings */}
                  50%
                </div>
                <div className="text-sm text-gray-600 font-semibold">of AOP</div>
                <div className="text-xs text-gray-400 mt-0.5 uppercase tracking-wide font-medium">
                  Target
                </div>
              </div>
            </ClinicalTooltip>
          </div>
          
          {/* Integrated Information Panel */}
          <div className="flex-1 ml-6 space-y-4">
            {/* Pressure Details */}
            <div className="bg-gray-50 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 00-2-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Pressure Details
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-white rounded border">
                  <div className="text-xs text-gray-600 mb-1 flex items-center justify-center gap-1">
                    <span className="text-gray-500">Applied</span>
                  </div>
                  <div className="text-lg font-bold text-gray-400">—</div>
                </div>
                <div className="text-center p-3 bg-white rounded border">
                  <div className="text-xs text-gray-600 mb-1 flex items-center justify-center gap-1">
                    <span className="text-gray-500">AOP</span>
                  </div>
                  <div className="text-lg font-bold text-gray-400">—</div>
                </div>
              </div>
            </div>
            
            {/* Session Duration - Integrated */}
            <div className="bg-gray-50 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Session Duration
                <ClinicalTooltip
                  title="Session Duration"
                  description="BFR application time for this muscle"
                  sections={[
                    {
                      title: "Clinical Rationale:",
                      type: "list",
                      items: [
                        { description: "Individual muscle fatigue management and recovery optimization" },
                        { description: "Differential therapeutic protocols based on injury severity" },
                        { description: "Patient-specific treatment progression and tolerance levels" }
                      ]
                    }
                  ]}
                  side="top"
                />
              </h4>
              <div className="text-center p-3 bg-white rounded border">
                <div className="text-2xl font-bold text-gray-400">
                  —
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Not synchronized
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`p-4 ${className}`}>
      {/* Header – compact notification with reduced spacing */}
      <div className="text-center mb-4">
        {/* Patient Compliance Status Banner - more compact */}
        <div className={`mb-3 px-4 py-2.5 rounded-lg border-2 ${
          safetyCompliant 
            ? 'bg-green-50 border-green-200' 
            : 'bg-amber-50 border-amber-300'
        }`}>
          <div className="flex items-center justify-center gap-3">
            {safetyCompliant ? (
              <>
                <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-green-800">
                  Patient-reported compliance: Procedure completed without issues
                </span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-amber-600 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-amber-800">
                  Warning: Patient reported an issue during the procedure
                </span>
              </>
            )}
            <Badge variant="outline" className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 border-gray-300">
              Manual Entry
            </Badge>
          </div>
        </div>
        
        <div className="flex items-center justify-center gap-2">
          <ClinicalTooltip
            title="GHOSTLY+ BFR Protocol"
            description="Evidence-based Blood Flow Restriction training protocol for quadriceps strengthening"
            sections={[
              {
                title: "Protocol Parameters:",
                type: "table",
                items: [
                  { label: "Target Pressure", value: "50% AOP per muscle" },
                  { label: "Exercise Protocol", value: "3 sets × 12 repetitions" },
                  { label: "Training Frequency", value: "5 sessions/week minimum" },
                  { label: "Treatment Duration", value: "2 weeks or until discharge" }
                ]
              },
              {
                title: "Independent Monitoring Benefits:",
                type: "list",
                items: [
                  { description: "Individual muscle pressure optimization based on patient anatomy and injury patterns" },
                  { description: "Enhanced safety through bilateral monitoring and compliance tracking" },
                  { description: "Progressive rehabilitation with asymmetric loading capabilities" }
                ]
              }
            ]}
            side="bottom"
          />
          <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-600">
            <CheckCircledIcon className="h-4 w-4" />
            BFR Pressure Monitoring
          </span>
        </div>
      </div>

      {/* Main Content - Two Enhanced Muscle Cards */}
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <MuscleCard side="left" title="Left Muscle" colorIndicator="bg-blue-500" />
          <MuscleCard side="right" title="Right Muscle" colorIndicator="bg-red-500" />
        </div>
        
        {/* Removed large overall status summary for a more compact layout */}
      </div>
    </div>
  );
};

export default BFRMonitoringTab;
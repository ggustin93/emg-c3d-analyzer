import React from 'react';
import { useSessionStore } from '../../store/sessionStore';
import { Badge } from "../ui/badge";
import ClinicalTooltip from "../ui/clinical-tooltip";

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
    const radius = 55; // Slightly smaller for dual display
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

  // Component to render individual gauge
  const BFRGauge = ({ side, title, colorIndicator }: { side: 'left' | 'right', title: string, colorIndicator: string }) => {
    const params = createGaugeParams(side);
    
    return (
      <div className="flex flex-col items-center space-y-4">
        <div className="flex items-center gap-2">
          <div className={`w-4 h-4 ${colorIndicator} rounded-full`}></div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
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
              },
              {
                title: "Therapeutic Benefit:",
                type: "list",
                items: [
                  { description: "Each muscle group optimized independently for maximum therapeutic benefit and safety" }
                ]
              }
            ]}
            side="right"
          />
        </div>
        
        <div className="relative">
          <svg width="140" height="140" className="transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="70"
              cy="70"
              r={params.radius}
              stroke="#e5e7eb"
              strokeWidth="8"
              fill="none"
            />
            {/* Progress arc */}
            <circle
              cx="70"
              cy="70"
              r={params.radius}
              stroke={params.complianceStatus.gaugeColor}
              strokeWidth="8"
              fill="none"
              strokeDasharray={params.strokeDasharray}
              strokeLinecap="round"
              className="transition-all duration-500 ease-in-out"
            />
            {/* Therapeutic range indicators */}
            <circle
              cx="70"
              cy="70"
              r={params.radius - 4}
              stroke="#dc2626"
              strokeWidth="2"
              fill="none"
              strokeDasharray={`${(40 / 100) * params.circumference} ${params.circumference}`}
              strokeLinecap="round"
              opacity="0.3"
            />
            <circle
              cx="70"
              cy="70"
              r={params.radius - 4}
              stroke="#059669"
              strokeWidth="3"
              fill="none"
              strokeDasharray={`${(20 / 100) * params.circumference} ${params.circumference}`}
              strokeDashoffset={`${-(40 / 100) * params.circumference}`}
              strokeLinecap="round"
              opacity="0.4"
            />
            <circle
              cx="70"
              cy="70"
              r={params.radius - 4}
              stroke="#dc2626"
              strokeWidth="2"
              fill="none"
              strokeDasharray={`${(40 / 100) * params.circumference} ${params.circumference}`}
              strokeDashoffset={`${-(60 / 100) * params.circumference}`}
              strokeLinecap="round"
              opacity="0.3"
            />
            <circle
              cx="70"
              cy="70"
              r={params.radius + 6}
              stroke="#059669"
              strokeWidth="2"
              fill="none"
              strokeDasharray="2 2"
              strokeDashoffset={`${-(50 / 100) * params.circumference}`}
              opacity="0.8"
            />
          </svg>
          
          {/* Center text with clinical tooltip */}
          <ClinicalTooltip
            title="BFR Pressure Calculation"
            sections={[
              {
                title: "Clinical Formula:",
                type: "formula",
                items: [
                  { value: `${params.sideParams.applied_pressure} mmHg ÷ ${params.sideParams.aop_measured} mmHg × 100 = ${params.percentage.toFixed(1)}%` }
                ]
              },
              {
                type: "table",
                items: [
                  { label: "Current", value: `${params.percentage.toFixed(1)}% of AOP` },
                  { label: "Target", value: "50% (optimal therapeutic)" },
                  { label: "Safe Range", value: `${params.sideParams.therapeutic_range_min}-${params.sideParams.therapeutic_range_max}%` }
                ]
              }
            ]}
            side="top"
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center cursor-help">
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {params.percentage.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500 font-medium">of AOP</div>
              <div className="text-xs text-gray-400 mt-1">
                Target: 50%
              </div>
            </div>
          </ClinicalTooltip>
        </div>
        
        {/* Status Badge with clinical tooltip */}
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
          <div className={`${params.complianceStatus.color} px-4 py-2 text-xs font-semibold rounded-full border-2 shadow-sm cursor-help`}>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${params.sideParams.is_compliant ? 'bg-emerald-600' : 'bg-red-600'}`}></div>
              {params.complianceStatus.badge}
            </div>
          </div>
        </ClinicalTooltip>
      </div>
    );
  };

  return (
    <div className={`p-6 ${className}`}>
      {/* Header with comprehensive clinical tooltip */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-3">
          <h2 className="text-2xl font-semibold text-gray-900">BFR Monitoring</h2>
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
        </div>
        <p className="text-sm text-gray-600">Blood Flow Restriction Protocol Status - Independent Left & Right Muscle Monitoring</p>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto">
        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
          {/* Dual Gauge Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <BFRGauge side="left" title="Left Muscle" colorIndicator="bg-blue-500" />
            <BFRGauge side="right" title="Right Muscle" colorIndicator="bg-red-500" />
          </div>

          {/* Detailed Information Panel */}
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Muscle Pressure Details */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="text-sm text-gray-700 font-medium mb-3 flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span>Left Muscle Pressure</span>
                  <ClinicalTooltip
                    title="Arterial Occlusion Pressure (AOP)"
                    description="The minimum pressure required to completely occlude arterial blood flow to the limb"
                    sections={[
                      {
                        title: "Clinical Measurement:",
                        type: "list",
                        items: [
                          { description: "Determined using Doppler ultrasound during clinical assessment" },
                          { description: "Typically ranges 120-250 mmHg depending on limb circumference and patient factors" },
                          { description: "Must be measured individually for each limb due to anatomical variations" }
                        ]
                      },
                      {
                        title: "Applied Pressure:",
                        type: "list",
                        items: [
                          { description: "Therapeutic pressure applied during BFR training (40-60% of AOP)" },
                          { description: "Calculated to optimize muscle adaptation while maintaining safety" },
                          { description: "Can be adjusted independently for each muscle group" }
                        ]
                      }
                    ]}
                    side="right"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Applied</div>
                    <div className="text-sm font-bold text-blue-600">{bfrParams.left.applied_pressure} mmHg</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">AOP</div>
                    <div className="text-sm font-bold text-gray-700">{bfrParams.left.aop_measured} mmHg</div>
                  </div>
                </div>
              </div>
              
              {/* Right Muscle Pressure Details */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="text-sm text-gray-700 font-medium mb-3 flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span>Right Muscle Pressure</span>
                  <ClinicalTooltip
                    title="Right Muscle Independent Settings"
                    description="Independent pressure configuration enables personalized rehabilitation protocols"
                    sections={[
                      {
                        title: "Clinical Applications:",
                        type: "list",
                        items: [
                          { description: "Compensation for dominant limb strength differences" },
                          { description: "Post-injury protection with reduced pressure protocols" },
                          { description: "Bilateral strength balancing through asymmetric loading" },
                          { description: "Progressive therapeutic advancement per individual limb tolerance" }
                        ]
                      }
                    ]}
                    side="left"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">Applied</div>
                    <div className="text-sm font-bold text-blue-600">{bfrParams.right.applied_pressure} mmHg</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">AOP</div>
                    <div className="text-sm font-bold text-gray-700">{bfrParams.right.aop_measured} mmHg</div>
                  </div>
                </div>
              </div>
              
              {/* Session Duration Comparison */}
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-3">
                    <span className="text-sm text-gray-700 font-medium">Session Duration</span>
                    <ClinicalTooltip
                      title="Independent Session Duration"
                      description="Each muscle group can have different application times for optimized therapeutic outcomes"
                      sections={[
                        {
                          title: "Clinical Rationale:",
                          type: "list",
                          items: [
                            { description: "Individual muscle fatigue management and recovery optimization" },
                            { description: "Differential therapeutic protocols based on injury severity" },
                            { description: "Patient-specific treatment progression and tolerance levels" },
                            { description: "Progressive training phases with asymmetric loading patterns" }
                          ]
                        }
                      ]}
                      side="left"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-xs text-gray-600">Left</span>
                      </div>
                      <div className="text-sm font-bold text-gray-900">{bfrParams.left.application_time_minutes || 'N/A'} min</div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span className="text-xs text-gray-600">Right</span>
                      </div>
                      <div className="text-sm font-bold text-gray-900">{bfrParams.right.application_time_minutes || 'N/A'} min</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    {(bfrParams.left.application_time_minutes || bfrParams.right.application_time_minutes) ? 'Active session' : 'Not started'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Overall Status Summary */}
          <div className="flex flex-col items-center gap-4 mt-6">
            <ClinicalTooltip
              title="Overall BFR Compliance Status"
              description={overallStatus.message}
              sections={[
                {
                  title: "Therapeutic Safety Range:",
                  type: "list",
                  items: [
                    { label: "Below 40%", description: "May be ineffective for therapeutic benefit" },
                    { label: "40-60%", description: "Therapeutic range - safe and effective" },
                    { label: "Above 60%", description: "Risk of tissue damage and complications" },
                    { label: "Target", description: "50% AOP for optimal GHOSTLY+ TBM protocol" }
                  ]
                },
                {
                  title: "Current Status:",
                  type: "table",
                  items: [
                    { 
                      label: "Left Muscle", 
                      value: `${bfrParams.left.percentage_aop.toFixed(1)}%`,
                      color: bfrParams.left.is_compliant ? "text-green-600" : "text-red-600"
                    },
                    { 
                      label: "Right Muscle", 
                      value: `${bfrParams.right.percentage_aop.toFixed(1)}%`,
                      color: bfrParams.right.is_compliant ? "text-green-600" : "text-red-600"
                    }
                  ]
                }
              ]}
              side="top"
            >
              <div className={`${overallStatus.color} px-6 py-3 text-sm font-semibold rounded-full border-2 cursor-help shadow-sm`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    overallStatus.badge === 'PASS' ? 'bg-emerald-600' : 
                    overallStatus.badge === 'FAIL' ? 'bg-red-600' : 'bg-amber-600'
                  }`}></div>
                  {overallStatus.badge}
                </div>
              </div>
            </ClinicalTooltip>
            
            {/* Safety message */}
            <div className={`text-sm text-center px-4 py-2 rounded-lg ${
              overallStatus.badge === 'PASS' ? 'bg-emerald-50 text-emerald-800' : 
              overallStatus.badge === 'FAIL' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'
            }`}>
              {overallStatus.message}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BFRMonitoringTab;
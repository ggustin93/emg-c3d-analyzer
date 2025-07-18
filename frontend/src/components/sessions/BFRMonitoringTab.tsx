import React from 'react';
import { useSessionStore } from '../../store/sessionStore';
import { Badge } from "../ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

interface BFRMonitoringTabProps {
  className?: string;
}

const BFRMonitoringTab: React.FC<BFRMonitoringTabProps> = ({ className }) => {
  const { sessionParams } = useSessionStore();

  // Get BFR parameters or use defaults for display
  const bfrParams = sessionParams.bfr_parameters || {
    aop_measured: 180,
    applied_pressure: 90,
    percentage_aop: 50,
    is_compliant: true,
    application_time_minutes: 15,
    therapeutic_range_min: 40,
    therapeutic_range_max: 60
  };

  const getComplianceStatus = () => {
    if (bfrParams.is_compliant) {
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
        message: bfrParams.percentage_aop > 60 ? "TOO HIGH - Risk of tissue damage" : "TOO LOW - Ineffective therapy",
        gaugeColor: "#dc2626"
      };
    }
  };

  const complianceStatus = getComplianceStatus();

  // Calculate gauge parameters - larger gauge
  const percentage = Math.min(Math.max(bfrParams.percentage_aop, 0), 100);
  const radius = 65; // Increased from 45
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;

  return (
    <TooltipProvider>
      <div className={`p-6 ${className}`}>
        {/* Simple Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <h2 className="text-2xl font-semibold text-gray-900">BFR Monitoring</h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="p-1 rounded-full hover:bg-gray-100 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="w-[280px] text-xs">
                  <p className="font-semibold text-blue-900 mb-2">GHOSTLY+ TBM Protocol</p>
                  <div className="space-y-1 text-blue-800">
                    <div>• Target: 50% AOP</div>
                    <div>• Protocol: 3 sets × 12 repetitions</div>
                    <div>• Frequency: 5 sessions/week minimum</div>
                    <div>• Duration: 2 weeks or until discharge</div>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-sm text-gray-600">Blood Flow Restriction Protocol Status</p>
        </div>

        {/* Main Content */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
              {/* Circular Gauge */}
              <div className="flex flex-col items-center space-y-8">
              <div className="relative">
                <svg width="160" height="160" className="transform -rotate-90">
                  {/* Background circle */}
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    stroke="#e5e7eb"
                    strokeWidth="10"
                    fill="none"
                  />
                  {/* Progress arc */}
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    stroke={complianceStatus.gaugeColor}
                    strokeWidth="10"
                    fill="none"
                    strokeDasharray={strokeDasharray}
                    strokeLinecap="round"
                    className="transition-all duration-500 ease-in-out"
                  />
                  {/* Therapeutic range indicators - improved visual clarity */}
                  {/* Danger zone (0-40%) - Red */}
                  <circle
                    cx="80"
                    cy="80"
                    r={radius - 5}
                    stroke="#dc2626"
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray={`${(40 / 100) * circumference} ${circumference}`}
                    strokeLinecap="round"
                    opacity="0.3"
                  />
                  {/* Therapeutic zone (40-60%) - Green */}
                  <circle
                    cx="80"
                    cy="80"
                    r={radius - 5}
                    stroke="#059669"
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray={`${(20 / 100) * circumference} ${circumference}`}
                    strokeDashoffset={`${-(40 / 100) * circumference}`}
                    strokeLinecap="round"
                    opacity="0.4"
                  />
                  {/* Danger zone (60-100%) - Red */}
                  <circle
                    cx="80"
                    cy="80"
                    r={radius - 5}
                    stroke="#dc2626"
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray={`${(40 / 100) * circumference} ${circumference}`}
                    strokeDashoffset={`${-(60 / 100) * circumference}`}
                    strokeLinecap="round"
                    opacity="0.3"
                  />
                  {/* Target marker (50%) */}
                  <circle
                    cx="80"
                    cy="80"
                    r={radius + 8}
                    stroke="#059669"
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray="3 3"
                    strokeDashoffset={`${-(50 / 100) * circumference}`}
                    opacity="0.8"
                  />
                </svg>
                
                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {percentage.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-500 font-medium">of AOP</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Target: 50%
                  </div>
                </div>
              </div>

              {/* Pressure Values - Improved grouping and clarity */}
              <div className="bg-gray-50 rounded-lg p-4 w-full">
                <div className="grid grid-cols-3 gap-4 text-center">
                  {/* Applied Pressure and AOP grouped visually */}
                  <div className="col-span-2">
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="text-xs text-gray-600 font-medium mb-2 flex items-center justify-center gap-1">
                        <span>Pressure Relationship</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-gray-400 hover:text-gray-600 cursor-help transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="w-[300px] text-xs">
                              <p className="font-semibold text-gray-900 mb-2">Pressure Relationship</p>
                              <p className="text-gray-700 mb-2">Applied pressure is calculated as a percentage of the measured AOP (Arterial Occlusion Pressure).</p>
                              <p className="text-gray-700">Current: {bfrParams.applied_pressure} mmHg ÷ {bfrParams.aop_measured} mmHg = {percentage.toFixed(1)}%</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="text-center">
                          <div className="text-xs text-gray-600 mb-1">Applied Pressure</div>
                          <div className="text-lg font-bold text-blue-600">{bfrParams.applied_pressure} mmHg</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-600 mb-1">
                            Full AOP
                            <div className="text-xs text-gray-400 font-normal">(Arterial Occlusion Pressure)</div>
                          </div>
                          <div className="text-lg font-bold text-gray-700">{bfrParams.aop_measured} mmHg</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Application Time with context */}
                  <div>
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <span className="text-xs text-gray-700 font-medium">Session Duration</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-gray-400 hover:text-gray-600 cursor-help transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="w-[250px] text-xs">
                            <p className="font-semibold text-gray-900 mb-1">Session Duration</p>
                            <p className="text-gray-700">Total time elapsed in current BFR session. Typical sessions last 10-20 minutes with rest periods between sets.</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="text-lg font-bold text-gray-900">{bfrParams.application_time_minutes || 'N/A'} min</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {bfrParams.application_time_minutes ? 'Elapsed' : 'Not started'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Badge with Info - Improved non-clickable appearance */}
              <div className="flex flex-col items-center gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`${complianceStatus.color} px-6 py-3 text-sm font-semibold rounded-full border-2 cursor-help shadow-sm`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${bfrParams.is_compliant ? 'bg-emerald-600' : 'bg-red-600'}`}></div>
                        {complianceStatus.badge}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="w-[320px] text-xs">
                      <p className="font-semibold text-gray-900 mb-3">{complianceStatus.message}</p>
                      <div className="space-y-2 text-gray-700">
                        <div className="p-2 bg-emerald-50 rounded border border-emerald-200">
                          <strong className="text-emerald-800">Therapeutic Range:</strong> 40-60% of AOP
                        </div>
                        <div>• Below 40%: May be ineffective for therapeutic benefit</div>
                        <div>• Above 60%: Risk of tissue damage and complications</div>
                        <div>• Target for GHOSTLY+ TBM: 50% AOP</div>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
                
                {/* Safety message */}
                <div className={`text-xs text-center px-4 py-2 rounded-lg ${bfrParams.is_compliant ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                  {complianceStatus.message}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default BFRMonitoringTab;
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDownIcon, MixerHorizontalIcon, GearIcon } from '@radix-ui/react-icons';
import { ScoringWeights } from '@/types/emg';
import { getComponentColors } from '@/utils/performanceColors';

interface PerformanceEquationProps {
  weights: ScoringWeights;
  compact?: boolean;
  showSettingsLink?: boolean;
}

const PerformanceEquation: React.FC<PerformanceEquationProps> = ({ weights, compact = false, showSettingsLink = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const componentColors = getComponentColors();

  const EquationComponent = () => (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100">
      {/* Interactive Equation */}
      <div className="flex flex-wrap items-center gap-2 mb-4 text-sm font-mono">
        <span className="font-bold text-gray-800 text-base">P<sub>overall</sub> =</span>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className={`${componentColors.completion.text} ${componentColors.completion.hover} px-2 py-1 rounded transition-colors cursor-help font-medium`}>
              w₁ · S<sub>completion</sub>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <div>
                <p className="font-semibold text-blue-900 mb-2">{componentColors.completion.name}</p>
                <p className="text-sm text-blue-800 mb-2">{componentColors.completion.description}</p>
                <div className="bg-blue-50 p-2 rounded text-xs space-y-1">
                  <p><strong>Current weight:</strong> {(weights.completion * 100).toFixed(0)}%</p>
                  <p><strong>Formula:</strong> (C<sub>left</sub>/E<sub>left</sub> + C<sub>right</sub>/E<sub>right</sub>) ÷ 2</p>
                  <p><strong>Example:</strong> 12/12 + 12/12 = 100%</p>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
          
          <span className="text-gray-500 font-normal">+</span>
          
          <Tooltip>
            <TooltipTrigger className={`${componentColors.mvcQuality.text} ${componentColors.mvcQuality.hover} px-2 py-1 rounded transition-colors cursor-help font-medium`}>
              w₂ · S<sub>MVC</sub>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <div>
                <p className="font-semibold text-emerald-900 mb-2">{componentColors.mvcQuality.name}</p>
                <p className="text-sm text-emerald-800 mb-2">{componentColors.mvcQuality.description}</p>
                <div className="bg-emerald-50 p-2 rounded text-xs space-y-1">
                  <p><strong>Current weight:</strong> {(weights.mvcQuality * 100).toFixed(0)}%</p>
                  <p><strong>Threshold:</strong> ≥75% of Maximum Voluntary Contraction</p>
                  <p><strong>Clinical importance:</strong> Ensures therapeutic intensity</p>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
          
          <span className="text-gray-500 font-normal">+</span>
          
          <Tooltip>
            <TooltipTrigger className={`${componentColors.qualityThreshold.text} ${componentColors.qualityThreshold.hover} px-2 py-1 rounded transition-colors cursor-help font-medium`}>
              w₃ · S<sub>quality</sub>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <div>
                <p className="font-semibold text-amber-900 mb-2">{componentColors.qualityThreshold.name}</p>
                <p className="text-sm text-amber-800 mb-2">{componentColors.qualityThreshold.description}</p>
                <div className="bg-amber-50 p-2 rounded text-xs space-y-1">
                  <p><strong>Current weight:</strong> {(weights.qualityThreshold * 100).toFixed(0)}%</p>
                  <p><strong>Default threshold:</strong> ≥2000ms (2 seconds)</p>
                  <p><strong>Adaptive:</strong> Increases with patient progress</p>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
          
          <span className="text-gray-500 font-normal">+</span>
          
          <Tooltip>
            <TooltipTrigger className={`${componentColors.symmetry.text} ${componentColors.symmetry.hover} px-2 py-1 rounded transition-colors cursor-help font-medium`}>
              w₄ · S<sub>symmetry</sub>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <div>
                <p className="font-semibold text-purple-900 mb-2">{componentColors.symmetry.name}</p>
                <p className="text-sm text-purple-800 mb-2">{componentColors.symmetry.description}</p>
                <div className="bg-purple-50 p-2 rounded text-xs space-y-1">
                  <p><strong>Current weight:</strong> {(weights.symmetry * 100).toFixed(0)}%</p>
                  <p><strong>Formula:</strong> (1 - |S<sub>left</sub> - S<sub>right</sub>|/(S<sub>left</sub> + S<sub>right</sub>)) × 100</p>
                  <p><strong>Goal:</strong> Prevent compensation patterns</p>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
          
          <span className="text-gray-500 font-normal">+</span>
          
          <Tooltip>
            <TooltipTrigger className={`${componentColors.effort.text} ${componentColors.effort.hover} px-2 py-1 rounded transition-colors cursor-help font-medium`}>
              w₅ · S<sub>effort</sub>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <div>
                <p className="font-semibold text-red-900 mb-2">{componentColors.effort.name}</p>
                <p className="text-sm text-red-800 mb-2">{componentColors.effort.description}</p>
                <div className="bg-red-50 p-2 rounded text-xs space-y-1">
                  <p><strong>Current weight:</strong> {(weights.effort * 100).toFixed(0)}%</p>
                  <p><strong>Scale:</strong> Borg CR10 (0-10 rating)</p>
                  <p><strong>Optimal range:</strong> +2 to +4 points change</p>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
          
          {weights.gameScore > 0 && (
            <>
              <span className="text-gray-500 font-normal">+</span>
              <Tooltip>
                <TooltipTrigger className={`${componentColors.gameScore.text} ${componentColors.gameScore.hover} px-2 py-1 rounded transition-colors cursor-help font-medium`}>
                  w₆ · S<sub>game</sub>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <div>
                    <p className="font-semibold text-gray-900 mb-2">{componentColors.gameScore.name}</p>
                    <p className="text-sm text-gray-800 mb-2">{componentColors.gameScore.description}</p>
                    <div className="bg-gray-50 p-2 rounded text-xs space-y-1">
                      <p><strong>Current weight:</strong> {(weights.gameScore * 100).toFixed(0)}%</p>
                      <p className="text-amber-600"><strong>Status:</strong> ⚠️ Under development</p>
                      <p><strong>Note:</strong> Use with caution in clinical settings</p>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </TooltipProvider>
      </div>
      
      {/* Structured Information */}
      <div className="bg-white rounded-lg p-3 border border-blue-200 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div>
            <h4 className="font-semibold text-gray-800 mb-1 flex items-center gap-1">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              Weights
            </h4>
            <p className="text-gray-600">Σwᵢ = 1.00 (Sum equals 100%)</p>
          </div>
          <div>
            <h4 className="font-semibold text-gray-800 mb-1 flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Clinical Ranges
            </h4>
            <div className="space-y-1 text-gray-600">
              <p>• 70-100%: Good to Excellent</p>
              <p>• 50-69%: Needs Improvement</p>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-gray-800 mb-1 flex items-center gap-1">
              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
              Adaptation
            </h4>
            <p className="text-gray-600">Real-time threshold adjustment based on patient progress</p>
          </div>
        </div>
        
        {/* Settings Link */}
        {showSettingsLink && (
          <div className="pt-2 border-t border-blue-200">
            <button className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded transition-colors">
              <GearIcon className="h-3 w-3" />
              Adjust scoring weights
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (compact) {
    return (
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between">
            <div className="flex items-center gap-2">
              <MixerHorizontalIcon className="h-4 w-4" />
              <span className="text-sm">Performance Equation</span>
              <Badge variant="outline" className="text-xs">Mathematical</Badge>
            </div>
            <ChevronDownIcon className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4">
          <EquationComponent />
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <Card className="border-2 border-blue-100 bg-blue-50/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-800">
          <MixerHorizontalIcon className="h-5 w-5" />
          Performance Scoring Equation
          <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800">
            Mathematical Model
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <EquationComponent />
      </CardContent>
    </Card>
  );
};

export default PerformanceEquation;
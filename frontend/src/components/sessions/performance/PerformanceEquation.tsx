import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDownIcon, MixerHorizontalIcon, GearIcon } from '@radix-ui/react-icons';
import { ScoringWeights } from '@/types/emg';
import { getComponentColors } from '@/utils/performanceColors';
import { useSessionStore } from '@/store/sessionStore';

interface PerformanceEquationProps {
  weights: ScoringWeights;
  compact?: boolean;
  showSettingsLink?: boolean;
}

const PerformanceEquation: React.FC<PerformanceEquationProps> = ({ weights, compact = false, showSettingsLink = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { sessionParams } = useSessionStore();
  const componentColors = getComponentColors(sessionParams);

  const EquationComponent = () => (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100">
      {/* Interactive Equation */}
      <div className="flex flex-wrap items-center gap-2 mb-4 text-sm font-mono">
        <span className="font-bold text-gray-800 text-base">P<sub>overall</sub> =</span>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className={`text-green-600 hover:text-green-700 hover:bg-green-50 px-2 py-1 rounded transition-colors cursor-help font-medium`}>
              w<sub>c</sub> · S<sub>compliance</sub>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <div>
                <p className="font-semibold text-green-900 mb-2">Therapeutic Compliance</p>
                <p className="text-sm text-green-800 mb-2">Composite measure of exercise execution quality</p>
                <div className="bg-green-50 p-2 rounded text-xs space-y-1">
                  <p><strong>Current weight:</strong> {(weights.compliance * 100).toFixed(0)}%</p>
                  <p><strong>Components:</strong> Completion + Intensity (≥75% MVC) + Duration (≥2s)</p>
                  <p><strong>Safety Gate:</strong> BFR must be within 45-55% AOP</p>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
          
          <span className="text-gray-500 font-normal">+</span>
          
          
          <Tooltip>
            <TooltipTrigger className={`${componentColors.symmetry.text} ${componentColors.symmetry.hover} px-2 py-1 rounded transition-colors cursor-help font-medium`}>
              w<sub>s</sub> · S<sub>symmetry</sub>
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
              w<sub>e</sub> · S<sub>effort</sub>
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
                  w<sub>g</sub> · S<sub>game</sub>
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
      
      {/* Clinical Note */}
      <div className="mt-3 p-3 bg-gradient-to-r from-green-50 to-blue-50 rounded border border-green-200">
        <div className="text-xs text-gray-700">
          <span className="font-medium text-green-800">📊 Clinical Validation:</span> 
          <span className="ml-1">Default weights are research-determined for the GHOSTLY+ TBM clinical trial. Weights are adjustable based on therapeutic goals and patient population.</span>
        </div>
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
        <CardTitle className="flex items-center gap-2 text-blue-800 text-sm">
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
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
    <div className="py-2">
      {/* LaTeX-style Interactive Equation */}
      <div className="flex flex-wrap items-center gap-3 mb-4 text-lg font-serif">
        <span className="font-bold text-gray-900 text-xl italic">P<sub className="text-base">overall</sub> =</span>
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className={`text-green-600 hover:text-green-700 hover:bg-green-50 px-2 py-1 rounded transition-colors cursor-help font-medium italic`}>
              w<sub className="text-sm">c</sub> · S<sub className="text-sm">compliance</sub>
            </TooltipTrigger>
            <TooltipContent className="max-w-md">
              <div>
                <p className="font-semibold text-green-900 mb-2">Therapeutic Compliance</p>
                <p className="text-sm text-green-800 mb-2">Composite measure of exercise execution quality</p>
                
                {/* LaTeX Formula */}
                <div className="bg-green-100 p-3 rounded text-xs font-mono mb-2">
                  <p className="font-semibold mb-1">Formula:</p>
                  <p>S<sub>compliance</sub> = ((S<sub>comp</sub><sup>left</sup> + S<sub>comp</sub><sup>right</sup>)/2) × C<sub>BFR</sub></p>
                  <p className="mt-1">S<sub>comp</sub><sup>muscle</sup> = w<sub>comp</sub>·R<sub>comp</sub> + w<sub>int</sub>·R<sub>int</sub> + w<sub>dur</sub>·R<sub>dur</sub></p>
                </div>
                
                <div className="bg-green-50 p-2 rounded text-xs space-y-1">
                  <p><strong>Current weight:</strong> {(weights.compliance * 100).toFixed(0)}%</p>
                  <p><strong>Components:</strong> Completion + Intensity (≥75% MVC) + Duration (≥2s)</p>
                  <p><strong>BFR Safety Gate:</strong> C<sub>BFR</sub> = 1.0 if pressure ∈ [45%, 55%] AOP, else 0.0</p>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
          
          <span className="text-gray-600 font-serif text-lg mx-1">+</span>
          
          <Tooltip>
            <TooltipTrigger className={`${componentColors.symmetry.text} ${componentColors.symmetry.hover} px-2 py-1 rounded transition-colors cursor-help font-medium italic`}>
              w<sub className="text-sm">s</sub> · S<sub className="text-sm">symmetry</sub>
            </TooltipTrigger>
            <TooltipContent className="max-w-md">
              <div>
                <p className="font-semibold text-purple-900 mb-2">{componentColors.symmetry.name}</p>
                <p className="text-sm text-purple-800 mb-2">{componentColors.symmetry.description}</p>
                
                {/* LaTeX Formula */}
                <div className="bg-purple-100 p-3 rounded text-xs font-mono mb-2">
                  <p className="font-semibold mb-1">Formula:</p>
                  <p>S<sub>symmetry</sub> = (1 - |S<sub>comp</sub><sup>left</sup> - S<sub>comp</sub><sup>right</sup>|/(S<sub>comp</sub><sup>left</sup> + S<sub>comp</sub><sup>right</sup>)) × 100</p>
                </div>
                
                <div className="bg-purple-50 p-2 rounded text-xs space-y-1">
                  <p><strong>Current weight:</strong> {(weights.symmetry * 100).toFixed(0)}%</p>
                  <p><strong>Range:</strong> 0-100% (100% = perfect symmetry)</p>
                  <p><strong>Goal:</strong> Prevent compensation patterns and promote bilateral muscle development</p>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
          
          <span className="text-gray-600 font-serif text-lg mx-1">+</span>
          
          <Tooltip>
            <TooltipTrigger className={`${componentColors.effort.text} ${componentColors.effort.hover} px-2 py-1 rounded transition-colors cursor-help font-medium italic`}>
              w<sub className="text-sm">e</sub> · S<sub className="text-sm">effort</sub>
            </TooltipTrigger>
            <TooltipContent className="max-w-md">
              <div>
                <p className="font-semibold text-red-900 mb-2">{componentColors.effort.name}</p>
                <p className="text-sm text-red-800 mb-2">{componentColors.effort.description}</p>
                
                {/* LaTeX Formula */}
                <div className="bg-red-100 p-3 rounded text-xs font-mono mb-2">
                  <p className="font-semibold mb-1">Formula (Piecewise):</p>
                  <p>S<sub>effort</sub> = 100% if RPE<sub>post</sub> ∈ [4,6] (optimal)</p>
                  <p className="ml-4">= 80% if RPE<sub>post</sub> ∈ {'{3,7}'} (acceptable)</p>
                  <p className="ml-4">= 60% if RPE<sub>post</sub> ∈ {'{2,8}'} (suboptimal)</p>
                  <p className="ml-4">= 20% if RPE<sub>post</sub> ∈ {'{0,1,9,10}'} (poor)</p>
                </div>
                
                <div className="bg-red-50 p-2 rounded text-xs space-y-1">
                  <p><strong>Current weight:</strong> {(weights.effort * 100).toFixed(0)}%</p>
                  <p><strong>Scale:</strong> Borg CR10 (0-10 rating of perceived exertion)</p>
                  <p><strong>Target Zone:</strong> RPE 4-6 (moderate to hard intensity)</p>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
          
          {weights.gameScore > 0 && (
            <>
              <span className="text-gray-600 font-serif text-lg mx-1">+</span>
              <Tooltip>
                <TooltipTrigger className={`${componentColors.gameScore.text} ${componentColors.gameScore.hover} px-2 py-1 rounded transition-colors cursor-help font-medium italic`}>
                  w<sub className="text-sm">g</sub> · S<sub className="text-sm">game</sub>
                </TooltipTrigger>
                <TooltipContent className="max-w-md">
                  <div>
                    <p className="font-semibold text-gray-900 mb-2">{componentColors.gameScore.name}</p>
                    <p className="text-sm text-gray-800 mb-2">{componentColors.gameScore.description}</p>
                    
                    {/* LaTeX Formula */}
                    <div className="bg-gray-100 p-3 rounded text-xs font-mono mb-2">
                      <p className="font-semibold mb-1">Formula:</p>
                      <p>S<sub>game</sub> = (game points achieved / max achievable points) × 100</p>
                      <p className="mt-1 text-xs text-gray-600">*Max points adapt via Dynamic Difficulty Adjustment (DDA)</p>
                    </div>
                    
                    <div className="bg-gray-50 p-2 rounded text-xs space-y-1">
                      <p><strong>Current weight:</strong> {(weights.gameScore * 100).toFixed(0)}%</p>
                      <p className="text-amber-600"><strong>Status:</strong> ⚠️ Under development</p>
                      <p><strong>Note:</strong> Game mechanics vary by GHOSTLY game version</p>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </TooltipProvider>
      </div>
      
      {/* Clinical Note */}
      <div className="mt-4 p-3 bg-amber-50 rounded border border-amber-200">
        <div className="text-xs text-gray-700">
          <span className="font-medium text-amber-800">🧪 Experimental Framework:</span> 
          <span className="ml-1">This performance scoring system is experimental and fully customizable by therapists based on therapeutic goals. Game performance defaults to 0% (depends on game mechanics). The goal is to provide flexible assessment adapted to specific rehabilitation objectives.</span>
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

  return <EquationComponent />;
};

export default PerformanceEquation;
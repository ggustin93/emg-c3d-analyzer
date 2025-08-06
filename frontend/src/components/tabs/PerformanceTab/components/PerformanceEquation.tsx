import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDownIcon, MixerHorizontalIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { ClinicalTooltip } from '@/components/ui/clinical-tooltip';
import { ScoringWeights } from '@/types/emg';
import { getComponentColors } from '@/lib/performanceColors';
import { useSessionStore } from '@/store/sessionStore';
import { cn } from '@/lib/utils';

interface PerformanceEquationProps {
  weights: ScoringWeights;
  compact?: boolean;
  showSettingsLink?: boolean;
}

const PerformanceEquation: React.FC<PerformanceEquationProps> = ({ 
  weights, 
  compact = false, 
  showSettingsLink = false 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { sessionParams } = useSessionStore();
  const componentColors = getComponentColors(sessionParams);

  // Enhanced tooltip data for each component
  const getComplianceTooltipData = () => ({
    title: "Therapeutic Compliance (Scompliance)",
    description: "Composite measure of exercise execution quality with BFR safety gating",
    sections: [
      {
        title: "Formula Breakdown",
        type: "formula" as const,
        items: [
          { 
            label: "S<sub>compliance</sub> =", 
            value: "((S<sub>comp</sub><sup>left</sup> + S<sub>comp</sub><sup>right</sup>)/2) × C<sub>BFR</sub>",
            color: "text-green-700"
          }
        ]
      },
      {
        title: "Component Weights",
        type: "table" as const,
        items: [
          { label: "Completion Rate", value: "33.3", color: "text-green-700 bg-green-100" },
          { label: "Intensity (≥75% MVC)", value: "33.3", color: "text-green-700 bg-green-100" },
          { label: "Duration (≥2.0s)", value: "33.3", color: "text-green-700 bg-green-100" }
        ]
      },
      {
        title: "Safety Gate",
        type: "list" as const,
        items: [
          { 
            label: "BFR Compliance", 
            description: "CBFR = 1.0 if pressure ∈ [45%, 55%] AOP, else 0.0",
            color: "text-amber-600"
          }
        ]
      },
      {
        title: "Current Configuration",
        type: "table" as const,
        items: [
          { label: "Overall Weight", value: (weights.compliance * 100).toFixed(0), color: "text-slate-800 bg-slate-100" }
        ]
      }
    ]
  });

  const getSymmetryTooltipData = () => ({
    title: "Muscle Symmetry (Ssymmetry)",
    description: "Measures bilateral muscle activation balance to prevent compensation patterns",
    sections: [
      {
        title: "Formula",
        type: "formula" as const,
        items: [
          { 
            label: "S<sub>symmetry</sub> =", 
            value: "(1 - |S<sub>comp</sub><sup>left</sup> - S<sub>comp</sub><sup>right</sup>|/(S<sub>comp</sub><sup>left</sup> + S<sub>comp</sub><sup>right</sup>)) × 100",
            color: "text-purple-700"
          }
        ]
      },
      {
        title: "Clinical Significance",
        type: "list" as const,
        items: [
          { label: "Range", description: "0-100% (100% = perfect symmetry)" },
          { label: "Goal", description: "Prevent compensation patterns and promote bilateral development" },
          { label: "Threshold", description: "≥80% indicates good bilateral balance" }
        ]
      },
      {
        title: "Current Configuration",
        type: "table" as const,
        items: [
          { label: "Weight", value: (weights.symmetry * 100).toFixed(0), color: "text-slate-800 bg-slate-100" }
        ]
      }
    ]
  });

  const getEffortTooltipData = () => ({
    title: "Subjective Effort (Seffort)",
    description: "Patient-reported exertion using validated Borg CR10 scale",
    sections: [
      {
        title: "Scoring Algorithm",
        type: "list" as const,
        items: [
          { percentage: "100", label: "RPE 4-6", description: "Optimal therapeutic stimulus", color: "text-emerald-600" },
          { percentage: "80", label: "RPE 3,7", description: "Acceptable range", color: "text-green-600" },
          { percentage: "60", label: "RPE 2,8", description: "Suboptimal stimulus", color: "text-yellow-600" },
          { percentage: "20", label: "RPE 0,1,9,10", description: "Poor - too easy/hard", color: "text-red-600" }
        ]
      },
      {
        title: "Clinical Context",
        type: "list" as const,
        items: [
          { label: "Scale", description: "Borg CR10 (0-10 rating of perceived exertion)" },
          { label: "Target", description: "RPE 4-6 for moderate to hard therapeutic intensity" },
          { label: "Assessment", description: "Post-session RPE only (most reliable)" }
        ]
      },
      {
        title: "Current Configuration",
        type: "table" as const,
        items: [
          { label: "Weight", value: (weights.effort * 100).toFixed(0), color: "text-slate-800 bg-slate-100" }
        ]
      }
    ]
  });

  const getGameScoreTooltipData = () => ({
    title: "Game Performance (Sgame)",
    description: "Experimental component based on GHOSTLY game mechanics - use with caution",
    sections: [
      {
        title: "Formula",
        type: "formula" as const,
        items: [
          { 
            label: "S<sub>game</sub> =", 
            value: "(game points achieved / max achievable points) × 100",
            color: "text-gray-700"
          }
        ]
      },
      {
        title: "Current Game Scoring Systems",
        type: "list" as const,
        items: [
          { 
            label: "🎯 Maze Game", 
            description: "Score = Stars collected - Enemy collision penalties (20 stars/level, 2 enemies × 3pts penalty). Indicates gameplay smoothness/speed." 
          },
          { 
            label: "🚀 Original Games", 
            description: "Different scoring mechanisms originally designed as gamification elements with no direct correlation to exercise performance." 
          }
        ]
      },
      {
        title: "Clinical Recommendation",
        type: "list" as const,
        items: [
          { 
            label: "Primary Guidance", 
            description: "Set weight to 0% unless game score directly correlates with therapeutic objectives",
            color: "text-amber-600"
          },
          { 
            label: "Future Development", 
            description: "Future versions may redesign scoring to reflect contraction performance" 
          }
        ]
      },
      {
        title: "Current Configuration",
        type: "table" as const,
        items: [
          { label: "Weight", value: (weights.gameScore * 100).toFixed(0), color: "text-slate-800 bg-slate-100" },
          { label: "Status", value: "⚠️ Experimental", color: "text-amber-700 bg-amber-100" }
        ]
      },
      {
        title: "Research Attribution",
        type: "list" as const,
        items: [
          { 
            label: "Source", 
            description: "Research insight from Katarina Kostkova, GHOSTLY+ Team",
            color: "text-slate-600"
          }
        ]
      }
    ]
  });

  const EquationComponent = () => (
    <div className="py-4">
      {/* Enhanced Mathematical Equation */}
      <div className="flex flex-wrap items-center justify-center gap-4 mb-6 p-4">
        <span className="font-bold text-slate-900 text-2xl font-serif italic tracking-wide">
          P<sub className="text-lg">overall</sub> <span className="mx-2 text-amber-600">=</span>
        </span>
        
        {/* Therapeutic Compliance Term */}
        <ClinicalTooltip {...getComplianceTooltipData()}>
          <button className={cn(
            "px-3 py-2 rounded-lg transition-all duration-200 font-serif italic text-lg font-medium",
            "text-green-700 hover:text-green-800 bg-green-100 hover:bg-green-200",
            "border border-green-300 hover:border-green-400 hover:shadow-md",
            "focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
          )}>
            w<sub className="text-sm">c</sub> · S<sub className="text-sm">compliance</sub>
          </button>
        </ClinicalTooltip>
        
        <span className="text-amber-600 font-serif text-xl mx-1">+</span>
        
        {/* Muscle Symmetry Term */}
        <ClinicalTooltip {...getSymmetryTooltipData()}>
          <button className={cn(
            "px-3 py-2 rounded-lg transition-all duration-200 font-serif italic text-lg font-medium",
            "text-purple-700 hover:text-purple-800 bg-purple-100 hover:bg-purple-200",
            "border border-purple-300 hover:border-purple-400 hover:shadow-md",
            "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50"
          )}>
            w<sub className="text-sm">s</sub> · S<sub className="text-sm">symmetry</sub>
          </button>
        </ClinicalTooltip>
        
        <span className="text-amber-600 font-serif text-xl mx-1">+</span>
        
        {/* Subjective Effort Term */}
        <ClinicalTooltip {...getEffortTooltipData()}>
          <button className={cn(
            "px-3 py-2 rounded-lg transition-all duration-200 font-serif italic text-lg font-medium",
            "text-red-700 hover:text-red-800 bg-red-100 hover:bg-red-200",
            "border border-red-300 hover:border-red-400 hover:shadow-md",
            "focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50"
          )}>
            w<sub className="text-sm">e</sub> · S<sub className="text-sm">effort</sub>
          </button>
        </ClinicalTooltip>
        
        {/* Game Score Term (conditional) */}
        {weights.gameScore > 0 && (
          <>
            <span className="text-amber-600 font-serif text-xl mx-1">+</span>
            <ClinicalTooltip {...getGameScoreTooltipData()}>
              <button className={cn(
                "px-3 py-2 rounded-lg transition-all duration-200 font-serif italic text-lg font-medium",
                "text-gray-700 hover:text-gray-800 bg-gray-100 hover:bg-gray-200",
                "border border-gray-300 hover:border-gray-400 hover:shadow-md",
                "focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50",
                "relative"
              )}>
                w<sub className="text-sm">g</sub> · S<sub className="text-sm">game</sub>
                <Badge 
                  variant="outline" 
                  className="absolute -top-2 -right-2 bg-amber-100 text-amber-700 border-amber-300 text-xs"
                >
                  Experimental
                </Badge>
              </button>
            </ClinicalTooltip>
          </>
        )}
      </div>

      {/* Experimental Framework Info */}
      <div className="mt-4 flex items-center justify-center">
        <ClinicalTooltip
          title="Experimental Framework"
          description="This performance scoring system is experimental and fully customizable by therapists based on therapeutic goals."
          sections={[
            {
              title: "Framework Status",
              type: "list" as const,
              items: [
                { 
                  label: "Customization", 
                  description: "Fully customizable by therapists based on therapeutic goals" 
                },
                { 
                  label: "Game Performance", 
                  description: "Defaults to 0% (depends on game mechanics)" 
                },
                { 
                  label: "Purpose", 
                  description: "Provide flexible assessment adapted to specific rehabilitation objectives" 
                }
              ]
            }
          ]}
          variant="compact"
        >
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 px-3 text-amber-600 hover:text-amber-700 hover:bg-amber-50 transition-colors"
          >
            <InfoCircledIcon className="h-4 w-4 mr-1" />
            <span className="text-xs font-medium">Experimental Framework</span>
          </Button>
        </ClinicalTooltip>
      </div>
    </div>
  );

  if (compact) {
    return (
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full justify-between hover:bg-amber-50">
            <div className="flex items-center gap-2">
              <MixerHorizontalIcon className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium">Performance Equation</span>
              <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-300">
                Mathematical
              </Badge>
            </div>
            <ChevronDownIcon 
              className={cn(
                "h-4 w-4 transition-transform text-amber-600",
                isExpanded && "rotate-180"
              )} 
            />
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
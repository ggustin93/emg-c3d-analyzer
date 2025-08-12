import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { StarIcon, ChevronDownIcon } from '@radix-ui/react-icons';
import ClinicalTooltip from '@/components/ui/clinical-tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useScoreColors } from '@/hooks/useScoreColors';
import { useSessionStore } from '@/store/sessionStore';
import { ScoringWeights } from '@/types/emg';
import { DEFAULT_SCORING_WEIGHTS } from '@/hooks/useEnhancedPerformanceMetrics';
import SubjectiveFatigueCard from './SubjectiveFatigueCard';
import MuscleSymmetryCard from './MuscleSymmetryCard';
import GHOSTLYGameCard from './GHOSTLYGameCard';

interface OverallPerformanceCardProps {
  totalScore: number;
  scoreLabel: string;
  scoreTextColor: string;
  scoreBgColor: string;
  scoreHexColor: string;
  muscleCount: number;
  symmetryScore?: number;
  subjectiveFatigueLevel?: number;
  averageContractionTime?: number; // in milliseconds
  totalContractions?: number;
  goodContractions?: number;
  expectedContractions?: number;
  // GHOSTLY Game data
  gameScore?: number;
  gameLevel?: number;
  // Therapeutic Compliance data
  therapeuticComplianceScore?: number;
  leftMuscleScore?: number;
  rightMuscleScore?: number;
  // Optional backend-trusted component scores (percent 0-100)
  backendComponents?: {
    compliance?: number;
    symmetry?: number;
    effort?: number;
    game?: number;
  };
  // Optional direct weights override if ever needed
  weightsOverride?: ScoringWeights;
}

const OverallPerformanceCard: React.FC<OverallPerformanceCardProps> = ({
  totalScore,
  scoreLabel,
  scoreTextColor,
  scoreBgColor,
  scoreHexColor,
  muscleCount,
  symmetryScore,
  subjectiveFatigueLevel,
  averageContractionTime,
  totalContractions = 0,
  goodContractions = 0,
  expectedContractions,
  gameScore,
  gameLevel,
  therapeuticComplianceScore,
  leftMuscleScore,
  rightMuscleScore,
  backendComponents,
  weightsOverride
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { sessionParams } = useSessionStore();
  
  // Get weights from session store or use defaults
  const weights = weightsOverride || sessionParams.enhanced_scoring?.weights || DEFAULT_SCORING_WEIGHTS;
  
  // Map weight keys to our component values - use actual weights without fallbacks
  const complianceWeight = weights.compliance;
  const symmetryWeight = weights.symmetry;
  const effortWeight = weights.effort;
  const gameWeight = weights.gameScore;
  const scoreData = [
    { name: 'Score', value: Math.min(totalScore, 100) },
    { name: 'Remaining', value: Math.max(0, 100 - totalScore) },
  ];

  const SCORE_COLORS = [scoreHexColor, '#e5e7eb'];
  
  // Common component for circle displays (same as MusclePerformanceCard)
  const CircleDisplay = ({ 
    value, 
    total, 
    label, 
    color, 
    size = "md",
    showPercentage = true,
    showExpected = false
  }: { 
    value: number, 
    total?: number, 
    label?: string, 
    color: string,
    size?: "sm" | "md" | "lg",
    showPercentage?: boolean,
    showExpected?: boolean
  }) => {
    const sizeClass = {
      sm: "w-16 h-16",
      md: "w-24 h-24",
      lg: "w-32 h-32"
    };
    
    const textSizeClass = {
      sm: "text-base",
      md: "text-xl",
      lg: "text-3xl"
    };
    
    const fillPercentage = total && total > 0 
      ? (value >= total ? 100 : Math.round((value / total) * 100))
      : 100;
    
    return (
      <div className="flex flex-col items-center">
        <div className={cn("relative", sizeClass[size])}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[{ value: fillPercentage }, { value: 100 - fillPercentage }]}
                cx="50%"
                cy="50%"
                innerRadius={size === "sm" ? 28 : size === "md" ? 38 : 48}
                outerRadius={size === "sm" ? 30 : size === "md" ? 42 : 52}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                stroke="none"
              >
                <Cell fill={color} />
                <Cell fill="#e5e7eb" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("font-bold", textSizeClass[size])} style={{ color }}>
              {showPercentage ? `${value}%` : value}
            </span>
            {total && showExpected && (
              <span className="text-xs text-gray-500">of {total}</span>
            )}
          </div>
        </div>
        {label && (
          <p className="text-xs text-gray-500 mt-2">
            {label}
          </p>
        )}
      </div>
    );
  };

  return (
    <Card className="bg-white shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <div className="cursor-pointer group">
              <CardHeader className="flex flex-col items-center text-center pb-4 relative">
                <CardTitle className="text-lg font-semibold text-gray-800 flex items-center">
                  <div className="w-5 h-5 mr-2 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                    <StarIcon className="h-3 w-3 text-white" />
                  </div>
                  Overall Performance
                  <ClinicalTooltip
                    title="GHOSTLY+ Overall Performance Score"
                    description="Composite score (0–100). Higher is better. Weights are configurable by therapists."
                    sections={[
                      {
                        title: "Formula",
                        type: "formula" as const,
                        items: [
                          {
                            label: "P<sub>overall</sub> =",
                            value: `w<sub>c</sub>·S<sub>compliance</sub> + w<sub>s</sub>·S<sub>symmetry</sub> + w<sub>e</sub>·S<sub>effort</sub>${gameWeight > 0 ? ' + w<sub>g</sub>·S<sub>game</sub>' : ''}`,
                            color: "text-slate-800"
                          }
                        ]
                      },
                      {
                        title: "Components",
                        type: "list" as const,
                        items: [
                          ...(complianceWeight > 0 ? [{ label: "Compliance (C)", description: "Exercise execution quality — completion, intensity (≥75% MVC), and duration (≥2.0s)", color: "text-green-700" }] : []),
                          ...(symmetryWeight > 0 ? [{ label: "Symmetry (S)", description: "Bilateral activation balance — higher = more balanced", color: "text-purple-700" }] : []),
                          ...(effortWeight > 0 ? [{ label: "Effort (E)", description: "Patient-reported exertion (Borg CR10) — target: 4–6", color: "text-orange-700" }] : []),
                          ...(gameWeight > 0 ? [{ label: "Game (G)", description: "Experimental engagement signal — use only if clinically relevant", color: "text-cyan-700" }] : [])
                        ]
                      },
                      {
                        title: "Weights",
                        type: "table" as const,
                        items: [
                          ...(complianceWeight > 0 ? [{ label: "Compliance (C)", value: `${Math.round(complianceWeight * 100)}%`, color: "text-green-700" }] : []),
                          ...(symmetryWeight > 0 ? [{ label: "Symmetry (S)", value: `${Math.round(symmetryWeight * 100)}%`, color: "text-purple-700" }] : []),
                          ...(effortWeight > 0 ? [{ label: "Effort (E)", value: `${Math.round(effortWeight * 100)}%`, color: "text-orange-700" }] : []),
                          ...(gameWeight > 0 ? [{ label: "Game (G)", value: `${Math.round(gameWeight * 100)}%`, color: "text-cyan-700" }] : [])
                        ]
                      },
                      {
                        title: "Notes",
                        type: "list" as const,
                        items: [
                          { label: "Interpretation", description: "Aggregates weighted components. 100 = optimal performance." },
                          { label: "Configuration", description: "Adjust weights in Settings → Performance." }
                        ]
                      }
                    ]}
                    triggerClassName="ml-1"
                  />
                  </CardTitle>
                  <p className={`text-sm font-bold ${scoreTextColor} mb-2`}>{scoreLabel}</p>
                  
                  <ClinicalTooltip
                    title="Weighted Score Calculation"
                    sections={[
                      {
                        type: "table",
                        items: [
                          ...(complianceWeight > 0 ? [{ label: "Therapeutic Compliance", percentage: `${Math.round(complianceWeight * 100)}`, color: "text-green-600" }] : []),
                          ...(symmetryWeight > 0 ? [{ label: "Muscle Symmetry", percentage: `${Math.round(symmetryWeight * 100)}`, color: "text-purple-600" }] : []),
                          ...(effortWeight > 0 ? [{ label: "Subjective Effort", percentage: `${Math.round(effortWeight * 100)}`, color: "text-orange-600" }] : []),
                          ...(gameWeight > 0 ? [{ label: "Game Performance", percentage: `${Math.round(gameWeight * 100)}`, color: "text-cyan-600" }] : [])
                        ]
                      }
                    ]}
                    variant="compact"
                  >
                    <div>
                      <CircleDisplay 
                        value={totalScore} 
                        label="" 
                        color={scoreHexColor}
                        size="lg"
                        showPercentage={true}
                      />
                    </div>
                  </ClinicalTooltip>
                  <ChevronDownIcon className="absolute bottom-2 right-2 h-5 w-5 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </CardHeader>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-6">
          {/* Performance Equation Component */}
          <div className="rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 p-4 border border-slate-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 text-center">Performance Formula</h4>

            {(() => {
              // Lightweight UI helpers for formula tokens
              const Token: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
                <span className={cn("inline-flex items-baseline", className)}>{children}</span>
              );
              const Sub: React.FC<{ children: React.ReactNode }> = ({ children }) => (
                <sub className="align-sub text-[0.75em] ml-0.5">{children}</sub>
              );
              const Dot: React.FC = () => <span className="mx-1 text-gray-500">·</span>;
              const Plus: React.FC = () => <span className="mx-1 text-gray-400">+</span>;

              const parts = [
                { key: 'C', weight: complianceWeight, color: 'text-green-600', label: 'C', value: therapeuticComplianceScore },
                { key: 'S', weight: symmetryWeight, color: 'text-purple-600', label: 'S', value: symmetryScore },
                { key: 'E', weight: effortWeight, color: 'text-orange-600', label: 'E', value: typeof subjectiveFatigueLevel === 'number' ? subjectiveFatigueLevel * 10 : undefined },
                { key: 'G', weight: gameWeight, color: 'text-cyan-600', label: 'G', value: typeof gameScore === 'number' ? gameScore : undefined },
              ].filter(p => p.weight > 0);

              const weightStr = (w: number) => w.toFixed(2);
              const valueStr = (v?: number) => (typeof v === 'number' ? `${Math.round(v)}%` : '—');

              return (
                <div className="space-y-2">
                  {/* Symbolic (LaTeX-like) line */}
                  <div
                    className="bg-white rounded-lg p-3 shadow-sm overflow-x-auto"
                    aria-label="Overall performance formula"
                  >
                    <div className="font-mono text-center min-w-fit">
                      <div className="text-sm sm:text-base lg:text-lg flex items-center justify-center flex-wrap">
                        <Token className="text-blue-600 font-bold">P</Token>
                        <Token className="mx-1 text-gray-400">=</Token>
                        {parts.map((p, idx) => (
                          <React.Fragment key={p.key}>
                            {idx > 0 && <Plus />}
                            <Token className="text-slate-700">
                              <span className="text-slate-700">w</span>
                              <Sub>{p.key.toLowerCase()}</Sub>
                            </Token>
                            <Dot />
                            {p.key === 'G' ? (
                              <Token className={cn('font-semibold', p.color)}>{p.label}</Token>
                            ) : (
                              <Token className={cn('font-semibold', p.color)}>
                                <span>S</span>
                                <Sub>{p.key.toLowerCase()}</Sub>
                              </Token>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Numeric substitution line (with final result) */}
                  <div className="bg-white rounded-lg p-2 shadow-sm border border-slate-100">
                    <div className="font-mono text-center text-[0.9rem] text-slate-700 flex items-center justify-center flex-wrap">
                      <Token className="mx-1 text-gray-400">=</Token>
                      {parts.map((p, idx) => (
                        <React.Fragment key={`n-${p.key}`}>
                          {idx > 0 && <Plus />}
                          <Token>{weightStr(p.weight)}</Token>
                          <Dot />
                          <Token className={p.color}>{valueStr(p.value)}</Token>
                        </React.Fragment>
                      ))}
                      <Token className="mx-1 text-gray-400">=</Token>
                      <Token className="text-slate-800 font-semibold">{Math.round(totalScore)}%</Token>
                    </div>
                  </div>

                  {(() => {
              const vC = backendComponents?.compliance ?? (typeof therapeuticComplianceScore === 'number' ? therapeuticComplianceScore : 0);
              const vS = backendComponents?.symmetry ?? (typeof symmetryScore === 'number' ? symmetryScore : 0);
              const vE = backendComponents?.effort ?? (typeof subjectiveFatigueLevel === 'number' ? subjectiveFatigueLevel * 10 : 0);
              const vG = backendComponents?.game ?? (typeof gameScore === 'number' ? gameScore : 0);

                    const contributions = [
                      { key: 'C', color: 'bg-green-500', label: 'Compliance', value: complianceWeight * vC },
                      { key: 'S', color: 'bg-purple-500', label: 'Symmetry', value: symmetryWeight * vS },
                      { key: 'E', color: 'bg-orange-500', label: 'Effort', value: effortWeight * vE },
                      ...(gameWeight > 0 ? [{ key: 'G' as const, color: 'bg-cyan-500', label: 'Game', value: gameWeight * vG }] : []),
                    ];
                    const total = contributions.reduce((s, c) => s + c.value, 0) || 1;
                    const top = contributions.reduce((a, b) => (b.value > a.value ? b : a), contributions[0]);

                    return (
                      <div className="space-y-1">
                        {/* Contributions bar */}
                        <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
                          <div className="flex h-full w-full">
                            {contributions.map((c) => (
                              <div
                                key={`seg-${c.key}`}
                                className={cn(c.color)}
                                style={{ width: `${Math.max(0, Math.min(100, (c.value / 100) * 100))}%` }}
                                aria-label={`${c.label} contribution ${Math.round(c.value)}`}
                                title={`${c.label}: +${Math.round(c.value)}`}
                              />
                            ))}
                          </div>
                        </div>
                        {/* Small legend with numeric contributions */}
                        <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-600">
                          {contributions.map((c) => (
                            <div key={`lbl-${c.key}`} className="flex items-center gap-1">
                              <span className={cn('inline-block w-2 h-2 rounded-sm', c.color)} />
                              <span className="font-medium">{c.label}</span>
                              <span className="text-slate-400">=</span>
                              <span className="font-semibold text-slate-700">+{Math.round(c.value)}</span>
                            </div>
                          ))}
                          <div className="text-slate-400">|</div>
                          <div className="font-medium text-slate-700">Total = {Math.round(total)}%</div>
                        </div>
                        {/* Insight: top driver */}
                        <div className="text-center text-[0.8rem] text-slate-500">
                          Strongest driver: <span className="font-medium text-slate-700">{top.label}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Subtext: therapist configurability */}
                  <div className="text-center text-[0.8rem] text-slate-500">
                    Weights are therapist‑adjustable in <span className="font-medium text-slate-600">Settings → Performance</span>.
                  </div>
                </div>
              );
            })()}

            {/* Component Values Grid - Responsive - Only show components with non-zero weights */}
            <div className={`mt-3 grid gap-2 ${
              [complianceWeight, symmetryWeight, effortWeight, gameWeight].filter(w => w > 0).length === 4 ? 'grid-cols-2 sm:grid-cols-4' :
              [complianceWeight, symmetryWeight, effortWeight, gameWeight].filter(w => w > 0).length === 3 ? 'grid-cols-3' :
              [complianceWeight, symmetryWeight, effortWeight, gameWeight].filter(w => w > 0).length === 2 ? 'grid-cols-2' :
              'grid-cols-1'
            }`}>
              {complianceWeight > 0 && (
                <div className="bg-white rounded-lg p-2 sm:p-3 text-center shadow-sm border border-green-100">
                  <div className="text-green-600 font-bold text-lg sm:text-xl">{typeof therapeuticComplianceScore === 'number' ? Math.round(therapeuticComplianceScore) : '--'}%</div>
                  <div className="text-xs text-gray-600 mt-0.5">Compliance</div>
                  <div className="text-xs text-green-600 font-semibold">(C)</div>
                </div>
              )}
              {symmetryWeight > 0 && (
                <div className="bg-white rounded-lg p-2 sm:p-3 text-center shadow-sm border border-purple-100">
                  <div className="text-purple-600 font-bold text-lg sm:text-xl">{typeof symmetryScore === 'number' ? Math.round(symmetryScore) : '--'}%</div>
                  <div className="text-xs text-gray-600 mt-0.5">Symmetry</div>
                  <div className="text-xs text-purple-600 font-semibold">(S)</div>
                </div>
              )}
              {effortWeight > 0 && (
                <div className="bg-white rounded-lg p-2 sm:p-3 text-center shadow-sm border border-orange-100">
                  <div className="text-orange-600 font-bold text-lg sm:text-xl">{typeof subjectiveFatigueLevel === 'number' ? Math.round(subjectiveFatigueLevel * 10) : '--'}%</div>
                  <div className="text-xs text-gray-600 mt-0.5">Exertion</div>
                  <div className="text-xs text-orange-600 font-semibold">(E)</div>
                </div>
              )}
              {gameWeight > 0 && (
                <div className="bg-white rounded-lg p-2 sm:p-3 text-center shadow-sm border border-cyan-100">
                  <div className="text-cyan-600 font-bold text-lg sm:text-xl">{typeof gameScore === 'number' ? Math.round(gameScore) : '--'}%</div>
                  <div className="text-xs text-gray-600 mt-0.5">Game</div>
                  <div className="text-xs text-cyan-600 font-semibold">(G)</div>
                </div>
              )}
            </div>
          </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
  );
};

export default OverallPerformanceCard; 
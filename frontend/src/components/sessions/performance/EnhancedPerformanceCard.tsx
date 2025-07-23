import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { StarIcon, InfoCircledIcon, ExclamationTriangleIcon, ActivityLogIcon, MixerHorizontalIcon, ChevronDownIcon } from '@radix-ui/react-icons';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { 
  EnhancedPerformanceData, 
  MusclePerformanceData, 
  ComponentScore,
  EMGAnalysisResult 
} from '@/types/emg';
import { useEnhancedPerformanceMetrics } from '@/hooks/useEnhancedPerformanceMetrics';
import { getPerformanceColor, getSymmetryColor, getEffortColor, getComponentColors } from '@/utils/performanceColors';
import PerformanceEquation from './PerformanceEquation';
import CompactMetricCard from './CompactMetricCard';
import TherapeuticComplianceAccordion from './TherapeuticComplianceAccordion';
import { useSessionStore } from '@/store/sessionStore';

interface EnhancedPerformanceCardProps {
  analysisResult: EMGAnalysisResult | null;
}

interface PerformanceGaugeProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  colorFunction: (score: number) => any;
  tooltip: React.ReactNode;
  unit?: string;
  maxValue?: number;
  showProgressBar?: boolean;
  size?: 'large' | 'medium';
}

interface MetricRowProps {
  name: string;
  value: number;
  weight: number;
  tooltip: React.ReactNode;
  formula: string;
  showWarning?: boolean;
}

interface MuscleDetailCardProps {
  muscle: MusclePerformanceData;
  weights: any;
  sessionParams?: any;
}

interface ComponentRowProps {
  name: string;
  component: ComponentScore;
  tooltip: string;
  isComplianceMetric?: boolean;
}

const PerformanceGauge: React.FC<PerformanceGaugeProps> = ({ 
  title, 
  value, 
  icon, 
  colorFunction, 
  tooltip, 
  unit = '%',
  maxValue = 100,
  showProgressBar = false,
  size = 'medium'
}) => {
  const colors = colorFunction(value);
  const normalizedValue = Math.max(0, Math.min(maxValue, value));
  const percentage = (normalizedValue / maxValue) * 100;

  // Ensure at least 2% is visible for 0 scores to show the color
  const displayPercentage = percentage === 0 ? 2 : percentage;

  const scoreData = [
    { name: 'Score', value: displayPercentage },
    { name: 'Remaining', value: Math.max(0, 100 - displayPercentage) },
  ];

  return (
    <Card className="bg-white shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-lg font-semibold flex items-center text-gray-800">
            {icon}
            {title}
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoCircledIcon className="h-4 w-4 ml-1 text-gray-500 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center space-y-4">
          {/* Circular Gauge - Enhanced Size */}
          <div className={`relative ${size === 'large' ? 'w-64 h-64' : 'w-52 h-52'}`}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={scoreData}
                  cx="50%"
                  cy="50%"
                  innerRadius={size === 'large' ? 92 : 78}
                  outerRadius={size === 'large' ? 108 : 94}
                  startAngle={90}
                  endAngle={450}
                  paddingAngle={0}
                  dataKey="value"
                  stroke="none"
                >
                  {scoreData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? colors.hex : '#e5e7eb'} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className={`${size === 'large' ? 'text-6xl' : 'text-5xl'} font-bold ${colors.text}`}>
                {normalizedValue}{unit}
              </span>
              <span className={`${size === 'large' ? 'text-base' : 'text-sm'} text-gray-500 text-center leading-tight px-2 mt-1`}>
                {colors.label}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          {showProgressBar && (
            <div className="w-full">
              <Progress 
                value={percentage} 
                className="h-2" 
                indicatorClassName={colors.bg}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0</span>
                <span>{maxValue}{unit}</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const MetricRow: React.FC<MetricRowProps> = ({ 
  name, 
  value, 
  weight, 
  tooltip, 
  formula, 
  showWarning = false 
}) => (
  <div className="space-y-1">
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{name}</span>
        <Tooltip>
          <TooltipTrigger>
            <InfoCircledIcon className="h-3 w-3 text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div>
              {tooltip}
              <p className="text-xs mt-1 text-muted-foreground">
                Formula: {formula}
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
        {showWarning && (
          <ExclamationTriangleIcon className="h-3 w-3 text-amber-500" />
        )}
        <span className="text-xs text-muted-foreground">
          ({(weight * 100).toFixed(0)}%)
        </span>
      </div>
      <span className="text-sm font-medium">{value.toFixed(0)}%</span>
    </div>
    <Progress value={value} className="h-1.5" />
  </div>
);

const ComponentRow: React.FC<ComponentRowProps> = ({ name, component, tooltip, isComplianceMetric = false }) => {
  const componentColors = getPerformanceColor(component.value);
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{name}</span>
          <Tooltip>
            <TooltipTrigger>
              <InfoCircledIcon className="h-3 w-3 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>{tooltip}</p>
              <p className="text-xs mt-1 text-muted-foreground">
                {component.formula}
              </p>
              <p className="text-xs mt-1">
                {component.count}/{component.total} ({component.value.toFixed(0)}%)
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${componentColors.text}`}>
            {component.value.toFixed(0)}%
          </span>
          <span className="text-xs text-muted-foreground">
            {componentColors.label}
          </span>
        </div>
      </div>
      <div className="relative">
        <Progress 
          value={component.value} 
          className="h-2" 
          indicatorClassName={componentColors.bg}
        />
        {/* Threshold indicators */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <div 
            className="absolute top-0 w-0.5 h-full bg-gray-400 opacity-60"
            style={{ left: '70%' }}
            title="Good threshold (70%)"
          />
          <div 
            className="absolute top-0 w-0.5 h-full bg-yellow-500 opacity-60"
            style={{ left: '90%' }}
            title="Excellent threshold (90%)"
          />
        </div>
      </div>
    </div>
  );
};

const MuscleDetailCard: React.FC<MuscleDetailCardProps> = ({ muscle, weights, sessionParams }) => {
  const muscleColors = getPerformanceColor(muscle.totalScore);
  
  return (
    <Card className={`border-2 ${muscleColors.border}`}>
      <CardHeader>
        <CardTitle className="text-lg">{muscle.muscleName} Performance</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`${muscleColors.bg} ${muscleColors.text}`}>
            {muscle.totalScore}%
          </Badge>
          <span className="text-sm text-muted-foreground">
            {muscleColors.label}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ComponentRow
          name="Completion"
          component={muscle.components.completion}
          tooltip="Percentage of expected contractions completed in this session. Measures exercise completion (e.g., 12 contractions per muscle)."
          isComplianceMetric={true}
        />
        <ComponentRow
          name="MVC Quality"
          component={muscle.components.mvcQuality}
          tooltip={`Percentage of contractions reaching therapeutic intensity (≥${sessionParams?.session_mvc_threshold_percentage ?? 75}% MVC). Ensures adequate muscle activation for rehabilitation progress.`}
          isComplianceMetric={true}
        />
        <ComponentRow
          name="Duration Quality"
          component={muscle.components.qualityThreshold}
          tooltip="Percentage of contractions meeting adaptive duration threshold for rehabilitation. Patient-specific threshold (3s → 10s) that adapts as endurance improves during therapy."
          isComplianceMetric={true}
        />
    </CardContent>
  </Card>
  );
};

const EnhancedPerformanceCard: React.FC<EnhancedPerformanceCardProps> = ({ analysisResult }) => {
  const [complianceOpen, setComplianceOpen] = useState(false);
  const enhancedData = useEnhancedPerformanceMetrics(analysisResult);
  const { sessionParams } = useSessionStore();
  const componentColors = getComponentColors(sessionParams);

  if (!enhancedData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Enhanced Performance Scoring</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <InfoCircledIcon className="h-4 w-4" />
            <AlertDescription>
              Enhanced performance scoring requires bilateral muscle data and proper configuration.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const { 
    overallScore, 
    leftMuscle, 
    rightMuscle, 
    symmetryScore, 
    effortScore, 
    complianceScore,
    gameScoreNormalized, 
    weights,
    isDebugMode 
  } = enhancedData;

  const therapeuticComplianceScore = (leftMuscle.totalScore + rightMuscle.totalScore) / 2;
  const gameLevel = analysisResult?.metadata?.level || null;

  return (
    <TooltipProvider>
      <div className="space-y-8">
        {/* Primary Performance Gauges - Restored Large Size */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Overall Performance Gauge */}
          <div className="flex flex-col">
            <PerformanceGauge
              title="Overall Performance Score"
              value={overallScore}
              icon={<StarIcon className="h-5 w-5 mr-2 text-yellow-600" />}
              colorFunction={getPerformanceColor}
              size="large"
              tooltip={
                <div>
                  <p className="font-medium mb-2">Combined score based on all muscle performance</p>
                  <p className="text-sm text-gray-600 mb-2">
                    Weighted composite assessment of therapeutic effectiveness
                  </p>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>Therapeutic Compliance:</span>
                      <span className="font-medium">{(weights.completion * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Muscle Symmetry:</span>
                      <span className="font-medium">{(weights.symmetry * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Subjective Effort:</span>
                      <span className="font-medium">{(weights.effort * 100).toFixed(0)}%</span>
                    </div>
                    {weights.gameScore > 0 && (
                      <div className="flex justify-between">
                        <span>Game Performance:</span>
                        <span className="font-medium">{(weights.gameScore * 100).toFixed(0)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              }
            />
          </div>

          {/* Therapeutic Compliance Gauge */}
          <div className="flex flex-col">
            <PerformanceGauge
              title="Therapeutic Compliance"
              value={therapeuticComplianceScore}
              icon={<svg className="h-5 w-5 mr-2 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
              colorFunction={getPerformanceColor}
              size="large"
              tooltip={
                <div>
                  <p className="font-medium mb-2">Exercise execution quality</p>
                  <p className="text-sm text-gray-600 mb-2">
                    Average compliance across both muscles
                  </p>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span>Left Muscle:</span>
                      <span className="font-medium">{leftMuscle.totalScore.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Right Muscle:</span>
                      <span className="font-medium">{rightMuscle.totalScore.toFixed(1)}%</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Click "View Details" below for breakdown
                  </p>
                </div>
              }
            />
            
            {/* Simplified Details Toggle */}
            <div className="mt-6">
              <button
                onClick={() => setComplianceOpen(!complianceOpen)}
                className="w-full px-4 py-3 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors duration-200 flex items-center justify-center gap-2 font-medium"
              >
                <span>{complianceOpen ? 'Hide Details' : 'View Details'}</span>
                <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${complianceOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Detailed Compliance Information - Progressive Disclosure */}
        {complianceOpen && (
          <Card className="bg-gray-50 border-gray-200">
            <CardContent className="p-0">
              <TherapeuticComplianceAccordion
                leftMuscle={leftMuscle}
                rightMuscle={rightMuscle}
                averageScore={therapeuticComplianceScore}
                isOpen={true}
                onToggle={() => {}}
                sessionParams={sessionParams}
              />
            </CardContent>
          </Card>
        )}

        {/* Secondary Metrics - Improved Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Muscle Symmetry Card */}
          <CompactMetricCard
            title="Muscle Symmetry"
            value={symmetryScore}
            icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
            color={getSymmetryColor(symmetryScore).text}
            subtitle={getSymmetryColor(symmetryScore).label}
            tooltip={
              <div>
                <p className="font-medium mb-2">Bilateral muscle balance assessment</p>
                <p className="text-sm text-gray-600 mb-2">
                  Measures left-right muscle performance balance
                </p>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span>Perfect balance:</span>
                    <span className="font-medium">100%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Excellent:</span>
                    <span className="font-medium">90-99%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Minor imbalance:</span>
                    <span className="font-medium">70-89%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Significant:</span>
                    <span className="font-medium">{'<'}70%</span>
                  </div>
                </div>
              </div>
            }
          />

          {/* Subjective Effort Card */}
          <CompactMetricCard
            title="Subjective Effort"
            value={effortScore}
            icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
            color={getEffortColor(effortScore).text}
            subtitle={getEffortColor(effortScore).label}
            tooltip={
              <div>
                <p className="font-medium mb-2">Perceived exertion assessment</p>
                <p className="text-sm text-gray-600 mb-2">
                  Based on RPE change during session
                </p>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span>Optimal effort:</span>
                    <span className="font-medium">+2 to +4 RPE</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Good effort:</span>
                    <span className="font-medium">+1 or +5 RPE</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Suboptimal:</span>
                    <span className="font-medium">{'<'}0 or {'>'}6 RPE</span>
                  </div>
                </div>
              </div>
            }
          />

          {/* Game Score Card */}
          <CompactMetricCard
            title="GHOSTLY Score"
            value={analysisResult?.metadata?.score || 0}
            unit="pts"
            icon={<svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 011-1h1a2 2 0 100-4H7a1 1 0 01-1-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" /></svg>}
            color={getPerformanceColor(gameScoreNormalized).text}
            subtitle={gameLevel ? `Level ${gameLevel} • ${gameScoreNormalized.toFixed(0)}% normalized` : `${gameScoreNormalized.toFixed(0)}% normalized`}
            badge={
              weights.gameScore === 0 && (
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                  Experimental
                </Badge>
              )
            }
            tooltip={
              <div>
                <p className="font-medium mb-2">Game engagement metrics</p>
                <p className="text-sm text-gray-600 mb-2">
                  GHOSTLY platform performance tracking
                </p>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span>Raw Score:</span>
                    <span className="font-medium">{analysisResult?.metadata?.score || 0} pts</span>
                  </div>
                  {gameLevel && (
                    <div className="flex justify-between">
                      <span>Level:</span>
                      <span className="font-medium">{gameLevel}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Normalized:</span>
                    <span className="font-medium">{gameScoreNormalized.toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Weight in Overall:</span>
                    <span className="font-medium">{(weights.gameScore * 100).toFixed(0)}%</span>
                  </div>
                </div>
                {weights.gameScore === 0 ? (
                  <p className="mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
                    ⚠️ Currently excluded from Overall Performance calculation
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-green-600 bg-green-50 p-2 rounded">
                    ✓ Included with {(weights.gameScore * 100).toFixed(0)}% weight
                  </p>
                )}
              </div>
            }
          />
        </div>

        {/* Performance Equation */}
        <PerformanceEquation weights={weights} compact={true} showSettingsLink={true} />

        {/* Old Muscle Detail Cards - Remove these once accordion is validated */}


        {/* Debug Info */}
        {isDebugMode && (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-sm">Debug Information</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold">Weights:</p>
                  <ul className="space-y-1">
                    <li>Completion: {(weights.completion * 100).toFixed(0)}%</li>
                    <li>MVC Quality: {(weights.mvcQuality * 100).toFixed(0)}%</li>
                    <li>Quality Threshold: {(weights.qualityThreshold * 100).toFixed(0)}%</li>
                    <li>Symmetry: {(weights.symmetry * 100).toFixed(0)}%</li>
                    <li>Effort: {(weights.effort * 100).toFixed(0)}%</li>
                    <li>Game Score: {(weights.gameScore * 100).toFixed(0)}%</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold">Calculations:</p>
                  <ul className="space-y-1">
                    <li>Muscle Average: {((leftMuscle.totalScore + rightMuscle.totalScore) / 2).toFixed(1)}%</li>
                    <li>Symmetry: {symmetryScore}%</li>
                    <li>Effort: {effortScore}%</li>
                    <li>Game (norm): {gameScoreNormalized.toFixed(1)}%</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
};

export default EnhancedPerformanceCard;
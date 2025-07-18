import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { StarIcon, InfoCircledIcon, ExclamationTriangleIcon, ActivityLogIcon, MixerHorizontalIcon } from '@radix-ui/react-icons';
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
}

interface ComponentRowProps {
  name: string;
  component: ComponentScore;
  tooltip: string;
}

const PerformanceGauge: React.FC<PerformanceGaugeProps> = ({ 
  title, 
  value, 
  icon, 
  colorFunction, 
  tooltip, 
  unit = '%',
  maxValue = 100,
  showProgressBar = true
}) => {
  const colors = colorFunction(value);
  const normalizedValue = Math.max(0, Math.min(maxValue, value));
  const percentage = (normalizedValue / maxValue) * 100;

  const scoreData = [
    { name: 'Score', value: percentage },
    { name: 'Remaining', value: Math.max(0, 100 - percentage) },
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
          {/* Circular Gauge - Extra Large Size */}
          <div className="relative w-48 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={scoreData}
                  cx="50%"
                  cy="50%"
                  innerRadius={72}
                  outerRadius={84}
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
              <span className={`text-4xl font-bold ${colors.text}`}>
                {normalizedValue}{unit}
              </span>
              <span className="text-sm text-gray-500 text-center leading-tight px-2">
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

const ComponentRow: React.FC<ComponentRowProps> = ({ name, component, tooltip }) => {
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

const MuscleDetailCard: React.FC<MuscleDetailCardProps> = ({ muscle, weights }) => {
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
      />
      <ComponentRow
        name="MVC Quality"
        component={muscle.components.mvcQuality}
        tooltip="Percentage of contractions reaching therapeutic intensity (≥75% MVC). Ensures adequate muscle activation for rehabilitation progress."
      />
      <ComponentRow
        name="Quality Threshold"
        component={muscle.components.qualityThreshold}
        tooltip="Percentage of contractions meeting adaptive quality threshold for rehabilitation. Patient-specific threshold that adapts as strength improves during therapy."
      />
    </CardContent>
  </Card>
  );
};

const EnhancedPerformanceCard: React.FC<EnhancedPerformanceCardProps> = ({ analysisResult }) => {
  const enhancedData = useEnhancedPerformanceMetrics(analysisResult);
  const componentColors = getComponentColors();

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
    gameScoreNormalized, 
    weights,
    isDebugMode 
  } = enhancedData;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Three Main Gauges */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Overall Performance Gauge */}
          <PerformanceGauge
            title="Overall Performance"
            value={overallScore}
            icon={<StarIcon className="h-5 w-5 mr-2 text-yellow-500" />}
            colorFunction={getPerformanceColor}
            tooltip={
              <div>
                <p className="font-medium mb-2">Comprehensive rehabilitation performance score</p>
                <div className="bg-gray-50 p-3 rounded-lg font-mono text-xs mb-2">
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="font-bold">P =</span>
                    <span className={componentColors.completion.text}>{(weights.completion * 100).toFixed(0)}% · S<sub>comp</sub></span>
                    <span>+</span>
                    <span className={componentColors.mvcQuality.text}>{(weights.mvcQuality * 100).toFixed(0)}% · S<sub>MVC</sub></span>
                    <span>+</span>
                    <span className={componentColors.qualityThreshold.text}>{(weights.qualityThreshold * 100).toFixed(0)}% · S<sub>qual</sub></span>
                    <span>+</span>
                    <span className={componentColors.symmetry.text}>{(weights.symmetry * 100).toFixed(0)}% · S<sub>sym</sub></span>
                    <span>+</span>
                    <span className={componentColors.effort.text}>{(weights.effort * 100).toFixed(0)}% · S<sub>effort</sub></span>
                    {weights.gameScore > 0 && (
                      <>
                        <span>+</span>
                        <span className={componentColors.gameScore.text}>{(weights.gameScore * 100).toFixed(0)}% · S<sub>game</sub></span>
                      </>
                    )}
                  </div>
                </div>
                <ul className="space-y-1 text-sm">
                  <li>• <span className={componentColors.completion.text}>Session completion</span>: Expected contractions completed</li>
                  <li>• <span className={componentColors.mvcQuality.text}>MVC quality</span>: Therapeutic intensity (≥75% MVC)</li>
                  <li>• <span className={componentColors.qualityThreshold.text}>Quality threshold</span>: Adaptive duration (≥2000ms)</li>
                  <li>• <span className={componentColors.symmetry.text}>Bilateral balance</span>: Left-right symmetry</li>
                  <li>• <span className={componentColors.effort.text}>Perceived exertion</span>: Optimal therapeutic effort</li>
                  {weights.gameScore > 0 && (
                    <li>• <span className={componentColors.gameScore.text}>Game performance</span>: GHOSTLY score (experimental)</li>
                  )}
                </ul>
                <p className="mt-2 text-xs text-gray-600">
                  Mathematical model evaluating single-session performance across multiple clinical dimensions.
                </p>
              </div>
            }
          />
          
          {/* Muscle Symmetry Gauge */}
          <PerformanceGauge
            title="Muscle Symmetry"
            value={symmetryScore}
            icon={<svg className="h-5 w-5 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
            colorFunction={getSymmetryColor}
            tooltip={
              <div>
                <p>Bilateral muscle balance critical for rehabilitation:</p>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• 100%: Ideal rehabilitation balance</li>
                  <li>• 70-99%: Minor imbalance, typical during recovery</li>
                  <li>• Below 70%: Significant imbalance, may require intervention</li>
                </ul>
                <p className="mt-2 text-xs text-gray-600">
                  Balanced muscle activation is essential for optimal recovery and preventing compensation patterns.
                </p>
              </div>
            }
          />
          
          {/* Subjective Effort Gauge */}
          <PerformanceGauge
            title="Subjective Effort"
            value={effortScore}
            icon={<svg className="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
            colorFunction={getEffortColor}
            tooltip={
              <div>
                <p>Therapeutic effort assessment using RPE scale:</p>
                <ul className="mt-2 space-y-1 text-sm">
                  <li>• Optimal: +2 to +4 points (ideal therapeutic workload)</li>
                  <li>• Good: +1 or +5 points (acceptable intensity)</li>
                  <li>• Moderate: 0 or +6 points (may need adjustment)</li>
                  <li>• Suboptimal: Negative or {'>'}+6 points (requires intervention)</li>
                </ul>
                <p className="mt-2 text-xs text-gray-600">
                  Proper perceived exertion ensures therapeutic effectiveness while preventing overexertion during rehabilitation.
                </p>
              </div>
            }
          />
        </div>


        {/* Performance Equation */}
        <PerformanceEquation weights={weights} compact={true} showSettingsLink={true} />

        {/* Détails par Muscle */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MuscleDetailCard muscle={leftMuscle} weights={weights} />
          <MuscleDetailCard muscle={rightMuscle} weights={weights} />
        </div>

        {/* Game Score Section (if available) */}
        {analysisResult?.metadata?.score !== undefined && (
          <Card>
            <CardHeader>
              <CardTitle>GHOSTLY Game Score</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <MetricRow
                name="Normalized Game Score"
                value={gameScoreNormalized}
                weight={weights.gameScore}
                tooltip={
                  <div>
                    <p>Score from the GHOSTLY game normalized to 0-100%</p>
                    <p className="text-xs mt-1">Raw score: {analysisResult.metadata.score}</p>
                    <p className="text-xs mt-1 text-amber-600">
                      Note: Algorithm under development
                    </p>
                  </div>
                }
                formula="Game-specific normalization (TBD)"
                showWarning={weights.gameScore > 0}
              />
              
              {weights.gameScore === 0 && (
                <Alert className="text-xs">
                  <InfoCircledIcon className="h-3 w-3" />
                  <AlertDescription>
                    Game score is available but has 0% weight. 
                    Enable in settings when normalization algorithm is validated.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

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
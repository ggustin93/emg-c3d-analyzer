import React from 'react';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { getPerformanceColor } from '@/lib/performanceColors';
import BFRBadge from './BFRBadge';
import { MusclePerformanceData, GameSessionParameters } from '@/types/emg';
import { formatPercentage } from '@/lib/formatUtils';

interface TherapeuticComplianceAccordionProps {
  leftMuscle: MusclePerformanceData;
  rightMuscle: MusclePerformanceData;
  averageScore: number;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  sessionParams?: GameSessionParameters | null;
}

interface ComplianceComponentProps {
  label: string;
  value: number;
  count: number;
  total: number;
}

const ComplianceComponent: React.FC<ComplianceComponentProps> = ({ label, value, count, total }) => {
  const colors = getPerformanceColor(value);
  
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-gray-600">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">{count}/{total}</span>
        <span className={`text-xs font-medium ${colors.text}`}>{formatPercentage(value)}</span>
      </div>
    </div>
  );
};

const TherapeuticComplianceAccordion: React.FC<TherapeuticComplianceAccordionProps> = ({
  leftMuscle,
  rightMuscle,
  averageScore,
  isOpen,
  onToggle,
  sessionParams
}) => {
  const averageColors = getPerformanceColor(averageScore);
  const leftColors = getPerformanceColor(leftMuscle.totalScore);
  const rightColors = getPerformanceColor(rightMuscle.totalScore);

  // TODO: Get actual BFR status from session data
  const leftBFRActive = false;
  const rightBFRActive = false;

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              Therapeutic Compliance Details
            </span>
            <span className={`text-sm font-bold ${averageColors.text}`}>
              {formatPercentage(averageScore, false, 1)}
            </span>
          </div>
          <ChevronDownIcon 
            className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          />
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="px-3 pb-3 space-y-4">
          {/* Left Muscle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Left Muscle</span>
                <BFRBadge isActive={leftBFRActive} muscle="left" />
              </div>
              <span className={`text-sm font-bold ${leftColors.text}`}>
                {formatPercentage(leftMuscle.totalScore)}
              </span>
            </div>
            <Progress 
              value={leftMuscle.totalScore} 
              className="h-2" 
              indicatorClassName={leftColors.bg}
            />
            <div className="pl-4 space-y-1">
              <ComplianceComponent
                label="Completion"
                value={leftMuscle.components.completion.value}
                count={leftMuscle.components.completion.count}
                total={leftMuscle.components.completion.total}
              />
              <ComplianceComponent
                label={`MVC Quality (≥${sessionParams?.session_mvc_threshold_percentage ?? 75}%)`}
                value={leftMuscle.components.mvcQuality.value}
                count={leftMuscle.components.mvcQuality.count}
                total={leftMuscle.components.mvcQuality.total}
              />
              <ComplianceComponent
                label={`Duration (≥${((sessionParams?.contraction_duration_threshold ?? 2000) / 1000).toFixed(1)}s)`}
                value={leftMuscle.components.qualityThreshold.value}
                count={leftMuscle.components.qualityThreshold.count}
                total={leftMuscle.components.qualityThreshold.total}
              />
            </div>
          </div>

          {/* Right Muscle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Right Muscle</span>
                <BFRBadge isActive={rightBFRActive} muscle="right" />
              </div>
              <span className={`text-sm font-bold ${rightColors.text}`}>
                {formatPercentage(rightMuscle.totalScore)}
              </span>
            </div>
            <Progress 
              value={rightMuscle.totalScore} 
              className="h-2" 
              indicatorClassName={rightColors.bg}
            />
            <div className="pl-4 space-y-1">
              <ComplianceComponent
                label="Completion"
                value={rightMuscle.components.completion.value}
                count={rightMuscle.components.completion.count}
                total={rightMuscle.components.completion.total}
              />
              <ComplianceComponent
                label={`MVC Quality (≥${sessionParams?.session_mvc_threshold_percentage ?? 75}%)`}
                value={rightMuscle.components.mvcQuality.value}
                count={rightMuscle.components.mvcQuality.count}
                total={rightMuscle.components.mvcQuality.total}
              />
              <ComplianceComponent
                label={`Duration (≥${((sessionParams?.contraction_duration_threshold ?? 2000) / 1000).toFixed(1)}s)`}
                value={rightMuscle.components.qualityThreshold.value}
                count={rightMuscle.components.qualityThreshold.count}
                total={rightMuscle.components.qualityThreshold.total}
              />
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default TherapeuticComplianceAccordion;
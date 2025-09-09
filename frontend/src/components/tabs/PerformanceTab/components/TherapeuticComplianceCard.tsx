import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useScoreColors } from '@/hooks/useScoreColors';
import { formatPercentage } from '@/lib/formatUtils';
import { getProgressBarColors } from '@/lib/performanceColors';

interface TherapeuticComplianceCardProps {
  complianceScore: number;
  leftMuscleScore?: number;
  rightMuscleScore?: number;
  totalContractions?: number;
  expectedContractions?: number;
  goodContractions?: number;
}

const TherapeuticComplianceCard: React.FC<TherapeuticComplianceCardProps> = ({
  complianceScore,
  leftMuscleScore,
  rightMuscleScore,
  totalContractions = 0,
  expectedContractions,
  goodContractions = 0
}) => {
  const complianceColors = useScoreColors(complianceScore);
  const progressColors = getProgressBarColors(complianceScore);

  return (
    <TooltipProvider>
      <Card className="bg-white shadow-sm hover:shadow-md transition-shadow duration-300">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center text-gray-800">
              <svg className="h-5 w-5 mr-2 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Compliance
              <Tooltip>
                <TooltipTrigger asChild>
                  <InfoCircledIcon className="h-4 w-4 ml-1 text-gray-500 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm z-50 bg-white border border-gray-200 shadow-lg">
                  <div>
                    <p className="font-medium mb-2">Exercise execution quality assessment</p>
                    <p className="text-sm text-gray-600 mb-3">
                      Measures how well rehabilitation exercises were performed
                    </p>
                    
                    <div className="text-xs space-y-2">
                      <div>
                        <p className="font-medium text-gray-800">Key Components:</p>
                        <ul className="ml-2 space-y-1 text-gray-600">
                          <li>• <strong>Completion Rate:</strong> Contractions performed vs. expected</li>
                          <li>• <strong>MVC Quality:</strong> Intensity threshold achievement (≥75%)</li>
                          <li>• <strong>Duration Quality:</strong> Contraction time requirements</li>
                        </ul>
                      </div>
                      
                      {(totalContractions > 0 || expectedContractions) && (
                        <div className="pt-2 border-t border-gray-200">
                          <p className="font-medium text-gray-800">Session Summary:</p>
                          <div className="ml-2 space-y-1 text-gray-600">
                            {expectedContractions && (
                              <div>• <strong>Expected:</strong> {expectedContractions} contractions</div>
                            )}
                            <div>• <strong>Completed:</strong> {totalContractions} contractions</div>
                            <div>• <strong>Quality:</strong> {goodContractions}/{totalContractions} met MVC threshold</div>
                            {leftMuscleScore !== undefined && rightMuscleScore !== undefined && (
                              <>
                                <div>• <strong>Left Muscle:</strong> {formatPercentage(leftMuscleScore)} compliance</div>
                                <div>• <strong>Right Muscle:</strong> {formatPercentage(rightMuscleScore)} compliance</div>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <div className="pt-2 border-t border-gray-200">
                        <p className="font-medium text-gray-800">Clinical Interpretation:</p>
                        <div className="ml-2 text-gray-600">
                          <div>• <strong>≥90%:</strong> Excellent exercise execution</div>
                          <div>• <strong>80-89%:</strong> Good protocol adherence</div>
                          <div>• <strong>70-79%:</strong> Moderate compliance</div>
                          <div>• <strong>{'<'}70%:</strong> Protocol adjustments needed</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </div>
          <span className={`text-xl font-bold ${complianceColors.text}`}>{formatPercentage(complianceScore)}</span>
        </CardHeader>
        <CardContent>
          <Progress 
            value={complianceScore} 
            className="h-2" 
            indicatorClassName={progressColors.bg}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Poor Compliance</span>
            <span>Excellent Compliance</span>
          </div>
          <p className="text-sm text-gray-500 text-center mt-2">{complianceColors.label}</p>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default TherapeuticComplianceCard;
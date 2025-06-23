import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ActivityLogIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useFatigueColors } from '@/hooks/useFatigueColors';

interface SubjectiveFatigueCardProps {
  fatigueLevel: number; // 0-10 scale
  showBadge?: boolean;
}

const SubjectiveFatigueCard: React.FC<SubjectiveFatigueCardProps> = ({
  fatigueLevel,
  showBadge = false
}) => {
  const normalizedFatigue = Math.max(0, Math.min(10, fatigueLevel));
  const fatigueInfo = useFatigueColors(normalizedFatigue);
  const fatiguePercentage = (normalizedFatigue / 10) * 100;

  return (
    <TooltipProvider>
      <Card className="bg-white shadow-sm hover:shadow-md transition-shadow duration-300">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center text-gray-800">
              <ActivityLogIcon className="h-5 w-5 mr-2 text-blue-500" />
              Subjective Exertion
              <Tooltip>
                <TooltipTrigger asChild>
                  <InfoCircledIcon className="h-4 w-4 ml-1 text-gray-500 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>
                    Patient's self-reported exertion level using the Borg CR10 Scale:
                    <br /><br />
                    • 0: No exertion at all (rest)
                    <br />• 1: Very light exertion
                    <br />• 2-3: Light exertion
                    <br />• 4-5: Moderate exertion
                    <br />• 6-7: Vigorous exertion
                    <br />• 8-9: Very hard exertion
                    <br />• 10: Maximum effort
                    <br /><br />
                    This subjective measure helps correlate EMG data with perceived exertion and fatigue.
                  </p>
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </div>
          <span className={`text-xl font-bold ${fatigueInfo.text}`}>{normalizedFatigue}/10</span>
        </CardHeader>
        <CardContent>
          <Progress 
            value={fatiguePercentage} 
            className="h-2" 
            indicatorClassName={fatigueInfo.bg}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>No Exertion</span>
            <span>Max Exertion</span>
          </div>
          <p className="text-sm text-gray-500 text-center mt-2">{fatigueInfo.label}</p>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default SubjectiveFatigueCard; 
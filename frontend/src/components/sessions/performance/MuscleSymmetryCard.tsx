import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MixerHorizontalIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useScoreColors } from '@/hooks/useScoreColors';

interface MuscleSymmetryCardProps {
  symmetryScore?: number;
}

const MuscleSymmetryCard: React.FC<MuscleSymmetryCardProps> = ({
  symmetryScore = 90
}) => {
  const scoreColors = useScoreColors(symmetryScore);

  return (
    <TooltipProvider>
      <Card className="bg-white shadow-sm hover:shadow-md transition-shadow duration-300">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
          <CardTitle className="text-lg font-semibold flex items-center text-gray-800">
            <MixerHorizontalIcon className="h-5 w-5 mr-2 text-gray-500" />
            Muscle Symmetry
            <Tooltip>
              <TooltipTrigger asChild>
                <InfoCircledIcon className="h-4 w-4 ml-1 text-gray-500 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  Muscle symmetry is crucial for balanced rehabilitation:
                  <br /><br />
                  • 100%: Ideal balance - both sides working equally
                  <br />• 70-99%: Minor imbalance - typical during recovery
                  <br />• Below 70%: Significant imbalance - may need attention
                  <br /><br />
                  Based on comparing left vs. right muscle performance, considering both strength (MVC) and activation patterns.
                </p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          </div>
          <span className={`text-xl font-bold ${scoreColors.text}`}>{symmetryScore}%</span>
        </CardHeader>
        <CardContent>
          <Progress 
            value={symmetryScore} 
            className="h-2" 
            indicatorClassName={scoreColors.bg}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Imbalanced</span>
            <span>Perfect symmetry</span>
          </div>
          <p className="text-sm text-gray-500 text-center mt-2">{scoreColors.label}</p>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default MuscleSymmetryCard; 
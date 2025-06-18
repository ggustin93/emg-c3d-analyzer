import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MixerHorizontalIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface MuscleSymmetryCardProps {
  symmetryScore: number;
}

const MuscleSymmetryCard: React.FC<MuscleSymmetryCardProps> = ({
  symmetryScore
}) => {
  return (
    <TooltipProvider>
      <Card className="bg-white shadow-sm hover:shadow-md transition-shadow duration-300">
        <CardHeader className="pb-2">
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
        </CardHeader>
        <CardContent>
          <div className="flex items-center mb-2">
            <span className="text-2xl font-bold text-gray-700">{symmetryScore}%</span>
            <span className="ml-2 text-sm text-gray-500">
              {symmetryScore >= 90 ? 'Excellent balance' : 
               symmetryScore >= 70 ? 'Good balance' : 
               'Needs attention'}
            </span>
          </div>
          
          <Progress 
            value={symmetryScore} 
            className="h-3" 
            indicatorClassName={
              symmetryScore >= 90 ? "bg-green-500" : 
              symmetryScore >= 70 ? "bg-blue-500" : 
              "bg-amber-500"
            }
          />
          
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Imbalanced</span>
            <span>Perfect symmetry</span>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default MuscleSymmetryCard; 
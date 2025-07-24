import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { GHOSTLYScoreTooltip } from '@/components/ui/clinical-tooltip';
import { useScoreColors } from '@/hooks/useScoreColors';

interface GHOSTLYGameCardProps {
  gameScore?: number;
  gameLevel?: number;
  normalizedScore?: number;
  showExperimental?: boolean;
}

const GHOSTLYGameCard: React.FC<GHOSTLYGameCardProps> = ({
  gameScore = 0,
  gameLevel,
  normalizedScore = 0,
}) => {
  const scoreColors = useScoreColors(normalizedScore);

  return (
    <Card className="bg-white shadow-sm hover:shadow-md transition-shadow duration-300">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center text-gray-800">
              <svg className="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 011-1h1a2 2 0 100-4H7a1 1 0 01-1-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
              </svg>
              GHOSTLY Score
              <div className="ml-2">
                <GHOSTLYScoreTooltip 
                  gameScore={gameScore}
                  gameLevel={gameLevel}
                  normalizedScore={normalizedScore}
                />
              </div>
            </CardTitle>
          </div>
          <div className="text-right">
            <div className={`text-xl font-bold ${scoreColors.text}`}>
              {Math.round(normalizedScore)}%
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Progress 
            value={normalizedScore} 
            className="h-2" 
            indicatorClassName={scoreColors.bg}
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Low Engagement</span>
            <span>High Engagement</span>
          </div>
          {gameLevel ? (
            <p className="text-sm text-gray-500 text-center mt-2">Level {gameLevel} • {gameScore} pts • {scoreColors.label}</p>
          ) : (
            <p className="text-sm text-gray-500 text-center mt-2">{gameScore} pts • {scoreColors.label}</p>
          )}
        </CardContent>
      </Card>
  );
};

export default GHOSTLYGameCard;
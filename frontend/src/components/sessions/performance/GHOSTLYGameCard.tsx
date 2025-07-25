import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GHOSTLYScoreTooltip } from '@/components/ui/clinical-tooltip';
import { StarIcon } from '@radix-ui/react-icons';

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
  return (
    <Card className="bg-white shadow-sm hover:shadow-md transition-shadow duration-300">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center text-gray-800">
            <svg className="h-5 w-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 011-1h1a2 2 0 100-4H7a1 1 0 01-1-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
            </svg>
            GHOSTLY Game Data
            <div className="ml-2">
              <GHOSTLYScoreTooltip 
                gameScore={gameScore}
                gameLevel={gameLevel}
                normalizedScore={normalizedScore}
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-4">
            {/* Left Column: Score */}
            <div className="text-center">
              <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Score</div>
              <div className="flex items-center justify-center">
                <span className="text-3xl font-bold text-gray-800 mr-2 font-mono">
                  {gameScore || 0}
                </span>
                <StarIcon className="h-7 w-7 text-yellow-400 fill-yellow-400" />
              </div>
            </div>

            {/* Right Column: Level */}
            <div className="text-center">
              <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Level</div>
              {gameLevel !== undefined ? (
                <div className="text-3xl font-bold text-blue-600 font-mono">
                  {gameLevel}
                </div>
              ) : (
                <div className="text-lg text-gray-400 font-mono">
                  --
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
  );
};

export default GHOSTLYGameCard;
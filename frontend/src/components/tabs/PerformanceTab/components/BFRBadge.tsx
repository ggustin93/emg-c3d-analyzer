import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface BFRBadgeProps {
  isActive: boolean;
  muscle?: 'left' | 'right';
}

const BFRBadge: React.FC<BFRBadgeProps> = ({ isActive, muscle }) => {
  const label = muscle ? `BFR ${muscle.toUpperCase()}` : 'BFR';
  
  if (!isActive) {
    return (
      <Badge 
        variant="outline" 
        className="text-xs bg-gray-50 text-gray-500 border-gray-300"
      >
        {label} OFF
      </Badge>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="default" 
          className="text-xs bg-blue-500 text-white hover:bg-blue-600"
        >
          {label} ON
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">
          Blood Flow Restriction is active for {muscle || 'this'} muscle.
          Target: 20-80% AOP
        </p>
      </TooltipContent>
    </Tooltip>
  );
};

export default BFRBadge;
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { ChevronDownIcon } from '@radix-ui/react-icons';

interface UnifiedSettingsCardProps {
  title: string;
  description: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  children: React.ReactNode;
  badge?: React.ReactNode;
  icon: React.ReactNode;
  accentColor?: string;
}

const UnifiedSettingsCard: React.FC<UnifiedSettingsCardProps> = ({
  title,
  description,
  isOpen,
  onOpenChange,
  children,
  badge,
  icon,
  accentColor = "blue-500",
}) => {
  return (
    <Card className={`border-l-4 border-l-${accentColor} hover:shadow-sm transition-shadow`}>
      <Collapsible open={isOpen} onOpenChange={onOpenChange}>
        <CardHeader>
          <CollapsibleTrigger className="flex items-center justify-between w-full text-left hover:text-slate-600">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  {icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg font-semibold">{title}</CardTitle>
                    {badge}
                  </div>
                  <CardDescription className="text-sm text-gray-600">{description}</CardDescription>
                </div>
              </div>
            </div>
            <ChevronDownIcon className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''} text-gray-400`} />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default UnifiedSettingsCard;
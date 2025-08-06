import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDownIcon } from '@radix-ui/react-icons';

interface CollapsibleSettingsCardProps {
  title: string;
  description: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  children: React.ReactNode;
}

const CollapsibleSettingsCard: React.FC<CollapsibleSettingsCardProps> = ({
  title,
  description,
  isOpen,
  onOpenChange,
  children,
}) => {
  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={onOpenChange}>
        <CardHeader>
          <CollapsibleTrigger className="flex items-center justify-between w-full text-left hover:text-slate-600">
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <ChevronDownIcon className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default CollapsibleSettingsCard; 
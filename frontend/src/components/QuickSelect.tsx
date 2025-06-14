import React from 'react';
import { Button } from './ui/button';

const testFiles = [
  'Ghostly_Emg_20230321_17-23-09-0409.c3d',
  'Ghostly_Emg_20230321_17-28-14-0160.c3d',
];

interface QuickSelectProps {
  onSelect: (filename: string) => void;
  disabled: boolean;
}

const QuickSelect: React.FC<QuickSelectProps> = ({ onSelect, disabled }) => {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">Or select a test file:</p>
      <div className="flex flex-wrap gap-2">
        {testFiles.map((file) => (
          <Button
            key={file}
            variant="outline"
            size="sm"
            onClick={() => onSelect(file)}
            disabled={disabled}
          >
            {file}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default QuickSelect; 
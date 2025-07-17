import React from 'react';
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";

interface ContractionVisualizationSettingsProps {
  showGoodContractions: boolean;
  setShowGoodContractions: ((show: boolean) => void) | undefined;
  showPoorContractions: boolean;
  setShowPoorContractions: ((show: boolean) => void) | undefined;
  showContractionAreas: boolean;
  setShowContractionAreas: ((show: boolean) => void) | undefined;
  showContractionDots: boolean;
  setShowContractionDots: ((show: boolean) => void) | undefined;
  disabled: boolean;
}

const ContractionVisualizationSettings: React.FC<ContractionVisualizationSettingsProps> = ({
  showGoodContractions,
  setShowGoodContractions,
  showPoorContractions,
  setShowPoorContractions,
  showContractionAreas,
  setShowContractionAreas,
  showContractionDots,
  setShowContractionDots,
  disabled,
}) => {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-700">Contraction Visualization</h4>
      <p className="text-xs text-slate-500">
        Configure how muscle contractions are displayed when "Contraction Highlights" is enabled.
      </p>
      
      <div className="space-y-4">
        {/* Contraction Quality Controls */}
        <div className="space-y-3">
          <h5 className="text-xs font-medium text-gray-600">Contraction Quality</h5>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <Label htmlFor="show-good-contractions" className="text-sm">Show Good Contractions</Label>
              </div>
              <Switch
                id="show-good-contractions"
                checked={showGoodContractions}
                onCheckedChange={setShowGoodContractions}
                disabled={disabled || !setShowGoodContractions}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <Label htmlFor="show-poor-contractions" className="text-sm">Show Poor Contractions</Label>
              </div>
              <Switch
                id="show-poor-contractions"
                checked={showPoorContractions}
                onCheckedChange={setShowPoorContractions}
                disabled={disabled || !setShowPoorContractions}
              />
            </div>
          </div>
        </div>
        
        {/* Display Style Controls */}
        <div className="space-y-3">
          <h5 className="text-xs font-medium text-gray-600">Display Style</h5>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-4 h-2 bg-blue-300 border border-blue-600 rounded-sm"></div>
                <Label htmlFor="show-contraction-areas" className="text-sm">Show Contraction Areas</Label>
              </div>
              <Switch
                id="show-contraction-areas"
                checked={showContractionAreas}
                onCheckedChange={setShowContractionAreas}
                disabled={disabled || !setShowContractionAreas}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full border border-blue-600"></div>
                <Label htmlFor="show-contraction-dots" className="text-sm">Show Contraction Dots</Label>
              </div>
              <Switch
                id="show-contraction-dots"
                checked={showContractionDots}
                onCheckedChange={setShowContractionDots}
                disabled={disabled || !setShowContractionDots}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Information */}
      <div className="p-3 bg-blue-50 rounded-md">
        <p className="text-xs text-blue-800">
          <strong>Note:</strong> Areas highlight the duration of contractions, while dots mark peak contraction points.
        </p>
      </div>
    </div>
  );
};

export default ContractionVisualizationSettings; 
import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { InfoCircledIcon } from '@radix-ui/react-icons';

interface ContractionVisualizationSettingsProps {
  // Legacy props for backward compatibility
  showGoodContractions: boolean;
  setShowGoodContractions: ((show: boolean) => void) | undefined;
  showPoorContractions: boolean;
  setShowPoorContractions: ((show: boolean) => void) | undefined;
  
  // Enhanced quality criteria props
  showExcellentContractions?: boolean;
  setShowExcellentContractions?: ((show: boolean) => void) | undefined;
  showAdequateForceContractions?: boolean;
  setShowAdequateForceContractions?: ((show: boolean) => void) | undefined;
  showAdequateDurationContractions?: boolean;
  setShowAdequateDurationContractions?: ((show: boolean) => void) | undefined;
  showInsufficientContractions?: boolean;
  setShowInsufficientContractions?: ((show: boolean) => void) | undefined;
  
  // Display options
  showContractionAreas: boolean;
  setShowContractionAreas: ((show: boolean) => void) | undefined;
  showContractionDots: boolean;
  setShowContractionDots: ((show: boolean) => void) | undefined;
  disabled: boolean;
  
  // Enhanced mode toggle
  useEnhancedQuality?: boolean;
}

const ContractionVisualizationSettings: React.FC<ContractionVisualizationSettingsProps> = ({
  // Legacy props
  showGoodContractions,
  setShowGoodContractions,
  showPoorContractions,
  setShowPoorContractions,
  
  // Enhanced quality props
  showExcellentContractions = true,
  setShowExcellentContractions,
  showAdequateForceContractions = true,
  setShowAdequateForceContractions,
  showAdequateDurationContractions = true,
  setShowAdequateDurationContractions,
  showInsufficientContractions = true,
  setShowInsufficientContractions,
  
  // Display options
  showContractionAreas,
  setShowContractionAreas,
  showContractionDots,
  setShowContractionDots,
  disabled,
  useEnhancedQuality = false,
}) => {
  // Quick preset handlers
  const handleShowAll = () => {
    if (useEnhancedQuality) {
      setShowExcellentContractions?.(true);
      setShowAdequateForceContractions?.(true);
      setShowAdequateDurationContractions?.(true);
      setShowInsufficientContractions?.(true);
    } else {
      setShowGoodContractions?.(true);
      setShowPoorContractions?.(true);
    }
  };

  const handleHideAll = () => {
    if (useEnhancedQuality) {
      setShowExcellentContractions?.(false);
      setShowAdequateForceContractions?.(false);
      setShowAdequateDurationContractions?.(false);
      setShowInsufficientContractions?.(false);
    } else {
      setShowGoodContractions?.(false);
      setShowPoorContractions?.(false);
    }
  };

  const handleClinicalStandard = () => {
    if (useEnhancedQuality) {
      setShowExcellentContractions?.(true);
      setShowAdequateForceContractions?.(true);
      setShowAdequateDurationContractions?.(true);
      setShowInsufficientContractions?.(false);
    } else {
      setShowGoodContractions?.(true);
      setShowPoorContractions?.(false);
    }
  };
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-700">Contraction Visualization</h4>
      <p className="text-xs text-slate-500">
        Configure how muscle contractions are displayed when "Contraction Highlights" is enabled.
      </p>
      
      <div className="space-y-4">
        {/* Quick Presets */}
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-gray-600">Quick Presets</h5>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShowAll}
              disabled={disabled}
              className="text-xs h-7"
            >
              Show All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClinicalStandard}
              disabled={disabled}
              className="text-xs h-7"
            >
              Clinical Standard
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleHideAll}
              disabled={disabled}
              className="text-xs h-7"
            >
              Hide All
            </Button>
          </div>
        </div>

        {/* Contraction Quality Controls */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h5 className="text-xs font-medium text-gray-600">Therapeutic Quality Categories</h5>
            <div className="group relative">
              <InfoCircledIcon className="h-3 w-3 text-gray-400 cursor-help" />
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                Controls which contraction quality categories are displayed
              </div>
            </div>
          </div>
          
          {useEnhancedQuality ? (
            /* Enhanced 4-Category System */
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-3 bg-green-500 border-2 border-green-600 rounded-sm"></div>
                  <Label htmlFor="show-excellent" className="text-sm">Excellent</Label>
                  <span className="text-xs text-gray-500">(Both criteria met)</span>
                </div>
                <Switch
                  id="show-excellent"
                  checked={showExcellentContractions}
                  onCheckedChange={setShowExcellentContractions}
                  disabled={disabled || !setShowExcellentContractions}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-3 bg-yellow-400 border-2 border-yellow-600 rounded-sm"></div>
                  <Label htmlFor="show-adequate-force" className="text-sm">Adequate Force</Label>
                  <span className="text-xs text-gray-500">(MVC met, duration low)</span>
                </div>
                <Switch
                  id="show-adequate-force"
                  checked={showAdequateForceContractions}
                  onCheckedChange={setShowAdequateForceContractions}
                  disabled={disabled || !setShowAdequateForceContractions}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-3 bg-blue-400 border-2 border-blue-600 rounded-sm"></div>
                  <Label htmlFor="show-adequate-duration" className="text-sm">Adequate Duration</Label>
                  <span className="text-xs text-gray-500">(Duration met, force low)</span>
                </div>
                <Switch
                  id="show-adequate-duration"
                  checked={showAdequateDurationContractions}
                  onCheckedChange={setShowAdequateDurationContractions}
                  disabled={disabled || !setShowAdequateDurationContractions}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-3 bg-red-400 border-2 border-red-600 rounded-sm"></div>
                  <Label htmlFor="show-insufficient" className="text-sm">Insufficient</Label>
                  <span className="text-xs text-gray-500">(Neither criterion met)</span>
                </div>
                <Switch
                  id="show-insufficient"
                  checked={showInsufficientContractions}
                  onCheckedChange={setShowInsufficientContractions}
                  disabled={disabled || !setShowInsufficientContractions}
                />
              </div>
            </div>
          ) : (
            /* Legacy 2-Category System */
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
          )}
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
      <div className="p-3 bg-blue-50 rounded-md space-y-2">
        <p className="text-xs text-blue-800">
          <strong>Visualization:</strong> Areas highlight contraction duration, dots mark peak amplitude points with quality indicators.
        </p>
        {useEnhancedQuality && (
          <div className="text-xs text-blue-700">
            <strong>Quality Symbols:</strong> ✓ = Excellent, F = Force adequate, D = Duration adequate, ✗ = Insufficient
          </div>
        )}
        <p className="text-xs text-blue-700">
          <strong>Clinical Standard:</strong> Shows therapeutic-quality contractions (excellent + adequate) while hiding insufficient ones.
        </p>
      </div>
    </div>
  );
};

export default ContractionVisualizationSettings; 
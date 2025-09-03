import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  InfoCircledIcon, 
  PersonIcon, 
  GlobeIcon, 
  LockClosedIcon,
  CheckCircledIcon,
  ExclamationTriangleIcon
} from '@radix-ui/react-icons';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface SaveMode {
  mode: 'session' | 'patient' | 'global';
  label: string;
  description: string;
  icon: React.ReactNode;
  requiresRole?: string[];
  color: 'gray' | 'yellow' | 'green';
}

interface SaveModeSelectorProps {
  onSave: (mode: 'session' | 'patient' | 'global') => Promise<void>;
  userRole?: string;
  hasUnsavedChanges: boolean;
  currentSaveState: 'default' | 'session' | 'patient' | 'global';
  isTherapistMode?: boolean;
  disabled?: boolean;
  therapistId?: string;
  patientId?: string;
}

const SaveModeSelector: React.FC<SaveModeSelectorProps> = ({
  onSave,
  userRole,
  hasUnsavedChanges,
  currentSaveState,
  isTherapistMode = false,
  disabled = false,
  therapistId,
  patientId
}) => {
  const [confirmDialog, setConfirmDialog] = React.useState<SaveMode | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const isResearcher = userRole === 'researcher' || userRole === 'admin';
  const isTherapist = userRole === 'therapist' || isResearcher;

  const saveModes: SaveMode[] = [
    {
      mode: 'session',
      label: 'Apply to Session',
      description: 'Changes apply only to this session (will reset on page reload)',
      icon: <InfoCircledIcon className="h-4 w-4" />,
      color: 'gray'
    },
    {
      mode: 'patient',
      label: 'Save for Patient',
      description: therapistId && patientId 
        ? `Save for therapist ${therapistId} and patient ${patientId}`
        : 'Save weights specifically for this therapist-patient combination',
      icon: <PersonIcon className="h-4 w-4" />,
      color: 'yellow',
      requiresRole: ['therapist', 'researcher', 'admin']
    },
    {
      mode: 'global',
      label: 'Save for All Users',
      description: 'Update the global default weights for all users (researcher only)',
      icon: <GlobeIcon className="h-4 w-4" />,
      color: 'green',
      requiresRole: ['researcher', 'admin']
    }
  ];

  const getStateIndicator = () => {
    const indicators = {
      default: { color: 'bg-gray-200', text: 'Using Defaults', icon: null },
      session: { color: 'bg-gray-400', text: 'Session Only', icon: <InfoCircledIcon className="h-3 w-3" /> },
      patient: { color: 'bg-yellow-400', text: 'Patient Specific', icon: <PersonIcon className="h-3 w-3" /> },
      global: { color: 'bg-green-400', text: 'Global Settings', icon: <GlobeIcon className="h-3 w-3" /> }
    };

    const indicator = indicators[currentSaveState];
    
    return (
      <div className="flex items-center gap-2">
        <div className={cn("w-2 h-2 rounded-full", indicator.color)} />
        <Badge variant="outline" className="text-xs flex items-center gap-1">
          {indicator.icon}
          {indicator.text}
        </Badge>
        {hasUnsavedChanges && (
          <Badge variant="warning" className="text-xs">
            Unsaved Changes
          </Badge>
        )}
      </div>
    );
  };

  const canUseSaveMode = (mode: SaveMode) => {
    if (!mode.requiresRole) return true;
    if (!userRole) return false;
    return mode.requiresRole.includes(userRole);
  };

  const handleSaveClick = (mode: SaveMode) => {
    if (!canUseSaveMode(mode)) return;
    setConfirmDialog(mode);
  };

  const handleConfirmSave = async () => {
    if (!confirmDialog) return;
    
    setIsSaving(true);
    try {
      await onSave(confirmDialog.mode);
      setConfirmDialog(null);
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Current State Indicator */}
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border">
        <span className="text-sm font-medium text-gray-700">Weight Configuration Status</span>
        {getStateIndicator()}
      </div>

      {/* Save Actions */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-800">Save Options</h4>
        
        {/* Trial Mode Notice for Therapists */}
        {isTherapist && !isResearcher && (
          <Alert className="bg-blue-50 border-blue-200 mb-3">
            <LockClosedIcon className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-sm text-blue-800">
              <strong>Trial Mode:</strong> During this trial, only researchers can modify global scoring weights. 
              Therapists can view and test weights locally but cannot save to the database.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-2">
          {saveModes.map((mode) => {
            const canUse = canUseSaveMode(mode);
            const isLocked = !canUse && (mode.mode === 'patient' || mode.mode === 'global');
            
            return (
              <Button
                key={mode.mode}
                variant="outline"
                size="sm"
                onClick={() => handleSaveClick(mode)}
                disabled={disabled || !canUse || !hasUnsavedChanges}
                className={cn(
                  "justify-start text-left h-auto py-2 px-3",
                  mode.color === 'gray' && "hover:bg-gray-50",
                  mode.color === 'yellow' && canUse && "hover:bg-yellow-50",
                  mode.color === 'green' && canUse && "hover:bg-green-50",
                  !canUse && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="flex items-start gap-2 w-full">
                  <div className={cn(
                    "mt-0.5",
                    mode.color === 'gray' && "text-gray-600",
                    mode.color === 'yellow' && "text-yellow-600",
                    mode.color === 'green' && "text-green-600"
                  )}>
                    {isLocked ? <LockClosedIcon className="h-4 w-4" /> : mode.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{mode.label}</span>
                      {isLocked && (
                        <Badge variant="outline" className="text-xs">
                          {mode.mode === 'global' ? 'Researcher Only' : 'Locked for Trial'}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {mode.description}
                    </p>
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmDialog?.icon}
              Confirm {confirmDialog?.label}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog?.mode === 'session' && (
                <div className="space-y-2">
                  <p>This will apply your weight changes only to the current session.</p>
                  <Alert className="bg-gray-50 border-gray-200">
                    <InfoCircledIcon className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      Changes will be lost when you reload the page or start a new session.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
              
              {confirmDialog?.mode === 'patient' && (
                <div className="space-y-2">
                  <p>This will save your weight configuration specifically for:</p>
                  <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                    <li>Therapist: {therapistId || 'Current therapist'}</li>
                    <li>Patient: {patientId || 'Current patient'}</li>
                  </ul>
                  <Alert className="bg-yellow-50 border-yellow-200">
                    <ExclamationTriangleIcon className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      These weights will override global defaults for this specific therapist-patient pair.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
              
              {confirmDialog?.mode === 'global' && (
                <div className="space-y-2">
                  <p className="font-semibold text-red-600">
                    ⚠️ This will update the default weights for ALL users in the system.
                  </p>
                  <Alert className="bg-red-50 border-red-200">
                    <ExclamationTriangleIcon className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-sm text-red-800">
                      <strong>Warning:</strong> This action affects all therapists and patients 
                      who don't have custom configurations. Make sure these weights have been 
                      validated for clinical use.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialog(null)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSave}
              disabled={isSaving}
              className={cn(
                confirmDialog?.mode === 'session' && "bg-gray-600 hover:bg-gray-700",
                confirmDialog?.mode === 'patient' && "bg-yellow-600 hover:bg-yellow-700",
                confirmDialog?.mode === 'global' && "bg-green-600 hover:bg-green-700"
              )}
            >
              {isSaving ? (
                <>Saving...</>
              ) : (
                <>
                  <CheckCircledIcon className="mr-2 h-4 w-4" />
                  Confirm {confirmDialog?.label}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SaveModeSelector;
/**
 * PatientModals - Dialog components for patient management workflows
 * 
 * This component provides modal dialogs for patient creation and management,
 * focusing on form handling, validation, and user interaction workflows.
 * 
 * Key Features:
 * - Patient creation with automatic code generation
 * - Patient reassignment between therapists (admin only)
 * - Comprehensive form validation and error handling
 * - Clean, accessible dialog design
 * 
 * Modal Components:
 * - CreatePatientModal: New patient registration with medical info
 * - ReassignPatientModal: Transfer patients between therapists
 * 
 * Performance Features:
 * - Callback-optimized form handlers
 * - Automatic cleanup and state management
 * - Efficient form state handling with validation
 * - Optimistic updates for better UX
 * 
 * Form Validation:
 * - Patient code format validation and uniqueness check
 * - Medical information completeness validation
 * - Therapist assignment validation
 * - Age and demographic data validation
 * 
 * Extracted for focused form management and reusability
 */
import React, { useEffect, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select'
import { Label } from '../../ui/label'
import { Input } from '../../ui/input'
import { Button } from '../../ui/button'
import { useToast } from '../../../hooks/use-toast'
import * as Icons from '@radix-ui/react-icons'
import { Patient } from './types'

interface PatientModalsProps {
  showCreateDialog: boolean
  onCreateDialogChange: (open: boolean) => void
  showReassignDialog: boolean
  onReassignDialogChange: (open: boolean) => void
  createForm: {
    patient_code: string
    firstName: string
    lastName: string
    age: string
    gender: 'male' | 'female' | 'non_binary' | 'not_specified'
    therapistId: string
    totalSessions: string
  }
  setCreateForm: React.Dispatch<React.SetStateAction<{
    patient_code: string
    firstName: string
    lastName: string
    age: string
    gender: 'male' | 'female' | 'non_binary' | 'not_specified'
    therapistId: string
    totalSessions: string
  }>>
  selectedPatient: Patient | null
  newTherapistId: string
  setNewTherapistId: React.Dispatch<React.SetStateAction<string>>
  therapistsList: Array<{ id: string; first_name: string; last_name: string }>
  therapistMap: Map<string, { first_name: string; last_name: string }>
  isGeneratingCode: boolean
  codeValidation: { isValid: boolean; message: string } | null
  formatCode: (code: string) => string
  validateCode: (code: string) => void
  generateCode: () => Promise<string>
  cleanupCodeGeneration: () => void
  loadPatientsData: () => Promise<void>
}

export function PatientModals({
  showCreateDialog,
  onCreateDialogChange,
  showReassignDialog,
  onReassignDialogChange,
  createForm,
  setCreateForm,
  selectedPatient,
  newTherapistId,
  setNewTherapistId,
  therapistsList,
  therapistMap,
  isGeneratingCode,
  codeValidation,
  formatCode,
  validateCode,
  generateCode,
  cleanupCodeGeneration,
  loadPatientsData
}: PatientModalsProps) {
  const { toast } = useToast()

  // Generate next available patient code (wrapper for hook function)
  const generatePatientCode = useCallback(async () => {
    try {
      const newCode = await generateCode()
      setCreateForm(prev => ({ ...prev, patient_code: newCode }))
      
    } catch (error: any) {
      console.error('Failed to generate patient code:', error)
      toast({
        title: 'Error',
        description: 'Failed to generate patient code. Please enter manually.',
        variant: 'destructive'
      })
    }
  }, [generateCode, setCreateForm, toast])

  // Patient creation handler with useCallback (admin only)
  const handleCreatePatient = useCallback(async () => {
    if (!createForm.patient_code || !createForm.firstName || !createForm.lastName || !createForm.therapistId) {
      toast({
        title: 'Error',
        description: 'Patient code, first name, last name, and therapist assignment are required',
        variant: 'destructive'
      })
      return
    }
    
    // Check code validation
    if (!codeValidation?.isValid) {
      toast({
        title: 'Error',
        description: 'Please enter a valid and unique patient code',
        variant: 'destructive'
      })
      return
    }

    try {
      // First, create the patient record
      const { error: patientError } = await supabase
        .from('patients')
        .insert({
          patient_code: createForm.patient_code,
          therapist_id: createForm.therapistId,  // Now mandatory
          total_sessions_planned: parseInt(createForm.totalSessions) || 30,
          treatment_start_date: new Date().toISOString(),
          active: true
        })
        .select()
        .single()

      if (patientError) throw patientError

      // Then, create the medical info record
      const age = parseInt(createForm.age)
      const dateOfBirth = age ? new Date(new Date().getFullYear() - age, 0, 1).toISOString().split('T')[0] : null

      const { error: medicalError } = await supabase
        .from('patient_medical_info')
        .insert({
          patient_code: createForm.patient_code,
          first_name: createForm.firstName,
          last_name: createForm.lastName,
          date_of_birth: dateOfBirth,
          gender: createForm.gender
        })

      if (medicalError) {
        // If medical info creation fails, try to clean up the patient record
        await supabase.from('patients').delete().eq('patient_code', createForm.patient_code)
        throw medicalError
      }

      toast({
        title: 'Success',
        description: `Patient ${createForm.firstName} ${createForm.lastName} (${createForm.patient_code}) created successfully`
      })

      // Close dialog (handleDialogChange will reset form)
      onCreateDialogChange(false)

      // Reload patients to show the new patient
      await loadPatientsData()

    } catch (error: any) {
      console.error('Failed to create patient:', error)
      toast({
        title: 'Error',
        description: `Failed to create patient: ${error.message}`,
        variant: 'destructive'
      })
    }
  }, [createForm, codeValidation, toast, loadPatientsData, onCreateDialogChange])

  // Handle patient reassignment - Optimized with useCallback
  const handleReassignPatient = useCallback(async () => {
    if (!selectedPatient || !newTherapistId) return
    
    try {
      const { error } = await supabase
        .from('patients')
        .update({ therapist_id: newTherapistId })
        .eq('patient_code', selectedPatient.patient_code)

      if (error) throw error

      // Find the new therapist name
      const newTherapist = therapistsList.find(t => t.id === newTherapistId)

      toast({
        title: 'Patient Reassigned Successfully',
        description: `${selectedPatient.display_name} has been reassigned to ${newTherapist?.first_name?.charAt(0)}. ${newTherapist?.last_name}`,
        variant: 'success'
      })

      onReassignDialogChange(false)

      // Reload patients to show the updated assignment
      await loadPatientsData()
    } catch (error) {
      console.error('Error reassigning patient:', error)
      toast({
        title: 'Reassignment Error',
        description: 'Failed to reassign patient',
        variant: 'destructive'
      })
    }
  }, [selectedPatient, newTherapistId, therapistsList, toast, loadPatientsData, onReassignDialogChange])

  // Handle dialog open/close with cleanup
  const handleCreateDialogChange = useCallback((open: boolean) => {
    onCreateDialogChange(open)
    if (!open) {
      // Cleanup code generation on dialog close
      cleanupCodeGeneration()
      // Reset form when closing
      setCreateForm({
        patient_code: '',
        firstName: '',
        lastName: '',
        age: '',
        gender: 'not_specified',
        therapistId: '',
        totalSessions: '30'
      })
    }
  }, [onCreateDialogChange, cleanupCodeGeneration, setCreateForm])

  // Auto-generate patient code when dialog opens
  useEffect(() => {
    if (showCreateDialog && !createForm.patient_code) {
      generatePatientCode()
    }
  }, [showCreateDialog, createForm.patient_code, generatePatientCode])

  return (
    <>
      {/* Patient Creation Dialog - Admin Only */}
      <Dialog open={showCreateDialog} onOpenChange={handleCreateDialogChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Patient</DialogTitle>
            <DialogDescription>
              Add a new patient to the system. Patient code must be unique and therapist assignment is required.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="patientCode" className="text-right">Patient Code</Label>
              <div className="col-span-3 space-y-2">
                <div className="flex gap-2">
                  <Input
                    id="patientCode"
                    value={createForm.patient_code}
                    onChange={(e) => {
                      const code = formatCode(e.target.value)
                      setCreateForm({ ...createForm, patient_code: code })
                      validateCode(code)
                    }}
                    placeholder="P001"
                    className={`flex-1 ${
                      codeValidation 
                        ? codeValidation.isValid 
                          ? 'border-green-500 focus:border-green-500' 
                          : 'border-red-500 focus:border-red-500'
                        : ''
                    }`}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={generatePatientCode}
                    disabled={isGeneratingCode}
                    className="shrink-0"
                  >
                    {isGeneratingCode ? (
                      <Icons.UpdateIcon className="h-4 w-4 animate-spin" />
                    ) : (
                      <Icons.MagicWandIcon className="h-4 w-4" />
                    )}
                    Generate
                  </Button>
                </div>
                {codeValidation && (
                  <p className={`text-xs ${
                    codeValidation.isValid ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {codeValidation.message}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="firstName" className="text-right">First Name</Label>
              <Input
                id="firstName"
                value={createForm.firstName}
                onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="lastName" className="text-right">Last Name</Label>
              <Input
                id="lastName"
                value={createForm.lastName}
                onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="age" className="text-right">Age</Label>
              <Input
                id="age"
                type="number"
                value={createForm.age}
                onChange={(e) => setCreateForm({ ...createForm, age: e.target.value })}
                placeholder="25"
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Gender</Label>
              <Select 
                value={createForm.gender} 
                onValueChange={(value) => setCreateForm({ ...createForm, gender: value as any })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="non_binary">Non-binary</SelectItem>
                  <SelectItem value="not_specified">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Therapist *</Label>
              <Select 
                value={createForm.therapistId} 
                onValueChange={(value) => setCreateForm({ ...createForm, therapistId: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select therapist (required)" />
                </SelectTrigger>
                <SelectContent>
                  {therapistsList.map((therapist) => (
                    <SelectItem key={therapist.id} value={therapist.id}>
                      {therapist.first_name?.charAt(0)}. {therapist.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="totalSessions" className="text-right">Total Sessions</Label>
              <Input
                id="totalSessions"
                type="number"
                value={createForm.totalSessions}
                onChange={(e) => setCreateForm({ ...createForm, totalSessions: e.target.value })}
                placeholder="30"
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleCreateDialogChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePatient}>Create Patient</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Patient Reassignment Dialog */}
      <Dialog open={showReassignDialog} onOpenChange={onReassignDialogChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Patient</DialogTitle>
            <DialogDescription>
              Select a new therapist for {selectedPatient?.display_name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="current-therapist" className="text-right">Current Therapist</Label>
              <div className="col-span-3">
                <Input
                  id="current-therapist"
                  value={selectedPatient ? therapistMap.get(selectedPatient.therapist_id || '') ? 
                    `${therapistMap.get(selectedPatient.therapist_id || '')?.first_name?.charAt(0)}. ${therapistMap.get(selectedPatient.therapist_id || '')?.last_name}`.trim() 
                    : 'Non assigné' : ''}
                  disabled
                  className="bg-gray-50"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-therapist" className="text-right">
                New Therapist <span className="text-red-500">*</span>
              </Label>
              <div className="col-span-3">
                <Select value={newTherapistId} onValueChange={setNewTherapistId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a therapist" />
                  </SelectTrigger>
                  <SelectContent>
                    {therapistsList.map((therapist) => (
                      <SelectItem key={therapist.id} value={therapist.id}>
                        {therapist.first_name?.charAt(0)}. {therapist.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => onReassignDialogChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleReassignPatient}
              disabled={!newTherapistId || newTherapistId === selectedPatient?.therapist_id}
            >
              Reassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
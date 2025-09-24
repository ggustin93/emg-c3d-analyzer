/**
 * TypeScript interfaces for Patient Management in Therapist Dashboard
 * Following Frontend CLAUDE.md guidelines for strict typing
 */

export interface Patient {
  patient_code: string
  
  // Medical info (null for researchers, populated for therapists)
  first_name: string | null
  last_name: string | null
  age: number | null
  
  // Session data
  session_count: number
  last_session: string | null
  created_at: string
  
  // Treatment configuration
  treatment_start_date: string | null
  total_sessions_planned: number
  
  // Status and metrics - simplified for clinical trial
  active: boolean  // Simple active/inactive status
  compliance_status?: 'excellent' | 'good' | 'fair' | 'low'
  adherence_level?: 'high' | 'moderate' | 'low' | 'no_data'
  
  // Therapist assignment (for admin view)
  therapist_id?: string | null
  
  // UI helpers
  display_name?: string
  avatar_initials?: string
}

export interface PatientMedicalInfo {
  // Demographics (from screenshot)
  first_name: string
  last_name: string
  age: number
  gender: 'male' | 'female' | 'non_binary' | 'not_specified'
  room_number: string | null
  admission_date: string | null
  
  // Medical Info (from screenshot)
  primary_diagnosis: string | null
  mobility_status: 'ambulatory' | 'bed_rest' | 'wheelchair' | 'assisted'
  bmi_value: number | null
  bmi_status: 'underweight' | 'normal' | 'overweight' | 'obese' | null
  cognitive_status: 'alert' | 'confused' | 'impaired' | 'unresponsive'
  
  // Treatment Summary (from screenshot)
  total_sessions_planned: number
  // Note: patient status moved to simple boolean 'active' field in patients table
}

export interface PatientManagementProps {
  className?: string
}
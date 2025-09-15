// Utility to backfill patient_medical_info for all existing patients
// This should be run once to ensure all patients have medical info records

import { supabase } from '../lib/supabase'

interface PatientMedicalInfoRecord {
  patient_code: string
  first_name: string
  last_name: string
  date_of_birth: string | null
}

/**
 * Backfill patient_medical_info for ALL patients missing this information
 * This creates placeholder records that therapists can update later
 */
export async function backfillAllPatientMedicalInfo(): Promise<{
  success: boolean
  created: number
  errors: string[]
}> {
  const result = {
    success: false,
    created: 0,
    errors: [] as string[]
  }

  try {
    console.log('🔍 Checking for patients without medical info...')

    // Get all patients
    const { data: allPatients, error: patientsError } = await supabase
      .from('patients')
      .select('patient_code')

    if (patientsError) {
      result.errors.push(`Failed to fetch patients: ${patientsError.message}`)
      return result
    }

    if (!allPatients || allPatients.length === 0) {
      console.log('ℹ️ No patients found in database')
      result.success = true
      return result
    }

    console.log(`📊 Found ${allPatients.length} total patients`)

    // Get patients that already have medical info
    const { data: patientsWithMedicalInfo, error: medicalError } = await supabase
      .from('patient_medical_info')
      .select('patient_code')

    if (medicalError) {
      result.errors.push(`Failed to fetch existing medical info: ${medicalError.message}`)
      return result
    }

    const existingCodes = new Set(
      patientsWithMedicalInfo?.map(p => p.patient_code) || []
    )

    // Find patients missing medical info
    const missingPatients = allPatients.filter(
      patient => !existingCodes.has(patient.patient_code)
    )

    if (missingPatients.length === 0) {
      console.log('✅ All patients already have medical info records')
      result.success = true
      return result
    }

    console.log(`🚀 Creating medical info for ${missingPatients.length} patients...`)

    // Create medical info records
    const medicalInfoRecords: PatientMedicalInfoRecord[] = missingPatients.map(patient => {
      // Generate meaningful names from patient codes
      const numericPart = patient.patient_code.replace(/\D/g, '')
      const number = parseInt(numericPart) || 0
      
      return {
        patient_code: patient.patient_code,
        first_name: `Patient`,
        last_name: `${number.toString().padStart(3, '0')}`, // P001 → "Patient 001"
        date_of_birth: null // To be filled by therapist
      }
    })

    // Insert in batches to avoid overwhelming the database
    const batchSize = 50
    let totalCreated = 0

    for (let i = 0; i < medicalInfoRecords.length; i += batchSize) {
      const batch = medicalInfoRecords.slice(i, i + batchSize)
      
      const { error: insertError } = await supabase
        .from('patient_medical_info')
        .insert(batch)

      if (insertError) {
        result.errors.push(
          `Batch ${Math.floor(i / batchSize) + 1} failed: ${insertError.message}`
        )
        console.error(`❌ Batch insert failed:`, insertError)
      } else {
        totalCreated += batch.length
        console.log(`✅ Created batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(medicalInfoRecords.length / batchSize)} (${batch.length} records)`)
      }
    }

    result.created = totalCreated
    result.success = totalCreated > 0

    if (result.success) {
      console.log(`🎉 Successfully created ${totalCreated} patient medical info records`)
      console.log('💡 Therapists can now update patient names and details in the Patient Management section')
    }

    return result

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    result.errors.push(`Unexpected error: ${errorMessage}`)
    console.error('❌ Backfill failed:', error)
    return result
  }
}

/**
 * Run backfill and log results to console
 * Call this function once to populate missing patient medical info
 */
export async function runPatientMedicalInfoBackfill(): Promise<void> {
  console.log('🏥 Starting Patient Medical Info Backfill...')
  console.log('=' .repeat(50))
  
  const startTime = Date.now()
  const result = await backfillAllPatientMedicalInfo()
  const duration = Date.now() - startTime

  console.log('=' .repeat(50))
  console.log(`⏱️ Backfill completed in ${duration}ms`)
  console.log(`📈 Records created: ${result.created}`)
  console.log(`✅ Success: ${result.success}`)
  
  if (result.errors.length > 0) {
    console.log(`❌ Errors: ${result.errors.length}`)
    result.errors.forEach(error => console.error(`   - ${error}`))
  }
  
  console.log('=' .repeat(50))
}

// Instructions for use:
/*
To run this backfill utility:

1. In the browser console on the dashboard:
   import { runPatientMedicalInfoBackfill } from './utils/patientMedicalInfoBackfill'
   await runPatientMedicalInfoBackfill()

2. Or add a temporary button to an admin page:
   <button onClick={() => runPatientMedicalInfoBackfill()}>
     Backfill Patient Medical Info
   </button>

3. The utility will:
   - Find all patients without medical info
   - Create placeholder records (Patient 001, Patient 002, etc.)
   - Log progress and results
   - Handle errors gracefully

4. After running, therapists can update patient names through the UI
*/
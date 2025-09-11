# Complete List of Stored Procedures in Supabase Database

Export Date: 2025-09-11
Total Functions: 33

## All Functions (Alphabetical)

1. **audit_patient_medical_info()** - TRIGGER - Logs changes to patient medical info for audit trail
2. **audit_patient_scoring_config_change()** - TRIGGER - Tracks when patient scoring config changes
3. **calculate_bmi_on_change()** - TRIGGER - Auto-calculates BMI and status from height/weight
4. **check_expired_consents()** - VOID - Updates expired research/data sharing consents
5. **cleanup_expired_patient_tokens()** - INTEGER - Removes expired authentication tokens
6. **copy_scoring_config_to_session()** - TRIGGER - Copies scoring config when creating session
7. **debug_storage_access(file_path text)** - JSON - Debug helper for storage permissions
8. **generate_user_code()** - TRIGGER - Auto-generates user codes (T001, R001, A001)
9. **get_current_therapist_id()** - UUID - Gets therapist ID for current authenticated user
10. **get_current_user_id()** - UUID - Returns auth.uid()
11. **get_patient_code_from_storage_path(file_path text)** - TEXT - Extracts patient code from storage path
12. **get_patient_scoring_config(p_patient_id uuid)** - UUID - Gets patient-specific scoring configuration
13. **get_session_scoring_config(p_session_id uuid, p_patient_id uuid)** - UUID - Gets appropriate scoring config for session
14. **get_user_role()** - TEXT - Returns current user's role
15. **is_assigned_to_patient(p_code text)** - BOOLEAN - Checks if therapist is assigned to patient (by code)
16. **is_assigned_to_patient(patient_uuid uuid)** - BOOLEAN - Checks if therapist is assigned to patient (by UUID)
17. **is_therapist_for_patient(patient_uuid uuid)** - BOOLEAN - Checks if user is therapist for patient
18. **set_session_therapeutic_targets(...)** - BOOLEAN - Sets therapeutic targets for session
19. **update_analysis_results_last_accessed()** - TRIGGER - Updates last accessed timestamp
20. **update_analytics_cache_last_accessed()** - TRIGGER - Updates analytics cache timestamp
21. **update_c3d_metadata_updated_at()** - TRIGGER - Updates C3D metadata timestamp
22. **update_cache_hit()** - TRIGGER - Increments cache hit counter
23. **update_clinical_notes_updated_at()** - TRIGGER - Updates clinical notes timestamp
24. **update_medical_timestamp()** - TRIGGER - Updates medical info timestamp with user ID
25. **update_patient_current_values(...)** - BOOLEAN - Updates patient MVC/duration baselines
26. **update_patient_medical_info_updated_at()** - TRIGGER - Updates patient medical info timestamp
27. **update_scoring_config_timestamp()** - TRIGGER - Updates scoring config timestamp
28. **update_therapy_sessions_last_accessed()** - TRIGGER - Updates session last accessed timestamp
29. **update_updated_at_column()** - TRIGGER - Generic timestamp updater
30. **user_owns_patient(p_code text)** - BOOLEAN - Checks if therapist owns patient
31. **validate_emg_statistics_jsonb_structure()** - TABLE - Validates EMG statistics JSON structure
32. **validate_performance_weights()** - TRIGGER - Ensures scoring weights sum to 1.0

## By Category

### Trigger Functions (19)
- audit_patient_medical_info
- audit_patient_scoring_config_change
- calculate_bmi_on_change
- copy_scoring_config_to_session
- generate_user_code
- update_analysis_results_last_accessed
- update_analytics_cache_last_accessed
- update_c3d_metadata_updated_at
- update_cache_hit
- update_clinical_notes_updated_at
- update_medical_timestamp
- update_patient_medical_info_updated_at
- update_scoring_config_timestamp
- update_therapy_sessions_last_accessed
- update_updated_at_column
- validate_performance_weights

### Regular Functions (14)
- check_expired_consents
- cleanup_expired_patient_tokens
- debug_storage_access
- get_current_therapist_id
- get_current_user_id
- get_patient_code_from_storage_path
- get_patient_scoring_config
- get_session_scoring_config
- get_user_role
- is_assigned_to_patient (2 overloads)
- is_therapist_for_patient
- set_session_therapeutic_targets
- update_patient_current_values
- user_owns_patient
- validate_emg_statistics_jsonb_structure

## Notes

- Functions with comments in the database (2):
  - get_session_scoring_config
  - update_patient_current_values
  - set_session_therapeutic_targets
  - validate_emg_statistics_jsonb_structure

- All functions are in the 'public' schema
- Most functions use SECURITY DEFINER for elevated privileges
- Trigger functions are attached to various tables for automatic updates
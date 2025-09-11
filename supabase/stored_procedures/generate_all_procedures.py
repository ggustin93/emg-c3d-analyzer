#!/usr/bin/env python3
"""
Generate SQL files for all stored procedures from Supabase database
"""

import json
import os
from pathlib import Path

# The data retrieved from Supabase
procedures_data = [
    {"function_name": "audit_patient_medical_info", "arguments": "", "return_type": "trigger", "source_code": "\nBEGIN\n    INSERT INTO public.audit_log (\n        user_id,\n        user_role,\n        action,\n        table_name,\n        record_id,\n        changes,\n        ip_address\n    ) VALUES (\n        auth.uid(),\n        COALESCE(\n            (SELECT role FROM public.user_profiles WHERE id = auth.uid()),\n            'unknown'\n        ),\n        TG_OP,\n        'patient_medical_info',\n        COALESCE(NEW.id, OLD.id),\n        CASE \n            WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD)\n            WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW)\n            ELSE jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))\n        END,\n        inet_client_addr()\n    );\n    RETURN COALESCE(NEW, OLD);\nEND;\n"},
    {"function_name": "audit_patient_scoring_config_change", "arguments": "", "return_type": "trigger", "source_code": "\nBEGIN\n    IF OLD.current_scoring_config_id IS DISTINCT FROM NEW.current_scoring_config_id THEN\n        NEW.scoring_config_updated_at = NOW();\n        -- Note: scoring_config_updated_by should be set by the application\n    END IF;\n    RETURN NEW;\nEND;\n"},
    {"function_name": "calculate_bmi_on_change", "arguments": "", "return_type": "trigger", "source_code": "\nBEGIN\n    -- Auto-calculate BMI if height and weight are provided\n    IF NEW.height_cm IS NOT NULL AND NEW.weight_kg IS NOT NULL THEN\n        NEW.bmi_value = ROUND((NEW.weight_kg / POWER(NEW.height_cm/100, 2))::numeric, 1);\n        \n        -- Auto-assign BMI status\n        NEW.bmi_status = CASE\n            WHEN NEW.bmi_value < 18.5 THEN 'underweight'\n            WHEN NEW.bmi_value >= 18.5 AND NEW.bmi_value < 25 THEN 'normal'\n            WHEN NEW.bmi_value >= 25 AND NEW.bmi_value < 30 THEN 'overweight'\n            ELSE 'obese'\n        END;\n    END IF;\n    \n    RETURN NEW;\nEND;\n"},
    {"function_name": "check_expired_consents", "arguments": "", "return_type": "void", "source_code": "\nBEGIN\n    UPDATE public.patient_medical_info \n    SET \n        consent_for_research = false,\n        consent_for_data_sharing = false\n    WHERE consent_expires_at < now() \n        AND (consent_for_research = true OR consent_for_data_sharing = true);\nEND;\n"},
    {"function_name": "cleanup_expired_patient_tokens", "arguments": "", "return_type": "integer", "source_code": "\nDECLARE\n    deleted_count INTEGER;\nBEGIN\n    DELETE FROM private.patient_auth_tokens \n    WHERE expires_at < NOW() - INTERVAL '1 hour'; -- Grace period\n    \n    GET DIAGNOSTICS deleted_count = ROW_COUNT;\n    RETURN deleted_count;\nEND;\n"},
    {"function_name": "copy_scoring_config_to_session", "arguments": "", "return_type": "trigger", "source_code": "\nBEGIN\n    -- Only set scoring_config_id if it's not already set\n    IF NEW.scoring_config_id IS NULL AND NEW.patient_id IS NOT NULL THEN\n        -- Get the appropriate config for this patient\n        NEW.scoring_config_id = get_session_scoring_config(\n            p_session_id := NULL,  -- New session, no session config yet\n            p_patient_id := NEW.patient_id\n        );\n    END IF;\n    RETURN NEW;\nEND;\n"},
    {"function_name": "debug_storage_access", "arguments": "file_path text", "return_type": "json", "source_code": "\n  DECLARE\n      patient_code TEXT;\n      current_user_id UUID;\n      therapist_id UUID;\n      owns_patient BOOLEAN;\n      result JSON;\n  BEGIN\n      -- Extract patient code from path\n      patient_code := split_part(file_path, '/', 1);\n\n      -- Get current auth context\n      current_user_id := auth.uid();\n\n      -- Get therapist ID using same logic as get_current_therapist_id\n      SELECT id INTO therapist_id\n      FROM public.user_profiles\n      WHERE id = current_user_id\n      AND role = 'therapist'\n      AND active = true\n      LIMIT 1;\n\n      -- Test ownership\n      owns_patient := public.user_owns_patient(patient_code);\n\n      -- Build debug result\n      SELECT json_build_object(\n          'file_path', file_path,\n          'patient_code', patient_code,\n          'current_user_id', current_user_id,\n          'therapist_id', therapist_id,\n          'owns_patient', owns_patient,\n          'auth_context_valid', (current_user_id IS NOT NULL),\n          'therapist_profile_found', (therapist_id IS NOT NULL)\n      ) INTO result;\n\n      RETURN result;\n  END;\n  "},
    {"function_name": "generate_user_code", "arguments": "", "return_type": "trigger", "source_code": "\nBEGIN\n    -- Only generate if user_code is not provided\n    IF NEW.user_code IS NULL THEN\n        CASE NEW.role\n            WHEN 'therapist' THEN\n                NEW.user_code := 'T' || lpad(nextval('therapist_code_seq')::text, 3, '0');\n            WHEN 'researcher' THEN\n                NEW.user_code := 'R' || lpad(nextval('researcher_code_seq')::text, 3, '0');\n            WHEN 'admin' THEN\n                NEW.user_code := 'A' || lpad(nextval('admin_code_seq')::text, 3, '0');\n            ELSE\n                -- Should not happen due to CHECK constraint on role\n                RAISE EXCEPTION 'Invalid role: %', NEW.role;\n        END CASE;\n    END IF;\n    RETURN NEW;\nEND;\n"},
    {"function_name": "get_current_therapist_id", "arguments": "", "return_type": "uuid", "source_code": "\nDECLARE\n    therapist_uuid UUID;\nBEGIN\n    -- Query the user_profiles table as per the current schema\n    SELECT id INTO therapist_uuid\n    FROM public.user_profiles\n    WHERE id = auth.uid() \n    AND role = 'therapist'\n    AND active = true\n    LIMIT 1;\n    \n    RETURN therapist_uuid;\nEND;\n"},
    {"function_name": "get_current_user_id", "arguments": "", "return_type": "uuid", "source_code": "\nBEGIN\n    RETURN auth.uid();\nEND;\n"},
    {"function_name": "get_patient_code_from_storage_path", "arguments": "file_path text", "return_type": "text", "source_code": "\n  SELECT CASE \n    WHEN file_path ~ '^P\\d+/' THEN\n      (string_to_array(file_path, '/'))[1]\n    WHEN file_path ~ '^c3d-examples/P\\d+/' THEN\n      (string_to_array(file_path, '/'))[2]\n    ELSE \n      NULL\n  END;\n"},
    {"function_name": "get_patient_scoring_config", "arguments": "p_patient_id uuid", "return_type": "uuid", "source_code": "\nDECLARE\n    v_config_id UUID;\nBEGIN\n    -- Priority 1: Check for active patient-specific configuration\n    SELECT scoring_config_id INTO v_config_id\n    FROM patient_scoring_config\n    WHERE patient_id = p_patient_id AND active = true\n    LIMIT 1;\n    \n    IF v_config_id IS NOT NULL THEN\n        RETURN v_config_id;\n    END IF;\n    \n    -- Priority 2: Return global default configuration\n    SELECT id INTO v_config_id\n    FROM scoring_configuration\n    WHERE is_global = true AND active = true\n    AND configuration_name = 'GHOSTLY+ Default'\n    LIMIT 1;\n    \n    RETURN v_config_id;\nEND;\n"},
    {"function_name": "get_session_scoring_config", "arguments": "p_session_id uuid, p_patient_id uuid", "return_type": "uuid", "source_code": "\nDECLARE\n    v_config_id uuid;\nBEGIN\n    -- Priority 1: Check if session already has a scoring_config_id (immutable for historical accuracy)\n    IF p_session_id IS NOT NULL THEN\n        SELECT scoring_config_id INTO v_config_id\n        FROM public.therapy_sessions\n        WHERE id = p_session_id\n        LIMIT 1;\n        \n        IF v_config_id IS NOT NULL THEN\n            RETURN v_config_id;\n        END IF;\n    END IF;\n    \n    -- Priority 2: Check patient's current scoring configuration\n    IF p_patient_id IS NOT NULL THEN\n        SELECT current_scoring_config_id INTO v_config_id\n        FROM public.patients\n        WHERE id = p_patient_id\n        LIMIT 1;\n        \n        IF v_config_id IS NOT NULL THEN\n            RETURN v_config_id;\n        END IF;\n    END IF;\n    \n    -- Priority 3: Get the active global default (GHOSTLY-TRIAL-DEFAULT)\n    SELECT id INTO v_config_id\n    FROM public.scoring_configuration\n    WHERE name = 'GHOSTLY-TRIAL-DEFAULT' \n        AND active = true\n    ORDER BY created_at DESC\n    LIMIT 1;\n    \n    IF v_config_id IS NOT NULL THEN\n        RETURN v_config_id;\n    END IF;\n    \n    -- Priority 4: Get any active configuration as last resort\n    SELECT id INTO v_config_id\n    FROM public.scoring_configuration\n    WHERE active = true\n    ORDER BY created_at DESC\n    LIMIT 1;\n    \n    RETURN v_config_id;\nEND;\n"},
    {"function_name": "get_user_role", "arguments": "", "return_type": "text", "source_code": "\nBEGIN\n    RETURN COALESCE(\n        (SELECT role FROM public.user_profiles WHERE id = auth.uid()),\n        'anonymous'\n    );\nEND;\n"},
    {"function_name": "is_assigned_to_patient", "arguments": "p_code text", "return_type": "boolean", "source_code": "\nBEGIN\n    RETURN public.user_owns_patient(p_code);\nEND;\n"},
    {"function_name": "is_assigned_to_patient", "arguments": "patient_uuid uuid", "return_type": "boolean", "source_code": "\nDECLARE\n    is_assigned BOOLEAN;\nBEGIN\n    SELECT EXISTS (\n        SELECT 1\n        FROM public.patients\n        WHERE id = patient_uuid AND therapist_id = public.get_current_therapist_id()\n    ) INTO is_assigned;\n    RETURN is_assigned;\nEND;\n"},
    {"function_name": "is_therapist_for_patient", "arguments": "patient_uuid uuid", "return_type": "boolean", "source_code": "\nBEGIN\n    RETURN EXISTS (\n        SELECT 1 FROM public.patients \n        WHERE id = patient_uuid AND therapist_id = auth.uid()\n    );\nEND;\n"},
    {"function_name": "set_session_therapeutic_targets", "arguments": "p_session_id uuid, p_target_mvc_ch1 double precision, p_target_mvc_ch2 double precision, p_target_duration_ch1 double precision, p_target_duration_ch2 double precision", "return_type": "boolean", "source_code": "\nBEGIN\n    UPDATE public.session_settings \n    SET \n        target_mvc_ch1 = COALESCE(p_target_mvc_ch1, target_mvc_ch1),\n        target_mvc_ch2 = COALESCE(p_target_mvc_ch2, target_mvc_ch2),\n        target_duration_ch1 = COALESCE(p_target_duration_ch1, target_duration_ch1),\n        target_duration_ch2 = COALESCE(p_target_duration_ch2, target_duration_ch2),\n        updated_at = NOW()\n    WHERE session_id = p_session_id;\n    \n    RETURN FOUND;\nEND;\n"},
    {"function_name": "update_analysis_results_last_accessed", "arguments": "", "return_type": "trigger", "source_code": "\nBEGIN\n    NEW.last_accessed_at = NOW();\n    RETURN NEW;\nEND;\n"},
    {"function_name": "update_analytics_cache_last_accessed", "arguments": "", "return_type": "trigger", "source_code": "\nBEGIN\n    NEW.last_accessed_at = NOW();\n    RETURN NEW;\nEND;\n"},
    {"function_name": "update_c3d_metadata_updated_at", "arguments": "", "return_type": "trigger", "source_code": "\nBEGIN\n    NEW.updated_at = NOW();\n    RETURN NEW;\nEND;\n"},
    {"function_name": "update_cache_hit", "arguments": "", "return_type": "trigger", "source_code": "\nBEGIN\n    NEW.cache_hits = OLD.cache_hits + 1;\n    NEW.last_accessed_at = NOW();\n    RETURN NEW;\nEND;\n"},
    {"function_name": "update_clinical_notes_updated_at", "arguments": "", "return_type": "trigger", "source_code": "\nBEGIN\n  NEW.updated_at = NOW();\n  RETURN NEW;\nEND;\n"},
    {"function_name": "update_medical_timestamp", "arguments": "", "return_type": "trigger", "source_code": "\nBEGIN\n  NEW.updated_at = now();\n  NEW.updated_by = auth.uid();\n  RETURN NEW;\nEND;\n"},
    {"function_name": "update_patient_current_values", "arguments": "p_patient_id uuid, p_mvc_ch1 double precision, p_mvc_ch2 double precision, p_duration_ch1 double precision, p_duration_ch2 double precision", "return_type": "boolean", "source_code": "\nBEGIN\n    UPDATE public.patients \n    SET \n        current_mvc_ch1 = COALESCE(p_mvc_ch1, current_mvc_ch1),\n        current_mvc_ch2 = COALESCE(p_mvc_ch2, current_mvc_ch2),\n        current_duration_ch1 = COALESCE(p_duration_ch1, current_duration_ch1),\n        current_duration_ch2 = COALESCE(p_duration_ch2, current_duration_ch2),\n        last_assessment_date = NOW(),\n        updated_at = NOW()\n    WHERE id = p_patient_id;\n    \n    RETURN FOUND;\nEND;\n"},
    {"function_name": "update_patient_medical_info_updated_at", "arguments": "", "return_type": "trigger", "source_code": "\nBEGIN\n    NEW.updated_at = now();\n    -- Only update updated_by if we have an authenticated user\n    IF auth.uid() IS NOT NULL THEN\n        NEW.updated_by = auth.uid();\n    END IF;\n    RETURN NEW;\nEND;\n"},
    {"function_name": "update_scoring_config_timestamp", "arguments": "", "return_type": "trigger", "source_code": "\nBEGIN\n    NEW.updated_at = NOW();\n    RETURN NEW;\nEND;\n"},
    {"function_name": "update_therapy_sessions_last_accessed", "arguments": "", "return_type": "trigger", "source_code": "\nBEGIN\n    NEW.last_accessed_at = NOW();\n    RETURN NEW;\nEND;\n"},
    {"function_name": "update_updated_at_column", "arguments": "", "return_type": "trigger", "source_code": "\nBEGIN\n    NEW.updated_at = NOW();\n    RETURN NEW;\nEND;\n"},
    {"function_name": "user_owns_patient", "arguments": "p_code text", "return_type": "boolean", "source_code": "\n  DECLARE\n      current_therapist_id UUID;\n  BEGIN\n      -- Use the same logic as get_current_therapist_id for consistency\n      SELECT id INTO current_therapist_id\n      FROM public.user_profiles\n      WHERE id = auth.uid()\n      AND role = 'therapist'\n      AND active = true\n      LIMIT 1;\n\n      -- If no valid therapist found, return false\n      IF current_therapist_id IS NULL THEN\n          RETURN FALSE;\n      END IF;\n\n      -- Check if the current therapist owns the patient\n      RETURN EXISTS (\n          SELECT 1\n          FROM public.patients p\n          WHERE p.patient_code = p_code\n            AND p.therapist_id = current_therapist_id\n      );\n  END;\n  "},
    {"function_name": "validate_emg_statistics_jsonb_structure", "arguments": "", "return_type": "TABLE(session_id uuid, channel_name text, has_quality_metrics boolean, has_overall_compliant boolean, overall_compliant_value integer)", "source_code": "\nBEGIN\n    RETURN QUERY\n    SELECT \n        es.session_id,\n        es.channel_name,\n        (es.contraction_quality_metrics IS NOT NULL AND es.contraction_quality_metrics != '{}') as has_quality_metrics,\n        (es.contraction_quality_metrics ? 'overall_compliant_contractions') as has_overall_compliant,\n        CAST(es.contraction_quality_metrics->>'overall_compliant_contractions' AS INTEGER) as overall_compliant_value\n    FROM public.emg_statistics es\n    ORDER BY es.session_id, es.channel_name;\nEND;\n"},
    {"function_name": "validate_performance_weights", "arguments": "", "return_type": "trigger", "source_code": "\nDECLARE\n  weight_sum FLOAT;\nBEGIN\n  -- Extract and sum all weight values from JSONB\n  SELECT \n    COALESCE((NEW.performance_weights->>'compliance')::FLOAT, 0) +\n    COALESCE((NEW.performance_weights->>'symmetry')::FLOAT, 0) +  \n    COALESCE((NEW.performance_weights->>'effort')::FLOAT, 0) +\n    COALESCE((NEW.performance_weights->>'game')::FLOAT, 0)\n  INTO weight_sum;\n  \n  -- Validate weights sum to approximately 1.0 (allow small floating point errors)\n  IF ABS(weight_sum - 1.0) > 0.01 THEN\n    RAISE EXCEPTION 'Performance weights must sum to 1.0, got %', weight_sum;\n  END IF;\n  \n  RETURN NEW;\nEND;\n"}
]

def generate_sql_file(func_data, output_dir):
    """Generate a SQL file for a stored procedure"""
    
    func_name = func_data['function_name']
    arguments = func_data['arguments']
    return_type = func_data['return_type']
    source_code = func_data['source_code']
    
    # Determine if it's a trigger function
    is_trigger = return_type.lower() == 'trigger'
    
    # Clean up arguments for display
    if arguments:
        # Handle overloaded functions
        if func_name == 'is_assigned_to_patient':
            if 'p_code' in arguments:
                filename = f"{func_name}_by_code.sql"
            else:
                filename = f"{func_name}_by_uuid.sql"
        else:
            filename = f"{func_name}.sql"
    else:
        filename = f"{func_name}.sql"
    
    # Build the SQL content
    sql_content = f"""-- Function: {func_name}
-- Type: {'TRIGGER' if is_trigger else 'FUNCTION'}
-- Returns: {return_type}
"""
    
    if arguments:
        sql_content += f"-- Arguments: {arguments}\n"
    
    # Add purpose based on function name patterns
    if 'update_' in func_name and is_trigger:
        sql_content += f"-- Purpose: Automatically updates timestamp fields\n"
    elif 'validate_' in func_name:
        sql_content += f"-- Purpose: Validates data integrity\n"
    elif 'get_' in func_name:
        sql_content += f"-- Purpose: Retrieves data based on current context\n"
    elif 'is_' in func_name or 'user_owns' in func_name:
        sql_content += f"-- Purpose: Authorization check\n"
    
    sql_content += "\n"
    
    # Build the CREATE FUNCTION statement
    sql_content += f"CREATE OR REPLACE FUNCTION public.{func_name}("
    
    if arguments:
        sql_content += f"\n    {arguments}"
    
    sql_content += ")\n"
    sql_content += f"RETURNS {return_type}\n"
    
    # Determine language from source code
    if source_code.strip().startswith('SELECT'):
        sql_content += "LANGUAGE sql\n"
    else:
        sql_content += "LANGUAGE plpgsql\n"
    
    sql_content += "SECURITY DEFINER\n"
    sql_content += f"AS $$"
    sql_content += source_code
    sql_content += "$$;\n"
    
    # Add example usage for non-trigger functions
    if not is_trigger:
        sql_content += "\n-- Example usage:\n"
        if 'get_user_role' in func_name:
            sql_content += "-- SELECT get_user_role();\n"
        elif 'user_owns_patient' in func_name:
            sql_content += "-- SELECT user_owns_patient('P001');\n"
        elif 'update_patient' in func_name:
            sql_content += "-- SELECT update_patient_current_values('uuid-here', 80.5, 75.0, 3000, 2500);\n"
        elif arguments:
            sql_content += f"-- SELECT {func_name}(...);\n"
        else:
            sql_content += f"-- SELECT {func_name}();\n"
    else:
        sql_content += "\n-- Trigger usage:\n"
        sql_content += f"-- CREATE TRIGGER trigger_name\n"
        sql_content += f"-- BEFORE INSERT OR UPDATE ON table_name\n"
        sql_content += f"-- FOR EACH ROW EXECUTE FUNCTION {func_name}();\n"
    
    # Write to file
    filepath = output_dir / filename
    with open(filepath, 'w') as f:
        f.write(sql_content)
    
    return filename

# Create output directories
base_dir = Path('/Users/pwablo/Documents/GitHub/emg-c3d-analyzer/supabase/stored_procedures')
trigger_dir = base_dir / 'triggers'
functions_dir = base_dir / 'functions'

trigger_dir.mkdir(exist_ok=True)
functions_dir.mkdir(exist_ok=True)

# Generate files
triggers = []
functions = []

for proc in procedures_data:
    if proc['return_type'].lower() == 'trigger':
        filename = generate_sql_file(proc, trigger_dir)
        triggers.append(filename)
    else:
        filename = generate_sql_file(proc, functions_dir)
        functions.append(filename)

print(f"Generated {len(triggers)} trigger functions in /triggers/")
print(f"Generated {len(functions)} regular functions in /functions/")
print(f"Total: {len(triggers) + len(functions)} SQL files created")
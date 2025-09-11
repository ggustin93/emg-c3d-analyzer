-- Function: validate_emg_statistics_jsonb_structure
-- Type: FUNCTION
-- Returns: TABLE(session_id uuid, channel_name text, has_quality_metrics boolean, has_overall_compliant boolean, overall_compliant_value integer)
-- Purpose: Validates data integrity

CREATE OR REPLACE FUNCTION public.validate_emg_statistics_jsonb_structure()
RETURNS TABLE(session_id uuid, channel_name text, has_quality_metrics boolean, has_overall_compliant boolean, overall_compliant_value integer)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        es.session_id,
        es.channel_name,
        (es.contraction_quality_metrics IS NOT NULL AND es.contraction_quality_metrics != '{}') as has_quality_metrics,
        (es.contraction_quality_metrics ? 'overall_compliant_contractions') as has_overall_compliant,
        CAST(es.contraction_quality_metrics->>'overall_compliant_contractions' AS INTEGER) as overall_compliant_value
    FROM public.emg_statistics es
    ORDER BY es.session_id, es.channel_name;
END;
$$;

-- Example usage:
-- SELECT validate_emg_statistics_jsonb_structure();

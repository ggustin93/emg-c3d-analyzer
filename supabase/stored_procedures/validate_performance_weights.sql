-- Function: validate_performance_weights
-- Purpose: Ensures that performance scoring weights sum to 1.0
-- Type: TRIGGER function
-- Used on: scoring_configuration table
-- Returns: TRIGGER
-- Raises: EXCEPTION if weights don't sum to 1.0 (±0.01 tolerance)

CREATE OR REPLACE FUNCTION public.validate_performance_weights()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  weight_sum FLOAT;
BEGIN
  -- Extract and sum all weight values from JSONB
  SELECT 
    COALESCE((NEW.performance_weights->>'compliance')::FLOAT, 0) +
    COALESCE((NEW.performance_weights->>'symmetry')::FLOAT, 0) +  
    COALESCE((NEW.performance_weights->>'effort')::FLOAT, 0) +
    COALESCE((NEW.performance_weights->>'game')::FLOAT, 0)
  INTO weight_sum;
  
  -- Validate weights sum to approximately 1.0 (allow small floating point errors)
  IF ABS(weight_sum - 1.0) > 0.01 THEN
    RAISE EXCEPTION 'Performance weights must sum to 1.0, got %', weight_sum;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Example trigger usage:
-- CREATE TRIGGER validate_weights_trigger
-- BEFORE INSERT OR UPDATE ON scoring_configuration
-- FOR EACH ROW EXECUTE FUNCTION validate_performance_weights();
-- Function: get_patient_code_from_storage_path
-- Type: FUNCTION
-- Returns: text
-- Arguments: file_path text
-- Purpose: Retrieves data based on current context

CREATE OR REPLACE FUNCTION public.get_patient_code_from_storage_path(
    file_path text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT CASE 
    WHEN file_path ~ '^P\d+/' THEN
      (string_to_array(file_path, '/'))[1]
    WHEN file_path ~ '^c3d-examples/P\d+/' THEN
      (string_to_array(file_path, '/'))[2]
    ELSE 
      NULL
  END;
$$;

-- Example usage:
-- SELECT get_patient_code_from_storage_path(...);

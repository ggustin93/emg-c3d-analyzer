/**
 * Navigation Utilities for EMG C3D Analyzer
 * 
 * Centralized navigation logic following DRY principle
 * Single Source of Truth for URL construction
 */

import { NavigateFunction } from 'react-router-dom';

/**
 * Navigate to the analysis page with a C3D file
 * 
 * @param navigate - React Router navigation function
 * @param filename - C3D filename (may include patient folder prefix)
 * 
 * Note: Session timestamp is embedded in the filename itself
 * Example: Ghostly_Emg_20250115_10-30-00-1234_test.c3d contains timestamp 20250115
 * No need for separate date parameter (SSoT principle)
 */
export const navigateToAnalysis = (navigate: NavigateFunction, filename: string): void => {
  const encodedFilename = encodeURIComponent(filename);
  navigate(`/analysis?file=${encodedFilename}`);
};

/**
 * Extract query parameters from URL
 * Helper function for parsing analysis page parameters
 */
export const getAnalysisParams = (searchParams: URLSearchParams): { filename: string | null } => {
  return {
    filename: searchParams.get('file')
  };
};
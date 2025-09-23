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
 * Example: test_session_1758297752_65757a7d.c3d contains timestamp 1758297752
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
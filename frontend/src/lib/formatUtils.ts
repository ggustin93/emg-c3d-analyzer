/**
 * Unified formatting utilities for consistent display across the application
 * Single source of truth for number formatting, rounding, and display logic
 */

/**
 * Format a percentage value with consistent rounding
 * @param value - The decimal value (0-1) or percentage value (0-100)
 * @param isDecimal - Whether the input is a decimal (0-1) or percentage (0-100)
 * @param decimals - Number of decimal places to show (default: 0 for clean display)
 * @returns Formatted percentage string (e.g., "92%")
 */
export function formatPercentage(
  value: number | null | undefined,
  isDecimal: boolean = false,
  decimals: number = 0
): string {
  if (value === null || value === undefined) {
    return '--';
  }

  // Convert decimal to percentage if needed
  const percentage = isDecimal ? value * 100 : value;
  
  // Round to specified decimal places
  const rounded = Number(percentage.toFixed(decimals));
  
  return `${rounded}%`;
}

/**
 * Round a percentage value consistently
 * @param value - The percentage value to round
 * @returns Rounded integer percentage
 */
export function roundPercentage(value: number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  return Math.round(value);
}

/**
 * Format a number with appropriate precision for medical/clinical display
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted number string
 */
export function formatClinicalValue(
  value: number | null | undefined,
  decimals: number = 1
): string {
  if (value === null || value === undefined) {
    return '--';
  }
  return Number(value.toFixed(decimals)).toString();
}

/**
 * Format points/scores for performance display
 * @param value - The points value (can be decimal from weighted calculations)
 * @returns Formatted points string (e.g., "+25 pts")
 */
export function formatPoints(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) {
    return '+0 pts';
  }
  // Round to nearest integer for display, but handle small decimals
  const rounded = Math.round(value);
  // If rounding results in 0 but value is positive, show at least 1
  const displayValue = rounded === 0 && value > 0 ? 1 : rounded;
  return `+${displayValue} pts`;
}

/**
 * Ensure a percentage value stays within bounds and is properly formatted
 * @param value - The percentage value
 * @param min - Minimum allowed value (default: 0)
 * @param max - Maximum allowed value (default: 100)
 * @returns Bounded percentage value
 */
export function clampPercentage(
  value: number,
  min: number = 0,
  max: number = 100
): number {
  return Math.max(min, Math.min(max, value));
}
/**
 * A collection of utility functions for formatting data for display.
 */

interface FormatOptions {
  precision?: number;
  useScientificNotation?: boolean;
  isInteger?: boolean;
}

/**
 * Formats a numeric value for display in a metric card.
 * - Handles integers, floats, and scientific notation.
 * - Limits precision for readability.
 *
 * @param value The numeric value to format.
 * @param options Formatting options.
 * @returns A formatted string representation of the value.
 */
export const formatMetricValue = (
  value: number | null | undefined,
  options: FormatOptions = {}
): string => {
  const { precision = 2, useScientificNotation = false, isInteger = false } = options;

  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }

  if (isInteger) {
    return value.toString();
  }

  // Always check for scientific notation first if the flag is set.
  if (useScientificNotation) {
    // For any non-zero value smaller than 0.01, use exponential form to avoid rounding to zero.
    if (Math.abs(value) < 0.01 && value !== 0) {
      return value.toExponential(precision);
    }
  }

  // For all other numbers, use standard fixed precision.
  return value.toFixed(precision);
};

/**
 * Formats a duration given in milliseconds into human-friendly parts.
 * - Uses seconds when value ≥ 1000 ms, otherwise keeps milliseconds
 * - Returns both numeric value and unit so callers can format consistently
 */
export function formatDurationParts(
  ms: number | null | undefined,
  options: { secondThreshold?: number; precisionSeconds?: number; precisionMs?: number } = {}
): { value: number | null; unit: 'ms' | 's'; precision: number; text: string } {
  const { secondThreshold = 1000, precisionSeconds = 1, precisionMs = 1 } = options;

  if (ms === null || ms === undefined || isNaN(ms)) {
    return { value: null, unit: 'ms', precision: precisionMs, text: '—' };
  }

  if (ms >= secondThreshold) {
    const seconds = ms / 1000;
    const text = `${seconds.toFixed(precisionSeconds)} s`;
    return { value: seconds, unit: 's', precision: precisionSeconds, text };
  }

  const text = `${ms.toFixed(precisionMs)} ms`;
  return { value: ms, unit: 'ms', precision: precisionMs, text };
}
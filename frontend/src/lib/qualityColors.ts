// Centralized, accessible color tokens for contraction quality visuals
// These colors are tuned for contrast on light backgrounds and consistency across the UI

export type ContractionQualityFlags = {
  isGood: boolean;
  meetsMvc: boolean;
  meetsDuration: boolean;
};

export type QualityColors = {
  fill: string;
  stroke: string;
};

export const QUALITY_COLORS = {
  good: { fill: 'rgba(16,185,129,0.28)', stroke: '#047857' }, // emerald-500 fill, emerald-700 stroke
  adequate: { fill: 'rgba(245,158,11,0.24)', stroke: '#b45309' }, // amber-500 fill, amber-700 stroke
  poor: { fill: 'rgba(239,68,68,0.24)', stroke: '#b91c1c' } // red-500 fill, red-700 stroke
} as const;

export function getContractionAreaColors(flags: ContractionQualityFlags): QualityColors {
  if (flags.isGood) {
    return QUALITY_COLORS.good;
  }
  if ((flags.meetsMvc && !flags.meetsDuration) || (!flags.meetsMvc && flags.meetsDuration)) {
    return QUALITY_COLORS.adequate;
  }
  return QUALITY_COLORS.poor;
}

export function getContractionDotStyle(flags: ContractionQualityFlags): QualityColors & { symbol: string } {
  if (flags.isGood) {
    return { ...QUALITY_COLORS.good, symbol: '✓' };
  }
  if (flags.meetsMvc && !flags.meetsDuration) {
    return { ...QUALITY_COLORS.adequate, symbol: 'F' }; // Adequate force
  }
  if (flags.meetsDuration && !flags.meetsMvc) {
    return { ...QUALITY_COLORS.adequate, symbol: 'D' }; // Adequate duration
  }
  return { ...QUALITY_COLORS.poor, symbol: '✗' };
}



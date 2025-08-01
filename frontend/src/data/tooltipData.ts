// Tooltip data constants for clinical tooltips
// Separates data from presentation logic for better maintainability

export interface TooltipData {
  title: string;
  description: string;
  sections: Array<{
    title?: string;
    type?: 'list' | 'table' | 'formula';
    items: Array<{
      label?: string;
      value?: string | number;
      percentage?: string | number;
      color?: string;
      description?: string;
      icon?: string;
    }>;
  }>;
}

// Muscle Compliance Tooltip Data
export const getComplianceTooltipData = (
  completionWeight: number = 1/3,
  intensityWeight: number = 1/3,
  durationWeight: number = 1/3,
  durationThreshold: number = 2000
): TooltipData => {
  const completionPct = (completionWeight * 100).toFixed(1);
  const intensityPct = (intensityWeight * 100).toFixed(1);
  const durationPct = (durationWeight * 100).toFixed(1);
  const durationThresholdSec = (durationThreshold / 1000).toFixed(1);

  return {
    title: "Muscle Compliance Score",
    description: "How well exercises were performed for this muscle",
    sections: [
      {
        title: "Formula:",
        type: "formula",
        items: [
          { 
            label: "S", 
            value: ` = ${completionPct}%·R<sub>completion</sub> + ${intensityPct}%·R<sub>intensity</sub> + ${durationPct}%·R<sub>duration</sub>` 
          }
        ]
      },
      {
        title: "Components:",
        type: "list",
        items: [
          { label: "Completion", description: `${completionPct}% weight · Contractions done/expected (12)` },
          { label: "Intensity", description: `${intensityPct}% weight · Contractions ≥75% MVC` },
          { label: "Duration", description: `${durationPct}% weight · Contractions ≥${durationThresholdSec}s` }
        ]
      },
      {
        title: "Score Interpretation:",
        type: "list",
        items: [
          { percentage: "90-100", description: "Excellent", color: "text-emerald-600" },
          { percentage: "80-89", description: "Good", color: "text-green-600" },
          { percentage: "70-79", description: "Fair", color: "text-yellow-600" },
          { percentage: "<70", description: "Needs improvement", color: "text-red-600" }
        ]
      }
    ]
  };
};

// Completion Rate Tooltip Data
export const completionRateTooltipData: TooltipData = {
  title: "Exercise Completion",
  description: "Exercise adherence within the session",
  sections: [
    {
      title: "Formula:",
      type: "formula",
      items: [
        { value: "R<sub>completion</sub> = contractions<sub>performed</sub> / contractions<sub>expected</sub>" }
      ]
    },
    {
      title: "GHOSTLY+ Protocol:",
      type: "list",
      items: [
        { description: "Expected: 12 contractions per muscle (6 short + 6 long)" },
        { description: "Detection: EMG amplitude & duration thresholds" },
        { description: "Target: ≥92% completion (≥11/12)" }
      ]
    }
  ]
};

// Intensity Quality Tooltip Data
export const intensityQualityTooltipData: TooltipData = {
  title: "Exercise Intensity",
  description: "Therapeutic intensity effectiveness",
  sections: [
    {
      title: "Formula:",
      type: "formula",
      items: [
        { value: "R<sub>intensity</sub> = contractions<sub>≥75% MVC</sub> / total<sub>contractions</sub>" }
      ]
    },
    {
      title: "Clinical Threshold:",
      type: "list",
      items: [
        { description: "MVC threshold: ≥75% of maximum voluntary contraction" },
        { description: "Target: ≥80% of contractions meet intensity requirement" }
      ]
    },
    {
      title: "Purpose:",
      type: "list",
      items: [
        { description: "Ensures sufficient muscle activation for strength adaptation" }
      ]
    }
  ]
};

// Duration Quality Tooltip Data
export const getDurationQualityTooltipData = (
  contractionDurationThreshold: number = 2000
): TooltipData => ({
  title: "Exercise Duration",
  description: "Contraction endurance quality",
  sections: [
    {
      title: "Formula:",
      type: "formula",
      items: [
        { value: `R<sub>duration</sub> = contractions<sub>≥${(contractionDurationThreshold / 1000).toFixed(1)}s</sub> / total<sub>contractions</sub>` }
      ]
    },
    {
      title: "Clinical Parameters:",
      type: "list",
      items: [
        { description: `Duration threshold: ≥${(contractionDurationThreshold / 1000).toFixed(1)}s (${contractionDurationThreshold}ms)` },
        { description: "Target: ≥90% of contractions meet duration requirement" },
        { description: "Progressive increase: 2-10s over treatment course" }
      ]
    },
    {
      title: "Purpose:",
      type: "list",
      items: [
        { description: "Assesses muscle endurance and motor control quality" }
      ]
    }
  ]
});

// Muscle Symmetry Tooltip Data
export const muscleSymmetryTooltipData: TooltipData = {
  title: "Muscle Symmetry Score",
  description: "Bilateral balance assessment",
  sections: [
    {
      title: "Formula:",
      type: "formula",
      items: [
        { value: "S<sub>symmetry</sub> = (1 - |Left - Right| / (Left + Right)) × 100" }
      ]
    },
    {
      title: "Interpretation:",
      type: "list",
      items: [
        { percentage: "90-100", description: "Excellent balance", color: "text-emerald-600" },
        { percentage: "70-89", description: "Minor imbalance", color: "text-yellow-600" },
        { percentage: "<70", description: "Significant imbalance", color: "text-red-600" }
      ]
    }
  ]
};

// RPE Score Tooltip Data
export const rpeScoreTooltipData: TooltipData = {
  title: "Subjective Effort Score",
  description: "Patient-reported exertion (Borg CR10 Scale)",
  sections: [
    {
      title: "Formula:",
      type: "formula",
      items: [
        { value: "S<sub>effort</sub> = f(RPE<sub>post</sub>) where RPE<sub>post</sub> ∈ [0,10]" }
      ]
    },
    {
      title: "Scoring:",
      type: "list",
      items: [
        { label: "RPE 4-6", description: "Optimal stimulus (100%)", color: "text-emerald-600" },
        { label: "RPE 3, 7", description: "Acceptable (80%)", color: "text-green-600" },
        { label: "RPE 2, 8", description: "Suboptimal (60%)", color: "text-yellow-600" },
        { label: "RPE 0-1, 9-10", description: "Poor (20%)", color: "text-red-600" }
      ]
    },
    {
      title: "Implementation:",
      type: "list",
      items: [
        { description: "Post-session RPE only" },
        { description: "Target RPE 4-6 for therapeutic benefit" },
        { description: "20% weight in overall performance" }
      ]
    }
  ]
};

// GHOSTLY Game Score Tooltip Data
export const getGhostlyScoreTooltipData = (
  gameScore: number = 0,
  gameLevel?: number,
  normalizedScore: number = 0,
  showExperimental: boolean = false
): TooltipData => ({
  title: "Game Performance Score",
  description: "Engagement metric with Dynamic Difficulty Adjustment",
  sections: [
    {
      title: "Formula:",
      type: "formula",
      items: [
        { value: "S<sub>game</sub> = game<sub>points</sub> / max<sub>achievable</sub> × 100" }
      ]
    },
    {
      type: "table",
      items: [
        { label: "Raw Score", value: `${gameScore} pts` },
        ...(gameLevel ? [{ label: "Difficulty Level", value: gameLevel }] : []),
        { label: "Normalized", value: `${normalizedScore.toFixed(0)}%` }
      ]
    },
    {
      type: "list",
      items: [
        showExperimental 
          ? { description: "⚠️ Experimental - not included in Overall Performance", color: "text-amber-700" }
          : { description: "✓ Engagement metric with 15% weight", color: "text-emerald-700" }
      ]
    }
  ]
});

// BFR Applied Pressure Tooltip Data
export const getAppliedPressureTooltipData = (pressureValue?: number): TooltipData => ({
  title: "Applied Pressure",
  description: "Actual therapeutic pressure applied during BFR training",
  sections: [
    {
      title: "Definition:",
      type: "list",
      items: [
        { description: "Actual cuff pressure delivered to patient's limb" },
        { description: "Measured in millimeters of mercury (mmHg)" },
        { description: "Calculated as percentage of patient's individual AOP" }
      ]
    },
    {
      title: "Application:",
      type: "list",
      items: [
        { description: "Applied via pneumatic cuff around proximal limb" },
        { description: "Partially restricts arterial blood flow during exercise" },
        { description: "Creates hypoxic environment promoting adaptation" }
      ]
    },
    ...(pressureValue ? [{
      title: "Current Session:",
      type: "table" as const,
      items: [
        { label: "Applied Pressure", value: `${pressureValue} mmHg` }
      ]
    }] : []),
    {
      title: "Safety:",
      type: "list",
      items: [
        { description: "Must remain within therapeutic range (40-60% AOP)" },
        { description: "Continuously monitored for patient safety" },
        { description: "Immediately adjustable if pressure drifts" }
      ]
    }
  ]
});

// AOP Tooltip Data
export const getAOPTooltipData = (aopValue?: number): TooltipData => ({
  title: "AOP - Arterial Occlusion Pressure",
  description: "Minimum pressure to completely stop arterial blood flow",
  sections: [
    {
      title: "Measurement:",
      type: "list",
      items: [
        { description: "Determined using Doppler ultrasound during assessment" },
        { description: "Individual measurement for each patient and limb" },
        { description: "Typically ranges 120-250 mmHg depending on anatomy" },
        { description: "Measured at rest before therapeutic intervention" }
      ]
    },
    {
      title: "Influencing Factors:",
      type: "list",
      items: [
        { description: "Limb circumference and muscle mass" },
        { description: "Patient age and cardiovascular status" },
        { description: "Cuff width and positioning" },
        { description: "Individual anatomical variations" }
      ]
    },
    ...(aopValue ? [{
      title: "Patient-Specific:",
      type: "table" as const,
      items: [
        { label: "AOP", value: `${aopValue} mmHg` }
      ]
    }] : []),
    {
      title: "Significance:",
      type: "list",
      items: [
        { description: "Baseline for calculating safe therapeutic pressures" },
        { description: "Ensures individualized BFR prescription" },
        { description: "Critical for maintaining efficacy and safety" }
      ]
    }
  ]
});
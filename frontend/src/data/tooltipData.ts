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
    description: "Measures how well exercises were performed for a specific muscle, based on completion, intensity, and duration.",
    sections: [
      {
        title: "Formula",
        type: "formula",
        items: [
          { 
            label: "S<sub>muscle</sub>", 
            value: ` = ${completionPct}% · C + ${intensityPct}% · I + ${durationPct}% · D` 
          }
        ]
      },
      {
        title: "Components",
        type: "list",
        items: [
          { label: "C (Completion)", description: `Percentage of expected contractions performed.` },
          { label: "I (Intensity)", description: `Percentage of contractions meeting the ≥75% MVC target.` },
          { label: "D (Duration)", description: `Percentage of contractions held for at least ${durationThresholdSec}s.` }
        ]
      },
      {
        title: "Interpretation",
        type: "table",
        items: [
          { label: "90-100%", value: "Excellent", color: "text-emerald-600" },
          { label: "80-89%", value: "Good", color: "text-green-600" },
          { label: "70-79%", value: "Fair", color: "text-yellow-600" },
          { label: "<70%", value: "Needs Improvement", color: "text-red-600" }
        ]
      }
    ]
  };
};

// NEW: Overall Performance Score Tooltip Data
export const getOverallPerformanceScoreTooltipData = (
  complianceWeight?: number,
  symmetryWeight?: number,
  effortScoreWeight?: number,
  gameScoreWeight?: number
): TooltipData => {
  // Provide default weights if none are passed (using current system defaults)
  const cWeight = complianceWeight ?? 0.45;
  const sWeight = symmetryWeight ?? 0.30;
  const effortWeight = effortScoreWeight ?? 0.25;
  const gameWeight = gameScoreWeight ?? 0.00;

  // Build formula components dynamically based on non-zero weights
  const formulaComponents = [];
  const componentDescriptions = [];
  
  if (cWeight > 0) {
    formulaComponents.push(`${(cWeight * 100).toFixed(0)}% · S<sub>compliance</sub>`);
    componentDescriptions.push({ label: "Therapeutic Compliance", description: `(${(cWeight * 100).toFixed(0)}% weight) Completion, intensity, and duration quality.` });
  }
  
  if (sWeight > 0) {
    formulaComponents.push(`${(sWeight * 100).toFixed(0)}% · S<sub>symmetry</sub>`);
    componentDescriptions.push({ label: "Muscle Symmetry", description: `(${(sWeight * 100).toFixed(0)}% weight) Balance between left and right muscles.` });
  }
  
  if (effortWeight > 0) {
    formulaComponents.push(`${(effortWeight * 100).toFixed(0)}% · S<sub>effort</sub>`);
    componentDescriptions.push({ label: "Effort Score", description: `(${(effortWeight * 100).toFixed(0)}% weight) Patient-reported exertion (RPE).` });
  }
  
  if (gameWeight > 0) {
    formulaComponents.push(`${(gameWeight * 100).toFixed(0)}% · S<sub>game</sub>`);
    componentDescriptions.push({ label: "Game Score", description: `(${(gameWeight * 100).toFixed(0)}% weight) In-game performance metric.` });
  }

  return {
    title: "Overall Performance Score",
    description: "A composite score (0-100) measuring the overall quality of the therapy session. Higher scores indicate better therapeutic engagement.",
    sections: [
      {
        title: "Formula",
        type: "formula",
        items: [
          { 
            label: "S<sub>overall</sub>", 
            value: ` = ${formulaComponents.join(' + ')}`
          }
        ]
      },
      {
        title: "Components",
        type: "list",
        items: componentDescriptions
      },
      {
        type: "list",
        items: [
            { description: "Note: Component weights are configurable by the therapist in the session settings."}
        ]
      }
    ]
  };
};


// Completion Rate Tooltip Data
export const completionRateTooltipData: TooltipData = {
  title: "Exercise Completion",
  description: "Measures adherence to the prescribed number of contractions.",
  sections: [
    {
      title: "Formula",
      type: "formula",
      items: [
        { value: "R<sub>completion</sub> = performed / expected" }
      ]
    },
    {
      title: "GHOSTLY+ Protocol",
      type: "list",
      items: [
        { description: "Expected: 12 contractions per muscle." },
      ]
    }
  ]
};

// Intensity Quality Tooltip Data
export const intensityQualityTooltipData: TooltipData = {
  title: "Exercise Intensity",
  description: "Measures the quality of muscle activation during contractions.",
  sections: [
    {
      title: "Formula",
      type: "formula",
      items: [
        { value: "R<sub>intensity</sub> = contractions<sub>≥75% MVC</sub> / total" }
      ]
    },
    {
      title: "Clinical Target",
      type: "list",
      items: [
        { description: "Threshold: Contraction must reach at least 75% of Maximum Voluntary Contraction (MVC)." },
        { description: "Goal: ≥80% of contractions meet this intensity requirement." }
      ]
    }
  ]
};

// Duration Quality Tooltip Data
export const getDurationQualityTooltipData = (
  contractionDurationThreshold: number = 2000
): TooltipData => ({
  title: "Exercise Duration",
  description: "Measures the quality of contraction endurance.",
  sections: [
    {
      title: "Formula",
      type: "formula",
      items: [
        { value: `R<sub>duration</sub> = contractions<sub>≥${(contractionDurationThreshold / 1000).toFixed(1)}s</sub> / total` }
      ]
    },
    {
      title: "Clinical Target",
      type: "list",
      items: [
        { description: `Threshold: Contractions must be held for at least ${(contractionDurationThreshold / 1000).toFixed(1)}s.` },
        { description: "Goal: ≥90% of contractions meet this duration requirement." },
      ]
    }
  ]
});

// Muscle Symmetry Tooltip Data
export const muscleSymmetryTooltipData: TooltipData = {
  title: "Muscle Symmetry Score",
  description: "Assesses the balance between left and right-side muscle performance.",
  sections: [
    {
      title: "Formula",
      type: "formula",
      items: [
        { value: "S<sub>symmetry</sub> = (1 - |Left - Right| / (Left + Right)) × 100" }
      ]
    },
    {
      title: "Interpretation",
      type: "table",
      items: [
        { label: "90-100%", value: "Excellent balance", color: "text-emerald-600" },
        { label: "70-89%", value: "Minor imbalance", color: "text-yellow-600" },
        { label: "<70%", value: "Significant imbalance", color: "text-red-600" }
      ]
    }
  ]
};

// RPE Score Tooltip Data
export const rpeScoreTooltipData: TooltipData = {
  title: "Effort Score (RPE)",
  description: "Based on the patient-reported Rate of Perceived Exertion (Borg CR10 Scale).",
  sections: [
    {
      title: "Scoring",
      type: "table",
      items: [
        { label: "RPE 4-6", value: "Optimal (100%)", color: "text-emerald-600" },
        { label: "RPE 3, 7", value: "Acceptable (80%)", color: "text-green-600" },
        { label: "RPE 2, 8", value: "Suboptimal (60%)", color: "text-yellow-600" },
        { label: "RPE 0-1, 9-10", value: "Poor (20%)", color: "text-red-600" }
      ]
    },
    {
        title: "Clinical Target",
        type: "list",
        items: [
          { description: "Post-session RPE is used for this score." },
          { description: "The target for therapeutic benefit is an RPE of 4-6." },
        ]
      }
  ]
};

// GHOSTLY Game Score Tooltip Data
export const getGhostlyScoreTooltipData = (
  gameScore: number = 0,
  gameLevel?: number,
  normalizedScore: number = 0,
  weight: number = 0 // New weight parameter
): TooltipData => ({
  title: "Game Performance Score",
  description: "Measures in-game performance, adjusted for difficulty level.",
  sections: [
    {
      title: "Formula",
      type: "formula",
      items: [
        { value: "S<sub>game</sub> = game<sub>points</sub> / max<sub>points</sub> × 100" }
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
      title: "Contribution",
      type: "list",
      items: [
        weight > 0
          ? { description: `✓ Included in Overall Score (${(weight * 100).toFixed(0)}% weight)`, color: "text-emerald-700" }
          : { description: "✗ Not included in Overall Score (0% weight)", color: "text-red-700" }
      ]
    }
  ]
});

// BFR Applied Pressure Tooltip Data
export const getAppliedPressureTooltipData = (pressureValue?: number): TooltipData => ({
  title: "Applied Pressure",
  description: "Actual therapeutic pressure applied during Blood Flow Restriction (BFR) training.",
  sections: [
    {
      title: "Definition",
      type: "list",
      items: [
        { description: "The cuff pressure (mmHg) delivered to the patient's limb." },
        { description: "Calculated as a percentage of the patient's AOP." }
      ]
    },
    ...(pressureValue ? [{
      title: "Current Session",
      type: "table" as const,
      items: [
        { label: "Applied Pressure", value: `${pressureValue} mmHg` }
      ]
    }] : []),
    {
      title: "Safety",
      type: "list",
      items: [
        { description: "Must remain within the therapeutic range (typically 40-80% of AOP)." },
      ]
    }
  ]
});

// AOP Tooltip Data
export const getAOPTooltipData = (aopValue?: number): TooltipData => ({
  title: "AOP (Arterial Occlusion Pressure)",
  description: "The minimum pressure required to completely stop arterial blood flow in a limb.",
  sections: [
    {
      title: "Measurement",
      type: "list",
      items: [
        { description: "Determined individually for each patient using Doppler ultrasound." },
        { description: "Serves as the baseline for calculating safe BFR therapeutic pressures." },
      ]
    },
    ...(aopValue ? [{
      title: "Patient-Specific AOP",
      type: "table" as const,
      items: [
        { label: "AOP", value: `${aopValue} mmHg` }
      ]
    }] : []),
  ]
});

// NEW: Weighted Score Tooltip Data
export const getWeightedScoreTooltipData = (weights: {
  compliance: number;
  symmetry: number;
  effort: number;
  gameScore: number;
}): TooltipData => ({
  title: "Weighted Score Calculation",
  description: "This score is a weighted average of the following components:",
  sections: [
    {
      type: "table",
      items: [
        ...(weights.compliance > 0 ? [{ label: "Therapeutic Compliance", percentage: `${Math.round(weights.compliance * 100)}`, color: "text-green-600" }] : []),
        ...(weights.symmetry > 0 ? [{ label: "Muscle Symmetry", percentage: `${Math.round(weights.symmetry * 100)}`, color: "text-purple-600" }] : []),
        ...(weights.effort > 0 ? [{ label: "Subjective Effort", percentage: `${Math.round(weights.effort * 100)}`, color: "text-orange-600" }] : []),
        ...(weights.gameScore > 0 ? [{ label: "Game Performance", percentage: `${Math.round(weights.gameScore * 100)}`, color: "text-cyan-600" }] : [])
      ]
    }
  ]
});
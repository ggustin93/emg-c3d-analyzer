/**
 * Performance Tab Component
 * Main component for performance analysis, compliance scoring, and therapeutic metrics
 */

import React from 'react';
import PerformanceCard from '../shared/performance-card';
import OverallPerformanceCard from './components/OverallPerformanceCard';
import MusclePerformanceCard from './components/MusclePerformanceCard';
import MuscleSymmetryCard from './components/MuscleSymmetryCard';
import SubjectiveFatigueCard from './components/SubjectiveFatigueCard';
import GHOSTLYGameCard from './components/GHOSTLYGameCard';
import TherapeuticComplianceCard from './components/TherapeuticComplianceCard';
import PerformanceEquation from './components/PerformanceEquation';

interface PerformanceTabProps {
  // Props will be defined based on current performance-card.tsx interface
  [key: string]: any;
}

const PerformanceTab: React.FC<PerformanceTabProps> = (props) => {
  return (
    <div className="space-y-4">
      {/* Main Performance Card */}
      <PerformanceCard {...props} />
      
      {/* Performance Components Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <OverallPerformanceCard {...props} />
        <MuscleSymmetryCard {...props} />
        <SubjectiveFatigueCard {...props} />
        <GHOSTLYGameCard {...props} />
      </div>
      
      {/* Muscle-Specific Performance */}
      <MusclePerformanceCard {...props} />
      
      {/* Therapeutic Compliance */}
      <TherapeuticComplianceCard {...props} />
      
      {/* Performance Equation */}
      <PerformanceEquation {...props} />
    </div>
  );
};

export default PerformanceTab;
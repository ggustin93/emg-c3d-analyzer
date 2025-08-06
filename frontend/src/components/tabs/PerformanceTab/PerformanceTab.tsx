/**
 * Performance Tab Component
 * Main component for performance analysis, compliance scoring, and therapeutic metrics
 */

import React from 'react';
import PerformanceCard, { PerformanceCardProps } from '../shared/performance-card';

interface PerformanceTabProps extends PerformanceCardProps {}

const PerformanceTab: React.FC<PerformanceTabProps> = (props) => {
  return (
    <div className="space-y-4">
      {/* Main Performance Card - Contains all performance analysis components */}
      <PerformanceCard {...props} />
    </div>
  );
};

export default PerformanceTab;
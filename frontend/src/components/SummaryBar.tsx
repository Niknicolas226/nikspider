import React from 'react';
import { RoadmapResponse } from '../types';
import { CommandKpiCards } from './CommandKpiCards';

interface SummaryBarProps {
  roadmap?: RoadmapResponse;
  onSelectNode?: (nodeId: string) => void;
}

export const SummaryBar: React.FC<SummaryBarProps> = () => {
  return <CommandKpiCards />;
};

export default SummaryBar;

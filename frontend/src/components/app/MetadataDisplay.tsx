import React from 'react';
import type { GameMetadata } from '../../types/emg'; // Adjust path as needed

interface MetadataDisplayProps {
  metadata: GameMetadata | null | undefined;
}

const MetadataDisplay: React.FC<MetadataDisplayProps> = ({ metadata }) => {
  if (!metadata) {
    return null; // Or some placeholder if metadata is loading/absent
  }

  return (
    <div className="mb-4 p-4 border rounded-lg shadow-sm bg-slate-50">
      <h3 className="text-lg font-semibold mb-3 text-primary">Game Metadata</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-sm">
        <div className="flex justify-between"><span className="font-medium">Game:</span> <span className="text-right">{metadata.game_name || 'N/A'}</span></div>
        <div className="flex justify-between"><span className="font-medium">Level:</span> <span className="text-right">{metadata.level || 'N/A'}</span></div>
        <div className="flex justify-between"><span className="font-medium">Duration:</span> <span className="text-right">{metadata.duration ? `${metadata.duration}s` : 'N/A'}</span></div>
        <div className="flex justify-between"><span className="font-medium">Therapist:</span> <span className="text-right">{metadata.therapist_id || '---'}</span></div>
        <div className="flex justify-between"><span className="font-medium">Group:</span> <span className="text-right">{metadata.group_id || 'N/A'}</span></div>
        <div className="flex justify-between"><span className="font-medium">Time:</span> <span className="text-right">{metadata.time || 'N/A'}</span></div>
        <div className="flex justify-between"><span className="font-medium">Player:</span> <span className="text-right">{metadata.player_name || 'Default'}</span></div>
        <div className="flex justify-between"><span className="font-medium">Score:</span> <span className="text-right">{metadata.score || 'N/A'}</span></div>
      </div>
    </div>
  );
};

export default MetadataDisplay; 
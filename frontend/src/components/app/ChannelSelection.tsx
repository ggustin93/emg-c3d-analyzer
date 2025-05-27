import React from 'react';

interface ChannelSelectionProps {
  availableChannels: string[];
  plotChannel1Name: string | null;
  setPlotChannel1Name: (name: string | null) => void;
  plotChannel2Name: string | null;
  setPlotChannel2Name: (name: string | null) => void;
  selectedChannelForStats: string | null;
  setSelectedChannelForStats: (name: string | null) => void;
  displayMode?: 'full' | 'statsOnly' | 'plotChannelsOnly';
}

const ChannelSelection: React.FC<ChannelSelectionProps> = ({
  availableChannels,
  plotChannel1Name,
  setPlotChannel1Name,
  plotChannel2Name,
  setPlotChannel2Name,
  selectedChannelForStats,
  setSelectedChannelForStats,
  displayMode = 'full',
}) => {
  if (availableChannels.length === 0) {
    return null;
  }

  const renderPlotChannelSelectors = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label htmlFor="plot-channel-1-select" className="block text-sm font-medium text-gray-700 mb-1">Plot Channel 1:</label>
        <select 
          id="plot-channel-1-select"
          value={plotChannel1Name || ''}
          onChange={(e) => setPlotChannel1Name(e.target.value || null)}
          className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
        >
          <option value="">-- Select Channel 1 --</option>
          {availableChannels.map(channelName => (
            <option key={`plot1-${channelName}`} value={channelName}>{channelName}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="plot-channel-2-select" className="block text-sm font-medium text-gray-700 mb-1">Plot Channel 2:</label>
        <select 
          id="plot-channel-2-select"
          value={plotChannel2Name || ''}
          onChange={(e) => setPlotChannel2Name(e.target.value || null)}
          className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
        >
          <option value="">-- Select Channel 2 --</option>
          {availableChannels.map(channelName => (
            <option key={`plot2-${channelName}`} value={channelName}>{channelName}</option>
          ))}
        </select>
      </div>
    </div>
  );

  const renderStatsChannelSelector = () => (
    <div className={displayMode === 'statsOnly' ? "" : "mt-1 mb-4 p-4 border rounded-lg shadow-sm bg-slate-50"}>
      {displayMode !== 'statsOnly' && (
         <label htmlFor="channel-select-stats" className="block text-sm font-medium text-gray-700 mb-1">Display Detailed Stats for Channel:</label>
      )}
      <select 
        id="channel-select-stats"
        value={selectedChannelForStats || ''}
        onChange={(e) => setSelectedChannelForStats(e.target.value || null)}
        className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary sm:text-sm"
      >
        {availableChannels.map(channelName => (
          <option key={`stats-${channelName}`} value={channelName}>{channelName}</option>
        ))}
      </select>
    </div>
  );

  if (displayMode === 'statsOnly') {
    return renderStatsChannelSelector();
  }

  if (displayMode === 'plotChannelsOnly') {
    return (
      <div className="mb-4 p-4 border rounded-lg shadow-sm bg-slate-50">
        {renderPlotChannelSelectors()}
      </div>
    );
  }

  // Default 'full' mode
  return (
    <>
      <div className="mb-4 p-4 border rounded-lg shadow-sm bg-slate-50">
        <h3 className="text-lg font-semibold mb-3 text-primary">Channel Configuration</h3>
        {renderPlotChannelSelectors()}
      </div>
      {renderStatsChannelSelector()}
    </>
  );
};

export default ChannelSelection; 
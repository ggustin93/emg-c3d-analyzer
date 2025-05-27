import React from 'react';

interface GeneratedPlotsDisplayProps {
  plots: { [key: string]: string } | null | undefined;
}

const GeneratedPlotsDisplay: React.FC<GeneratedPlotsDisplayProps> = ({ plots }) => {
  if (!plots || Object.keys(plots).length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-2 text-primary">Generated Plots</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(plots).map(([key, url]) => (
          <div key={key} className="border rounded-lg p-2">
            <img src={`http://localhost:8080${url}`} alt={`Plot for ${key}`} className="w-full h-auto"/>
            <p className="text-center text-sm mt-1">{key}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GeneratedPlotsDisplay; 
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface BreakdownChartProps {
  total: number;
  good: number;
  expected?: number;
  color: string;
}

const BreakdownChart: React.FC<BreakdownChartProps> = ({ total, good, expected, color }) => {
  if (total === 0 && !expected) {
    return <div className="text-center text-sm text-gray-500">No Data</div>;
  }

  // If expected is provided, use it for the chart, otherwise fallback to total
  const targetValue = expected !== undefined ? expected : total;
  
  // Ensure we don't divide by zero
  const realizedValue = Math.min(total, targetValue || total);
  
  const data = [
    { name: 'Realized', value: realizedValue },
    { name: 'Remaining', value: targetValue > 0 ? Math.max(0, targetValue - realizedValue) : 0 },
  ];

  const COLORS = [color, '#e5e7eb'];

  return (
    <div className="relative w-24 h-24">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={30}
            outerRadius={32}
            startAngle={90}
            endAngle={450}
            paddingAngle={0}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {expected !== undefined ? (
          <div className="flex flex-col items-center">
            <span className="text-xl font-bold leading-none" style={{ color }}>{total}</span>
            <span className="text-xs font-medium text-gray-500 mt-0.5">/{expected}</span>
          </div>
        ) : (
          <span className="text-xl font-bold" style={{ color }}>{total}</span>
        )}
      </div>
    </div>
  );
};

interface ContractionTypeBreakdownProps {
  shortContractions: number;
  shortGoodContractions: number;
  longContractions: number;
  longGoodContractions: number;
  expectedShortContractions?: number;
  expectedLongContractions?: number;
  durationThreshold: number;
  color: string;
}

const ContractionTypeBreakdown: React.FC<ContractionTypeBreakdownProps> = ({
  shortContractions,
  shortGoodContractions,
  longContractions,
  longGoodContractions,
  expectedShortContractions,
  expectedLongContractions,
  durationThreshold,
  color,
}) => {
  const hasData = shortContractions > 0 || longContractions > 0 || expectedShortContractions || expectedLongContractions;

  if (!hasData) return null;

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <div className="grid grid-cols-2 gap-6 text-center">
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Short (&lt;{durationThreshold / 1000}s)</h4>
          <div className="flex flex-col items-center">
            <BreakdownChart 
              total={shortContractions} 
              good={shortGoodContractions} 
              expected={expectedShortContractions}
              color={color} 
            />
            <p className="text-xs text-gray-500 mt-3">
              {shortGoodContractions} good contractions
            </p>
          </div>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Long (≥{durationThreshold / 1000}s)</h4>
          <div className="flex flex-col items-center">
            <BreakdownChart 
              total={longContractions} 
              good={longGoodContractions} 
              expected={expectedLongContractions}
              color={color} 
            />
            <p className="text-xs text-gray-500 mt-3">
              {longGoodContractions} good contractions
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractionTypeBreakdown; 
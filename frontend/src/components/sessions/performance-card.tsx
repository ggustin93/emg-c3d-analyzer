import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GameSession } from '@/types/session';
import { CombinedChartDataPoint } from '@/components/EMGChart';
import { StarIcon, ClockIcon, BarChartIcon, LightningBoltIcon, CodeIcon } from '@radix-ui/react-icons';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as PieTooltip } from 'recharts';
import MetricCard from './metric-card';

interface PerformanceCardProps {
  selectedGameSession: GameSession;
  emgTimeSeriesData: CombinedChartDataPoint[];
  mvcPercentage: number;
  leftQuadChannelName: string | null;
  rightQuadChannelName: string | null;
}

export default function PerformanceCard({
  selectedGameSession,
  emgTimeSeriesData,
  mvcPercentage,
  leftQuadChannelName,
  rightQuadChannelName,
}: PerformanceCardProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center">
            <StarIcon className="h-4 w-4 mr-2" /> Activation Points
          </CardTitle>
          <CardDescription>Total points earned and contraction breakdown for the game session.</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 flex flex-col items-center">
          <div className="h-[250px] w-full flex items-center justify-center mb-3">
            {selectedGameSession.statistics && selectedGameSession.metrics && selectedGameSession.parameters ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Achieved', value: selectedGameSession.statistics.activationPoints || 0 },
                      { name: 'Remaining', value: 100 - (selectedGameSession.statistics.activationPoints || 0) }
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={90}
                    innerRadius={70}
                    fill="#8884d8"
                    dataKey="value"
                    stroke="none"
                  >
                    <Cell key={`cell-achieved`} fill="hsl(var(--chart-1))" />
                    <Cell key={`cell-remaining`} fill="hsl(var(--muted))" />
                  </Pie>
                  <PieTooltip formatter={(value: number, name: string) => [`${value} pts`, name]} />
                  <text
                    x="50%"
                    y="48%"
                    textAnchor="middle"
                    dominantBaseline="central"
                    style={{ fontSize: '28px', fontWeight: 'bold', fill: 'hsl(var(--foreground))' }}
                  >
                    {selectedGameSession.statistics.activationPoints || 0}
                  </text>
                  <text
                    x="50%"
                    y="60%"
                    textAnchor="middle"
                    dominantBaseline="central"
                    style={{ fontSize: '12px', fill: 'hsl(var(--muted-foreground))' }}
                  >
                    points
                  </text>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No performance data available
              </div>
            )}
          </div>
          {selectedGameSession.metrics && (
            <div className="text-center">
              <h4 className="text-sm font-semibold text-muted-foreground mb-4">Contraction Breakdown</h4>
              <div className="relative p-4 rounded-lg bg-slate-50 border overflow-hidden">
                <div className="absolute top-1 left-1 z-10">
                    <span className="text-xs font-semibold text-slate-500 bg-slate-200/80 px-2 py-1 rounded">
                        Coming soon?
                    </span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 opacity-50">
                    <MetricCard
                        icon={<CodeIcon className="h-5 w-5" />}
                        title="Long (L)"
                        description="Long contractions, left"
                        value={selectedGameSession.metrics.longContractionsLeft ?? 0}
                        unit=""
                        isInteger={true}
                    />
                    <MetricCard
                        icon={<CodeIcon className="h-5 w-5" />}
                        title="Long (R)"
                        description="Long contractions, right"
                        value={selectedGameSession.metrics.longContractionsRight ?? 0}
                        unit=""
                        isInteger={true}
                    />
                    <MetricCard
                        icon={<LightningBoltIcon className="h-5 w-5" />}
                        title="Short (L)"
                        description="Short contractions, left"
                        value={selectedGameSession.metrics.shortContractionsLeft ?? 0}
                        unit=""
                        isInteger={true}
                    />
                    <MetricCard
                        icon={<LightningBoltIcon className="h-5 w-5" />}
                        title="Short (R)"
                        description="Short contractions, right"
                        value={selectedGameSession.metrics.shortContractionsRight ?? 0}
                        unit=""
                        isInteger={true}
                    />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="lg:col-span-1 space-y-4">
        <MetricCard
          title="Duration"
          value={(selectedGameSession.statistics?.duration || 0) / 60}
          unit="min"
          description="Total gameplay time"
          icon={<ClockIcon className="h-4 w-4" />}
        />
        <MetricCard
          title="Level"
          value={selectedGameSession.statistics?.levelsCompleted || 0}
          description="Game progression"
          icon={<BarChartIcon className="h-4 w-4" />}
          unit=""
          isInteger
        />
        <div className="relative p-1 rounded-lg bg-slate-50/50">
          <div className="absolute top-2 left-2 z-10">
            <span className="text-xs font-semibold text-slate-500 bg-slate-200/80 px-2 py-1 rounded">
              Coming soon?
            </span>
          </div>
          <div className="opacity-50">
            <MetricCard
                title="Inactivity"
                description="Rest or disengagement"
                value={selectedGameSession.statistics?.inactivityPeriods ?? 0}
                unit="periods"
                isInteger={true}
                icon={<ClockIcon className="h-4 w-4" />}
            />
          </div>
        </div>
      </div>
    </div>
  );
} 
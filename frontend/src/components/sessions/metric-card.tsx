import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface MetricCardProps {
  title: string;
  value: number;
  unit: string;
  description: string;
  icon?: React.ReactNode;
  isInteger?: boolean;
  precision?: number;
  useScientificNotation?: boolean;
}

export default function MetricCard({
  title,
  value,
  unit,
  description,
  icon,
  isInteger,
  precision,
  useScientificNotation,
}: MetricCardProps) {
  let formattedValue: string;

  if (isInteger) {
    formattedValue = Math.round(value).toString();
  } else if (useScientificNotation) {
    formattedValue = value.toExponential(precision ?? 2);
  } else {
    formattedValue = value.toFixed(precision ?? 2);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && <div className="h-4 w-4 text-muted-foreground">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {formattedValue} {unit}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
} 
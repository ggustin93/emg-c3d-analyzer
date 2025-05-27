import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// Composant de statistiques optimisé
const StatsPanel = memo(({ stats }) => {
  if (!stats) return null;

  return (
    <div
      style={{
        background: "#f8f9fa",
        padding: "15px",
        marginBottom: "20px",
        borderRadius: "5px",
        border: "1px solid #ddd",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}
    >
      <h3 style={{ margin: "0 0 10px 0", color: "#1abc9c" }}>
        Analysis Results
      </h3>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: "120px", margin: "5px" }}>
          <strong>Min Value:</strong> {stats.min}
        </div>
        <div style={{ minWidth: "120px", margin: "5px" }}>
          <strong>Max Value:</strong> {stats.max}
        </div>
        <div style={{ minWidth: "120px", margin: "5px" }}>
          <strong>Average:</strong> {stats.avg}
        </div>
        <div style={{ minWidth: "120px", margin: "5px" }}>
          <strong>Duration:</strong> {stats.duration}s
        </div>
        <div style={{ minWidth: "120px", margin: "5px" }}>
          <strong>Samples:</strong> {stats.samples}
        </div>
      </div>
    </div>
  );
});

// Composant de graphique optimisé
const EMGChart = memo(({ chartData }) => {
  return (
    <div
      style={{
        width: "100%",
        height: "500px",
        border: "1px solid #eee",
        borderRadius: "5px",
        padding: "20px",
        boxSizing: "border-box",
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 25 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="time"
            label={{ value: "Time (seconds)", position: "bottom", offset: 0 }}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            label={{
              value: "Amplitude",
              angle: -90,
              position: "insideLeft",
              offset: -5,
            }}
            tick={{ fontSize: 12 }}
            domain={["auto", "auto"]}
          />
          <Tooltip
            formatter={(value) => [`${value}`, "Amplitude"]}
            labelFormatter={(time) => `Time: ${time}s`}
            contentStyle={{
              backgroundColor: "rgba(255, 255, 255, 0.9)",
              borderRadius: "4px",
            }}
          />
          <Legend
            verticalAlign="top"
            height={36}
            payload={[
              { value: "EMG Signal", type: "line", color: "#1abc9c" },
            ]}
          />
          <Line
            name="EMG Signal"
            type="monotone"
            dataKey="value"
            stroke="#1abc9c"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: "#1abc9c", stroke: "#fff" }}
            isAnimationActive={false} // Désactivation de l'animation pour de meilleures performances
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

function App() {
  const [emgData, setEmgData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dataPoints, setDataPoints] = useState(1000); // Pour limiter les points affichés

  // Fonction optimisée pour calculer les statistiques
  const calculateStats = useCallback((values, timeAxis) => {
    if (!values || values.length === 0) return null;

    // Calcul en une seule passe pour de meilleures performances
    let min = values[0];
    let max = values[0];
    let sum = 0;

    for (let i = 0; i < values.length; i++) {
      const val = values[i];
      min = Math.min(min, val);
      max = Math.max(max, val);
      sum += val;
    }

    return {
      min: min.toFixed(3),
      max: max.toFixed(3),
      avg: (sum / values.length).toFixed(3),
      duration: timeAxis[timeAxis.length - 1].toFixed(2),
      samples: values.length,
    };
  }, []);

  // Fonction pour simplifier les données si nécessaire
  const downsampleData = useCallback((data, timeAxis, maxPoints) => {
    if (!data || data.length <= maxPoints) return { data, timeAxis };

    const factor = Math.ceil(data.length / maxPoints);
    const newData = [];
    const newTimeAxis = [];

    for (let i = 0; i < data.length; i += factor) {
      // Préservation des pics importants
      let sum = 0;
      let min = Infinity;
      let max = -Infinity;
      let count = 0;

      for (let j = 0; j < factor && i + j < data.length; j++) {
        const value = data[i + j];
        sum += value;
        min = Math.min(min, value);
        max = Math.max(max, value);
        count++;
      }

      // Pour EMG, on veut préserver les pics
      const avg = sum / count;
      const absMin = Math.abs(min - avg);
      const absMax = Math.abs(max - avg);

      newData.push(absMax > absMin ? max : min);
      newTimeAxis.push(timeAxis[i]);
    }

    return { data: newData, timeAxis: newTimeAxis };
  }, []);

  // Chargement des données avec retries
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const fetchData = async (retries = 2) => {
      try {
        setLoading(true);
        const response = await fetch(
          "https://5ad4a080-671d-4260-96d0-1efcdefe7265-00-l2hs7ttmkjjf.picard.replit.dev:8080/raw-data/20250516_140036_3040cde6-7658-4249-9b9b-7e8cf2c30d72/CH1%20activated",
          { signal }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        // Vérifier que les données sont valides
        if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
          throw new Error("Invalid data format: missing or empty data array");
        }

        console.log("Data sample:", data.data.slice(0, 5)); // Débogage

        // Calcul des statistiques sur les données originales
        const statsResult = calculateStats(data.data, data.time_axis);
        console.log("Stats calculated:", statsResult); // Débogage
        setStats(statsResult);

        // Downsample les données pour de meilleures performances
        const { data: optimizedData, timeAxis: optimizedTimeAxis } = 
          downsampleData(data.data, data.time_axis, dataPoints);

        setEmgData({
          ...data,
          data: optimizedData,
          time_axis: optimizedTimeAxis,
          original_length: data.data.length
        });

        setLoading(false);
      } catch (error) {
        if (error.name === 'AbortError') return;

        console.error("Error fetching EMG data:", error);

        if (retries > 0 && !signal.aborted) {
          setTimeout(() => fetchData(retries - 1), 1000);
        } else {
          setError(error.message);
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => controller.abort();
  }, [calculateStats, downsampleData, dataPoints]);

  // Préparation des données pour le graphique avec useMemo
  const chartData = useMemo(() => {
    if (!emgData || !emgData.time_axis || !emgData.data) return [];

    return emgData.time_axis.map((time, index) => ({
      time,
      value: emgData.data[index],
    }));
  }, [emgData]);

  // Gérer le changement du nombre de points affichés
  const handleDataPointsChange = useCallback((e) => {
    setDataPoints(Number(e.target.value));
  }, []);

  if (loading && !emgData) return <div>Loading EMG data...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!emgData) return <div>No EMG data available</div>;

  return (
    <div
      className="App"
      style={{
        padding: "20px",
        fontFamily: "Arial, sans-serif",
        maxWidth: "1200px",
        margin: "0 auto",
      }}
    >
      <h1
        style={{
          borderBottom: "2px solid #1abc9c",
          paddingBottom: "10px",
          color: "#2c3e50",
        }}
      >
        EMG Data Visualization
      </h1>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2 style={{ color: "#34495e" }}>{emgData.channel_name}</h2>
        <div>
          <p
            style={{
              backgroundColor: "#f1f8ff",
              padding: "4px 10px",
              borderRadius: "4px",
              marginBottom: "8px",
            }}
          >
            <strong>Sampling Rate:</strong> {emgData.sampling_rate} Hz
          </p>
          <div>
            <label>
              Points: 
              <select 
                value={dataPoints} 
                onChange={handleDataPointsChange}
                style={{
                  marginLeft: "8px",
                  padding: "4px",
                  borderRadius: "4px",
                }}
              >
                <option value={500}>500</option>
                <option value={1000}>1000</option>
                <option value={2000}>2000</option>
                <option value={5000}>5000</option>
                <option value={emgData.original_length}>All</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <StatsPanel stats={stats} />

      {/* Graphique */}
      <EMGChart chartData={chartData} />

      {/* Source */}
      <div
        style={{
          marginTop: "20px",
          padding: "10px",
          backgroundColor: "#f9f9f9",
          borderRadius: "5px",
        }}
      >
        <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>
          Data source:{" "}
          <code
            style={{
              fontSize: "12px",
              backgroundColor: "#eee",
              padding: "2px 4px",
              borderRadius: "3px",
            }}
          >
            {emgData?.url ? new URL(emgData.url).pathname.split("/").pop() : ""}
          </code>
        </p>
      </div>
    </div>
  );
}

export default App;
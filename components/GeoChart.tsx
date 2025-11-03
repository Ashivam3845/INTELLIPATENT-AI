import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { GeoDataPoint } from '../types';

interface GeoChartProps {
  data: GeoDataPoint[];
  theme: 'light' | 'dark';
}

const GeoChart: React.FC<GeoChartProps> = ({ data, theme }) => {
  const isDark = theme === 'dark';
  const axisColor = isDark ? "#94a3b8" : "#475569";
  const gridColor = isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)";
  const tooltipStyle = {
      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.9)', 
      border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`, 
      backdropFilter: 'blur(4px)'
  };
  const labelStyle = { color: isDark ? '#e2e8f0' : '#0f172a' };
  const legendStyle = { color: isDark ? '#e2e8f0' : '#0f172a' };
  const barFill = isDark ? "#22d3ee" : "#0891b2";


  return (
    <div style={{ width: '100%', height: 300 }}>
      <ResponsiveContainer>
        <BarChart
          data={data}
          margin={{
            top: 5, right: 30, left: 20, bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="country" stroke={axisColor} />
          <YAxis stroke={axisColor} />
          <Tooltip 
            contentStyle={tooltipStyle} 
            labelStyle={labelStyle} 
          />
          <Legend wrapperStyle={legendStyle}/>
          <Bar dataKey="score" fill={barFill} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default GeoChart;
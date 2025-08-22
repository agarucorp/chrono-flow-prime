import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface AdminChartProps {
  metricType: 'ingresos' | 'horas' | 'usuarios' | 'pagos';
  chartType: 'bar' | 'line';
  data: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor?: string;
      borderColor?: string;
      fill?: boolean;
    }[];
  };
}

export const AdminChart: React.FC<AdminChartProps> = ({ 
  metricType, 
  chartType, 
  data 
}) => {
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: 'hsl(var(--foreground))',
          font: {
            size: 12,
          },
        },
      },
      title: {
        display: true,
        text: getChartTitle(metricType),
        color: 'hsl(var(--foreground))',
        font: {
          size: 16,
          weight: 'bold' as const,
        },
      },
      tooltip: {
        backgroundColor: 'hsl(var(--card))',
        titleColor: 'hsl(var(--foreground))',
        bodyColor: 'hsl(var(--muted-foreground))',
        borderColor: 'hsl(var(--border))',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true,
        callbacks: {
          label: function(context: any) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            return `${label}: ${formatValue(metricType, value)}`;
          }
        }
      },
    },
    scales: {
      x: {
        grid: {
          color: 'hsl(var(--border))',
        },
        ticks: {
          color: 'hsl(var(--muted-foreground))',
        },
      },
      y: {
        grid: {
          color: 'hsl(var(--border))',
        },
        ticks: {
          color: 'hsl(var(--muted-foreground))',
          callback: function(value: any) {
            return formatValue(metricType, value);
          }
        },
      },
    },
  };

  function getChartTitle(metric: string): string {
    switch (metric) {
      case 'ingresos':
        return 'Tendencia de Ingresos Semanales';
      case 'horas':
        return 'Horas Reservadas por Semana';
      case 'usuarios':
        return 'Nuevos Usuarios por Semana';
      case 'pagos':
        return 'Estado de Pagos por Semana';
      default:
        return 'Métricas del Negocio';
    }
  }

  function formatValue(metric: string, value: number): string {
    switch (metric) {
      case 'ingresos':
        return `$${value.toLocaleString()}`;
      case 'horas':
        return `${value}h`;
      case 'usuarios':
        return value.toString();
      case 'pagos':
        return `${value}%`;
      default:
        return value.toString();
    }
  }

  return (
    <div className="h-80 w-full">
      {chartType === 'bar' ? (
        <Bar data={data} options={options} />
      ) : (
        <Line data={data} options={options} />
      )}
    </div>
  );
};

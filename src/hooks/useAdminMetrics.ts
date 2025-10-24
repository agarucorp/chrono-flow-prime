import { useState, useEffect } from 'react';

export interface BusinessMetrics {
  ingresos: number[];
  horas: number[];
  usuarios: number[];
  pagos: number[];
  labels: string[];
}

export const useAdminMetrics = (selectedMonth: string, selectedYear: string) => {
  const [metrics, setMetrics] = useState<BusinessMetrics>({
    ingresos: [],
    horas: [],
    usuarios: [],
    pagos: [],
    labels: []
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simular carga de datos
    setIsLoading(true);
    
    setTimeout(() => {
      // Generar datos realistas basados en el mes y año seleccionados
      const monthData = generateMonthData(selectedMonth, selectedYear);
      setMetrics(monthData);
      setIsLoading(false);
    }, 500);
  }, [selectedMonth, selectedYear]);

  function generateMonthData(month: string, year: string): BusinessMetrics {
    // Generar datos realistas para el negocio
    const baseIngresos = getBaseIngresos(month);
    const baseHoras = getBaseHoras(month);
    const baseUsuarios = getBaseUsuarios(month);
    
    // Simular variaciones semanales realistas
    const semanas = ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'];
    
    const ingresos = semanas.map((_, index) => {
      const base = baseIngresos / 4;
      const variation = (Math.random() - 0.5) * 0.3; // ±15% variación
      return Math.round(base * (1 + variation));
    });

    const horas = semanas.map((_, index) => {
      const base = baseHoras / 4;
      const variation = (Math.random() - 0.5) * 0.2; // ±10% variación
      return Math.round(base * (1 + variation));
    });

    const usuarios = semanas.map((_, index) => {
      const base = baseUsuarios / 4;
      const variation = (Math.random() - 0.5) * 0.4; // ±20% variación
      return Math.max(1, Math.round(base * (1 + variation)));
    });

    const pagos = semanas.map((_, index) => {
      // Porcentaje de pagos completados (85-98%)
      return Math.round(85 + Math.random() * 13);
    });

    return {
      ingresos,
      horas,
      usuarios,
      pagos,
      labels: semanas
    };
  }

  function getBaseIngresos(month: string): number {
    // Simular ingresos realistas por mes
    const monthlyRevenue: { [key: string]: number } = {
      'enero': 120000,
      'febrero': 110000,
      'marzo': 130000,
      'abril': 125000,
      'mayo': 140000,
      'junio': 135000,
      'julio': 150000,
      'agosto': 145000,
      'septiembre': 160000,
      'octubre': 155000,
      'noviembre': 170000,
      'diciembre': 180000
    };
    return monthlyRevenue[month] || 130000;
  }

  function getBaseHoras(month: string): number {
    // Simular horas reservadas por mes
    const monthlyHours: { [key: string]: number } = {
      'enero': 520,
      'febrero': 480,
      'marzo': 560,
      'abril': 540,
      'mayo': 600,
      'junio': 580,
      'julio': 640,
      'agosto': 620,
      'septiembre': 680,
      'octubre': 660,
      'noviembre': 720,
      'diciembre': 760
    };
    return monthlyHours[month] || 600;
  }

  function getBaseUsuarios(month: string): number {
    // Simular nuevos usuarios por mes
    const monthlyUsers: { [key: string]: number } = {
      'enero': 25,
      'febrero': 22,
      'marzo': 28,
      'abril': 26,
      'mayo': 30,
      'junio': 28,
      'julio': 32,
      'agosto': 30,
      'septiembre': 35,
      'octubre': 33,
      'noviembre': 38,
      'diciembre': 40
    };
    return monthlyUsers[month] || 30;
  }

  // Función para obtener datos formateados para Chart.js
  function getChartData(metricType: 'ingresos' | 'horas' | 'usuarios' | 'pagos', chartType: 'bar' | 'line') {
    const colors = {
      ingresos: {
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        borderColor: 'rgb(34, 197, 94)',
      },
      horas: {
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderColor: 'rgb(59, 130, 246)',
      },
      usuarios: {
        backgroundColor: 'rgba(147, 51, 234, 0.2)',
        borderColor: 'rgb(147, 51, 234)',
      },
      pagos: {
        backgroundColor: 'rgba(16, 185, 129, 0.2)',
        borderColor: 'rgb(16, 185, 129)',
      }
    };

    const labels = {
      ingresos: 'Ingresos ($)',
      horas: 'Horas Reservadas',
      usuarios: 'Nuevos Usuarios',
      pagos: 'Pagos Completados (%)'
    };

    return {
      labels: metrics.labels,
      datasets: [
        {
          label: labels[metricType],
          data: metrics[metricType],
          backgroundColor: chartType === 'bar' ? colors[metricType].backgroundColor : undefined,
          borderColor: colors[metricType].borderColor,
          borderWidth: 2,
          fill: chartType === 'line',
          tension: 0.4,
          pointBackgroundColor: colors[metricType].borderColor,
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 6,
          pointHoverRadius: 8,
        }
      ]
    };
  }

  return {
    metrics,
    isLoading,
    getChartData
  };
};

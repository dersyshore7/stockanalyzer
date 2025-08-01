import { Chart, ChartConfiguration, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { CandlestickController, CandlestickElement, OhlcController, OhlcElement } from 'chartjs-chart-financial';
import { ProcessedDataPoint } from './alphaVantageApi';

Chart.register(...registerables, CandlestickController, CandlestickElement, OhlcController, OhlcElement);

export interface ChartImage {
  timeframe: string;
  dataUrl: string;
}

export const generateCandlestickChart = async (
  data: ProcessedDataPoint[],
  symbol: string,
  timeframe: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    const chartData = data.map(point => ({
      x: new Date(point.date).getTime(),
      o: point.open,
      h: point.high,
      l: point.low,
      c: point.close
    }));

    const config: ChartConfiguration<'candlestick', { x: number; o: number; h: number; l: number; c: number }[]> = {
      type: 'candlestick',
      data: {
        datasets: [{
          label: `${symbol} - ${timeframe}`,
          data: chartData
        }]
      },
      options: {
        responsive: false,
        animation: false,
        scales: {
          x: {
            type: 'time',
            time: {
              displayFormats: {
                day: 'MMM dd',
                week: 'MMM dd',
                month: 'MMM yyyy'
              }
            },
            title: {
              display: true,
              text: 'Date'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Price ($)'
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: `${symbol} - ${timeframe} Chart`
          },
          legend: {
            display: true
          }
        }
      }
    };

    const chart = new Chart(ctx, config);
    
    setTimeout(() => {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        chart.destroy();
        resolve(dataUrl);
      } catch (error) {
        chart.destroy();
        reject(error);
      }
    }, 100);
  });
};

export const generateMultiTimeframeCharts = async (
  symbol: string,
  data: {
    day: ProcessedDataPoint[];
    week: ProcessedDataPoint[];
    month: ProcessedDataPoint[];
    threeMonth: ProcessedDataPoint[];
    sixMonth: ProcessedDataPoint[];
    year: ProcessedDataPoint[];
  }
): Promise<ChartImage[]> => {
  const charts: ChartImage[] = [];
  
  const timeframes = [
    { key: 'day' as keyof typeof data, label: 'Day' },
    { key: 'week' as keyof typeof data, label: 'Week' },
    { key: 'month' as keyof typeof data, label: 'Month' },
    { key: 'threeMonth' as keyof typeof data, label: '3 Month' },
    { key: 'sixMonth' as keyof typeof data, label: '6 Month' },
    { key: 'year' as keyof typeof data, label: 'Year' }
  ];

  for (const timeframe of timeframes) {
    try {
      const chartData = data[timeframe.key];
      if (chartData && chartData.length > 0) {
        const dataUrl = await generateCandlestickChart(chartData, symbol, timeframe.label);
        charts.push({
          timeframe: timeframe.label,
          dataUrl
        });
      }
    } catch (error) {
      console.error(`Error generating ${timeframe.label} chart:`, error);
    }
  }

  return charts;
};

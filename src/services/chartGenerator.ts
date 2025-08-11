import { Chart, ChartConfiguration, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';
import {
  CandlestickController,
  CandlestickElement,
  OhlcController,
  OhlcElement
} from 'chartjs-chart-financial';
import { ProcessedDataPoint, calculateOBV } from './alphaVantageApi';

Chart.register(...registerables, CandlestickController, CandlestickElement, OhlcController, OhlcElement);

export interface ChartImage {
  timeframe: string;
  dataUrl: string;
}

const calculateSMAArray = (
  data: ProcessedDataPoint[],
  period: number
): Array<number | null> => {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    const slice = data.slice(i - period + 1, i + 1);
    const sum = slice.reduce((acc, p) => acc + p.close, 0);
    return sum / period;
  });
};

const calculateEMAArray = (
  values: number[],
  period: number
): Array<number | null> => {
  const k = 2 / (period + 1);
  const ema: Array<number | null> = [];
  let emaPrev: number | null = null;

  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (emaPrev === null) {
      if (i >= period - 1) {
        const slice = values.slice(i - period + 1, i + 1);
        emaPrev = slice.reduce((sum, v) => sum + v, 0) / period;
        ema[i] = emaPrev;
      } else {
        ema[i] = null;
      }
    } else {
      emaPrev = value * k + emaPrev * (1 - k);
      ema[i] = emaPrev;
    }
  }
  return ema;
};

const calculateMACDSeries = (
  data: ProcessedDataPoint[]
): { macd: Array<number | null>; signal: Array<number | null> } => {
  const closes = data.map(p => p.close);
  const ema12 = calculateEMAArray(closes, 12);
  const ema26 = calculateEMAArray(closes, 26);
  const macd = closes.map((_, i) =>
    ema12[i] !== null && ema26[i] !== null ? (ema12[i]! - ema26[i]!) : null
  );

  const macdValues = macd.filter((v): v is number => v !== null);
  if (macdValues.length < 9) {
    return { macd, signal: Array(macd.length).fill(null) };
  }

  const signalEMA = calculateEMAArray(macdValues, 9);
  const signal: Array<number | null> = Array(macd.length).fill(null);
  
  let signalIndex = 0;
  for (let i = 0; i < macd.length; i++) {
    if (macd[i] !== null) {
      signal[i] = signalEMA[signalIndex] || null;
      signalIndex++;
    }
  }

  return { macd, signal };
};

const calculateATRSeries = (
  data: ProcessedDataPoint[],
  period: number = 14
): Array<number | null> => {
  if (data.length < period + 1) {
    return Array(data.length).fill(null);
  }

  const trs: Array<number | null> = data.map((point, i) => {
    if (i === 0) return null;
    const prev = data[i - 1];
    return Math.max(
      point.high - point.low,
      Math.abs(point.high - prev.close),
      Math.abs(point.low - prev.close)
    );
  });

  return data.map((_, i) => {
    if (i < period) return null;
    const slice = trs.slice(i - period + 1, i + 1).filter((v): v is number => v !== null);
    if (slice.length < period) return null;
    const sum = slice.reduce((acc, v) => acc + v, 0);
    return sum / period;
  });
};

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

    const sma50 = calculateSMAArray(data, 50).map((v, i) => ({
      x: new Date(data[i].date).getTime(),
      y: v
    }));
    const sma200 = calculateSMAArray(data, 200).map((v, i) => ({
      x: new Date(data[i].date).getTime(),
      y: v
    }));

    const config: ChartConfiguration<'candlestick' | 'line', unknown> = {
      type: 'candlestick',
      data: {
        datasets: [
          {
            type: 'candlestick',
            label: `${symbol} - ${timeframe}`,
            data: chartData
          },
          {
            type: 'line',
            label: 'SMA50',
            data: sma50,
            borderColor: 'blue',
            borderWidth: 1,
            pointRadius: 0
          },
          {
            type: 'line',
            label: 'SMA200',
            data: sma200,
            borderColor: 'orange',
            borderWidth: 1,
            pointRadius: 0
          }
        ]
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

interface LinePoint {
  x: number;
  y: number | null;
}

interface LineDataset {
  label: string;
  data: LinePoint[];
  borderColor: string;
  borderWidth: number;
  pointRadius: number;
}

const generateLineChart = async (
  datasets: LineDataset[],
  symbol: string,
  timeframe: string,
  title: string,
  yLabel: string
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

    const config: ChartConfiguration<'line', LinePoint[]> = {
      type: 'line',
      data: { datasets },
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
            title: { display: true, text: 'Date' }
          },
          y: {
            title: { display: true, text: yLabel }
          }
        },
        plugins: {
          title: { display: true, text: `${symbol} - ${timeframe} ${title}` },
          legend: { display: true }
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

const generateMACDChart = async (
  data: ProcessedDataPoint[],
  symbol: string,
  timeframe: string
): Promise<string> => {
  const { macd, signal } = calculateMACDSeries(data);
  const labels = data.map(p => new Date(p.date).getTime());
  const macdData = macd.map((v, i) => ({ x: labels[i], y: v }));
  const signalData = signal.map((v, i) => ({ x: labels[i], y: v }));
  return generateLineChart(
    [
      { label: 'MACD', data: macdData, borderColor: 'teal', borderWidth: 1, pointRadius: 0 },
      { label: 'Signal', data: signalData, borderColor: 'red', borderWidth: 1, pointRadius: 0 }
    ],
    symbol,
    timeframe,
    'MACD',
    'MACD'
  );
};

const generateOBVChart = async (
  data: ProcessedDataPoint[],
  symbol: string,
  timeframe: string
): Promise<string> => {
  const obv = calculateOBV(data);
  const labels = data.map(p => new Date(p.date).getTime());
  const obvData = obv.map((v, i) => ({ x: labels[i], y: v }));
  return generateLineChart(
    [
      { label: 'OBV', data: obvData, borderColor: 'purple', borderWidth: 1, pointRadius: 0 }
    ],
    symbol,
    timeframe,
    'OBV',
    'OBV'
  );
};

const generateATRChart = async (
  data: ProcessedDataPoint[],
  symbol: string,
  timeframe: string
): Promise<string> => {
  const atr = calculateATRSeries(data);
  const labels = data.map(p => new Date(p.date).getTime());
  const atrData = atr.map((v, i) => ({ x: labels[i], y: v }));
  return generateLineChart(
    [
      { label: 'ATR', data: atrData, borderColor: 'orange', borderWidth: 1, pointRadius: 0 }
    ],
    symbol,
    timeframe,
    'ATR',
    'ATR'
  );
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
  const timeframes = [
    { key: 'day' as keyof typeof data, label: 'Day' },
    { key: 'week' as keyof typeof data, label: 'Week' },
    { key: 'month' as keyof typeof data, label: 'Month' },
    { key: 'threeMonth' as keyof typeof data, label: '3 Month' },
    { key: 'sixMonth' as keyof typeof data, label: '6 Month' },
    { key: 'year' as keyof typeof data, label: 'Year' }
  ];

  const chartPromises = timeframes.flatMap(timeframe => {
    const chartData = data[timeframe.key];
    if (!chartData || chartData.length === 0) return [];
    
    return [
      generateCandlestickChart(chartData, symbol, timeframe.label)
        .then(dataUrl => ({ timeframe: `${timeframe.label} Price`, dataUrl }))
        .catch(error => {
          console.error(`Error generating ${timeframe.label} price chart:`, error);
          return null;
        }),
      generateMACDChart(chartData, symbol, timeframe.label)
        .then(dataUrl => ({ timeframe: `${timeframe.label} MACD`, dataUrl }))
        .catch(error => {
          console.error(`Error generating ${timeframe.label} MACD chart:`, error);
          return null;
        }),
      generateOBVChart(chartData, symbol, timeframe.label)
        .then(dataUrl => ({ timeframe: `${timeframe.label} OBV`, dataUrl }))
        .catch(error => {
          console.error(`Error generating ${timeframe.label} OBV chart:`, error);
          return null;
        }),
      generateATRChart(chartData, symbol, timeframe.label)
        .then(dataUrl => ({ timeframe: `${timeframe.label} ATR`, dataUrl }))
        .catch(error => {
          console.error(`Error generating ${timeframe.label} ATR chart:`, error);
          return null;
        })
    ];
  });

  const results = await Promise.all(chartPromises);
  return results.filter((chart): chart is ChartImage => chart !== null);
};

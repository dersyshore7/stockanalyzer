export interface TimeSeriesData {
  [date: string]: {
    '1. open': string;
    '2. high': string;
    '3. low': string;
    '4. close': string;
    '5. volume': string;
  };
}

export interface AlphaVantageResponse {
  'Meta Data'?: {
    '1. Information': string;
    '2. Symbol': string;
    '3. Last Refreshed': string;
    '4. Output Size': string;
    '5. Time Zone': string;
  };
  'Time Series (Daily)'?: TimeSeriesData;
  'Weekly Time Series'?: TimeSeriesData;
  'Monthly Time Series'?: TimeSeriesData;
  'Time Series (1min)'?: TimeSeriesData;
  'Time Series (5min)'?: TimeSeriesData;
  'Time Series (15min)'?: TimeSeriesData;
  'Time Series (30min)'?: TimeSeriesData;
  'Time Series (60min)'?: TimeSeriesData;
  'Error Message'?: string;
  'Note'?: string;
}

export interface ProcessedDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const API_KEY = import.meta.env.VITE_ALPHA_VANTAGE_API_KEY || 'demo';
const BASE_URL = 'https://www.alphavantage.co/query';

export const fetchDailyData = async (symbol: string): Promise<ProcessedDataPoint[]> => {
  const response = await fetch(`${BASE_URL}?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${API_KEY}`);
  const data: AlphaVantageResponse = await response.json();
  
  if (data['Error Message']) {
    throw new Error(`Alpha Vantage API Error: ${data['Error Message']}`);
  }
  
  if (data['Note']) {
    throw new Error('API rate limit exceeded. Please wait or upgrade your Alpha Vantage API key.');
  }
  
  if (!data['Time Series (Daily)']) {
    if (API_KEY === 'demo') {
      throw new Error('Demo API key has limited access. Please provide a valid Alpha Vantage API key.');
    }
    throw new Error('Failed to fetch daily data - please check the stock symbol and try again.');
  }
  
  return processTimeSeriesData(data['Time Series (Daily)']);
};

export const fetchWeeklyData = async (symbol: string): Promise<ProcessedDataPoint[]> => {
  const response = await fetch(`${BASE_URL}?function=TIME_SERIES_WEEKLY&symbol=${symbol}&apikey=${API_KEY}`);
  const data: AlphaVantageResponse = await response.json();
  
  if (data['Error Message']) {
    throw new Error(`Alpha Vantage API Error: ${data['Error Message']}`);
  }
  
  if (data['Note']) {
    throw new Error('API rate limit exceeded. Please wait or upgrade your Alpha Vantage API key.');
  }
  
  if (!data['Weekly Time Series']) {
    if (API_KEY === 'demo') {
      throw new Error('Demo API key has limited access. Please provide a valid Alpha Vantage API key.');
    }
    throw new Error('Failed to fetch weekly data - please check the stock symbol and try again.');
  }
  
  return processTimeSeriesData(data['Weekly Time Series']);
};

export const fetchMonthlyData = async (symbol: string): Promise<ProcessedDataPoint[]> => {
  const response = await fetch(`${BASE_URL}?function=TIME_SERIES_MONTHLY&symbol=${symbol}&apikey=${API_KEY}`);
  const data: AlphaVantageResponse = await response.json();
  
  if (data['Error Message']) {
    throw new Error(`Alpha Vantage API Error: ${data['Error Message']}`);
  }
  
  if (data['Note']) {
    throw new Error('API rate limit exceeded. Please wait or upgrade your Alpha Vantage API key.');
  }
  
  if (!data['Monthly Time Series']) {
    if (API_KEY === 'demo') {
      throw new Error('Demo API key has limited access. Please provide a valid Alpha Vantage API key.');
    }
    throw new Error('Failed to fetch monthly data - please check the stock symbol and try again.');
  }
  
  return processTimeSeriesData(data['Monthly Time Series']);
};

export const fetchIntradayData = async (symbol: string, interval: '1min' | '5min' | '15min' | '30min' | '60min'): Promise<ProcessedDataPoint[]> => {
  const response = await fetch(`${BASE_URL}?function=TIME_SERIES_INTRADAY&symbol=${symbol}&interval=${interval}&apikey=${API_KEY}`);
  const data: AlphaVantageResponse = await response.json();
  
  const timeSeriesKey = `Time Series (${interval})` as keyof AlphaVantageResponse;
  const timeSeriesData = data[timeSeriesKey] as TimeSeriesData;
  
  if (!timeSeriesData) {
    throw new Error(`Failed to fetch ${interval} intraday data`);
  }
  
  return processTimeSeriesData(timeSeriesData);
};

const processTimeSeriesData = (data: TimeSeriesData): ProcessedDataPoint[] => {
  return Object.entries(data)
    .map(([date, values]) => ({
      date,
      open: parseFloat(values['1. open']),
      high: parseFloat(values['2. high']),
      low: parseFloat(values['3. low']),
      close: parseFloat(values['4. close']),
      volume: parseFloat(values['5. volume'])
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

export const getMultiTimeframeData = async (symbol: string) => {
  try {
    const [daily, weekly, monthly] = await Promise.all([
      fetchDailyData(symbol),
      fetchWeeklyData(symbol),
      fetchMonthlyData(symbol)
    ]);

    const now = new Date();
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    return {
      day: daily.slice(-30),
      week: weekly.slice(-12),
      month: monthly.slice(-12),
      threeMonth: daily.filter(d => new Date(d.date) >= threeMonthsAgo),
      sixMonth: daily.filter(d => new Date(d.date) >= sixMonthsAgo),
      year: daily.filter(d => new Date(d.date) >= oneYearAgo)
    };
  } catch (error) {
    console.error('Error fetching multi-timeframe data:', error);
    throw error;
  }
};

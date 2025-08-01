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

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
const YAHOO_BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

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

const fetchYahooFinanceData = async (symbol: string): Promise<ProcessedDataPoint[]> => {
  try {
    const yahooUrl = `${YAHOO_BASE_URL}/${symbol}?period1=0&period2=9999999999&interval=1d&includePrePost=true&events=div%2Csplit`;
    const response = await fetch(`${CORS_PROXY}${encodeURIComponent(yahooUrl)}`);
    const data = await response.json();
    
    if (!data.chart?.result?.[0]?.timestamp) {
      throw new Error('Invalid Yahoo Finance response via CORS proxy');
    }
    
    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];
    
    return timestamps.map((timestamp: number, index: number) => ({
      date: new Date(timestamp * 1000).toISOString().split('T')[0],
      open: quotes.open[index] || 0,
      high: quotes.high[index] || 0,
      low: quotes.low[index] || 0,
      close: quotes.close[index] || 0,
      volume: quotes.volume[index] || 0
    })).filter((point: ProcessedDataPoint) => point.close > 0);
  } catch (error) {
    console.error('Yahoo Finance CORS proxy error:', error);
    throw new Error('Failed to fetch data from Yahoo Finance via CORS proxy');
  }
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
    console.error('Alpha Vantage failed, trying Yahoo Finance fallback:', error);
    
    try {
      const yahooData = await fetchYahooFinanceData(symbol);
      
      if (yahooData.length === 0) {
        throw new Error('No data available for this symbol');
      }
      
      const now = new Date();
      const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      
      const weeklyData = generateWeeklyFromDaily(yahooData);
      const monthlyData = generateMonthlyFromDaily(yahooData);
      
      return {
        day: yahooData.slice(-30),
        week: weeklyData.slice(-12),
        month: monthlyData.slice(-12),
        threeMonth: yahooData.filter(d => new Date(d.date) >= threeMonthsAgo),
        sixMonth: yahooData.filter(d => new Date(d.date) >= sixMonthsAgo),
        year: yahooData.filter(d => new Date(d.date) >= oneYearAgo)
      };
    } catch (fallbackError) {
      console.error('Yahoo Finance CORS proxy fallback also failed:', fallbackError);
      throw new Error('Unable to fetch stock data from any source. Please check the symbol and try again.');
    }
  }
};

const generateWeeklyFromDaily = (dailyData: ProcessedDataPoint[]): ProcessedDataPoint[] => {
  const weeklyData: ProcessedDataPoint[] = [];
  let currentWeek: ProcessedDataPoint[] = [];
  
  dailyData.forEach((point, index) => {
    const date = new Date(point.date);
    const dayOfWeek = date.getDay();
    
    currentWeek.push(point);
    
    if (dayOfWeek === 5 || index === dailyData.length - 1) {
      if (currentWeek.length > 0) {
        weeklyData.push({
          date: currentWeek[currentWeek.length - 1].date,
          open: currentWeek[0].open,
          high: Math.max(...currentWeek.map(p => p.high)),
          low: Math.min(...currentWeek.map(p => p.low)),
          close: currentWeek[currentWeek.length - 1].close,
          volume: currentWeek.reduce((sum, p) => sum + p.volume, 0)
        });
      }
      currentWeek = [];
    }
  });
  
  return weeklyData;
};

const generateMonthlyFromDaily = (dailyData: ProcessedDataPoint[]): ProcessedDataPoint[] => {
  const monthlyData: ProcessedDataPoint[] = [];
  let currentMonth: ProcessedDataPoint[] = [];
  let currentMonthKey = '';
  
  dailyData.forEach((point) => {
    const date = new Date(point.date);
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
    
    if (monthKey !== currentMonthKey) {
      if (currentMonth.length > 0) {
        monthlyData.push({
          date: currentMonth[currentMonth.length - 1].date,
          open: currentMonth[0].open,
          high: Math.max(...currentMonth.map(p => p.high)),
          low: Math.min(...currentMonth.map(p => p.low)),
          close: currentMonth[currentMonth.length - 1].close,
          volume: currentMonth.reduce((sum, p) => sum + p.volume, 0)
        });
      }
      currentMonth = [];
      currentMonthKey = monthKey;
    }
    
    currentMonth.push(point);
  });
  
  if (currentMonth.length > 0) {
    monthlyData.push({
      date: currentMonth[currentMonth.length - 1].date,
      open: currentMonth[0].open,
      high: Math.max(...currentMonth.map(p => p.high)),
      low: Math.min(...currentMonth.map(p => p.low)),
      close: currentMonth[currentMonth.length - 1].close,
      volume: currentMonth.reduce((sum, p) => sum + p.volume, 0)
    });
  }
  
  return monthlyData;
};

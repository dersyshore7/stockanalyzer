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

interface FetchedSeries {
  data: ProcessedDataPoint[];
  lastRefreshed: string;
}

export interface MultiTimeframeData {
  day: ProcessedDataPoint[];
  week: ProcessedDataPoint[];
  month: ProcessedDataPoint[];
  threeMonth: ProcessedDataPoint[];
  sixMonth: ProcessedDataPoint[];
  year: ProcessedDataPoint[];
}

export interface QuoteStatus {
  lastRefreshed: string;
  isStale: boolean;
}

const API_KEY = import.meta.env.VITE_ALPHA_VANTAGE_API_KEY || 'demo';
const BASE_URL = 'https://www.alphavantage.co/query';

const CORS_PROXY = 'https://api.allorigins.win/raw?url=';
const YAHOO_BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

const getLatestTradingDay = (date: Date): string => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay();
  if (day === 6) {
    d.setUTCDate(d.getUTCDate() - 1);
  } else if (day === 0) {
    d.setUTCDate(d.getUTCDate() - 2);
  }
  return d.toISOString().split('T')[0];
};

const isDataStale = (lastRefreshed: string): boolean => {
  const lastDate = lastRefreshed.split(' ')[0];
  const latestTrading = getLatestTradingDay(new Date());
  return lastDate < latestTrading;
};

export const fetchDailyData = async (symbol: string): Promise<FetchedSeries> => {
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

  const lastRefreshed = data['Meta Data']?.['3. Last Refreshed'] || '';

  return {
    data: processTimeSeriesData(data['Time Series (Daily)']),
    lastRefreshed
  };
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

const fetchYahooFinanceData = async (symbol: string): Promise<FetchedSeries> => {
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
    const lastTimestamp = timestamps[timestamps.length - 1];

    return {
      data: timestamps
        .map((timestamp: number, index: number) => ({
          date: new Date(timestamp * 1000).toISOString().split('T')[0],
          open: quotes.open[index] || 0,
          high: quotes.high[index] || 0,
          low: quotes.low[index] || 0,
          close: quotes.close[index] || 0,
          volume: quotes.volume[index] || 0
        }))
        .filter((point: ProcessedDataPoint) => point.close > 0),
      lastRefreshed: new Date(lastTimestamp * 1000).toISOString().split('T')[0]
    };
  } catch (error) {
    console.error('Yahoo Finance CORS proxy error:', error);
    throw new Error('Failed to fetch data from Yahoo Finance via CORS proxy');
  }
};

export const getMultiTimeframeData = async (
  symbol: string
): Promise<{ data: MultiTimeframeData; status: QuoteStatus }> => {
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

    const data: MultiTimeframeData = {
      day: daily.data.slice(-30),
      week: weekly.slice(-12),
      month: monthly.slice(-12),
      threeMonth: daily.data.filter(d => new Date(d.date) >= threeMonthsAgo),
      sixMonth: daily.data.filter(d => new Date(d.date) >= sixMonthsAgo),
      year: daily.data.filter(d => new Date(d.date) >= oneYearAgo)
    };

    return {
      data,
      status: {
        lastRefreshed: daily.lastRefreshed,
        isStale: isDataStale(daily.lastRefreshed)
      }
    };
  } catch (error) {
    console.error('Alpha Vantage failed, trying Yahoo Finance fallback:', error);

    try {
      const yahooData = await fetchYahooFinanceData(symbol);

      if (yahooData.data.length === 0) {
        throw new Error('No data available for this symbol');
      }

      const now = new Date();
      const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

      const weeklyData = generateWeeklyFromDaily(yahooData.data);
      const monthlyData = generateMonthlyFromDaily(yahooData.data);

      const data: MultiTimeframeData = {
        day: yahooData.data.slice(-30),
        week: weeklyData.slice(-12),
        month: monthlyData.slice(-12),
        threeMonth: yahooData.data.filter(d => new Date(d.date) >= threeMonthsAgo),
        sixMonth: yahooData.data.filter(d => new Date(d.date) >= sixMonthsAgo),
        year: yahooData.data.filter(d => new Date(d.date) >= oneYearAgo)
      };

      return {
        data,
        status: {
          lastRefreshed: yahooData.lastRefreshed,
          isStale: isDataStale(yahooData.lastRefreshed)
        }
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

export const calculateRSI = (data: ProcessedDataPoint[], period: number = 14): number => {
  if (data.length < period + 1) return 50;
  
  const prices = data.slice(-period - 1);
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i].close - prices[i - 1].close;
    if (change > 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
};

export const calculateSMA = (data: ProcessedDataPoint[], period: number): number => {
  if (data.length < period) return data[data.length - 1]?.close || 0;
  
  const prices = data.slice(-period);
  const sum = prices.reduce((acc, point) => acc + point.close, 0);
  return sum / period;
};

export const calculateVolumeAnalysis = (data: ProcessedDataPoint[]): {
  avgVolume: number;
  recentVolume: number;
  volumeTrend: string;
} => {
  if (data.length < 10) {
    return {
      avgVolume: 0,
      recentVolume: 0,
      volumeTrend: 'insufficient data'
    };
  }
  
  const avgVolume = data.reduce((acc, point) => acc + point.volume, 0) / data.length;
  const recentVolume = data[data.length - 1].volume;
  const volumeTrend = recentVolume > avgVolume * 1.5 ? 'high' : 
                     recentVolume < avgVolume * 0.5 ? 'low' : 'normal';
  
  return { avgVolume, recentVolume, volumeTrend };
};

export const calculateTrendDirection = (data: ProcessedDataPoint[]): {
  shortTrend: string;
  mediumTrend: string;
  momentum: number;
} => {
  if (data.length < 20) {
    return {
      shortTrend: 'insufficient data',
      mediumTrend: 'insufficient data',
      momentum: 0
    };
  }
  
  const recent = data.slice(-5);
  const medium = data.slice(-20);
  
  const recentChange = (recent[recent.length - 1].close - recent[0].close) / recent[0].close * 100;
  const mediumChange = (medium[medium.length - 1].close - medium[0].close) / medium[0].close * 100;
  
  const shortTrend = recentChange > 2 ? 'bullish' : recentChange < -2 ? 'bearish' : 'sideways';
  const mediumTrend = mediumChange > 5 ? 'bullish' : mediumChange < -5 ? 'bearish' : 'sideways';
  
  return {
    shortTrend,
    mediumTrend,
    momentum: recentChange
  };
};

export const generateTechnicalAnalysis = (data: ProcessedDataPoint[], timeframe: string): string => {
  if (data.length < 20) {
    return `${timeframe}: Insufficient data for technical analysis`;
  }
  
  const rsi = calculateRSI(data);
  const sma20 = calculateSMA(data, 20);
  const sma50 = calculateSMA(data, Math.min(50, data.length));
  const currentPrice = data[data.length - 1].close;
  const volumeAnalysis = calculateVolumeAnalysis(data);
  const trendAnalysis = calculateTrendDirection(data);
  
  const rsiSignal = rsi > 70 ? 'overbought' : rsi < 30 ? 'oversold' : 'neutral';
  const smaSignal = currentPrice > sma20 ? 'above SMA20' : 'below SMA20';
  const trendSignal = sma20 > sma50 ? 'uptrend' : 'downtrend';
  
  return `${timeframe}: Price $${currentPrice.toFixed(2)}, RSI ${rsi.toFixed(1)} (${rsiSignal}), ${smaSignal}, ${trendSignal}, Volume ${volumeAnalysis.volumeTrend}, Momentum ${trendAnalysis.momentum.toFixed(1)}%`;
};

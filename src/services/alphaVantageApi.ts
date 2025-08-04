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
  } else if (day === 1) {
    d.setUTCDate(d.getUTCDate() - 3);
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

export const calculateEMA = (data: ProcessedDataPoint[], period: number): number => {
  if (data.length < period) return data[data.length - 1]?.close || 0;

  const k = 2 / (period + 1);
  let ema = data.slice(0, period).reduce((sum, p) => sum + p.close, 0) / period;

  for (let i = period; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k);
  }

  return ema;
};

export const calculateMACD = (
  data: ProcessedDataPoint[]
): { macd: number; signal: number } => {
  if (data.length < 35) return { macd: 0, signal: 0 };

  const ema12Arr: number[] = [];
  const ema26Arr: number[] = [];
  const closes = data.map(p => p.close);

  const k12 = 2 / (12 + 1);
  const k26 = 2 / (26 + 1);

  let ema12 = closes.slice(0, 12).reduce((sum, p) => sum + p, 0) / 12;
  let ema26 = closes.slice(0, 26).reduce((sum, p) => sum + p, 0) / 26;

  ema12Arr[11] = ema12;
  ema26Arr[25] = ema26;

  for (let i = 12; i < closes.length; i++) {
    ema12 = closes[i] * k12 + ema12 * (1 - k12);
    ema12Arr[i] = ema12;
  }

  for (let i = 26; i < closes.length; i++) {
    ema26 = closes[i] * k26 + ema26 * (1 - k26);
    ema26Arr[i] = ema26;
  }

  const macdSeries: number[] = [];
  for (let i = 25; i < closes.length; i++) {
    macdSeries.push(ema12Arr[i] - ema26Arr[i]);
  }

  const k9 = 2 / (9 + 1);
  let signal = macdSeries.slice(0, 9).reduce((sum, p) => sum + p, 0) / 9;

  for (let i = 9; i < macdSeries.length; i++) {
    signal = macdSeries[i] * k9 + signal * (1 - k9);
  }

  const macd = macdSeries[macdSeries.length - 1];

  return { macd, signal };
};

export const calculateOBV = (data: ProcessedDataPoint[]): number[] => {
  const obv: number[] = [0];
  for (let i = 1; i < data.length; i++) {
    if (data[i].close > data[i - 1].close) {
      obv[i] = obv[i - 1] + data[i].volume;
    } else if (data[i].close < data[i - 1].close) {
      obv[i] = obv[i - 1] - data[i].volume;
    } else {
      obv[i] = obv[i - 1];
    }
  }
  return obv;
};

export const calculateATR = (data: ProcessedDataPoint[], period: number = 14): number => {
  if (data.length < period + 1) return 0;

  const trs: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const current = data[i];
    const prev = data[i - 1];
    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - prev.close),
      Math.abs(current.low - prev.close)
    );
    trs.push(tr);
  }

  const recent = trs.slice(-period);
  const atr = recent.reduce((sum, v) => sum + v, 0) / period;

  return atr;
};

export const generateTechnicalAnalysis = (data: ProcessedDataPoint[], timeframe: string): string => {
  if (data.length < 2) {
    return `${timeframe}: Insufficient data for technical analysis`;
  }

  const currentPrice = data[data.length - 1].close;

  const rsiValue = data.length >= 15 ? calculateRSI(data) : null;
  const rsiSignal = rsiValue === null
    ? 'insufficient data'
    : `${rsiValue.toFixed(1)} (${rsiValue > 70 ? 'overbought' : rsiValue < 30 ? 'oversold' : 'neutral'})`;

  const sma50 = data.length >= 50 ? calculateSMA(data, 50) : null;
  const sma200 = data.length >= 200 ? calculateSMA(data, 200) : null;
  const smaSignal = sma50 === null
    ? 'SMA50 insufficient data'
    : currentPrice > sma50 ? 'above SMA50' : 'below SMA50';
  const trendSignal = sma50 === null || sma200 === null
    ? 'trend insufficient data'
    : sma50 > sma200 ? 'uptrend' : 'downtrend';

  const macdResult = data.length >= 35 ? calculateMACD(data) : null;
  const macdSignal = macdResult === null
    ? 'insufficient data'
    : `${macdResult.macd.toFixed(2)} (${macdResult.macd > macdResult.signal ? 'above' : 'below'} signal)`;

  const obvValues = data.length >= 2 ? calculateOBV(data) : null;
  const obvSignal = obvValues && obvValues.length >= 2
    ? obvValues[obvValues.length - 1] > obvValues[obvValues.length - 2]
      ? 'rising'
      : obvValues[obvValues.length - 1] < obvValues[obvValues.length - 2]
        ? 'falling'
        : 'flat'
    : 'insufficient data';

  const atrValue = data.length >= 15 ? calculateATR(data) : null;
  const atrText = atrValue === null ? 'insufficient data' : atrValue.toFixed(2);

  const volumeAnalysis = calculateVolumeAnalysis(data);

  return `${timeframe}: Price $${currentPrice.toFixed(2)}, RSI ${rsiSignal}, ${smaSignal}, Trend ${trendSignal}, MACD ${macdSignal}, OBV ${obvSignal}, ATR ${atrText}, Volume ${volumeAnalysis.volumeTrend}`;
};

export interface QuickQuoteResponse {
  'Global Quote'?: {
    '01. symbol': string;
    '02. open': string;
    '03. high': string;
    '04. low': string;
    '05. price': string;
    '06. volume': string;
    '07. latest trading day': string;
    '08. previous close': string;
    '09. change': string;
    '10. change percent': string;
  };
  'Error Message'?: string;
  'Note'?: string;
}

export const getQuickPrice = async (symbol: string): Promise<{
  currentPrice: number;
  previousClose: number;
  change: number;
  changePercent: number;
} | null> => {
  try {
    const response = await fetch(`${BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`);
    const data: QuickQuoteResponse = await response.json();

    if (data['Error Message']) {
      throw new Error(`Alpha Vantage API Error: ${data['Error Message']}`);
    }

    if (data['Note']) {
      throw new Error('API rate limit exceeded. Please wait or upgrade your Alpha Vantage API key.');
    }

    const quote = data['Global Quote'];
    if (!quote) {
      return null;
    }

    const currentPrice = parseFloat(quote['05. price']);
    const previousClose = parseFloat(quote['08. previous close']);
    const change = parseFloat(quote['09. change']);
    const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));

    return {
      currentPrice,
      previousClose,
      change,
      changePercent
    };
  } catch (error) {
    console.error(`Failed to fetch quick price for ${symbol}:`, error);
    return null;
  }
};

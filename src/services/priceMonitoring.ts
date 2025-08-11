import { getQuickPrice } from './alphaVantageApi';

export interface PriceUpdate {
  symbol: string;
  currentPrice: number;
  timestamp: Date;
}

export class PriceMonitor {
  private intervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private callbacks: Map<string, (update: PriceUpdate) => void> = new Map();

  startMonitoring(symbol: string, callback: (update: PriceUpdate) => void, intervalMs: number = 300000) {
    this.stopMonitoring(symbol);
    
    this.callbacks.set(symbol, callback);
    
    const fetchPrice = async () => {
      try {
        const result = await getQuickPrice(symbol);
        if (result) {
          callback({
            symbol,
            currentPrice: result.currentPrice,
            timestamp: new Date(),
          });
        }
      } catch (error) {
        console.error(`Failed to fetch price for ${symbol}:`, error);
      }
    };

    fetchPrice();
    
    const interval = setInterval(fetchPrice, intervalMs);
    this.intervals.set(symbol, interval);
  }

  stopMonitoring(symbol: string) {
    const interval = this.intervals.get(symbol);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(symbol);
    }
    this.callbacks.delete(symbol);
  }

  stopAllMonitoring() {
    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals.clear();
    this.callbacks.clear();
  }

  async getCurrentPrice(symbol: string): Promise<number | null> {
    try {
      const result = await getQuickPrice(symbol);
      return result ? result.currentPrice : null;
    } catch (error) {
      console.error(`Failed to fetch current price for ${symbol}:`, error);
      return null;
    }
  }
}

export const priceMonitor = new PriceMonitor();

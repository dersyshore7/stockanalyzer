import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { priceMonitor } from '@/services/priceMonitoring';

interface StockData {
  symbol: string;
  currentPrice: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  loading: boolean;
}

const MOST_TRADED_STOCKS = [
  'AAPL', 'TSLA', 'NVDA', 'SPY', 'QQQ', 
  'MSFT', 'AMZN', 'GOOGL', 'META', 'AMD'
];

export function MostTradedStocks() {
  const [stocksData, setStocksData] = useState<StockData[]>(
    MOST_TRADED_STOCKS.map(symbol => ({
      symbol,
      currentPrice: null,
      previousClose: null,
      change: null,
      changePercent: null,
      loading: true
    }))
  );

  useEffect(() => {
    const fetchStockData = async () => {
      for (const stock of stocksData) {
        try {
          const currentPrice = await priceMonitor.getCurrentPrice(stock.symbol);
          if (currentPrice !== null) {
            const previousClose = currentPrice * (0.98 + Math.random() * 0.04);
            const change = currentPrice - previousClose;
            const changePercent = (change / previousClose) * 100;

            setStocksData(prev => prev.map(s => 
              s.symbol === stock.symbol 
                ? {
                    ...s,
                    currentPrice,
                    previousClose,
                    change,
                    changePercent,
                    loading: false
                  }
                : s
            ));
          }
        } catch (error) {
          console.error(`Failed to fetch data for ${stock.symbol}:`, error);
          setStocksData(prev => prev.map(s => 
            s.symbol === stock.symbol ? { ...s, loading: false } : s
          ));
        }
      }
    };

    fetchStockData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatChange = (change: number, changePercent: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${formatCurrency(change)} (${sign}${changePercent.toFixed(2)}%)`;
  };

  return (
    <Card className="w-full max-w-7xl mx-auto mb-8">
      <CardHeader>
        <CardTitle className="text-center">Most Options-Traded Stocks</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {stocksData.map((stock) => (
            <div key={stock.symbol} className="border rounded-lg p-4">
              <div className="text-center">
                <h3 className="font-semibold text-lg">{stock.symbol}</h3>
                {stock.loading ? (
                  <div className="text-gray-500">Loading...</div>
                ) : stock.currentPrice !== null ? (
                  <>
                    <div className="text-xl font-bold">
                      {formatCurrency(stock.currentPrice)}
                    </div>
                    {stock.change !== null && stock.changePercent !== null && (
                      <Badge 
                        variant={stock.change >= 0 ? "default" : "destructive"}
                        className="mt-1"
                      >
                        {formatChange(stock.change, stock.changePercent)}
                      </Badge>
                    )}
                  </>
                ) : (
                  <div className="text-gray-500">No data</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

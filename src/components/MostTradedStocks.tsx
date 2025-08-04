import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getQuickPrice } from '@/services/alphaVantageApi';

interface StockData {
  symbol: string;
  currentPrice: number | null;
  previousClose: number | null;
  change: number | null;
  changePercent: number | null;
  loading: boolean;
}

const MOST_TRADED_STOCKS = [
  'TSLA', 'NVDA', 'AMZN', 'META', 'MSFT', 'AAPL', 'AMD', 'PLTR', 'COIN', 'HOOD',
  'MSTR', 'FIG', 'UNH', 'RDDT', 'AVGO', 'GOOG', 'SPOT', 'IDXX', 'CRCL', 'GTLS',
  'NFLX', 'LLY', 'JOBY', 'APP', 'RBLX', 'SMCI', 'ORCL', 'HIMS', 'PANW', 'OKLO',
  'GEV', 'CVNA', 'COST', 'BA', 'GOOGL', 'RGTI', 'IBM', 'BBAI', 'ISRG', 'VST',
  'C', 'MELI', 'VRT', 'BTBD', 'BAC', 'SBUX', 'IONQ', 'CVX', 'MRVL', 'SHOP'
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
      const batchSize = 5;
      const batches = [];
      
      for (let i = 0; i < MOST_TRADED_STOCKS.length; i += batchSize) {
        batches.push(MOST_TRADED_STOCKS.slice(i, i + batchSize));
      }
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        const batchPromises = batch.map(async (symbol) => {
          try {
            const priceData = await getQuickPrice(symbol);
            if (priceData) {
              setStocksData(prev => prev.map(s => 
                s.symbol === symbol 
                  ? {
                      ...s,
                      currentPrice: priceData.currentPrice,
                      previousClose: priceData.previousClose,
                      change: priceData.change,
                      changePercent: priceData.changePercent,
                      loading: false
                    }
                  : s
              ));
            } else {
              setStocksData(prev => prev.map(s => 
                s.symbol === symbol ? { ...s, loading: false } : s
              ));
            }
          } catch (error) {
            console.error(`Failed to fetch data for ${symbol}:`, error);
            setStocksData(prev => prev.map(s => 
              s.symbol === symbol ? { ...s, loading: false } : s
            ));
          }
        });
        
        await Promise.all(batchPromises);
        
        if (batchIndex < batches.length - 1) {
          console.log(`Batch ${batchIndex + 1}/${batches.length} completed. Waiting 1 second before next batch...`);
          await sleep(1000);
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
        <CardTitle className="text-center">Most Actively Traded Stocks</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-3">
          {stocksData.map((stock) => (
            <div key={stock.symbol} className="border rounded-lg p-3">
              <div className="text-center">
                <h3 className="font-semibold text-sm">{stock.symbol}</h3>
                {stock.loading ? (
                  <div className="text-gray-500 text-xs">Loading...</div>
                ) : stock.currentPrice !== null ? (
                  <>
                    <div className="text-sm font-bold">
                      {formatCurrency(stock.currentPrice)}
                    </div>
                    {stock.change !== null && stock.changePercent !== null && (
                      <Badge 
                        variant={stock.change >= 0 ? "default" : "destructive"}
                        className="mt-1 text-xs"
                      >
                        {formatChange(stock.change, stock.changePercent)}
                      </Badge>
                    )}
                  </>
                ) : (
                  <div className="text-gray-500 text-xs">No data</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

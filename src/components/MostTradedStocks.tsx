import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const MOST_TRADED_STOCKS = [
  'TSLA', 'NVDA', 'AMZN', 'META', 'MSFT', 'AAPL', 'AMD', 'PLTR', 'COIN', 'HOOD',
  'MSTR', 'FIG', 'UNH', 'RDDT', 'AVGO', 'GOOG', 'SPOT', 'IDXX', 'CRCL', 'GTLS',
  'NFLX', 'LLY', 'JOBY', 'APP', 'RBLX', 'SMCI', 'ORCL', 'HIMS', 'PANW', 'OKLO',
  'GEV', 'CVNA', 'COST', 'BA', 'GOOGL', 'RGTI', 'IBM', 'BBAI', 'ISRG', 'VST',
  'C', 'MELI', 'VRT', 'BTBD', 'BAC', 'SBUX', 'IONQ', 'CVX', 'MRVL', 'SHOP'
];

export function MostTradedStocks() {
  return (
    <Card className="w-full max-w-7xl mx-auto mb-8">
      <CardHeader>
        <CardTitle className="text-center">Most Actively Traded Stocks</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-3">
          {MOST_TRADED_STOCKS.map((symbol) => (
            <div key={symbol} className="border rounded-lg p-3">
              <div className="text-center">
                <h3 className="font-semibold text-sm">{symbol}</h3>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

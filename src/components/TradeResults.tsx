import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTradeTracking, type TrackedTrade } from '@/hooks/use-trade-tracking';
import { priceMonitor } from '@/services/priceMonitoring';

interface TradeResultsProps {
  onBack: () => void;
}

export function TradeResults({ onBack }: TradeResultsProps) {
  const { getTradeHistory, getActiveTrades, updateTradePrice, closeTrade } = useTradeTracking();
  const [refreshing, setRefreshing] = useState(false);
  
  const tradeHistory = getTradeHistory();
  const activeTrades = getActiveTrades();

  useEffect(() => {
    activeTrades.forEach(trade => {
      if (trade.status === 'confirmed') {
        priceMonitor.startMonitoring(trade.symbol, (update) => {
          updateTradePrice(trade.id, update.currentPrice);
        });
      }
    });

    return () => {
      priceMonitor.stopAllMonitoring();
    };
  }, [activeTrades, updateTradePrice]);

  const handleRefreshPrices = async () => {
    setRefreshing(true);
    
    for (const trade of activeTrades) {
      if (trade.status === 'confirmed') {
        const currentPrice = await priceMonitor.getCurrentPrice(trade.symbol);
        if (currentPrice !== null) {
          updateTradePrice(trade.id, currentPrice);
        }
      }
    }
    
    setRefreshing(false);
  };

  const handleCloseTrade = (tradeId: string) => {
    closeTrade(tradeId);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPercentage = (percentage: number) => {
    return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(2)}%`;
  };

  const getStatusBadge = (trade: TrackedTrade) => {
    switch (trade.status) {
      case 'pending':
        return <Badge variant="secondary">Pending Entry</Badge>;
      case 'confirmed':
        return <Badge variant="default">Active</Badge>;
      case 'closed':
        return <Badge variant="outline">Closed</Badge>;
      default:
        return null;
    }
  };

  const getPnLBadge = (trade: TrackedTrade) => {
    if (trade.pnl === undefined) return null;
    
    const isProfit = trade.pnl > 0;
    return (
      <Badge variant={isProfit ? "default" : "destructive"}>
        {formatCurrency(trade.pnl)} ({formatPercentage(trade.pnlPercentage || 0)})
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">
            Trade Results
          </h1>
          <Button onClick={onBack} variant="outline">
            Back to Analysis
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Total Trades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{tradeHistory.totalTrades}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Successful Trades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">{tradeHistory.successfulTrades}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Success Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{tradeHistory.successRate.toFixed(1)}%</div>
            </CardContent>
          </Card>
        </div>

        {activeTrades.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Active Trades ({activeTrades.length})</CardTitle>
                <Button 
                  onClick={handleRefreshPrices} 
                  disabled={refreshing}
                  size="sm"
                >
                  {refreshing ? 'Refreshing...' : 'Refresh Prices'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeTrades.map((trade) => (
                  <div key={trade.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-lg">{trade.symbol}</h3>
                        <p className="text-sm text-gray-600">
                          {trade.recommendation.action?.optionType.toUpperCase()} Option @ ${trade.recommendation.action?.strikePrice}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {getStatusBadge(trade)}
                        {getPnLBadge(trade)}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Entry Price:</span>
                        <div className="font-medium">
                          {trade.entryPrice ? formatCurrency(trade.entryPrice) : 'Not set'}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">Current Price:</span>
                        <div className="font-medium">
                          {trade.currentPrice ? formatCurrency(trade.currentPrice) : 'Loading...'}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">Target:</span>
                        <div className="font-medium">
                          ${trade.recommendation.action?.targetPrice}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">Expiration:</span>
                        <div className="font-medium">
                          {trade.recommendation.action?.expirationDate}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 flex justify-end">
                      <Button 
                        onClick={() => handleCloseTrade(trade.id)}
                        variant="outline"
                        size="sm"
                      >
                        Close Trade
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {tradeHistory.trades.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Trade History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tradeHistory.trades
                  .sort((a, b) => new Date(b.confirmedAt).getTime() - new Date(a.confirmedAt).getTime())
                  .map((trade) => (
                    <div key={trade.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold">{trade.symbol}</h3>
                          <p className="text-sm text-gray-600">
                            {trade.recommendation.recommendationType}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {getStatusBadge(trade)}
                          {getPnLBadge(trade)}
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-500">
                        Confirmed: {trade.confirmedAt.toLocaleDateString()}
                        {trade.closedAt && ` • Closed: ${trade.closedAt.toLocaleDateString()}`}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {tradeHistory.trades.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-gray-500">No trades yet. Start by analyzing stocks and confirming recommendations!</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

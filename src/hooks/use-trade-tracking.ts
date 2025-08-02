import { useState, useEffect, useCallback } from 'react';

export interface TrackedTrade {
  id: string;
  symbol: string;
  recommendation: {
    recommendationType: 'Call Option Recommended' | 'Put Option Recommended' | 'No Action Recommended';
      action?: {
        strikePrice: number;
        optionType: 'call' | 'put';
        targetPrice: number;
        priceType: 'bid' | 'ask';
        expirationDate: string;
        expirationReason: string;
      };
      reasoning: string;
    };
  confirmedAt: Date;
  entryPrice?: number;
  currentPrice?: number;
  status: 'pending' | 'confirmed' | 'closed';
  pnl?: number;
  pnlPercentage?: number;
  closedAt?: Date;
}

export interface TradeHistory {
  trades: TrackedTrade[];
  totalTrades: number;
  successfulTrades: number;
  successRate: number;
}

const STORAGE_KEY = 'stockanalyzer_trades';

export function useTradeTracking() {
  const [trades, setTrades] = useState<TrackedTrade[]>([]);

  useEffect(() => {
    const storedTrades = localStorage.getItem(STORAGE_KEY);
    if (storedTrades) {
      try {
        const parsedTrades = JSON.parse(storedTrades) as TrackedTrade[];
        setTrades(
          parsedTrades.map(trade => ({
            ...trade,
            confirmedAt: new Date(trade.confirmedAt),
            closedAt: trade.closedAt ? new Date(trade.closedAt) : undefined,
          }))
        );
      } catch (error) {
        console.error('Failed to parse stored trades:', error);
      }
    }
  }, []);

  const saveTrades = useCallback((updatedTrades: TrackedTrade[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTrades));
    setTrades(updatedTrades);
  }, []);

  const confirmTrade = useCallback((
    symbol: string,
    recommendation: TrackedTrade['recommendation'],
    entryPrice?: number
  ) => {
    const newTrade: TrackedTrade = {
      id: `${symbol}-${Date.now()}`,
      symbol,
      recommendation,
      confirmedAt: new Date(),
      entryPrice,
      status: entryPrice ? 'confirmed' : 'pending',
    };

    const updatedTrades = [...trades, newTrade];
    saveTrades(updatedTrades);
    return newTrade.id;
  }, [trades, saveTrades]);

  const updateTradePrice = useCallback((tradeId: string, currentPrice: number, entryPrice?: number) => {
    const updatedTrades = trades.map(trade => {
      if (trade.id === tradeId) {
        const updatedTrade = { 
          ...trade, 
          currentPrice,
          status: (entryPrice !== undefined ? 'confirmed' : trade.status) as TrackedTrade['status']
        };

        if (entryPrice !== undefined) {
          updatedTrade.entryPrice = entryPrice;
        }

        if (updatedTrade.entryPrice && updatedTrade.recommendation.action) {
          const { optionType, strikePrice } = updatedTrade.recommendation.action;
          let pnl = 0;
          
          if (optionType === 'call') {
            pnl = Math.max(0, currentPrice - strikePrice) - updatedTrade.entryPrice;
          } else if (optionType === 'put') {
            pnl = Math.max(0, strikePrice - currentPrice) - updatedTrade.entryPrice;
          }
          
          updatedTrade.pnl = pnl;
          updatedTrade.pnlPercentage = updatedTrade.entryPrice > 0 ? (pnl / updatedTrade.entryPrice) * 100 : 0;
        }

        return updatedTrade;
      }
      return trade;
    });

    saveTrades(updatedTrades);
  }, [trades, saveTrades]);

  const closeTrade = useCallback((tradeId: string) => {
    const updatedTrades = trades.map(trade => {
      if (trade.id === tradeId) {
        return {
          ...trade,
          status: 'closed' as const,
          closedAt: new Date(),
        };
      }
      return trade;
    });

    saveTrades(updatedTrades);
  }, [trades, saveTrades]);

  const getTradeHistory = useCallback((): TradeHistory => {
    const totalTrades = trades.length;
    const successfulTrades = trades.filter(trade => 
      trade.pnl !== undefined && trade.pnl > 0
    ).length;
    const successRate = totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0;

    return {
      trades,
      totalTrades,
      successfulTrades,
      successRate,
    };
  }, [trades]);

  const getActiveTrades = useCallback(() => {
    return trades.filter(trade => trade.status !== 'closed');
  }, [trades]);

  const getTradeBySymbol = useCallback((symbol: string) => {
    return trades.find(trade => trade.symbol === symbol && trade.status !== 'closed');
  }, [trades]);

  return {
    trades,
    confirmTrade,
    updateTradePrice,
    closeTrade,
    getTradeHistory,
    getActiveTrades,
    getTradeBySymbol,
  };
}

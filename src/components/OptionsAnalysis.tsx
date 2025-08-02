import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { getMultiTimeframeData, generateTechnicalAnalysis } from '@/services/alphaVantageApi';
import { generateMultiTimeframeCharts, ChartImage } from '@/services/chartGenerator';
import { useTradeTracking } from '@/hooks/use-trade-tracking';
import { priceMonitor } from '@/services/priceMonitoring';

interface OptionsRecommendation {
  symbol: string;
  recommendation: string;
  loading: boolean;
  charts?: ChartImage[];
  parsedRecommendation?: OpenAIRecommendationResponse;
}

interface OpenAIRecommendationResponse {
  recommendationType: 'Call Option Recommended' | 'Put Option Recommended' | 'No Action Recommended';
  confidence: 'Low' | 'Medium' | 'High';
  action?: {
    strikePrice: number;
    optionType: 'call' | 'put';
    targetPrice: number;
    priceType: 'bid' | 'ask';
    expirationDate: string;
    expirationReason: string;
  };
  reasoning: string;
}

interface OptionsAnalysisProps {
  symbols: string[];
  onBack: () => void;
}

type MultiTimeframeData = Awaited<ReturnType<typeof getMultiTimeframeData>>['data'];

export function OptionsAnalysis({ symbols, onBack }: OptionsAnalysisProps) {
  const [recommendations, setRecommendations] = useState<OptionsRecommendation[]>([]);
  const [currentSymbolIndex, setCurrentSymbolIndex] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [entryPrices, setEntryPrices] = useState<Record<string, string>>({});
  const [enlargedChart, setEnlargedChart] = useState<(ChartImage & { symbol: string }) | null>(null);
  const { confirmTrade, getTradeBySymbol, updateTradePrice } = useTradeTracking();

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const retryWithBackoff = async <T,>(
      fn: () => Promise<T>,
      maxRetries: number = 3,
      baseDelay: number = 1000
    ): Promise<T> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        const isRateLimit = error instanceof Error && 
          (error.message.includes('rate_limit') || error.message.includes('429'));
        
        if (isRateLimit) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.log(`Rate limit detected, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
          await sleep(delay);
        } else {
          throw error;
        }
      }
    }
    throw new Error('Max retries exceeded');
  };

  const analyzeSymbol = async (symbol: string) => {
    try {
      setRecommendations(prev => [
        ...prev.filter(r => r.symbol !== symbol),
        { symbol, recommendation: '', loading: true }
      ]);

      const result = await getMultiTimeframeData(symbol);
      if (result.status.isStale) {
        setRecommendations(prev => [
          ...prev.filter(r => r.symbol !== symbol),
          { symbol, recommendation: `Data last refreshed on ${result.status.lastRefreshed}. Analysis skipped due to stale data.`, loading: false }
        ]);
        return;
      }
      const data = result.data;
      const charts = await generateMultiTimeframeCharts(symbol, data);

      const technicalAnalysis = [
        generateTechnicalAnalysis(data.day, 'Day'),
        generateTechnicalAnalysis(data.week, 'Week'),
        generateTechnicalAnalysis(data.month, 'Month'),
        generateTechnicalAnalysis(data.threeMonth, '3 Month'),
        generateTechnicalAnalysis(data.sixMonth, '6 Month'),
        generateTechnicalAnalysis(data.year, 'Year')
      ].join('\n');

      const chartDescriptions = `Technical Analysis Summary:
${technicalAnalysis}

  Chart Analysis: ${charts.length} candlestick charts generated showing price action, volume, and technical indicators (SMA50, SMA200, MACD, OBV, ATR) across multiple timeframes.`;

      const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;
      let recommendation = '';
      let parsedRecommendation: OpenAIRecommendationResponse | undefined = undefined;

      if (openaiApiKey && openaiApiKey !== 'YOUR_OPENAI_API_KEY_HERE') {
        try {
          const makeOpenAIRequest = async (): Promise<{ recommendation: string; parsedRecommendation?: OpenAIRecommendationResponse }> => {
            const request = async (model: string) => {
              const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${openaiApiKey}`
                },
                body: JSON.stringify({
                  model,
                  messages: [{
                    role: 'user',
                    content: [
                      {
                        type: 'text',
                        text: `Stock: ${symbol}

Based on the charts provided, analyze the candlestick patterns and provide a recommendation.

IMPORTANT: Respond with ONLY valid JSON in this exact format (no markdown, no extra text):

{
  "recommendationType": "Call Option Recommended" | "Put Option Recommended" | "No Action Recommended",
  "confidence": "Low" | "Medium" | "High",
  "action": {
    "strikePrice": number,
    "optionType": "call" | "put",
    "targetPrice": number,
    "priceType": "bid" | "ask",
      "expirationDate": "YYYY-MM-DD",
      "expirationReason": "Why this expiration date was chosen"
    },
  "reasoning": "Detailed explanation based on candlestick patterns"
}

If recommending "No Action Recommended", omit the "action" field entirely.

Choose an expiration date that best supports the recommended option trade and provide it in YYYY-MM-DD format. Include a brief explanation of why this expiration date was chosen.

Your recommendation should be grounded in technical analysis including RSI, 50- & 200-day moving averages (trend direction), MACD (momentum), On-Balance Volume (OBV for volume flow), Average True Range (ATR for volatility), broader volume analysis, momentum, and candlestick patterns. Look for confluence of multiple technical indicators. If there are clear technical signals from multiple indicators pointing in the same direction, provide a recommendation. If the technical indicators are mixed or neutral, set recommendationType to "No Action Recommended".

Consider the following for recommendations:
- RSI overbought (>70) or oversold (<30) conditions
- Position relative to 50- & 200-day moving averages and crossovers
- MACD alignment above/below the signal line for momentum shifts
- OBV rising or falling to gauge volume participation
- ATR values to measure current volatility
- Candlestick patterns (doji, hammer, engulfing, etc.)
- Overall trend direction across timeframes

CONFIDENCE LEVEL CRITERIA:
- High 🟢: Strong confluence of 4+ indicators (e.g., RSI extremes, SMA50/200 crossover, MACD agreement, OBV trend, ATR context) pointing in same direction, strong volume confirmation, clear candlestick patterns
- Medium 🟡: Moderate confluence of 2-3 of these indicators with mostly consistent signals, RSI approaching extremes (60-70 or 30-40)
- Low 🔴: Weak or conflicting signals among indicators, neutral RSI (40-60), unclear trend direction, high uncertainty

Provide detailed reasoning explaining which specific technical indicators support your recommendation and justify your confidence level.

Technical Data: ${chartDescriptions}`
                      },
                      ...charts.map(chart => ({
                        type: 'image_url' as const,
                        image_url: {
                          url: chart.dataUrl
                        }
                      }))
                    ]
                  }],
                  max_tokens: 600,
                  temperature: 0.7
                })
              });

              const result = await response.json();

              if (!response.ok) {
                if (response.status === 429) {
                  throw new Error('rate_limit_exceeded');
                }
                throw new Error(result.error?.message || `OpenAI API error: ${response.status} ${response.statusText}`);
              }

              if (result.choices && result.choices[0]) {
                const content = result.choices[0].message.content;
                console.log('Raw OpenAI response:', content);

                let jsonContent = content;
                if (content.includes('```json')) {
                  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
                  if (jsonMatch) {
                    jsonContent = jsonMatch[1];
                  }
                } else if (content.includes('```')) {
                  const jsonMatch = content.match(/```\s*([\s\S]*?)\s*```/);
                  if (jsonMatch) {
                    jsonContent = jsonMatch[1];
                  }
                }

                try {
                  const parsedResponse: OpenAIRecommendationResponse = JSON.parse(jsonContent.trim());
                  console.log('Parsed OpenAI response:', parsedResponse);
                  const formattedRecommendation = formatRecommendationForDisplay(parsedResponse);
                  console.log('Formatted recommendation:', formattedRecommendation);
                  return { recommendation: formattedRecommendation, parsedRecommendation: parsedResponse };
                } catch (jsonError) {
                  console.error('Failed to parse OpenAI JSON response, using raw content:', jsonError);
                  console.error('Content that failed to parse:', jsonContent);
                  return { recommendation: formatPlainTextResponse(content) };
                }
              }

              throw new Error('Invalid response from OpenAI');
            };

            try {
              return await request('o3');
            } catch (error) {
              const message = error instanceof Error ? error.message.toLowerCase() : '';
              if (message.includes('model') || message.includes('exist')) {
                console.warn('o3 model unavailable, falling back to gpt-4o');
                return await request('gpt-4o');
              }
              throw error;
            }
          };

          const result = await retryWithBackoff(makeOpenAIRequest, 3, 2000);
          recommendation = result.recommendation;
          parsedRecommendation = result.parsedRecommendation;

        } catch (openaiError) {
          console.error('OpenAI API failed after retries:', openaiError);
          
          if (openaiError instanceof Error) {
            if (openaiError.message.includes('rate_limit')) {
              console.error('Rate limit exceeded for OpenAI API');
              recommendation = generateRateLimitAnalysis(data, charts);
            } else if (openaiError.message.includes('invalid_api_key')) {
              console.error('Invalid OpenAI API key');
              recommendation = generateDemoAnalysis(symbol, charts);
            } else {
              console.error('OpenAI API error:', openaiError.message);
              recommendation = generateTechnicalFallbackAnalysis(data, charts);
            }
          } else {
            recommendation = generateTechnicalFallbackAnalysis(data, charts);
          }
        }
      } else {
        console.log('No OpenAI API key provided, using demo analysis');
        recommendation = generateDemoAnalysis(symbol, charts);
      }

      setRecommendations(prev => 
        prev.map(r => 
          r.symbol === symbol 
            ? { 
                symbol, 
                recommendation, 
                loading: false,
                charts,
                parsedRecommendation
              }
            : r
        )
      );
    } catch (error) {
      console.error(`Error analyzing ${symbol}:`, error);
      setRecommendations(prev => 
        prev.map(r => 
          r.symbol === symbol 
            ? { 
                symbol, 
                recommendation: `Error analyzing ${symbol}. Please try again.`, 
                loading: false 
              }
            : r
        )
      );
    }
  };

  const formatRecommendationForDisplay = (response: OpenAIRecommendationResponse): string => {
    const confidenceEmoji = response.confidence === 'High' ? '🟢' : response.confidence === 'Medium' ? '🟡' : '🔴';
    let formatted = `📊 ${response.recommendationType.toUpperCase()}\n\n`;
    formatted += `${confidenceEmoji} Confidence: ${response.confidence}\n\n`;
    
    if (response.action && response.recommendationType !== 'No Action Recommended') {
      formatted += `💡 Recommended Action:\n`;
      formatted += `Purchase (paper) ${response.action.optionType.toUpperCase()} Option at Strike Price of $${response.action.strikePrice}\n`;
      formatted += `Target ${response.action.priceType === 'bid' ? 'Bid' : 'Ask'} price: $${response.action.targetPrice}\n`;
        formatted += `Expiration: ${response.action.expirationDate}\n`;
        formatted += `Expiration Rationale: ${response.action.expirationReason}\n\n`;
      }
    
    formatted += `🔍 Candlestick Pattern Analysis:\n${response.reasoning}`;
    
    return formatted;
  };

  const formatPlainTextResponse = (content: string): string => {
    if (content.includes('Call Option Recommended') || 
        content.includes('Put Option Recommended') || 
        content.includes('No Action Recommended')) {
      return content;
    }
    
    return `📊 ANALYSIS RESULT\n\n${content}`;
  };

  const generateDemoAnalysis = (symbol: string, charts: ChartImage[]): string => {
    const timeframes = charts.map(c => c.timeframe).join(', ');
    
    return `📊 NO ACTION RECOMMENDED (DEMO MODE)

⚠️ This is a demonstration analysis since no OpenAI API key is configured. For real trading recommendations, please add your OpenAI API key to the environment variables.

📈 Technical Analysis Summary:
Based on the generated charts for timeframes: ${timeframes}

🔍 Candlestick Pattern Analysis:
- Multiple timeframe analysis shows price action across different periods
- Charts have been successfully generated from real market data via Yahoo Finance API
- For actual candlestick pattern analysis, the system would analyze patterns like:
  • Doji patterns (indecision)
  • Hammer/Hanging man (reversal signals)
  • Engulfing patterns (trend continuation/reversal)
  • Morning/Evening star formations
  • Support and resistance levels

💡 Demo Recommendation:
This demo system has successfully:
✅ Fetched real stock data for ${symbol}
✅ Generated multi-timeframe charts (${timeframes})
✅ Processed OHLCV data through CORS proxy
✅ Created visual chart representations

🚀 Next Steps:
To get actual AI-powered options trading recommendations:
1. Add your OpenAI API key to environment variables
2. The system will then analyze the generated charts using GPT-4 Vision
3. Receive detailed technical analysis and specific options trading recommendations in structured JSON format

📋 System Status:
- Data Source: ✅ Yahoo Finance (via CORS proxy)
- Chart Generation: ✅ Chart.js with real OHLCV data  
- AI Analysis: ⏳ Requires OpenAI API key for full functionality

The technical infrastructure is working correctly and ready for AI-powered analysis once an API key is provided.`;
  };

  const generateRateLimitAnalysis = (data: MultiTimeframeData, charts: ChartImage[]): string => {
    return `📊 TECHNICAL ANALYSIS (RATE LIMITED)

⚠️ OpenAI API rate limit exceeded. Providing technical analysis based on calculated indicators.

${generateTechnicalFallbackContent(data, charts)}

🔄 Please wait a few minutes before trying again for AI-powered analysis.`;
  };

  const generateTechnicalFallbackAnalysis = (data: MultiTimeframeData, charts: ChartImage[]): string => {
    return `📊 TECHNICAL ANALYSIS (FALLBACK MODE)

⚠️ AI analysis temporarily unavailable. Providing technical analysis based on calculated indicators.

${generateTechnicalFallbackContent(data, charts)}

🔄 Technical analysis is based on RSI, 50- & 200-day moving averages, MACD, OBV, ATR, volume, and momentum indicators.`;
  };

  const generateTechnicalFallbackContent = (data: MultiTimeframeData, charts: ChartImage[]): string => {
    const timeframes = charts.map(c => c.timeframe).join(', ');
    
    const technicalSummary = [
      generateTechnicalAnalysis(data.day, 'Day'),
      generateTechnicalAnalysis(data.week, 'Week'),
      generateTechnicalAnalysis(data.month, 'Month'),
      generateTechnicalAnalysis(data.threeMonth, '3 Month'),
      generateTechnicalAnalysis(data.sixMonth, '6 Month'),
      generateTechnicalAnalysis(data.year, 'Year')
    ].join('\n');

    return `📈 Technical Analysis Summary:
${technicalSummary}

🔍 Key Indicators Analysis:
- RSI levels indicate overbought/oversold conditions
- 50- & 200-day moving averages highlight trend direction
- MACD crossovers reveal momentum shifts
- OBV trends show volume flow
- ATR values reflect market volatility

💡 Recommendation Logic:
- Look for RSI extremes (>70 overbought, <30 oversold)
- Consider price position relative to moving averages and MACD alignment
- Monitor OBV direction and ATR for confirmation
- Multiple timeframe confluence increases signal strength

📋 Charts Generated: ${timeframes}
✅ Data Source: Real market data via Yahoo Finance/Alpha Vantage
✅ Technical Indicators: RSI, SMA50/200, MACD, OBV, ATR, Volume, Momentum calculated`;
  };

  const analyzeAllSymbols = async () => {
    setIsAnalyzing(true);
    setRecommendations([]);
    
    for (let i = 0; i < symbols.length; i++) {
      setCurrentSymbolIndex(i);
      await analyzeSymbol(symbols[i]);
      
      if (i < symbols.length - 1) {
        console.log(`Waiting 3 seconds before analyzing next stock to prevent rate limiting...`);
        await sleep(3000);
      }
    }
    
    setIsAnalyzing(false);
  };

  const closeRecommendation = (symbol: string) => {
    setRecommendations(prev => prev.filter(r => r.symbol !== symbol));
  };

  const handleConfirmTrade = async (rec: OptionsRecommendation) => {
    if (!rec.parsedRecommendation || rec.parsedRecommendation.recommendationType === 'No Action Recommended') {
      return;
    }

    const entryPriceStr = entryPrices[rec.symbol];
    const entryPrice = entryPriceStr ? parseFloat(entryPriceStr) : undefined;

    const tradeId = confirmTrade(rec.symbol, rec.parsedRecommendation, entryPrice);

    if (entryPrice) {
      const currentPrice = await priceMonitor.getCurrentPrice(rec.symbol);
      if (currentPrice !== null) {
        updateTradePrice(tradeId, currentPrice, entryPrice);
      }
    }

    setEntryPrices(prev => ({ ...prev, [rec.symbol]: '' }));
  };

  const handleEntryPriceChange = (symbol: string, value: string) => {
    setEntryPrices(prev => ({ ...prev, [symbol]: value }));
  };


  const isTradeConfirmed = (symbol: string) => {
    const existingTrade = getTradeBySymbol(symbol);
    return existingTrade !== undefined;
  };

  const getTradeStatus = (symbol: string) => {
    const existingTrade = getTradeBySymbol(symbol);
    if (!existingTrade) return null;

    switch (existingTrade.status) {
      case 'pending':
        return <Badge variant="secondary">Trade Pending Entry</Badge>;
      case 'confirmed':
        return (
          <div className="flex gap-2">
            <Badge variant="default">Trade Active</Badge>
            {existingTrade.pnl !== undefined && (
              <Badge variant={existingTrade.pnl >= 0 ? "default" : "destructive"}>
                {existingTrade.pnl >= 0 ? '+' : ''}${existingTrade.pnl.toFixed(2)} 
                ({existingTrade.pnlPercentage?.toFixed(1)}%)
              </Badge>
            )}
          </div>
        );
      case 'closed':
        return <Badge variant="outline">Trade Closed</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">
            Options Analysis
          </h1>
          <Button onClick={onBack} variant="outline">
            Back to Input
          </Button>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Analyzing: {symbols.join(', ')}</CardTitle>
          </CardHeader>
          <CardContent>
            {!isAnalyzing && recommendations.length === 0 && (
              <Button onClick={analyzeAllSymbols} className="w-full">
                Start Analysis
              </Button>
            )}
            
            {isAnalyzing && (
              <div className="text-center">
                <p className="mb-2">
                  Analyzing {symbols[currentSymbolIndex]} ({currentSymbolIndex + 1} of {symbols.length})
                </p>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {recommendations.map((rec) => (
            <Card key={rec.symbol} className="relative">
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  {rec.symbol} - Options Recommendation
                  <Button
                    onClick={() => closeRecommendation(rec.symbol)}
                    variant="ghost"
                    size="sm"
                  >
                    ×
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {rec.loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-2">Analyzing charts...</span>
                  </div>
                ) : (
                  <div>
                    {rec.charts && rec.charts.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-semibold mb-2">Generated Charts:</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {rec.charts.map((chart, index) => (
                            <div key={index} className="text-center">
                              <img
                                src={chart.dataUrl}
                                alt={`${rec.symbol} ${chart.timeframe}`}
                                className="w-full h-32 object-contain border rounded cursor-pointer"
                                onClick={() => setEnlargedChart({ ...chart, symbol: rec.symbol })}
                              />
                              <p className="text-xs text-gray-500 mt-1">{chart.timeframe}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="text-gray-700 whitespace-pre-wrap mb-4">
                      {rec.recommendation}
                    </div>
                    
                    {rec.parsedRecommendation && rec.parsedRecommendation.recommendationType !== 'No Action Recommended' && (
                      <div className="border-t pt-4">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-semibold">Track AI Recommendation</h4>
                          {getTradeStatus(rec.symbol)}
                        </div>
                        
                        {!isTradeConfirmed(rec.symbol) ? (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium mb-1">
                                Entry Price (optional)
                              </label>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="Enter option price paid"
                                value={entryPrices[rec.symbol] || ''}
                                onChange={(e) => handleEntryPriceChange(rec.symbol, e.target.value)}
                                className="w-full"
                              />
                              <p className="text-xs text-gray-500 mt-1">
                                Leave empty to track without P&L calculation
                              </p>
                            </div>
                            <Button 
                              onClick={() => handleConfirmTrade(rec)}
                              className="w-full"
                              size="sm"
                            >
                              Track this trade
                            </Button>
                          </div>
                        ) : (
                          <div className="text-center py-2">
                            <p className="text-sm text-gray-600">
                              Trade confirmed and being tracked
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <Dialog open={!!enlargedChart} onOpenChange={(open) => !open && setEnlargedChart(null)}>
        <DialogContent className="max-w-3xl">
          {enlargedChart && (
            <div className="text-center">
              <img
                src={enlargedChart.dataUrl}
                alt={`${enlargedChart.symbol} ${enlargedChart.timeframe}`}
                className="w-full h-auto"
              />
              <p className="text-sm text-gray-500 mt-2">
                {enlargedChart.symbol} {enlargedChart.timeframe}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

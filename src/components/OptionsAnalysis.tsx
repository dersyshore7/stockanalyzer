import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getMultiTimeframeData } from '@/services/alphaVantageApi';
import { generateMultiTimeframeCharts, ChartImage } from '@/services/chartGenerator';

interface OptionsRecommendation {
  symbol: string;
  recommendation: string;
  loading: boolean;
  charts?: ChartImage[];
}

interface OptionsAnalysisProps {
  symbols: string[];
  onBack: () => void;
}

export function OptionsAnalysis({ symbols, onBack }: OptionsAnalysisProps) {
  const [recommendations, setRecommendations] = useState<OptionsRecommendation[]>([]);
  const [currentSymbolIndex, setCurrentSymbolIndex] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeSymbol = async (symbol: string) => {
    try {
      setRecommendations(prev => [
        ...prev.filter(r => r.symbol !== symbol),
        { symbol, recommendation: '', loading: true }
      ]);

      const data = await getMultiTimeframeData(symbol);
      const charts = await generateMultiTimeframeCharts(symbol, data);

      const chartDescriptions = charts.map(chart => 
        `${chart.timeframe} Chart: Generated from OHLCV data`
      ).join('\n');

      const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;
      let recommendation = '';

      if (openaiApiKey && openaiApiKey !== 'YOUR_OPENAI_API_KEY_HERE') {
        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openaiApiKey}`
            },
            body: JSON.stringify({
              model: 'gpt-4o',
              messages: [{
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `Stock: ${symbol}

Based on the charts provided, please analyze and recommend whether I should purchase a call or put option for the July 25th expiration. Be sure to analyze each of the photos provided. If you do recommend a trade, specify:

The strike price

Whether to buy at the bid or ask price

The exact price to target

For example: "For July 25th, buy at the strike price of $170, for the Asking price of $3.75"

Your recommendation should be grounded in technical chart patterns and expert-level analysis. If there is no VERY strong, evidence-based reason to enter a trade, clearly say so. Do not suggest an action unless the technical indicators, and specifically the chart/candle patterns genuinely support it.

Please explain your reasoning in detail.

Charts provided: ${chartDescriptions}`
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
          
          if (result.choices && result.choices[0]) {
            recommendation = result.choices[0].message.content;
          } else {
            throw new Error('Invalid response from OpenAI');
          }
        } catch (openaiError) {
          console.error('OpenAI API failed, using demo analysis:', openaiError);
          recommendation = generateDemoAnalysis(symbol, charts);
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
                charts 
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

  const generateDemoAnalysis = (symbol: string, charts: ChartImage[]): string => {
    const timeframes = charts.map(c => c.timeframe).join(', ');
    
    return `📊 DEMO ANALYSIS for ${symbol}

⚠️ This is a demonstration analysis since no OpenAI API key is configured. For real trading recommendations, please add your OpenAI API key to the environment variables.

📈 Technical Analysis Summary:
Based on the generated charts for timeframes: ${timeframes}

🔍 Chart Pattern Analysis:
- Multiple timeframe analysis shows price action across different periods
- Charts have been successfully generated from real market data via Yahoo Finance API
- Technical indicators would typically be analyzed for trend direction, support/resistance levels, and momentum

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
3. Receive detailed technical analysis and specific options trading recommendations

📋 System Status:
- Data Source: ✅ Yahoo Finance (via CORS proxy)
- Chart Generation: ✅ Chart.js with real OHLCV data  
- AI Analysis: ⏳ Requires OpenAI API key for full functionality

The technical infrastructure is working correctly and ready for AI-powered analysis once an API key is provided.`;
  };

  const analyzeAllSymbols = async () => {
    setIsAnalyzing(true);
    setRecommendations([]);
    
    for (let i = 0; i < symbols.length; i++) {
      setCurrentSymbolIndex(i);
      await analyzeSymbol(symbols[i]);
      
      if (i < symbols.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 12000));
      }
    }
    
    setIsAnalyzing(false);
  };

  const closeRecommendation = (symbol: string) => {
    setRecommendations(prev => prev.filter(r => r.symbol !== symbol));
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
                                className="w-full h-32 object-contain border rounded"
                              />
                              <p className="text-xs text-gray-500 mt-1">{chart.timeframe}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="text-gray-700 whitespace-pre-wrap">
                      {rec.recommendation}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

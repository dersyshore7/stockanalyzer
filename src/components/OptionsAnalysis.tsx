import { useState } from 'react';
import { addWeeks, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getMultiTimeframeData, generateTechnicalAnalysis } from '@/services/alphaVantageApi';
import { generateMultiTimeframeCharts, ChartImage } from '@/services/chartGenerator';

interface OptionsRecommendation {
  symbol: string;
  recommendation: string;
  loading: boolean;
  charts?: ChartImage[];
}

interface OpenAIRecommendationResponse {
  recommendationType: 'Call Option Recommended' | 'Put Option Recommended' | 'No Action Recommended';
  action?: {
    strikePrice: number;
    optionType: 'call' | 'put';
    targetPrice: number;
    priceType: 'bid' | 'ask';
    expirationDate: string;
  };
  reasoning: string;
}

interface OptionsAnalysisProps {
  symbols: string[];
  onBack: () => void;
}

const generateExpirationDate = (): string => {
  const currentDate = new Date();
  const futureDate = addWeeks(currentDate, 3);
  return format(futureDate, 'MMMM do');
};

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

Chart Analysis: ${charts.length} candlestick charts generated showing price action, volume, and technical indicators across multiple timeframes.`;

      const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;
      const dynamicExpirationDate = generateExpirationDate();
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

Based on the charts provided, analyze the candlestick patterns and provide a recommendation. 

IMPORTANT: Respond with ONLY valid JSON in this exact format (no markdown, no extra text):

{
  "recommendationType": "Call Option Recommended" | "Put Option Recommended" | "No Action Recommended",
  "action": {
    "strikePrice": number,
    "optionType": "call" | "put", 
    "targetPrice": number,
    "priceType": "bid" | "ask",
    "expirationDate": "${dynamicExpirationDate}"
  },
  "reasoning": "Detailed explanation based on candlestick patterns"
}

If recommending "No Action Recommended", omit the "action" field entirely.

Your recommendation should be grounded in technical analysis including RSI, moving averages, volume analysis, momentum, and candlestick patterns. Look for confluence of multiple technical indicators. If there are clear technical signals from multiple indicators pointing in the same direction, provide a recommendation. If the technical indicators are mixed or neutral, set recommendationType to "No Action Recommended".

Consider the following for recommendations:
- RSI overbought (>70) or oversold (<30) conditions
- Price position relative to moving averages
- Volume trends and momentum
- Candlestick patterns (doji, hammer, engulfing, etc.)
- Overall trend direction across timeframes

Provide detailed reasoning explaining which specific technical indicators support your recommendation.

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
              recommendation = formatRecommendationForDisplay(parsedResponse);
              console.log('Formatted recommendation:', recommendation);
            } catch (jsonError) {
              console.error('Failed to parse OpenAI JSON response, using raw content:', jsonError);
              console.error('Content that failed to parse:', jsonContent);
              recommendation = formatPlainTextResponse(content);
            }
          } else {
            throw new Error('Invalid response from OpenAI');
          }
        } catch (openaiError) {
          console.error('OpenAI API failed:', openaiError);
          
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

  const formatRecommendationForDisplay = (response: OpenAIRecommendationResponse): string => {
    let formatted = `📊 ${response.recommendationType.toUpperCase()}\n\n`;
    
    if (response.action && response.recommendationType !== 'No Action Recommended') {
      formatted += `💡 Recommended Action:\n`;
      formatted += `Purchase (paper) ${response.action.optionType.toUpperCase()} Option at Strike Price of $${response.action.strikePrice}\n`;
      formatted += `Target ${response.action.priceType === 'bid' ? 'Bid' : 'Ask'} price: $${response.action.targetPrice}\n`;
      formatted += `Expiration: ${response.action.expirationDate}\n\n`;
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

  const generateRateLimitAnalysis = (data: any, charts: ChartImage[]): string => {
    return `📊 TECHNICAL ANALYSIS (RATE LIMITED)

⚠️ OpenAI API rate limit exceeded. Providing technical analysis based on calculated indicators.

${generateTechnicalFallbackContent(data, charts)}

🔄 Please wait a few minutes before trying again for AI-powered analysis.`;
  };

  const generateTechnicalFallbackAnalysis = (data: any, charts: ChartImage[]): string => {
    return `📊 TECHNICAL ANALYSIS (FALLBACK MODE)

⚠️ AI analysis temporarily unavailable. Providing technical analysis based on calculated indicators.

${generateTechnicalFallbackContent(data, charts)}

🔄 Technical analysis is based on RSI, moving averages, volume, and momentum indicators.`;
  };

  const generateTechnicalFallbackContent = (data: any, charts: ChartImage[]): string => {
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
- Moving average positions show trend direction
- Volume analysis reveals market interest
- Momentum calculations show price velocity

💡 Recommendation Logic:
- Look for RSI extremes (>70 overbought, <30 oversold)
- Consider price position relative to moving averages
- Analyze volume trends for confirmation
- Multiple timeframe confluence increases signal strength

📋 Charts Generated: ${timeframes}
✅ Data Source: Real market data via Yahoo Finance/Alpha Vantage
✅ Technical Indicators: RSI, SMA, Volume, Momentum calculated`;
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

import { useEffect, useRef, useState } from 'react'
import './App.css'

function App() {
  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          Real-Time Stock Charts
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 auto-rows-fr">
          <TradingViewChart symbol="AAPL" />
          <TradingViewChart symbol="GOOGL" />
          <TradingViewChart symbol="MSFT" />
          <TradingViewChart symbol="TSLA" />
        </div>
      </div>
    </div>
  )
}

interface TradingViewChartProps {
  symbol: string;
}

interface OptionsRecommendation {
  symbol: string;
  recommendation: string;
  loading: boolean;
}

function TradingViewChart({ symbol }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [recommendation, setRecommendation] = useState<OptionsRecommendation | null>(null);

  const extractIndicatorValues = () => {
    try {
      const indicators = {
        sma: null as number | null,
        rsi: null as number | null,
        macd: null as number | null,
        atr: null as number | null,
        obv: null as number | null,
        currentPrice: null as number | null
      };

      console.log(`=== DETAILED DEBUGGING FOR ${symbol} ===`);
      
      const allText = document.body.textContent || '';
      const allHTML = document.body.innerHTML || '';
      console.log(`Document body text length: ${allText.length}`);
      console.log(`Document body HTML length: ${allHTML.length}`);
      
      console.log(`First 1000 chars of textContent:`, allText.substring(0, 1000));
      
      console.log(`Looking for SMA in textContent...`);
      const smaTextIndex = allText.indexOf('SMA');
      if (smaTextIndex !== -1) {
        console.log(`Found SMA in textContent at index ${smaTextIndex}, context:`, allText.substring(smaTextIndex, smaTextIndex + 100));
      } else {
        console.log(`SMA not found in textContent`);
      }
      
      console.log(`Looking for SMA in innerHTML...`);
      const smaHTMLIndex = allHTML.indexOf('SMA');
      if (smaHTMLIndex !== -1) {
        console.log(`Found SMA in innerHTML at index ${smaHTMLIndex}, context:`, allHTML.substring(smaHTMLIndex, smaHTMLIndex + 200));
      }
      
      console.log(`Looking for 'close' in textContent...`);
      const closeTextIndex = allText.indexOf('close');
      if (closeTextIndex !== -1) {
        console.log(`Found 'close' in textContent at index ${closeTextIndex}, context:`, allText.substring(closeTextIndex - 20, closeTextIndex + 50));
      } else {
        console.log(`'close' not found in textContent`);
      }
      
      console.log(`Looking for 'close' in innerHTML...`);
      const closeHTMLIndex = allHTML.indexOf('close');
      if (closeHTMLIndex !== -1) {
        console.log(`Found 'close' in innerHTML at index ${closeHTMLIndex}, context:`, allHTML.substring(closeHTMLIndex - 50, closeHTMLIndex + 100));
      }
      
      console.log(`=== TRYING EXTRACTION FROM innerHTML ===`);
      
      const smaMatch = allHTML.match(/SMA[\s\S]*?(\d+)[\s\S]*?close[\s\S]*?(\d+(?:\.\d+)?)/i);
      if (smaMatch) {
        indicators.sma = parseFloat(smaMatch[2]);
        console.log(`Found SMA: ${indicators.sma} from pattern: ${smaMatch[0]}`);
      }

      const rsiMatch = allHTML.match(/RSI[\s\S]*?(\d+)[\s\S]*?close[\s\S]*?(\d+(?:\.\d+)?)/i);
      if (rsiMatch) {
        indicators.rsi = parseFloat(rsiMatch[2]);
        console.log(`Found RSI: ${indicators.rsi} from pattern: ${rsiMatch[0]}`);
      }

      const macdMatch = allHTML.match(/MACD[\s\S]*?(\d+)[\s\S]*?(\d+)[\s\S]*?close[\s\S]*?([-−]?\d+(?:\.\d+)?)/i);
      if (macdMatch) {
        indicators.macd = parseFloat(macdMatch[3].replace('−', '-'));
        console.log(`Found MACD: ${indicators.macd} from pattern: ${macdMatch[0]}`);
      }

      const atrMatch = allHTML.match(/ATR[\s\S]*?(\d+)[\s\S]*?RMA[\s\S]*?(\d+(?:\.\d+)?)/i);
      if (atrMatch) {
        indicators.atr = parseFloat(atrMatch[2]);
        console.log(`Found ATR: ${indicators.atr} from pattern: ${atrMatch[0]}`);
      }

      const priceMatch = allHTML.match(/C[\s\S]*?(\d+(?:\.\d+)?)(?=[\s\S]*?[−+])/i);
      if (priceMatch) {
        indicators.currentPrice = parseFloat(priceMatch[1]);
        console.log(`Found Current Price: ${indicators.currentPrice} from pattern: ${priceMatch[0]}`);
      }

      console.log(`Final indicators for ${symbol}:`, indicators);
      return indicators;
    } catch (error) {
      console.error('Error extracting indicator values:', error);
      return null;
    }
  };

  const generateOptionsRecommendation = async () => {
    setRecommendation({ symbol, recommendation: '', loading: true });
    
    const indicators = extractIndicatorValues();
    
    try {
      const indicatorData = indicators ? `
REAL CHART DATA FOR ${symbol}:
- Current Price: $${indicators.currentPrice || 'N/A'}
- Simple Moving Average (SMA): ${indicators.sma || 'N/A'}
- Relative Strength Index (RSI): ${indicators.rsi || 'N/A'}
- MACD: ${indicators.macd || 'N/A'}
- Average True Range (ATR): ${indicators.atr || 'N/A'}
- On Balance Volume (OBV): ${indicators.obv || 'Available in chart'}` : 
`Unable to extract specific values - please analyze based on general ${symbol} technical patterns.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY_HERE'}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [{
            role: 'user',
            content: `Stock: ${symbol}

This is for PAPER TRADING SIMULATION. Based on the specific technical indicator values from our real-time chart, analyze and recommend whether I should purchase a call or put option for the next 2-4 weeks expiration.

${indicatorData}

CANDLESTICK PATTERN ANALYSIS:
Please also consider these key candlestick patterns in your analysis:
- Doji: Indicates market indecision (open ≈ close)
- Hammer: Bullish reversal signal (small body, long lower wick)
- Shooting Star: Bearish reversal signal (small body, long upper wick)
- Engulfing Patterns: Momentum shift signals (one candle engulfs previous)
- Three White Soldiers/Three Black Crows: Strong trend continuation

ANALYSIS REQUIREMENTS:
- Use ONLY the specific indicator values provided above from our chart
- This is paper trading, so be more aggressive with recommendations when technical signals are strong
- Focus on the actual numbers provided, not general market conditions
- Consider both technical indicators AND candlestick patterns

If you recommend a trade, specify:
- The strike price (based on current price and technical signals)
- Whether to buy at the bid or ask price
- The exact price to target
- Expiration timeframe (next 2-4 weeks)

For example: "For the next 2-4 weeks, buy a call option at the strike price of $170, for the asking price of $3.75"

TECHNICAL ANALYSIS BASED ON PROVIDED VALUES:
- If RSI > 70: Overbought (consider puts)
- If RSI < 30: Oversold (consider calls)  
- If price > SMA: Uptrend (bullish bias)
- If price < SMA: Downtrend (bearish bias)
- MACD positive: Bullish momentum
- MACD negative: Bearish momentum
- High ATR: High volatility (good for options)

Your recommendation should be grounded in the SPECIFIC technical values provided above. If there is no VERY strong, evidence-based reason to enter a trade based on these numbers, clearly say so.

Please explain your reasoning in detail using the actual indicator values provided and any relevant candlestick patterns you can infer from the current market conditions.`
          }],
          max_tokens: 600,
          temperature: 0.7
        })
      });

      const data = await response.json();
      
      if (data.choices && data.choices[0]) {
        setRecommendation({
          symbol,
          recommendation: data.choices[0].message.content,
          loading: false
        });
      } else {
        throw new Error('Invalid response from OpenAI');
      }
    } catch (error) {
      console.error('Error calling OpenAI:', error);
      setRecommendation({
        symbol,
        recommendation: 'Error generating recommendation. Please try again.',
        loading: false
      });
    }
  };

  const closeRecommendation = () => {
    setRecommendation(null);
  };

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      
      const uniqueContainerId = `tradingview_${symbol}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      
      const widgetDiv = document.createElement('div');
      widgetDiv.className = 'tradingview-widget-container__widget';
      widgetDiv.id = uniqueContainerId;
      
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
      script.type = 'text/javascript';
      script.async = true;
      script.innerHTML = JSON.stringify({
        width: "100%",
        height: "450",
        symbol: symbol,
        interval: "D",
        timezone: "Etc/UTC",
        theme: "light",
        style: "1",
        locale: "en",
        enable_publishing: false,
        allow_symbol_change: true,
        calendar: false,
        support_host: "https://www.tradingview.com",
        container_id: uniqueContainerId,
        studies: [
          "STD;SMA",
          "STD;RSI",
          "STD;MACD",
          "STD;Average_True_Range"
        ]
      });

      containerRef.current.appendChild(widgetDiv);
      containerRef.current.appendChild(script);
    }
  }, [symbol]);

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 w-full overflow-hidden">
      <h2 className="text-xl font-semibold mb-4 text-gray-700">{symbol}</h2>
      <div 
        ref={containerRef}
        className="tradingview-widget-container w-full"
        style={{ height: '450px', minHeight: '450px', maxWidth: '100%' }}
      >
      </div>
      
      <div className="mt-4 text-center">
        <button
          onClick={generateOptionsRecommendation}
          disabled={recommendation?.loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200"
        >
          {recommendation?.loading ? 'Generating...' : 'Generate Options Trade Summary'}
        </button>
      </div>

      {recommendation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{ zIndex: 10000 }}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto relative">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-800">
                  Options Trade Summary - {recommendation.symbol}
                </h3>
                <button
                  onClick={closeRecommendation}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold leading-none p-1 min-w-[32px] min-h-[32px] flex items-center justify-center absolute top-4 right-4"
                  style={{ zIndex: 9999 }}
                >
                  ×
                </button>
              </div>
              
              <div className="text-gray-700 whitespace-pre-wrap">
                {recommendation.loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-2">Analyzing chart data...</span>
                  </div>
                ) : (
                  recommendation.recommendation
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App

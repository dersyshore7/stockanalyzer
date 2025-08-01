import { useState } from 'react'
import './App.css'
import { StockInput } from '@/components/StockInput'
import { OptionsAnalysis } from '@/components/OptionsAnalysis'
import { TradeResults } from '@/components/TradeResults'

type AppView = 'input' | 'analysis' | 'results';

function App() {
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [currentView, setCurrentView] = useState<AppView>('input');

  const handleAnalyze = (symbols: string[]) => {
    setSelectedSymbols(symbols);
    setCurrentView('analysis');
  };

  const handleBackToInput = () => {
    setSelectedSymbols([]);
    setCurrentView('input');
  };

  const handleViewResults = () => {
    setCurrentView('results');
  };

  const handleBackToAnalysis = () => {
    setCurrentView('analysis');
  };

  if (currentView === 'analysis' && selectedSymbols.length > 0) {
    return <OptionsAnalysis symbols={selectedSymbols} onBack={handleBackToInput} />;
  }

  if (currentView === 'results') {
    return <TradeResults onBack={handleBackToAnalysis} />;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">
            Stock Options Analysis
          </h1>
          <button
            onClick={handleViewResults}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            View Trade Results
          </button>
        </div>
        
        <StockInput onAnalyze={handleAnalyze} isLoading={false} />
      </div>
    </div>
  )
}

export default App

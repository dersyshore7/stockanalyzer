import { useState } from 'react'
import './App.css'
import { StockInput } from '@/components/StockInput'
import { OptionsAnalysis } from '@/components/OptionsAnalysis'

function App() {
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = (symbols: string[]) => {
    setSelectedSymbols(symbols);
    setIsAnalyzing(true);
  };

  const handleBack = () => {
    setSelectedSymbols([]);
    setIsAnalyzing(false);
  };

  if (isAnalyzing && selectedSymbols.length > 0) {
    return <OptionsAnalysis symbols={selectedSymbols} onBack={handleBack} />;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          Stock Options Analysis
        </h1>
        
        <StockInput onAnalyze={handleAnalyze} isLoading={false} />
      </div>
    </div>
  )
}

export default App

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StockInputProps {
  onAnalyze: (symbols: string[]) => void;
  isLoading: boolean;
}

export function StockInput({ onAnalyze, isLoading }: StockInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      const symbols = inputValue
        .split(',')
        .map(symbol => symbol.trim().toUpperCase())
        .filter(symbol => symbol.length > 0);
      
      if (symbols.length > 0) {
        onAnalyze(symbols);
      }
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-center">Stock Options Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Input
              type="text"
              placeholder="Enter stock symbols (e.g., NVDA, AAPL, TSLA)"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isLoading}
              className="w-full"
            />
            <p className="text-sm text-gray-500 mt-2">
              Enter one or more stock symbols separated by commas
            </p>
          </div>
          <Button 
            type="submit" 
            disabled={isLoading || !inputValue.trim()}
            className="w-full"
          >
            {isLoading ? 'Analyzing...' : 'Generate Options Recommendations'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

import React, { useState } from 'react';
import ResultCard from './ResultCard';
import { DocumentSearchIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';

const PriorArtSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setIsLoading(true);
    setResults(null);
    setTimeout(() => {
        setResults([
            { title: "Example Prior Art 1: AI-Powered Image Processing", description: "A system for automatically identifying and categorizing objects within digital images using convolutional neural networks." },
            { title: "Related Technology 2: Real-time Data Visualization", description: "A method for rendering large datasets into interactive graphical representations for intuitive analysis." },
        ]);
        setIsLoading(false);
    }, 1500);
  };

  return (
    <ResultCard title="Prior Art Search" icon={<DocumentSearchIcon className="w-6 h-6 text-blue-300" />}>
      <p className="text-gray-400 mb-4">
        Perform a targeted search for prior art related to a specific technology, feature, or keyword.
      </p>
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g., 'machine learning for image recognition'"
          className="flex-grow bg-gray-900 border border-gray-600 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !query}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold p-2 px-4 rounded-lg transition"
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </form>

      <div>
        {isLoading && <LoadingSpinner />}
        {results === null && !isLoading && (
            <div className="text-center text-gray-500 p-8 border-2 border-dashed border-gray-700 rounded-lg">
                <p>Search results will appear here.</p>
            </div>
        )}
        {results && results.length > 0 && (
            <ul className="space-y-4">
                {results.map((p, i) => (
                    <li key={i} className="p-4 bg-gray-800 rounded-lg border border-gray-700">
                        <h4 className="font-semibold text-gray-200">{p.title}</h4>
                        <p className="text-gray-400 text-sm">{p.description}</p>
                    </li>
                ))}
            </ul>
        )}
        {results && results.length === 0 && !isLoading && (
            <div className="text-center text-gray-500 p-8 border-2 border-dashed border-gray-700 rounded-lg">
                <p>No results found for your query.</p>
            </div>
        )}
      </div>
    </ResultCard>
  );
};

export default PriorArtSearch;

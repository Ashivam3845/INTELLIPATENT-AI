import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ClaimMapIcon } from './icons';
import ResultCard from './ResultCard';
import { ClaimMappingResult } from '../types';
import LoadingSpinner from './LoadingSpinner';
import * as geminiService from '../services/geminiService';

declare global {
  interface Window {
    Prism: {
      highlightAll: () => void;
    };
  }
}

interface ClaimMappingProps {
  subjectPatentText: string;
}

const ClaimMapping: React.FC<ClaimMappingProps> = ({ subjectPatentText }) => {
  const [subjectClaims, setSubjectClaims] = useState(subjectPatentText);
  const [referenceClaims, setReferenceClaims] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ClaimMappingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subjectPreRef = useRef<HTMLPreElement>(null);
  const referencePreRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    setSubjectClaims(subjectPatentText);
  }, [subjectPatentText]);

  useEffect(() => {
    if (window.Prism) {
      const timer = setTimeout(() => window.Prism.highlightAll(), 0);
      return () => clearTimeout(timer);
    }
  }, [subjectClaims, referenceClaims]);

  const handleMapClaims = useCallback(async () => {
    if (!subjectClaims.trim() || !referenceClaims.trim()) return;
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
        const mappingResult = await geminiService.performClaimMapping(subjectClaims, referenceClaims);
        if (mappingResult) {
            setResult(mappingResult);
        } else {
            setError("Failed to get a valid response from the analysis service.");
        }
    } catch (err) {
        console.error("Claim mapping failed:", err);
        setError("An error occurred during the claim mapping analysis.");
    } finally {
        setIsLoading(false);
    }
  }, [subjectClaims, referenceClaims]);

  const syncScroll = (preRef: React.RefObject<HTMLPreElement>) => (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (preRef.current) {
        preRef.current.scrollTop = e.currentTarget.scrollTop;
        preRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  return (
    <ResultCard title="Claim Analysis" icon={<ClaimMapIcon className="w-6 h-6 text-cyan-300" />}>
      <div className="space-y-6">
        <p className="text-sm text-gray-400">
          Compare the claims of your subject patent against the disclosure of a reference (prior art) patent. The subject claims are pre-filled from your initial analysis.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="subject-patent" className="block text-sm font-medium text-gray-300 mb-1">
              Subject Patent Claims
            </label>
            <div className="relative w-full h-64 font-mono text-sm bg-black/30 rounded-lg border border-white/20 focus-within:ring-2 focus-within:ring-cyan-500 transition-shadow">
              <textarea
                id="subject-patent"
                value={subjectClaims}
                onChange={(e) => setSubjectClaims(e.target.value)}
                onScroll={syncScroll(subjectPreRef)}
                placeholder="Paste claims here..."
                className="absolute inset-0 w-full h-full p-3 bg-transparent text-transparent caret-white resize-none outline-none"
                disabled={isLoading}
                spellCheck="false"
              />
              <pre ref={subjectPreRef} className="absolute inset-0 w-full h-full p-3 overflow-auto pointer-events-none" aria-hidden="true">
                <code className="language-js">
                    {subjectClaims + '\n'}
                </code>
              </pre>
            </div>
          </div>
          <div>
            <label htmlFor="reference-patent" className="block text-sm font-medium text-gray-300 mb-1">
              Reference Patent (Prior Art)
            </label>
            <div className="relative w-full h-64 font-mono text-sm bg-black/30 rounded-lg border border-white/20 focus-within:ring-2 focus-within:ring-cyan-500 transition-shadow">
              <textarea
                id="reference-patent"
                value={referenceClaims}
                onChange={(e) => setReferenceClaims(e.target.value)}
                onScroll={syncScroll(referencePreRef)}
                placeholder="Paste reference text here..."
                className="absolute inset-0 w-full h-full p-3 bg-transparent text-transparent caret-white resize-none outline-none"
                disabled={isLoading}
                spellCheck="false"
              />
              <pre ref={referencePreRef} className="absolute inset-0 w-full h-full p-3 overflow-auto pointer-events-none" aria-hidden="true">
                <code className="language-js">
                    {referenceClaims + '\n'}
                </code>
              </pre>
            </div>
          </div>
        </div>

        <button
          onClick={handleMapClaims}
          disabled={isLoading || !subjectClaims.trim() || !referenceClaims.trim()}
          className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center shadow-lg hover:shadow-teal-500/50 transform hover:scale-105 active:scale-100"
        >
          {isLoading ? 'Analyzing...' : 'Map Claims & Analyze'}
        </button>

        {isLoading && <LoadingSpinner />}
        
        {error && !isLoading && <div className="text-center text-red-400 p-4 border border-red-500/50 rounded-lg bg-red-900/20">{error}</div>}

        {result && !isLoading && (
          <div className="border-t border-white/10 pt-6 space-y-4">
            <div>
                <h3 className="text-lg font-semibold text-gray-200">Analysis Result</h3>
                <span className="inline-block bg-cyan-500/20 text-cyan-300 text-sm font-semibold px-3 py-1 rounded-full mt-1">
                    {result.category}
                </span>
            </div>
            <div>
                <h4 className="font-semibold text-gray-300">Rationale:</h4>
                <div className="text-gray-400 prose prose-sm prose-invert max-w-none">{result.rationale}</div>
            </div>
            <div>
                <h4 className="font-semibold text-gray-300 mb-2">Detailed Mapping:</h4>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs text-gray-300 uppercase bg-white/10">
                            <tr>
                                <th scope="col" className="px-4 py-3">Subject Claim</th>
                                <th scope="col" className="px-4 py-3">Reference Disclosure</th>
                                <th scope="col" className="px-4 py-3">Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            {result.mappings.map((mapping, index) => (
                                <tr key={index} className="border-b border-white/10 hover:bg-white/5">
                                    <td className="px-4 py-3 font-medium text-gray-200 whitespace-nowrap">{mapping.subjectClaim}</td>
                                    <td className="px-4 py-3">{mapping.referenceDisclosure}</td>
                                    <td className="px-4 py-3">{mapping.description}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
          </div>
        )}
      </div>
    </ResultCard>
  );
};

export default ClaimMapping;
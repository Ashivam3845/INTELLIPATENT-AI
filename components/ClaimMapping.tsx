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
      highlightElement: (element: Element) => void;
    };
  }
}

interface ClaimMappingProps {
  subjectPatentText: string;
  theme: 'light' | 'dark';
}

const ClaimMapping: React.FC<ClaimMappingProps> = ({ subjectPatentText, theme }) => {
  const [subjectClaims, setSubjectClaims] = useState(subjectPatentText);
  const [referenceClaims, setReferenceClaims] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ClaimMappingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subjectCodeRef = useRef<HTMLElement>(null);
  const referenceCodeRef = useRef<HTMLElement>(null);
  
  useEffect(() => {
    setSubjectClaims(subjectPatentText);
  }, [subjectPatentText]);

  useEffect(() => {
    if (window.Prism) {
        if (subjectCodeRef.current) window.Prism.highlightElement(subjectCodeRef.current);
        if (referenceCodeRef.current) window.Prism.highlightElement(referenceCodeRef.current);
    }
  }, [subjectClaims, referenceClaims, theme]);

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

  const syncScroll = (codeRef: React.RefObject<HTMLElement>) => (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (codeRef.current?.parentElement) {
        codeRef.current.parentElement.scrollTop = e.currentTarget.scrollTop;
        codeRef.current.parentElement.scrollLeft = e.currentTarget.scrollLeft;
    }
  };
  
  const Editor = ({ label, id, value, onChange, codeRef, isLoading }: {label: string, id: string, value: string, onChange: (v:string)=>void, codeRef: React.RefObject<HTMLElement>, isLoading: boolean}) => (
      <div>
        <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
          {label}
        </label>
        <div className="relative w-full h-64 font-mono text-sm bg-slate-100 dark:bg-black/30 rounded-lg border border-slate-300 dark:border-white/20 focus-within:ring-2 focus-within:ring-cyan-500 transition-shadow overflow-hidden">
          <textarea
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onScroll={syncScroll(codeRef)}
            placeholder="Paste text here..."
            className="absolute inset-0 w-full h-full p-3 bg-transparent text-transparent caret-slate-800 dark:caret-white resize-none outline-none z-10"
            disabled={isLoading}
            spellCheck="false"
          />
          <pre className="absolute inset-0 w-full h-full p-3 overflow-auto pointer-events-none" aria-hidden="true">
            <code ref={codeRef} className="language-js">
                {value + '\n'}
            </code>
          </pre>
        </div>
      </div>
  );

  return (
    <ResultCard title="Claim Analysis" icon={<ClaimMapIcon className="w-6 h-6 text-cyan-700 dark:text-cyan-300" />}>
      <div className="space-y-6">
        <p className="text-sm text-slate-500 dark:text-gray-400">
          Compare the claims of your subject patent against the disclosure of a reference (prior art) patent. The subject claims are pre-filled from your initial analysis.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Editor 
            label="Subject Patent Claims"
            id="subject-patent"
            value={subjectClaims}
            onChange={setSubjectClaims}
            codeRef={subjectCodeRef}
            isLoading={isLoading}
          />
          <Editor 
            label="Reference Patent (Prior Art)"
            id="reference-patent"
            value={referenceClaims}
            onChange={setReferenceClaims}
            codeRef={referenceCodeRef}
            isLoading={isLoading}
          />
        </div>

        <button
          onClick={handleMapClaims}
          disabled={isLoading || !subjectClaims.trim() || !referenceClaims.trim()}
          className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-400 dark:disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center shadow-lg hover:shadow-teal-500/50 transform hover:scale-105 active:scale-100"
        >
          {isLoading ? 'Analyzing...' : 'Map Claims & Analyze'}
        </button>

        {isLoading && <LoadingSpinner />}
        
        {error && !isLoading && <div className="text-center text-red-600 dark:text-red-400 p-4 border border-red-500/50 rounded-lg bg-red-500/10 dark:bg-red-900/20">{error}</div>}

        {result && !isLoading && (
          <div className="border-t border-slate-300 dark:border-white/10 pt-6 space-y-4">
            <div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-200">Analysis Result</h3>
                <span className="inline-block bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-sm font-semibold px-3 py-1 rounded-full mt-1">
                    {result.category}
                </span>
            </div>
            <div>
                <h4 className="font-semibold text-slate-700 dark:text-gray-300">Rationale:</h4>
                <div className="text-slate-600 dark:text-gray-400 prose prose-sm prose-slate dark:prose-invert max-w-none">{result.rationale}</div>
            </div>
            <div>
                <h4 className="font-semibold text-slate-700 dark:text-gray-300 mb-2">Detailed Mapping:</h4>
                <div className="overflow-x-auto border border-slate-300 dark:border-white/10 rounded-lg">
                    <table className="w-full text-sm text-left text-slate-600 dark:text-gray-400">
                        <thead className="text-xs text-slate-700 dark:text-gray-300 uppercase bg-slate-200 dark:bg-white/10">
                            <tr>
                                <th scope="col" className="px-4 py-3">Subject Claim</th>
                                <th scope="col" className="px-4 py-3">Reference Disclosure</th>
                                <th scope="col" className="px-4 py-3">Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            {result.mappings.map((mapping, index) => (
                                <tr key={index} className="border-b border-slate-200 dark:border-white/10 last:border-b-0 hover:bg-slate-100 dark:hover:bg-white/5">
                                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-gray-200 whitespace-nowrap">{mapping.subjectClaim}</td>
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
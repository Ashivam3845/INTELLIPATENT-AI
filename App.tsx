import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AppState, ChatMessage, GroundingSource, PriorArtSearchResult, ClaimMappingResult } from './types';
import * as geminiService from './services/geminiService';
import ResultCard from './components/ResultCard';
import GeoChart from './components/GeoChart';
import LoadingSpinner, { SkeletonLoader } from './components/LoadingSpinner';
import { BrainCircuitIcon, LightBulbIcon, SearchIcon, GlobeIcon, ChatBubbleIcon, DocumentSearchIcon, ClaimMapIcon } from './components/icons';
import { marked } from 'marked';
import Sidebar, { Page } from './components/Sidebar';
import ThemeSwitcher from './components/ThemeSwitcher';

declare global {
  interface Window {
    Prism: {
      highlightAll: () => void;
      highlightElement: (element: Element) => void;
    };
  }
}

const initialState: AppState = {
  patentText: '',
  analysisResult: null,
  isLoading: { initial: false, deep: false, chat: false, search: false, claimMapping: false },
  error: null,
  chatHistory: [],
  chatInstance: null,
  userLocation: null,
  searchMode: 'analyze',
  searchQuery: '',
  searchResults: null,
  searchSources: null,
  searchError: null,
  theme: 'dark',
  subjectClaims: '',
  referenceClaims: '',
  claimMappingResult: null,
  claimMappingError: null,
};

const placeholders = [
    "Paste patent text here...", 
    "Describe your invention in detail...", 
    "e.g., A method for neural network pruning...", 
];
const TYPING_SPEED = 100;
const DELETING_SPEED = 50;
const PAUSE_DURATION = 2000;


const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    const savedTheme = localStorage.getItem('theme') as AppState['theme'] | null;
    return { ...initialState, theme: savedTheme || 'dark' };
  });

  const [activePage, setActivePage] = useState<Page>('dashboard');
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  
  const [isHeaderVisible, setIsHeaderVisible] = useState(false);
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState('');

  const placeholderIndex = useRef(0);
  const charIndex = useRef(0);
  const isDeleting = useRef(false);

  const subjectCodeRef = useRef<HTMLElement>(null);
  const referenceCodeRef = useRef<HTMLElement>(null);
  
  useEffect(() => {
    const headerTimer = setTimeout(() => setIsHeaderVisible(true), 100);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState(s => ({
          ...s,
          userLocation: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }
        }));
      },
      (error) => console.warn("Could not get user location.", error)
    );
    
    return () => clearTimeout(headerTimer);
  }, []);
  
  // Effect for theme management
  useEffect(() => {
    if (state.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    (document.getElementById('prism-dark-theme') as HTMLLinkElement).disabled = state.theme === 'light';
    (document.getElementById('prism-light-theme') as HTMLLinkElement).disabled = state.theme === 'dark';
    localStorage.setItem('theme', state.theme);
  }, [state.theme]);

  // Effect for syntax highlighting
  useEffect(() => {
    if (window.Prism && state.searchMode === 'claimMapping') {
        if (subjectCodeRef.current) window.Prism.highlightElement(subjectCodeRef.current);
        if (referenceCodeRef.current) window.Prism.highlightElement(referenceCodeRef.current);
    }
  }, [state.subjectClaims, state.referenceClaims, state.theme, state.searchMode]);

  // Effect for animated placeholder
  useEffect(() => {
    let timeoutId: number;
    const handleTyping = () => {
        const currentPlaceholder = placeholders[placeholderIndex.current];
        
        if (!isDeleting.current) {
            if (charIndex.current < currentPlaceholder.length) charIndex.current++;
            else isDeleting.current = true;
        } else {
            if (charIndex.current > 0) charIndex.current--;
            else {
                isDeleting.current = false;
                placeholderIndex.current = (placeholderIndex.current + 1) % placeholders.length;
            }
        }

        const newText = currentPlaceholder.substring(0, charIndex.current);
        setAnimatedPlaceholder(newText + '|');

        let timeoutDuration = isDeleting.current ? DELETING_SPEED : TYPING_SPEED;
        if (!isDeleting.current && charIndex.current === currentPlaceholder.length) {
            timeoutDuration = PAUSE_DURATION;
        }

        timeoutId = setTimeout(handleTyping, timeoutDuration);
    };

    timeoutId = setTimeout(handleTyping, TYPING_SPEED);
    return () => clearTimeout(timeoutId);
  }, []);
  
  const scrollToBottom = () => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [state.chatHistory]);

  const handlePageChange = (page: Page) => setActivePage(page);
  const handleModeChange = (mode: AppState['searchMode']) => setState(s => ({...s, searchMode: mode}));
  const handleThemeChange = () => setState(s => ({ ...s, theme: s.theme === 'light' ? 'dark' : 'light' }));

  const handleAnalyze = useCallback(async () => {
    if (!state.patentText.trim()) return;
    setState(s => ({ 
      ...initialState, 
      theme: s.theme, // Preserve theme
      patentText: s.patentText, 
      userLocation: s.userLocation, 
      searchMode: 'analyze',
      isLoading: { ...initialState.isLoading, initial: true }, 
    }));
    setActivePage('dashboard');

    try {
      const [summary, similarPatents, geoInsights] = await Promise.all([
        geminiService.getInstantSummary(state.patentText),
        geminiService.findSimilarPatents(state.patentText),
        geminiService.getGeographicInsights(state.patentText, state.userLocation),
      ]);

      const initialChatHistory: ChatMessage[] = [
        { role: 'user', content: `Here is the patent I want to discuss:\n\n${state.patentText}` },
        { role: 'model', content: "Thank you. I have analyzed the patent. How can I help you further?" },
      ];

      const newChatInstance = geminiService.createChat(
        initialChatHistory.map(msg => ({ role: msg.role, parts: [{text: msg.content}] }))
      );

      setState(s => ({
        ...s,
        analysisResult: { summary: summary || undefined, similarPatents: similarPatents || undefined, geoInsights: geoInsights || undefined },
        chatHistory: initialChatHistory,
        chatInstance: newChatInstance,
        subjectClaims: s.patentText, // Pre-fill for claim mapping
      }));
    } catch (err) {
      console.error("Analysis failed:", err);
      setState(s => ({ ...s, error: "An error occurred during analysis. Please try again." }));
    } finally {
      setState(s => ({ ...s, isLoading: { ...s.isLoading, initial: false } }));
    }
  }, [state.patentText, state.userLocation]);
  
  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.searchQuery.trim()) return;

    setState(s => ({
      ...s,
      searchMode: 'search',
      searchResults: null,
      searchSources: null,
      searchError: null,
      error: null,
      isLoading: { ...s.isLoading, search: true },
    }));

    try {
        const searchData = await geminiService.searchPriorArt(state.searchQuery);
        setState(s => ({
            ...s,
            searchResults: searchData?.results || [],
            searchSources: searchData?.sources || [],
        }));
    } catch (err) {
        console.error("Search failed:", err);
        setState(s => ({
            ...s,
            searchError: "An error occurred during the search. Please try again.",
            searchResults: [],
        }));
    } finally {
        setState(s => ({
            ...s,
            isLoading: { ...s.isLoading, search: false },
        }));
    }
  }, [state.searchQuery]);

  const handleClaimMap = useCallback(async () => {
    if (!state.subjectClaims.trim() || !state.referenceClaims.trim()) return;
    setState(s => ({
        ...s,
        isLoading: { ...s.isLoading, claimMapping: true },
        claimMappingResult: null,
        claimMappingError: null,
    }));

    try {
        const mappingResult = await geminiService.performClaimMapping(state.subjectClaims, state.referenceClaims);
        if (mappingResult) {
            setState(s => ({...s, claimMappingResult: mappingResult}));
        } else {
            setState(s => ({...s, claimMappingError: "Failed to get a valid response from the analysis service."}));
        }
    } catch (err) {
        console.error("Claim mapping failed:", err);
        setState(s => ({...s, claimMappingError: "An error occurred during the claim mapping analysis."}));
    } finally {
        setState(s => ({...s, isLoading: { ...s.isLoading, claimMapping: false }}));
    }
  }, [state.subjectClaims, state.referenceClaims]);

  const handleGetDeepInsights = useCallback(async () => {
    if (!state.patentText) return;
    setState(s => ({ ...s, isLoading: { ...s.isLoading, deep: true } }));
    
    const insights = await geminiService.getDeepInsights(state.patentText);
    setState(s => ({
      ...s,
      analysisResult: { ...s.analysisResult, deepTrends: insights || "Could not generate deep insights." },
      isLoading: { ...s.isLoading, deep: false }
    }));
  }, [state.patentText]);
  
  const handleChatSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const userInput = e.currentTarget.message.value;
    if (!userInput.trim() || !state.chatInstance || state.isLoading.chat) return;

    e.currentTarget.reset();
    
    const updatedHistory: ChatMessage[] = [...state.chatHistory, { role: 'user', content: userInput }];
    setState(s => ({ ...s, chatHistory: updatedHistory, isLoading: { ...s.isLoading, chat: true } }));

    try {
        const response = await state.chatInstance.sendMessage({ message: userInput });
        const modelResponse = response.text;
        setState(s => ({
          ...s,
          chatHistory: [...updatedHistory, { role: 'model', content: modelResponse }],
        }));
    } catch(err){
        console.error("Chat error:", err);
        setState(s => ({
            ...s,
            chatHistory: [...updatedHistory, { role: 'model', content: "Sorry, I encountered an error. Please try again." }],
        }));
    } finally {
        setState(s => ({ ...s, isLoading: { ...s.isLoading, chat: false } }));
    }
  }

  const renderSources = (sources: GroundingSource[]) => (
    <div className="mt-4 pt-4 border-t border-slate-300 dark:border-white/10">
      <h4 className="text-sm font-semibold text-slate-500 dark:text-gray-400 mb-2">Sources:</h4>
      <ul className="list-disc list-inside space-y-1">
        {sources.map((source, index) => (
          <li key={index} className="text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300 truncate">
            <a href={source.uri} target="_blank" rel="noopener noreferrer" title={source.title}>{source.title || source.uri}</a>
          </li>
        ))}
      </ul>
    </div>
  );

  const renderAnalysisContent = () => {
    return (
        <div className="space-y-8">
            {state.analysisResult?.summary && (activePage === 'dashboard' || activePage === 'summary') && (
              <ResultCard title="Instant Summary" icon={<LightBulbIcon className="w-6 h-6 text-cyan-700 dark:text-cyan-300" />}>
                <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-slate-700 dark:text-gray-300">Problem:</h3>
                      <p className="text-slate-600 dark:text-gray-400">{state.analysisResult.summary.problem}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-700 dark:text-gray-300">Novelty:</h3>
                      <p className="text-slate-600 dark:text-gray-400">{state.analysisResult.summary.novelty}</p>
                     </div>
                     <div>
                      <h3 className="font-semibold text-slate-700 dark:text-gray-300">Solution:</h3>
                      <p className="text-slate-600 dark:text-gray-400">{state.analysisResult.summary.solution}</p>
                     </div>
                </div>
              </ResultCard>
            )}
            {state.analysisResult?.similarPatents && (activePage === 'dashboard' || activePage === 'similar') && (
              <ResultCard title="Similar Patents & Technologies" icon={<SearchIcon className="w-6 h-6 text-cyan-700 dark:text-cyan-300" />}>
                <ul className="space-y-4">
                  {state.analysisResult.similarPatents.patents.map((p, i) => (
                    <li key={i} className="p-4 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg">
                      <h4 className="font-semibold text-slate-800 dark:text-gray-200">{p.title}</h4>
                      <p className="text-slate-600 dark:text-gray-400 text-sm mt-1">{p.description}</p>
                    </li>
                  ))}
                </ul>
                {state.analysisResult.similarPatents.sources.length > 0 && renderSources(state.analysisResult.similarPatents.sources)}
              </ResultCard>
            )}
            {state.analysisResult?.geoInsights && (activePage === 'dashboard' || activePage === 'geo') && (
               <ResultCard title="Geographic Innovation Hotspots" icon={<GlobeIcon className="w-6 h-6 text-cyan-700 dark:text-cyan-300" />}>
                <GeoChart data={state.analysisResult.geoInsights.data} theme={state.theme} />
                {state.analysisResult.geoInsights.sources.length > 0 && renderSources(state.analysisResult.geoInsights.sources)}
              </ResultCard>
            )}
            {state.analysisResult && (activePage === 'dashboard' || activePage === 'trends') && (
              <ResultCard title="Deep Innovation Trends" icon={<BrainCircuitIcon className="w-6 h-6 text-cyan-700 dark:text-cyan-300" />}>
                {state.isLoading.deep && <LoadingSpinner />}
                {state.analysisResult.deepTrends && <div className="prose prose-sm prose-slate dark:prose-invert max-w-none prose-p:text-slate-600 dark:prose-p:text-gray-400 prose-headings:text-slate-800 dark:prose-headings:text-gray-200" dangerouslySetInnerHTML={{ __html: marked(state.analysisResult.deepTrends) }}></div>}
                {!state.analysisResult.deepTrends && !state.isLoading.deep && (
                  <div className="text-center">
                    <p className="text-slate-500 dark:text-gray-400 mb-4">Get a deeper analysis of innovation trends, market opportunities, and future developments.</p>
                    <button onClick={handleGetDeepInsights} className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg transition shadow-lg hover:shadow-teal-500/50">
                      Think More
                    </button>
                  </div>
                )}
              </ResultCard>
            )}
        </div>
    );
  }

  const Editor = ({ label, id, value, onChange, codeRef, isLoading }: {label: string, id: string, value: string, onChange: (v:string)=>void, codeRef: React.RefObject<HTMLElement>, isLoading: boolean}) => {
    const syncScroll = (codeRef: React.RefObject<HTMLElement>) => (e: React.UIEvent<HTMLTextAreaElement>) => {
      if (codeRef.current?.parentElement) {
          codeRef.current.parentElement.scrollTop = e.currentTarget.scrollTop;
          codeRef.current.parentElement.scrollLeft = e.currentTarget.scrollLeft;
      }
    };
    return (
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
            <code ref={codeRef} className="language-plaintext">
                {value + '\n'}
            </code>
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen transition-colors duration-500 ${state.theme === 'dark' ? 'gradient-bg' : 'bg-slate-100'}`}>
      <main className="container mx-auto p-4 md:p-8">
        <header className="text-center mb-8 md:mb-12 relative">
          <div className={`flex justify-center items-center gap-4 transition-all duration-700 ease-out ${isHeaderVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}>
             <BrainCircuitIcon className="w-12 h-12 text-cyan-500 dark:text-cyan-300"/>
             <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-600 to-blue-500 dark:from-cyan-300 dark:to-blue-400">
              IntelliPatent AI
            </h1>
          </div>
          <p className={`mt-2 text-lg text-slate-500 dark:text-gray-400 transition-all duration-700 ease-out delay-200 ${isHeaderVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}>Your AI-Powered Patent Analytics Assistant</p>
          <div className="absolute top-0 right-0">
            <ThemeSwitcher theme={state.theme} onThemeChange={handleThemeChange} />
          </div>
        </header>

        <div className="bg-white/60 dark:bg-black/20 backdrop-blur-xl border border-slate-300 dark:border-white/10 rounded-2xl shadow-xl dark:shadow-2xl overflow-hidden mb-8">
          <div className="flex border-b border-slate-300 dark:border-white/10">
            <button
              onClick={() => handleModeChange('analyze')}
              className={`flex-1 p-4 font-semibold transition-all duration-300 flex items-center justify-center gap-2 transform hover:-translate-y-px ${state.searchMode === 'analyze' ? 'bg-black/5 dark:bg-black/20 text-cyan-600 dark:text-cyan-300' : 'text-slate-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5'}`}
            >
                <LightBulbIcon className="w-5 h-5" />
                Analyze Patent
            </button>
            <button
              onClick={() => handleModeChange('search')}
              className={`flex-1 p-4 font-semibold transition-all duration-300 flex items-center justify-center gap-2 transform hover:-translate-y-px ${state.searchMode === 'search' ? 'bg-black/5 dark:bg-black/20 text-cyan-600 dark:text-cyan-300' : 'text-slate-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5'}`}
            >
                <DocumentSearchIcon className="w-5 h-5" />
                Prior Art Search
            </button>
             <button
              onClick={() => handleModeChange('claimMapping')}
              className={`flex-1 p-4 font-semibold transition-all duration-300 flex items-center justify-center gap-2 transform hover:-translate-y-px ${state.searchMode === 'claimMapping' ? 'bg-black/5 dark:bg-black/20 text-cyan-600 dark:text-cyan-300' : 'text-slate-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5'}`}
            >
                <ClaimMapIcon className="w-5 h-5" />
                Claim Mapping
            </button>
          </div>
          <div className="p-6">
            {state.searchMode === 'analyze' && (
              <>
                <textarea
                  value={state.patentText}
                  onChange={(e) => setState(s => ({ ...s, patentText: e.target.value }))}
                  placeholder={animatedPlaceholder.slice(0, -1) + (animatedPlaceholder.endsWith('|') ? '|' : '')}
                  className="w-full h-40 p-4 bg-slate-200/50 dark:bg-black/30 border border-slate-300 dark:border-white/20 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-shadow placeholder:text-slate-500 dark:placeholder:text-gray-500"
                  disabled={state.isLoading.initial}
                />
                <button
                  onClick={handleAnalyze}
                  disabled={state.isLoading.initial || !state.patentText}
                  className="mt-4 w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-500 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center shadow-lg hover:shadow-cyan-500/50 transform hover:scale-105 active:scale-100"
                >
                  {state.isLoading.initial ? 'Analyzing...' : 'Analyze Patent'}
                </button>
              </>
            )}
            {state.searchMode === 'search' && (
              <form onSubmit={handleSearch}>
                <p className="text-slate-500 dark:text-gray-400 mb-4 text-sm">
                  Perform a targeted search for prior art. Enter keywords or a specific patent ID.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      name="query"
                      value={state.searchQuery}
                      onChange={(e) => setState(s => ({...s, searchQuery: e.target.value}))}
                      placeholder="e.g., 'machine learning for image recognition' or 'US9634960B2'"
                      className="flex-grow bg-slate-200/50 dark:bg-black/30 border border-slate-300 dark:border-white/20 rounded-lg p-3 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-shadow placeholder:text-slate-500 dark:placeholder:text-gray-500"
                      disabled={state.isLoading.search}
                    />
                    <button
                      type="submit"
                      disabled={state.isLoading.search || !state.searchQuery}
                      className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-500 dark:disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-cyan-500/50 transform hover:scale-105 active:scale-100"
                    >
                      {state.isLoading.search ? 'Searching...' : 'Search'}
                    </button>
                </div>
              </form>
            )}
             {state.searchMode === 'claimMapping' && (
              <div className="space-y-6">
                <p className="text-sm text-slate-500 dark:text-gray-400">
                  Compare your patent claims against a reference patent. The subject claims are pre-filled after an initial analysis.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Editor
                    label="Subject Patent Claims"
                    id="subject-patent"
                    value={state.subjectClaims}
                    onChange={(v) => setState(s => ({...s, subjectClaims: v}))}
                    codeRef={subjectCodeRef}
                    isLoading={state.isLoading.claimMapping}
                  />
                  <Editor
                    label="Reference Patent (Prior Art)"
                    id="reference-patent"
                    value={state.referenceClaims}
                    onChange={(v) => setState(s => ({...s, referenceClaims: v}))}
                    codeRef={referenceCodeRef}
                    isLoading={state.isLoading.claimMapping}
                  />
                </div>
                <button
                  onClick={handleClaimMap}
                  disabled={state.isLoading.claimMapping || !state.subjectClaims.trim() || !state.referenceClaims.trim()}
                  className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-400 dark:disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center shadow-lg hover:shadow-teal-500/50 transform hover:scale-105 active:scale-100"
                >
                  {state.isLoading.claimMapping ? 'Analyzing...' : 'Map Claims & Analyze'}
                </button>
              </div>
            )}
          </div>
        </div>

        {state.error && <div className="bg-red-500/20 border border-red-500 text-red-400 dark:text-red-300 p-4 rounded-lg mb-8">{state.error}</div>}

        {state.isLoading.search && state.searchMode === 'search' && (
          <ResultCard title="Searching for Prior Art..." icon={<DocumentSearchIcon className="w-6 h-6 text-cyan-700 dark:text-cyan-300" />}>
            <LoadingSpinner />
          </ResultCard>
        )}

        {state.searchResults && !state.isLoading.search && state.searchMode === 'search' && (
          <ResultCard title="Prior Art Search Results" icon={<DocumentSearchIcon className="w-6 h-6 text-cyan-700 dark:text-cyan-300" />}>
            {state.searchError ? (
                <div className="text-center text-red-600 dark:text-red-400 p-8 border-2 border-dashed border-red-500/50 rounded-lg bg-red-500/10 dark:bg-red-900/20">
                    <p className="font-semibold">Search Failed</p>
                    <p className="text-sm">{state.searchError}</p>
                </div>
            ) : state.searchResults.length > 0 ? (
              <div className="space-y-4">
                <ul className="space-y-4">
                  {state.searchResults.map((result, i) => (
                    <li key={i} className="p-4 bg-slate-100 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10">
                      {result.type === 'patent_details' ? (
                        <div className="space-y-2">
                          <h4 className="font-semibold text-lg text-slate-800 dark:text-gray-200">{result.title}</h4>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 dark:text-gray-400">
                            <span><strong>Patent ID:</strong> {result.patentId}</span>
                            <span><strong>Filing Date:</strong> {result.filingDate}</span>
                          </div>
                          <p className="text-slate-700 dark:text-gray-300 pt-2"><strong>Abstract</strong></p>
                          <p className="text-slate-600 dark:text-gray-400 text-sm">{result.abstract}</p>
                        </div>
                      ) : (
                        <div>
                          <h4 className="font-semibold text-slate-800 dark:text-gray-200">{result.title}</h4>
                          <p className="text-slate-600 dark:text-gray-400 text-sm">{result.description}</p>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                {state.searchSources && state.searchSources.length > 0 && renderSources(state.searchSources)}
              </div>
            ) : (
                <div className="text-center text-slate-500 dark:text-gray-500 p-8 border-2 border-dashed border-slate-300 dark:border-white/20 rounded-lg">
                    <p>No results found for your query.</p>
                </div>
            )}
          </ResultCard>
        )}

        {state.isLoading.claimMapping && state.searchMode === 'claimMapping' && (
             <ResultCard title="Analyzing Claim Mappings..." icon={<ClaimMapIcon className="w-6 h-6 text-cyan-700 dark:text-cyan-300" />}><LoadingSpinner /></ResultCard>
        )}

        {(state.claimMappingResult || state.claimMappingError) && !state.isLoading.claimMapping && state.searchMode === 'claimMapping' && (
           <ResultCard title="Claim Analysis Results" icon={<ClaimMapIcon className="w-6 h-6 text-cyan-700 dark:text-cyan-300" />}>
             {state.claimMappingError ? (
                <div className="text-center text-red-600 dark:text-red-400 p-4 border border-red-500/50 rounded-lg bg-red-500/10 dark:bg-red-900/20">{state.claimMappingError}</div>
             ) : state.claimMappingResult && (
                <div className="space-y-4">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-gray-200">Analysis Result</h3>
                        <span className="inline-block bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 text-sm font-semibold px-3 py-1 rounded-full mt-1">
                            {state.claimMappingResult.category}
                        </span>
                    </div>
                    <div>
                        <h4 className="font-semibold text-slate-700 dark:text-gray-300">Rationale:</h4>
                        <div className="text-slate-600 dark:text-gray-400 prose prose-sm prose-slate dark:prose-invert max-w-none">{state.claimMappingResult.rationale}</div>
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
                                    {state.claimMappingResult.mappings.map((mapping, index) => (
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
            </ResultCard>
        )}


        {state.isLoading.initial && (
          <div className="space-y-8">
            <SkeletonLoader className="h-48 w-full" />
            <SkeletonLoader className="h-64 w-full" />
            <SkeletonLoader className="h-56 w-full" />
          </div>
        )}

        {state.analysisResult && !state.isLoading.initial && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="hidden lg:block lg:col-span-2">
              <Sidebar activePage={activePage} onPageChange={handlePageChange} />
            </div>

            <div className="lg:col-span-7">
               {renderAnalysisContent()}
            </div>
            
            <div className="lg:col-span-3">
              <ResultCard title="Chat Assistant" icon={<ChatBubbleIcon className="w-6 h-6 text-cyan-700 dark:text-cyan-300" />} className="sticky top-8">
                 <div className="h-[60vh] flex flex-col">
                    <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                        {state.chatHistory.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-xs md:max-w-md lg:max-w-xs xl:max-w-md p-3 rounded-xl ${msg.role === 'user' ? 'bg-gradient-to-br from-blue-600 to-cyan-600 text-white' : 'bg-slate-200 dark:bg-black/30 border border-slate-300 dark:border-white/10 text-slate-800 dark:text-gray-200'}`}>
                                    <div className="text-sm prose prose-sm prose-slate dark:prose-invert max-w-none prose-p:text-slate-700 dark:prose-p:text-gray-300" dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) as string }}></div>
                                </div>
                            </div>
                        ))}
                        {state.isLoading.chat && <div className="flex justify-start"><div className="p-3 rounded-xl bg-slate-200 dark:bg-black/30"><LoadingSpinner/></div></div>}
                        <div ref={chatMessagesEndRef} />
                    </div>
                    <form onSubmit={handleChatSubmit} className="mt-4 flex gap-2">
                        <input name="message" type="text" placeholder="Ask a follow-up..." className="flex-grow bg-slate-200/50 dark:bg-black/30 border border-slate-300 dark:border-white/20 rounded-lg p-2 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-shadow" />
                        <button type="submit" disabled={state.isLoading.chat} className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-500 dark:disabled:bg-gray-600 text-white font-bold p-2 rounded-lg transition px-4 shadow-lg hover:shadow-cyan-500/50">Send</button>
                    </form>
                 </div>
              </ResultCard>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
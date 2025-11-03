import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AppState, ChatMessage, GroundingSource, PriorArtSearchResult } from './types';
import * as geminiService from './services/geminiService';
import ResultCard from './components/ResultCard';
import GeoChart from './components/GeoChart';
import LoadingSpinner, { SkeletonLoader } from './components/LoadingSpinner';
import { BrainCircuitIcon, LightBulbIcon, SearchIcon, GlobeIcon, ChatBubbleIcon, DocumentSearchIcon } from './components/icons';
import { marked } from 'marked';
import Sidebar, { Page } from './components/Sidebar';
import ClaimMapping from './components/ClaimMapping';

const initialState: AppState = {
  patentText: '',
  analysisResult: null,
  isLoading: { initial: false, deep: false, chat: false, search: false },
  error: null,
  chatHistory: [],
  chatInstance: null,
  userLocation: null,
  searchMode: 'analyze',
  searchQuery: '',
  searchResults: null,
  searchSources: null,
  searchError: null,
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
  const [state, setState] = useState<AppState>(initialState);
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  
  // State for interactivity
  const [isHeaderVisible, setIsHeaderVisible] = useState(false);
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState('');

  // Refs for placeholder animation
  const placeholderIndex = useRef(0);
  const charIndex = useRef(0);
  const isDeleting = useRef(false);
  
  useEffect(() => {
    // Header animation
    const headerTimer = setTimeout(() => setIsHeaderVisible(true), 100);

    // Get location
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
      (error) => {
        console.warn("Could not get user location.", error);
      }
    );
    
    return () => clearTimeout(headerTimer);
  }, []);
  
  // Effect for animated placeholder
  useEffect(() => {
    // FIX: `setTimeout` in the browser returns a `number`, not `NodeJS.Timeout`.
    let timeoutId: number;
    const handleTyping = () => {
        const currentPlaceholder = placeholders[placeholderIndex.current];
        
        // Determine the next text state
        if (!isDeleting.current) { // Typing
            if (charIndex.current < currentPlaceholder.length) {
                charIndex.current++;
            } else { // Finished typing
                isDeleting.current = true;
            }
        } else { // Deleting
            if (charIndex.current > 0) {
                charIndex.current--;
            } else { // Finished deleting
                isDeleting.current = false;
                placeholderIndex.current = (placeholderIndex.current + 1) % placeholders.length;
            }
        }

        const newText = currentPlaceholder.substring(0, charIndex.current);
        setAnimatedPlaceholder(newText + '|');

        // Determine next timeout duration
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

  const handlePageChange = (page: Page) => {
    setActivePage(page);
  }

  const handleModeChange = (mode: AppState['searchMode']) => {
    setState(s => ({...s, searchMode: mode}));
  }

  const handleAnalyze = useCallback(async () => {
    if (!state.patentText.trim()) return;
    setState(s => ({ 
      ...initialState, 
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

    // Reset search-specific state without clearing the whole app
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
            searchResults: [], // Set to empty array to ensure the result card renders with the error
        }));
    } finally {
        setState(s => ({
            ...s,
            isLoading: { ...s.isLoading, search: false },
        }));
    }
  }, [state.searchQuery]);


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
    <div className="mt-4 pt-4 border-t border-white/10">
      <h4 className="text-sm font-semibold text-gray-400 mb-2">Sources:</h4>
      <ul className="list-disc list-inside space-y-1">
        {sources.map((source, index) => (
          <li key={index} className="text-sm text-cyan-400 hover:text-cyan-300 truncate">
            <a href={source.uri} target="_blank" rel="noopener noreferrer" title={source.title}>{source.title || source.uri}</a>
          </li>
        ))}
      </ul>
    </div>
  );

  const renderAnalysisContent = () => {
    if (activePage === 'claimAnalysis') {
        return <ClaimMapping subjectPatentText={state.patentText} />;
    }
    return (
        <div className="space-y-8">
            {state.analysisResult?.summary && (activePage === 'dashboard' || activePage === 'summary') && (
              <ResultCard title="Instant Summary" icon={<LightBulbIcon className="w-6 h-6 text-cyan-300" />}>
                <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-gray-300">Problem:</h3>
                      <p className="text-gray-400">{state.analysisResult.summary.problem}</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-300">Novelty:</h3>
                      <p className="text-gray-400">{state.analysisResult.summary.novelty}</p>
                     </div>
                     <div>
                      <h3 className="font-semibold text-gray-300">Solution:</h3>
                      <p className="text-gray-400">{state.analysisResult.summary.solution}</p>
                     </div>
                </div>
              </ResultCard>
            )}
            {state.analysisResult?.similarPatents && (activePage === 'dashboard' || activePage === 'similar') && (
              <ResultCard title="Similar Patents & Technologies" icon={<SearchIcon className="w-6 h-6 text-cyan-300" />}>
                <ul className="space-y-4">
                  {state.analysisResult.similarPatents.patents.map((p, i) => (
                    <li key={i} className="p-4 bg-white/5 border border-white/10 rounded-lg">
                      <h4 className="font-semibold text-gray-200">{p.title}</h4>
                      <p className="text-gray-400 text-sm mt-1">{p.description}</p>
                    </li>
                  ))}
                </ul>
                {state.analysisResult.similarPatents.sources.length > 0 && renderSources(state.analysisResult.similarPatents.sources)}
              </ResultCard>
            )}
            {state.analysisResult?.geoInsights && (activePage === 'dashboard' || activePage === 'geo') && (
               <ResultCard title="Geographic Innovation Hotspots" icon={<GlobeIcon className="w-6 h-6 text-cyan-300" />}>
                <GeoChart data={state.analysisResult.geoInsights.data} />
                {state.analysisResult.geoInsights.sources.length > 0 && renderSources(state.analysisResult.geoInsights.sources)}
              </ResultCard>
            )}
            {state.analysisResult && (activePage === 'dashboard' || activePage === 'trends') && (
              <ResultCard title="Deep Innovation Trends" icon={<BrainCircuitIcon className="w-6 h-6 text-cyan-300" />}>
                {state.isLoading.deep && <LoadingSpinner />}
                {state.analysisResult.deepTrends && <div className="prose prose-sm prose-invert max-w-none prose-p:text-gray-400 prose-headings:text-gray-200" dangerouslySetInnerHTML={{ __html: marked(state.analysisResult.deepTrends) }}></div>}
                {!state.analysisResult.deepTrends && !state.isLoading.deep && (
                  <div className="text-center">
                    <p className="text-gray-400 mb-4">Get a deeper analysis of innovation trends, market opportunities, and future developments.</p>
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

  return (
    <div className="min-h-screen gradient-bg text-gray-200">
      <main className="container mx-auto p-4 md:p-8">
        <header className="text-center mb-8 md:mb-12">
          <div className={`flex justify-center items-center gap-4 transition-all duration-700 ease-out ${isHeaderVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}>
             <BrainCircuitIcon className="w-12 h-12 text-cyan-300"/>
             <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 to-blue-400">
              IntelliPatent AI
            </h1>
          </div>
          <p className={`mt-2 text-lg text-gray-400 transition-all duration-700 ease-out delay-200 ${isHeaderVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}>Your AI-Powered Patent Analytics Assistant</p>
        </header>

        <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden mb-8">
          <div className="flex border-b border-white/10">
            <button
              onClick={() => handleModeChange('analyze')}
              className={`flex-1 p-4 font-semibold transition-all duration-300 flex items-center justify-center gap-2 transform hover:-translate-y-1 ${state.searchMode === 'analyze' ? 'bg-black/20 text-cyan-300' : 'text-gray-400 hover:bg-white/5'}`}
            >
                <LightBulbIcon className="w-5 h-5" />
                Analyze Patent
            </button>
            <button
              onClick={() => handleModeChange('search')}
              className={`flex-1 p-4 font-semibold transition-all duration-300 flex items-center justify-center gap-2 transform hover:-translate-y-1 ${state.searchMode === 'search' ? 'bg-black/20 text-cyan-300' : 'text-gray-400 hover:bg-white/5'}`}
            >
                <DocumentSearchIcon className="w-5 h-5" />
                Prior Art Search
            </button>
          </div>
          <div className="p-6">
            {state.searchMode === 'analyze' && (
              <>
                <textarea
                  value={state.patentText}
                  onChange={(e) => setState(s => ({ ...s, patentText: e.target.value }))}
                  placeholder={animatedPlaceholder.slice(0, -1) + (animatedPlaceholder.endsWith('|') ? '|' : '')}
                  className="w-full h-40 p-4 bg-black/30 border border-white/20 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-shadow"
                  disabled={state.isLoading.initial}
                />
                <button
                  onClick={handleAnalyze}
                  disabled={state.isLoading.initial || !state.patentText}
                  className="mt-4 w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center shadow-lg hover:shadow-cyan-500/50 transform hover:scale-105 active:scale-100"
                >
                  {state.isLoading.initial ? 'Analyzing...' : 'Analyze Patent'}
                </button>
              </>
            )}
            {state.searchMode === 'search' && (
              <form onSubmit={handleSearch}>
                <p className="text-gray-400 mb-4 text-sm">
                  Perform a targeted search for prior art. Enter keywords or a specific patent ID.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      name="query"
                      value={state.searchQuery}
                      onChange={(e) => setState(s => ({...s, searchQuery: e.target.value}))}
                      placeholder="e.g., 'machine learning for image recognition' or 'US9634960B2'"
                      className="flex-grow bg-black/30 border border-white/20 rounded-lg p-3 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-shadow"
                      disabled={state.isLoading.search}
                    />
                    <button
                      type="submit"
                      disabled={state.isLoading.search || !state.searchQuery}
                      className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 shadow-lg hover:shadow-cyan-500/50 transform hover:scale-105 active:scale-100"
                    >
                      {state.isLoading.search ? 'Searching...' : 'Search'}
                    </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {state.error && <div className="bg-red-500/20 border border-red-500 text-red-300 p-4 rounded-lg mb-8">{state.error}</div>}

        {state.isLoading.search && (
          <ResultCard title="Searching for Prior Art..." icon={<DocumentSearchIcon className="w-6 h-6 text-cyan-300" />}>
            <LoadingSpinner />
          </ResultCard>
        )}

        {state.searchResults && !state.isLoading.search && (
          <ResultCard title="Prior Art Search Results" icon={<DocumentSearchIcon className="w-6 h-6 text-cyan-300" />}>
            {state.searchError ? (
                <div className="text-center text-red-400 p-8 border-2 border-dashed border-red-500/50 rounded-lg bg-red-900/20">
                    <p className="font-semibold">Search Failed</p>
                    <p className="text-sm">{state.searchError}</p>
                </div>
            ) : state.searchResults.length > 0 ? (
              <div className="space-y-4">
                <ul className="space-y-4">
                  {state.searchResults.map((result, i) => (
                    <li key={i} className="p-4 bg-white/5 rounded-lg border border-white/10">
                      {result.type === 'patent_details' ? (
                        <div className="space-y-2">
                          <h4 className="font-semibold text-lg text-gray-200">{result.title}</h4>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
                            <span><strong>Patent ID:</strong> {result.patentId}</span>
                            <span><strong>Filing Date:</strong> {result.filingDate}</span>
                          </div>
                          <p className="text-gray-300 pt-2"><strong>Abstract</strong></p>
                          <p className="text-gray-400 text-sm">{result.abstract}</p>
                        </div>
                      ) : ( // prior_art_document
                        <div>
                          <h4 className="font-semibold text-gray-200">{result.title}</h4>
                          <p className="text-gray-400 text-sm">{result.description}</p>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                {state.searchSources && state.searchSources.length > 0 && renderSources(state.searchSources)}
              </div>
            ) : (
                <div className="text-center text-gray-500 p-8 border-2 border-dashed border-white/20 rounded-lg">
                    <p>No results found for your query.</p>
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
              <ResultCard title="Chat Assistant" icon={<ChatBubbleIcon className="w-6 h-6 text-cyan-300" />} className="sticky top-8">
                 <div className="h-[60vh] flex flex-col">
                    <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                        {state.chatHistory.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-xs md:max-w-md lg:max-w-xs xl:max-w-md p-3 rounded-xl ${msg.role === 'user' ? 'bg-gradient-to-br from-blue-600 to-cyan-600 text-white' : 'bg-black/30 border border-white/10 text-gray-200'}`}>
                                    <div className="text-sm prose prose-sm prose-invert max-w-none prose-p:text-gray-300" dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) as string }}></div>
                                </div>
                            </div>
                        ))}
                        {state.isLoading.chat && <div className="flex justify-start"><div className="p-3 rounded-xl bg-black/30"><LoadingSpinner/></div></div>}
                        <div ref={chatMessagesEndRef} />
                    </div>
                    <form onSubmit={handleChatSubmit} className="mt-4 flex gap-2">
                        <input name="message" type="text" placeholder="Ask a follow-up..." className="flex-grow bg-black/30 border border-white/20 rounded-lg p-2 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-shadow" />
                        <button type="submit" disabled={state.isLoading.chat} className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 text-white font-bold p-2 rounded-lg transition px-4 shadow-lg hover:shadow-cyan-500/50">Send</button>
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
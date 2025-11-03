import { Chat } from '@google/genai';

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface Summary {
  problem: string;
  novelty: string;
  solution: string;
}

export interface SimilarPatent {
  title: string;
  description: string;
}

export interface GeoDataPoint {
  country: string;
  score: number;
}

export interface AnalysisResult {
  summary?: Summary;
  similarPatents?: {
    patents: SimilarPatent[];
    sources: GroundingSource[];
  };
  geoInsights?: {
    data: GeoDataPoint[];
    sources: GroundingSource[];
  };
  deepTrends?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface ClaimMapping {
    subjectClaim: string;
    referenceDisclosure: string;
    description: string;
}

export interface ClaimMappingResult {
    category: string;
    rationale: string;
    mappings: ClaimMapping[];
}

export interface PatentDetails {
  type: 'patent_details';
  patentId: string;
  title: string;
  abstract: string;
  filingDate: string;
}

export interface PriorArtDocument {
  type: 'prior_art_document';
  title: string;
  description: string;
}

export type PriorArtSearchResult = PatentDetails | PriorArtDocument;


export interface AppState {
  patentText: string;
  analysisResult: AnalysisResult | null;
  isLoading: {
    initial: boolean;
    deep: boolean;
    chat: boolean;
    search: boolean;
  };
  error: string | null;
  chatHistory: ChatMessage[];
  chatInstance: Chat | null;
  userLocation: { latitude: number; longitude: number } | null;
  searchMode: 'analyze' | 'search';
  searchQuery: string;
  searchResults: PriorArtSearchResult[] | null;
  searchSources: GroundingSource[] | null;
  searchError: string | null;
}
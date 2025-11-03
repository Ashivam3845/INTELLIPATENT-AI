import { GoogleGenAI, Type, GenerateContentResponse, Chat } from '@google/genai';
import { Summary, SimilarPatent, GeoDataPoint, GroundingSource, ClaimMappingResult, PriorArtSearchResult } from '../types';

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// Utility to parse JSON from a string, handling potential markdown fences
const parseJsonFromText = <T,>(text: string): T | null => {
  try {
    const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonString) as T;
  } catch (e) {
    console.error("Failed to parse JSON from text:", e);
    return null;
  }
};

export const getInstantSummary = async (text: string): Promise<Summary | null> => {
  try {
    const response = await ai.models.generateContent({
      // FIX: Corrected model name as per guidelines.
      model: 'gemini-flash-lite-latest',
      contents: `Summarize the following patent description. Focus on the core problem, the novelty of the invention, and the proposed solution. Respond in JSON format.
      Patent: "${text}"`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            problem: { type: Type.STRING, description: "The problem the invention solves." },
            novelty: { type: Type.STRING, description: "The key novelty of the invention." },
            solution: { type: Type.STRING, description: "The proposed solution." },
          },
          required: ['problem', 'novelty', 'solution'],
        },
      },
    });
    return parseJsonFromText<Summary>(response.text);
  } catch (error) {
    console.error("Error in getInstantSummary:", error);
    return null;
  }
};

export const findSimilarPatents = async (text: string): Promise<{ patents: SimilarPatent[], sources: GroundingSource[] } | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Based on the following patent description, find and list up to 5 similar existing patents, prior art, or related technologies. For each, provide a title and a brief description. Respond ONLY with a valid JSON array of objects, where each object has "title" and "description" keys.
      Patent: "${text}"`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const patents = parseJsonFromText<SimilarPatent[]>(response.text) || [];
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map(chunk => ({ uri: chunk.web?.uri || '', title: chunk.web?.title || '' }))
      .filter(source => source.uri) || [];
      
    return { patents, sources };
  } catch (error) {
    console.error("Error in findSimilarPatents:", error);
    return null;
  }
};

export const getGeographicInsights = async (text: string, location: { latitude: number; longitude: number } | null): Promise<{ data: GeoDataPoint[], sources: GroundingSource[] } | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analyze the following invention description and identify the top 5 countries or regions leading innovation in this technological domain. For each, provide a relative innovation score from 1 to 100. Respond ONLY with a valid JSON array of objects, where each object has "country" and "score" keys.
      Invention: "${text}"`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: location ? {
          retrievalConfig: {
            latLng: location
          }
        } : undefined,
      },
    });
    
    const data = parseJsonFromText<GeoDataPoint[]>(response.text) || [];
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map(chunk => ({ uri: chunk.maps?.uri || '', title: chunk.maps?.title || '' }))
      .filter(source => source.uri) || [];

    return { data, sources };
  } catch (error) {
    console.error("Error in getGeographicInsights:", error);
    return null;
  }
};

export const getDeepInsights = async (text: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: `Provide a deep analysis of innovation trends related to the following invention. Compare it with existing technologies, identify potential future developments, and discuss market opportunities. Format your response in clear markdown.
      Invention: "${text}"`,
      config: {
        thinkingConfig: { thinkingBudget: 32768 },
      },
    });
    return response.text;
  } catch (error) {
    console.error("Error in getDeepInsights:", error);
    return null;
  }
};

export const createChat = (history: { role: 'user' | 'model'; parts: { text: string }[] }[]) => {
    return ai.chats.create({
        model: 'gemini-2.5-flash',
        history: history,
    });
}

export const performClaimMapping = async (subjectPatent: string, referencePatent: string): Promise<ClaimMappingResult | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: `You are an expert patent analyst. Perform a claim mapping analysis between a subject patent and a reference patent (prior art).
1. Analyze: Read the claims of the subject patent and the disclosure of the reference patent.
2. Map: For each claim in the subject patent, identify if its elements are disclosed in the reference patent.
3. Categorize: Determine the reference's relevance (e.g., 'Anticipation (§ 102)', 'Obviousness (§ 103)', 'Supporting Reference').
4. Rationale: Provide a detailed explanation for your categorization.
5. JSON Output: Respond ONLY with a valid JSON object.

Subject Patent Claims:
---
${subjectPatent}
---

Reference Patent Disclosure:
---
${referencePatent}
---`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING, description: "e.g., 'Anticipation (§ 102)', 'Obviousness (§ 103)'" },
            rationale: { type: Type.STRING, description: "Detailed explanation for the category." },
            mappings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  subjectClaim: { type: Type.STRING, description: "e.g., 'Claim 1'" },
                  referenceDisclosure: { type: Type.STRING, description: "e.g., 'Figure 3 and para [0045]'" },
                  description: { type: Type.STRING, description: "Explanation of the mapping for this claim." },
                },
                required: ['subjectClaim', 'referenceDisclosure', 'description'],
              },
            },
          },
          required: ['category', 'rationale', 'mappings'],
        },
      },
    });
    return parseJsonFromText<ClaimMappingResult>(response.text);
  } catch (error) {
    console.error("Error in performClaimMapping:", error);
    return null;
  }
};

export const searchPriorArt = async (query: string): Promise<{ results: PriorArtSearchResult[], sources: GroundingSource[] } | null> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are a patent search assistant. The user has provided a search query.
- If the query looks like a patent ID (e.g., "US9634960B2", "EP1234567A1"), use Google Search to find that specific patent. Return an array with a single object containing the patent's "patentId", "title", "abstract", and "filingDate".
- If the query is a general keyword search (e.g., "machine learning for image recognition"), find up to 3 relevant prior art documents. For each, return an object with its "title" and a "description".
- Respond ONLY with a valid JSON array.

Query: "${query}"`,
      // FIX: `responseMimeType` and `responseSchema` are not allowed when using the `googleSearch` tool.
      // The model will be guided by the prompt to return JSON, which is then parsed.
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    const results = parseJsonFromText<any[]>(response.text) || [];
    
    // Post-process to fit the typed structure
    const typedResults: PriorArtSearchResult[] = results.map(item => {
      if (item.patentId && item.abstract && item.filingDate) {
        return {
          type: 'patent_details',
          patentId: item.patentId,
          title: item.title,
          abstract: item.abstract,
          filingDate: item.filingDate,
        };
      } else {
        return {
          type: 'prior_art_document',
          title: item.title,
          description: item.description || '',
        };
      }
    });

    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map(chunk => ({ uri: chunk.web?.uri || '', title: chunk.web?.title || '' }))
      .filter(source => source.uri) || [];
      
    return { results: typedResults, sources };

  } catch (error) {
    console.error("Error in searchPriorArt:", error);
    return null;
  }
};
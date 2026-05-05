/**
 * Web Search Service using Tavily API
 * Provides web search capabilities for grounding learning content in current information
 * @module services/webSearch
 */

import { logger } from './logger.js';

const TAVILY_API_URL = 'https://api.tavily.com/search';

/**
 * Search the web using Tavily API
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @param {number} options.maxResults - Maximum number of results (default: 5)
 * @param {string} options.searchDepth - 'basic' or 'advanced' (default: 'basic')
 * @param {boolean} options.includeAnswer - Include AI-generated answer (default: true)
 * @param {boolean} options.includeRawContent - Include raw page content (default: false)
 * @param {string[]} options.includeDomains - Only include these domains
 * @param {string[]} options.excludeDomains - Exclude these domains
 * @returns {Promise<Object>} Search results with answer and sources
 */
export async function searchWeb(query, options = {}) {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    logger.warn('TAVILY_API_KEY not configured, web search disabled');
    return {
      success: false,
      error: 'Web search not configured',
      results: [],
      answer: null,
    };
  }

  const {
    maxResults = 5,
    searchDepth = 'basic',
    includeAnswer = true,
    includeRawContent = false,
    includeDomains = [],
    excludeDomains = [],
  } = options;

  try {
    logger.info({ query: query.slice(0, 50) }, 'Performing web search');

    const response = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: searchDepth,
        include_answer: includeAnswer,
        include_raw_content: includeRawContent,
        max_results: maxResults,
        include_domains: includeDomains.length > 0 ? includeDomains : undefined,
        exclude_domains: excludeDomains.length > 0 ? excludeDomains : undefined,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, error: errorText }, 'Tavily API error');
      throw new Error(`Tavily API error: ${response.status}`);
    }

    const data = await response.json();

    logger.info({
      query: query.slice(0, 50),
      resultCount: data.results?.length || 0,
      hasAnswer: !!data.answer,
    }, 'Web search completed');

    return {
      success: true,
      query: data.query,
      answer: data.answer || null,
      results: (data.results || []).map(result => ({
        title: result.title,
        url: result.url,
        content: result.content,
        score: result.score,
        publishedDate: result.published_date,
      })),
      responseTime: data.response_time,
    };
  } catch (error) {
    logger.error({ error: error.message, query: query.slice(0, 50) }, 'Web search failed');
    return {
      success: false,
      error: error.message,
      results: [],
      answer: null,
    };
  }
}

/**
 * Format web search results for use as context in prompts
 * @param {Object} searchResult - Result from searchWeb()
 * @returns {string} Formatted context string
 */
export function formatSearchResultsForContext(searchResult) {
  if (!searchResult.success || searchResult.results.length === 0) {
    return null;
  }

  let context = '';

  // Add Tavily's AI-generated answer if available
  if (searchResult.answer) {
    context += `=== WEB SEARCH SUMMARY ===\n${searchResult.answer}\n\n`;
  }

  // Add individual source results
  context += '=== WEB SOURCES ===\n';
  searchResult.results.forEach((result, idx) => {
    context += `\n[Source ${idx + 1}] ${result.title}\n`;
    context += `URL: ${result.url}\n`;
    if (result.publishedDate) {
      context += `Published: ${result.publishedDate}\n`;
    }
    context += `Content: ${result.content}\n`;
    context += '---\n';
  });

  return context;
}

/**
 * Search for educational content on a topic
 * Optimized for learning content generation
 * @param {string} topic - Topic to search for
 * @returns {Promise<Object>} Search results formatted for educational use
 */
export async function searchForLearning(topic) {
  // Enhance query for educational content
  const educationalQuery = `${topic} explanation tutorial guide`;

  const result = await searchWeb(educationalQuery, {
    maxResults: 6,
    searchDepth: 'basic',
    includeAnswer: true,
    excludeDomains: [
      'pinterest.com',
      'facebook.com',
      'twitter.com',
      'instagram.com',
    ],
  });

  return {
    ...result,
    formattedContext: formatSearchResultsForContext(result),
  };
}

export default {
  searchWeb,
  formatSearchResultsForContext,
  searchForLearning,
};

/**
 * Fact Checker Agent (RAG + LLM Judge Pipeline)
 * Two-stage fact-checking: Claim extraction + LLM verification
 *
 * Pipeline:
 * 1. Extract claims from answer using the configured chat model
 * 2. Retrieve evidence from provided chunks or pgvector
 * 3. LLM judge evaluates each claim against evidence
 * 4. Aggregate results with confidence scoring
 *
 * Input: { answer: string, retrievedChunks: string[], query: string }
 * Output: { confidence, supportedClaims, unsupportedClaims, sources, method }
 */

import { BaseAgent } from './base-agent.js';
import { logger } from '../utils/logger.js';
import { supabase } from '../database/client.js';
import crypto from 'crypto';
import { createTextCompletion } from '../services/openai/azure-client.js';

// Timeouts
const PIPELINE_TIMEOUT_MS = 8000;
const CACHE_TTL_HOURS = 24;

export class FactCheckerAgent extends BaseAgent {
  /**
   * Retry configuration for FactCheckerAgent
   * Minimal retries - fact checking is supplementary and has its own fallback
   */
  static retryConfig = { maxRetries: 1 };

  constructor() {
    super('fact-checker', 'RAG + LLM Judge fact-checking pipeline', '3.0.0');
  }

  /**
   * Execute fact-checking pipeline
   * @param {Object} input - { answer, retrievedChunks, query }
   * @param {Object} context - Optional context with userId
   * @returns {Object} Fact check result
   */
  async execute(input, context = {}) {
    const answer = input.answer || input.text || '';
    const retrievedChunks = input.retrievedChunks || [];
    const query = input.query || '';

    if (!answer || answer.trim().length === 0) {
      throw new Error('Answer text is required');
    }

    logger.info('Fact Checker: Starting RAG + LLM Judge pipeline', {
      answerLength: answer.length,
      chunksCount: retrievedChunks.length,
    });

    // Check cache first
    const cacheKey = this._generateCacheKey(query, answer);
    const cached = await this._checkCache(cacheKey);
    if (cached) {
      logger.info('Fact Checker: Returning cached result');
      return { ...cached, method: 'cached' };
    }

    // Run pipeline with timeout
    try {
      const result = await Promise.race([
        this._runPipeline(answer, retrievedChunks, query),
        this._timeout(PIPELINE_TIMEOUT_MS),
      ]);

      // Cache the result
      await this._cacheResult(cacheKey, result);

      return result;
    } catch (error) {
      logger.warn('Fact Checker: Pipeline failed, using fallback', { error: error.message });
      return this._jaccardFallback(answer, retrievedChunks, query);
    }
  }

  /**
   * Main fact-checking pipeline
   */
  async _runPipeline(answer, retrievedChunks, query) {
    // STAGE 1: Extract claims using the configured chat model
    const claims = await this._extractClaims(answer);

    if (claims.length === 0) {
      return {
        confidence: 0.5,
        totalClaims: 0,
        supportedClaims: [],
        unsupportedClaims: [],
        sources: [],
        summary: 'No verifiable claims found',
        needs_clarification: false,
        method: 'llm_judge',
        validatedAt: new Date().toISOString(),
      };
    }

    // STAGE 2: Retrieve evidence (use provided chunks or fallback)
    const evidence = retrievedChunks.length > 0
      ? retrievedChunks
      : await this._retrieveEvidence(claims, query);

    // STAGE 3: LLM Judge evaluates all claims
    const verdicts = await this._judgeClaimsWithLLM(claims, evidence);

    // STAGE 4: Aggregate results
    return this._aggregateResults(verdicts, evidence);
  }

  /**
   * STAGE 1: Extract claims from answer using the configured chat model
   */
  async _extractClaims(answer) {
    try {
      const content = await createTextCompletion({
        maxTokens: 1024,
        messages: [{
          role: 'user',
          content: `Extract all factual claims from this answer as a JSON array of strings. Only include verifiable facts, not opinions or questions. Maximum 5 claims.

Answer: ${answer}

Respond with ONLY a JSON array, no other text. Example: ["The Earth orbits the Sun", "Water is H2O"]`,
        }],
      });

      // Parse JSON response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        logger.warn('Fact Checker: Failed to parse claims JSON, extracting manually');
        return this._extractClaimsManually(answer);
      }

      const claims = JSON.parse(jsonMatch[0]);

      // Validate and limit claims
      const validClaims = claims
        .filter(c => typeof c === 'string' && c.length >= 10 && c.length <= 300)
        .slice(0, 5);

      logger.debug('Fact Checker: Extracted claims', { count: validClaims.length });

      return validClaims;
    } catch (error) {
      logger.warn('Fact Checker: Claim extraction failed', { error: error.message });
      return this._extractClaimsManually(answer);
    }
  }

  /**
   * Manual claim extraction fallback
   */
  _extractClaimsManually(answer) {
    // Split by sentence-ending punctuation
    const sentences = answer
      .replace(/([.!?])\s+/g, '$1|||')
      .split('|||')
      .map(s => s.trim())
      .filter(s => {
        return s.length >= 15 &&
          s.length <= 300 &&
          !s.startsWith('?') &&
          !/^(okay|sure|great|yes|no|well|so|now|let me|i |you |here|this is)/i.test(s);
      })
      .slice(0, 5);

    return sentences;
  }

  /**
   * STAGE 2: Retrieve evidence from pgvector (if available)
   */
  async _retrieveEvidence(claims, query) {
    try {
      // Check if knowledge_chunks table exists
      const { data: tableCheck } = await supabase
        .from('knowledge_chunks')
        .select('id')
        .limit(1);

      if (!tableCheck) {
        logger.debug('Fact Checker: knowledge_chunks table not available');
        return [];
      }

      // Simple text search as fallback (pgvector search would be better)
      const searchText = [query, ...claims].join(' ').slice(0, 500);

      const { data: chunks, error } = await supabase
        .from('knowledge_chunks')
        .select('content')
        .textSearch('content', searchText.split(' ').slice(0, 5).join(' | '))
        .limit(5);

      if (error) {
        logger.warn('Fact Checker: Evidence retrieval failed', { error: error.message });
        return [];
      }

      return chunks?.map(c => c.content) || [];
    } catch (error) {
      logger.warn('Fact Checker: Evidence retrieval error', { error: error.message });
      return [];
    }
  }

  /**
   * STAGE 3: LLM Judge evaluates all claims against evidence
   */
  async _judgeClaimsWithLLM(claims, evidence) {
    const evidenceText = evidence.length > 0
      ? evidence.map((e, i) => `[Source ${i + 1}]: ${e.slice(0, 500)}`).join('\n\n')
      : 'No specific evidence provided. Use general knowledge to assess plausibility.';

    try {
      const content = await createTextCompletion({
        maxTokens: 2048,
        system: `You are a fact-checking judge. For each claim, determine if the evidence supports, refutes, or is insufficient to verify it. Be strict but fair.

Response format (JSON only):
{
  "verdicts": [
    { "claim": "...", "verdict": "supported|refuted|insufficient", "confidence": 0.0-1.0, "source": "Source N or general knowledge" }
  ],
  "overall_confidence": 0.0-1.0
}`,
        messages: [{
          role: 'user',
          content: `Evaluate these claims against the evidence:

CLAIMS:
${claims.map((c, i) => `${i + 1}. ${c}`).join('\n')}

EVIDENCE:
${evidenceText}

Respond with JSON only.`,
        }],
      });

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid JSON response from judge');
      }

      const result = JSON.parse(jsonMatch[0]);

      // Validate response structure
      if (!result.verdicts || !Array.isArray(result.verdicts)) {
        throw new Error('Invalid verdicts structure');
      }

      return {
        verdicts: result.verdicts.map((v, i) => ({
          claim: v.claim || claims[i] || '',
          verdict: ['supported', 'refuted', 'insufficient'].includes(v.verdict)
            ? v.verdict
            : 'insufficient',
          confidence: typeof v.confidence === 'number'
            ? Math.min(1, Math.max(0, v.confidence))
            : 0.5,
          source: v.source || null,
        })),
        overall_confidence: typeof result.overall_confidence === 'number'
          ? Math.min(1, Math.max(0, result.overall_confidence))
          : 0.5,
      };
    } catch (error) {
      logger.warn('Fact Checker: LLM Judge failed', { error: error.message });

      // Return neutral verdicts on failure
      return {
        verdicts: claims.map(claim => ({
          claim,
          verdict: 'insufficient',
          confidence: 0.3,
          source: null,
        })),
        overall_confidence: 0.3,
      };
    }
  }

  /**
   * STAGE 4: Aggregate results
   */
  _aggregateResults(judgeResult, evidence) {
    const { verdicts, overall_confidence } = judgeResult;

    const supportedClaims = verdicts
      .filter(v => v.verdict === 'supported')
      .map(v => v.claim);

    const unsupportedClaims = verdicts
      .filter(v => v.verdict === 'refuted' || v.verdict === 'insufficient')
      .map(v => v.claim);

    // Build sources list
    const sources = this._buildSourcesList(evidence, verdicts);

    // Determine if clarification is needed
    const needs_clarification = overall_confidence < 0.5 || unsupportedClaims.length > supportedClaims.length;

    // Generate summary
    const summary = this._generateSummary(
      supportedClaims.length,
      verdicts.filter(v => v.verdict === 'insufficient').length,
      verdicts.filter(v => v.verdict === 'refuted').length
    );

    return {
      confidence: parseFloat(overall_confidence.toFixed(3)),
      totalClaims: verdicts.length,
      supportedClaims,
      unsupportedClaims,
      claims: verdicts,
      sources,
      summary,
      needs_clarification,
      method: 'llm_judge',
      validatedAt: new Date().toISOString(),
    };
  }

  /**
   * Build formatted sources list
   */
  _buildSourcesList(evidence, verdicts) {
    // Get unique sources mentioned in verdicts
    const mentionedSources = new Set();
    verdicts.forEach(v => {
      if (v.source && v.source.toLowerCase().includes('source')) {
        const match = v.source.match(/source\s*(\d+)/i);
        if (match) {
          mentionedSources.add(parseInt(match[1], 10) - 1);
        }
      }
    });

    // Build sources array
    return evidence
      .slice(0, 3)
      .map((content, i) => ({
        preview: content.slice(0, 100) + (content.length > 100 ? '...' : ''),
        relevance: mentionedSources.has(i) ? 0.9 : 0.5,
        rank: i + 1,
      }));
  }

  /**
   * Generate human-readable summary
   */
  _generateSummary(supported, insufficient, refuted) {
    const total = supported + insufficient + refuted;
    if (total === 0) return 'No claims to verify';

    if (supported === total) {
      return 'All claims are well-supported by evidence';
    }

    if (refuted === total) {
      return 'Claims appear to be incorrect based on evidence';
    }

    if (insufficient === total) {
      return 'Insufficient evidence to verify claims';
    }

    const parts = [];
    if (supported > 0) parts.push(`${supported} supported`);
    if (insufficient > 0) parts.push(`${insufficient} unverified`);
    if (refuted > 0) parts.push(`${refuted} disputed`);

    return `${parts.join(', ')} out of ${total} claims`;
  }

  /**
   * Jaccard fallback when LLM pipeline fails
   * Preserves the original heuristic-based approach
   */
  _jaccardFallback(answer, retrievedChunks, query) {
    logger.info('Fact Checker: Using Jaccard fallback');

    const claims = this._extractClaimsManually(answer);

    const verifiedClaims = claims.map((claim, index) => {
      if (!retrievedChunks || retrievedChunks.length === 0) {
        return this._heuristicVerify(claim, index);
      }

      const claimWords = this._tokenize(claim);
      let maxScore = 0;
      let bestChunkIndex = -1;

      for (let i = 0; i < retrievedChunks.length; i++) {
        const score = this._calculateSimilarity(claimWords, this._tokenize(retrievedChunks[i]));
        if (score > maxScore) {
          maxScore = score;
          bestChunkIndex = i;
        }
      }

      let status, confidence;
      if (maxScore >= 0.5) {
        status = 'supported';
        confidence = 0.7 + (maxScore - 0.5) * 0.6;
      } else if (maxScore >= 0.3) {
        status = 'insufficient';
        confidence = 0.4 + (maxScore - 0.3) * 0.75;
      } else {
        status = 'refuted';
        confidence = maxScore * 1.2;
      }

      return {
        claim,
        verdict: status,
        confidence: parseFloat(Math.min(1, confidence).toFixed(3)),
        source: bestChunkIndex >= 0 ? `Source ${bestChunkIndex + 1}` : null,
        index,
      };
    });

    const supportedClaims = verifiedClaims.filter(c => c.verdict === 'supported');
    const unsupportedClaims = verifiedClaims.filter(c => c.verdict !== 'supported');

    const totalClaims = verifiedClaims.length;
    const confidence = totalClaims > 0
      ? (supportedClaims.length + 0.5 * verifiedClaims.filter(c => c.verdict === 'insufficient').length) / totalClaims
      : 0.3;

    return {
      confidence: parseFloat((confidence * 0.8).toFixed(3)), // Reduce confidence for fallback
      totalClaims,
      supportedClaims: supportedClaims.map(c => c.claim),
      unsupportedClaims: unsupportedClaims.map(c => c.claim),
      claims: verifiedClaims,
      sources: this._selectTopSources(retrievedChunks, answer, 3),
      summary: this._generateSummary(
        supportedClaims.length,
        verifiedClaims.filter(c => c.verdict === 'insufficient').length,
        verifiedClaims.filter(c => c.verdict === 'refuted').length
      ),
      needs_clarification: confidence < 0.5,
      method: 'jaccard_fallback',
      validatedAt: new Date().toISOString(),
    };
  }

  /**
   * Heuristic verification when no chunks available
   */
  _heuristicVerify(claim, index) {
    const lowerClaim = claim.toLowerCase();
    let confidence = 0.4;
    let verdict = 'insufficient';

    // Scientific terms boost confidence slightly
    const scientificTerms = [
      'photosynthesis', 'molecule', 'atom', 'cell', 'dna', 'energy',
      'gravity', 'electron', 'equation', 'theorem', 'function',
    ];

    const termMatches = scientificTerms.filter(t => lowerClaim.includes(t)).length;
    if (termMatches > 0) {
      confidence += termMatches * 0.08;
    }

    // Hedging words reduce confidence
    if (/might|could|possibly|maybe|perhaps/i.test(lowerClaim)) {
      confidence -= 0.1;
    }

    // Opinion words reduce confidence
    if (/believe|think|feel|opinion/i.test(lowerClaim)) {
      confidence -= 0.15;
    }

    confidence = Math.max(0.1, Math.min(0.6, confidence));

    if (confidence >= 0.5) verdict = 'supported';
    else if (confidence < 0.3) verdict = 'refuted';

    return {
      claim,
      verdict,
      confidence: parseFloat(confidence.toFixed(3)),
      source: null,
      index,
    };
  }

  /**
   * Tokenize text into words
   */
  _tokenize(text) {
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !this._isStopWord(w));
    return new Set(words);
  }

  /**
   * Check if word is a stop word
   */
  _isStopWord(word) {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these',
      'those', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while',
      'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into',
      'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from',
    ]);
    return stopWords.has(word);
  }

  /**
   * Calculate Jaccard similarity
   */
  _calculateSimilarity(set1, set2) {
    if (set1.size === 0 || set2.size === 0) return 0;

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Select top N sources by relevance
   */
  _selectTopSources(chunks, answer, n = 3) {
    if (!chunks || chunks.length === 0) return [];

    const answerTokens = this._tokenize(answer);

    const scored = chunks.map((chunk, index) => ({
      preview: chunk.slice(0, 100) + (chunk.length > 100 ? '...' : ''),
      relevance: this._calculateSimilarity(answerTokens, this._tokenize(chunk)),
      rank: index + 1,
    }));

    return scored
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, n)
      .map((s, i) => ({ ...s, rank: i + 1 }));
  }

  /**
   * Generate cache key for query + answer
   */
  _generateCacheKey(query, answer) {
    const content = `${query}||${answer}`.slice(0, 1000);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Check cache for existing result
   */
  async _checkCache(cacheKey) {
    try {
      const { data, error } = await supabase
        .from('fact_checks')
        .select('*')
        .eq('cache_key', cacheKey)
        .gte('created_at', new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString())
        .single();

      if (error || !data) return null;

      return {
        confidence: data.confidence_score,
        totalClaims: data.claims?.length || 0,
        supportedClaims: data.verification_results?.supportedClaims || [],
        unsupportedClaims: data.verification_results?.unsupportedClaims || [],
        claims: data.claims || [],
        sources: data.sources || [],
        summary: data.verification_results?.summary || '',
        needs_clarification: data.verification_results?.needs_clarification || false,
        validatedAt: data.created_at,
      };
    } catch (error) {
      logger.debug('Fact Checker: Cache check failed', { error: error.message });
      return null;
    }
  }

  /**
   * Cache result for future use
   */
  async _cacheResult(cacheKey, result) {
    try {
      await supabase.from('fact_checks').insert({
        cache_key: cacheKey,
        claims: result.claims,
        verification_results: {
          supportedClaims: result.supportedClaims,
          unsupportedClaims: result.unsupportedClaims,
          summary: result.summary,
          needs_clarification: result.needs_clarification,
          method: result.method,
        },
        confidence_score: result.confidence,
        sources: result.sources,
      });
    } catch (error) {
      logger.debug('Fact Checker: Cache write failed', { error: error.message });
    }
  }

  /**
   * Promise that rejects after timeout
   */
  _timeout(ms) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Pipeline timeout after ${ms}ms`)), ms);
    });
  }

  /**
   * Quick validation for streaming (lightweight)
   */
  quickValidate(text, chunks = []) {
    const claims = this._extractClaimsManually(text);
    const results = claims.map(claim => {
      if (chunks.length === 0) {
        return this._heuristicVerify(claim, 0);
      }

      const claimWords = this._tokenize(claim);
      let maxScore = 0;
      for (const chunk of chunks) {
        const score = this._calculateSimilarity(claimWords, this._tokenize(chunk));
        if (score > maxScore) maxScore = score;
      }

      return {
        claim,
        verdict: maxScore >= 0.5 ? 'supported' : maxScore >= 0.3 ? 'insufficient' : 'refuted',
        confidence: Math.min(1, maxScore + 0.2),
      };
    });

    const supported = results.filter(r => r.verdict === 'supported').length;
    const total = results.length;
    const confidence = total > 0 ? (supported / total) * 0.7 + 0.15 : 0.5;

    return {
      confidence: parseFloat(confidence.toFixed(3)),
      claimsCount: total,
      supportedCount: supported,
      needs_clarification: confidence < 0.5,
      quickCheck: true,
    };
  }

  // Lifecycle hooks
  async beforeExecute(input, context) {
    logger.debug(`[${this.name}] Starting fact check...`);
    return { input, context };
  }

  async afterExecute(result, context) {
    if (typeof result.confidence !== 'number') {
      throw new Error('Invalid result: confidence must be a number');
    }
    logger.info(`[${this.name}] Fact checking completed (method: ${result.method})`);
    return result;
  }

  async onError(error, input, context) {
    logger.error(`[${this.name}] Error:`, { message: error.message });
    return {
      error: true,
      message: error.message,
      confidence: 0.3,
      supportedClaims: [],
      unsupportedClaims: [],
      claims: [],
      sources: [],
      summary: 'Fact checking failed - using minimal confidence',
      needs_clarification: true,
      method: 'error_fallback',
      validatedAt: new Date().toISOString(),
    };
  }
}

export default FactCheckerAgent;

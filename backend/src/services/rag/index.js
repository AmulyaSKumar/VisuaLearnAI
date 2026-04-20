/**
 * RAG (Retrieval-Augmented Generation) Service
 * Handles document upload, processing, embedding, and retrieval
 */

import { supabase } from '../../database/client.js';
import { logger } from '../logger.js';
import { config } from '../../config/environment.js';

// Chunking configuration
const CHUNK_CONFIG = {
  targetTokens: 600,      // Target tokens per chunk (500-800 range)
  maxTokens: 800,         // Maximum tokens per chunk
  overlapTokens: 100,     // Overlap between chunks
  minChunkLength: 100,    // Minimum characters for a valid chunk
};

// Approximate tokens (4 chars ≈ 1 token)
const estimateTokens = (text) => Math.ceil(text.length / 4);

/**
 * Create a new document record
 */
export async function createDocument(userId, filename, originalName, fileSize, storagePath, mimeType = 'application/pdf') {
  try {
    const { data, error } = await supabase
      .from('documents')
      .insert({
        user_id: userId,
        filename,
        original_name: originalName,
        file_size: fileSize,
        storage_path: storagePath,
        mime_type: mimeType,
        status: 'uploading',
      })
      .select()
      .single();

    if (error) throw error;

    logger.info({ documentId: data.id, userId }, 'Document record created');
    return data;
  } catch (error) {
    logger.error({ error, userId }, 'Failed to create document record');
    throw error;
  }
}

/**
 * Update document status
 */
export async function updateDocumentStatus(documentId, status, errorMessage = null, additionalData = {}) {
  try {
    const updateData = {
      status,
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
      ...additionalData,
    };

    const { data, error } = await supabase
      .from('documents')
      .update(updateData)
      .eq('id', documentId)
      .select()
      .single();

    if (error) throw error;

    logger.info({ documentId, status }, 'Document status updated');
    return data;
  } catch (error) {
    logger.error({ error, documentId }, 'Failed to update document status');
    throw error;
  }
}

/**
 * Get document by ID
 */
export async function getDocument(documentId) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

/**
 * Get user's documents
 */
export async function getUserDocuments(userId) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Split text into chunks with overlap
 */
export function splitTextIntoChunks(text, pageNumber = null) {
  const chunks = [];
  const sentences = text.split(/(?<=[.!?])\s+/);

  let currentChunk = '';
  let chunkIndex = 0;

  for (const sentence of sentences) {
    const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
    const tokenCount = estimateTokens(potentialChunk);

    if (tokenCount > CHUNK_CONFIG.maxTokens && currentChunk) {
      // Save current chunk
      if (currentChunk.length >= CHUNK_CONFIG.minChunkLength) {
        chunks.push({
          text: currentChunk.trim(),
          chunkIndex: chunkIndex++,
          pageNumber,
          tokenCount: estimateTokens(currentChunk),
        });
      }

      // Start new chunk with overlap (last ~100 tokens of previous)
      const overlapText = getOverlapText(currentChunk, CHUNK_CONFIG.overlapTokens);
      currentChunk = overlapText + ' ' + sentence;
    } else {
      currentChunk = potentialChunk;
    }
  }

  // Add final chunk
  if (currentChunk.length >= CHUNK_CONFIG.minChunkLength) {
    chunks.push({
      text: currentChunk.trim(),
      chunkIndex: chunkIndex++,
      pageNumber,
      tokenCount: estimateTokens(currentChunk),
    });
  }

  return chunks;
}

/**
 * Get overlap text from end of previous chunk
 */
function getOverlapText(text, targetTokens) {
  const words = text.split(/\s+/);
  const targetWords = Math.ceil(targetTokens * 0.75); // ~0.75 words per token

  if (words.length <= targetWords) return text;

  return words.slice(-targetWords).join(' ');
}

/**
 * Generate embedding for text using Azure OpenAI
 */
export async function generateEmbedding(text) {
  try {
    // Use Azure OpenAI for embeddings (ada-002)
    const azureEndpoint = config.azure.endpoint;
    const azureKey = config.azure.apiKey;

    if (!azureEndpoint || !azureKey) {
      logger.warn('Azure OpenAI not configured, skipping embedding generation');
      return null;
    }

    const response = await fetch(`${azureEndpoint}/openai/deployments/text-embedding-ada-002/embeddings?api-version=2024-02-01`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': azureKey,
      },
      body: JSON.stringify({
        input: text.slice(0, 8000), // Max input length
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Embedding API error: ${error}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    logger.error({ error }, 'Failed to generate embedding');
    throw error;
  }
}

/**
 * Store chunks with embeddings in database
 */
export async function storeChunks(documentId, chunks) {
  const storedChunks = [];

  for (const chunk of chunks) {
    try {
      // Generate embedding
      const embedding = await generateEmbedding(chunk.text);

      const { data, error } = await supabase
        .from('document_chunks')
        .insert({
          document_id: documentId,
          chunk_index: chunk.chunkIndex,
          text: chunk.text,
          page_number: chunk.pageNumber,
          embedding,
          token_count: chunk.tokenCount,
          metadata: chunk.metadata || {},
        })
        .select()
        .single();

      if (error) throw error;
      storedChunks.push(data);

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      logger.error({ error, documentId, chunkIndex: chunk.chunkIndex }, 'Failed to store chunk');
      // Continue with other chunks
    }
  }

  // Update document chunk count
  await supabase
    .from('documents')
    .update({ chunk_count: storedChunks.length })
    .eq('id', documentId);

  logger.info({ documentId, chunkCount: storedChunks.length }, 'Chunks stored');
  return storedChunks;
}

/**
 * Expand query with related terms for better retrieval
 * Helps with "sorting" matching "bubble sort" etc.
 */
function expandQuery(query) {
  const q = query.toLowerCase();
  const expansions = [query];

  // Common query expansions for learning topics
  const synonymMap = {
    'sorting': ['sort', 'order', 'arrange', 'bubble sort', 'quick sort', 'merge sort'],
    'efficient': ['efficiency', 'performance', 'complexity', 'fast', 'slow', 'time'],
    'algorithm': ['method', 'approach', 'technique', 'procedure', 'steps'],
    'explain': ['what is', 'how does', 'describe', 'definition'],
    'example': ['instance', 'case', 'demonstration', 'sample'],
    'work': ['function', 'operate', 'process', 'mechanism'],
  };

  // Add expansions for matching words
  for (const [key, values] of Object.entries(synonymMap)) {
    if (q.includes(key)) {
      expansions.push(...values);
    }
  }

  return [...new Set(expansions)].join(' ');
}

/**
 * Retrieve relevant chunks using HYBRID search (vector + keyword)
 * Lower threshold (0.5) to be more permissive
 */
export async function retrieveChunks(documentId, query, limit = 5, threshold = 0.5) {
  try {
    // Expand query for better matching
    const expandedQuery = expandQuery(query);
    logger.info({ documentId, original: query, expanded: expandedQuery.slice(0, 100) }, 'Query expanded');

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(expandedQuery);

    let vectorResults = [];
    let keywordResults = [];

    // Vector search (if embeddings available)
    if (queryEmbedding) {
      try {
        const { data, error } = await supabase.rpc('match_document_chunks', {
          query_embedding: queryEmbedding,
          match_document_id: documentId,
          match_count: limit,
          match_threshold: threshold, // Lower threshold = more permissive
        });

        if (!error && data) {
          vectorResults = data;
        }
      } catch (e) {
        logger.warn({ error: e }, 'Vector search failed, using keyword fallback');
      }
    }

    // Always also do keyword search for hybrid results
    keywordResults = await fallbackTextSearch(documentId, query, limit);

    // Merge and deduplicate results (vector results preferred)
    const seenIds = new Set();
    const merged = [];

    // Add vector results first (higher quality)
    for (const chunk of vectorResults) {
      if (!seenIds.has(chunk.id)) {
        seenIds.add(chunk.id);
        merged.push({ ...chunk, _source: 'vector' });
      }
    }

    // Add keyword results that weren't in vector results
    for (const chunk of keywordResults) {
      if (!seenIds.has(chunk.id)) {
        seenIds.add(chunk.id);
        merged.push({ ...chunk, _source: 'keyword' });
      }
    }

    // If STILL no results, get first chunks of document (at least show something)
    if (merged.length === 0) {
      logger.warn({ documentId, query }, 'No matches found, fetching first chunks as fallback');
      const { data: firstChunks } = await supabase
        .from('document_chunks')
        .select('*')
        .eq('document_id', documentId)
        .order('chunk_index', { ascending: true })
        .limit(3);

      if (firstChunks && firstChunks.length > 0) {
        return firstChunks.map(c => ({ ...c, similarity: 0.3, _source: 'fallback_first' }));
      }
    }

    logger.info({
      documentId,
      query: query.slice(0, 50),
      vectorCount: vectorResults.length,
      keywordCount: keywordResults.length,
      mergedCount: merged.length
    }, 'Hybrid retrieval complete');

    return merged.slice(0, limit);
  } catch (error) {
    logger.error({ error, documentId }, 'Failed to retrieve chunks');
    // Last resort fallback
    return fallbackTextSearch(documentId, query, limit);
  }
}

/**
 * Fallback text search when embeddings are not available
 */
async function fallbackTextSearch(documentId, query, limit = 5) {
  try {
    // Simple keyword-based search
    const keywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);

    const { data, error } = await supabase
      .from('document_chunks')
      .select('*')
      .eq('document_id', documentId)
      .order('chunk_index', { ascending: true })
      .limit(limit * 2); // Get more to filter

    if (error) throw error;

    // Score chunks by keyword matches
    const scored = (data || []).map(chunk => {
      const text = chunk.text.toLowerCase();
      const matches = keywords.filter(kw => text.includes(kw)).length;
      return { ...chunk, similarity: matches / keywords.length };
    });

    // Sort by score and return top results
    return scored
      .filter(c => c.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  } catch (error) {
    logger.error({ error }, 'Fallback text search failed');
    return [];
  }
}

/**
 * Format retrieved chunks as context for LLM
 */
export function formatChunksAsContext(chunks) {
  if (!chunks || chunks.length === 0) {
    return null;
  }

  return chunks.map((chunk, index) => {
    const pageInfo = chunk.page_number ? ` (Page ${chunk.page_number})` : '';
    return `[Source ${index + 1}${pageInfo}]\n${chunk.text}`;
  }).join('\n\n---\n\n');
}

/**
 * Check if document has enough chunks to be queryable
 */
export async function isDocumentReady(documentId) {
  const doc = await getDocument(documentId);
  return doc && doc.status === 'ready' && doc.chunk_count > 0;
}

/**
 * Delete document and all associated chunks
 */
export async function deleteDocument(documentId, userId) {
  try {
    // Verify ownership
    const doc = await getDocument(documentId);
    if (!doc || doc.user_id !== userId) {
      throw new Error('Document not found or access denied');
    }

    // Delete from storage
    if (doc.storage_path) {
      await supabase.storage
        .from('documents')
        .remove([doc.storage_path]);
    }

    // Delete document (chunks cascade delete via FK)
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (error) throw error;

    logger.info({ documentId, userId }, 'Document deleted');
    return true;
  } catch (error) {
    logger.error({ error, documentId }, 'Failed to delete document');
    throw error;
  }
}

/**
 * Generate a summary of the document (first few chunks)
 */
export async function getDocumentSummary(documentId) {
  const { data, error } = await supabase
    .from('document_chunks')
    .select('text')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true })
    .limit(3);

  if (error) throw error;

  if (!data || data.length === 0) {
    return null;
  }

  return data.map(c => c.text).join('\n\n');
}

export default {
  createDocument,
  updateDocumentStatus,
  getDocument,
  getUserDocuments,
  splitTextIntoChunks,
  generateEmbedding,
  storeChunks,
  retrieveChunks,
  formatChunksAsContext,
  isDocumentReady,
  deleteDocument,
  getDocumentSummary,
};

/**
 * Document Upload API Routes
 * Handles PDF upload, processing status, and document management
 */

import { Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../database/client.js';
import { logger } from '../../services/logger.js';
import {
  createDocument,
  updateDocumentStatus,
  getDocument,
  getUserDocuments,
  deleteDocument,
  retrieveChunks,
  formatChunksAsContext,
  getDocumentSummary,
} from '../../services/rag/index.js';
import { processPdfBuffer, validatePdf } from '../../services/rag/pdfProcessor.js';

const router = Router();

// Configure multer for memory storage (streaming)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});

/**
 * POST /api/documents/upload
 * Upload and process a PDF document
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  let documentId = null;

  try {
    const file = req.file;
    logger.info({ userId, filename: file.originalname, size: file.size }, 'Document upload started');

    // Validate PDF
    const validation = validatePdf(file.buffer);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Generate unique filename
    const filename = `${uuidv4()}.pdf`;
    const storagePath = `${userId}/${filename}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, file.buffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      logger.error({ error: uploadError }, 'Storage upload failed');
      return res.status(500).json({ error: 'Failed to upload file' });
    }

    // Create document record
    const document = await createDocument(
      userId,
      filename,
      file.originalname,
      file.size,
      storagePath
    );
    documentId = document.id;

    // Start async processing
    // Don't await - let it process in background
    processPdfBuffer(documentId, file.buffer).catch(err => {
      logger.error({ error: err, documentId }, 'Background PDF processing failed');
    });

    // Return immediately with document ID
    res.status(202).json({
      success: true,
      message: 'Document uploaded, processing started',
      document: {
        id: document.id,
        filename: document.original_name,
        status: 'processing',
        uploadedAt: document.created_at,
      },
    });
  } catch (error) {
    logger.error({ error, userId }, 'Document upload failed');

    // Clean up on error
    if (documentId) {
      await updateDocumentStatus(documentId, 'error', error.message).catch(() => {});
    }

    res.status(500).json({ error: 'Failed to process document' });
  }
});

/**
 * GET /api/documents
 * List user's documents
 */
router.get('/', async (req, res) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const documents = await getUserDocuments(userId);

    res.json({
      success: true,
      documents: documents.map(doc => ({
        id: doc.id,
        filename: doc.original_name,
        status: doc.status,
        pageCount: doc.page_count,
        chunkCount: doc.chunk_count,
        uploadedAt: doc.created_at,
        error: doc.error_message,
      })),
    });
  } catch (error) {
    logger.error({ error, userId }, 'Failed to list documents');
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

/**
 * GET /api/documents/:id
 * Get document details and status
 */
router.get('/:id', async (req, res) => {
  const userId = req.user?.userId;
  const documentId = req.params.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const document = await getDocument(documentId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      success: true,
      document: {
        id: document.id,
        filename: document.original_name,
        status: document.status,
        pageCount: document.page_count,
        chunkCount: document.chunk_count,
        uploadedAt: document.created_at,
        error: document.error_message,
      },
    });
  } catch (error) {
    logger.error({ error, documentId }, 'Failed to get document');
    res.status(500).json({ error: 'Failed to get document' });
  }
});

/**
 * DELETE /api/documents/:id
 * Delete a document
 */
router.delete('/:id', async (req, res) => {
  const userId = req.user?.userId;
  const documentId = req.params.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    await deleteDocument(documentId, userId);
    res.json({ success: true, message: 'Document deleted' });
  } catch (error) {
    logger.error({ error, documentId }, 'Failed to delete document');

    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.status(500).json({ error: 'Failed to delete document' });
  }
});

/**
 * POST /api/documents/:id/query
 * Query document using RAG retrieval
 */
router.post('/:id/query', async (req, res) => {
  const userId = req.user?.userId;
  const documentId = req.params.id;
  const { query, limit = 5 } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!query) {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    // Verify document access
    const document = await getDocument(documentId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (document.status !== 'ready') {
      return res.status(400).json({
        error: 'Document not ready',
        status: document.status,
        message: document.status === 'processing'
          ? 'Document is still being processed. Please wait.'
          : 'Document processing failed.',
      });
    }

    // Retrieve relevant chunks
    const chunks = await retrieveChunks(documentId, query, limit);

    if (!chunks || chunks.length === 0) {
      return res.json({
        success: true,
        context: null,
        chunks: [],
        message: 'No relevant information found in the document.',
      });
    }

    // Format as context
    const context = formatChunksAsContext(chunks);

    res.json({
      success: true,
      context,
      chunks: chunks.map(c => ({
        text: c.text,
        page: c.page_number,
        similarity: c.similarity,
      })),
    });
  } catch (error) {
    logger.error({ error, documentId, query }, 'Document query failed');
    res.status(500).json({ error: 'Failed to query document' });
  }
});

/**
 * GET /api/documents/:id/summary
 * Get document summary (first chunks)
 */
router.get('/:id/summary', async (req, res) => {
  const userId = req.user?.userId;
  const documentId = req.params.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const document = await getDocument(documentId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const summary = await getDocumentSummary(documentId);

    res.json({
      success: true,
      summary: summary || 'No content available.',
      document: {
        filename: document.original_name,
        pageCount: document.page_count,
        status: document.status,
      },
    });
  } catch (error) {
    logger.error({ error, documentId }, 'Failed to get document summary');
    res.status(500).json({ error: 'Failed to get summary' });
  }
});

/**
 * GET /api/documents/:id/preview
 * Get document preview with topics and suggested questions
 * This helps users understand what they can ask about
 */
router.get('/:id/preview', async (req, res) => {
  const userId = req.user?.userId;
  const documentId = req.params.id;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const document = await getDocument(documentId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (document.status !== 'ready') {
      return res.json({
        success: true,
        status: document.status,
        preview: null,
        message: document.status === 'processing'
          ? 'Document is still being processed...'
          : 'Document processing failed.',
      });
    }

    // Get first few chunks to extract topics
    const { data: chunks } = await supabase
      .from('document_chunks')
      .select('text')
      .eq('document_id', documentId)
      .order('chunk_index', { ascending: true })
      .limit(5);

    if (!chunks || chunks.length === 0) {
      return res.json({
        success: true,
        preview: {
          topics: [],
          suggestedQuestions: ['What is this document about?'],
          contentPreview: 'No content extracted.',
        },
      });
    }

    // Extract key topics from chunks (simple keyword extraction)
    const allText = chunks.map(c => c.text).join(' ').toLowerCase();
    const words = allText.split(/\s+/);
    const wordFreq = {};
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'and', 'but', 'or', 'if', 'because', 'until', 'while', 'although', 'this', 'that', 'these', 'those', 'it', 'its']);

    for (const word of words) {
      const clean = word.replace(/[^a-z]/g, '');
      if (clean.length > 4 && !stopWords.has(clean)) {
        wordFreq[clean] = (wordFreq[clean] || 0) + 1;
      }
    }

    // Get top topics
    const topics = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));

    // Generate suggested questions based on topics
    const suggestedQuestions = [
      'What is this document about?',
      'Summarize the key points',
      ...topics.slice(0, 3).map(t => `Explain ${t}`),
      'Create a quiz from this document',
    ];

    // Content preview (first 500 chars)
    const contentPreview = chunks[0].text.slice(0, 500) + (chunks[0].text.length > 500 ? '...' : '');

    res.json({
      success: true,
      preview: {
        topics,
        suggestedQuestions,
        contentPreview,
        chunkCount: document.chunk_count,
        pageCount: document.page_count,
      },
      document: {
        filename: document.original_name,
        status: document.status,
      },
    });
  } catch (error) {
    logger.error({ error, documentId }, 'Failed to get document preview');
    res.status(500).json({ error: 'Failed to get preview' });
  }
});

export default router;

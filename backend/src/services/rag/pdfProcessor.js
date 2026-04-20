/**
 * PDF Processing Service
 * Extracts text from PDFs and prepares chunks for embedding
 */

import pdf from 'pdf-parse';
import { logger } from '../logger.js';
import { splitTextIntoChunks, storeChunks, updateDocumentStatus } from './index.js';
import { supabase } from '../../database/client.js';

/**
 * Process a PDF file from Supabase storage
 * Extracts text, creates chunks, generates embeddings, stores in DB
 */
export async function processPdfFromStorage(documentId, storagePath) {
  try {
    logger.info({ documentId, storagePath }, 'Starting PDF processing');

    // Update status to processing
    await updateDocumentStatus(documentId, 'processing');

    // Download file from Supabase storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(storagePath);

    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    // Convert blob to buffer
    const buffer = Buffer.from(await fileData.arrayBuffer());

    // Extract text from PDF
    const pdfData = await pdf(buffer);

    logger.info({
      documentId,
      pages: pdfData.numpages,
      textLength: pdfData.text.length,
    }, 'PDF text extracted');

    // Update page count
    await updateDocumentStatus(documentId, 'processing', null, {
      page_count: pdfData.numpages,
    });

    // Split text into chunks
    const chunks = splitTextIntoChunks(pdfData.text);

    if (chunks.length === 0) {
      throw new Error('No text content could be extracted from PDF');
    }

    logger.info({ documentId, chunkCount: chunks.length }, 'Text chunked');

    // Store chunks with embeddings
    await storeChunks(documentId, chunks);

    // Update status to ready
    await updateDocumentStatus(documentId, 'ready', null, {
      chunk_count: chunks.length,
    });

    logger.info({ documentId }, 'PDF processing complete');

    return {
      success: true,
      pageCount: pdfData.numpages,
      chunkCount: chunks.length,
    };
  } catch (error) {
    logger.error({ error, documentId }, 'PDF processing failed');

    // Update status to error
    await updateDocumentStatus(documentId, 'error', error.message);

    throw error;
  }
}

/**
 * Process PDF from buffer directly (for streaming uploads)
 */
export async function processPdfBuffer(documentId, buffer) {
  try {
    logger.info({ documentId, bufferSize: buffer.length }, 'Processing PDF from buffer');

    // Update status to processing
    await updateDocumentStatus(documentId, 'processing');

    // Extract text from PDF
    const pdfData = await pdf(buffer);

    logger.info({
      documentId,
      pages: pdfData.numpages,
      textLength: pdfData.text.length,
    }, 'PDF text extracted');

    // Split text into chunks with page tracking
    const allChunks = [];
    let globalChunkIndex = 0;

    // Try to split by pages if possible
    // pdf-parse doesn't easily give per-page text, so we use the full text
    const chunks = splitTextIntoChunks(pdfData.text);

    for (const chunk of chunks) {
      allChunks.push({
        ...chunk,
        chunkIndex: globalChunkIndex++,
      });
    }

    if (allChunks.length === 0) {
      throw new Error('No text content could be extracted from PDF');
    }

    logger.info({ documentId, chunkCount: allChunks.length }, 'Text chunked');

    // Store chunks with embeddings
    await storeChunks(documentId, allChunks);

    // Update status to ready
    await updateDocumentStatus(documentId, 'ready', null, {
      page_count: pdfData.numpages,
      chunk_count: allChunks.length,
    });

    logger.info({ documentId }, 'PDF processing complete');

    return {
      success: true,
      pageCount: pdfData.numpages,
      chunkCount: allChunks.length,
    };
  } catch (error) {
    logger.error({ error, documentId }, 'PDF processing failed');

    // Update status to error
    await updateDocumentStatus(documentId, 'error', error.message);

    throw error;
  }
}

/**
 * Extract text from PDF without storing (for preview)
 */
export async function extractPdfText(buffer) {
  try {
    const pdfData = await pdf(buffer);
    return {
      text: pdfData.text,
      pageCount: pdfData.numpages,
      info: pdfData.info,
    };
  } catch (error) {
    logger.error({ error }, 'PDF text extraction failed');
    throw error;
  }
}

/**
 * Validate PDF file
 */
export function validatePdf(buffer) {
  // Check PDF magic number
  const header = buffer.slice(0, 5).toString();
  if (header !== '%PDF-') {
    return { valid: false, error: 'Invalid PDF file format' };
  }

  // Check file size (max 50MB)
  const maxSize = 50 * 1024 * 1024;
  if (buffer.length > maxSize) {
    return { valid: false, error: 'File size exceeds 50MB limit' };
  }

  return { valid: true };
}

export default {
  processPdfFromStorage,
  processPdfBuffer,
  extractPdfText,
  validatePdf,
};

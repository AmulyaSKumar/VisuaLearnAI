import crypto from 'crypto';
import { Client } from '@notionhq/client';
import { config } from '../../config/environment.js';
import { supabase, getConversationMessages, getConversationResources } from '../../database/client.js';
import {
  buildConversationDocument,
  buildLearningDocument,
  documentToNotionBlocks,
  artifactLabels,
} from './document.js';

const NOTION_AUTH_URL = 'https://api.notion.com/v1/oauth/authorize';
const DATABASE_TITLE = 'VisuaLearn Learning Library';
const BLOCK_BATCH_SIZE = 90;

export function isNotionConfigured() {
  return getMissingNotionConfig().length === 0;
}

export function getMissingNotionConfig() {
  const required = [
    ['NOTION_CLIENT_ID', config.notion.clientId],
    ['NOTION_CLIENT_SECRET', config.notion.clientSecret],
    ['NOTION_TOKEN_ENCRYPTION_KEY', config.notion.tokenEncryptionKey],
  ];

  return required.filter(([, value]) => !value).map(([name]) => name);
}

export function getNotionAuthorizationUrl(userId) {
  assertConfigured();

  const state = signState({
    userId,
    exp: Date.now() + 10 * 60 * 1000,
    nonce: crypto.randomBytes(12).toString('hex'),
  });

  const params = new URLSearchParams({
    client_id: config.notion.clientId,
    response_type: 'code',
    owner: 'user',
    redirect_uri: config.notion.redirectUri,
    state,
  });

  return `${NOTION_AUTH_URL}?${params.toString()}`;
}

export async function handleNotionCallback({ code, state }) {
  assertConfigured();
  const payload = verifyState(state);

  if (!code) {
    throw statusError(400, 'Missing Notion authorization code');
  }

  const token = await exchangeCodeForToken(code);
  const notion = createNotionClient(token.access_token);
  const database = await createLearningDatabase(notion);
  const dataSourceId = database.data_sources?.[0]?.id || database.id;

  const connection = {
    user_id: payload.userId,
    access_token_encrypted: encrypt(token.access_token),
    workspace_id: token.workspace_id || null,
    workspace_name: token.workspace_name || null,
    workspace_icon: token.workspace_icon || null,
    bot_id: token.bot_id || null,
    database_id: database.id,
    data_source_id: dataSourceId,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('notion_connections')
    .upsert(connection, { onConflict: 'user_id' });

  if (error) {
    throw statusError(500, `Failed to save Notion connection: ${error.message}`);
  }

  return {
    userId: payload.userId,
    workspaceName: token.workspace_name || 'Notion',
    databaseId: database.id,
    dataSourceId,
  };
}

export async function getNotionStatus(userId) {
  if (!isNotionConfigured()) {
    return { connected: false, configured: false, missing: getMissingNotionConfig() };
  }

  const connection = await getConnection(userId, { required: false });
  if (!connection) {
    return { connected: false, configured: true };
  }

  return {
    connected: true,
    configured: true,
    workspaceName: connection.workspace_name,
    workspaceIcon: connection.workspace_icon,
    databaseReady: Boolean(connection.data_source_id || connection.database_id),
  };
}

export async function disconnectNotion(userId) {
  const { error } = await supabase
    .from('notion_connections')
    .delete()
    .eq('user_id', userId);

  if (error) {
    throw statusError(500, `Failed to disconnect Notion: ${error.message}`);
  }
}

export async function exportConversationToNotion({
  userId,
  conversationId,
  artifactTypes,
  mindmapPngDataUrl,
  mode = 'learning',
  scope = null,
  messageId = null,
  blockTypes = [],
  blockIds = [],
}) {
  assertConfigured();

  const connection = await getConnection(userId);
  const conversation = await getOwnedConversation(userId, conversationId);
  const [resources, messages] = await Promise.all([
    getConversationResources(conversationId),
    getConversationMessages(conversationId).catch(() => []),
  ]);
  const selectedTypes = normalizeArtifactTypes(artifactTypes);
  const normalizedMode = mode === 'chat' ? 'chat' : 'learning';
  const normalizedScope = scope || (normalizedMode === 'chat' ? 'conversation' : 'workspace');
  const document = normalizedMode === 'chat'
    ? buildConversationDocument({
      conversation,
      messages,
      blockTypes,
      blockIds,
      messageId,
      scope: normalizedScope,
    })
    : buildLearningDocument({
      conversation,
      resources,
      artifactTypes: selectedTypes,
      messages,
    });

  if (!document) {
    throw statusError(422, normalizedMode === 'chat'
      ? 'No matching response blocks exist for this chat export.'
      : 'No selected learning artifacts exist for this conversation.');
  }

  const notion = createNotionClient(decrypt(connection.access_token_encrypted));
  const dataSourceId = connection.data_source_id || connection.database_id;

  if (!dataSourceId) {
    throw statusError(409, 'Notion database is not ready. Reconnect Notion and try again.');
  }

  let mindmapFileUploadId = null;
  if (document.artifactTypes.includes('mindmap') && mindmapPngDataUrl) {
    try {
      mindmapFileUploadId = await uploadMindmapPng(notion, mindmapPngDataUrl, document.topic);
    } catch (error) {
      console.warn('[Notion] Mindmap PNG upload failed, falling back to bullets:', error.message);
    }
  }

  const blocks = documentToNotionBlocks(document, { mindmapFileUploadId });
  const page = await withNotionRetry(() => notion.pages.create({
    parent: { type: 'data_source_id', data_source_id: dataSourceId },
    properties: {
      Name: { title: richText(document.title) },
      Topic: { rich_text: richText(document.topic) },
      Artifacts: { multi_select: artifactLabels(document.artifactTypes).map(name => ({ name })) },
      Conversation: { rich_text: richText(conversation.title || conversationId) },
      Exported: { date: { start: new Date().toISOString() } },
    },
    children: blocks.slice(0, BLOCK_BATCH_SIZE),
  }));

  for (let i = BLOCK_BATCH_SIZE; i < blocks.length; i += BLOCK_BATCH_SIZE) {
    await withNotionRetry(() => notion.blocks.children.append({
      block_id: page.id,
      children: blocks.slice(i, i + BLOCK_BATCH_SIZE),
    }));
  }

  const notionUrl = page.url || '';
  const { error } = await supabase
    .from('notion_exports')
    .insert({
      user_id: userId,
      conversation_id: conversationId,
      notion_page_id: page.id,
      notion_url: notionUrl,
      artifact_types: document.artifactTypes,
      metadata: {
        mode: normalizedMode,
        scope: normalizedScope,
        messageId,
        blockTypes,
        blockIds,
      },
    });

  if (error) {
    console.warn('[Notion] Export succeeded but history save failed:', error.message);
  }

  return {
    pageId: page.id,
    url: notionUrl,
  };
}

async function getConnection(userId, { required = true } = {}) {
  const { data, error } = await supabase
    .from('notion_connections')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (!required && error.code === 'PGRST116') return null;
    if (required && error.code === 'PGRST116') {
      throw statusError(409, 'Notion is not connected.');
    }
    throw statusError(500, `Failed to load Notion connection: ${error.message}`);
  }

  return data;
}

async function getOwnedConversation(userId, conversationId) {
  const { data, error } = await supabase
    .from('conversations')
    .select('id,title,user_id')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw statusError(404, 'Conversation not found.');
  }

  return data;
}

async function createLearningDatabase(notion) {
  return withNotionRetry(() => notion.databases.create({
    parent: { type: 'workspace', workspace: true },
    title: richText(DATABASE_TITLE),
    initial_data_source: {
      properties: {
        Name: { title: {} },
        Topic: { rich_text: {} },
        Artifacts: { multi_select: {} },
        Conversation: { rich_text: {} },
        Exported: { date: {} },
      },
    },
  }));
}

async function uploadMindmapPng(notion, dataUrl, topic) {
  const match = String(dataUrl).match(/^data:(image\/png);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid PNG data URL.');
  }

  const buffer = Buffer.from(match[2], 'base64');
  const filename = `mindmap-${slugify(topic)}.png`;
  const upload = await withNotionRetry(() => notion.fileUploads.create({
    mode: 'single_part',
    filename,
    content_type: match[1],
  }));

  const sent = await withNotionRetry(() => notion.fileUploads.send({
    file_upload_id: upload.id,
    file: {
      data: new Blob([buffer], { type: match[1] }),
      filename,
    },
  }));

  return sent.id || upload.id;
}

async function exchangeCodeForToken(code) {
  const response = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.notion.clientId}:${config.notion.clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
      'Notion-Version': config.notion.version,
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.notion.redirectUri,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw statusError(502, data.message || 'Failed to connect Notion.');
  }

  return data;
}

async function withNotionRetry(fn) {
  try {
    return await fn();
  } catch (error) {
    if (error?.status === 429) {
      const retryAfter = Number(error.headers?.['retry-after'] || error.headers?.get?.('retry-after') || 1);
      await new Promise(resolve => setTimeout(resolve, Math.max(retryAfter, 1) * 1000));
      return fn();
    }

    throw normalizeNotionError(error);
  }
}

function createNotionClient(auth) {
  return new Client({
    auth,
    notionVersion: config.notion.version,
  });
}

function assertConfigured() {
  if (!isNotionConfigured()) {
    throw statusError(
      503,
      `Notion export is not configured. Missing: ${getMissingNotionConfig().join(', ')}`
    );
  }
}

function signState(payload) {
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(body);
  return `${body}.${signature}`;
}

function verifyState(state) {
  const [body, signature] = String(state || '').split('.');
  if (!body || !signature || sign(body) !== signature) {
    throw statusError(400, 'Invalid Notion OAuth state.');
  }

  const payload = JSON.parse(base64UrlDecode(body));
  if (!payload.userId || !payload.exp || Date.now() > payload.exp) {
    throw statusError(400, 'Expired Notion OAuth state.');
  }

  return payload;
}

function sign(value) {
  return crypto
    .createHmac('sha256', config.notion.clientSecret)
    .update(value)
    .digest('base64url');
}

function encrypt(value) {
  const key = encryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map(part => part.toString('base64url')).join('.');
}

function decrypt(value) {
  const [ivRaw, tagRaw, encryptedRaw] = String(value).split('.');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(ivRaw, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

function encryptionKey() {
  return crypto
    .createHash('sha256')
    .update(config.notion.tokenEncryptionKey)
    .digest();
}

function richText(content) {
  return [{ type: 'text', text: { content: String(content || ' ') } }];
}

function normalizeArtifactTypes(artifactTypes) {
  const allowed = new Set(['learn', 'quiz', 'flashcards', 'mindmap', 'simulation', 'transcript']);
  return [...new Set((artifactTypes || []).filter(type => allowed.has(type)))];
}

function normalizeNotionError(error) {
  const message = error?.message || 'Notion API request failed.';
  return statusError(502, message);
}

function statusError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function slugify(value) {
  return String(value || 'mindmap')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'mindmap';
}

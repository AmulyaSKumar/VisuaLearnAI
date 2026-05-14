import { AzureOpenAI } from 'openai';
import { config } from '../../config/environment.js';

let client;

export function getAzureTextModel() {
  return config.azure.chatDeployment;
}

export function getAzureTextClient() {
  if (!client) {
    client = new AzureOpenAI({
      apiKey: config.azure.apiKey,
      endpoint: normalizeAzureEndpoint(config.azure.endpoint),
      apiVersion: config.azure.apiVersion,
    });
  }
  return client;
}

function normalizeAzureEndpoint(endpoint) {
  const trimmed = String(endpoint || '').trim().replace(/\/+$/, '');
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:') {
      throw new Error('AZURE_OPENAI_ENDPOINT must use https.');
    }
    return trimmed;
  } catch {
    throw new Error('AZURE_OPENAI_ENDPOINT must be a valid absolute Azure OpenAI URL.');
  }
}

export function toOpenAITools(tools = []) {
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema || tool.parameters || {
        type: 'object',
        properties: {},
      },
    },
  }));
}

export function toOpenAIMessages(messages = [], system = null) {
  const out = [];
  if (system) {
    out.push({ role: 'system', content: system });
  }

  for (const message of messages) {
    out.push(...toOpenAIMessageParts(message));
  }

  return out;
}

function toOpenAIMessageParts(message) {
  const role = normalizeRole(message.role);
  const content = message.content;

  if (Array.isArray(content)) {
    const toolCalls = content.filter(part => part?.type === 'tool_use');
    const toolResults = content.filter(part => part?.type === 'tool_result');
    const textParts = content
      .filter(part => part?.type === 'text' || typeof part?.text === 'string')
      .map(part => part.text || part.content)
      .filter(Boolean);

    const converted = [];
    if (toolCalls.length > 0) {
      converted.push({
        role: 'assistant',
        content: textParts.join('\n') || null,
        tool_calls: toolCalls.map(part => ({
          id: part.id,
          type: 'function',
          function: {
            name: part.name,
            arguments: JSON.stringify(part.input || {}),
          },
        })),
      });
    } else if (textParts.length > 0) {
      converted.push({ role, content: textParts.join('\n') });
    }

    for (const part of toolResults) {
      converted.push({
        role: 'tool',
        tool_call_id: part.tool_use_id || part.tool_call_id || 'unknown',
        content: normalizeTextContent(part.content),
      });
    }

    if (converted.length > 0) return converted;
  }

  return [{ role, content: normalizeTextContent(content) }];
}

function normalizeRole(role) {
  if (role === 'assistant' || role === 'system' || role === 'tool') return role;
  return 'user';
}

function normalizeTextContent(content) {
  if (typeof content === 'string') return content;
  if (content == null) return '';
  return JSON.stringify(content);
}

export async function createTextCompletion({
  messages,
  system = null,
  maxTokens = 4096,
  model = getAzureTextModel(),
  temperature,
  tools,
}) {
  const request = {
    model,
    messages: toOpenAIMessages(messages, system),
    max_completion_tokens: maxTokens,
  };

  if (typeof temperature === 'number') request.temperature = temperature;
  if (tools?.length) request.tools = toOpenAITools(tools);

  let response;
  try {
    response = await getAzureTextClient().chat.completions.create(request);
  } catch (error) {
    throw normalizeAzureError(error);
  }
  return response.choices?.[0]?.message?.content || '';
}

function normalizeAzureError(error) {
  const code = error?.cause?.cause?.code || error?.cause?.code || error?.code;

  if (code === 'ENOTFOUND') {
    return new Error('Azure OpenAI endpoint could not be resolved. Check AZURE_OPENAI_ENDPOINT.');
  }

  if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'ECONNRESET') {
    return new Error('Azure OpenAI connection failed. Check network access and AZURE_OPENAI_ENDPOINT.');
  }

  if (error?.status === 401 || error?.status === 403) {
    return new Error('Azure OpenAI authentication failed. Check AZURE_OPENAI_API_KEY.');
  }

  if (error?.status === 404) {
    return new Error('Azure OpenAI deployment was not found. Check AZURE_OPENAI_DEPLOYMENT.');
  }

  return error instanceof Error ? error : new Error('Azure OpenAI request failed.');
}

export async function createJsonCompletion(options) {
  const text = await createTextCompletion(options);
  return text.trim();
}

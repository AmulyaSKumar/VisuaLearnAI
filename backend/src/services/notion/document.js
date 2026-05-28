const MAX_RICH_TEXT_LENGTH = 1900;

const ARTIFACT_LABELS = {
  learn: 'Learning Notes',
  text: 'Assistant Response',
  notes: 'Notes',
  quiz: 'Quiz',
  flashcards: 'Flashcards',
  mindmap: 'Mind Map',
  simulation: 'Simulation',
  comparison: 'Comparison',
  code: 'Code Walkthrough',
  visual3d: '3D Visualization',
  transcript: 'Conversation Transcript',
};

export function buildLearningDocument({ conversation, resources, artifactTypes, messages = [] }) {
  const resourceMap = new Map(resources.map(resource => [resource.resource_type, resource]));
  const selectedResources = artifactTypes.filter(type => resourceMap.has(type));
  const includeTranscript = artifactTypes.includes('transcript') && Array.isArray(messages) && messages.length > 0;
  const selected = includeTranscript ? [...selectedResources, 'transcript'] : selectedResources;

  if (selected.length === 0) {
    return null;
  }

  const learn = resourceMap.get('learn')?.content || {};
  const title = learn.title || conversation?.title || learn.topic || 'Learning Notes';
  const firstResource = selectedResources[0] ? resourceMap.get(selectedResources[0]) : null;
  const topic = learn.topic || firstResource?.topic || conversation?.title || title;

  return {
    title,
    topic,
    conversationId: conversation.id,
    artifactTypes: selected,
    resources: resourceMap,
    messages,
  };
}

export function buildConversationDocument({
  conversation,
  messages = [],
  blockTypes = [],
  blockIds = [],
  messageId = null,
  scope = 'conversation',
}) {
  const turns = [];
  const selectedBlockTypes = new Set((blockTypes || []).filter(Boolean));
  const selectedBlockIds = new Set((blockIds || []).filter(Boolean));
  let latestUserPrompt = '';

  for (const message of messages) {
    if (message.role === 'user') {
      latestUserPrompt = message.content || message.text || '';
      continue;
    }

    if (message.role !== 'assistant') continue;
    if (messageId && String(message.id) !== String(messageId)) continue;

    const blocks = extractMessageBlocks(message, latestUserPrompt)
      .filter(block => !selectedBlockTypes.size || selectedBlockTypes.has(block.type))
      .filter(block => !selectedBlockIds.size || selectedBlockIds.has(block.id));

    if (!blocks.length) continue;

    turns.push({
      messageId: message.id,
      userPrompt: latestUserPrompt,
      assistantResponse: message.content || message.text || '',
      timestamp: message.created_at || message.timestamp || null,
      blocks,
    });
  }

  if (!turns.length) return null;

  const artifactTypes = [...new Set(turns.flatMap(turn => turn.blocks.map(block => block.type)))];
  const firstBlock = turns[0]?.blocks?.[0];
  const title = scope === 'response'
    ? firstBlock?.title || conversation?.title || 'VisuaLearn Response'
    : conversation?.title || 'VisuaLearn Conversation';

  return {
    kind: 'conversation',
    title,
    topic: conversation?.title || firstBlock?.metadata?.topic || title,
    conversationId: conversation.id,
    scope,
    artifactTypes,
    turns,
  };
}

export function documentToNotionBlocks(document, { mindmapFileUploadId = null } = {}) {
  if (document.kind === 'conversation') {
    return conversationDocumentToNotionBlocks(document);
  }

  const blocks = [
    heading(1, document.title),
    paragraph(`Topic: ${document.topic}`),
    paragraph(`Exported from VisuaLearn on ${new Date().toLocaleString('en-US')}.`),
    divider(),
  ];

  for (const artifactType of document.artifactTypes) {
    const resource = document.resources.get(artifactType);

    if (artifactType === 'transcript') {
      blocks.push(...transcriptBlocks(document.messages));
      continue;
    }

    if (!resource?.content) continue;

    if (artifactType === 'learn') {
      blocks.push(...learningBlocks(resource.content));
    } else if (artifactType === 'quiz') {
      blocks.push(...quizBlocks(resource.content));
    } else if (artifactType === 'flashcards') {
      blocks.push(...flashcardBlocks(resource.content));
    } else if (artifactType === 'mindmap') {
      blocks.push(...mindmapBlocks(resource.content, mindmapFileUploadId));
    } else if (artifactType === 'simulation') {
      blocks.push(...simulationBlocks(resource.content));
    }
  }

  return blocks.filter(Boolean);
}

export function artifactLabels(artifactTypes) {
  return artifactTypes.map(type => ARTIFACT_LABELS[type] || type);
}

function learningBlocks(content) {
  const blocks = [heading(2, 'Learning Notes')];

  if (content.summary) {
    blocks.push(heading(3, 'Overview'), ...paragraphs(content.summary));
  }

  const ideas = Array.isArray(content.key_ideas) ? content.key_ideas : [];
  for (const [index, idea] of ideas.entries()) {
    blocks.push(heading(3, `${index + 1}. ${text(idea.title, 'Key idea')}`));
    if (idea.subtitle) blocks.push(callout(idea.subtitle));
    if (idea.explanation) blocks.push(...paragraphs(idea.explanation));

    const ideaBlocks = Array.isArray(idea.blocks) ? idea.blocks : [];
    for (const block of ideaBlocks) {
      blocks.push(...learningIdeaBlock(block));
    }

    if (idea.analogy) {
      blocks.push(callout(`Analogy: ${idea.analogy}`));
    }
  }

  const takeaways = content.keyTakeaways || content.key_takeaways || [];
  if (Array.isArray(takeaways) && takeaways.length > 0) {
    blocks.push(heading(3, 'Key Takeaways'));
    for (const takeaway of takeaways) blocks.push(bullet(text(takeaway)));
  }

  return blocks;
}

function learningIdeaBlock(block = {}) {
  const blocks = [];
  if (block.title) blocks.push(heading(4, block.title));

  if (block.type === 'code') {
    if (block.code) blocks.push(codeBlock(block.code, block.language || 'plain text'));
    if (block.explanation) blocks.push(...paragraphs(block.explanation));
    return blocks;
  }

  if (block.type === 'mistake') {
    if (block.wrong) blocks.push(codeBlock(`Avoid:\n${block.wrong}`, 'plain text'));
    if (block.right) blocks.push(codeBlock(`Prefer:\n${block.right}`, 'plain text'));
    if (block.why) blocks.push(...paragraphs(block.why));
    return blocks;
  }

  if (block.type === 'comparison' && Array.isArray(block.items)) {
    for (const item of block.items) {
      blocks.push(bullet(`${text(item.name, 'Option')}: ${text(item.description)}`));
    }
    return blocks;
  }

  if (block.type === 'challenge') {
    if (block.prompt) blocks.push(callout(block.prompt));
    if (block.starter_code) blocks.push(codeBlock(block.starter_code, block.language || 'plain text'));
    return blocks;
  }

  if (block.content) blocks.push(...paragraphs(block.content));
  return blocks;
}

function quizBlocks(content) {
  const questions = Array.isArray(content.quiz) ? content.quiz : content.quiz?.questions || [];
  if (!questions.length) return [];

  return [
    heading(2, 'Quiz'),
    ...questions.map((question, index) => toggle(
      `${index + 1}. ${text(question.question || question.prompt, 'Question')}`,
      [
        ...optionBlocks(question.options),
        paragraph(`Answer: ${text(question.correct || question.answer || question.correctAnswer, 'Review the explanation')}`),
        ...(question.explanation ? paragraphs(question.explanation) : []),
      ],
    )),
  ];
}

function flashcardBlocks(content) {
  const cards = Array.isArray(content.flashcards) ? content.flashcards : content.cards || [];
  if (!cards.length) return [];

  return [
    heading(2, 'Flashcards'),
    ...cards.map((card, index) => toggle(
      `${index + 1}. ${text(card.front || card.question, 'Flashcard')}`,
      [
        paragraph(text(card.back || card.answer, 'No answer provided')),
        ...(card.difficulty ? [paragraph(`Difficulty: ${card.difficulty}`)] : []),
      ],
    )),
  ];
}

function mindmapBlocks(content, mindmapFileUploadId) {
  const mindMap = content.mind_map || content.mindmap || content;
  const blocks = [heading(2, 'Mind Map')];

  if (mindmapFileUploadId) {
    blocks.push({
      object: 'block',
      type: 'image',
      image: {
        type: 'file_upload',
        file_upload: { id: mindmapFileUploadId },
      },
    });
    return blocks;
  }

  blocks.push(callout('Mind map image export was unavailable, so the map is included as structured bullets.'));
  const root = mindMap.root || mindMap.central || 'Mind Map';
  blocks.push(bullet(root));
  for (const branch of mindMap.branches || []) {
    blocks.push(toggle(text(branch.label || branch.title, 'Branch'), (branch.children || []).map(child => bullet(text(child)))));
  }
  return blocks;
}

function simulationBlocks(content) {
  const detection = content.detection || content;
  return [
    heading(2, 'Simulation'),
    paragraph(`Topic: ${text(detection.topic, 'Not specified')}`),
    paragraph(`Domain: ${text(detection.domain, 'Not specified')}`),
    paragraph(`Simulation type: ${text(detection.simulationType, 'Not specified')}`),
    paragraph(`Intent: ${text(detection.educationalIntent, 'Not specified')}`),
  ];
}

function conversationDocumentToNotionBlocks(document) {
  const blocks = [
    heading(1, document.title),
    paragraph(`Export type: ${document.scope === 'response' ? 'Single response' : 'Normal chat conversation'}`),
    paragraph(`Exported from VisuaLearn on ${new Date().toLocaleString('en-US')}.`),
    divider(),
  ];

  for (const [index, turn] of document.turns.entries()) {
    blocks.push(heading(2, `Response ${index + 1}`));
    if (turn.userPrompt) {
      blocks.push(callout(`User prompt: ${turn.userPrompt}`));
    }
    if (turn.timestamp) {
      blocks.push(paragraph(`Time: ${new Date(turn.timestamp).toLocaleString('en-US')}`));
    }

    for (const block of turn.blocks) {
      blocks.push(...contentBlockToNotionBlocks(block));
    }
  }

  return blocks.filter(Boolean);
}

function contentBlockToNotionBlocks(block) {
  if (!block) return [];

  if (block.type === 'text' || block.type === 'notes') {
    return [
      heading(3, block.title || 'Assistant Response'),
      ...paragraphs(block.content),
    ];
  }

  if (block.type === 'learn') {
    return learningBlocks(block.content || {});
  }

  if (block.type === 'quiz') {
    return quizBlocks(block.content || {});
  }

  if (block.type === 'flashcards') {
    return flashcardBlocks(block.content || {});
  }

  if (block.type === 'mindmap') {
    return mindmapBlocks(block.content || {});
  }

  if (block.type === 'simulation' || block.type === 'visual3d') {
    return simulationBlocks(block.content || {});
  }

  if (block.type === 'comparison') {
    return comparisonBlocks(block);
  }

  if (block.type === 'code') {
    return [
      heading(3, block.title || 'Code Walkthrough'),
      codeBlock(text(block.content?.code || block.content), block.content?.language || 'plain text'),
      ...(block.content?.explanation ? paragraphs(block.content.explanation) : []),
    ];
  }

  return [
    heading(3, block.title || ARTIFACT_LABELS[block.type] || 'Learning Content'),
    ...paragraphs(block.content),
  ];
}

function extractMessageBlocks(message, sourcePrompt = '') {
  const metadata = message.metadata || {};
  if (Array.isArray(metadata.generatedBlocks) && metadata.generatedBlocks.length > 0) {
    return metadata.generatedBlocks.map((block, index) => ({
      id: block.id || block.blockId || `block_${message.id || index}_${block.type || 'content'}`,
      blockId: block.blockId || block.id || `block_${message.id || index}_${block.type || 'content'}`,
      type: block.type || 'text',
      title: block.title || titleForBlock(block.type || 'text', block.metadata?.topic || sourcePrompt),
      content: block.content ?? '',
      timestamp: block.timestamp || message.created_at || new Date().toISOString(),
      sourcePrompt: block.sourcePrompt || sourcePrompt,
      metadata: block.metadata || {},
    }));
  }

  const learningContent = metadata.learningContent || {};
  const blocks = [];
  const messageId = String(message.id || Date.now());
  const timestamp = message.created_at || message.timestamp || new Date().toISOString();
  const topic = metadata.activeTopic || metadata.decision?.activeTopic || metadata.topic || message.topic || sourcePrompt;
  const assistantText = text(message.content || message.text);

  if (assistantText) {
    blocks.push(contentBlock({
      messageId,
      type: 'text',
      title: titleForBlock('text', topic),
      content: assistantText,
      timestamp,
      sourcePrompt,
      metadata: { topic },
    }));
  }

  if (learningContent.summary || Array.isArray(learningContent.key_ideas)) {
    blocks.push(contentBlock({
      messageId,
      type: 'learn',
      title: titleForBlock('learn', topic),
      content: learningContent,
      timestamp,
      sourcePrompt,
      metadata: { topic },
    }));
  }

  if (hasQuiz(learningContent)) {
    blocks.push(contentBlock({
      messageId,
      type: 'quiz',
      title: titleForBlock('quiz', topic),
      content: learningContent,
      timestamp,
      sourcePrompt,
      metadata: { topic },
    }));
  }

  if (hasFlashcards(learningContent)) {
    blocks.push(contentBlock({
      messageId,
      type: 'flashcards',
      title: titleForBlock('flashcards', topic),
      content: learningContent,
      timestamp,
      sourcePrompt,
      metadata: { topic },
    }));
  }

  if (learningContent.mind_map || learningContent.mindmap) {
    blocks.push(contentBlock({
      messageId,
      type: 'mindmap',
      title: titleForBlock('mindmap', topic),
      content: learningContent,
      timestamp,
      sourcePrompt,
      metadata: { topic },
    }));
  }

  if (metadata.requestedArtifact === 'simulation' || metadata.decision?.simulation?.needed || learningContent.simulation) {
    blocks.push(contentBlock({
      messageId,
      type: 'simulation',
      title: titleForBlock('simulation', topic),
      content: learningContent.simulation || metadata.decision?.simulationSupport || metadata.decision || { topic },
      timestamp,
      sourcePrompt,
      metadata: { topic },
    }));
  }

  if (metadata.visual3d) {
    blocks.push(contentBlock({
      messageId,
      type: 'visual3d',
      title: titleForBlock('visual3d', topic),
      content: metadata.visual3d,
      timestamp,
      sourcePrompt,
      metadata: { topic },
    }));
  }

  return dedupeBlocks(blocks);
}

function contentBlock({ messageId, type, title, content, timestamp, sourcePrompt, metadata = {} }) {
  return {
    id: `block_${messageId}_${type}`,
    blockId: `block_${messageId}_${type}`,
    type,
    title,
    content,
    timestamp,
    sourcePrompt,
    metadata,
  };
}

function hasQuiz(content = {}) {
  const questions = Array.isArray(content.quiz) ? content.quiz : content.quiz?.questions;
  return Array.isArray(questions) && questions.length > 0;
}

function hasFlashcards(content = {}) {
  const cards = Array.isArray(content.flashcards) ? content.flashcards : content.cards;
  return Array.isArray(cards) && cards.length > 0;
}

function dedupeBlocks(blocks) {
  const seen = new Set();
  return blocks.filter(block => {
    const key = `${block.id}:${block.type}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function titleForBlock(type, topic) {
  const label = ARTIFACT_LABELS[type] || 'Learning Content';
  const cleanTopic = text(topic).trim();
  return cleanTopic ? `${cleanTopic} ${label}` : label;
}

function comparisonBlocks(block) {
  const content = block.content || {};
  const items = Array.isArray(content.items) ? content.items : [];
  const blocks = [heading(3, block.title || 'Comparison')];

  if (!items.length) {
    blocks.push(...paragraphs(content));
    return blocks;
  }

  for (const item of items) {
    blocks.push(bullet(`${text(item.name || item.title, 'Item')}: ${text(item.description || item.value)}`));
  }

  return blocks;
}

function transcriptBlocks(messages = []) {
  const visibleMessages = messages
    .filter(message => ['user', 'assistant'].includes(message.role) && text(message.content))
    .slice(-40);

  if (!visibleMessages.length) return [];

  return [
    heading(2, 'Conversation Transcript'),
    ...visibleMessages.map((message, index) => toggle(
      `${index + 1}. ${message.role === 'user' ? 'User' : 'Assistant'}`,
      paragraphs(message.content),
    )),
  ];
}

function optionBlocks(options) {
  if (!Array.isArray(options)) return [];
  return options.map((option, index) => bullet(`${String.fromCharCode(65 + index)}. ${text(option)}`));
}

function paragraphs(value) {
  const raw = text(value);
  if (!raw) return [];
  return chunkText(raw).map(chunk => paragraph(chunk));
}

function heading(level, content) {
  const type = `heading_${Math.min(Math.max(level, 1), 3)}`;
  return {
    object: 'block',
    type,
    [type]: { rich_text: richText(content) },
  };
}

function paragraph(content) {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: richText(content) },
  };
}

function bullet(content) {
  return {
    object: 'block',
    type: 'bulleted_list_item',
    bulleted_list_item: { rich_text: richText(content) },
  };
}

function toggle(content, children = []) {
  return {
    object: 'block',
    type: 'toggle',
    toggle: {
      rich_text: richText(content),
      children: children.slice(0, 50),
    },
  };
}

function callout(content) {
  return {
    object: 'block',
    type: 'callout',
    callout: {
      rich_text: richText(content),
    },
  };
}

function codeBlock(content, language = 'plain text') {
  return {
    object: 'block',
    type: 'code',
    code: {
      rich_text: richText(content),
      language: normalizeCodeLanguage(language),
    },
  };
}

function divider() {
  return { object: 'block', type: 'divider', divider: {} };
}

function richText(content) {
  const value = text(content).slice(0, MAX_RICH_TEXT_LENGTH);
  return [{ type: 'text', text: { content: value || ' ' } }];
}

function chunkText(content) {
  const chunks = [];
  const value = text(content);
  for (let i = 0; i < value.length; i += MAX_RICH_TEXT_LENGTH) {
    chunks.push(value.slice(i, i + MAX_RICH_TEXT_LENGTH));
  }
  return chunks.length ? chunks : [''];
}

function text(value, fallback = '') {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(item => text(item)).filter(Boolean).join(', ');

  for (const key of ['text', 'content', 'label', 'name', 'title', 'description', 'value']) {
    if (typeof value[key] === 'string') return value[key];
  }

  return fallback || JSON.stringify(value);
}

function normalizeCodeLanguage(language) {
  const normalized = String(language || '').toLowerCase();
  if (normalized === 'js') return 'javascript';
  if (normalized === 'ts') return 'typescript';
  if (normalized === 'py') return 'python';
  return normalized || 'plain text';
}

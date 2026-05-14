const MAX_RICH_TEXT_LENGTH = 1900;

const ARTIFACT_LABELS = {
  learn: 'Learning Notes',
  quiz: 'Quiz',
  flashcards: 'Flashcards',
  mindmap: 'Mind Map',
  simulation: 'Simulation',
  visualization: '3D View',
};

export function buildLearningDocument({ conversation, resources, artifactTypes }) {
  const resourceMap = new Map(resources.map(resource => [resource.resource_type, resource]));
  const selected = artifactTypes.filter(type => resourceMap.has(type));

  if (selected.length === 0) {
    return null;
  }

  const learn = resourceMap.get('learn')?.content || {};
  const title = learn.title || conversation?.title || learn.topic || 'Learning Notes';
  const topic = learn.topic || resourceMap.get(selected[0])?.topic || conversation?.title || title;

  return {
    title,
    topic,
    conversationId: conversation.id,
    artifactTypes: selected,
    resources: resourceMap,
  };
}

export function documentToNotionBlocks(document, { mindmapFileUploadId = null } = {}) {
  const blocks = [
    heading(1, document.title),
    paragraph(`Topic: ${document.topic}`),
    paragraph(`Exported from VisuaLearn on ${new Date().toLocaleString('en-US')}.`),
    divider(),
  ];

  for (const artifactType of document.artifactTypes) {
    const resource = document.resources.get(artifactType);
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
    } else if (artifactType === 'visualization') {
      blocks.push(...visualizationBlocks(resource.content));
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
    paragraph(`Algorithm: ${text(detection.algorithm || detection.generatorKey, 'Not specified')}`),
    paragraph(`Type: ${text(detection.type, 'Not specified')}`),
    ...(detection.reason ? paragraphs(detection.reason) : []),
  ];
}

function visualizationBlocks(content) {
  const widget = content.widget || content.visualizationWidget || content;
  return [
    heading(2, '3D View Reference'),
    paragraph(`Title: ${text(widget.title, '3D visualization')}`),
    paragraph(`Topic: ${text(widget.topic, 'Not specified')}`),
    ...(widget.description ? paragraphs(widget.description) : []),
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

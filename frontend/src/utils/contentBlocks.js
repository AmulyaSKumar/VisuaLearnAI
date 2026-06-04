export const BLOCK_LABELS = {
  text: "Assistant Response",
  learn: "Learning Notes",
  notes: "Notes",
  quiz: "Quiz",
  flashcards: "Flashcards",
  mindmap: "Mind Map",
  simulation: "Simulation",
  visual3d: "3D Visualization",
  video: "Video",
  comparison: "Comparison",
  code: "Code Walkthrough",
};

export function getMessageText(message) {
  return String(message?.text || message?.content || "").trim();
}

export function getMessageContentBlocks(message, previousUserMessage = null) {
  if (!message || message.role !== "assistant") return [];

  const metadata = message.metadata || {};
  if (Array.isArray(metadata.generatedBlocks) && metadata.generatedBlocks.length > 0) {
    return metadata.generatedBlocks.map((block, index) => ({
      id: block.id || block.blockId || `block_${message.id || index}_${block.type || "content"}`,
      blockId: block.blockId || block.id || `block_${message.id || index}_${block.type || "content"}`,
      type: block.type || "text",
      title: block.title || BLOCK_LABELS[block.type] || "Learning Content",
      content: block.content ?? "",
      timestamp: block.timestamp || message.created_at || new Date().toISOString(),
      sourcePrompt: block.sourcePrompt || getMessageText(previousUserMessage),
      metadata: block.metadata || {},
    }));
  }

  const learningContent = metadata.learningContent || {};
  const sourcePrompt = getMessageText(previousUserMessage);
  const topic = metadata.activeTopic || metadata.decision?.activeTopic || metadata.topic || message.topic || sourcePrompt;
  const timestamp = message.created_at || message.timestamp || new Date().toISOString();
  const messageId = String(message.id || timestamp);
  const blocks = [];
  const responseText = getMessageText(message);

  if (responseText) {
    blocks.push(createBlock({
      messageId,
      type: "text",
      title: titleForBlock("text", topic),
      content: responseText,
      timestamp,
      sourcePrompt,
      metadata: { topic },
    }));
  }

  if (learningContent.summary || Array.isArray(learningContent.key_ideas)) {
    blocks.push(createBlock({
      messageId,
      type: "learn",
      title: titleForBlock("learn", topic),
      content: learningContent,
      timestamp,
      sourcePrompt,
      metadata: { topic },
    }));
  }

  if (hasQuiz(learningContent)) {
    blocks.push(createBlock({
      messageId,
      type: "quiz",
      title: titleForBlock("quiz", topic),
      content: learningContent,
      timestamp,
      sourcePrompt,
      metadata: { topic },
    }));
  }

  if (hasFlashcards(learningContent)) {
    blocks.push(createBlock({
      messageId,
      type: "flashcards",
      title: titleForBlock("flashcards", topic),
      content: learningContent,
      timestamp,
      sourcePrompt,
      metadata: { topic },
    }));
  }

  if (learningContent.mind_map || learningContent.mindmap) {
    blocks.push(createBlock({
      messageId,
      type: "mindmap",
      title: titleForBlock("mindmap", topic),
      content: learningContent,
      timestamp,
      sourcePrompt,
      metadata: { topic },
    }));
  }

  if (metadata.requestedArtifact === "simulation" || metadata.decision?.simulation?.needed || learningContent.simulation) {
    blocks.push(createBlock({
      messageId,
      type: "simulation",
      title: titleForBlock("simulation", topic),
      content: learningContent.simulation || metadata.decision?.simulationSupport || metadata.decision || { topic },
      timestamp,
      sourcePrompt,
      metadata: { topic },
    }));
  }

  if (metadata.visual3d) {
    blocks.push(createBlock({
      messageId,
      type: "visual3d",
      title: titleForBlock("visual3d", topic),
      content: metadata.visual3d,
      timestamp,
      sourcePrompt,
      metadata: { topic },
    }));
  }

  if (metadata.video || metadata.requestedArtifact === "video") {
    blocks.push(createBlock({
      messageId,
      type: "video",
      title: titleForBlock("video", topic),
      content: metadata.video || { topic },
      timestamp,
      sourcePrompt,
      metadata: { topic },
    }));
  }

  return dedupeBlocks(blocks);
}

export function getAvailableBlockTypes(blocks) {
  return [...new Set((blocks || []).map(block => block.type).filter(Boolean))];
}

export function blocksToPlainText(blocks) {
  return (blocks || [])
    .map(block => {
      const content = typeof block.content === "string"
        ? block.content
        : JSON.stringify(block.content, null, 2);
      return `## ${block.title || BLOCK_LABELS[block.type] || "Content"}\n${content}`;
    })
    .join("\n\n");
}

export function downloadBlocks(blocks, filename = "visualearn-response.txt") {
  const blob = new Blob([blocksToPlainText(blocks)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function createBlock({ messageId, type, title, content, timestamp, sourcePrompt, metadata }) {
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
  const label = BLOCK_LABELS[type] || "Learning Content";
  const cleanTopic = String(topic || "").trim();
  return cleanTopic ? `${cleanTopic} ${label}` : label;
}

/**
 * Learning Content Agents
 * Split into separate agents for different content types:
 * - LearnAgent: key_ideas, summary (Learn tab)
 * - ExamplesAgent: examples (Examples tab)
 * - FlashcardsMindMapAgent: flashcards + mind_map (Flashcards & Mind Map tabs)
 * - QuizAgent: quiz questions only (Quiz tab)
 */
import { BaseAgent } from './base-agent.js';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});

const model = process.env.ANTHROPIC_MODEL ;

// ============================================
// PERSONALIZATION INSTRUCTIONS
// ============================================

const MODE_INSTRUCTIONS = {
  simple: 'Use plain language. Avoid jargon. Short sentences. Explain like the reader is a complete beginner with no prior knowledge.',
  balanced: 'Use clear explanations with some technical depth. Suitable for someone with basic programming knowledge. Balance simplicity with accuracy.',
  deep: 'Use precise technical language. Include complexity analysis, edge cases, implementation nuances, and performance considerations. Assume the reader wants comprehensive understanding.',
};

const STYLE_INSTRUCTIONS = {
  story: 'Frame each concept as a narrative. Use analogies, real-world stories, and relatable examples to explain ideas. Make it engaging like a conversation.',
  visual: 'Use structured comparisons, before/after examples, diagrams described in text, and step-by-step breakdowns with clear visual separation.',
  'step-by-step': 'Number every step explicitly. Break everything into the smallest possible sequential actions. Use ordered lists and clear progression.',
};

function getPersonalizationInstructions(profile) {
  const mode = profile?.mode || 'simple';
  const style = profile?.style || 'visual';

  const modeInstruction = MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.balanced;
  const styleInstruction = STYLE_INSTRUCTIONS[style] || STYLE_INSTRUCTIONS.visual;

  return `
CONTENT MODE: ${mode.toUpperCase()}
${modeInstruction}

CONTENT STYLE: ${style.toUpperCase()}
${styleInstruction}
`.trim();
}

// ============================================
// JSON PARSING UTILITIES
// ============================================

function stripMarkdownFences(text) {
  let cleanedText = text.trim();

  // Handle ```json blocks with closing fence
  const jsonFenceMatch = cleanedText.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonFenceMatch) {
    return jsonFenceMatch[1].trim();
  }

  // Handle generic ``` blocks with closing fence
  const genericFenceMatch = cleanedText.match(/```\s*([\s\S]*?)\s*```/);
  if (genericFenceMatch) {
    return genericFenceMatch[1].trim();
  }

  // Fallback: strip leading fences (handles missing closing fence)
  // Match ```json or ```JSON or ``` followed by optional whitespace/newlines
  cleanedText = cleanedText.replace(/^```(?:json|JSON)?\s*\n?/, '');

  // Strip trailing fence if present
  cleanedText = cleanedText.replace(/\n?```\s*$/, '');

  return cleanedText.trim();
}

function extractJsonObject(text) {
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }
  return text.slice(firstBrace, lastBrace + 1);
}

function extractJsonArray(text) {
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  if (firstBracket === -1 || lastBracket === -1 || lastBracket <= firstBracket) {
    return null;
  }
  return text.slice(firstBracket, lastBracket + 1);
}

function repairJsonString(text) {
  if (!text) return text;
  return text
    // Remove trailing commas
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']')
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Replace tabs with spaces
    .replace(/\t/g, '  ')
    // Fix common escape issues - unescaped newlines inside strings
    // This is tricky - we try to fix obvious cases
    .replace(/:\s*"([^"]*)\n([^"]*)"(?=\s*[,}\]])/g, ': "$1\\n$2"')
    // Remove control characters except newlines
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F]/g, '')
    .trim();
}

/**
 * Attempt to complete truncated JSON by balancing braces/brackets
 * This is a best-effort recovery for max_tokens truncation
 */
function completeTruncatedJson(text) {
  if (!text) return text;

  let result = text.trim();

  // Track open structures
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let lastChar = '';

  for (let i = 0; i < result.length; i++) {
    const char = result[i];

    // Track string state (skip escaped quotes)
    if (char === '"' && lastChar !== '\\') {
      inString = !inString;
    }

    if (!inString) {
      if (char === '{') openBraces++;
      else if (char === '}') openBraces--;
      else if (char === '[') openBrackets++;
      else if (char === ']') openBrackets--;
    }

    lastChar = char;
  }

  // If we're mid-string, close it
  if (inString) {
    result += '"';
  }

  // Remove trailing incomplete values (like `"title": "Some incomp`)
  // Look for incomplete key-value pairs at the end
  result = result.replace(/,\s*"[^"]*":\s*"[^"]*$/g, '');
  result = result.replace(/,\s*"[^"]*":\s*$/g, '');
  result = result.replace(/,\s*"[^"]*$/g, '');
  result = result.replace(/,\s*$/g, '');

  // Close any open brackets/braces
  while (openBrackets > 0) {
    result += ']';
    openBrackets--;
  }
  while (openBraces > 0) {
    result += '}';
    openBraces--;
  }

  return result;
}

function parseJsonResponse(text) {
  const rawText = text || '';

  // Strategy 1: Direct parse
  try {
    return JSON.parse(rawText);
  } catch {
    // Continue to next strategy
  }

  // Strategy 2: Extract from markdown fences
  const stripped = stripMarkdownFences(rawText);
  try {
    return JSON.parse(stripped);
  } catch {
    // Continue to next strategy
  }

  // Strategy 2.5: Try repaired stripped text
  const repairedStripped = repairJsonString(stripped);
  try {
    return JSON.parse(repairedStripped);
  } catch {
    // Continue to next strategy
  }

  // Strategy 3: Extract outermost { } block
  const objectBlock = extractJsonObject(repairedStripped);
  if (objectBlock) {
    try {
      return JSON.parse(objectBlock);
    } catch {
      // Try with repairs
      try {
        return JSON.parse(repairJsonString(objectBlock));
      } catch {
        // Continue to next strategy
      }
    }
  }

  // Strategy 4: Extract outermost [ ] block
  const arrayBlock = extractJsonArray(repairedStripped);
  if (arrayBlock) {
    try {
      return JSON.parse(arrayBlock);
    } catch {
      // Try with repairs
      try {
        return JSON.parse(repairJsonString(arrayBlock));
      } catch {
        // Continue to next strategy
      }
    }
  }

  // Strategy 5: Deep scan for valid JSON object (brace matching)
  let braceCount = 0;
  let startIndex = -1;
  for (let i = 0; i < repairedStripped.length; i++) {
    const char = repairedStripped[i];
    if (char === '{') {
      if (braceCount === 0) startIndex = i;
      braceCount++;
    } else if (char === '}') {
      braceCount--;
      if (braceCount === 0 && startIndex !== -1) {
        const candidate = repairedStripped.slice(startIndex, i + 1);
        try {
          return JSON.parse(repairJsonString(candidate));
        } catch {
          // Reset and keep scanning
          startIndex = -1;
        }
      }
    }
  }

  // Strategy 6: Try to complete truncated JSON (for max_tokens truncation)
  const completedJson = completeTruncatedJson(repairedStripped);
  try {
    const result = JSON.parse(completedJson);
    console.warn('parseJsonResponse: Recovered truncated JSON - response may be incomplete');
    return result;
  } catch {
    // Continue to error
  }

  // Strategy 7: Extract first valid JSON object from repaired + completed text
  const completedObjectBlock = extractJsonObject(completedJson);
  if (completedObjectBlock) {
    try {
      const result = JSON.parse(repairJsonString(completedObjectBlock));
      console.warn('parseJsonResponse: Recovered truncated JSON object - response may be incomplete');
      return result;
    } catch {
      // Continue to error
    }
  }

  // All strategies failed - throw with debug info
  const preview = rawText.substring(0, 300).replace(/\n/g, '\\n');
  const endPreview = rawText.length > 300 ? rawText.substring(rawText.length - 100).replace(/\n/g, '\\n') : '';
  const startsWithFence = rawText.trim().startsWith('```');
  const endsWithFence = rawText.trim().endsWith('```');
  throw new Error(`Failed to parse JSON response. Start preview: ${preview}${endPreview ? ` | End preview: ${endPreview}` : ''} | Fence detected: start=${startsWithFence} end=${endsWithFence}`);
}

// ============================================
// RAG CONTEXT HELPER - STRICT GROUNDING
// ============================================

/**
 * Format chunks with page references for better grounding
 */
function formatChunksForPrompt(chunks) {
  if (!chunks || chunks.length === 0) return null;

  return chunks.map((chunk, idx) => {
    const pageRef = chunk.page_number ? ` (Page ${chunk.page_number})` : '';
    const similarity = chunk.similarity ? ` [Relevance: ${Math.round(chunk.similarity * 100)}%]` : '';
    return `[Source ${idx + 1}${pageRef}${similarity}]\n${chunk.text}`;
  }).join('\n\n---\n\n');
}

/**
 * Check if we have valid chunks for RAG
 * Returns error message if no chunks, null if OK
 */
function validateRAGContext(chunks, documentContext) {
  if (!chunks || chunks.length === 0) {
    if (!documentContext) {
      return "No relevant information found in your document for this query.";
    }
  }
  return null;
}

/**
 * Build BALANCED RAG system prompt - grounded but allows natural explanation
 */
function buildRAGSystemPrompt(basePrompt, hasDocumentContext) {
  if (!hasDocumentContext) return basePrompt;

  // BALANCED GROUNDING - stay grounded but explain naturally
  return `You are an AI tutor creating learning content based on a provided document.

GROUNDING RULES:
1. Use ONLY information from the provided document context
2. You MAY rephrase, simplify, and explain concepts in your own words
3. You MAY make reasonable inferences from what's in the document
4. You must NOT add NEW facts, statistics, or claims not supported by the document
5. If the document doesn't cover a topic at all, say: "This topic is not covered in the uploaded document."
6. When possible, reference which Source/Page supports your explanation

WHAT'S ALLOWED:
- Explaining document concepts in simpler terms
- Drawing connections between ideas IN the document
- Inferring obvious conclusions from stated facts
- Using analogies to clarify document content

WHAT'S NOT ALLOWED:
- Adding facts not in the document
- Citing statistics not mentioned
- Expanding beyond document scope
- Making claims the document doesn't support

${basePrompt}`;
}

/**
 * Build RAG user message with balanced formatting
 */
function buildRAGUserMessage(query, documentContext, chunks) {
  if (!documentContext) {
    return `Generate comprehensive learning content for: "${query}"`;
  }

  // Format chunks with proper structure
  const formattedContext = chunks ? formatChunksForPrompt(chunks) : documentContext;

  return `Create learning content based on this document. You may explain and rephrase, but stay grounded in the document.

=== DOCUMENT CONTEXT ===
${formattedContext}
=== END DOCUMENT CONTEXT ===

Topic: "${query}"

Instructions:
1. Base your content on the document above
2. Explain concepts clearly - you can rephrase and simplify
3. Make reasonable inferences from what's stated
4. If a topic isn't covered, say "This topic is not covered in the uploaded document"
5. Reference Sources when possible (e.g., "As explained in Source 1...")
6. DO NOT invent facts or statistics not in the document

Generate educational content:`;
}

/**
 * Create a "no content found" response for RAG failures
 */
function createRAGFallbackResponse(query) {
  return {
    topic: query,
    title: `Unable to Generate Content`,
    summary: "No relevant information was found in the uploaded document for this query.",
    key_ideas: [],
    difficulty_level: 'intermediate',
    estimated_time: 0,
    prerequisites: [],
    skill_areas: [],
    next_topics: [],
    image_search_keywords: [],
    _ragError: true,
    _ragMessage: "This information is not present in the uploaded document. Please try a different query or upload a document that covers this topic."
  };
}

// ============================================
// LEARN AGENT (key_ideas + summary)
// ============================================

export class LearnAgent extends BaseAgent {
  constructor() {
    super('learn-content', 'Generates key concepts and summary for Learn tab', '1.0.0');
  }

  async execute(input, context = {}) {
    const { query, profile = {}, documentContext, contextChunks, webSearchContext, webSearchEnabled } = input;
    if (!query) throw new Error('Query is required');

    const learningLevel = profile.comprehension_level || profile.knowledge_level || 'intermediate';
    const learningStyle = profile.learning_style || 'visual';
    const hasRAGContext = !!documentContext || (contextChunks && contextChunks.length > 0);
    const hasWebSearchContext = !!webSearchContext;

    // STRICT RAG VALIDATION: If document was selected but no chunks found, return fallback
    if (input.documentId && !hasRAGContext) {
      console.warn(`LearnAgent: Document ${input.documentId} selected but no context retrieved`);
      return createRAGFallbackResponse(query);
    }

    const personalization = getPersonalizationInstructions(profile);

    const generateContent = async (retryCount = 0) => {
      // For Web Search mode: use web search results as authoritative source
      // For RAG mode: simpler prompt focused on document extraction
      const baseSystemPrompt = hasWebSearchContext
        ? `You are an educational content generator that creates learning materials based on CURRENT WEB INFORMATION.
User Level: ${learningLevel}, Style: ${learningStyle}

${personalization}

FOR WEB-SOURCED CONTENT:
1. Use the provided web search results as your PRIMARY source of information
2. Generate explanations based on the most recent and relevant web content
3. Cite sources when possible (e.g., "According to [Source]...")
4. If the web results contain code examples, include them with proper attribution
5. Focus on accuracy and up-to-date information from the web sources
6. If the web results are insufficient, supplement with your knowledge but prioritize web-sourced information

CRITICAL: Respond with RAW JSON only. No explanation, no preamble, no markdown fences. Start with { and end with }.`
        : hasRAGContext
        ? `You are an educational content generator that creates learning materials STRICTLY from provided document content.
User Level: ${learningLevel}, Style: ${learningStyle}

${personalization}

FOR DOCUMENT-BASED CONTENT:
1. Extract key concepts ONLY from the document
2. Generate explanations using ONLY document information
3. Create code examples ONLY if code appears in the document
4. If the document doesn't contain enough for a section, say "Not covered in document"
5. Reference which part of the document (Source/Page) each concept comes from

CRITICAL: Respond with RAW JSON only. No explanation, no preamble, no markdown fences. Start with { and end with }.`
        : `You are an expert educational content generator specializing in programming and computer science.
User Level: ${learningLevel}, Style: ${learningStyle}

${personalization}

ABSOLUTE REQUIREMENTS - FAILURE TO COMPLY IS UNACCEPTABLE:
1. You MUST generate EXACTLY 6 key_ideas (not 3, not 4, EXACTLY 6)
2. For ANY programming/CS/algorithm topic: EVERY key_idea MUST have a "code" block with REAL, RUNNABLE code
3. EVERY key_idea MUST have ALL 4 block types: concept, code, mistake, insight
4. Generic/vague explanations are REJECTED - be specific with actual code and examples
5. Titles must be SPECIFIC to the topic (BANNED: "Core Concept", "How to study it", "Practical applications", "Getting started")

EXAMPLES OF BAD VS GOOD TITLES:
- BAD: "Core concept" → GOOD: "The Comparison and Swap Mechanism"
- BAD: "How to study it" → GOOD: "Implementing the Inner Loop Logic"
- BAD: "Practical applications" → GOOD: "Optimizing with Early Termination"

CRITICAL: Respond with RAW JSON only. No explanation, no preamble, no markdown fences. Start with { and end with }.`;

      const systemPrompt = hasWebSearchContext ? baseSystemPrompt : buildRAGSystemPrompt(baseSystemPrompt, hasRAGContext);

      // Build user message based on context type
      let userMessagePrefix;
      if (hasWebSearchContext) {
        userMessagePrefix = `Create learning content based on these web search results. Use the information from the web to provide accurate, up-to-date content.

${webSearchContext}

Topic: "${query}"

Instructions:
1. Base your content primarily on the web search results above
2. Explain concepts clearly using information from the sources
3. If sources disagree, present the most authoritative/recent view
4. Cite sources when making specific claims
5. Generate comprehensive learning content`;
      } else {
        userMessagePrefix = buildRAGUserMessage(query, documentContext, contextChunks);
      }

      const response = await client.messages.create({
        model,
        max_tokens: 16000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `${userMessagePrefix}

Return JSON with this EXACT structure:
{
  "topic": "${query}",
  "title": "Mastering ${query}: A Complete Guide",
  "summary": "2-3 sentences explaining WHY this topic matters and what the learner will be able to do after completing this",
  "estimated_time": 25,
  "difficulty_level": "beginner|intermediate|advanced",
  "prerequisites": ["prerequisite 1", "prerequisite 2"],
  "key_ideas": [
    {
      "id": "concept_1",
      "title": "SPECIFIC title about ${query} (e.g., 'The Comparison Mechanism' not 'Core Concept')",
      "subtitle": "One compelling sentence hook explaining what this concept covers",
      "difficulty": "foundational",
      "time_estimate": 4,
      "blocks": [
        {
          "type": "concept",
          "title": "Understanding [Specific Aspect of ${query}]",
          "content": "DETAILED 3-paragraph explanation. Paragraph 1: What is this specific aspect and why it matters. Paragraph 2: How it works step-by-step with concrete examples. Paragraph 3: When and why to use this approach. MINIMUM 150 words."
        },
        {
          "type": "code",
          "title": "Implementation: [Specific aspect]",
          "language": "javascript",
          "code": "// Complete, runnable implementation\\nfunction specificFunction(arr) {\\n  // Actual working code with comments\\n  for (let i = 0; i < arr.length; i++) {\\n    // Real implementation logic\\n  }\\n  return result;\\n}\\n\\n// Example usage with output\\nconst data = [5, 2, 8, 1, 9];\\nconsole.log(specificFunction(data)); // Output: [1, 2, 5, 8, 9]",
          "explanation": "Line-by-line breakdown: Line 1 does X because Y. Line 2 handles Z. The loop iterates through... This produces output..."
        },
        {
          "type": "mistake",
          "title": "Common Mistake: [Specific error name]",
          "wrong": "// WRONG: [Description of what's wrong]\\nfunction buggyVersion(arr) {\\n  // Code with actual bug\\n  for (let i = 0; i <= arr.length; i++) { // Bug: off-by-one\\n    // ...\\n  }\\n}",
          "right": "// CORRECT: [Why this is correct]\\nfunction fixedVersion(arr) {\\n  for (let i = 0; i < arr.length; i++) { // Fixed: proper boundary\\n    // ...\\n  }\\n}",
          "why": "The wrong approach fails because [specific reason]. This causes [specific problem like index out of bounds]. The correct version fixes this by [specific fix]."
        },
        {
          "type": "insight",
          "title": "Pro Tip: [Specific insight name]",
          "content": "Advanced insight that experienced developers know: [specific performance tip, edge case handling, or best practice]. For example, in production code you should [specific recommendation]."
        }
      ]
    }
  ],
  "skill_areas": [
    { "name": "Fundamentals", "weight": 0.3, "concepts": ["concept_1", "concept_2"] },
    { "name": "Implementation", "weight": 0.4, "concepts": ["concept_3", "concept_4"] },
    { "name": "Optimization", "weight": 0.3, "concepts": ["concept_5", "concept_6"] }
  ],
  "next_topics": ["Related topic 1", "Related topic 2", "Related topic 3"],
  "image_search_keywords": ["${query} diagram", "${query} visualization", "${query} step by step"]
}

MANDATORY CHECKLIST - VERIFY BEFORE RESPONDING:
[ ] Exactly 6 key_ideas generated
[ ] Every title is SPECIFIC to ${query} (no generic titles)
[ ] Every key_idea has concept, code, mistake, and insight blocks
[ ] Every code block has RUNNABLE code with example usage
[ ] Every mistake block has BOTH wrong AND right code
[ ] Content progresses from foundational to advanced`
        }]
      });

      // Check for truncation due to max_tokens
      if (response.stop_reason === 'max_tokens') {
        console.warn(`LearnAgent: Response truncated (stop_reason=max_tokens). Output may be incomplete.`);
      }

      const text = response.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
      const result = parseJsonResponse(text);

      // Validate and retry if insufficient
      if (!result.key_ideas || result.key_ideas.length < 5) {
        console.warn(`LearnAgent: Only ${result.key_ideas?.length || 0} key_ideas generated, expected 5+`);
        if (retryCount < 1) {
          console.log('LearnAgent: Retrying with stricter prompt...');
          return generateContent(retryCount + 1);
        }
      }

      // Validate that each key_idea has required blocks
      result.key_ideas?.forEach((idea, idx) => {
        if (!idea.blocks || idea.blocks.length < 4) {
          console.warn(`LearnAgent: key_idea ${idx} has only ${idea.blocks?.length || 0} blocks, expected 4`);
        }
        const hasCode = idea.blocks?.some(b => b.type === 'code');
        if (!hasCode) {
          console.warn(`LearnAgent: key_idea ${idx} missing code block`);
        }
      });

      return result;
    };

    return generateContent();
  }
}

// ============================================
// EXAMPLES AGENT
// ============================================

export class ExamplesAgent extends BaseAgent {
  constructor() {
    super('examples-content', 'Generates real-world examples for Examples tab', '1.0.0');
  }

  async execute(input, context = {}) {
    const { query, profile = {}, documentContext, contextChunks } = input;
    if (!query) throw new Error('Query is required');

    const personalization = getPersonalizationInstructions(profile);
    const hasRAGContext = !!documentContext || (contextChunks && contextChunks.length > 0);

    // STRICT RAG VALIDATION
    if (input.documentId && !hasRAGContext) {
      console.warn(`ExamplesAgent: Document ${input.documentId} selected but no context retrieved`);
      return { examples: [], _ragError: true, _ragMessage: "No relevant examples found in the uploaded document." };
    }

    const baseSystemPrompt = hasRAGContext
      ? `You are an expert at creating examples STRICTLY based on provided document content.

${personalization}

STRICT DOCUMENT-BASED RULES:
1. Create examples ONLY from concepts found in the document
2. DO NOT invent scenarios not mentioned in the document
3. If the document has code examples, use those; otherwise say "No code examples in document"
4. Reference which Source/Page each example comes from

CRITICAL: Respond with RAW JSON only. No explanation, no preamble, no markdown fences. Start with { and end with }.`
      : `You are an expert at creating real-world, practical examples for programming concepts.

${personalization}

ABSOLUTE REQUIREMENTS:
1. Every example title MUST describe a SPECIFIC real-world application (e.g., "Sorting Product Prices on Amazon" NOT "Sorting Example")
2. BANNED GENERIC TITLES: "Starter example", "Basic usage", "Learning scenario", "Practical application", "Simple example", "Getting started"
3. Each example MUST include working code that actually demonstrates ${query}
4. For pure CS/algorithm topics: involves_ai MUST be false (algorithms are NOT AI)
5. search_keywords MUST contain specific searchable terms like "${query} tutorial", "${query} use case [domain]"

TITLE EXAMPLES:
- BANNED: "Starter example" → USE: "Sorting Player Scores in a Mobile Game"
- BANNED: "Basic usage" → USE: "Organizing Contacts Alphabetically in a Phone App"
- BANNED: "Practical application" → USE: "Ranking Search Results by Relevance"

CRITICAL: Respond with RAW JSON only. No explanation, no preamble, no markdown fences. Start with { and end with }.`;

    const systemPrompt = buildRAGSystemPrompt(baseSystemPrompt, hasRAGContext);
    const userMessagePrefix = hasRAGContext
      ? buildRAGUserMessage(`Generate examples for: "${query}"`, documentContext, contextChunks)
      : `Generate 6 specific, real-world examples for: "${query}"`;

    const response = await client.messages.create({
      model,
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `${userMessagePrefix}

Return JSON with this structure:
{
  "examples": [
    {
      "id": "ex_1",
      "title": "Sorting Product Prices on an E-commerce Site",
      "description": "How ${query} helps users find the cheapest products by ordering items from low to high price",
      "scenario": "You're building a product listing page for an online store. Users click 'Sort by Price: Low to High' and expect to see the cheapest items first. Here's how ${query} makes this work...",
      "code": "// Sort products by price using ${query}\\nfunction sortProductsByPrice(products) {\\n  const n = products.length;\\n  for (let i = 0; i < n - 1; i++) {\\n    for (let j = 0; j < n - i - 1; j++) {\\n      if (products[j].price > products[j + 1].price) {\\n        [products[j], products[j + 1]] = [products[j + 1], products[j]];\\n      }\\n    }\\n  }\\n  return products;\\n}\\n\\n// Example\\nconst products = [\\n  { name: 'Laptop', price: 999 },\\n  { name: 'Phone', price: 699 },\\n  { name: 'Tablet', price: 449 }\\n];\\nconsole.log(sortProductsByPrice(products));\\n// Output: [{ name: 'Tablet', price: 449 }, { name: 'Phone', price: 699 }, { name: 'Laptop', price: 999 }]",
      "language": "javascript",
      "explanation": "The function iterates through the product array, comparing adjacent prices and swapping if needed. After each pass, the highest-priced item 'bubbles up' to the end.",
      "real_world_context": "E-commerce platforms like Amazon and eBay use sorting algorithms to let users organize products by price, rating, or date added",
      "search_keywords": ["${query} ecommerce sorting", "${query} price sorting tutorial", "how to sort products javascript"],
      "involves_ai": false,
      "buggy_version": "// BUG: Compares wrong indices\\nfunction buggySort(products) {\\n  for (let i = 0; i < products.length; i++) {\\n    for (let j = 0; j < products.length; j++) { // Bug: should be j < n - i - 1\\n      if (products[j].price > products[j + 1].price) { // Causes undefined error\\n        [products[j], products[j + 1]] = [products[j + 1], products[j]];\\n      }\\n    }\\n  }\\n}",
      "bug_explanation": "The inner loop goes beyond array bounds, causing 'products[j + 1]' to be undefined. The fix is to limit the inner loop to 'j < n - i - 1'.",
      "challenge_question": "What would happen if we sorted by rating instead of price?",
      "challenge_options": ["Change price to rating in comparison", "Add a new loop", "Use a different algorithm", "It's not possible"]
    }
  ]
}

MANDATORY FOR EACH EXAMPLE:
1. title: Specific real-world scenario name (NOT generic)
2. description: Explains HOW ${query} solves the specific problem
3. scenario: Full context story (You're building... Users need... Here's how...)
4. code: Complete runnable code with comments and example output
5. real_world_context: Which companies/apps use this pattern
6. search_keywords: 3 specific searchable phrases for learning more
7. involves_ai: false for pure algorithms/CS concepts, true ONLY if ML/AI is genuinely used
8. buggy_version: Code with a common bug
9. bug_explanation: What's wrong and how to fix it
10. challenge_question: A quiz question about modifying this example
11. challenge_options: 4 answer options for the challenge

Generate 6 examples covering different domains:
1. E-commerce/shopping
2. Gaming/leaderboards
3. Social media/contacts
4. Music/playlists
5. Data analysis/spreadsheets
6. System/file management`
      }]
    });

    const text = response.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
    return parseJsonResponse(text);
  }
}

// ============================================
// QUIZ AGENT (quiz questions only)
// ============================================

export class QuizAgent extends BaseAgent {
  constructor() {
    super('quiz-content', 'Generates quiz questions only', '1.0.0');
  }

  async execute(input, context = {}) {
    const { query, profile = {}, documentContext, contextChunks } = input;
    if (!query) throw new Error('Query is required');

    const personalization = getPersonalizationInstructions(profile);
    const hasRAGContext = !!documentContext || (contextChunks && contextChunks.length > 0);

    // STRICT RAG VALIDATION
    if (input.documentId && !hasRAGContext) {
      console.warn(`QuizAgent: Document ${input.documentId} selected but no context retrieved`);
      return { quiz: [], _ragError: true, _ragMessage: "No content found in the uploaded document to create quiz questions." };
    }

    const baseSystemPrompt = hasRAGContext
      ? `You are an expert at creating quiz questions STRICTLY based on provided document content.

${personalization}

STRICT DOCUMENT-BASED RULES:
1. Create questions ONLY about information explicitly stated in the document
2. DO NOT test knowledge outside the document content
3. Every question must be answerable from the document alone
4. Reference which Source/Page the answer can be found in
5. If the document doesn't have enough content, create fewer questions rather than making things up

CRITICAL: Respond with RAW JSON only. No explanation, no preamble, no markdown fences. Start with { and end with }.`
      : `You are an expert at creating educational quiz questions for programming topics.
Focus on practical understanding, not trivia.

${personalization}

CRITICAL: Respond with RAW JSON only. No explanation, no preamble, no markdown fences. Start with { and end with }.`;

    const systemPrompt = buildRAGSystemPrompt(baseSystemPrompt, hasRAGContext);
    const userMessagePrefix = hasRAGContext
      ? buildRAGUserMessage(`Generate quiz questions for: "${query}"`, documentContext, contextChunks)
      : `Generate quiz questions for: "${query}"`;

    const response = await client.messages.create({
      model,
      max_tokens: 8000,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `${userMessagePrefix}

Return JSON:
{
  "quiz": [
    {
      "type": "mcq",
      "question": "Specific question about ${query}",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": "A",
      "explanation": "Detailed explanation of why A is correct and others are wrong",
      "why_it_matters": "Real-world situation where understanding this matters"
    },
    {
      "type": "fill_blank",
      "question": "The ___ of ${query} determines...",
      "blank_position": "middle",
      "correct_answer": "specific term",
      "hint": "Think about...",
      "explanation": "Full explanation"
    },
    {
      "type": "true_false",
      "statement": "Statement about ${query}",
      "correct": true,
      "explanation": "Why this is true/false with examples"
    },
    {
      "type": "output_prediction",
      "code": "// Code using ${query}\\nfunction test() {\\n  // implementation\\n  return result;\\n}\\nconsole.log(test());",
      "language": "javascript",
      "options": ["Output A", "Output B", "Output C", "Error"],
      "correct": "Output A",
      "explanation": "Step-by-step trace of what the code does"
    },
    {
      "type": "code_sandbox",
      "task": "Implement ${query} to solve: [specific problem]",
      "language": "javascript",
      "starter_code": "function solve(input) {\\n  // Your code here\\n  \\n}",
      "solution": "function solve(input) {\\n  // Complete solution\\n  return result;\\n}",
      "validation_keywords": ["keyword1", "keyword2"],
      "hints": ["Start by...", "Remember to..."]
    }
  ]
}

REQUIREMENTS:
- Generate 15-20 quiz questions total:
  - 5-6 MCQ (multiple choice)
  - 4 fill_blank (fill in the blank)
  - 2 true_false
  - 3-4 output_prediction (predict code output)
  - 2-3 code_sandbox (write code)
- Progress from easy to hard
- Every question must be specifically about ${query}
- Code examples must be runnable`
      }]
    });

    const text = response.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
    return parseJsonResponse(text);
  }
}

// ============================================
// FLASHCARDS + MIND MAP AGENT
// ============================================

export class FlashcardsMindMapAgent extends BaseAgent {
  constructor() {
    super('flashcards-mindmap', 'Generates flashcards and mind map together', '1.0.0');
  }

  async execute(input, context = {}) {
    const { query, profile = {}, documentContext, contextChunks } = input;
    if (!query) throw new Error('Query is required');

    const personalization = getPersonalizationInstructions(profile);
    const hasRAGContext = !!documentContext || (contextChunks && contextChunks.length > 0);

    // STRICT RAG VALIDATION
    if (input.documentId && !hasRAGContext) {
      console.warn(`FlashcardsMindMapAgent: Document ${input.documentId} selected but no context retrieved`);
      return {
        flashcards: [],
        mind_map: { root: query, branches: [] },
        _ragError: true,
        _ragMessage: "No content found in the uploaded document to create flashcards or mind map."
      };
    }

    const generateContent = async (retryCount = 0) => {
      const baseSystemPrompt = hasRAGContext
        ? `You are an expert at creating study materials STRICTLY from provided document content.

${personalization}

STRICT DOCUMENT-BASED RULES:
1. Extract flashcard content ONLY from the document
2. Mind map branches must reflect ONLY topics covered in the document
3. DO NOT add concepts not present in the document
4. Reference which Source/Page each flashcard/branch comes from
5. If document has limited content, create fewer items rather than inventing

CRITICAL: Respond with RAW JSON only. No explanation, no preamble, no markdown fences. Start with { and end with }.`
        : `You are an expert at creating study materials: flashcards and mind maps.

${personalization}

ABSOLUTE REQUIREMENTS FOR MIND MAP:
1. EXACTLY 6 main branches (not 3, not 4, EXACTLY 6)
2. EVERY branch MUST have EXACTLY 4 children (not 2, EXACTLY 4)
3. Branch labels must be specific to ${query}
4. Children must contain actual content, not placeholders

For algorithm topics, use these 6 branches:
1. "How It Works" - 4 steps of the algorithm
2. "Time Complexity" - Best/Average/Worst/Comparison
3. "Space Complexity" - In-place/Auxiliary/Stack/Trade-offs
4. "Use Cases" - 4 real-world scenarios
5. "Variations & Optimizations" - 4 variations
6. "Common Pitfalls" - 4 common mistakes

CRITICAL: Respond with RAW JSON only. No explanation, no preamble, no markdown fences. Start with { and end with }.`;

      const systemPrompt = buildRAGSystemPrompt(baseSystemPrompt, hasRAGContext);
      const userMessagePrefix = hasRAGContext
        ? buildRAGUserMessage(`Generate flashcards and mind map for: "${query}"`, documentContext, contextChunks)
        : `Generate flashcards and mind map for: "${query}"`;

      const response = await client.messages.create({
        model,
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `${userMessagePrefix}

Return JSON:
{
  "flashcards": [
    { "front": "What is ${query}?", "back": "Detailed definition with key characteristics", "difficulty": "beginner" },
    { "front": "What is the time complexity of ${query}?", "back": "O(n²) because the algorithm uses nested loops - outer loop runs n times, inner loop runs up to n times", "difficulty": "intermediate" },
    { "front": "When should you use ${query} over other algorithms?", "back": "Best for: small datasets, nearly sorted data, when simplicity matters. Avoid for: large datasets, performance-critical apps", "difficulty": "advanced" }
  ],
  "mind_map": {
    "root": "${query}",
    "branches": [
      {
        "label": "How It Works",
        "children": [
          "Step 1: Compare adjacent elements",
          "Step 2: Swap if out of order",
          "Step 3: Move to next pair",
          "Step 4: Repeat until sorted"
        ]
      },
      {
        "label": "Time Complexity",
        "children": [
          "Best Case: O(n) - already sorted",
          "Average Case: O(n²)",
          "Worst Case: O(n²) - reverse sorted",
          "Comparisons: n(n-1)/2"
        ]
      },
      {
        "label": "Space Complexity",
        "children": [
          "In-place: O(1) extra space",
          "No auxiliary array needed",
          "Swap uses temp variable",
          "Memory efficient"
        ]
      },
      {
        "label": "Real-World Use Cases",
        "children": [
          "Sorting small arrays (<50 elements)",
          "Teaching sorting concepts",
          "Nearly sorted data",
          "Embedded systems with limited memory"
        ]
      },
      {
        "label": "Variations & Optimizations",
        "children": [
          "Optimized: early termination flag",
          "Cocktail sort: bidirectional",
          "Comb sort: gap sequence",
          "Odd-even sort: parallel variant"
        ]
      },
      {
        "label": "Common Pitfalls",
        "children": [
          "Off-by-one in loop bounds",
          "Forgetting to optimize inner loop",
          "Using for large datasets",
          "Not handling empty arrays"
        ]
      }
    ]
  }
}

MANDATORY REQUIREMENTS:

FLASHCARDS (generate exactly 15):
- 5 beginner: basic definitions, simple "what is" questions
- 5 intermediate: "how does it work", "what is the complexity", comparisons
- 5 advanced: edge cases, optimizations, when-to-use decisions

MIND MAP (CRITICAL - DO NOT VIOLATE):
- EXACTLY 6 branches (this is mandatory, no exceptions)
- EVERY branch has EXACTLY 4 children (not 2, not 3, EXACTLY 4)
- All content must be specific to ${query}
- No placeholder text like "Step 1: ..." or "Example 1"`
        }]
      });

      const text = response.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
      const result = parseJsonResponse(text);

      // Validate mind map branches and retry if insufficient
      const branchCount = result.mind_map?.branches?.length || 0;
      if (branchCount < 5) {
        console.warn(`FlashcardsMindMapAgent: Only ${branchCount} branches, expected 6`);
        if (retryCount < 1) {
          console.log('FlashcardsMindMapAgent: Retrying with stricter prompt...');
          return generateContent(retryCount + 1);
        }
      }

      // Validate each branch has enough children
      result.mind_map?.branches?.forEach((branch, idx) => {
        if (!branch.children || branch.children.length < 3) {
          console.warn(`FlashcardsMindMapAgent: Branch ${idx} (${branch.label}) has only ${branch.children?.length || 0} children, expected 4`);
        }
      });

      return result;
    };

    return generateContent();
  }
}

// Legacy alias for backward compatibility
export class QuizFlashcardsAgent extends BaseAgent {
  constructor() {
    super('quiz-flashcards-content', 'Legacy: Generates quiz and flashcards', '1.0.0');
    this.quizAgent = new QuizAgent();
    this.flashcardsMindMapAgent = new FlashcardsMindMapAgent();
  }

  async execute(input, context = {}) {
    // Run both agents and merge results
    const [quizResult, flashcardsResult] = await Promise.all([
      this.quizAgent.execute(input, context),
      this.flashcardsMindMapAgent.execute(input, context),
    ]);

    return {
      quiz: quizResult.quiz,
      flashcards: flashcardsResult.flashcards,
      mind_map: flashcardsResult.mind_map,
    };
  }
}

// Legacy MindMapAgent for backward compatibility
export class MindMapAgent extends BaseAgent {
  constructor() {
    super('mindmap-content', 'Legacy: Generates mind map structure', '1.0.0');
    this.flashcardsMindMapAgent = new FlashcardsMindMapAgent();
  }

  async execute(input, context = {}) {
    const result = await this.flashcardsMindMapAgent.execute(input, context);
    return { mind_map: result.mind_map };
  }
}

// ============================================
// COMBINED AGENT (backward compatibility)
// ============================================

export class LearningContentAgent extends BaseAgent {
  constructor() {
    super('learning-content', 'Orchestrates all learning content agents', '1.0.0');
    this.learnAgent = new LearnAgent();
    this.examplesAgent = new ExamplesAgent();
    this.quizAgent = new QuizAgent();
    this.flashcardsMindMapAgent = new FlashcardsMindMapAgent();
  }

  async execute(input, context = {}) {
    const { query, profile = {}, contentType } = input;
    if (!query) throw new Error('Query is required');

    // If specific content type requested, return only that
    if (contentType) {
      switch (contentType) {
        case 'learn':
          return await this.learnAgent.execute(input, context);
        case 'examples':
          return await this.examplesAgent.execute(input, context);
        case 'quiz':
          return await this.quizAgent.execute(input, context);
        case 'flashcards-mindmap':
          return await this.flashcardsMindMapAgent.execute(input, context);
        // Legacy support
        case 'quiz-flashcards': {
          const [quizResult, fmResult] = await Promise.all([
            this.quizAgent.execute(input, context),
            this.flashcardsMindMapAgent.execute(input, context),
          ]);
          return { quiz: quizResult.quiz, flashcards: fmResult.flashcards };
        }
        case 'mindmap': {
          const result = await this.flashcardsMindMapAgent.execute(input, context);
          return { mind_map: result.mind_map };
        }
        default:
          throw new Error(`Unknown content type: ${contentType}`);
      }
    }

    // Default: fetch all content in parallel using allSettled for resilience
    const results = await Promise.allSettled([
      this.learnAgent.execute(input, context),
      this.examplesAgent.execute(input, context),
      this.quizAgent.execute(input, context),
      this.flashcardsMindMapAgent.execute(input, context),
    ]);

    // Extract results with fallbacks for failed agents
    const [learnResult, examplesResult, quizResult, flashcardsMindMapResult] = results;

    // Fallback content for each content type
    const fallbackLearn = {
      topic: query,
      title: `Learning ${query}`,
      summary: `An introduction to ${query}`,
      key_ideas: [],
      difficulty_level: 'intermediate',
      estimated_time: 20,
      prerequisites: [],
      skill_areas: [],
      next_topics: [],
      image_search_keywords: [`${query} diagram`],
    };

    const fallbackExamples = { examples: [] };
    const fallbackQuiz = { quiz: [] };
    const fallbackFlashcardsMindMap = {
      flashcards: [],
      mind_map: { root: query, branches: [] },
    };

    // Process each result, logging errors and using fallbacks
    let learnContent = fallbackLearn;
    if (learnResult.status === 'fulfilled') {
      learnContent = learnResult.value;
    } else {
      console.error(`LearnAgent failed for "${query}":`, learnResult.reason?.message || learnResult.reason);
    }

    let examplesContent = fallbackExamples;
    if (examplesResult.status === 'fulfilled') {
      examplesContent = examplesResult.value;
    } else {
      console.error(`ExamplesAgent failed for "${query}":`, examplesResult.reason?.message || examplesResult.reason);
    }

    let quizContent = fallbackQuiz;
    if (quizResult.status === 'fulfilled') {
      quizContent = quizResult.value;
    } else {
      console.error(`QuizAgent failed for "${query}":`, quizResult.reason?.message || quizResult.reason);
    }

    let flashcardsMindMapContent = fallbackFlashcardsMindMap;
    if (flashcardsMindMapResult.status === 'fulfilled') {
      flashcardsMindMapContent = flashcardsMindMapResult.value;
    } else {
      console.error(`FlashcardsMindMapAgent failed for "${query}":`, flashcardsMindMapResult.reason?.message || flashcardsMindMapResult.reason);
    }

    // Merge all content with explicit namespacing to prevent field overwrites
    return {
      // From learnAgent - core learning content
      topic: learnContent.topic || query,
      title: learnContent.title || `Learning ${query}`,
      summary: learnContent.summary || `An introduction to ${query}`,
      key_ideas: learnContent.key_ideas || [],
      difficulty_level: learnContent.difficulty_level || 'intermediate',
      estimated_time: learnContent.estimated_time || 20,
      prerequisites: learnContent.prerequisites || [],
      skill_areas: learnContent.skill_areas || [],
      next_topics: learnContent.next_topics || [],
      image_search_keywords: learnContent.image_search_keywords || [`${query} diagram`],
      // From examplesAgent
      examples: examplesContent.examples || [],
      // From quizAgent
      quiz: quizContent.quiz || [],
      // From flashcardsMindMapAgent
      flashcards: flashcardsMindMapContent.flashcards || [],
      mind_map: flashcardsMindMapContent.mind_map || { root: query, branches: [] },
      generatedAt: new Date().toISOString(),
    };
  }
}

// ============================================
// REGENERATE BLOCK AGENT
// ============================================

export class RegenerateBlockAgent extends BaseAgent {
  constructor() {
    super('regenerate-block', 'Regenerates a single content block with a different explanation style', '1.0.0');
  }

  async execute(input, context = {}) {
    const { query, block, profile = {} } = input;
    if (!query) throw new Error('Query is required');
    if (!block) throw new Error('Block is required');

    // Rotate through different explanation styles
    const styles = [
      { name: 'analogy', instruction: 'Use a creative analogy or metaphor to explain this concept. Relate it to everyday objects or situations.' },
      { name: 'story', instruction: 'Frame this as a short story or narrative. Use a character who encounters this concept and learns about it.' },
      { name: 'visual', instruction: 'Describe this concept using visual descriptions. Use phrases like "imagine", "picture this", "visualize".' },
      { name: 'step-by-step', instruction: 'Break this down into numbered steps. Start from the very beginning and explain each micro-step.' },
      { name: 'question-answer', instruction: 'Structure this as a series of questions a learner might ask, followed by clear answers.' },
      { name: 'comparison', instruction: 'Explain by comparing and contrasting with related concepts or common alternatives.' },
    ];

    // Pick a random style different from the current one
    const style = styles[Math.floor(Math.random() * styles.length)];

    const response = await client.messages.create({
      model,
      max_tokens: 2000,
      system: `You are an expert educational content writer. Your task is to re-explain a concept in a different style.

STYLE: ${style.name.toUpperCase()}
${style.instruction}

TOPIC: ${query}
ORIGINAL BLOCK TYPE: ${block.type}
ORIGINAL TITLE: ${block.title || 'Untitled'}

REQUIREMENTS:
1. Keep the same block type and structure
2. Provide a fresh, different perspective
3. Maintain accuracy and educational value
4. Make it engaging and memorable
5. Keep approximately the same length as the original

CRITICAL: Respond with RAW JSON only. No explanation, no preamble, no markdown fences. Start with { and end with }.`,
      messages: [{
        role: 'user',
        content: `Original content to re-explain:
${block.content || block.explanation || JSON.stringify(block, null, 2)}

Regenerate this as a ${block.type} block in the "${style.name}" style.

Return JSON with this structure:
{
  "type": "${block.type}",
  "title": "${block.title || 'Regenerated explanation'}",
  "content": "New explanation in ${style.name} style...",
  "style_used": "${style.name}"
}`
      }]
    });

    const text = response.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
    return parseJsonResponse(text);
  }
}

// Export instances
export const learnAgent = new LearnAgent();
export const examplesAgent = new ExamplesAgent();
export const quizAgent = new QuizAgent();
export const flashcardsMindMapAgent = new FlashcardsMindMapAgent();
export const quizFlashcardsAgent = new QuizFlashcardsAgent();
export const mindMapAgent = new MindMapAgent();
export const learningContentAgent = new LearningContentAgent();
export const regenerateBlockAgent = new RegenerateBlockAgent();

export default learningContentAgent;

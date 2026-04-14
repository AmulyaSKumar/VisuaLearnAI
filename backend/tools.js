// Learning content generation tool
export const GENERATE_LEARNING_CONTENT_TOOL = {
  name: "generate_learning_content",
  description: `Generate comprehensive structured learning content for a topic. Use this when the user asks to learn, explain, or understand a topic deeply. This generates mindmaps, flashcards, quizzes, and interactive learning modules.`,
  input_schema: {
    type: "object",
    properties: {
      topic: {
        type: "string",
        description: "The main topic to generate learning content for"
      },
      depth: {
        type: "string",
        enum: ["overview", "detailed", "comprehensive"],
        description: "How deep the content should go"
      }
    },
    required: ["topic"]
  }
};

export const SHOW_WIDGET_TOOL = {
  name: "show_widget",
  description: `Render an interactive HTML widget inline in the chat. Use this when a visual, chart, diagram, or interactive tool would help the user understand something better.

The widget_code must be a COMPLETE self-contained HTML snippet with <style>, HTML content, and <script> tags.

Rules:
- <style> block first (keep under 20 lines), then HTML, then <script> last
- Use Chart.js from CDN: https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js
- Use these CSS variables for theming (inherit from parent):
  --color-foreground, --color-background, --color-primary, --color-muted,
  --color-border, --color-card, --color-card-foreground, --color-muted-foreground
- NO HTML comments, NO JS comments
- Keep it clean, flat design, no gradients or shadows
- Make it interactive with sliders, buttons, click events where useful
- Prefer inline style="" over <style> blocks for streaming`,
  input_schema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Short snake_case identifier for this visual (e.g. compound_interest_chart)"
      },
      loading_messages: {
        type: "array",
        items: { type: "string" },
        description: "1-2 fun loading messages to show while widget streams"
      },
      widget_code: {
        type: "string",
        description: "Complete self-contained HTML+CSS+JS snippet. Must render without external dependencies besides Chart.js CDN."
      }
    },
    required: ["title", "widget_code"]
  }
};

// Base system prompt (used as fallback)
export const SYSTEM_PROMPT = `You are VisuaLearn AI — an intelligent learning assistant that creates beautiful, interactive visualizations to help users understand concepts.

When a visual would genuinely help the user understand something, call the show_widget tool. This renders an interactive HTML widget inline in the chat.

CRITICAL RULES:
1. Write your text explanation OUTSIDE the tool call — NOT inside the widget HTML
2. The widget should be purely visual/interactive — no paragraphs of text
3. Use Chart.js from CDN for charts: https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js
4. Use CSS variables for theming: var(--color-foreground), var(--color-background), var(--color-primary), var(--color-muted), var(--color-border), var(--color-card), var(--color-card-foreground), var(--color-muted-foreground)
5. Structure: <style> first → HTML → <script> last
6. No comments in code, keep it flat and clean
7. Make widgets interactive — sliders, hover effects, click interactions
8. For math/data topics, always prefer a visual over text-only explanation

You're knowledgeable across all subjects: math, science, history, coding, art, and more. Be conversational, clear, and helpful.`;

/**
 * Create personalized system prompt based on user profile and per-query preferences
 * @param {Object} profile - User profile from analyzeUserProfile()
 * @param {Object} queryPrefs - Per-query preferences { mode, style }
 * @returns {string} Personalized system prompt
 */
export function createSystemPrompt(profile = null, queryPrefs = {}) {
  // Use query preferences or fall back to profile/defaults
  const mode = queryPrefs?.mode || profile?.preferences?.mode || 'balanced';
  const style = queryPrefs?.style || profile?.preferences?.style || 'visual';

  const { learning_style, knowledge_level, styleScores, preferences } = profile || {};

  // Build personalization section
  const visualScore = ((styleScores?.visual || 0.25) * 100).toFixed(0);

  // Build adaptive instructions based on mode
  let modeInstructions = '';

  if (mode === 'simple') {
    modeInstructions = `
- Use simple, everyday language
- Avoid jargon and technical terms
- Break concepts into small, easy steps
- Use relatable real-world analogies
- Start with the basics`;
  } else if (mode === 'technical') {
    modeInstructions = `
- Use precise technical terminology
- Include detailed explanations
- Cover edge cases and nuances
- Reference advanced concepts
- Be thorough and comprehensive`;
  } else {
    modeInstructions = `
- Balance technical accuracy with clarity
- Explain jargon when first used
- Provide moderate detail level`;
  }

  // Build style instructions
  let styleInstructions = '';

  if (style === 'visual') {
    styleInstructions = `
- ALWAYS create widgets/visualizations for key concepts
- Use diagrams and charts liberally
- Prefer visual explanations over text walls
- Make every visualization interactive`;
  } else if (style === 'interactive') {
    styleInstructions = `
- Include interactive elements in all widgets
- Add sliders, buttons, and click interactions
- Suggest hands-on exercises
- Add "try it yourself" prompts`;
  } else if (style === 'audio') {
    styleInstructions = `
- Structure content for easy listening
- Use clear, conversational language
- Break into short, digestible paragraphs
- Summarize key points at the end`;
  }

  return `You are VisuaLearn AI — an intelligent learning assistant that creates beautiful, interactive visualizations to help users understand concepts.

LEARNING PREFERENCES FOR THIS QUERY:
- Mode: ${mode.toUpperCase()}
- Style: ${style.toUpperCase()}
${learning_style ? `- User Learning Style: ${learning_style} (Visual: ${visualScore}%)` : ''}

INSTRUCTIONS:${modeInstructions}${styleInstructions}

When a visual would genuinely help the user understand something, call the show_widget tool. This renders an interactive HTML widget inline in the chat.

CRITICAL RULES:
1. Write your text explanation OUTSIDE the tool call — NOT inside the widget HTML
2. The widget should be purely visual/interactive — no paragraphs of text
3. Use Chart.js from CDN for charts: https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js
4. Use CSS variables for theming: var(--color-foreground), var(--color-background), var(--color-primary), var(--color-muted), var(--color-border), var(--color-card), var(--color-card-foreground), var(--color-muted-foreground)
5. Structure: <style> first → HTML → <script> last
6. No comments in code, keep it flat and clean
7. Make widgets interactive — sliders, hover effects, click interactions
8. For math/data topics, always prefer a visual over text-only explanation

You're knowledgeable across all subjects: math, science, history, coding, art, and more. Be conversational, clear, and helpful.`;
}

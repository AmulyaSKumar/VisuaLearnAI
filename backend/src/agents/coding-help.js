/**
 * Coding Help Agent
 * Specialized agent for debugging, fixing code, and explaining errors
 * Output: Issue identification + fix + corrected code + explanation
 */
import { BaseAgent } from './base-agent.js';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});

const model = process.env.ANTHROPIC_MODEL;

/**
 * Parse JSON response with error handling
 */
function parseJsonResponse(text) {
  try {
    return JSON.parse(text);
  } catch {
    // Try to extract JSON from markdown fences
    const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) {
      return JSON.parse(match[1]);
    }
    // Try to find JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Failed to parse JSON response');
  }
}

/**
 * Detect programming language from code/query
 */
function detectLanguage(query, code) {
  const combined = `${query} ${code || ''}`.toLowerCase();

  const languagePatterns = [
    { lang: 'javascript', patterns: [/\bjavascript\b/, /\bjs\b/, /\bnode\b/, /\breact\b/, /\bconst\s/, /\blet\s/, /\bfunction\s*\(/, /=>\s*{/] },
    { lang: 'typescript', patterns: [/\btypescript\b/, /\bts\b/, /:\s*(string|number|boolean|any)\b/, /interface\s+\w+/] },
    { lang: 'python', patterns: [/\bpython\b/, /\bdef\s+\w+/, /\bimport\s+\w+/, /\bprint\s*\(/] },
    { lang: 'java', patterns: [/\bjava\b/, /\bpublic\s+class\b/, /\bSystem\.out/] },
    { lang: 'c++', patterns: [/\bc\+\+\b/, /\bcpp\b/, /\b#include\b/, /\bstd::/] },
    { lang: 'rust', patterns: [/\brust\b/, /\bfn\s+\w+/, /\blet\s+mut\b/] },
    { lang: 'go', patterns: [/\bgolang\b/, /\bgo\b/, /\bfunc\s+\w+/, /\bpackage\s+main/] },
  ];

  for (const { lang, patterns } of languagePatterns) {
    for (const pattern of patterns) {
      if (pattern.test(combined)) {
        return lang;
      }
    }
  }

  return 'javascript'; // Default
}

/**
 * Extract code snippets from the query
 */
function extractCodeFromQuery(query) {
  // Match code blocks
  const codeBlockMatch = query.match(/```[\w]*\n?([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Match inline code that looks like a function or statement
  const inlineMatch = query.match(/`([^`]+)`/g);
  if (inlineMatch) {
    return inlineMatch.map(m => m.replace(/`/g, '')).join('\n');
  }

  return null;
}

export class CodingHelpAgent extends BaseAgent {
  constructor() {
    super('coding-help', 'Provides debugging and code fixing assistance', '1.0.0');
  }

  async execute(input, context = {}) {
    const { query, profile = {}, intent = {}, code: providedCode } = input;
    if (!query) throw new Error('Query is required');

    const learningLevel = profile.comprehension_level || profile.knowledge_level || 'intermediate';
    const extractedCode = providedCode || extractCodeFromQuery(query);
    const language = detectLanguage(query, extractedCode);

    // Determine query type
    const isDebugRequest = /\b(fix|debug|error|bug|issue|not\s+working|broken)\b/i.test(query);
    const isExplanationRequest = /\b(why|explain|what\s+does|how\s+does)\b/i.test(query);
    const isHowToRequest = /\b(how\s+to|how\s+do\s+i|how\s+can\s+i)\b/i.test(query);

    let promptType = 'debug';
    if (isExplanationRequest && !isDebugRequest) {
      promptType = 'explain';
    } else if (isHowToRequest && !isDebugRequest) {
      promptType = 'howto';
    }

    const systemPrompts = {
      debug: `You are an expert debugger who helps fix code issues.
Your responses should be:
1. Direct and actionable
2. Focused on the specific issue
3. Include the corrected code
4. Explain WHY the bug occurred
5. Suggest prevention strategies`,

      explain: `You are a code explainer who makes complex code understandable.
Your responses should:
1. Break down the code line by line
2. Explain the logic flow
3. Highlight key patterns used
4. Point out any potential issues
5. Suggest improvements if relevant`,

      howto: `You are a coding mentor who provides practical solutions.
Your responses should:
1. Provide working code examples
2. Explain the approach
3. Cover edge cases
4. Include best practices
5. Offer alternatives when applicable`,
    };

    const response = await client.messages.create({
      model,
      max_tokens: 4000,
      system: `${systemPrompts[promptType]}

User Level: ${learningLevel}
Detected Language: ${language}

CRITICAL: Respond with RAW JSON only. No explanation, no markdown fences. Start with { and end with }.`,
      messages: [{
        role: 'user',
        content: `${promptType === 'debug' ? 'Debug/fix this code issue' : promptType === 'explain' ? 'Explain this code' : 'Show me how to do this'}:

Query: "${query}"
${extractedCode ? `\nCode:\n${extractedCode}` : ''}

Return JSON with this EXACT structure:
{
  "topic": "Brief topic description",
  "query_type": "${promptType}",
  "language": "${language}",
  ${promptType === 'debug' ? `
  "issue": {
    "summary": "One-line description of the problem",
    "type": "syntax_error|logic_error|runtime_error|type_error|performance|security",
    "location": "Where in the code the issue is (line/function)",
    "explanation": "Detailed explanation of what's wrong and why"
  },
  "fix": {
    "summary": "One-line description of the fix",
    "steps": [
      "Step 1: What to change",
      "Step 2: Why this fixes it"
    ]
  },
  "original_code": "The problematic code with comments highlighting issues",
  "corrected_code": "The fixed code with comments explaining changes",
  ` : promptType === 'explain' ? `
  "code_analysis": {
    "purpose": "What this code does",
    "key_concepts": ["Concept 1 used", "Concept 2 used"],
    "flow": "Step-by-step explanation of how the code executes"
  },
  "line_by_line": [
    {
      "line": "const x = ...",
      "explanation": "What this line does"
    }
  ],
  "potential_issues": ["Any issues or improvements to note"],
  ` : `
  "solution": {
    "approach": "Overview of the solution approach",
    "key_concepts": ["Concept 1 needed", "Concept 2 needed"]
  },
  "code": "Complete working code solution",
  "explanation": "Step-by-step explanation of the code",
  "alternatives": [
    {
      "approach": "Alternative approach name",
      "code": "Alternative implementation",
      "when_to_use": "When this alternative is better"
    }
  ],
  `}
  "best_practices": [
    "Relevant best practice 1",
    "Best practice 2"
  ],
  "common_mistakes": [
    {
      "mistake": "Common mistake to avoid",
      "correct": "The right way to do it"
    }
  ],
  "learn_more": ["Related topic to explore"],
  "responseMode": "coding_help"
}`
      }]
    });

    const text = response.content.filter(item => item.type === 'text').map(item => item.text).join('');
    const result = parseJsonResponse(text);

    // Ensure responseMode is set
    result.responseMode = 'coding_help';

    return result;
  }
}

export const codingHelpAgent = new CodingHelpAgent();
export default codingHelpAgent;

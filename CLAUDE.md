# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**VisuaLearn** is an AI-powered educational platform that creates interactive visualizations to help users understand complex concepts. Monorepo with:
- **Frontend**: React 19 + Vite + Tailwind v4
- **Backend**: Express 5 with modular architecture, Supabase for data, Anthropic Claude for AI

## Development Commands

### Frontend (`/frontend`)
```bash
npm install        # or bun install
npm run dev        # Vite dev server on localhost:5173
npm run build      # Production build to /dist
npm run lint       # ESLint
npm run lint -- path/to/file.jsx --fix  # Lint single file
```

### Backend (`/backend`)
```bash
npm install        # or bun install
npm run dev        # Node server on localhost:3001
npm start          # Production start
```

### Backend Tests
Run individual test files after setting environment variables:
```bash
node test_stream.js         # Basic streaming
node test_stream_tools.js   # Tool calls
node test_realtime.js       # Real-time conversation
node test_tts.js            # Text-to-speech
node test_day1_agents.js    # Agent system
node test_day1_memory.js    # Memory management
node test_day1_supabase.js  # Database
node test_integration_full.js  # Full integration
```

## Architecture

### Backend Structure (`/backend`)
```
backend/
├── server.js                 # Entry point (loads dotenv, starts src/server.js)
├── tools.js                  # show_widget tool definition & system prompt
├── routes/chat.js            # Chat streaming routes
└── src/
    ├── server.js             # Express app, HTTP server, WebSocket
    ├── config/environment.js # Centralized config from env vars
    ├── api/                  # Feature-based API routes
    │   ├── index.js          # Route registration
    │   ├── chat/             # POST /api/chat, /api/tool-result
    │   ├── user/             # User profile CRUD
    │   ├── plan/             # Learning plan generation
    │   ├── assets/           # Widget/diagram generation
    │   └── feedback/         # User feedback
    ├── agents/               # AI agent system
    │   ├── base-agent.js     # Abstract base class
    │   ├── registry.js       # Agent discovery & orchestration
    │   ├── planner.js        # Learning plan agent
    │   ├── visual-intelligence.js  # Widget generation
    │   ├── image-generator.js      # Image generation
    │   ├── fact-checker.js         # Validation
    │   └── personalization.js      # Learning style detection
    ├── services/             # Reusable business logic
    │   └── memory/           # Conversation/session management
    ├── database/client.js    # Supabase operations
    ├── middleware/           # Express middleware
    └── utils/
        ├── logger.js         # Logging with levels
        └── errors.js         # Custom error classes
```

### Frontend Structure (`/frontend/src`)
```
src/
├── App.jsx                   # Router (main route: /chat/:id)
├── main.jsx                  # Entry point
├── index.css                 # Global styles + Tailwind + CSS variables
├── contexts/AuthContext.jsx  # Auth state management
├── hooks/
│   ├── useSSEStream.js       # SSE chat streaming + tool handling
│   ├── useChat.js            # Chat orchestration
│   ├── useAssetStream.js     # Asset generation streaming
│   ├── useLearningPlan.js    # Learning plan state
│   ├── useFeedback.js        # Feedback submission
│   └── useRealtimeAudio.js   # Voice input/output
├── components/
│   ├── ChatWindow.jsx        # Main chat interface
│   ├── MessageBubble.jsx     # Individual messages
│   ├── MessageList.jsx       # Message container
│   ├── WidgetFrame.jsx       # Renders widgets in iframes
│   ├── WidgetLoading.jsx     # Widget loading state
│   ├── InputBar.jsx          # User input
│   ├── Sidebar.jsx           # Conversation list + theme toggle
│   ├── VoiceOverlay.jsx      # Voice recording UI
│   ├── LearningPlanCard.jsx  # Plan display
│   ├── ImageWidget.jsx       # Generated images
│   ├── FactCheckBadge.jsx    # Validation indicators
│   └── FeedbackButtons.jsx   # User feedback UI
└── pages/                    # Route pages
```

## Key Patterns

### SSE Streaming Chat Flow
1. Frontend POSTs to `/api/chat` with `{ messages: [...] }`
2. Backend streams SSE events: `text_delta`, `tool_use_start`, `tool_input_delta`, `tool_use`, `done`, `error`
3. On `tool_use` (widget), frontend renders it and POSTs to `/api/tool-result` to continue
4. Each event is JSON on a line prefixed with `data: `, heartbeats every 15s

### Message Format
```javascript
// User message
{ role: "user", content: "text" }

// Tool result (widget rendered)
{ role: "user", content: [{ type: "tool_result", tool_use_id: "...", content: "Widget rendered." }] }
```

### Agent System
```javascript
import { BaseAgent, agentRegistry } from './agents/index.js';

// Extend BaseAgent
class MyAgent extends BaseAgent {
  async execute(input, context) { return { result: 'output' }; }
}

// Register and use
agentRegistry.registerAgent(new MyAgent('name', 'description'));
await agentRegistry.runAgent('name', input, context);
await agentRegistry.runParallel(['agent1', 'agent2'], input, context);
```

### Widget Development
Widgets are self-contained HTML streamed from Claude via `show_widget` tool:
- Structure: `<style>` → HTML → `<script>` (no comments)
- Use Chart.js: `https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js`
- Use CSS variables: `var(--color-foreground)`, `var(--color-background)`, `var(--color-primary)`, `var(--color-muted)`, `var(--color-border)`, `var(--color-card)`, `var(--color-card-foreground)`, `var(--color-muted-foreground)`
- Rendered in iframes for isolation

### Theming
- CSS variables defined in `index.css`, toggled via `dark` class on `<html>`
- Never hardcode colors—use Tailwind's `dark:` prefix or CSS variables

## Environment Variables

Backend `.env` (required):
```
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-4-5
ANTHROPIC_BASE_URL=...          # Optional
AZURE_OPENAI_API_KEY=...        # For TTS/images
AZURE_OPENAI_ENDPOINT=...
PORT=3001                       # Optional, defaults to 3001
LOG_LEVEL=info                  # Optional: error, warn, info, debug
```

## Database

Supabase with Row Level Security. Key tables:
- `user_profiles` - User settings, learning styles
- `conversations` - Chat sessions
- `messages` - Individual messages
- `feedback` - User feedback
- `asset_cache` - Generated widgets/images
- `fact_checks` - Validation results

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Stream chat response (SSE) |
| `/api/tool-result` | POST | Continue after widget renders |
| `/api/health` | GET | Health check |
| `/api/user` | POST/GET/PUT | User profile CRUD |
| `/api/user/:id/detect-style` | POST | Detect learning style |
| `/api/plan` | POST | Generate learning plan |
| `/api/generate-assets` | POST | Generate widgets (SSE) |
| `/api/feedback` | POST/GET | Submit/retrieve feedback |
| `/ws/realtime` | WebSocket | Real-time voice |

## Common Issues

- **CORS errors**: Check `config.cors.origin` in `src/config/environment.js` includes your frontend origin
- **Streaming timeouts**: Backend sends heartbeats every 15s; frontend should ignore `:heartbeat` lines
- **Widget rendering**: Ensure valid HTML, use CSS variables for colors, keep size reasonable
- **Missing env vars**: Server validates required vars on startup—check error messages

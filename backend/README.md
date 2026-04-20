# VisuaLearn Backend

Professional, modular backend architecture for AI-powered educational visualizations.

## 🏗️ Architecture

```
backend/
├── src/                      # All source code
│   ├── server.js             # Main Express server
│   ├── api/                  # API routes & handlers
│   ├── agents/               # AI agent implementations
│   ├── services/             # Business logic
│   ├── database/             # Data layer (Supabase)
│   ├── middleware/           # Express middleware
│   ├── config/               # Configuration
│   ├── utils/                # Utilities & helpers
│   └── types/                # TypeScript/JSDoc types
├── tests/                    # Test suite
├── scripts/                  # Setup & migration scripts
└── server.js                 # Entry point
```

## 🚀 Getting Started

### Install Dependencies
```bash
npm install
```

### Environment Setup
```bash
cp .env.example .env
# Edit .env with your credentials
```

### Start Development Server
```bash
npm run dev
```

Server runs on `http://localhost:3001`

### Run Tests
```bash
npm test
```



## 📁 Directory Structure

### `/src/api` - API Routes
Each API feature is organized in its own folder:
- `chat/` - Streaming chat responses
- `user/` - User profile management
- `conversation/` - Conversation CRUD
- `plan/` - Learning plan generation (Day 2)
- `assets/` - Widget generation (Day 3)
- `image/` - Image generation (Day 4)
- `validation/` - Fact checking (Day 4)

**Pattern:**
```
feature/
├── routes.js       # Express routes
├── controller.js   # Business logic
└── schemas.js      # Request validation
```

### `/src/agents` - AI Agents
Specialized agents for different tasks:
- `base-agent.js` - Base abstract class
- `registry.js` - Agent registry & orchestration
- `planner.js` - Learning plan generation (Day 2)
- `visual-intelligence.js` - Widget generation (Day 3)
- `image-generator.js` - Image generation (Day 4)
- `fact-checker.js` - Validation (Day 4)
- `personalization.js` - Learning style detection (Day 2)

**Usage:**
```javascript
import { BaseAgent, agentRegistry } from './agents/index.js';

class MyAgent extends BaseAgent {
  async execute(input, context) {
    // Implementation
  }
}

agentRegistry.registerAgent(new MyAgent('name', 'description'));
await agentRegistry.runAgent('name', input, context);
```

### `/src/services` - Business Logic
Reusable services used by routes & agents:

#### `/services/memory`
User session and conversation history management
```javascript
import { MemoryManager } from './services/memory/index.js';

const manager = new MemoryManager(userId);
await manager.initialize();
await manager.addUserMessage(content);
```

#### `/services/anthropic` (coming Day 2)
Claude API integration and streaming

#### `/services/azure` (coming Day 4)
Azure OpenAI services (images, audio, realtime voice)

#### `/services/cache` (coming soon)
LRU cache and asset caching

#### `/services/storage` (coming Day 4)
Supabase Storage operations

### `/src/database` - Data Layer
All database operations through Supabase:
```javascript
import { createConversation, addMessage } from './database/client.js';

const conv = await createConversation(userId, 'Title');
await addMessage(conv.id, 'user', 'Hello');
```

### `/src/middleware` - Express Middleware
- `errorHandler.js` - Global error handling
- `corsHandler.js` - CORS configuration (in index.js)
- Custom middleware (auth, logging, etc.)

### `/src/config` - Configuration
Environment-based configuration:
```javascript
import { config } from './config/environment.js';
console.log(config.port);        // 3001
console.log(config.supabase.url);
```

### `/src/utils` - Utilities
- `logger.js` - Logging with levels
- `errors.js` - Custom error classes
- `validators.js` - Input validation
- `formatters.js` - Response formatting

## 🔄 Request Flow

```
Client Request
     ↓
Express Middleware (CORS, JSON parsing)
     ↓
Route Handler (api/feature/routes.js)
     ↓
Controller (api/feature/controller.js)
     ↓
Services (services/*, database/*, agents/*)
     ↓
Supabase / Claude API / Azure API
     ↓
Response/Stream
```

## 📚 Adding New Features

### Step 1: Create API Route
```bash
mkdir src/api/new-feature
touch src/api/new-feature/{routes.js,controller.js,schemas.js}
```

### Step 2: Register Route
In `src/api/index.js`:
```javascript
router.post('/new-feature', (req, res) => require('./new-feature/routes.js'));
```

### Step 3: Implement Controller
```javascript
// src/api/new-feature/controller.js
export async function handleNewFeature(req, res) {
  // Implementation
}
```

### Step 4: Add Validation
```javascript
// src/api/new-feature/schemas.js
export const newFeatureSchema = {
  body: {
    field1: { type: 'string', required: true },
  },
};
```

## 🤖 Adding New Agents

### Step 1: Create Agent Class
```javascript
// src/agents/my-agent.js
import { BaseAgent } from './base-agent.js';

export class MyAgent extends BaseAgent {
  async execute(input, context) {
    return { result: 'output' };
  }
}
```

### Step 2: Register Agent
```javascript
// In server.js or agent initialization
import { MyAgent } from './agents/my-agent.js';
agentRegistry.registerAgent(new MyAgent('name', 'description'));
```

### Step 3: Use in Routes
```javascript
const result = await agentRegistry.runAgent('name', input, context);
```

## 📊 Database

All data operations use Supabase with Row Level Security.

**Tables:**
- `user_profiles` - User settings and learning styles
- `conversations` - Chat sessions
- `messages` - Individual messages
- `feedback` - User feedback for improvement
- `asset_cache` - Generated assets (widgets, images)
- `fact_checks` - Validation results

See `/src/database/client.js` for all available functions.

## ⚙️ Configuration

All configuration is centralized in `/src/config/environment.js`:

```javascript
import { config } from './config/environment.js';

config.port              // Server port (3001)
config.supabase.url      // Supabase project URL
config.anthropic.model   // Claude model version
config.azure.endpoint    // Azure OpenAI endpoint
```

Environment variables in `.env`:
```
SUPABASE_URL=...
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-4-5
AZURE_OPENAI_ENDPOINT=...
PORT=3001
LOG_LEVEL=info
NODE_ENV=development
```

## 🧪 Testing

Tests are organized to mirror src structure:

```
tests/
├── unit/
│   ├── agents/
│   ├── services/
│   └── utils/
└── integration/
    ├── user-flow.test.js
    ├── chat-flow.test.js
    └── agent-flow.test.js
```

Run tests:
```bash
npm test
npm test -- tests/unit/agents/*.js
npm test -- --coverage
```

## 📈 Scaling Considerations

This architecture supports:
- **Multiple agents** (separate files, auto-registered)
- **Independent services** (reusable across routes)
- **Parallel development** (clear boundaries)
- **Easy testing** (modular, no globals)
- **Performance** (caching, logging, error handling)
- **Monitoring** (logger integration)

## 🐛 Error Handling

Custom error classes:
```javascript
import { ValidationError, NotFoundError, DatabaseError } from './utils/errors.js';

throw new ValidationError('Invalid input');
throw new NotFoundError('User not found');
throw new DatabaseError('Query failed');
```

All errors are caught by global middleware and formatted consistently.

## 📝 Logging

```javascript
import { logger } from './utils/logger.js';

logger.info('User logged in', { userId: '123' });
logger.error('Database error', { query: 'SELECT...' });
logger.debug('Cache hit', { key: 'prompt_hash' });
```

Levels: `error`, `warn`, `info`, `debug`

Configure with `LOG_LEVEL` env var.

## 🚢 Deployment

For production:

```bash
# Set environment
export NODE_ENV=production

# Start server
npm start

# Or with process manager
pm2 start server.js --name "visualearn-backend"
```

## 📚 Documentation

Each module has JSDoc comments:
```javascript
/**
 * Brief description
 * @module path/to/module
 * @param {Type} name - Parameter description
 * @returns {Type} Return description
 */
```

## 🤝 Contributing

1. Follow the directory structure
2. Create separate files for routes, controllers, schemas
3. Add JSDoc comments
4. Write tests for new features
5. Update this README for major changes

## 📞 Support

- Check logs: `LOG_LEVEL=debug npm run dev`
- Review error handling in `/src/utils/errors.js`
- Check database queries in `/src/database/client.js`

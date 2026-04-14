# VisuaLearn

AI-powered educational platform that creates interactive visualizations to help users understand complex concepts.

## Tech Stack

- **Frontend**: React 19 + Vite + Tailwind CSS v4
- **Backend**: Express 5 + Node.js
- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **AI**: Anthropic Claude API (streaming responses + tool use)
- **Optional**: Azure OpenAI (TTS, image generation)

## Prerequisites

- Node.js 18+ or Bun
- Supabase account (free tier works)
- Anthropic API key

## Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone <your-repo-url>
cd visuvalearn

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)

2. Run this SQL in the Supabase SQL Editor to create tables:

```sql
-- User profiles table
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  learning_style TEXT DEFAULT 'visual',
  detected_styles JSONB DEFAULT '{"visual": 0.25, "auditory": 0.25, "reading": 0.25, "kinesthetic": 0.25}',
  preferred_language TEXT DEFAULT 'en',
  comprehension_level TEXT DEFAULT 'intermediate',
  pace_preference TEXT DEFAULT 'normal',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations table
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'New conversation',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback table
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('thumbs_up', 'thumbs_down', 'correction', 'suggestion')),
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asset cache table
CREATE TABLE asset_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_hash TEXT UNIQUE NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('widget', 'image', 'simulation')),
  content TEXT,
  storage_path TEXT,
  metadata JSONB DEFAULT '{}',
  access_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fact checks table
CREATE TABLE fact_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  claims JSONB NOT NULL,
  verification_results JSONB NOT NULL,
  confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  sources JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_checks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage own profile"
  ON user_profiles FOR ALL
  USING (auth.uid() = id);

CREATE POLICY "Users can manage own conversations"
  ON conversations FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage messages in own conversations"
  ON messages FOR ALL
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own feedback"
  ON feedback FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read asset cache"
  ON asset_cache FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create asset cache"
  ON asset_cache FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can read fact checks for their messages"
  ON fact_checks FOR SELECT
  USING (
    message_id IN (
      SELECT m.id FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_feedback_user_id ON feedback(user_id);
CREATE INDEX idx_asset_cache_prompt_hash ON asset_cache(prompt_hash);
```

3. Get your API keys from Supabase Dashboard > Settings > API:
   - `SUPABASE_URL` (Project URL)
   - `SUPABASE_ANON_KEY` (anon/public key)
   - `SUPABASE_SERVICE_KEY` (service_role key - keep secret!)

### 3. Configure Environment Variables

**Backend** (`backend/.env`):

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:
```env
# Required
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_KEY=your-supabase-service-role-key
ANTHROPIC_API_KEY=your-anthropic-api-key
ANTHROPIC_MODEL=claude-sonnet-4-5

# Optional
PORT=3001
NODE_ENV=development
LOG_LEVEL=info
```

**Frontend** (`frontend/.env`):

```bash
cd frontend
cp .env.example .env
```

Edit `frontend/.env`:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 4. Run the Application

You need **two terminals** - one for backend, one for frontend.

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
Backend runs at: http://localhost:3001

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Frontend runs at: http://localhost:5173

### 5. Open the App

Visit http://localhost:5173 in your browser.

## Project Structure

```
visuvalearn/
├── backend/
│   ├── server.js           # Entry point
│   ├── tools.js            # AI tool definitions
│   ├── routes/             # API routes
│   ├── src/
│   │   ├── server.js       # Express app
│   │   ├── api/            # Feature-based routes
│   │   ├── agents/         # AI agents
│   │   ├── database/       # Supabase client
│   │   ├── services/       # Business logic
│   │   └── config/         # Environment config
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx         # Main router
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom hooks
│   │   ├── contexts/       # Auth context
│   │   └── lib/            # Supabase client
│   └── .env.example
├── CLAUDE.md               # AI assistant instructions
└── README.md               # This file
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/chat` | POST | Stream chat response (SSE) |
| `/api/tool-result` | POST | Continue after widget renders |
| `/api/user` | POST/GET/PUT | User profile CRUD |
| `/api/plan` | POST | Generate learning plan |
| `/api/feedback` | POST | Submit feedback |

## Features

- **Streaming Chat**: Real-time AI responses via Server-Sent Events
- **Interactive Widgets**: Charts and visualizations rendered inline
- **Message Persistence**: Conversations saved to Supabase
- **User Authentication**: Supabase Auth integration
- **Dark/Light Theme**: Toggle between themes
- **Learning Plans**: AI-generated study plans

## Troubleshooting

### "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY"
Make sure your `backend/.env` file exists and has all required variables.

### CORS Errors
The backend allows `localhost:5173` and `localhost:3000` by default. If using a different port, update `backend/src/config/environment.js`.

### "Failed to fetch" in browser
1. Make sure the backend is running on port 3001
2. Check browser console for detailed errors
3. Verify your API keys are correct

### Supabase RLS blocking requests
Make sure you ran all the SQL including the RLS policies. Check the Supabase logs for policy violations.

## Development Commands

**Frontend:**
```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

**Backend:**
```bash
npm run dev      # Start with auto-reload
npm start        # Production start
```

**Run tests (backend):**
```bash
node test_stream.js         # Test streaming
node test_stream_tools.js   # Test tool calls
node test_integration_full.js  # Full integration test
```

## Getting API Keys

### Anthropic Claude
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Go to Settings > API Keys
4. Create a new key

### Supabase
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Go to Settings > API
4. Copy the Project URL and keys

## License

MIT

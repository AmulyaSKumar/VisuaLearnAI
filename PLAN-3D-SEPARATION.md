# Plan: Separate Text Content and 3D Visualization API Calls

## Goal
Split the current single API call into two sequential calls:
1. **First call** → Get text explanation (fast, immediate)
2. **Second call** → Get 3D visualization (can take longer, renders after text)

---

## Current Flow (Single Call)

```
User: "How does an engine work"
              │
              ▼
    ┌─────────────────┐
    │  POST /api/chat │  ← Single call returns BOTH text + widget
    └─────────────────┘
              │
              ▼
    ┌─────────────────────────────────┐
    │ Stream: text + show_widget tool │
    │ (mixed together)                │
    └─────────────────────────────────┘
```

**Problems:**
- User waits for 3D generation before seeing text
- 3D failures can interrupt text flow
- Complex responses take longer

---

## Proposed Flow (Two Calls)

```
User: "How does an engine work"
              │
              ▼
    ┌──────────────────────┐
    │  POST /api/chat      │  ← Call 1: Text only (no widgets)
    │  { skip3D: true }    │
    └──────────────────────┘
              │
              ▼
    ┌─────────────────────────────────┐
    │ Stream: Text explanation        │  ← User sees text immediately
    │ "An engine converts fuel..."    │
    └─────────────────────────────────┘
              │
              ▼
    ┌──────────────────────┐
    │ Frontend: Detect if  │  ← Client-side 3D detection
    │ 3D is appropriate    │
    └──────────────────────┘
              │
              ▼ (if 3D needed)
    ┌──────────────────────┐
    │ POST /api/generate-3d│  ← Call 2: 3D widget only
    │ { topic, context }   │
    └──────────────────────┘
              │
              ▼
    ┌─────────────────────────────────┐
    │ 3D Widget appears BELOW text    │
    │ ┌─────────────────────────────┐ │
    │ │  🎮 ENGINE_3D        [3D]  │ │
    │ │  Interactive 3D Model      │ │
    │ └─────────────────────────────┘ │
    └─────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Client-Side 3D Detection
**File:** `frontend/src/utils/detect3D.js` (NEW)

```javascript
// Port the should3DVisualize logic to frontend
export function should3DVisualize(query) {
  const score = { topic: 0, spatial: 0, explicit: 0 };

  // Natural 3D topics (+30)
  const natural3D = [
    /molecule|atom|protein|dna|engine|motor|gear|piston/i,
    /cube|sphere|cylinder|polyhedron|3d model/i,
    /orbit|planet|solar system/i,
    /robot|mechanism|turbine/i,
  ];
  if (natural3D.some(p => p.test(query))) score.topic = 30;

  // Spatial understanding (+40)
  const spatial = [
    /how .* works|working principle|internal/i,
    /structure|assembly|components|parts/i,
  ];
  if (spatial.some(p => p.test(query))) score.spatial = 40;

  // Explicit request (+50)
  const explicit = /3d|three-?d|visualize|model/i;
  if (explicit.test(query)) score.explicit = 50;

  const total = score.topic + score.spatial + score.explicit;
  return { use3D: total >= 50, score: total };
}
```

### Step 2: Modify Chat API to Skip Widgets
**File:** `backend/routes/chat.js`

Add option to skip widget generation:
```javascript
router.post("/chat", async (req, res) => {
  const { messages, userId, skip3D = false } = req.body;

  // If skip3D, use system prompt WITHOUT widget instructions
  const systemPrompt = skip3D
    ? SYSTEM_PROMPT_TEXT_ONLY  // New prompt without show_widget
    : SYSTEM_PROMPT;

  const tools = skip3D ? [] : [SHOW_WIDGET_TOOL];

  // ... rest of handler
});
```

### Step 3: Create Dedicated 3D Generation Endpoint
**File:** `backend/src/api/visualization/index.js` (NEW)

```javascript
router.post("/generate-3d", async (req, res) => {
  const { topic, context, deviceCapabilities } = req.body;

  // 1. Validate 3D is appropriate
  const detection = should3DVisualize(topic);
  if (!detection.use3D) {
    return res.json({ skip: true, reason: detection.reason });
  }

  // 2. Adjust complexity based on device
  const complexity = get3DComplexityLevel(deviceCapabilities);

  // 3. Generate 3D widget with Claude
  const prompt = build3DWidgetPrompt(topic, context, complexity);

  // 4. Stream the widget code
  // SSE streaming...
});
```

### Step 4: Update useChat Hook
**File:** `frontend/src/hooks/useChat.js`

```javascript
const sendMessage = async (text) => {
  // Step 1: Send text-only request
  await startStream(messages, onDelta, onComplete, {
    ...options,
    skip3D: true  // Don't generate widgets
  });

  // Step 2: Check if 3D is needed
  const detection = should3DVisualize(text);

  if (detection.use3D && deviceCapabilities.webgl) {
    // Step 3: Generate 3D separately
    await generate3DWidget(text, lastAssistantResponse);
  }
};
```

### Step 5: Add 3D Widget Container
**File:** `frontend/src/components/MessageBubble.jsx`

```jsx
// After text content, show 3D loading/widget
{is3DLoading && <Widget3DLoading topic={topic} />}
{widget3D && <WidgetFrame widget={widget3D} />}
```

---

## Files to Modify/Create

| File | Action | Description |
|------|--------|-------------|
| `frontend/src/utils/detect3D.js` | CREATE | Client-side 3D detection |
| `frontend/src/hooks/useChat.js` | MODIFY | Add skip3D flag, call 3D endpoint |
| `frontend/src/hooks/use3DWidget.js` | CREATE | Hook for 3D generation |
| `backend/routes/chat.js` | MODIFY | Add skip3D option |
| `backend/src/services/anthropic/prompts.js` | MODIFY | Add TEXT_ONLY prompt |
| `backend/src/api/visualization/index.js` | CREATE | 3D generation endpoint |
| `frontend/src/components/Widget3DLoading.jsx` | CREATE | Loading state for 3D |

---

## API Contract

### POST /api/chat (Modified)
```json
{
  "messages": [...],
  "userId": "...",
  "skip3D": true  // NEW: Skip widget generation
}
```

### POST /api/generate-3d (New)
```json
// Request
{
  "topic": "How does an engine work",
  "context": "Previous assistant response text...",
  "deviceCapabilities": {
    "webgl": true,
    "memory": 4,
    "mobile": false
  }
}

// Response (SSE)
data: { "type": "start", "topic": "engine_3d" }
data: { "type": "code_delta", "chunk": "<div id=\"container\"..." }
data: { "type": "complete", "widget": { "title": "engine_3d", "code": "...", "widget_type": "3d" } }
data: { "type": "done" }
```

---

## Benefits

1. **Faster perceived performance** - User sees text immediately
2. **Graceful degradation** - 3D failure doesn't break text
3. **Better resource management** - 3D loads only when needed
4. **Device-aware** - Can skip 3D on low-end devices
5. **Cleaner separation of concerns** - Text and visualization are independent

---

## Timeline

1. **Phase 1**: Create detection utility + TEXT_ONLY prompt (30 min)
2. **Phase 2**: Create /api/generate-3d endpoint (45 min)
3. **Phase 3**: Update useChat hook + loading states (30 min)
4. **Phase 4**: Testing and refinement (30 min)

---

## Questions for You

1. **Loading UI**: What should show while 3D is generating?
   - Option A: Simple spinner with "Generating 3D visualization..."
   - Option B: Skeleton placeholder with animation
   - Option C: Progress bar with steps

2. **3D Position**: Where should the 3D widget appear?
   - Option A: Below the text response (current)
   - Option B: In a side panel
   - Option C: Expandable section at bottom

3. **Fallback**: If 3D fails, should we:
   - Option A: Show error message
   - Option B: Silently skip (no 3D)
   - Option C: Show 2D diagram fallback

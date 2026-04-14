# Visualization Agent Enhancement Plan

## Current System Analysis

### What Exists Today

**Visual Intelligence Agent** (`backend/src/agents/visual-intelligence.js`):
- Generates HTML widgets from learning plans
- Supports: pie-chart, line-chart, bar-chart, 3d-visualization, interactive-slider, flowchart, network-diagram, physics-simulation
- Uses Claude to generate widget code dynamically
- Libraries: Chart.js, Plotly, Three.js, D3.js
- Has fallback widgets when generation fails

**Show Widget Tool** (`backend/tools.js`):
- Inline chat widget rendering
- Self-contained HTML/CSS/JS
- CSS variable theming

**Frontend Components**:
- `WidgetFrame.jsx` - Iframe isolation with theme injection
- `WidgetLoading.jsx` - Animated loading skeleton

**Image Generator** (`backend/src/agents/image-generator.js`):
- Azure gpt-image-1.5 for educational images
- Supabase storage integration

### Current Limitations

1. **No Learning Feedback Loop** - Widgets don't report if user understood
2. **Static Widgets** - No step-by-step progression
3. **No Caching** - Same concepts regenerate widgets
4. **No Accessibility** - Missing screen reader support
5. **Limited Personalization** - Style scores not used in widget selection
6. **No Analytics** - Widget interactions not tracked
7. **No Templates** - Every widget generated from scratch
8. **No Export** - Users can't save/share widgets
9. **No Comprehension Checks** - Missing quizzes in widgets
10. **Single User** - No collaborative features

---

## Enhancement Plan

### Phase 1: Smart Widget Selection (Priority: HIGH)

**Goal**: Use personalization data to choose optimal widget types

**Changes**:

1. **Modify `_determineVisualizationType()`** to accept user profile:
```javascript
_determineVisualizationType(description, planTitle, learningStyle, profile) {
  const scores = profile?.scores || {};
  const weakTopics = profile?.weak_topics || [];

  // If topic is weak, prefer simpler visualizations
  if (weakTopics.some(t => description.toLowerCase().includes(t))) {
    return this._getSimplestVizType(description);
  }

  // Visual learners: prefer rich visuals
  if (scores.visual > 0.6) {
    return this._getVisualRichType(description);
  }

  // Kinesthetic learners: prefer interactive
  if (scores.kinesthetic > 0.5) {
    return this._getInteractiveType(description);
  }
}
```

2. **Add new visualization types**:
   - `step-by-step-animation` - For weak topics
   - `comparison-table` - For reading learners
   - `audio-visual` - For auditory learners
   - `drag-drop-exercise` - For kinesthetic learners
   - `quiz-widget` - For comprehension checks

---

### Phase 2: Interactive Comprehension Widgets (Priority: HIGH)

**Goal**: Embed learning checks directly into visualizations

**New Widget Types**:

1. **Quiz Widget** - Multiple choice after explanation
2. **Fill-in-the-Blank** - Interactive labeling
3. **Drag-Drop Matching** - Connect concepts
4. **Slider Exploration** - "What happens if X changes?"
5. **Checkpoint Widget** - "Did you understand? Yes/No"

**Implementation**:

```javascript
// New function in visual-intelligence.js
_generateComprehensionWidget(step, concept, difficulty) {
  const widgetTypes = {
    beginner: 'yes-no-check',
    intermediate: 'multiple-choice',
    advanced: 'fill-blank',
  };

  return this._buildComprehensionPrompt(
    step,
    concept,
    widgetTypes[difficulty]
  );
}
```

**Feedback Integration**:
- Track correct/incorrect answers
- Update `weak_topics` / `strong_topics` based on results
- Adjust widget complexity in real-time

---

### Phase 3: Widget Templates & Caching (Priority: MEDIUM)

**Goal**: Faster generation, consistent quality

**Template System**:

```javascript
// New file: backend/src/agents/widget-templates.js
export const WIDGET_TEMPLATES = {
  'bar-chart': {
    skeleton: `<canvas id="chart"></canvas>`,
    script: `new Chart(ctx, { type: 'bar', data: {{DATA}} })`,
    requiredFields: ['labels', 'values', 'title'],
  },
  'interactive-slider': {
    skeleton: `<input type="range" id="slider" /><div id="output"></div>`,
    script: `slider.oninput = () => { output.textContent = calculate(slider.value) }`,
    requiredFields: ['min', 'max', 'formula', 'label'],
  },
  // ... more templates
};
```

**Caching Strategy**:

1. Hash widget parameters (concept + type + style)
2. Store in `asset_cache` table
3. TTL: 7 days for static concepts, 1 day for dynamic
4. Cache hit rate tracking

**Database Schema**:
```sql
CREATE TABLE widget_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash VARCHAR(64) UNIQUE NOT NULL,
  widget_type VARCHAR(50) NOT NULL,
  widget_code TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  hit_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
```

---

### Phase 4: Step-by-Step Animated Widgets (Priority: MEDIUM)

**Goal**: Break complex concepts into digestible steps

**Features**:

1. **Progress Indicator** - "Step 2 of 5"
2. **Play/Pause Controls** - User controls pace
3. **Rewind/Forward** - Navigate steps
4. **Annotation Overlay** - Highlight key parts
5. **Speed Control** - 0.5x, 1x, 2x

**Implementation**:

```javascript
// Enhanced widget structure
{
  type: 'animated-explainer',
  steps: [
    { time: 0, action: 'show', element: '#intro', annotation: 'Start here' },
    { time: 2000, action: 'highlight', element: '#concept1' },
    { time: 4000, action: 'animate', element: '#diagram', animation: 'fadeIn' },
  ],
  controls: ['play', 'pause', 'step', 'speed'],
  totalDuration: 10000,
}
```

---

### Phase 5: Widget Analytics & Learning Insights (Priority: MEDIUM)

**Goal**: Track which widgets help learning

**Metrics to Track**:

| Metric | Description |
|--------|-------------|
| `view_duration` | Time spent viewing widget |
| `interaction_count` | Clicks, drags, slider moves |
| `replay_count` | How many times replayed |
| `completion_rate` | % of animation watched |
| `quiz_score` | Comprehension check results |
| `skip_rate` | How often widget skipped |

**Database Schema**:
```sql
CREATE TABLE widget_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id),
  widget_id VARCHAR(100) NOT NULL,
  widget_type VARCHAR(50) NOT NULL,
  topic VARCHAR(200),
  view_duration_ms INT DEFAULT 0,
  interaction_count INT DEFAULT 0,
  completion_rate FLOAT DEFAULT 0,
  quiz_score FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Frontend Integration**:
```javascript
// WidgetFrame.jsx - add analytics tracking
useEffect(() => {
  const startTime = Date.now();
  let interactions = 0;

  const handleInteraction = () => interactions++;
  window.addEventListener('message', (e) => {
    if (e.data?.type === 'widget_interaction') {
      interactions++;
    }
  });

  return () => {
    // Send analytics on unmount
    trackWidgetAnalytics({
      widgetId: widget.id,
      viewDuration: Date.now() - startTime,
      interactionCount: interactions,
    });
  };
}, [widget.id]);
```

---

### Phase 6: Accessibility Enhancements (Priority: HIGH)

**Goal**: Make widgets usable for all learners

**Features**:

1. **ARIA Labels** - Screen reader descriptions
2. **Keyboard Navigation** - Tab through interactive elements
3. **Color Blind Modes** - Pattern/texture alternatives
4. **Text Alternatives** - Describe visuals in words
5. **Reduced Motion** - Disable animations option

**Implementation**:

```javascript
// Add to widget generation prompt
const accessibilityInstructions = `
ACCESSIBILITY REQUIREMENTS:
- Add aria-label to all interactive elements
- Ensure 4.5:1 color contrast ratio
- Support keyboard navigation (tabindex, focus states)
- Include <title> and <desc> for SVGs
- Add role="img" with aria-describedby for charts
`;
```

---

### Phase 7: Export & Share (Priority: LOW)

**Goal**: Let users save and share learning widgets

**Features**:

1. **Download as PNG** - Screenshot widget
2. **Download as HTML** - Standalone file
3. **Share Link** - Public URL with embed
4. **Export to PDF** - With explanation text
5. **Embed Code** - iframe snippet

**API Endpoints**:
```
GET /api/widget/:id/export?format=png
GET /api/widget/:id/export?format=html
GET /api/widget/:id/share
```

---

### Phase 8: Real-time Collaboration (Priority: LOW)

**Goal**: Multiple users interact with same widget

**Features**:

1. **Shared Cursors** - See where others click
2. **Synchronized State** - Same slider values
3. **Chat Overlay** - Discuss within widget
4. **Teacher Mode** - Instructor controls, students view

**Technology**: WebSocket rooms per widget

---

## Implementation Priority

| Phase | Priority | Effort | Impact |
|-------|----------|--------|--------|
| 1. Smart Widget Selection | HIGH | Medium | HIGH |
| 2. Comprehension Widgets | HIGH | High | HIGH |
| 6. Accessibility | HIGH | Medium | HIGH |
| 3. Templates & Caching | MEDIUM | Medium | MEDIUM |
| 4. Animated Widgets | MEDIUM | High | HIGH |
| 5. Analytics | MEDIUM | Medium | MEDIUM |
| 7. Export & Share | LOW | Low | LOW |
| 8. Collaboration | LOW | High | MEDIUM |

---

## Recommended First Steps

1. **Integrate personalization scores** into widget type selection
2. **Add comprehension check widgets** after each major concept
3. **Implement widget analytics** to track learning effectiveness
4. **Add ARIA labels** to all generated widgets
5. **Create widget templates** for top 5 most-used types

---

## New Files to Create

```
backend/src/agents/
├── widget-templates.js      # Template definitions
├── widget-analytics.js      # Analytics tracking
├── comprehension-widgets.js # Quiz/check widgets

backend/src/services/
├── widget-cache.js          # Caching layer

frontend/src/components/
├── WidgetControls.jsx       # Play/pause/speed controls
├── WidgetQuiz.jsx           # Comprehension check UI
├── WidgetExport.jsx         # Export/share modal

backend/migrations/
├── 002_widget_analytics.sql # Analytics tables
├── 003_widget_cache.sql     # Cache tables
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Widget engagement rate | Unknown | >70% |
| Comprehension check pass rate | N/A | >80% |
| Widget generation time | ~3s | <1s (cached) |
| Accessibility score | Unknown | WCAG AA |
| User satisfaction (widgets) | Unknown | >4.5/5 |

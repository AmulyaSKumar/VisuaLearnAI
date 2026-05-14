/**
 * Visual Intelligence Agent (Phase 9B)
 * Generates interactive widgets and diagrams based on learning plans
 * Adapts visualizations to detected learning style (VARK)
 * Includes semantic 3D detection and device capability handling
 * @module agents/visual-intelligence
 */

import { BaseAgent } from './base-agent.js';
import { logger } from '../utils/logger.js';
import { CDN_VERSIONS, THREE_JS_GUIDELINES } from '../services/openai/prompts.js';
import { createTextCompletion } from '../services/openai/azure-client.js';

/**
 * Semantic 3D visualization detection
 * Returns a score-based decision on whether to use 3D
 * @param {string} query - User query
 * @param {Object} context - Additional context
 * @returns {Object} { use3D, score, reason, breakdown }
 */
export function should3DVisualize(query, context = {}) {
  const score = {
    spatialRequired: 0,
    interactionHelps: 0,
    topicNaturally3D: 0,
    userExplicitlyAsked: 0,
  };

  const queryLower = query.toLowerCase();

  // 1. Topic naturally 3D (+30)
  const natural3DTopics = [
    /molecule|atom|protein|dna|rna|chemical structure|molecular|amino acid/i,
    /3d model|three dimensional|spatial|three-d/i,
    /orbit|planet|solar system|astronomy|celestial|satellite/i,
    /crystal|lattice|unit cell|crystallography/i,
    /vector|3d vector|cross product|dot product.*3d/i,
    /surface plot|3d graph|3d scatter|3d chart/i,
    /polyhedron|tetrahedron|octahedron|icosahedron|dodecahedron/i,
    /cube|sphere|cylinder|cone|torus|prism/i,
    /rotation|quaternion|euler angles/i,
    /terrain|topology|elevation|contour/i,
    // Mechanical/Engineering parts
    /engine|motor|turbine|compressor|pump/i,
    /gear|gearbox|transmission|drivetrain|differential/i,
    /piston|crankshaft|camshaft|valve|cylinder head/i,
    /bearing|shaft|axle|rotor|stator/i,
    /suspension|brake|caliper|disc brake|drum brake/i,
    /mechanism|linkage|lever|pulley|cam/i,
    /robot|robotic arm|actuator|servo/i,
    /hydraulic|pneumatic|mechanical assembly/i,
    // Architecture/Structures
    /building|structure|bridge|truss|beam/i,
    /architecture|floor plan|3d house|3d building/i,
  ];
  if (natural3DTopics.some(p => p.test(query))) {
    score.topicNaturally3D = 30;
  }

  // 2. Spatial understanding required (+40)
  const spatialIndicators = [
    /bond angle|molecular geometry|structure|configuration/i,
    /rotate|orientation|perspective|viewpoint/i,
    /depth|distance|position in space|coordinate/i,
    /spatial relationship|arrangement|configuration/i,
    /shape|form|morphology|topology/i,
    // Mechanical spatial terms
    /how .*work(s|ing)?|working principle|internal|cross.?section/i,
    /assembly|disassembly|exploded view|cutaway/i,
    /movement|motion|rotation|reciprocating/i,
    /components|parts|internals|inside/i,
  ];
  if (spatialIndicators.some(p => p.test(query))) {
    score.spatialRequired = 40;
  }

  // 3. User explicitly asked (+50)
  const explicitRequest = [
    /show me.*(3d|three-?d|visualization|model)/i,
    /create.*(3d|model|interactive.*3d)/i,
    /visualize.*(3d|spatially|in three dimensions)/i,
    /render.*(3d|three-?d)/i,
    /3d.*(view|visualization|model|render)/i,
  ];
  if (explicitRequest.some(p => p.test(query))) {
    score.userExplicitlyAsked = 50;
  }

  // 4. Interaction helps learning (+20)
  const interactionIndicators = [
    /explore|manipulate|interact|rotate|zoom|pan/i,
    /from different angles|all sides|around/i,
  ];
  if (interactionIndicators.some(p => p.test(query))) {
    score.interactionHelps = 20;
  }

  // NEGATIVE: Concept-only mentions (-30)
  const conceptOnly = [
    /formula|equation|calculate|compute|solve/i,
    /definition|what is|explain the concept|meaning of/i,
    /spherical coordinates|polar coordinates|cylindrical coordinates/i,
    /history of|who invented|when was/i,
    /compare|difference between|versus/i,
  ];
  if (conceptOnly.some(p => p.test(query)) && score.userExplicitlyAsked === 0) {
    score.spatialRequired -= 30;
  }

  // NEGATIVE: Clearly 2D topics (-50)
  const clearly2D = [
    /sort|sorting|bubble sort|quick sort|merge sort/i,
    /flowchart|flow chart|diagram|timeline/i,
    /bar chart|pie chart|line chart|histogram/i,
    /tree|binary tree|linked list|array|stack|queue/i,
  ];
  if (clearly2D.some(p => p.test(query)) && score.userExplicitlyAsked === 0) {
    score.topicNaturally3D -= 50;
  }

  const total = Object.values(score).reduce((a, b) => a + b, 0);

  return {
    use3D: total >= 50,
    score: total,
    reason: total >= 50 ? '3D helps spatial understanding' : 'Text/2D sufficient',
    breakdown: score,
  };
}

/**
 * Get complexity level based on device capabilities
 * @param {Object} capabilities - Device capabilities from frontend
 * @returns {string} 'high' | 'medium' | 'low'
 */
export function get3DComplexityLevel(capabilities = {}) {
  const { webgl = true, memory = 4, cores = 4, mobile = false, saveData = false } = capabilities;

  if (!webgl) return 'none';
  if (saveData || (mobile && memory < 3)) return 'low';
  if (mobile || memory < 4 || cores < 4) return 'medium';
  return 'high';
}

export class VisualIntelligenceAgent extends BaseAgent {
  /**
   * Retry configuration for VisualIntelligenceAgent
   * Lower retries to fail fast and allow fallback to empty widgets
   */
  static retryConfig = { maxRetries: 2 };

  constructor() {
    super(
      'visual-intelligence',
      'Generates interactive widgets and visualizations from learning content',
      '1.0.0'
    );

    // Widget library instructions for the configured chat model with locked versions
    this.libInstructions = {
      chartjs: `Chart.js 4.4.1 from CDN: ${CDN_VERSIONS.chartjs}`,
      plotly: `Plotly.js from CDN: ${CDN_VERSIONS.plotly}`,
      threejs: `Three.js 0.152.2 from CDN: ${CDN_VERSIONS.threejs}`,
      threejsOrbit: `OrbitControls from CDN: ${CDN_VERSIONS.orbitControls}`,
      d3: `D3.js from CDN: ${CDN_VERSIONS.d3}`,
    };
  }

  /**
   * Generate widgets for learning plan steps
   * @param {Object} input - { plan: Object, learningStyle?: string, topicsOfInterest?: string[] }
   * @param {Object} context - { userId?: string, userProfile?: Object }
   * @returns {Object} Array of widget definitions with code and metadata
   */
  async execute(input, context = {}) {
    this.validateInput(input, ['plan']);

    const { plan, learningStyle = 'visual', topicsOfInterest = [] } = input;
    const { userId, userProfile = {} } = context;

    logger.info('Visual Intelligence: Starting widget generation', {
      planTitle: plan.title,
      steps: plan.steps?.length,
      learningStyle,
      userId,
    });

    try {
      // Validate plan structure
      if (!plan.steps || !Array.isArray(plan.steps)) {
        throw new Error('Plan must have steps array');
      }

      // Generate widgets for each step
      const widgets = [];
      for (const step of plan.steps) {
        const stepWidgets = await this._generateStepWidgets(step, plan, learningStyle);
        widgets.push(...stepWidgets);
      }

      logger.info('Visual Intelligence: Widget generation complete', {
        totalWidgets: widgets.length,
        planTitle: plan.title,
      });

      return {
        plan,
        widgets,
        learningStyle,
        generatedAt: new Date().toISOString(),
        userId,
      };
    } catch (error) {
      logger.error('Visual Intelligence: Widget generation failed', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Generate widgets for a single plan step
   */
  async _generateStepWidgets(step, plan, learningStyle) {
    const widgets = [];

    // Determine which visualization types to generate based on step resources
    if (!step.resources || step.resources.length === 0) {
      return widgets;
    }

    for (const resource of step.resources) {
      // Skip non-visualization resources
      if (resource.type !== 'visualization') {
        continue;
      }

      // Determine visualization type from description
      const vizType = this._determineVisualizationType(
        resource.description,
        plan.title,
        learningStyle
      );

      // Generate widget code
      const widget = await this._generateWidget(
        step,
        resource,
        vizType,
        plan.title,
        learningStyle
      );

      if (widget) {
        widgets.push(widget);
      }
    }

    return widgets;
  }

  /**
   * Determine visualization type from description
   */
  _determineVisualizationType(description, planTitle, learningStyle) {
    const lowerDesc = description.toLowerCase();

    // Check specific keywords first (before general ones)
    if (lowerDesc.includes('3d') || lowerDesc.includes('three.js') || lowerDesc.includes('molecular')) {
      return '3d-visualization';
    }

    // Network and graph types (before chart)
    if ((lowerDesc.includes('network') || lowerDesc.includes('relationship')) && !lowerDesc.includes('chart')) {
      return 'network-diagram';
    }

    // Simulation types
    if (lowerDesc.includes('simulation') || lowerDesc.includes('simulate') || lowerDesc.includes('physics')) {
      return 'physics-simulation';
    }

    // Chart types
    if (lowerDesc.includes('chart') || lowerDesc.includes('graph')) {
      if (lowerDesc.includes('pie')) return 'pie-chart';
      if (lowerDesc.includes('line')) return 'line-chart';
      if (lowerDesc.includes('bar')) return 'bar-chart';
      return 'bar-chart';
    }

    // Interactive types
    if (lowerDesc.includes('interactive') || lowerDesc.includes('slider')) {
      if (lowerDesc.includes('slider')) return 'interactive-slider';
      return 'interactive-visualization';
    }

    // Diagram types
    if (lowerDesc.includes('diagram') || lowerDesc.includes('flow')) {
      return 'flowchart';
    }

    // Default based on learning style
    if (learningStyle === 'kinesthetic') {
      return 'interactive-slider';
    }

    // Default to bar chart
    return 'bar-chart';
  }

  /**
   * Generate complete widget HTML code
   */
  async _generateWidget(step, resource, vizType, planTitle, learningStyle) {
    const widgetId = `${planTitle}-${step.number}`.replace(/\s+/g, '-').toLowerCase();

    // Build prompt for the configured chat model to generate widget
    const prompt = this._buildWidgetPrompt(step, resource, vizType, planTitle, learningStyle);

    try {
      // Call the configured model to generate widget code
      const widgetCode = await this._generateWidgetWithModel(prompt, vizType);

      return {
        id: widgetId,
        step: step.number,
        type: vizType,
        title: `${step.title} - ${this._vizTypeLabel(vizType)}`,
        code: widgetCode,
        description: resource.description,
        learningStyle,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.warn('Visual Intelligence: Widget generation failed for step', {
        step: step.number,
        vizType,
        error: error.message,
      });

      // Return fallback widget
      return this._getFallbackWidget(step, vizType, planTitle);
    }
  }

  /**
   * Build prompt for widget generation
   */
  _buildWidgetPrompt(step, resource, vizType, planTitle, learningStyle, deviceCapabilities = {}) {
    const libInstructions = Object.values(this.libInstructions).join('\n');
    const is3D = vizType === '3d-visualization';
    const complexityLevel = get3DComplexityLevel(deviceCapabilities);

    let complexityInstructions = '';
    if (is3D) {
      if (complexityLevel === 'low') {
        complexityInstructions = `
DEVICE OPTIMIZATION (Low-end device):
- Use minimal polygons (< 1000 total)
- No shadows or post-processing
- Use MeshBasicMaterial instead of MeshStandardMaterial
- Limit to static rendering (no continuous animation)
- Reduce texture sizes`;
      } else if (complexityLevel === 'medium') {
        complexityInstructions = `
DEVICE OPTIMIZATION (Medium device):
- Keep polygons reasonable (< 5000 total)
- Minimal shadows
- Pause animation when not visible`;
      }
    }

    const base = `Generate interactive HTML widget code for educational learning.

CONTEXT:
Plan: "${planTitle}"
Step ${step.number}: "${step.title}"
Description: ${step.description}
Visualization Request: ${resource.description}
Visualization Type: ${vizType}
Learning Style: ${learningStyle}

REQUIREMENTS:
- Complete self-contained HTML (no external dependencies except CDN)
- Must include <style>, HTML body, and <script>
- Use CSS variables: var(--color-primary), var(--color-background), var(--color-foreground), var(--color-muted)
- Make it interactive with sliders, buttons, or hover effects
- Keep code clean, no comments
- Under 2KB when possible

AVAILABLE LIBRARIES:
${libInstructions}
${complexityInstructions}`;

    // Add 3D-specific guidelines
    if (is3D) {
      return `${base}

${THREE_JS_GUIDELINES}

CRITICAL 3D REQUIREMENTS:
1. Include WebGL detection at start of script
2. Wrap Three.js code in try-catch
3. Include IntersectionObserver for visibility-based pause
4. Include cleanup on beforeunload
5. Use a container div with id="container"

Generate the complete HTML widget code now:`;
    }

    return `${base}

Generate the complete HTML widget code now:`;
  }

  /**
   * Call the configured model to generate widget code
   */
  async _generateWidgetWithModel(prompt, vizType) {
    try {
      const responseText = await createTextCompletion({
        maxTokens: 1500,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // Extract HTML from response
      const htmlMatch = responseText.match(/<html[\s\S]*?<\/html>/i) ||
        responseText.match(/<div[\s\S]*?<\/div>/i) ||
        responseText.match(/<script[\s\S]*?<\/script>/i);

      if (htmlMatch) {
        return htmlMatch[0];
      }

      // If no HTML found, return response as-is (might be wrapped in ```html```)
      if (responseText.includes('<')) {
        return responseText;
      }

      // Fallback: widget code not properly generated
      throw new Error('No HTML widget code in response');
    } catch (error) {
      logger.debug('Visual Intelligence: widget generation failed', {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get label for visualization type
   */
  _vizTypeLabel(vizType) {
    const labels = {
      'pie-chart': 'Pie Chart',
      'line-chart': 'Line Chart',
      'bar-chart': 'Bar Chart',
      '3d-visualization': '3D Visualization',
      'interactive-slider': 'Interactive Slider',
      'interactive-visualization': 'Interactive Tool',
      flowchart: 'Flowchart',
      'network-diagram': 'Network Diagram',
      'physics-simulation': 'Physics Simulation',
    };
    return labels[vizType] || 'Visualization';
  }

  /**
   * Return fallback widget when model generation fails
   */
  _getFallbackWidget(step, vizType, planTitle) {
    const widgetId = `${planTitle}-${step.number}`.replace(/\s+/g, '-').toLowerCase();

    // Generate simple fallback widget based on type
    let fallbackCode = this._generateFallbackCode(vizType, step.title);

    return {
      id: widgetId,
      step: step.number,
      type: vizType,
      title: `${step.title} - ${this._vizTypeLabel(vizType)}`,
      code: fallbackCode,
      description: `Fallback visualization for: ${step.description}`,
      isFallback: true,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate fallback HTML widget code
   */
  _generateFallbackCode(vizType, stepTitle) {
    // Simple fallback widget that works for all types
    return `<div style="padding: 20px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-card); color: var(--color-foreground);">
  <h3 style="margin: 0 0 10px 0; font-size: 18px; color: var(--color-primary);">${stepTitle}</h3>
  <p style="margin: 0 0 15px 0; font-size: 14px; color: var(--color-muted);">Interactive ${this._vizTypeLabel(vizType)}</p>
  <div id="chart" style="width: 100%; height: 300px; display: flex; align-items: center; justify-content: center; background: var(--color-background); border-radius: 4px;">
    <div style="text-align: center;">
      <div style="font-size: 48px; color: var(--color-primary); margin-bottom: 10px;">📊</div>
      <p style="color: var(--color-muted);">Visualization Loading...</p>
      <p style="font-size: 12px; color: var(--color-muted); margin-top: 5px;">Rendering ${this._vizTypeLabel(vizType)}</p>
    </div>
  </div>
  <button id="toggle" style="margin-top: 15px; padding: 8px 16px; background: var(--color-primary); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">Toggle Data</button>
  <script>
    let dataVisible = true;
    document.getElementById('toggle').addEventListener('click', () => {
      dataVisible = !dataVisible;
      document.getElementById('toggle').textContent = dataVisible ? 'Hide Data' : 'Show Data';
    });
  </script>
</div>`;
  }

  /**
   * Lifecycle hook: Validate input
   */
  async beforeExecute(input, context) {
    logger.debug(`[${this.name}] Validating learning plan...`, {
      hasSteps: !!input.plan?.steps,
      stepCount: input.plan?.steps?.length,
    });
    return { input, context };
  }

  /**
   * Lifecycle hook: Validate output
   */
  async afterExecute(result, context) {
    if (!result.widgets || !Array.isArray(result.widgets)) {
      throw new Error('Invalid result: widgets must be an array');
    }

    logger.info(`[${this.name}] Widget generation validated`, {
      totalWidgets: result.widgets.length,
      fallbackCount: result.widgets.filter(w => w.isFallback).length,
    });

    return result;
  }
}

export default VisualIntelligenceAgent;

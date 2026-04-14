/**
 * Visual Intelligence Agent (Phase 9B)
 * Generates interactive widgets and diagrams based on learning plans
 * Adapts visualizations to detected learning style (VARK)
 * @module agents/visual-intelligence
 */

import { BaseAgent } from './base-agent.js';
import { config } from '../config/environment.js';
import { logger } from '../utils/logger.js';

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

    // Widget library instructions for Claude
    this.libInstructions = {
      chartjs:
        'Chart.js 4.4.1 from CDN: https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js',
      plotly:
        'Plotly.js from CDN: https://cdn.plot.ly/plotly-latest.min.js (window.Plotly)',
      threejs: 'Three.js from CDN: https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
      d3: 'D3.js from CDN: https://d3js.org/d3.v7.min.js',
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

    // Build prompt for Claude to generate widget
    const prompt = this._buildWidgetPrompt(step, resource, vizType, planTitle, learningStyle);

    try {
      // Call Claude to generate widget code
      const widgetCode = await this._generateWidgetWithClaude(prompt, vizType);

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
   * Build Claude prompt for widget generation
   */
  _buildWidgetPrompt(step, resource, vizType, planTitle, learningStyle) {
    const libInstructions = Object.values(this.libInstructions).join('\n');

    return `Generate interactive HTML widget code for educational learning.

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

Generate the complete HTML widget code now:`;
  }

  /**
   * Call Claude to generate widget code
   */
  async _generateWidgetWithClaude(prompt, vizType) {
    try {
      const { Anthropic } = await import('@anthropic-ai/sdk');

      const client = new Anthropic({
        apiKey: config.anthropic.apiKey,
        baseURL: config.anthropic.baseUrl,
      });

      // Use sonnet model for visual intelligence - better quality for complex widget generation
      const message = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const responseText = message.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');

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
      logger.debug('Visual Intelligence: Claude widget generation failed', {
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
   * Return fallback widget when Claude fails
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

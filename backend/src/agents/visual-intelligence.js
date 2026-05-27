import { BaseAgent } from './base-agent.js';
import { logger } from '../utils/logger.js';

export class VisualIntelligenceAgent extends BaseAgent {
  static retryConfig = { maxRetries: 1 };

  constructor() {
    super(
      'visual-intelligence',
      'Generates declarative visual specs from learning content',
      '2.0.0'
    );
  }

  async execute(input, context = {}) {
    this.validateInput(input, ['plan']);
    const { plan, learningStyle = 'visual' } = input;
    const { userId } = context;
    const widgets = [];

    logger.info('Visual Intelligence: Starting declarative spec generation', {
      planTitle: plan.title,
      steps: plan.steps?.length,
      learningStyle,
      userId,
    });

    for (const step of plan.steps || []) {
      for (const resource of step.resources || []) {
        if (resource.type !== 'visualization') continue;
        widgets.push(this._buildSpecWidget(step, resource, plan.title, learningStyle));
      }
    }

    return {
      widgets,
      metadata: {
        totalWidgets: widgets.length,
        generatedAt: new Date().toISOString(),
        model: 'declarative-renderer',
      },
    };
  }

  _buildSpecWidget(step, resource, planTitle, learningStyle) {
    const vizType = this._determineVisualizationType(resource.description || '');
    const widgetId = `${planTitle}-${step.number || widgetsSafeId(step.title)}`.replace(/\s+/g, '-').toLowerCase();

    return {
      id: widgetId,
      step: step.number,
      type: vizType,
      title: `${step.title} - ${this._vizTypeLabel(vizType)}`,
      spec: this._buildSpec(vizType, step, resource),
      description: resource.description,
      learningStyle,
      generatedAt: new Date().toISOString(),
    };
  }

  _determineVisualizationType(description = '') {
    const lower = description.toLowerCase();
    if (lower.includes('network') || lower.includes('relationship')) return 'network';
    if (lower.includes('timeline') || lower.includes('schedule')) return 'timeline';
    if (lower.includes('matrix') || lower.includes('table')) return 'matrix';
    if (lower.includes('chart') || lower.includes('graph') || lower.includes('bar')) return 'chart';
    return 'flow';
  }

  _buildSpec(vizType, step, resource) {
    const specType = ['network', 'timeline', 'matrix', 'chart'].includes(vizType) ? vizType : 'flow';
    return {
      type: specType,
      title: cleanText(step.title, 'Learning visual'),
      objects: [
        { id: 'concept', type: 'node', label: cleanText(step.title, 'Concept'), x: 20, y: 50 },
        { id: 'visual', type: 'node', label: this._vizTypeLabel(vizType), x: 50, y: 50 },
        { id: 'goal', type: 'node', label: cleanText(resource.description || step.description, 'Learning goal'), x: 80, y: 50 },
      ],
      animations: [
        { type: 'highlight', target: 'concept', step: 0 },
        { type: 'highlight', target: 'visual', step: 1 },
        { type: 'highlight', target: 'goal', step: 2 },
      ],
      controls: ['play', 'pause', 'restart', 'step', 'speed'],
      explanation: cleanText(resource.description || step.description, ''),
    };
  }

  _vizTypeLabel(vizType) {
    const labels = {
      chart: 'Chart',
      timeline: 'Timeline',
      matrix: 'Matrix',
      flow: 'Flow',
      network: 'Network',
    };
    return labels[vizType] || 'Visual Spec';
  }

  async beforeExecute(input, context) {
    logger.debug(`[${this.name}] Validating learning plan...`, {
      hasSteps: !!input.plan?.steps,
      stepCount: input.plan?.steps?.length,
    });
    return { input, context };
  }

  async afterExecute(result, context) {
    if (!result.widgets || !Array.isArray(result.widgets)) {
      throw new Error('Invalid result: widgets must be an array');
    }

    logger.info(`[${this.name}] Declarative spec generation validated`, {
      totalWidgets: result.widgets.length,
    });

    return result;
  }
}

function cleanText(value, fallback = '') {
  return String(value || fallback).replace(/[<>]/g, '').slice(0, 160);
}

function widgetsSafeId(value = 'step') {
  return String(value).replace(/[^a-z0-9]+/gi, '-').slice(0, 40);
}

export default VisualIntelligenceAgent;

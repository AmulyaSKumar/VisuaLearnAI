/**
 * Gradient Descent Generator
 * Generates step-by-step visualization of gradient descent optimization
 * Finds minimum of a function by following the negative gradient
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class GradientDescentGenerator extends BaseGenerator {
  constructor() {
    super('gradient_descent', 'math', 'Gradient Descent', {
      functionType: {
        type: 'string',
        label: 'Function',
        description: 'Function to minimize',
        default: 'quadratic' // f(x) = x^2 - 4x + 4 = (x-2)^2, minimum at x=2
      },
      startX: {
        type: 'number',
        label: 'Starting X',
        description: 'Initial x value',
        default: -2,
        validation: { min: -10, max: 10 }
      },
      learningRate: {
        type: 'number',
        label: 'Learning Rate (α)',
        description: 'Step size multiplier',
        default: 0.2,
        validation: { min: 0.01, max: 1 }
      },
      maxIterations: {
        type: 'number',
        label: 'Max Iterations',
        description: 'Maximum number of iterations',
        default: 15,
        validation: { min: 5, max: 50 }
      },
      tolerance: {
        type: 'number',
        label: 'Tolerance',
        description: 'Convergence threshold',
        default: 0.0001,
        validation: { min: 0.00001, max: 0.1 }
      }
    });

    this.setDescription('Find function minimum by iteratively moving in the direction of steepest descent (negative gradient).');
    this.setComplexity('O(n)', 'O(1)');
  }

  // Available functions and their derivatives
  getFunctions() {
    return {
      quadratic: {
        name: 'f(x) = x² - 4x + 4',
        f: (x) => x * x - 4 * x + 4,
        df: (x) => 2 * x - 4,
        minimum: { x: 2, y: 0 },
        domain: [-3, 7]
      },
      cubic: {
        name: 'f(x) = x³ - 6x² + 9x + 1',
        f: (x) => x * x * x - 6 * x * x + 9 * x + 1,
        df: (x) => 3 * x * x - 12 * x + 9,
        minimum: { x: 3, y: 1 },
        domain: [-1, 5]
      },
      sinusoidal: {
        name: 'f(x) = x² + 2sin(x)',
        f: (x) => x * x + 2 * Math.sin(x),
        df: (x) => 2 * x + 2 * Math.cos(x),
        minimum: { x: -0.45, y: -0.67 },
        domain: [-4, 4]
      }
    };
  }

  doGenerate(inputs) {
    const { functionType, startX, learningRate, maxIterations, tolerance } = inputs;
    const steps = [];
    let stepNum = 1;

    const functions = this.getFunctions();
    const func = functions[functionType] || functions.quadratic;

    // Generate function points for visualization
    const functionPoints = [];
    const [domainMin, domainMax] = func.domain;
    for (let x = domainMin; x <= domainMax; x += 0.1) {
      functionPoints.push({ x: parseFloat(x.toFixed(2)), y: parseFloat(func.f(x).toFixed(4)) });
    }

    // Initial state
    let x = startX;
    let y = func.f(x);
    const history = [{ x, y, gradient: func.df(x) }];

    steps.push(this.createStep(
      stepNum++,
      {
        functionPoints,
        functionName: func.name,
        currentPoint: { x, y },
        history: [...history],
        variables: {
          learningRate,
          iteration: 0,
          x: x.toFixed(4),
          'f(x)': y.toFixed(4)
        }
      },
      {
        currentPoint: { x, y },
        functionDomain: func.domain
      },
      'start',
      `Gradient Descent: Minimize ${func.name}. Starting at x = ${x.toFixed(2)}, f(x) = ${y.toFixed(4)}`
    ));

    // Gradient descent iterations
    let converged = false;
    let iteration = 0;

    while (iteration < maxIterations && !converged) {
      iteration++;
      const gradient = func.df(x);

      steps.push(this.createStep(
        stepNum++,
        {
          functionPoints,
          functionName: func.name,
          currentPoint: { x, y },
          history: [...history],
          variables: {
            iteration,
            x: x.toFixed(4),
            'f(x)': y.toFixed(4),
            '∇f(x)': gradient.toFixed(4),
            learningRate
          }
        },
        {
          currentPoint: { x, y },
          gradient,
          showGradient: true
        },
        'compute_gradient',
        `Iteration ${iteration}: At x = ${x.toFixed(4)}, gradient ∇f(x) = ${gradient.toFixed(4)}`
      ));

      // Update x
      const prevX = x;
      const prevY = y;
      x = x - learningRate * gradient;
      y = func.f(x);

      // Clamp to domain
      x = Math.max(domainMin, Math.min(domainMax, x));
      y = func.f(x);

      history.push({ x, y, gradient: func.df(x) });

      steps.push(this.createStep(
        stepNum++,
        {
          functionPoints,
          functionName: func.name,
          currentPoint: { x, y },
          previousPoint: { x: prevX, y: prevY },
          history: [...history],
          variables: {
            iteration,
            'x_new': x.toFixed(4),
            'f(x_new)': y.toFixed(4),
            'Δx': (x - prevX).toFixed(4),
            'Δf': (y - prevY).toFixed(4)
          }
        },
        {
          currentPoint: { x, y },
          previousPoint: { x: prevX, y: prevY },
          moved: true
        },
        'update',
        `x = ${prevX.toFixed(4)} - ${learningRate} × ${gradient.toFixed(4)} = ${x.toFixed(4)}, f(x) = ${y.toFixed(4)}`
      ));

      // Check convergence
      if (Math.abs(x - prevX) < tolerance) {
        converged = true;
        steps.push(this.createStep(
          stepNum++,
          {
            functionPoints,
            functionName: func.name,
            currentPoint: { x, y },
            history: [...history],
            variables: {
              iteration,
              converged: true,
              'Δx': Math.abs(x - prevX).toFixed(6)
            }
          },
          {
            currentPoint: { x, y },
            converged: true
          },
          'converged',
          `Converged! |Δx| = ${Math.abs(x - prevX).toFixed(6)} < tolerance ${tolerance}`
        ));
      }
    }

    // Final result
    const distanceToMinimum = Math.abs(x - func.minimum.x);
    steps.push(this.createStep(
      stepNum,
      {
        functionPoints,
        functionName: func.name,
        currentPoint: { x, y },
        minimum: func.minimum,
        history: [...history],
        variables: {
          'Final x': x.toFixed(4),
          'Final f(x)': y.toFixed(4),
          'True minimum': `x = ${func.minimum.x}`,
          'Error': distanceToMinimum.toFixed(4),
          'Iterations': iteration
        }
      },
      {
        currentPoint: { x, y },
        minimum: func.minimum,
        complete: true,
        history
      },
      'complete',
      `Complete! Found minimum at x ≈ ${x.toFixed(4)}, f(x) ≈ ${y.toFixed(4)} in ${iteration} iterations`
    ));

    return this.buildIR(inputs, { functionPoints, functionName: func.name }, steps);
  }
}

// Register the generator
registry.register(new GradientDescentGenerator());

export default GradientDescentGenerator;

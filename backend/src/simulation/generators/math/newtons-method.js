/**
 * Newton's Method Generator
 * Generates step-by-step visualization of Newton's method for root finding
 * Finds zeros of a function using tangent line approximation
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class NewtonsMethodGenerator extends BaseGenerator {
  constructor() {
    super('newtons_method', 'math', "Newton's Method", {
      functionType: {
        type: 'string',
        label: 'Function',
        description: 'Function to find root of',
        default: 'quadratic' // f(x) = x^2 - 4, roots at x = ±2
      },
      startX: {
        type: 'number',
        label: 'Starting X',
        description: 'Initial guess',
        default: 5,
        validation: { min: -10, max: 10 }
      },
      maxIterations: {
        type: 'number',
        label: 'Max Iterations',
        description: 'Maximum number of iterations',
        default: 10,
        validation: { min: 3, max: 30 }
      },
      tolerance: {
        type: 'number',
        label: 'Tolerance',
        description: 'Convergence threshold',
        default: 0.0001,
        validation: { min: 0.00001, max: 0.1 }
      }
    });

    this.setDescription("Find function roots using tangent line intersection with x-axis. Quadratic convergence near roots.");
    this.setComplexity('O(n)', 'O(1)');
  }

  // Available functions and their derivatives
  getFunctions() {
    return {
      quadratic: {
        name: 'f(x) = x² - 4',
        f: (x) => x * x - 4,
        df: (x) => 2 * x,
        roots: [2, -2],
        domain: [-5, 6]
      },
      cubic: {
        name: 'f(x) = x³ - x - 2',
        f: (x) => x * x * x - x - 2,
        df: (x) => 3 * x * x - 1,
        roots: [1.521],
        domain: [-2, 4]
      },
      trigonometric: {
        name: 'f(x) = cos(x) - x',
        f: (x) => Math.cos(x) - x,
        df: (x) => -Math.sin(x) - 1,
        roots: [0.739],
        domain: [-2, 3]
      },
      exponential: {
        name: 'f(x) = eˣ - 3x',
        f: (x) => Math.exp(x) - 3 * x,
        df: (x) => Math.exp(x) - 3,
        roots: [0.619, 1.512],
        domain: [-1, 3]
      }
    };
  }

  doGenerate(inputs) {
    const { functionType, startX, maxIterations, tolerance } = inputs;
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
    const history = [{ x, y, derivative: func.df(x) }];

    steps.push(this.createStep(
      stepNum++,
      {
        functionPoints,
        functionName: func.name,
        currentPoint: { x, y },
        history: [...history],
        roots: func.roots,
        variables: {
          iteration: 0,
          x: x.toFixed(4),
          'f(x)': y.toFixed(4)
        }
      },
      {
        currentPoint: { x, y },
        functionDomain: func.domain,
        roots: func.roots
      },
      'start',
      `Newton's Method: Find root of ${func.name}. Starting at x = ${x.toFixed(2)}`
    ));

    // Newton's method iterations
    let converged = false;
    let iteration = 0;
    let error = null;

    while (iteration < maxIterations && !converged && !error) {
      iteration++;

      const fx = func.f(x);
      const dfx = func.df(x);

      // Check for zero derivative (would cause division by zero)
      if (Math.abs(dfx) < 1e-10) {
        error = 'Zero derivative';
        steps.push(this.createStep(
          stepNum++,
          {
            functionPoints,
            functionName: func.name,
            currentPoint: { x, y },
            history: [...history],
            variables: {
              iteration,
              error: 'Zero derivative encountered'
            }
          },
          {
            currentPoint: { x, y },
            error: true
          },
          'error',
          `Error: Derivative f'(${x.toFixed(4)}) ≈ 0. Cannot continue.`
        ));
        break;
      }

      // Show tangent line calculation
      const tangentSlope = dfx;
      const tangentIntercept = y - tangentSlope * x;

      steps.push(this.createStep(
        stepNum++,
        {
          functionPoints,
          functionName: func.name,
          currentPoint: { x, y },
          tangentLine: { slope: tangentSlope, intercept: tangentIntercept },
          history: [...history],
          variables: {
            iteration,
            x: x.toFixed(4),
            'f(x)': fx.toFixed(4),
            "f'(x)": dfx.toFixed(4)
          }
        },
        {
          currentPoint: { x, y },
          tangentLine: { slope: tangentSlope, intercept: tangentIntercept },
          showTangent: true
        },
        'tangent',
        `Iteration ${iteration}: Tangent at x = ${x.toFixed(4)} has slope f'(x) = ${dfx.toFixed(4)}`
      ));

      // Newton's update: x_new = x - f(x)/f'(x)
      const prevX = x;
      const prevY = y;
      x = x - fx / dfx;
      y = func.f(x);

      // Clamp to domain
      if (x < domainMin || x > domainMax) {
        x = Math.max(domainMin, Math.min(domainMax, x));
        y = func.f(x);
      }

      history.push({ x, y, derivative: func.df(x) });

      // Calculate tangent-x intercept for visualization
      const xIntercept = -tangentIntercept / tangentSlope;

      steps.push(this.createStep(
        stepNum++,
        {
          functionPoints,
          functionName: func.name,
          currentPoint: { x, y },
          previousPoint: { x: prevX, y: prevY },
          tangentLine: { slope: tangentSlope, intercept: tangentIntercept, xIntercept },
          history: [...history],
          variables: {
            iteration,
            formula: `x - f(x)/f'(x)`,
            calculation: `${prevX.toFixed(4)} - ${fx.toFixed(4)}/${dfx.toFixed(4)}`,
            'x_new': x.toFixed(4),
            'f(x_new)': y.toFixed(4)
          }
        },
        {
          currentPoint: { x, y },
          previousPoint: { x: prevX, y: prevY },
          xIntercept,
          moved: true
        },
        'update',
        `x_new = ${prevX.toFixed(4)} - ${fx.toFixed(4)}/${dfx.toFixed(4)} = ${x.toFixed(4)}`
      ));

      // Check convergence
      if (Math.abs(y) < tolerance || Math.abs(x - prevX) < tolerance) {
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
              '|f(x)|': Math.abs(y).toFixed(6)
            }
          },
          {
            currentPoint: { x, y },
            converged: true
          },
          'converged',
          `Converged! |f(x)| = ${Math.abs(y).toFixed(6)} < tolerance ${tolerance}`
        ));
      }
    }

    // Find closest known root
    const closestRoot = func.roots.reduce((closest, root) =>
      Math.abs(x - root) < Math.abs(x - closest) ? root : closest
    , func.roots[0]);
    const errorFromRoot = Math.abs(x - closestRoot);

    // Final result
    steps.push(this.createStep(
      stepNum,
      {
        functionPoints,
        functionName: func.name,
        currentPoint: { x, y },
        history: [...history],
        roots: func.roots,
        variables: {
          'Found root': x.toFixed(6),
          'f(root)': y.toFixed(6),
          'Closest true root': closestRoot.toFixed(4),
          'Error': errorFromRoot.toFixed(6),
          'Iterations': iteration
        }
      },
      {
        currentPoint: { x, y },
        roots: func.roots,
        complete: true,
        foundRoot: x,
        history
      },
      'complete',
      `Complete! Root found at x ≈ ${x.toFixed(6)} where f(x) ≈ ${y.toFixed(6)} in ${iteration} iterations`
    ));

    return this.buildIR(inputs, { functionPoints, functionName: func.name, roots: func.roots }, steps);
  }
}

// Register the generator
registry.register(new NewtonsMethodGenerator());

export default NewtonsMethodGenerator;

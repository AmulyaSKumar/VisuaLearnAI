/**
 * Simulation IR Schema
 * Universal schema for all simulation types using Zod validation
 */
import { z } from 'zod';

// Input field schema
export const InputFieldSchema = z.object({
  type: z.enum(['array', 'number', 'string', 'graph', 'tree', 'grid']),
  label: z.string(),
  description: z.string().optional(),
  validation: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    pattern: z.string().optional(),
  }).optional(),
});

// Highlight schema
export const HighlightsSchema = z.object({
  primary: z.array(z.union([z.number(), z.string()])).optional(),
  secondary: z.array(z.union([z.number(), z.string()])).optional(),
  compared: z.array(z.union([z.number(), z.string()])).optional(),
  swapped: z.array(z.union([z.number(), z.string()])).optional(),
  visited: z.array(z.string()).optional(),
  current: z.union([z.string(), z.number()]).optional(),
  path: z.array(z.string()).optional(),
  sorted: z.array(z.number()).optional(),
}).passthrough();

// Step metadata schema
export const StepMetaSchema = z.object({
  action: z.string(),
  description: z.string(),
  code_line: z.number().optional(),
});

// Simulation state schema (flexible for different types)
export const SimulationStateSchema = z.object({
  array: z.array(z.number()).optional(),
  graph: z.object({
    nodes: z.array(z.string()),
    edges: z.array(z.tuple([z.string(), z.string()]).or(z.tuple([z.string(), z.string(), z.number()]))),
  }).optional(),
  tree: z.any().optional(),
  grid: z.array(z.array(z.any())).optional(),
  stack: z.array(z.any()).optional(),
  queue: z.array(z.any()).optional(),
  timeline: z.array(z.any()).optional(),
  stateMachine: z.object({
    states: z.array(z.string()),
    current: z.string(),
    transitions: z.array(z.any()),
  }).optional(),
  variables: z.record(z.any()).optional(),
}).passthrough();

// Simulation step schema
export const SimulationStepSchema = z.object({
  step: z.number(),
  state: SimulationStateSchema,
  highlights: HighlightsSchema,
  meta: StepMetaSchema,
});

// Controls schema
export const ControlsSchema = z.object({
  editable: z.boolean().default(true),
  steppable: z.boolean().default(true),
  autoplayable: z.boolean().default(true),
  speedRange: z.tuple([z.number(), z.number()]).default([100, 2000]),
});

// Complexity schema
export const ComplexitySchema = z.object({
  time: z.string(),
  space: z.string(),
});

// Inputs schema
export const InputsSchema = z.object({
  schema: z.record(InputFieldSchema),
  values: z.record(z.any()),
  defaults: z.record(z.any()),
});

// Main Simulation IR schema
export const SimulationIRSchema = z.object({
  id: z.string(),
  type: z.enum(['array', 'graph', 'tree', 'grid', 'stack', 'timeline', 'state_machine', 'math']),
  algorithm: z.string(),
  title: z.string(),
  description: z.string(),
  inputs: InputsSchema,
  initial_state: SimulationStateSchema,
  steps: z.array(SimulationStepSchema),
  controls: ControlsSchema,
  complexity: ComplexitySchema.optional(),
});

// Classification result schema
export const ClassificationResultSchema = z.object({
  simulatable: z.boolean(),
  type: z.enum(['array', 'graph', 'tree', 'grid', 'stack', 'timeline', 'state_machine', 'math']).optional(),
  algorithm: z.string().optional(),
  generatorKey: z.string().optional(),
  inputs: z.record(z.any()).optional(),
  reason: z.string().optional(),
});

// Validation helper
export function validateSimulationIR(ir) {
  try {
    return { valid: true, data: SimulationIRSchema.parse(ir), errors: null };
  } catch (error) {
    return { valid: false, data: null, errors: error.errors };
  }
}

export function validateClassification(result) {
  try {
    return { valid: true, data: ClassificationResultSchema.parse(result), errors: null };
  } catch (error) {
    return { valid: false, data: null, errors: error.errors };
  }
}

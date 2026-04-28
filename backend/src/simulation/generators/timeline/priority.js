/**
 * Priority Scheduling Generator
 * Generates step-by-step visualization of Priority CPU scheduling
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class PrioritySchedulingGenerator extends BaseGenerator {
  constructor() {
    super('priority_scheduling', 'timeline', 'Priority Scheduling', {
      processes: {
        type: 'array',
        label: 'Processes',
        description: 'Processes with arrival, burst, and priority (lower = higher priority)',
        default: [
          { name: 'P1', arrival: 0, burst: 4, priority: 2 },
          { name: 'P2', arrival: 1, burst: 3, priority: 1 },
          { name: 'P3', arrival: 2, burst: 1, priority: 4 },
          { name: 'P4', arrival: 3, burst: 5, priority: 3 },
          { name: 'P5', arrival: 4, burst: 2, priority: 5 }
        ]
      },
      preemptive: {
        type: 'boolean',
        label: 'Preemptive',
        description: 'Allow preemption when higher priority arrives',
        default: false
      }
    });

    this.setDescription('Schedule processes based on priority. Lower priority number = higher priority.');
    this.setComplexity('O(n²)', 'O(n)');
  }

  doGenerate(inputs) {
    const { processes, preemptive } = inputs;
    const steps = [];
    let stepNum = 1;

    // Deep copy and add remaining time
    const procs = processes.map(p => ({
      ...p,
      remaining: p.burst,
      completed: false,
      startTime: -1,
      endTime: -1,
      waitTime: 0
    }));

    const timeline = [];
    let currentTime = 0;
    let completed = 0;
    const n = procs.length;

    // Initial state
    steps.push(this.createStep(
      stepNum++,
      {
        processes: procs.map(p => ({ ...p })),
        timeline: [...timeline],
        variables: {
          algorithm: preemptive ? 'Priority (Preemptive)' : 'Priority (Non-Preemptive)',
          totalProcesses: n
        }
      },
      { processes: procs.map(p => ({ ...p })), timeline: [] },
      'start',
      `Priority Scheduling (${preemptive ? 'Preemptive' : 'Non-Preemptive'}): ${n} processes`
    ));

    while (completed < n) {
      // Find available processes
      const available = procs.filter(p => p.arrival <= currentTime && !p.completed);

      if (available.length === 0) {
        // CPU idle - jump to next arrival
        const nextArrival = Math.min(...procs.filter(p => !p.completed).map(p => p.arrival));
        timeline.push({ type: 'idle', start: currentTime, end: nextArrival });

        steps.push(this.createStep(
          stepNum++,
          {
            processes: procs.map(p => ({ ...p })),
            timeline: [...timeline],
            variables: { currentTime, idle: true, nextArrival }
          },
          { processes: procs.map(p => ({ ...p })), timeline: [...timeline], idle: true },
          'idle',
          `CPU idle from ${currentTime} to ${nextArrival}. Waiting for next arrival.`
        ));

        currentTime = nextArrival;
        continue;
      }

      // Sort by priority (lower number = higher priority)
      available.sort((a, b) => a.priority - b.priority);
      const selected = available[0];

      steps.push(this.createStep(
        stepNum++,
        {
          processes: procs.map(p => ({ ...p })),
          timeline: [...timeline],
          variables: {
            currentTime,
            available: available.map(p => `${p.name}(pri=${p.priority})`).join(', '),
            selected: selected.name,
            selectedPriority: selected.priority
          }
        },
        {
          processes: procs.map(p => ({ ...p })),
          timeline: [...timeline],
          available: available.map(p => p.name),
          selected: selected.name
        },
        'select',
        `Time ${currentTime}: Select ${selected.name} (priority ${selected.priority})`
      ));

      if (selected.startTime === -1) {
        selected.startTime = currentTime;
      }

      if (preemptive) {
        // Run for 1 time unit or until next arrival
        const nextArrivals = procs
          .filter(p => p.arrival > currentTime && !p.completed)
          .map(p => p.arrival);
        const runUntil = nextArrivals.length > 0
          ? Math.min(currentTime + 1, Math.min(...nextArrivals))
          : currentTime + 1;

        const runTime = Math.min(runUntil - currentTime, selected.remaining);

        timeline.push({
          process: selected.name,
          start: currentTime,
          end: currentTime + runTime,
          priority: selected.priority
        });

        selected.remaining -= runTime;

        steps.push(this.createStep(
          stepNum++,
          {
            processes: procs.map(p => ({ ...p })),
            timeline: [...timeline],
            variables: {
              running: selected.name,
              runTime,
              remaining: selected.remaining
            }
          },
          {
            processes: procs.map(p => ({ ...p })),
            timeline: [...timeline],
            running: selected.name
          },
          'execute',
          `Execute ${selected.name} for ${runTime} unit(s). Remaining: ${selected.remaining}`
        ));

        currentTime += runTime;

        if (selected.remaining === 0) {
          selected.completed = true;
          selected.endTime = currentTime;
          selected.waitTime = selected.endTime - selected.arrival - selected.burst;
          completed++;

          steps.push(this.createStep(
            stepNum++,
            {
              processes: procs.map(p => ({ ...p })),
              timeline: [...timeline],
              variables: {
                completed: selected.name,
                endTime: selected.endTime,
                waitTime: selected.waitTime,
                turnaround: selected.endTime - selected.arrival
              }
            },
            {
              processes: procs.map(p => ({ ...p })),
              timeline: [...timeline],
              completed: selected.name
            },
            'complete',
            `${selected.name} completed at ${currentTime}. Wait=${selected.waitTime}, Turnaround=${selected.endTime - selected.arrival}`
          ));
        }
      } else {
        // Non-preemptive: run to completion
        timeline.push({
          process: selected.name,
          start: currentTime,
          end: currentTime + selected.remaining,
          priority: selected.priority
        });

        const runTime = selected.remaining;
        currentTime += runTime;
        selected.remaining = 0;
        selected.completed = true;
        selected.endTime = currentTime;
        selected.waitTime = selected.endTime - selected.arrival - selected.burst;
        completed++;

        steps.push(this.createStep(
          stepNum++,
          {
            processes: procs.map(p => ({ ...p })),
            timeline: [...timeline],
            variables: {
              completed: selected.name,
              runTime,
              endTime: selected.endTime,
              waitTime: selected.waitTime,
              turnaround: selected.endTime - selected.arrival
            }
          },
          {
            processes: procs.map(p => ({ ...p })),
            timeline: [...timeline],
            completed: selected.name
          },
          'complete',
          `${selected.name} ran for ${runTime}, completed at ${currentTime}. Wait=${selected.waitTime}`
        ));
      }
    }

    // Calculate averages
    const totalWait = procs.reduce((sum, p) => sum + p.waitTime, 0);
    const totalTurnaround = procs.reduce((sum, p) => sum + (p.endTime - p.arrival), 0);
    const avgWait = (totalWait / n).toFixed(2);
    const avgTurnaround = (totalTurnaround / n).toFixed(2);

    // Final state
    steps.push(this.createStep(
      stepNum,
      {
        processes: procs.map(p => ({ ...p })),
        timeline: [...timeline],
        variables: {
          complete: true,
          avgWaitTime: avgWait,
          avgTurnaround,
          totalTime: currentTime
        }
      },
      {
        processes: procs.map(p => ({ ...p })),
        timeline: [...timeline],
        complete: true
      },
      'complete',
      `Complete! Avg Wait: ${avgWait}, Avg Turnaround: ${avgTurnaround}`
    ));

    return this.buildIR(inputs, { processes: [], timeline: [] }, steps);
  }
}

// Register the generator
registry.register(new PrioritySchedulingGenerator());

export default PrioritySchedulingGenerator;

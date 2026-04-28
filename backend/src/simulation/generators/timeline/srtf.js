/**
 * Shortest Remaining Time First (SRTF) Generator
 * Generates step-by-step visualization of SRTF scheduling
 * This is the preemptive version of SJF
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class SRTFGenerator extends BaseGenerator {
  constructor() {
    super('srtf', 'timeline', 'Shortest Remaining Time First (SRTF)', {
      processes: {
        type: 'array',
        label: 'Processes',
        description: 'Array of processes with arrival and burst times',
        default: [
          { name: 'P1', arrival: 0, burst: 8 },
          { name: 'P2', arrival: 1, burst: 4 },
          { name: 'P3', arrival: 2, burst: 2 },
          { name: 'P4', arrival: 3, burst: 1 }
        ]
      }
    });

    this.setDescription('Preemptive SJF: Always run the process with shortest remaining time.');
    this.setComplexity('O(n²)', 'O(n)');
  }

  doGenerate(inputs) {
    const { processes } = inputs;
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
    let currentProcess = null;

    // Initial state
    steps.push(this.createStep(
      stepNum++,
      {
        processes: procs.map(p => ({ ...p })),
        timeline: [...timeline],
        variables: {
          algorithm: 'SRTF (Preemptive SJF)',
          totalProcesses: n
        }
      },
      { processes: procs.map(p => ({ ...p })), timeline: [] },
      'start',
      `SRTF Scheduling: ${n} processes. Preempts when shorter job arrives.`
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

      // Sort by remaining time
      available.sort((a, b) => a.remaining - b.remaining);
      const selected = available[0];

      // Check for preemption
      if (currentProcess && currentProcess !== selected.name) {
        steps.push(this.createStep(
          stepNum++,
          {
            processes: procs.map(p => ({ ...p })),
            timeline: [...timeline],
            variables: {
              currentTime,
              preempted: currentProcess,
              newProcess: selected.name,
              newRemaining: selected.remaining
            }
          },
          {
            processes: procs.map(p => ({ ...p })),
            timeline: [...timeline],
            preemption: true,
            from: currentProcess,
            to: selected.name
          },
          'preempt',
          `Time ${currentTime}: Preempt! ${selected.name} (remaining=${selected.remaining}) has shorter time.`
        ));
      } else if (!currentProcess || currentProcess !== selected.name) {
        steps.push(this.createStep(
          stepNum++,
          {
            processes: procs.map(p => ({ ...p })),
            timeline: [...timeline],
            variables: {
              currentTime,
              available: available.map(p => `${p.name}(rem=${p.remaining})`).join(', '),
              selected: selected.name
            }
          },
          {
            processes: procs.map(p => ({ ...p })),
            timeline: [...timeline],
            available: available.map(p => p.name),
            selected: selected.name
          },
          'select',
          `Time ${currentTime}: Select ${selected.name} (remaining=${selected.remaining})`
        ));
      }

      currentProcess = selected.name;

      if (selected.startTime === -1) {
        selected.startTime = currentTime;
      }

      // Find next event time (arrival or completion)
      const futureArrivals = procs
        .filter(p => p.arrival > currentTime && !p.completed)
        .map(p => p.arrival);

      const completionTime = currentTime + selected.remaining;
      const nextEventTime = futureArrivals.length > 0
        ? Math.min(Math.min(...futureArrivals), completionTime)
        : completionTime;

      const runTime = nextEventTime - currentTime;

      // Add to timeline
      const lastEntry = timeline[timeline.length - 1];
      if (lastEntry && lastEntry.process === selected.name && lastEntry.end === currentTime) {
        // Extend the last entry
        lastEntry.end = nextEventTime;
      } else {
        timeline.push({
          process: selected.name,
          start: currentTime,
          end: nextEventTime
        });
      }

      selected.remaining -= runTime;

      steps.push(this.createStep(
        stepNum++,
        {
          processes: procs.map(p => ({ ...p })),
          timeline: [...timeline],
          variables: {
            running: selected.name,
            runTime,
            remaining: selected.remaining,
            nextEvent: nextEventTime
          }
        },
        {
          processes: procs.map(p => ({ ...p })),
          timeline: [...timeline],
          running: selected.name
        },
        'execute',
        `Execute ${selected.name} for ${runTime} unit(s) until time ${nextEventTime}. Remaining: ${selected.remaining}`
      ));

      currentTime = nextEventTime;

      if (selected.remaining === 0) {
        selected.completed = true;
        selected.endTime = currentTime;
        selected.waitTime = selected.endTime - selected.arrival - selected.burst;
        completed++;
        currentProcess = null;

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
registry.register(new SRTFGenerator());

export default SRTFGenerator;

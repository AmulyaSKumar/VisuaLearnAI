/**
 * SJF (Shortest Job First) Scheduling Generator
 * Generates step-by-step visualization of SJF CPU scheduling (non-preemptive)
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class SJFGenerator extends BaseGenerator {
  constructor() {
    super('sjf', 'timeline', 'SJF Scheduling', {
      processes: {
        type: 'array',
        label: 'Processes',
        description: 'Process objects with arrival and burst times',
        default: [
          { id: 'P1', arrival: 0, burst: 6 },
          { id: 'P2', arrival: 1, burst: 2 },
          { id: 'P3', arrival: 2, burst: 8 },
          { id: 'P4', arrival: 3, burst: 3 }
        ]
      }
    });

    this.setDescription('Shortest Job First (Non-preemptive): Selects process with smallest burst time. Optimal average waiting time.');
    this.setComplexity('O(n²)', 'O(n)');
  }

  doGenerate(inputs) {
    let { processes } = inputs;

    processes = processes.map((p, i) => ({
      id: p.id || `P${i + 1}`,
      arrival: p.arrival ?? i,
      burst: p.burst ?? (i + 1) * 2
    }));

    const steps = [];
    let stepNum = 1;

    const timeline = [];
    const completed = [];
    const remaining = [...processes];
    let currentTime = 0;

    // Initial state
    steps.push(this.createStep(
      stepNum++,
      {
        processes: processes.map(p => ({ ...p, status: 'waiting' })),
        timeline: [],
        currentTime: 0,
        variables: { algorithm: 'SJF (Non-preemptive)', totalProcesses: processes.length }
      },
      { processes: processes.map(p => p.id) },
      'start',
      `SJF Scheduling: Always select shortest available job`
    ));

    while (remaining.length > 0) {
      // Get available processes (arrived by currentTime)
      const available = remaining.filter(p => p.arrival <= currentTime);

      if (available.length === 0) {
        // No process available, advance time to next arrival
        const nextArrival = Math.min(...remaining.map(p => p.arrival));
        const idleStart = currentTime;
        currentTime = nextArrival;
        timeline.push({ type: 'idle', start: idleStart, end: currentTime });

        steps.push(this.createStep(
          stepNum++,
          {
            processes: this.updateProcessStatus(processes, completed, null),
            timeline: [...timeline],
            currentTime,
            variables: { idle: true, nextArrival }
          },
          { idle: { start: idleStart, end: currentTime } },
          'idle',
          `CPU idle from ${idleStart} to ${currentTime}`
        ));
        continue;
      }

      // Show available processes and selection
      steps.push(this.createStep(
        stepNum++,
        {
          processes: this.updateProcessStatus(processes, completed, null),
          timeline: [...timeline],
          currentTime,
          variables: {
            available: available.map(p => `${p.id}(${p.burst})`).join(', ')
          }
        },
        {
          available: available.map(p => p.id),
          comparing: available.map(p => ({ id: p.id, burst: p.burst }))
        },
        'select',
        `Available at t=${currentTime}: ${available.map(p => `${p.id}(burst=${p.burst})`).join(', ')}`
      ));

      // Select shortest job
      const shortest = available.reduce((min, p) => p.burst < min.burst ? p : min, available[0]);

      steps.push(this.createStep(
        stepNum++,
        {
          processes: this.updateProcessStatus(processes, completed, shortest.id, 'selected'),
          timeline: [...timeline],
          currentTime,
          variables: { selected: shortest.id, burst: shortest.burst }
        },
        { selected: shortest.id, reason: 'shortest burst' },
        'chosen',
        `Selected ${shortest.id} (shortest burst: ${shortest.burst})`
      ));

      // Execute process
      const startTime = currentTime;
      const endTime = currentTime + shortest.burst;

      steps.push(this.createStep(
        stepNum++,
        {
          processes: this.updateProcessStatus(processes, completed, shortest.id, 'running'),
          timeline: [...timeline],
          currentTime,
          variables: { running: shortest.id, startTime, burst: shortest.burst }
        },
        { running: shortest.id, startTime },
        'execute',
        `${shortest.id} executes from ${startTime} to ${endTime}`
      ));

      // Process completes
      currentTime = endTime;
      timeline.push({ process: shortest.id, start: startTime, end: endTime });

      const completedProcess = {
        ...shortest,
        start: startTime,
        finish: endTime,
        turnaround: endTime - shortest.arrival,
        waiting: startTime - shortest.arrival
      };
      completed.push(completedProcess);

      // Remove from remaining
      const idx = remaining.findIndex(p => p.id === shortest.id);
      remaining.splice(idx, 1);

      steps.push(this.createStep(
        stepNum++,
        {
          processes: this.updateProcessStatus(processes, completed, null),
          timeline: [...timeline],
          currentTime,
          variables: {
            completed: shortest.id,
            turnaround: completedProcess.turnaround,
            waiting: completedProcess.waiting,
            remaining: remaining.length
          }
        },
        {
          completed: shortest.id,
          timeline: [...timeline],
          stats: completedProcess
        },
        'complete_process',
        `${shortest.id} completes. TAT: ${completedProcess.turnaround}, WT: ${completedProcess.waiting}`
      ));
    }

    // Calculate averages
    const avgTurnaround = completed.reduce((sum, p) => sum + p.turnaround, 0) / completed.length;
    const avgWaiting = completed.reduce((sum, p) => sum + p.waiting, 0) / completed.length;

    steps.push(this.createStep(
      stepNum,
      {
        processes: completed,
        timeline,
        currentTime,
        variables: {
          avgTurnaround: avgTurnaround.toFixed(2),
          avgWaiting: avgWaiting.toFixed(2),
          totalTime: currentTime
        }
      },
      {
        complete: true,
        timeline,
        stats: { avgTurnaround, avgWaiting }
      },
      'complete',
      `SJF Complete! Avg TAT: ${avgTurnaround.toFixed(2)}, Avg WT: ${avgWaiting.toFixed(2)}`
    ));

    return this.buildIR(inputs, { processes, timeline: [] }, steps);
  }

  updateProcessStatus(processes, completed, currentId, status = null) {
    return processes.map(p => {
      if (completed.find(c => c.id === p.id)) {
        return { ...p, status: 'completed' };
      }
      if (p.id === currentId) {
        return { ...p, status: status || 'ready' };
      }
      return { ...p, status: 'waiting' };
    });
  }
}

// Register the generator
registry.register(new SJFGenerator());

export default SJFGenerator;

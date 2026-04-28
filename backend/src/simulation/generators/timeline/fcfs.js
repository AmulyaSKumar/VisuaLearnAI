/**
 * FCFS (First Come First Served) Scheduling Generator
 * Generates step-by-step visualization of FCFS CPU scheduling
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class FCFSGenerator extends BaseGenerator {
  constructor() {
    super('fcfs', 'timeline', 'FCFS Scheduling', {
      processes: {
        type: 'array',
        label: 'Processes',
        description: 'Process objects with arrival and burst times',
        default: [
          { id: 'P1', arrival: 0, burst: 4 },
          { id: 'P2', arrival: 1, burst: 3 },
          { id: 'P3', arrival: 2, burst: 1 },
          { id: 'P4', arrival: 3, burst: 2 }
        ]
      }
    });

    this.setDescription('First Come First Served: Processes execute in arrival order. Simple but may cause convoy effect.');
    this.setComplexity('O(n)', 'O(n)');
  }

  doGenerate(inputs) {
    let { processes } = inputs;

    // Ensure processes have proper structure
    processes = processes.map((p, i) => ({
      id: p.id || `P${i + 1}`,
      arrival: p.arrival ?? i,
      burst: p.burst ?? (i + 1) * 2
    }));

    const steps = [];
    let stepNum = 1;

    // Sort by arrival time
    const sortedProcesses = [...processes].sort((a, b) => a.arrival - b.arrival);

    // Initialize tracking
    const timeline = [];
    const completed = [];
    let currentTime = 0;

    // Initial state
    steps.push(this.createStep(
      stepNum++,
      {
        processes: processes.map(p => ({ ...p, status: 'waiting' })),
        timeline: [],
        currentTime: 0,
        variables: { algorithm: 'FCFS', totalProcesses: processes.length }
      },
      { queue: sortedProcesses.map(p => p.id) },
      'start',
      `FCFS Scheduling: ${processes.length} processes will execute in arrival order`
    ));

    // Show sorted queue
    steps.push(this.createStep(
      stepNum++,
      {
        processes: sortedProcesses.map(p => ({ ...p, status: 'ready' })),
        timeline: [],
        currentTime: 0,
        variables: { queueOrder: sortedProcesses.map(p => p.id).join(' → ') }
      },
      { queue: sortedProcesses.map(p => p.id), sorted: true },
      'sort',
      `Queue order by arrival: ${sortedProcesses.map(p => `${p.id}(arr=${p.arrival})`).join(' → ')}`
    ));

    // Process each process
    for (const process of sortedProcesses) {
      // Wait for process to arrive if needed
      if (currentTime < process.arrival) {
        const idleStart = currentTime;
        currentTime = process.arrival;
        timeline.push({ type: 'idle', start: idleStart, end: currentTime });

        steps.push(this.createStep(
          stepNum++,
          {
            processes: this.updateProcessStatus(sortedProcesses, completed, process.id),
            timeline: [...timeline],
            currentTime,
            variables: { idleTime: currentTime - idleStart }
          },
          { idle: { start: idleStart, end: currentTime }, waiting: process.id },
          'idle',
          `CPU idle from ${idleStart} to ${currentTime}, waiting for ${process.id}`
        ));
      }

      // Execute process
      const startTime = currentTime;
      const endTime = currentTime + process.burst;

      steps.push(this.createStep(
        stepNum++,
        {
          processes: this.updateProcessStatus(sortedProcesses, completed, process.id, 'running'),
          timeline: [...timeline],
          currentTime,
          variables: { running: process.id, startTime, burstRemaining: process.burst }
        },
        { running: process.id, startTime },
        'start_process',
        `${process.id} starts execution at time ${startTime} (burst: ${process.burst})`
      ));

      // Process completes
      currentTime = endTime;
      timeline.push({ process: process.id, start: startTime, end: endTime });
      completed.push({
        ...process,
        start: startTime,
        finish: endTime,
        turnaround: endTime - process.arrival,
        waiting: startTime - process.arrival
      });

      steps.push(this.createStep(
        stepNum++,
        {
          processes: this.updateProcessStatus(sortedProcesses, completed, null),
          timeline: [...timeline],
          currentTime,
          variables: {
            completed: process.id,
            finishTime: endTime,
            turnaround: endTime - process.arrival,
            waiting: startTime - process.arrival
          }
        },
        {
          completed: process.id,
          timeline: [...timeline],
          stats: completed[completed.length - 1]
        },
        'complete_process',
        `${process.id} completes at ${endTime}. Turnaround: ${endTime - process.arrival}, Waiting: ${startTime - process.arrival}`
      ));
    }

    // Calculate averages
    const avgTurnaround = completed.reduce((sum, p) => sum + p.turnaround, 0) / completed.length;
    const avgWaiting = completed.reduce((sum, p) => sum + p.waiting, 0) / completed.length;

    // Final state
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
      `FCFS Complete! Avg Turnaround: ${avgTurnaround.toFixed(2)}, Avg Waiting: ${avgWaiting.toFixed(2)}`
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
registry.register(new FCFSGenerator());

export default FCFSGenerator;

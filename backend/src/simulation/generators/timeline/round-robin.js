/**
 * Round Robin Scheduling Generator
 * Generates step-by-step visualization of Round Robin CPU scheduling
 */
import { BaseGenerator } from '../base-generator.js';
import registry from '../../registry.js';

class RoundRobinGenerator extends BaseGenerator {
  constructor() {
    super('round_robin', 'timeline', 'Round Robin Scheduling', {
      processes: {
        type: 'array',
        label: 'Processes',
        description: 'Process objects with arrival and burst times',
        default: [
          { id: 'P1', arrival: 0, burst: 5 },
          { id: 'P2', arrival: 1, burst: 3 },
          { id: 'P3', arrival: 2, burst: 4 },
          { id: 'P4', arrival: 3, burst: 2 }
        ]
      },
      quantum: {
        type: 'number',
        label: 'Time Quantum',
        description: 'Time slice for each process',
        default: 2,
        validation: { min: 1, max: 10 }
      }
    });

    this.setDescription('Round Robin: Each process gets equal time slice (quantum). Fair and responsive for interactive systems.');
    this.setComplexity('O(n × total_burst/quantum)', 'O(n)');
  }

  doGenerate(inputs) {
    let { processes, quantum } = inputs;

    processes = processes.map((p, i) => ({
      id: p.id || `P${i + 1}`,
      arrival: p.arrival ?? i,
      burst: p.burst ?? (i + 1) * 2
    }));

    const steps = [];
    let stepNum = 1;

    const timeline = [];
    const completed = [];
    let currentTime = 0;

    // Track remaining burst for each process
    const remaining = new Map(processes.map(p => [p.id, p.burst]));
    const readyQueue = [];
    const arrivedSet = new Set();

    // Initial state
    steps.push(this.createStep(
      stepNum++,
      {
        processes: processes.map(p => ({ ...p, remaining: p.burst, status: 'waiting' })),
        timeline: [],
        currentTime: 0,
        quantum,
        variables: { algorithm: 'Round Robin', quantum, totalProcesses: processes.length }
      },
      { quantum },
      'start',
      `Round Robin Scheduling with quantum = ${quantum}`
    ));

    // Helper to add newly arrived processes
    const addArrivedProcesses = (time) => {
      for (const p of processes) {
        if (p.arrival <= time && !arrivedSet.has(p.id) && remaining.get(p.id) > 0) {
          readyQueue.push(p.id);
          arrivedSet.add(p.id);
        }
      }
    };

    // Initial arrivals
    addArrivedProcesses(0);

    while (completed.length < processes.length) {
      // Check for new arrivals
      addArrivedProcesses(currentTime);

      if (readyQueue.length === 0) {
        // Find next arrival
        const notArrived = processes.filter(p => !arrivedSet.has(p.id));
        if (notArrived.length === 0) break;

        const nextArrival = Math.min(...notArrived.map(p => p.arrival));
        const idleStart = currentTime;
        currentTime = nextArrival;
        timeline.push({ type: 'idle', start: idleStart, end: currentTime });

        steps.push(this.createStep(
          stepNum++,
          {
            processes: this.getProcessStates(processes, remaining, completed, null),
            timeline: [...timeline],
            currentTime,
            quantum,
            variables: { idle: true }
          },
          { idle: { start: idleStart, end: currentTime } },
          'idle',
          `CPU idle from ${idleStart} to ${currentTime}`
        ));

        addArrivedProcesses(currentTime);
        continue;
      }

      // Get next process from queue
      const currentId = readyQueue.shift();
      const currentProcess = processes.find(p => p.id === currentId);
      const burstRemaining = remaining.get(currentId);

      // Show queue state
      steps.push(this.createStep(
        stepNum++,
        {
          processes: this.getProcessStates(processes, remaining, completed, currentId),
          timeline: [...timeline],
          currentTime,
          quantum,
          readyQueue: [...readyQueue],
          variables: {
            current: currentId,
            remaining: burstRemaining,
            queueSize: readyQueue.length
          }
        },
        {
          current: currentId,
          queue: [...readyQueue],
          remaining: burstRemaining
        },
        'dequeue',
        `Dequeue ${currentId} (remaining: ${burstRemaining}). Queue: [${readyQueue.join(', ')}]`
      ));

      // Execute for quantum or until completion
      const executeTime = Math.min(quantum, burstRemaining);
      const startTime = currentTime;
      const endTime = currentTime + executeTime;

      steps.push(this.createStep(
        stepNum++,
        {
          processes: this.getProcessStates(processes, remaining, completed, currentId, 'running'),
          timeline: [...timeline],
          currentTime,
          quantum,
          variables: {
            running: currentId,
            executeTime,
            startTime,
            endTime
          }
        },
        {
          running: currentId,
          executeTime,
          startTime
        },
        'execute',
        `${currentId} executes for ${executeTime} units (${startTime} → ${endTime})`
      ));

      currentTime = endTime;
      timeline.push({ process: currentId, start: startTime, end: endTime });
      remaining.set(currentId, burstRemaining - executeTime);

      // Check for new arrivals during execution
      addArrivedProcesses(currentTime);

      // Check if process completed
      if (remaining.get(currentId) === 0) {
        const completedProcess = {
          ...currentProcess,
          finish: currentTime,
          turnaround: currentTime - currentProcess.arrival,
          waiting: currentTime - currentProcess.arrival - currentProcess.burst
        };
        completed.push(completedProcess);

        steps.push(this.createStep(
          stepNum++,
          {
            processes: this.getProcessStates(processes, remaining, completed, null),
            timeline: [...timeline],
            currentTime,
            quantum,
            variables: {
              completed: currentId,
              turnaround: completedProcess.turnaround,
              waiting: completedProcess.waiting
            }
          },
          {
            completed: currentId,
            stats: completedProcess
          },
          'complete_process',
          `${currentId} completes! TAT: ${completedProcess.turnaround}, WT: ${completedProcess.waiting}`
        ));
      } else {
        // Process not finished, add back to queue
        readyQueue.push(currentId);

        steps.push(this.createStep(
          stepNum++,
          {
            processes: this.getProcessStates(processes, remaining, completed, null),
            timeline: [...timeline],
            currentTime,
            quantum,
            readyQueue: [...readyQueue],
            variables: {
              preempted: currentId,
              remaining: remaining.get(currentId)
            }
          },
          {
            preempted: currentId,
            queue: [...readyQueue],
            remaining: remaining.get(currentId)
          },
          'preempt',
          `${currentId} preempted (remaining: ${remaining.get(currentId)}). Re-queued.`
        ));
      }
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
        quantum,
        variables: {
          avgTurnaround: avgTurnaround.toFixed(2),
          avgWaiting: avgWaiting.toFixed(2),
          totalTime: currentTime,
          contextSwitches: timeline.filter(t => t.process).length - 1
        }
      },
      {
        complete: true,
        timeline,
        stats: { avgTurnaround, avgWaiting }
      },
      'complete',
      `Round Robin Complete! Avg TAT: ${avgTurnaround.toFixed(2)}, Avg WT: ${avgWaiting.toFixed(2)}`
    ));

    return this.buildIR(inputs, { processes, timeline: [], quantum }, steps);
  }

  getProcessStates(processes, remaining, completed, currentId, status = null) {
    return processes.map(p => {
      const completedP = completed.find(c => c.id === p.id);
      if (completedP) {
        return { ...p, remaining: 0, status: 'completed', ...completedP };
      }
      return {
        ...p,
        remaining: remaining.get(p.id),
        status: p.id === currentId ? (status || 'ready') : 'waiting'
      };
    });
  }
}

// Register the generator
registry.register(new RoundRobinGenerator());

export default RoundRobinGenerator;

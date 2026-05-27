import { useCallback } from 'react';
import useSimulation from '../../hooks/useSimulation';
import SandboxSimulationFrame from './simulation/SandboxSimulationFrame';

export default function SimulationView({
  topic,
  userId,
  conversationId,
  onInteraction,
  accessToken,
  simulationDetection,
}) {
  const {
    simulation,
    loading,
    error,
    isValid,
    refetch,
  } = useSimulation(topic, {
    accessToken,
    detection: simulationDetection,
    conversationId,
    userId,
  });

  const handleSandboxEvent = useCallback((event) => {
    if (event.type === 'console' || event.type === 'runtime_error') {
      onInteraction?.({
        type: `sandbox_${event.type}`,
        data: event.payload,
      });
    }
  }, [onInteraction]);

  if (loading) {
    return (
      <div className="min-h-[88px] rounded-lg border border-border bg-[#FAF7F2] p-5 text-center text-foreground">
        <p className="text-sm font-semibold">Preparing simulation...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-[#FAF7F2] p-5 text-foreground">
        <p className="text-sm font-semibold">Simulation could not load.</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <button
          type="button"
          onClick={() => refetch(topic)}
          className="mt-4 rounded-md bg-[#111111] px-3 py-2 text-sm font-semibold text-white hover:bg-black/90"
        >
          Reload
        </button>
      </div>
    );
  }

  if (!isValid || !simulation || simulation.type !== 'sandbox_simulation') {
    return (
      <div className="rounded-lg border border-border bg-[#FAF7F2] p-5 text-foreground">
        <p className="text-sm font-semibold">Sandbox simulation was not generated.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Try again after a moment.
        </p>
        <button
          type="button"
          onClick={() => refetch(topic)}
          className="mt-4 rounded-md bg-[#111111] px-3 py-2 text-sm font-semibold text-white hover:bg-black/90"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <SandboxSimulationFrame
      bundle={simulation}
      height={700}
      onSandboxEvent={handleSandboxEvent}
    />
  );
}

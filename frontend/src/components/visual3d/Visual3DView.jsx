import { Canvas } from '@react-three/fiber';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useVisual3D from '../../hooks/useVisual3D';
import DynamicScene from './DynamicScene';
import ObjectTooltip from './ObjectTooltip';
import SceneControls from './SceneControls';

export default function Visual3DView({
  topic,
  accessToken = null,
  visual3d = null,
  autoFetch = true,
  onSceneReady = null,
}) {
  const containerRef = useRef(null);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [selectedObject, setSelectedObject] = useState(null);
  const [hoveredObject, setHoveredObject] = useState(null);
  const playingRef = useRef(true);
  const speedRef = useRef(1);
  const { loading, blueprint, validation, error, available, refetch } = useVisual3D(topic, {
    accessToken,
    autoFetch: autoFetch && !visual3d?.unavailable,
    initialVisual3D: visual3d,
  });

  const memoizedBlueprint = useMemo(() => blueprint, [blueprint]);
  const camera = useMemo(() => ({
    position: memoizedBlueprint?.camera?.position || [0, 6, 14],
    fov: 46,
    near: 0.1,
    far: 1000,
  }), [memoizedBlueprint]);

  useEffect(() => {
    if (!memoizedBlueprint || !available) return;
    onSceneReady?.({ topic, blueprint: memoizedBlueprint, validation });
  }, [available, memoizedBlueprint, onSceneReady, topic, validation]);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const handleRestart = useCallback(() => {
    setPlaying(false);
    window.setTimeout(() => setPlaying(true), 40);
  }, []);

  const handleFullscreen = useCallback(() => {
    const node = containerRef.current;
    if (!node) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      node.requestFullscreen?.();
    }
  }, []);

  const handleTogglePlay = useCallback(() => {
    setPlaying(value => !value);
  }, []);

  const handleSpeedChange = useCallback((nextSpeed) => {
    setSpeed(nextSpeed);
  }, []);

  const handleSelectObject = useCallback((object) => {
    setSelectedObject(object);
  }, []);

  const handleHoverObject = useCallback((object) => {
    setHoveredObject(object);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[320px] w-full items-center justify-center rounded-lg border border-border bg-[#0b1020] text-sm text-slate-300">
        <div className="flex items-center gap-3">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
          Building 3D scene...
        </div>
      </div>
    );
  }

  if (!available || !memoizedBlueprint) {
    return (
      <div className="flex min-h-[220px] w-full flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card px-4 text-center">
        <p className="text-sm font-medium text-foreground">3D is not available for this topic.</p>
        {topic && (
          <button
            type="button"
            onClick={() => refetch(topic)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-muted"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="group/visual3d relative overflow-hidden rounded-xl border border-slate-700/70 bg-[#0b1020] shadow-[0_22px_70px_rgba(2,8,23,0.32)]"
    >
      <SceneControls
        playing={playing}
        speed={speed}
        onTogglePlay={handleTogglePlay}
        onRestart={handleRestart}
        onSpeedChange={handleSpeedChange}
        onFullscreen={handleFullscreen}
      />
      <div className="relative h-[min(68vh,620px)] min-h-[380px] w-full bg-[#0b1020]">
        <ObjectTooltip
          object={selectedObject}
          hoveredObject={hoveredObject}
          onClose={() => setSelectedObject(null)}
        />
        <Canvas
          camera={camera}
          dpr={[1, 1.5]}
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
            preserveDrawingBuffer: false,
          }}
        >
          <Suspense fallback={null}>
            <DynamicScene
              blueprint={memoizedBlueprint}
              playingRef={playingRef}
              speedRef={speedRef}
              selectedObjectId={selectedObject?.id || null}
              onSelectObject={handleSelectObject}
              onHoverObject={handleHoverObject}
            />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}

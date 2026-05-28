import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { memo, useMemo, useRef } from 'react';
import { PrimitiveMesh } from './MeshFactory';

function DynamicObject({
  object,
  animations = [],
  playingRef,
  speedRef,
  selected,
  onSelect,
  onHover,
}) {
  const groupRef = useRef(null);
  const basePosition = useMemo(() => object?.position || [0, 0, 0], [object]);
  const scale = object?.scale || [1, 1, 1];

  useFrame(({ clock }) => {
    if (!groupRef.current || !playingRef.current) return;
    const elapsed = clock.getElapsedTime() * speedRef.current;
    groupRef.current.scale.lerp({ x: scale[0], y: scale[1], z: scale[2] }, 0.08);

    for (const animation of animations) {
      const animationSpeed = Number(animation.speed || 1);
      if (animation.type === 'rotate') {
        const axis = animation.axis || 'y';
        groupRef.current.rotation[axis] = elapsed * animationSpeed;
      }
      if (animation.type === 'pulse') {
        const pulse = 1 + Math.sin(elapsed * animationSpeed * 2) * 0.06;
        groupRef.current.scale.set(scale[0] * pulse, scale[1] * pulse, scale[2] * pulse);
      }
      if (animation.type === 'orbit') {
        const radius = Number(animation.radius || Math.max(Math.abs(basePosition[0]), 2.5));
        const nextX = Math.cos(elapsed * animationSpeed) * radius;
        const nextZ = Math.sin(elapsed * animationSpeed) * radius;
        groupRef.current.position.x += (nextX - groupRef.current.position.x) * 0.12;
        groupRef.current.position.z += (nextZ - groupRef.current.position.z) * 0.12;
      }
      if (animation.type === 'particle_motion' || animation.type === 'flow') {
        groupRef.current.rotation.y = elapsed * animationSpeed * 0.45;
      }
      if (animation.type === 'expand') {
        const pulse = 1 + Math.max(0, Math.sin(elapsed * animationSpeed)) * 0.12;
        groupRef.current.scale.set(scale[0] * pulse, scale[1] * pulse, scale[2] * pulse);
      }
      if (animation.type === 'fade') {
        groupRef.current.visible = Math.sin(elapsed * animationSpeed) > -0.92;
      }
    }
  });

  return (
    <group
      ref={groupRef}
      position={basePosition}
      scale={scale}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.(object);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        document.body.style.cursor = 'pointer';
        onHover?.(object);
      }}
      onPointerOut={() => {
        document.body.style.cursor = '';
        onHover?.(null);
      }}
    >
      <PrimitiveMesh object={object} selected={selected} />
      {selected && (
        <Html position={[0, 1.35, 0]} center distanceFactor={9} occlude>
          <div className="pointer-events-none rounded-full border border-cyan-300/30 bg-slate-950/75 px-2.5 py-1 text-xs font-medium text-cyan-50 shadow-lg backdrop-blur-md transition-opacity">
            {object.name}
          </div>
        </Html>
      )}
    </group>
  );
}

export default memo(DynamicObject);

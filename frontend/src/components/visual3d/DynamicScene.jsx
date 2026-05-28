import { OrbitControls, Stars } from '@react-three/drei';
import { memo, useEffect, useMemo, useRef } from 'react';
import { Box3, Vector3 } from 'three';
import { useThree } from '@react-three/fiber';
import DynamicObject from './DynamicObject';

function DynamicScene({
  blueprint,
  playingRef,
  speedRef,
  selectedObjectId,
  onSelectObject,
  onHoverObject,
}) {
  const controlsRef = useRef(null);
  const { camera } = useThree();
  const animationsByTarget = useMemo(() => {
    const output = new Map();
    for (const animation of blueprint?.animations || []) {
      const list = output.get(animation.targetId) || [];
      list.push(animation);
      output.set(animation.targetId, list);
    }
    return output;
  }, [blueprint?.animations]);

  const sceneBounds = useMemo(() => computeSceneBounds(blueprint), [blueprint]);

  useEffect(() => {
    if (!sceneBounds) return;

    const { center, radius } = sceneBounds;
    const distance = Math.max(radius * 2.35, 8);
    const nextPosition = new Vector3(
      center.x + distance * 0.55,
      center.y + distance * 0.38,
      center.z + distance,
    );

    camera.position.copy(nextPosition);
    camera.near = Math.max(0.05, distance / 100);
    camera.far = Math.max(1000, distance * 20);
    camera.lookAt(center);
    camera.updateProjectionMatrix();

    if (controlsRef.current) {
      controlsRef.current.target.copy(center);
      controlsRef.current.update();
    }
  }, [camera, sceneBounds]);

  return (
    <>
      <color attach="background" args={['#0b1020']} />
      <fog attach="fog" args={['#0b1020', 14, 70]} />
      <ambientLight intensity={0.28} color="#b8c7ff" />
      <directionalLight position={[8, 12, 10]} intensity={2.1} color="#ffffff" />
      <pointLight position={[0, 4, 0]} intensity={3.4} color="#ffd166" distance={40} />
      <pointLight position={[-8, 6, -8]} intensity={1.1} color="#5eead4" distance={45} />
      {blueprint?.family === 'spatial' && <Stars radius={100} depth={38} count={1300} factor={3.5} fade speed={0.25} />}
      {(blueprint?.objects || []).map((object) => (
        <DynamicObject
          key={object.id}
          object={object}
          animations={animationsByTarget.get(object.id) || []}
          playingRef={playingRef}
          speedRef={speedRef}
          selected={selectedObjectId === object.id}
          onSelect={onSelectObject}
          onHover={onHoverObject}
        />
      ))}
      <gridHelper args={[28, 28, '#1f3a5f', '#13233d']} position={[0, -2.25, 0]} />
      <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.08} makeDefault />
    </>
  );
}

function computeSceneBounds(blueprint) {
  const objects = blueprint?.objects || [];
  if (objects.length === 0) return null;

  const box = new Box3();
  for (const object of objects) {
    const position = new Vector3(...(object.position || [0, 0, 0]));
    const scale = object.scale || [1, 1, 1];
    const maxScale = Math.max(...scale);
    const radius = Math.max(Number(object.geometry?.radius || 0.8) * maxScale, 0.75);
    box.expandByPoint(position.clone().addScalar(radius));
    box.expandByPoint(position.clone().subScalar(radius));
  }

  const center = new Vector3();
  const size = new Vector3();
  box.getCenter(center);
  box.getSize(size);
  const radius = Math.max(size.length() * 0.5, 4);
  return { center, radius };
}

export default memo(DynamicScene);

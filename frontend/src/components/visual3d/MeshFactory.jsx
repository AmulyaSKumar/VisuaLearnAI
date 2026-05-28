import { Text } from '@react-three/drei';
import { AdditiveBlending, BufferAttribute, BufferGeometry } from 'three';
import { memo, useEffect, useMemo } from 'react';

export const PrimitiveMesh = memo(function PrimitiveMesh({ object, selected = false }) {
  const primitive = object?.geometry?.primitive || 'sphere';
  const radius = Number(object?.geometry?.radius || 0.8);
  const color = object?.material?.color || '#6aa6b8';
  const emissive = object?.material?.emissive || '#000000';
  const opacity = object?.material?.opacity ?? 1;
  const commonMaterial = {
    color,
    emissive,
    emissiveIntensity: selected ? 0.85 : 0.42,
    transparent: opacity < 1,
    opacity,
    wireframe: Boolean(object?.material?.wireframe),
    roughness: 0.48,
    metalness: 0.08,
  };

  if (primitive === 'cube') {
    return (
      <mesh>
        <boxGeometry args={[1.4, 1.4, 1.4]} />
        <meshStandardMaterial {...commonMaterial} />
      </mesh>
    );
  }

  if (primitive === 'cylinder') {
    return (
      <mesh>
        <cylinderGeometry args={[radius, radius, 1.8, 32]} />
        <meshStandardMaterial {...commonMaterial} />
      </mesh>
    );
  }

  if (primitive === 'cone') {
    return (
      <mesh>
        <coneGeometry args={[radius, 1.8, 32]} />
        <meshStandardMaterial {...commonMaterial} />
      </mesh>
    );
  }

  if (primitive === 'ring') {
    return (
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, selected ? 0.055 : 0.035, 128, 10]} />
        <meshStandardMaterial {...commonMaterial} />
      </mesh>
    );
  }

  if (primitive === 'plane') {
    return (
      <mesh>
        <planeGeometry args={[2.4, 1.4]} />
        <meshStandardMaterial {...commonMaterial} side={2} />
      </mesh>
    );
  }

  if (primitive === 'line') {
    return <LineObject object={object} color={color} />;
  }

  if (primitive === 'particle_system') {
    return <ParticleSystem object={object} color={color} />;
  }

  if (primitive === 'helix') {
    return <HelixObject object={object} color={color} selected={selected} />;
  }

  if (primitive === 'text_label') {
    return (
      <Text fontSize={0.45} color={color} anchorX="center" anchorY="middle">
        {object.name}
      </Text>
    );
  }

  return (
    <>
      <mesh>
        <sphereGeometry args={[radius, 48, 28]} />
        <meshStandardMaterial {...commonMaterial} />
      </mesh>
      <mesh scale={[1.18, 1.18, 1.18]}>
        <sphereGeometry args={[radius, 32, 18]} />
        <meshBasicMaterial
          color={emissive === '#000000' ? color : emissive}
          transparent
          opacity={selected ? 0.18 : 0.08}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </>
  );
});

const ParticleSystem = memo(function ParticleSystem({ object, color }) {
  const geometry = useMemo(() => {
    const count = Math.min(Number(object?.geometry?.count || 300), 2500);
    const radius = Number(object?.geometry?.radius || 4);
    const positions = new Float32Array(count * 3);

    for (let index = 0; index < count; index += 1) {
      const angle = index * 0.37;
      const band = ((index % 37) / 37) - 0.5;
      const distance = radius * (0.25 + (index % 97) / 120);
      positions[index * 3] = Math.cos(angle) * distance;
      positions[index * 3 + 1] = band * radius * 0.55;
      positions[index * 3 + 2] = Math.sin(angle) * distance;
    }

    const buffer = new BufferGeometry();
    buffer.setAttribute('position', new BufferAttribute(positions, 3));
    return buffer;
  }, [object]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry}>
      <pointsMaterial color={color} size={0.055} sizeAttenuation transparent opacity={0.9} depthWrite={false} />
    </points>
  );
});

const LineObject = memo(function LineObject({ object, color }) {
  const geometry = useMemo(() => {
    const points = Array.isArray(object?.geometry?.points) && object.geometry.points.length > 1
      ? object.geometry.points
      : [[-1.5, 0, 0], [1.5, 0, 0]];
    const positions = new Float32Array(points.flat());
    const buffer = new BufferGeometry();
    buffer.setAttribute('position', new BufferAttribute(positions, 3));
    return buffer;
  }, [object]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <line geometry={geometry}>
      <lineBasicMaterial color={color} linewidth={2} />
    </line>
  );
});

const HelixObject = memo(function HelixObject({ object, color, selected }) {
  const geometry = useMemo(() => {
    const turns = 3.5;
    const count = 150;
    const radius = Number(object?.geometry?.radius || 1.2);
    const height = Number(object?.geometry?.height || 5);
    const positions = new Float32Array(count * 3);

    for (let index = 0; index < count; index += 1) {
      const t = index / (count - 1);
      const angle = t * Math.PI * 2 * turns;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = (t - 0.5) * height;
      positions[index * 3 + 2] = Math.sin(angle) * radius;
    }

    const buffer = new BufferGeometry();
    buffer.setAttribute('position', new BufferAttribute(positions, 3));
    return buffer;
  }, [object]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <line geometry={geometry}>
      <lineBasicMaterial color={selected ? '#f59f00' : color} linewidth={2} />
    </line>
  );
});

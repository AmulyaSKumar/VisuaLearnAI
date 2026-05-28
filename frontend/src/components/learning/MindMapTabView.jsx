import { useEffect, useMemo, useRef } from 'react';
import { toPng } from 'html-to-image';
import MindMapView from './MindMapView';

function text(value, fallback = '') {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(item => text(item)).filter(Boolean).join(', ');
  for (const key of ['root', 'central', 'topic', 'label', 'title', 'name', 'text', 'content', 'description']) {
    if (typeof value?.[key] === 'string') return value[key];
  }
  return fallback;
}

function normalizeConcept(child, fallback) {
  return {
    id: text(child?.id, fallback),
    label: text(child?.label || child?.title || child?.name || child, fallback),
  };
}

function buildCanvasMindMap(mindMap, keyIdeas, topic) {
  if (mindMap?.branches?.length) {
    return {
      ...mindMap,
      central: text(mindMap.central || mindMap.root || topic, topic),
    };
  }

  const ideas = Array.isArray(keyIdeas) ? keyIdeas : [];
  return {
    central: topic,
    description: ideas[0]?.explanation || `Explore ${topic} through focused concept areas.`,
    difficulty: ideas[0]?.difficulty || 'Adaptive',
    branches: ideas.slice(0, 9).map((idea, index) => ({
      id: text(idea?.id, `idea-${index}`),
      label: text(idea?.title || idea?.name, `Concept ${index + 1}`),
      children: (Array.isArray(idea?.concepts) ? idea.concepts : [])
        .slice(0, 4)
        .map((concept, childIndex) => normalizeConcept(concept, `detail-${index}-${childIndex}`)),
    })),
  };
}

export default function MindMapTabView({ mindMap, keyIdeas, onCaptureReady }) {
  const captureRef = useRef(null);
  const topic = text(mindMap?.root || mindMap?.central || keyIdeas?.[0]?.topic, 'Learning Topic');
  const canvasMindMap = useMemo(
    () => buildCanvasMindMap(mindMap, keyIdeas, topic),
    [mindMap, keyIdeas, topic],
  );

  useEffect(() => {
    if (!onCaptureReady) return undefined;

    onCaptureReady(async () => {
      if (!captureRef.current) return null;
      return toPng(captureRef.current, {
        backgroundColor: '#FFF8EC',
        quality: 1,
        pixelRatio: 2,
      });
    });

    return () => onCaptureReady(null);
  }, [onCaptureReady]);

  if (!canvasMindMap?.central && (!canvasMindMap?.branches || canvasMindMap.branches.length === 0)) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center text-muted-foreground">
        <p>No mind map available</p>
      </div>
    );
  }

  return (
    <div ref={captureRef}>
      <MindMapView mindmap={canvasMindMap} topic={topic} />
    </div>
  );
}

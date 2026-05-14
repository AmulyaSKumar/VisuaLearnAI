import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  Background,
  MiniMap,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
} from '@xyflow/react';
import { toPng } from 'html-to-image';
import '@xyflow/react/dist/style.css';

// Enhanced color scheme with gradients
const nodeColors = {
  root: {
    bg: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)', // Indigo to purple gradient
    bgSolid: '#6366F1',
    text: '#FFFFFF',
    border: '#4F46E5',
    shadow: 'rgba(99, 102, 241, 0.3)',
  },
  keyIdea: {
    bg: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', // Emerald gradient
    bgSolid: '#10B981',
    text: '#FFFFFF',
    border: '#047857',
    shadow: 'rgba(16, 185, 129, 0.25)',
  },
  subConcept: {
    bg: '#F8FAFC',
    bgSolid: '#F8FAFC',
    text: '#334155',
    border: '#CBD5E1',
    shadow: 'rgba(51, 65, 85, 0.1)',
  },
};

// Helper to safely extract string from potentially nested object
function extractString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  if (typeof value === 'object' && !Array.isArray(value)) {
    // Try common text field names
    const textFields = ['text', 'content', 'value', 'label', 'name', 'title', 'description'];
    for (const field of textFields) {
      if (value[field] && typeof value[field] === 'string') {
        return value[field];
      }
    }
    // If object has only one string property, use it
    const values = Object.values(value);
    const stringVal = values.find(v => typeof v === 'string');
    if (stringVal) return stringVal;
  }

  return fallback;
}

// Truncate text helper
function truncateText(text, maxLength = 50) {
  const str = extractString(text, '');
  if (!str || str.length <= maxLength) return str;
  return str.substring(0, maxLength).trim() + '...';
}

// Get first sentence helper
function getFirstSentence(text, maxLength = 60) {
  const str = extractString(text, '');
  if (!str) return '';
  const firstSentence = str.split(/[.!?]/)[0];
  return truncateText(firstSentence, maxLength);
}

// Determine which handle to use based on angle
function getSourceHandle(angle) {
  // Normalize angle to 0-2PI
  const normalizedAngle = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  // Determine quadrant
  if (normalizedAngle >= 7 * Math.PI / 4 || normalizedAngle < Math.PI / 4) {
    return 'right'; // East
  } else if (normalizedAngle >= Math.PI / 4 && normalizedAngle < 3 * Math.PI / 4) {
    return 'bottom'; // South
  } else if (normalizedAngle >= 3 * Math.PI / 4 && normalizedAngle < 5 * Math.PI / 4) {
    return 'left'; // West
  } else {
    return 'top'; // North
  }
}

// Mastery status colors
const masteryColors = {
  mastered: { bg: '#10B981', text: 'Mastered', icon: 'check' },
  learning: { bg: '#F59E0B', text: 'Learning', icon: 'clock' },
  weak: { bg: '#EF4444', text: 'Needs Practice', icon: 'alert' },
  new: { bg: '#6B7280', text: 'New', icon: 'new' },
};

// Custom Node Component for Key Ideas
function KeyIdeaNode({ data, id }) {
  const { label, subtitle, hasSubConcepts, isExpanded, onExpand, onNodeClick, masteryStatus, onTestConcept, isWeak } = data;

  // Ensure label is a string
  const displayLabel = extractString(label, 'Key Idea');
  const displaySubtitle = extractString(subtitle, '');

  const handleReadMore = (e) => {
    e.stopPropagation();
    const url = `https://www.google.com/search?q=${encodeURIComponent(displayLabel)}+explained`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const statusInfo = masteryColors[masteryStatus] || masteryColors.new;

  return (
    <div
      className="relative cursor-pointer group"
      onClick={(e) => {
        e.stopPropagation();
        onNodeClick?.(id, data);
      }}
    >
      {/* Target handle for incoming edges from root */}
      <Handle
        type="target"
        position={Position.Top}
        id="target"
        className="!bg-transparent !border-0 !w-2 !h-2"
      />

      {/* Mastery status indicator */}
      {masteryStatus && masteryStatus !== 'new' && (
        <div
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold z-10 shadow-md"
          style={{ background: statusInfo.bg }}
          title={statusInfo.text}
        >
          {masteryStatus === 'mastered' && (
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
          {masteryStatus === 'learning' && (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {masteryStatus === 'weak' && (
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      )}

      <div
        className={`rounded-2xl px-5 py-4 min-w-[160px] max-w-[200px] transition-all duration-200 hover:scale-105 ${isWeak ? 'ring-2 ring-red-500 ring-offset-2' : ''}`}
        style={{
          background: nodeColors.keyIdea.bg,
          color: nodeColors.keyIdea.text,
          border: `2px solid ${nodeColors.keyIdea.border}`,
          boxShadow: `0 8px 24px ${nodeColors.keyIdea.shadow}, 0 2px 8px rgba(0,0,0,0.1)`,
        }}
      >
        <div className="font-semibold text-sm text-center leading-tight">{displayLabel}</div>
        {displaySubtitle && (
          <div className="text-xs opacity-75 mt-1.5 text-center leading-tight line-clamp-2">{displaySubtitle}</div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-2 mt-3 pt-2 border-t border-white/20">
          {/* Expand button */}
          {hasSubConcepts && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExpand?.(id);
              }}
              className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all hover:scale-110"
              title={isExpanded ? 'Collapse sub-concepts' : 'Expand sub-concepts'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isExpanded ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                )}
              </svg>
            </button>
          )}

          {/* Test Me button */}
          {onTestConcept && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTestConcept?.(displayLabel);
              }}
              className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all hover:scale-110"
              title="Test this concept"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </button>
          )}

          {/* Read more link button */}
          <button
            onClick={handleReadMore}
            className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all hover:scale-110"
            title="Search on Google"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
        </div>
      </div>

      {/* Source handle for outgoing edges to sub-concepts */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="source"
        className="!bg-transparent !border-0 !w-2 !h-2"
      />
    </div>
  );
}

// Custom Node Component for Sub-concepts
function SubConceptNode({ data, id }) {
  const { label, onNodeClick } = data;

  // Ensure label is a string
  const displayLabel = extractString(label, 'Concept');

  const handleReadMore = (e) => {
    e.stopPropagation();
    const url = `https://www.google.com/search?q=${encodeURIComponent(displayLabel)}+explained`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="relative cursor-pointer group"
      onClick={(e) => {
        e.stopPropagation();
        onNodeClick?.(id, data);
      }}
    >
      {/* Target handle */}
      <Handle
        type="target"
        position={Position.Top}
        id="target"
        className="!bg-transparent !border-0 !w-2 !h-2"
      />

      <div
        className="rounded-xl px-4 py-3 min-w-[120px] max-w-[160px] transition-all duration-200 hover:scale-105"
        style={{
          background: nodeColors.subConcept.bg,
          color: nodeColors.subConcept.text,
          border: `1px solid ${nodeColors.subConcept.border}`,
          boxShadow: `0 4px 12px ${nodeColors.subConcept.shadow}`,
        }}
      >
        <div className="font-medium text-xs text-center leading-tight">{displayLabel}</div>

        {/* Read more link */}
        <div className="flex justify-center mt-2">
          <button
            onClick={handleReadMore}
            className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all hover:scale-110 text-slate-500 hover:text-slate-700"
            title="Search on Google"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// Root node component with explicit handles
function RootNode({ data }) {
  const { label, onNodeClick } = data;

  // Ensure label is a string
  const displayLabel = extractString(label, 'Main Topic');

  return (
    <div
      className="cursor-pointer transition-all hover:scale-105 relative"
      onClick={(e) => {
        e.stopPropagation();
        onNodeClick?.('root', data);
      }}
    >
      {/* Source handles in all 4 directions */}
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        className="!bg-transparent !border-0 !w-3 !h-3"
        style={{ top: 0 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!bg-transparent !border-0 !w-3 !h-3"
        style={{ bottom: 0 }}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className="!bg-transparent !border-0 !w-3 !h-3"
        style={{ left: 0 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!bg-transparent !border-0 !w-3 !h-3"
        style={{ right: 0 }}
      />

      <div
        className="rounded-full w-[150px] h-[150px] flex items-center justify-center transition-all duration-200 hover:scale-105"
        style={{
          background: nodeColors.root.bg,
          color: nodeColors.root.text,
          border: `3px solid ${nodeColors.root.border}`,
          boxShadow: `0 12px 32px ${nodeColors.root.shadow}, 0 4px 12px rgba(0,0,0,0.15)`,
        }}
      >
        <div className="font-bold text-base text-center px-5 leading-tight">{displayLabel}</div>
      </div>
    </div>
  );
}

// Node types for ReactFlow
const nodeTypes = {
  root: RootNode,
  keyIdea: KeyIdeaNode,
  subConcept: SubConceptNode,
};

// Generate mind map layout from keyIdeas
function generateMindMapLayout(topic, keyIdeas, expandedNodes, handlers, getConceptStatus, weakAreas) {
  const nodes = [];
  const edges = [];

  // Create a set of weak area IDs for quick lookup
  const weakAreaIds = new Set((weakAreas || []).map(w => w.id));

  // Ensure topic is a string
  const topicStr = extractString(topic, 'Main Topic');

  if (!topicStr && (!keyIdeas || keyIdeas.length === 0)) {
    return { nodes, edges };
  }

  const centerX = 400;
  const centerY = 300;
  const keyIdeaRadius = 220;
  const subConceptRadius = 120;

  // Root node at center
  nodes.push({
    id: 'root',
    position: { x: centerX - 70, y: centerY - 70 },
    data: {
      label: topicStr,
      onNodeClick: handlers.onNodeClick,
    },
    type: 'root',
  });

  const ideas = keyIdeas || [];
  const angleStep = (2 * Math.PI) / Math.max(ideas.length, 1);

  ideas.forEach((idea, index) => {
    const angle = index * angleStep - Math.PI / 2;
    const x = centerX + Math.cos(angle) * keyIdeaRadius;
    const y = centerY + Math.sin(angle) * keyIdeaRadius;
    const nodeId = `idea_${index}`;
    const isExpanded = expandedNodes.has(nodeId);

    // Safely extract title and subtitle - handle nested objects
    const title = extractString(idea?.title || idea?.name, `Key Idea ${index + 1}`);
    const subtitle = getFirstSentence(idea?.explanation || idea?.description, 60);

    // Get sub-concepts array
    let subConcepts = [];
    if (Array.isArray(idea?.concepts)) {
      subConcepts = idea.concepts;
    } else if (Array.isArray(idea?.children)) {
      subConcepts = idea.children;
    }
    const hasSubConcepts = subConcepts.length > 0;

    // Determine which handle to use based on position relative to center
    const sourceHandle = getSourceHandle(angle);

    // Get mastery status for this concept
    const conceptId = idea?.id || `key_idea_${index}`;
    const conceptStatus = getConceptStatus ? getConceptStatus(conceptId) : { status: 'new' };
    const isWeak = weakAreaIds.has(conceptId);

    // Key idea node
    nodes.push({
      id: nodeId,
      position: { x: x - 70, y: y - 40 },
      data: {
        label: title,
        subtitle,
        fullData: idea,
        hasSubConcepts,
        isExpanded,
        concepts: subConcepts,
        onExpand: handlers.onExpand,
        onNodeClick: handlers.onNodeClick,
        masteryStatus: conceptStatus.status,
        onTestConcept: handlers.onTestConcept,
        isWeak,
      },
      type: 'keyIdea',
    });

    // Edge from root to key idea with explicit handle IDs
    edges.push({
      id: `edge_root_${nodeId}`,
      source: 'root',
      sourceHandle: sourceHandle, // Use the calculated handle based on position
      target: nodeId,
      targetHandle: 'target',
      type: 'smoothstep',
      animated: true,
      style: { stroke: nodeColors.root.bgSolid, strokeWidth: 2.5, strokeLinecap: 'round' },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: nodeColors.root.bgSolid,
        width: 20,
        height: 20,
      },
    });

    // If expanded, add sub-concept nodes
    if (isExpanded && hasSubConcepts) {
      const subAngleStep = Math.PI / Math.max(subConcepts.length + 1, 2);
      const subStartAngle = angle - Math.PI / 3;

      subConcepts.forEach((concept, subIndex) => {
        const subAngle = subStartAngle + (subIndex + 1) * subAngleStep;
        const subX = x + Math.cos(subAngle) * subConceptRadius;
        const subY = y + Math.sin(subAngle) * subConceptRadius;
        const subNodeId = `sub_${index}_${subIndex}`;

        // Safely extract concept label
        const conceptLabel = extractString(
          typeof concept === 'string' ? concept : (concept?.name || concept?.title),
          `Concept ${subIndex + 1}`
        );

        nodes.push({
          id: subNodeId,
          position: { x: subX - 50, y: subY - 20 },
          data: {
            label: conceptLabel,
            fullData: concept,
            onNodeClick: handlers.onNodeClick,
          },
          type: 'subConcept',
        });

        edges.push({
          id: `edge_${nodeId}_${subNodeId}`,
          source: nodeId,
          sourceHandle: 'source',
          target: subNodeId,
          targetHandle: 'target',
          type: 'smoothstep',
          style: { stroke: nodeColors.keyIdea.bgSolid, strokeWidth: 2, strokeLinecap: 'round' },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: nodeColors.keyIdea.bgSolid,
            width: 16,
            height: 16,
          },
        });
      });
    }
  });

  return { nodes, edges };
}

// Side Panel Component
function SidePanel({ isOpen, onClose, nodeData, onTestConcept }) {
  if (!isOpen || !nodeData) return null;

  const title = extractString(nodeData.label || nodeData.title, 'Details');
  const description = extractString(
    nodeData.fullData?.explanation || nodeData.fullData?.description,
    ''
  );

  // Get concepts array
  let concepts = [];
  if (Array.isArray(nodeData.fullData?.concepts)) {
    concepts = nodeData.fullData.concepts;
  } else if (Array.isArray(nodeData.fullData?.children)) {
    concepts = nodeData.fullData.children;
  } else if (Array.isArray(nodeData.concepts)) {
    concepts = nodeData.concepts;
  }

  const masteryStatus = nodeData.masteryStatus;
  const statusInfo = masteryColors[masteryStatus] || masteryColors.new;
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(title)}+explained`;

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-card border-l border-border shadow-2xl z-50 transform transition-transform duration-300 ease-in-out overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h3 className="font-semibold text-foreground truncate">{title}</h3>
          {masteryStatus && masteryStatus !== 'new' && (
            <span
              className="px-2 py-0.5 text-xs font-medium rounded-full text-white flex-shrink-0"
              style={{ background: statusInfo.bg }}
            >
              {statusInfo.text}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Description */}
        {description && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Description</h4>
            <p className="text-sm text-foreground leading-relaxed">{description}</p>
          </div>
        )}

        {/* Sub-concepts */}
        {concepts.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Sub-concepts</h4>
            <ul className="space-y-2">
              {concepts.map((concept, idx) => {
                const conceptName = extractString(
                  typeof concept === 'string' ? concept : (concept?.name || concept?.title),
                  `Concept ${idx + 1}`
                );
                return (
                  <li
                    key={idx}
                    className="flex items-center gap-2 text-sm text-foreground p-2 rounded-lg bg-muted/30"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1D9E75] flex-shrink-0"></span>
                    {conceptName}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Analogy if available */}
        {nodeData.fullData?.analogy && (
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <div>
                <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Think of it like...</span>
                <p className="text-sm text-amber-800 dark:text-amber-300 mt-0.5">
                  {extractString(nodeData.fullData.analogy, '')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-border space-y-2">
        {/* Test Me Button */}
        {onTestConcept && (
          <button
            onClick={() => {
              onTestConcept(title);
              onClose();
            }}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            Test My Knowledge
          </button>
        )}

        {/* Read More Link */}
        <a
          href={searchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/80 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Read More on Google
        </a>
      </div>
    </div>
  );
}

// Custom Toolbar Component
function CustomToolbar({ onExportPng }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
      {/* Zoom controls */}
      <div className="flex flex-col gap-0.5 p-1.5 bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-lg">
        <button
          onClick={() => zoomIn()}
          className="px-3 py-2 text-xs font-medium text-foreground hover:bg-primary/10 hover:text-primary rounded-lg transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
          Zoom In
        </button>
        <button
          onClick={() => zoomOut()}
          className="px-3 py-2 text-xs font-medium text-foreground hover:bg-primary/10 hover:text-primary rounded-lg transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
          </svg>
          Zoom Out
        </button>
        <button
          onClick={() => fitView({ padding: 0.2 })}
          className="px-3 py-2 text-xs font-medium text-foreground hover:bg-primary/10 hover:text-primary rounded-lg transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          Fit View
        </button>
        <div className="border-t border-border my-1 mx-1"></div>
        <button
          onClick={onExportPng}
          className="px-3 py-2 text-xs font-medium text-foreground hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export PNG
        </button>
      </div>
    </div>
  );
}

// Inner component that uses useReactFlow
function MindMapFlow({ topic, keyIdeas, flowRef, getConceptStatus, weakAreas, onGoToQuiz }) {
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);

  const handleExpand = useCallback((nodeId) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  const handleNodeClick = useCallback((nodeId, nodeData) => {
    setSelectedNode(nodeData);
    setSidePanelOpen(true);
  }, []);

  const handleTestConcept = useCallback((conceptLabel) => {
    // Navigate to quiz tab - the concept can be used to filter/focus
    if (onGoToQuiz) {
      onGoToQuiz();
    }
  }, [onGoToQuiz]);

  const handlers = useMemo(() => ({
    onExpand: handleExpand,
    onNodeClick: handleNodeClick,
    onTestConcept: handleTestConcept,
  }), [handleExpand, handleNodeClick, handleTestConcept]);

  // Generate layout
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => generateMindMapLayout(topic, keyIdeas, expandedNodes, handlers, getConceptStatus, weakAreas),
    [topic, keyIdeas, expandedNodes, handlers, getConceptStatus, weakAreas]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when layout changes
  useMemo(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onInit = useCallback((reactFlowInstance) => {
    reactFlowInstance.fitView({ padding: 0.2 });
  }, []);

  const handleExportPng = useCallback(() => {
    if (flowRef.current === null) return;

    toPng(flowRef.current, {
      backgroundColor: '#ffffff',
      quality: 1,
      pixelRatio: 2,
    })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = `mindmap-${extractString(topic, 'export')}.png`;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.error('Failed to export PNG:', err);
      });
  }, [flowRef, topic]);

  return (
    <>
      <div ref={flowRef} className="h-[500px] border border-border rounded-xl overflow-hidden bg-background relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onInit={onInit}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
          proOptions={{ hideAttribution: true }}
          minZoom={0.3}
          maxZoom={2}
        >
          <Background color="var(--border)" gap={20} />
          <CustomToolbar
            onExportPng={handleExportPng}
          />
          <MiniMap
            nodeColor={(node) => {
              if (node.id === 'root') return nodeColors.root.bgSolid;
              if (node.id.startsWith('idea_')) return nodeColors.keyIdea.bgSolid;
              return nodeColors.subConcept.bgSolid;
            }}
            maskColor="rgba(0, 0, 0, 0.08)"
            className="bg-card/80 backdrop-blur-sm border border-border rounded-xl shadow-lg"
            position="bottom-right"
          />
        </ReactFlow>
      </div>

      {/* Side Panel */}
      <SidePanel
        isOpen={sidePanelOpen}
        onClose={() => setSidePanelOpen(false)}
        nodeData={selectedNode}
        onTestConcept={handleTestConcept}
      />

      {/* Overlay when side panel is open */}
      {sidePanelOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setSidePanelOpen(false)}
        />
      )}
    </>
  );
}

// Main component
export default function MindMapTabView({ mindMap, keyIdeas, getConceptStatus, weakAreas, onGoToQuiz, onCaptureReady }) {
  const flowRef = useRef(null);

  // Get topic from mindMap or first keyIdea - ensure it's a string
  const topic = extractString(
    mindMap?.root || keyIdeas?.[0]?.topic,
    'Learning Topic'
  );

  // Use keyIdeas if provided, otherwise try to construct from mindMap branches
  const ideas = keyIdeas || (mindMap?.branches?.map((branch, idx) => ({
    title: extractString(branch?.label, `Key Idea ${idx + 1}`),
    explanation: '',
    concepts: branch?.children || [],
  })) || []);

  // Check if there are weak areas to highlight
  const hasWeakAreas = weakAreas && weakAreas.length > 0;

  useEffect(() => {
    if (!onCaptureReady) return undefined;

    onCaptureReady(async () => {
      if (!flowRef.current) return null;
      return toPng(flowRef.current, {
        backgroundColor: '#ffffff',
        quality: 1,
        pixelRatio: 2,
      });
    });

    return () => onCaptureReady(null);
  }, [onCaptureReady]);

  if ((!mindMap?.root && (!keyIdeas || keyIdeas.length === 0))) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
        <p>No mind map available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Weak Areas Alert */}
      {hasWeakAreas && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-3">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-600 dark:text-red-400">
              {weakAreas.length} concept{weakAreas.length > 1 ? 's' : ''} need{weakAreas.length === 1 ? 's' : ''} practice
            </p>
            <p className="text-xs text-muted-foreground">
              Look for nodes with red rings - click the test button to practice
            </p>
          </div>
          {onGoToQuiz && (
            <button
              onClick={onGoToQuiz}
              className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-colors"
            >
              Practice Now
            </button>
          )}
        </div>
      )}

      {/* Info */}
      <div className="bg-muted/30 rounded-lg p-3 flex items-center gap-2">
        <svg className="w-4 h-4 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-sm text-muted-foreground">
          Click nodes to view details. Use + to expand and quiz icon to test yourself. Pan to move, scroll to zoom.
        </span>
      </div>

      {/* Mind Map */}
      <ReactFlowProvider>
        <MindMapFlow
          topic={topic}
          keyIdeas={ideas}
          flowRef={flowRef}
          getConceptStatus={getConceptStatus}
          weakAreas={weakAreas}
          onGoToQuiz={onGoToQuiz}
        />
      </ReactFlowProvider>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground flex-wrap p-3 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-full shadow-sm"
            style={{ background: nodeColors.root.bg }}
          ></div>
          <span className="font-medium">Main Topic</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-lg shadow-sm"
            style={{ background: nodeColors.keyIdea.bg }}
          ></div>
          <span className="font-medium">Key Ideas</span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-lg shadow-sm"
            style={{ background: nodeColors.subConcept.bgSolid, border: `1px solid ${nodeColors.subConcept.border}` }}
          ></div>
          <span className="font-medium">Sub-concepts</span>
        </div>
      </div>
    </div>
  );
}

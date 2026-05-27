import { useState, useEffect, useRef } from 'react';

export default function MindMapView({ mindmap, topic }) {
  const [expandedNodes, setExpandedNodes] = useState(new Set(['central']));
  const [selectedNode, setSelectedNode] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const svgRef = useRef(null);

  useEffect(() => {
    if (!isFullscreen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  if (!mindmap) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
        <p>Mind map not available</p>
      </div>
    );
  }

  const toggleNode = (nodeId) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleNodeClick = (node) => {
    setSelectedNode(selectedNode?.id === node.id ? null : node);
    toggleNode(node.id);
  };

  const shellClassName = isFullscreen
    ? 'fixed inset-0 z-[9999] overflow-y-auto bg-background p-4 sm:p-6'
    : 'space-y-4';
  const innerClassName = isFullscreen
    ? 'mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-7xl flex-col gap-6 bg-background sm:min-h-[calc(100dvh-3rem)]'
    : 'space-y-4';
  const fullscreenButton = (
    <button
      type="button"
      onClick={() => setIsFullscreen(value => !value)}
      className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition hover:bg-muted hover:text-foreground"
      aria-label={isFullscreen ? 'Exit full screen mind map' : 'Open mind map full screen'}
      title={isFullscreen ? 'Exit full screen' : 'Full screen'}
    >
      {isFullscreen ? (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3v5H3" />
          <path d="M16 3v5h5" />
          <path d="M8 21v-5H3" />
          <path d="M16 21v-5h5" />
        </svg>
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8V3h5" />
          <path d="M21 8V3h-5" />
          <path d="M3 16v5h5" />
          <path d="M21 16v5h-5" />
        </svg>
      )}
    </button>
  );

  return (
    <div className={shellClassName}>
      <div className={innerClassName}>
      <div className="flex justify-end">
        {fullscreenButton}
      </div>
      {/* Central Topic */}
      <div className="flex flex-col items-center">
        <div
          onClick={() => handleNodeClick({ id: 'central', label: mindmap.central })}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-lg cursor-pointer hover:bg-primary/90 transition-all shadow-lg"
        >
          {mindmap.central}
        </div>
      </div>

      {/* Branches */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {mindmap.branches?.map((branch, index) => (
          <div
            key={branch.id}
            className="bg-muted/30 border border-border rounded-xl p-4 transition-all hover:shadow-md"
          >
            <button
              onClick={() => handleNodeClick(branch)}
              className="w-full flex items-center justify-between text-left"
            >
              <span className="font-medium text-foreground flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary"></span>
                {branch.label}
              </span>
              {branch.children?.length > 0 && (
                <svg
                  className={`w-4 h-4 text-muted-foreground transition-transform ${
                    expandedNodes.has(branch.id) ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>

            {/* Children */}
            {expandedNodes.has(branch.id) && branch.children?.length > 0 && (
              <div className="mt-3 pl-4 border-l-2 border-primary/30 space-y-2">
                {branch.children.map((child) => (
                  <div
                    key={child.id}
                    onClick={() => handleNodeClick(child)}
                    className="py-1.5 px-3 bg-background/50 rounded-lg text-sm text-foreground/80 cursor-pointer hover:bg-background transition-colors"
                  >
                    {child.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Selected Node Info */}
      {selectedNode && (
        <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-xl">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-foreground">{selectedNode.label}</h4>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Click to explore this concept further or ask a question about it.
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-4 border-t border-border">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-primary"></span>
          Main Topic
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-muted border border-border"></span>
          Sub-topics
        </span>
        <span>Click to expand/collapse</span>
      </div>
      </div>
    </div>
  );
}

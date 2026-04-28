/**
 * HeapSimulation - Visualizes heap operations (insert, extract, heapify)
 * Shows both tree and array representations
 */
export default function HeapSimulation({ step }) {
  const state = step?.state || {};
  const variables = step?.variables || {};
  const highlights = step?.highlights || {};

  const heap = state.heap || variables.heap || [];
  const isMaxHeap = state.isMaxHeap !== false; // Default to max heap
  const comparing = state.comparing || [];
  const swapped = state.swapped || [];
  const inserted = state.inserted;
  const extracting = state.extracting;
  const settled = state.settled;
  const bubbleUp = state.bubbleUp;
  const bubbleDown = state.bubbleDown;

  // Calculate tree layout
  const getLevel = (index) => Math.floor(Math.log2(index + 1));
  const maxLevel = heap.length > 0 ? getLevel(heap.length - 1) : 0;

  // Generate tree nodes with positions
  const treeNodes = heap.map((value, index) => {
    const level = getLevel(index);
    const nodesInLevel = Math.pow(2, level);
    const positionInLevel = index - (Math.pow(2, level) - 1);
    const horizontalSpacing = 100 / (nodesInLevel + 1);
    const x = horizontalSpacing * (positionInLevel + 1);
    const y = (level + 1) * 60;

    const parentIndex = Math.floor((index - 1) / 2);
    const parentLevel = index > 0 ? getLevel(parentIndex) : -1;
    const parentPositionInLevel = parentIndex - (Math.pow(2, parentLevel) - 1);
    const parentNodesInLevel = Math.pow(2, parentLevel);
    const parentHorizontalSpacing = 100 / (parentNodesInLevel + 1);
    const parentX = parentHorizontalSpacing * (parentPositionInLevel + 1);
    const parentY = parentLevel >= 0 ? (parentLevel + 1) * 60 : 0;

    return {
      value,
      index,
      x,
      y,
      parentX: index > 0 ? parentX : null,
      parentY: index > 0 ? parentY : null
    };
  });

  const isComparing = (index) => comparing.includes(index);
  const isSwapped = (index) => swapped.includes(index);
  const isInserted = (index) => inserted === index;
  const isExtracting = (index) => extracting === index;
  const isSettled = (index) => settled === index;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4">
      {/* Heap type indicator */}
      <div className="flex items-center gap-4">
        <span className={`
          px-3 py-1 rounded-full text-sm font-medium
          ${isMaxHeap ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400' :
            'bg-blue-500/20 text-blue-600 dark:text-blue-400'}
        `}>
          {isMaxHeap ? 'Max Heap' : 'Min Heap'}
        </span>
        {bubbleUp && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            ↑ Bubble Up
          </span>
        )}
        {bubbleDown && (
          <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
            ↓ Bubble Down
          </span>
        )}
      </div>

      {/* Tree visualization */}
      <div className="relative w-full h-48 min-h-[12rem]">
        {heap.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            Empty Heap
          </div>
        ) : (
          <svg className="w-full h-full" viewBox="0 0 100 200" preserveAspectRatio="xMidYMid meet">
            {/* Draw edges first */}
            {treeNodes.map((node, index) => (
              index > 0 && (
                <line
                  key={`edge-${index}`}
                  x1={node.parentX}
                  y1={node.parentY + 15}
                  x2={node.x}
                  y2={node.y - 15}
                  stroke={isSwapped(index) ? '#f59e0b' : '#94a3b8'}
                  strokeWidth={isSwapped(index) ? 0.8 : 0.4}
                  strokeDasharray={isSwapped(index) ? '2,2' : 'none'}
                />
              )
            ))}

            {/* Draw nodes */}
            {treeNodes.map((node, index) => {
              const comparing_ = isComparing(index);
              const swapped_ = isSwapped(index);
              const inserted_ = isInserted(index);
              const extracting_ = isExtracting(index);
              const settled_ = isSettled(index);

              let fill = '#64748b';
              let stroke = '#475569';
              if (extracting_) {
                fill = '#ef4444';
                stroke = '#dc2626';
              } else if (inserted_) {
                fill = '#10b981';
                stroke = '#059669';
              } else if (swapped_) {
                fill = '#f59e0b';
                stroke = '#d97706';
              } else if (comparing_) {
                fill = '#3b82f6';
                stroke = '#2563eb';
              } else if (settled_) {
                fill = '#8b5cf6';
                stroke = '#7c3aed';
              } else if (index === 0) {
                fill = isMaxHeap ? '#f43f5e' : '#3b82f6';
                stroke = isMaxHeap ? '#e11d48' : '#2563eb';
              }

              return (
                <g key={`node-${index}`}>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={8}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={0.5}
                    className={`
                      ${comparing_ || swapped_ ? 'animate-pulse' : ''}
                    `}
                  />
                  <text
                    x={node.x}
                    y={node.y + 0.5}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize="5"
                    fontWeight="bold"
                  >
                    {node.value}
                  </text>
                  <text
                    x={node.x}
                    y={node.y + 14}
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize="3"
                  >
                    [{index}]
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </div>

      {/* Array representation */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-xs text-muted-foreground">Array Representation</span>
        <div className="flex items-center gap-1">
          {heap.map((value, index) => {
            const comparing_ = isComparing(index);
            const swapped_ = isSwapped(index);
            const inserted_ = isInserted(index);
            const extracting_ = isExtracting(index);
            const settled_ = isSettled(index);

            return (
              <div
                key={index}
                className={`
                  flex flex-col items-center transition-all duration-300
                  ${swapped_ ? 'scale-110' : ''}
                `}
              >
                <div
                  className={`
                    w-10 h-10 rounded flex items-center justify-center font-mono font-bold
                    ${extracting_ ? 'bg-rose-500 text-white' :
                      inserted_ ? 'bg-emerald-500 text-white' :
                      swapped_ ? 'bg-amber-500 text-white' :
                      comparing_ ? 'bg-blue-500 text-white' :
                      settled_ ? 'bg-purple-500 text-white' :
                      index === 0 ? (isMaxHeap ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-blue-500/20 text-blue-600 dark:text-blue-400') :
                      'bg-muted text-foreground'}
                  `}
                >
                  {value}
                </div>
                <span className="text-xs text-muted-foreground mt-0.5">{index}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Variables */}
      <div className="flex flex-wrap gap-3 justify-center text-sm">
        <div className="bg-muted/50 rounded px-3 py-1">
          <span className="text-muted-foreground">Size: </span>
          <span className="font-mono font-bold">{heap.length}</span>
        </div>
        {heap.length > 0 && (
          <div className={`rounded px-3 py-1 ${isMaxHeap ? 'bg-rose-500/10' : 'bg-blue-500/10'}`}>
            <span className="text-muted-foreground">{isMaxHeap ? 'Max' : 'Min'}: </span>
            <span className={`font-mono font-bold ${isMaxHeap ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`}>
              {heap[0]}
            </span>
          </div>
        )}
        {variables.extractedValue !== undefined && (
          <div className="bg-amber-500/10 rounded px-3 py-1">
            <span className="text-muted-foreground">Extracted: </span>
            <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{variables.extractedValue}</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs justify-center">
        <div className="flex items-center gap-1.5">
          <div className={`w-3 h-3 ${isMaxHeap ? 'bg-rose-500' : 'bg-blue-500'} rounded-full`}></div>
          <span className="text-muted-foreground">Root ({isMaxHeap ? 'Max' : 'Min'})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span className="text-muted-foreground">Comparing</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
          <span className="text-muted-foreground">Swapping</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
          <span className="text-muted-foreground">Inserted</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
          <span className="text-muted-foreground">Settled</span>
        </div>
      </div>
    </div>
  );
}

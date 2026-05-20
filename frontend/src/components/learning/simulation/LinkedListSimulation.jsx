/**
 * LinkedListSimulation - Visualizes linked list operations
 * Shows nodes with pointers, current position, and operation highlights
 */
export default function LinkedListSimulation({ step }) {
  const state = step?.state || {};
  const variables = step?.variables || {};
  const highlights = step?.highlights || {};

  const list = state.list || variables.list || [];
  const current = state.current;
  const previous = state.previous;
  const newNode = state.newNode;
  const operation = state.operation || variables.operation;
  const foundAt = state.foundAt;
  const temp = state.temp;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-6 overflow-x-auto">
      {/* Operation indicator */}
      {operation && (
        <div className="text-center">
          <span className={`
            inline-block px-3 py-1 rounded-full text-sm font-medium
            ${operation.includes('insert') ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
              operation.includes('delete') ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400' :
              operation.includes('reverse') ? 'bg-neutral-500/20 text-neutral-600 dark:text-neutral-400' :
              operation.includes('search') ? 'bg-neutral-500/20 text-neutral-600 dark:text-neutral-400' :
              'bg-muted text-muted-foreground'}
          `}>
            {operation}
          </span>
        </div>
      )}

      {/* New node being inserted */}
      {newNode && (
        <div className="flex items-center gap-2 animate-bounce">
          <div className="flex items-center border-2 border-emerald-500 rounded-lg overflow-hidden bg-emerald-50 dark:bg-emerald-900/30">
            <div className="px-4 py-2 font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {newNode.value}
            </div>
            <div className="px-2 py-2 border-l border-emerald-500 text-emerald-500">
              •
            </div>
          </div>
          <span className="text-xs text-emerald-600 dark:text-emerald-400">↓ new node</span>
        </div>
      )}

      {/* Linked list visualization */}
      <div className="flex items-center gap-0 py-4 px-8 overflow-x-auto max-w-full">
        {/* HEAD pointer */}
        <div className="flex flex-col items-center mr-2">
          <span className="text-xs text-primary font-semibold mb-1">HEAD</span>
          <div className="w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8 border-t-primary"></div>
        </div>

        {list.length === 0 ? (
          <div className="px-4 py-2 text-muted-foreground italic">
            Empty List → NULL
          </div>
        ) : (
          list.map((node, index) => {
            const isCurrent = current === index;
            const isPrevious = previous === index;
            const isFound = foundAt === index;
            const isTemp = temp === index;
            const isDeleting = state.deleting === index;

            return (
              <div key={index} className="flex items-center">
                {/* Node */}
                <div
                  className={`
                    flex items-center border-2 rounded-lg overflow-hidden transition-all duration-300
                    ${isDeleting ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/30 opacity-50 scale-95' :
                      isFound ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 scale-110 shadow-lg' :
                      isCurrent ? 'border-primary bg-primary/10 scale-105 shadow-md' :
                      isPrevious ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30' :
                      isTemp ? 'border-neutral-500 bg-neutral-50 dark:bg-neutral-900/30' :
                      'border-border bg-card'}
                  `}
                >
                  <div className={`
                    px-4 py-2 font-mono font-bold
                    ${isDeleting ? 'text-rose-600 dark:text-rose-400 line-through' :
                      isFound ? 'text-emerald-600 dark:text-emerald-400' :
                      isCurrent ? 'text-primary' :
                      isPrevious ? 'text-amber-600 dark:text-amber-400' :
                      isTemp ? 'text-neutral-600 dark:text-neutral-400' :
                      'text-foreground'}
                  `}>
                    {typeof node === 'object' ? node.value : node}
                  </div>
                  <div className={`
                    px-2 py-2 border-l
                    ${isDeleting ? 'border-rose-500' :
                      isFound ? 'border-emerald-500' :
                      isCurrent ? 'border-primary' :
                      isPrevious ? 'border-amber-500' :
                      isTemp ? 'border-neutral-500' :
                      'border-border'}
                  `}>
                    <span className="text-muted-foreground">•</span>
                  </div>
                </div>

                {/* Pointer arrow */}
                <div className="flex items-center">
                  <div className={`
                    w-8 h-0.5
                    ${isDeleting ? 'bg-rose-400' :
                      isCurrent ? 'bg-primary' :
                      'bg-muted-foreground/50'}
                  `}></div>
                  <div className={`
                    w-0 h-0 border-l-4 border-t-4 border-b-4 border-l-current border-t-transparent border-b-transparent
                    ${isDeleting ? 'text-rose-400' :
                      isCurrent ? 'text-primary' :
                      'text-muted-foreground/50'}
                  `}></div>
                </div>

                {/* Pointer labels */}
                {isCurrent && (
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-primary font-semibold">
                    current
                  </div>
                )}
                {isPrevious && (
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-amber-600 dark:text-amber-400 font-semibold">
                    prev
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* NULL terminator */}
        <div className="px-3 py-1 bg-muted rounded text-sm font-mono text-muted-foreground">
          NULL
        </div>
      </div>

      {/* Variables panel */}
      <div className="flex flex-wrap gap-4 justify-center">
        {variables.length !== undefined && (
          <div className="bg-muted/50 rounded px-3 py-1.5 text-sm">
            <span className="text-muted-foreground">Length: </span>
            <span className="font-mono font-bold">{variables.length}</span>
          </div>
        )}
        {variables.position !== undefined && (
          <div className="bg-muted/50 rounded px-3 py-1.5 text-sm">
            <span className="text-muted-foreground">Position: </span>
            <span className="font-mono font-bold">{variables.position}</span>
          </div>
        )}
        {variables.searchValue !== undefined && (
          <div className="bg-neutral-500/10 rounded px-3 py-1.5 text-sm">
            <span className="text-muted-foreground">Searching: </span>
            <span className="font-mono font-bold text-neutral-600 dark:text-neutral-400">{variables.searchValue}</span>
          </div>
        )}
        {variables.traversed !== undefined && (
          <div className="bg-muted/50 rounded px-3 py-1.5 text-sm">
            <span className="text-muted-foreground">Traversed: </span>
            <span className="font-mono font-bold">{variables.traversed}</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs justify-center mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 border-2 border-primary bg-primary/10 rounded"></div>
          <span className="text-muted-foreground">Current</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 border-2 border-amber-500 bg-amber-50 dark:bg-amber-900/30 rounded"></div>
          <span className="text-muted-foreground">Previous</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 rounded"></div>
          <span className="text-muted-foreground">Found/New</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 border-2 border-rose-500 bg-rose-50 dark:bg-rose-900/30 rounded"></div>
          <span className="text-muted-foreground">Deleting</span>
        </div>
      </div>
    </div>
  );
}

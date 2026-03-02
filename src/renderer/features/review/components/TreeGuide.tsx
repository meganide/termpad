interface TreeGuideProps {
  depth: number;
  isLast: boolean;
  /** Whether this node has children (only relevant for folders to skip the horizontal line) */
  hasChildren?: boolean;
}

const INDENT_WIDTH = 16;

/**
 * Renders visual tree guide lines for hierarchy visualization.
 * - Vertical lines for each ancestor level
 * - Horizontal connector line to the current node
 */
export function TreeGuide({ depth, isLast, hasChildren = false }: TreeGuideProps) {
  if (depth === 0) {
    return null;
  }

  return (
    <div className="flex-shrink-0 flex items-stretch" style={{ width: depth * INDENT_WIDTH }}>
      {Array.from({ length: depth }, (_, i) => {
        const isLastLevel = i === depth - 1;

        return (
          <div key={i} className="relative" style={{ width: INDENT_WIDTH, height: '100%' }}>
            {/* Vertical line for non-last levels (ancestors) */}
            {!isLastLevel && (
              <div
                className="absolute left-[7px] top-0 bottom-0 w-px bg-border"
                aria-hidden="true"
              />
            )}

            {/* Last level: vertical + horizontal connector */}
            {isLastLevel && (
              <>
                {/* Vertical line - full height if not last, half if last */}
                <div
                  className={`absolute left-[7px] top-0 w-px bg-border ${
                    isLast ? 'h-1/2' : 'h-full'
                  }`}
                  aria-hidden="true"
                />
                {/* Horizontal connector */}
                {!hasChildren && (
                  <div
                    className="absolute left-[7px] top-1/2 h-px bg-border"
                    style={{ width: INDENT_WIDTH - 7 }}
                    aria-hidden="true"
                  />
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

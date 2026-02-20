import { useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

// --- Types ---

export interface TreeNode {
  id: string;
  label: string;
  icon?: ReactNode;
  children?: TreeNode[];
  expanded?: boolean;
  isActive?: boolean;
  /** Extra content rendered on the right side of the node */
  badge?: ReactNode;
}

export interface TreeViewProps {
  /** Tree data */
  nodes: TreeNode[];
  /** Accessible label for the tree */
  label: string;
  /** Currently selected node ID */
  selectedId?: string | null;
  /** Called when a leaf node is selected or a parent node is activated */
  onSelect?: (id: string) => void;
  /** Called when a parent node's expand/collapse state should toggle */
  onToggle?: (id: string) => void;
  /** Render actions (buttons) on the right side of a node on hover */
  renderActions?: (node: TreeNode) => ReactNode;
  /** Optional context menu wrapper — receives the node and its rendered content */
  renderContextMenu?: (node: TreeNode, children: ReactNode) => ReactNode;
  /** Custom label renderer — return ReactNode to override the default label */
  renderLabel?: (node: TreeNode) => ReactNode | null;
  /** Called when a node is double-clicked */
  onDoubleClick?: (id: string) => void;
  /** Called when Escape is pressed — use to return focus to main content */
  onEscape?: () => void;
  /** Additional className for the root */
  className?: string;
}

// --- Helpers ---

interface FlatNode {
  id: string;
  level: number;
  parentId: string | null;
  node: TreeNode;
  hasChildren: boolean;
}

/** Flatten tree into visible nodes for keyboard navigation */
function flattenVisible(nodes: TreeNode[], level = 1, parentId: string | null = null): FlatNode[] {
  const result: FlatNode[] = [];
  for (const node of nodes) {
    const hasChildren = !!node.children?.length;
    result.push({ id: node.id, level, parentId, node, hasChildren });
    if (node.expanded && node.children) {
      result.push(...flattenVisible(node.children, level + 1, node.id));
    }
  }
  return result;
}

// --- Component ---

export function TreeView({
  nodes,
  label,
  selectedId,
  onSelect,
  onToggle,
  renderLabel,
  renderActions,
  renderContextMenu,
  onDoubleClick,
  onEscape,
  className = "",
}: TreeViewProps) {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const visibleNodes = flattenVisible(nodes);

  // Focus the element when focusedId changes
  useEffect(() => {
    if (focusedId) {
      const el = itemRefs.current.get(focusedId);
      el?.focus();
    }
  }, [focusedId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const flatIndex = visibleNodes.findIndex((n) => n.id === focusedId);
      if (flatIndex === -1 && visibleNodes.length > 0) {
        // No focused node — focus first
        setFocusedId(visibleNodes[0].id);
        return;
      }

      const current = visibleNodes[flatIndex];
      if (!current) return;

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const next = visibleNodes[flatIndex + 1];
          if (next) setFocusedId(next.id);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prev = visibleNodes[flatIndex - 1];
          if (prev) setFocusedId(prev.id);
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          if (current.hasChildren && !current.node.expanded) {
            // Expand
            onToggle?.(current.id);
          } else if (current.hasChildren && current.node.expanded) {
            // Focus first child
            const firstChild = visibleNodes[flatIndex + 1];
            if (firstChild && firstChild.parentId === current.id) {
              setFocusedId(firstChild.id);
            }
          }
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          if (current.hasChildren && current.node.expanded) {
            // Collapse
            onToggle?.(current.id);
          } else if (current.parentId) {
            // Focus parent
            setFocusedId(current.parentId);
          }
          break;
        }
        case "Home": {
          e.preventDefault();
          if (visibleNodes.length > 0) {
            setFocusedId(visibleNodes[0].id);
          }
          break;
        }
        case "End": {
          e.preventDefault();
          if (visibleNodes.length > 0) {
            setFocusedId(visibleNodes[visibleNodes.length - 1].id);
          }
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          if (current.hasChildren) {
            onToggle?.(current.id);
          }
          onSelect?.(current.id);
          break;
        }
        case "Escape": {
          e.preventDefault();
          setFocusedId(null);
          onEscape?.();
          break;
        }
      }
    },
    [visibleNodes, focusedId, onSelect, onToggle, onEscape]
  );

  const registerRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      itemRefs.current.set(id, el);
    } else {
      itemRefs.current.delete(id);
    }
  }, []);

  return (
    <div
      ref={treeRef}
      role="tree"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={className}
    >
      {nodes.map((node) => (
        <TreeNodeItem
          key={node.id}
          node={node}
          level={1}
          focusedId={focusedId}
          selectedId={selectedId}
          onFocus={setFocusedId}
          onSelect={onSelect}
          onToggle={onToggle}
          onDoubleClick={onDoubleClick}
          renderLabel={renderLabel}
          renderActions={renderActions}
          renderContextMenu={renderContextMenu}
          registerRef={registerRef}
        />
      ))}
    </div>
  );
}

// --- TreeNodeItem (internal) ---

interface TreeNodeItemProps {
  node: TreeNode;
  level: number;
  focusedId: string | null;
  selectedId?: string | null;
  onFocus: (id: string) => void;
  onSelect?: (id: string) => void;
  onToggle?: (id: string) => void;
  onDoubleClick?: (id: string) => void;
  renderLabel?: (node: TreeNode) => ReactNode | null;
  renderActions?: (node: TreeNode) => ReactNode;
  renderContextMenu?: (node: TreeNode, children: ReactNode) => ReactNode;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
}

function TreeNodeItem({
  node,
  level,
  focusedId,
  selectedId,
  onFocus,
  onSelect,
  onToggle,
  onDoubleClick,
  renderLabel,
  renderActions,
  renderContextMenu,
  registerRef,
}: TreeNodeItemProps) {
  const hasChildren = !!node.children?.length;
  const isFocused = focusedId === node.id;
  const isSelected = selectedId === node.id;
  const indent = (level - 1) * 16;

  const handleClick = useCallback(() => {
    onFocus(node.id);
    if (hasChildren) {
      onToggle?.(node.id);
    }
    onSelect?.(node.id);
  }, [node.id, hasChildren, onFocus, onSelect, onToggle]);

  const content = (
    <div
      ref={(el) => registerRef(node.id, el)}
      role="treeitem"
      aria-expanded={hasChildren ? node.expanded : undefined}
      aria-level={level}
      aria-selected={isSelected}
      tabIndex={isFocused ? 0 : -1}
      onFocus={() => onFocus(node.id)}
      onClick={handleClick}
      onDoubleClick={onDoubleClick ? () => onDoubleClick(node.id) : undefined}
      className={`
        group flex items-center gap-1 px-2 py-1 text-sm rounded-md cursor-pointer outline-none
        transition-default select-none
        ${node.isActive
          ? "bg-accent/15 text-accent border-l-2 border-accent -ml-px"
          : isSelected
            ? "bg-accent/10 text-foreground"
            : "text-foreground-secondary hover:bg-muted/50"
        }
        ${isFocused ? "ring-1 ring-accent/40" : ""}
      `}
      style={{ paddingLeft: `${indent + 8}px` }}
    >
      {/* Expand/collapse chevron */}
      {hasChildren ? (
        <ChevronRight
          className={`w-3.5 h-3.5 shrink-0 text-foreground-muted transition-transform duration-150
            ${node.expanded ? "rotate-90" : ""}
          `}
        />
      ) : (
        <span className="w-3.5 shrink-0" />
      )}

      {/* Icon */}
      {node.icon && (
        <span className="shrink-0 text-foreground-muted">{node.icon}</span>
      )}

      {/* Label */}
      {renderLabel?.(node) ?? <span className="truncate flex-1">{node.label}</span>}

      {/* Badge */}
      {node.badge && (
        <span className="shrink-0 text-2xs text-foreground-muted">{node.badge}</span>
      )}

      {/* Hover actions */}
      {renderActions && (
        <span className="shrink-0 opacity-0 group-hover:opacity-100 transition-default flex items-center gap-0.5">
          {renderActions(node)}
        </span>
      )}
    </div>
  );

  return (
    <div>
      {renderContextMenu ? renderContextMenu(node, content) : content}

      {/* Children */}
      {hasChildren && node.expanded && (
        <div role="group">
          {node.children!.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              level={level + 1}
              focusedId={focusedId}
              selectedId={selectedId}
              onFocus={onFocus}
              onSelect={onSelect}
              onToggle={onToggle}
              onDoubleClick={onDoubleClick}
              renderLabel={renderLabel}
              renderActions={renderActions}
              renderContextMenu={renderContextMenu}
              registerRef={registerRef}
            />
          ))}
        </div>
      )}
    </div>
  );
}

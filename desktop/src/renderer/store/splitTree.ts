/**
 * Recursive split tree data model for terminal pane layouts.
 *
 * Replaces the flat `panes[] + splitDirection` model with a binary tree
 * that supports arbitrary nesting — 2×2 grids, L-shapes, etc.
 *
 * Follows the Warp terminal approach (binary split tree with flex ratios).
 */

import type { ContentPane } from "./appStore";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface PaneNode {
  type: "pane";
  pane: ContentPane;
}

export interface SplitContainerNode {
  type: "split";
  direction: "horizontal" | "vertical";
  children: SplitNode[];
  /** Flex ratios for each child. Always same length as children. */
  sizes: number[];
}

export type SplitNode = PaneNode | SplitContainerNode;

// ─── Queries ────────────────────────────────────────────────────────────────────

/** Extract all panes from the tree in visual order (left→right, top→bottom). */
export function flattenPanes(node: SplitNode): ContentPane[] {
  if (node.type === "pane") return [node.pane];
  return node.children.flatMap(flattenPanes);
}

/** Find a PaneNode by pane ID via DFS. */
export function findPaneNode(node: SplitNode, paneId: string): PaneNode | null {
  if (node.type === "pane") {
    return node.pane.id === paneId ? node : null;
  }
  for (const child of node.children) {
    const found = findPaneNode(child, paneId);
    if (found) return found;
  }
  return null;
}

/** Find the parent split and index of a node containing the target pane. */
export function findParentSplit(
  tree: SplitNode,
  paneId: string,
  parent?: SplitContainerNode,
  index?: number
): { parent: SplitContainerNode; index: number } | null {
  if (tree.type === "pane") {
    return tree.pane.id === paneId && parent !== undefined && index !== undefined
      ? { parent, index }
      : null;
  }
  for (let i = 0; i < tree.children.length; i++) {
    const child = tree.children[i];
    // Check if this child directly contains the pane
    const result = findParentSplit(child, paneId, tree, i);
    if (result) return result;
  }
  return null;
}

/** Get the root-level split direction (for backward-compat UI). */
export function getRootDirection(tree: SplitNode): "horizontal" | "vertical" {
  if (tree.type === "split") return tree.direction;
  return "horizontal"; // Single pane, default
}

/** Count total panes in the tree. */
export function countPanes(node: SplitNode): number {
  if (node.type === "pane") return 1;
  return node.children.reduce((sum, c) => sum + countPanes(c), 0);
}

// ─── Mutations (pure — return new trees) ────────────────────────────────────────

/**
 * Insert a new pane by splitting the target pane.
 *
 * Algorithm:
 * 1. Find target pane in tree.
 * 2. If parent split direction matches → insert as sibling (halve target's size).
 * 3. If direction differs (or target is root) → wrap target in new split node.
 */
export function insertSplit(
  tree: SplitNode,
  targetPaneId: string,
  newPane: ContentPane,
  direction: "horizontal" | "vertical"
): SplitNode {
  return insertSplitRecursive(tree, targetPaneId, newPane, direction);
}

function insertSplitRecursive(
  node: SplitNode,
  targetPaneId: string,
  newPane: ContentPane,
  direction: "horizontal" | "vertical"
): SplitNode {
  // Base case: this is the target pane — wrap in a new split
  if (node.type === "pane" && node.pane.id === targetPaneId) {
    return {
      type: "split",
      direction,
      children: [node, { type: "pane", pane: newPane }],
      sizes: [50, 50],
    };
  }

  if (node.type === "pane") return node; // Not the target, leave as-is

  // Split node — check if any direct child is the target pane
  // AND our direction matches → insert as sibling
  if (node.direction === direction) {
    const targetIndex = node.children.findIndex(
      (c) => c.type === "pane" && c.pane.id === targetPaneId
    );
    if (targetIndex !== -1) {
      // Insert new pane right after the target, halving the target's size
      const newChildren = [...node.children];
      const newSizes = [...node.sizes];
      const halfSize = newSizes[targetIndex] / 2;
      newSizes[targetIndex] = halfSize;
      newChildren.splice(targetIndex + 1, 0, { type: "pane", pane: newPane });
      newSizes.splice(targetIndex + 1, 0, halfSize);
      return { ...node, children: newChildren, sizes: newSizes };
    }
  }

  // Recurse into children
  const newChildren = node.children.map((child) =>
    insertSplitRecursive(child, targetPaneId, newPane, direction)
  );

  // Check if any child actually changed (reference equality)
  const changed = newChildren.some((c, i) => c !== node.children[i]);
  if (!changed) return node;

  return { ...node, children: newChildren };
}

/**
 * Remove a pane from the tree.
 *
 * After removal, collapse single-child split nodes into their remaining child.
 * Returns null if the tree becomes empty.
 */
export function removePaneFromTree(tree: SplitNode, paneId: string): SplitNode | null {
  if (tree.type === "pane") {
    return tree.pane.id === paneId ? null : tree;
  }

  const idx = tree.children.findIndex(
    (c) => c.type === "pane" && c.pane.id === paneId
  );

  if (idx !== -1) {
    // Direct child is the target — remove it
    const newChildren = tree.children.filter((_, i) => i !== idx);
    const removedSize = tree.sizes[idx];
    const newSizes = tree.sizes.filter((_, i) => i !== idx);

    // Redistribute the removed pane's size proportionally
    if (newSizes.length > 0) {
      const totalRemaining = newSizes.reduce((a, b) => a + b, 0);
      if (totalRemaining > 0) {
        const scale = (totalRemaining + removedSize) / totalRemaining;
        for (let i = 0; i < newSizes.length; i++) {
          newSizes[i] *= scale;
        }
      }
    }

    // Collapse: if only one child remains, promote it
    if (newChildren.length === 1) return newChildren[0];
    if (newChildren.length === 0) return null;

    return { ...tree, children: newChildren, sizes: newSizes };
  }

  // Recurse into children
  const newChildren: SplitNode[] = [];
  const newSizes: number[] = [];

  for (let i = 0; i < tree.children.length; i++) {
    const result = removePaneFromTree(tree.children[i], paneId);
    if (result === null) {
      // Child was completely removed (shouldn't happen for split nodes normally)
      continue;
    }
    newChildren.push(result);
    newSizes.push(tree.sizes[i]);
  }

  if (newChildren.length === 0) return null;
  if (newChildren.length === 1) return newChildren[0];

  // Normalize sizes if any were removed
  if (newChildren.length !== tree.children.length) {
    const total = newSizes.reduce((a, b) => a + b, 0);
    if (total > 0 && total !== 100) {
      const scale = 100 / total;
      for (let i = 0; i < newSizes.length; i++) {
        newSizes[i] *= scale;
      }
    }
  }

  return { ...tree, children: newChildren, sizes: newSizes };
}

/** Swap the positions of two panes in the tree. */
export function swapPanes(tree: SplitNode, paneId1: string, paneId2: string): SplitNode {
  if (paneId1 === paneId2) return tree;

  // Find both panes
  const pane1 = findPaneNode(tree, paneId1);
  const pane2 = findPaneNode(tree, paneId2);
  if (!pane1 || !pane2) return tree;

  // Swap their ContentPane data
  return swapPanesRecursive(tree, paneId1, paneId2, pane1.pane, pane2.pane);
}

function swapPanesRecursive(
  node: SplitNode,
  id1: string,
  id2: string,
  pane1: ContentPane,
  pane2: ContentPane
): SplitNode {
  if (node.type === "pane") {
    if (node.pane.id === id1) return { type: "pane", pane: pane2 };
    if (node.pane.id === id2) return { type: "pane", pane: pane1 };
    return node;
  }
  const newChildren = node.children.map((c) =>
    swapPanesRecursive(c, id1, id2, pane1, pane2)
  );
  return { ...node, children: newChildren };
}

/**
 * Dock a pane next to a target pane (remove from old position, insert at new).
 * Used for drag-and-drop edge docking.
 */
export function dockPane(
  tree: SplitNode,
  draggedPaneId: string,
  targetPaneId: string,
  direction: "horizontal" | "vertical"
): SplitNode {
  if (draggedPaneId === targetPaneId) return tree;

  // Find the dragged pane's data before removing
  const draggedNode = findPaneNode(tree, draggedPaneId);
  if (!draggedNode) return tree;
  const draggedPane = draggedNode.pane;

  // Remove the dragged pane from the tree
  const treeWithout = removePaneFromTree(tree, draggedPaneId);
  if (!treeWithout) return tree; // Would leave tree empty

  // Insert next to the target
  return insertSplit(treeWithout, targetPaneId, draggedPane, direction);
}

// ─── Constructors ───────────────────────────────────────────────────────────────

/** Create a tree from a flat list of panes (backward compat). */
export function treeFromFlat(
  panes: ContentPane[],
  direction: "horizontal" | "vertical"
): SplitNode {
  if (panes.length === 0) {
    throw new Error("Cannot create tree from empty pane list");
  }
  if (panes.length === 1) {
    return { type: "pane", pane: panes[0] };
  }
  const evenSize = 100 / panes.length;
  return {
    type: "split",
    direction,
    children: panes.map((p) => ({ type: "pane", pane: p })),
    sizes: panes.map(() => evenSize),
  };
}

/**
 * Create a 2×2 grid layout from up to 4 panes.
 *
 * Structure:
 *   vertical split
 *   ├── horizontal split [pane0, pane1]
 *   └── horizontal split [pane2, pane3]
 */
export function create2x2Grid(panes: ContentPane[]): SplitNode {
  if (panes.length < 2) {
    return panes.length === 1
      ? { type: "pane", pane: panes[0] }
      : { type: "pane", pane: panes[0] };
  }
  if (panes.length === 2) {
    return {
      type: "split",
      direction: "horizontal",
      children: panes.map((p) => ({ type: "pane", pane: p } as PaneNode)),
      sizes: [50, 50],
    };
  }

  // 3 or 4 panes: top row + bottom row
  const topRow: SplitNode = {
    type: "split",
    direction: "horizontal",
    children: [
      { type: "pane", pane: panes[0] },
      { type: "pane", pane: panes[1] },
    ],
    sizes: [50, 50],
  };

  const bottomChildren: PaneNode[] = panes.slice(2, 4).map((p) => ({
    type: "pane" as const,
    pane: p,
  }));

  const bottomRow: SplitNode =
    bottomChildren.length === 1
      ? bottomChildren[0]
      : {
          type: "split",
          direction: "horizontal",
          children: bottomChildren,
          sizes: bottomChildren.map(() => 100 / bottomChildren.length),
        };

  return {
    type: "split",
    direction: "vertical",
    children: [topRow, bottomRow],
    sizes: [50, 50],
  };
}

// ─── Serialization ──────────────────────────────────────────────────────────────

/** JSON-safe representation of a pane for persistence. */
export interface SerializedPaneNode {
  type: "pane";
  id: string;
  cwd: string;
  customLabel?: string;
}

/** JSON-safe representation of a split for persistence. */
export interface SerializedSplitContainerNode {
  type: "split";
  direction: "horizontal" | "vertical";
  children: SerializedSplitNode[];
  sizes: number[];
}

export type SerializedSplitNode = SerializedPaneNode | SerializedSplitContainerNode;

/**
 * Serialize a SplitNode tree to a JSON-safe representation.
 * Strips transient data (sessionId, processName, etc.) — only keeps id, cwd, customLabel.
 */
export function serializeSplitTree(node: SplitNode): SerializedSplitNode {
  if (node.type === "pane") {
    const p = node.pane;
    const serialized: SerializedPaneNode = {
      type: "pane",
      id: p.id,
      cwd: p.type === "terminal" ? p.cwd : "",
    };
    if (p.type === "terminal" && p.customLabel) {
      serialized.customLabel = p.customLabel;
    }
    return serialized;
  }
  return {
    type: "split",
    direction: node.direction,
    children: node.children.map(serializeSplitTree),
    sizes: [...node.sizes],
  };
}

/**
 * Deserialize a JSON-safe tree back to a live SplitNode tree.
 * Creates fresh sessionIds and sets lastActivity.
 */
export function deserializeSplitTree(
  node: SerializedSplitNode,
  tabId: string,
  counterRef: { value: number }
): SplitNode {
  if (node.type === "pane") {
    const idx = counterRef.value++;
    return {
      type: "pane",
      pane: {
        type: "terminal",
        id: node.id,
        sessionId: `${tabId}-${Date.now()}-${idx}`,
        cwd: node.cwd || "",
        customLabel: node.customLabel,
        lastActivity: Date.now(),
      },
    };
  }
  return {
    type: "split",
    direction: node.direction,
    children: node.children.map((c) => deserializeSplitTree(c, tabId, counterRef)),
    sizes: [...node.sizes],
  };
}

/** Update sizes at a specific split node identified by its children's pane IDs. */
export function updateSizes(
  tree: SplitNode,
  childPaneIds: string[],
  newSizes: number[]
): SplitNode {
  if (tree.type === "pane") return tree;

  // Check if this split node's direct children match the given pane IDs
  // (Used by PanelGroup onLayout to update flex ratios)
  const directPaneIds = tree.children.map((c) =>
    c.type === "pane" ? c.pane.id : null
  );
  const allMatch =
    directPaneIds.length === childPaneIds.length &&
    directPaneIds.every((id, i) => id === childPaneIds[i]);

  if (allMatch && newSizes.length === tree.sizes.length) {
    return { ...tree, sizes: newSizes };
  }

  // Recurse
  const newChildren = tree.children.map((c) =>
    updateSizes(c, childPaneIds, newSizes)
  );
  const changed = newChildren.some((c, i) => c !== tree.children[i]);
  return changed ? { ...tree, children: newChildren } : tree;
}

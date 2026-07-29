import type { Transfer } from "./types";

export interface GraphNode {
  memberId: string;
  side: "payer" | "receiver";
  cx: number;
  cy: number;
}

export interface GraphEdge {
  transferIndex: number;
  path: string;
  amountX: number;
  amountY: number;
}

export interface GraphLayout {
  width: number;
  height: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphLayoutOptions {
  nodeRadius?: number;
  /** Vertical distance between adjacent edge slots on the same node. */
  edgeSpacing?: number;
  /** Horizontal distance between adjacent lanes in the middle channel. */
  laneGap?: number;
  /** Minimum vertical distance between row baselines. */
  minRowGap?: number;
}

const DEFAULTS = {
  nodeRadius: 20,
  // Must clear the rendered amount pill's actual height (px-3.5 py-1.5 +
  // text-[15px] + border ≈ 32-34px) -- anything smaller and adjacent pills
  // on the same node visually overlap regardless of how "unique" their
  // y-slots are numerically.
  edgeSpacing: 40,
  laneGap: 40,
  minRowGap: 92,
} as const;

const LEFT_MARGIN = 24;
// Wide enough that the amount column clears a payer's own name label
// (rendered below its avatar, up to NODE_LABEL_WIDTH wide) even when that
// payer has multiple outgoing edges and its slot is offset toward the
// label -- a narrower gap here previously let a wide pill's left edge land
// on top of the payer's name text.
const AMOUNT_COLUMN_GAP = 44;
const AMOUNT_COLUMN_WIDTH = 80;
const PRE_LANE_GAP = 24;
const POST_LANE_GAP = 90;
const BOTTOM_PADDING = 24;

// Every payer's edges are offset around its own baseline by a signed
// multiple of `edgeSpacing`; every receiver's edges get the same treatment
// plus a fixed EPSILON shift. Node baselines are shared between the two
// columns (rule: aligned rows), so without this shift a payer and a
// receiver in the same row with matching degree/offset would land on the
// exact same y -- EPSILON is not a multiple of edgeSpacing/2, so no
// combination of (row difference) + (offset difference) can ever cancel
// it out. This is what keeps the payer-side and receiver-side y-slot sets
// disjoint for any input, not just the cases a test happens to cover.
const EPSILON_FACTOR = 1 / 3;

function firstAppearanceOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      order.push(id);
    }
  }
  return order;
}

/** Symmetric slot offsets for `count` items sharing one baseline, e.g. count=3 -> [-g, 0, g]. */
function symmetricOffsets(count: number, spacing: number): number[] {
  return Array.from({ length: count }, (_, k) => (k - (count - 1) / 2) * spacing);
}

function pushToBucket<K>(buckets: Map<K, number[]>, key: K, value: number): void {
  const bucket = buckets.get(key);
  if (bucket) {
    bucket.push(value);
  } else {
    buckets.set(key, [value]);
  }
}

// A flowing S-curve (cubic bezier, both control points pulled to the edge's
// own lane x) rather than a right-angle elbow -- reads as money moving
// smoothly between people instead of a circuit diagram, and matches the
// soft curves already used for this exact "who pays whom" moment on the
// landing page hero. Each edge still eases out of its payer and into its
// receiver at its own lane x, so distinct lanes stay visually distinct.
function curvePath(x0: number, y0: number, laneX: number, y1: number, x1: number): string {
  const dy = y1 - y0;
  if (Math.abs(dy) < 0.5) {
    return `M${x0},${y0} L${x1},${y1}`;
  }
  return `M${x0},${y0} C${laneX},${y0} ${laneX},${y1} ${x1},${y1}`;
}

/**
 * Lays out a settlement transfer graph arithmetically -- no DOM measurement.
 * Four invariants hold for any input:
 *  1. Payers and receivers share the same set of row baselines.
 *  2. Every edge's payer-side y and receiver-side y are each unique within
 *     their own side, and the two sides' y-slot sets are disjoint -- so no
 *     two horizontal runs are ever collinear.
 *  3. Every edge turns in its own vertical lane.
 *  4. Amount labels sit at the payer-side y in one right-aligned column.
 */
export function layoutTransferGraph(transfers: Transfer[], options: GraphLayoutOptions = {}): GraphLayout {
  const nodeRadius = options.nodeRadius ?? DEFAULTS.nodeRadius;
  const edgeSpacing = options.edgeSpacing ?? DEFAULTS.edgeSpacing;
  const laneGap = options.laneGap ?? DEFAULTS.laneGap;
  const minRowGap = options.minRowGap ?? DEFAULTS.minRowGap;

  const payerOrder = firstAppearanceOrder(transfers.map((t) => t.fromMemberId));
  const receiverOrder = firstAppearanceOrder(transfers.map((t) => t.toMemberId));
  const payerRow = new Map(payerOrder.map((id, i) => [id, i]));
  const receiverRow = new Map(receiverOrder.map((id, i) => [id, i]));

  const payerEdgeIndices = new Map<string, number[]>();
  const receiverEdgeIndices = new Map<string, number[]>();
  transfers.forEach((t, i) => {
    pushToBucket(payerEdgeIndices, t.fromMemberId, i);
    pushToBucket(receiverEdgeIndices, t.toMemberId, i);
  });

  const maxDegree = Math.max(
    1,
    ...[...payerEdgeIndices.values()].map((v) => v.length),
    ...[...receiverEdgeIndices.values()].map((v) => v.length),
  );

  // Guarantees a payer/receiver's own slot spread never reaches into the
  // next row's slots (rule 2's within-side uniqueness).
  const rowGap = Math.max(minRowGap, (maxDegree + 1) * edgeSpacing);
  const topPadding = Math.max(nodeRadius, (maxDegree * edgeSpacing) / 2) + 12;
  const epsilon = edgeSpacing * EPSILON_FACTOR;

  const numRows = Math.max(payerOrder.length, receiverOrder.length, 1);
  const baseline = (row: number) => topPadding + row * rowGap;

  const payerSlotY = new Map<number, number>();
  for (const [memberId, indices] of payerEdgeIndices) {
    const offsets = symmetricOffsets(indices.length, edgeSpacing);
    const base = baseline(payerRow.get(memberId)!);
    indices.forEach((transferIndex, k) => payerSlotY.set(transferIndex, base + offsets[k]));
  }

  const receiverSlotY = new Map<number, number>();
  for (const [memberId, indices] of receiverEdgeIndices) {
    const offsets = symmetricOffsets(indices.length, edgeSpacing);
    const base = baseline(receiverRow.get(memberId)!);
    indices.forEach((transferIndex, k) => receiverSlotY.set(transferIndex, base + offsets[k] + epsilon));
  }

  const leftX = LEFT_MARGIN + nodeRadius;
  const amountColumnLeft = leftX + nodeRadius + AMOUNT_COLUMN_GAP;
  const amountColumnRight = amountColumnLeft + AMOUNT_COLUMN_WIDTH;
  const laneStartX = amountColumnRight + PRE_LANE_GAP;
  const numEdges = transfers.length;
  const laneEndX = numEdges > 0 ? laneStartX + (numEdges - 1) * laneGap : laneStartX;
  const rightX = laneEndX + POST_LANE_GAP + nodeRadius;
  const width = rightX + nodeRadius + LEFT_MARGIN;
  const height = baseline(numRows - 1) + nodeRadius + BOTTOM_PADDING;

  const nodes: GraphNode[] = [
    ...payerOrder.map((memberId): GraphNode => ({
      memberId,
      side: "payer",
      cx: leftX,
      cy: baseline(payerRow.get(memberId)!),
    })),
    ...receiverOrder.map((memberId): GraphNode => ({
      memberId,
      side: "receiver",
      cx: rightX,
      cy: baseline(receiverRow.get(memberId)!),
    })),
  ];

  const edges: GraphEdge[] = transfers.map((_, transferIndex) => {
    const y0 = payerSlotY.get(transferIndex)!;
    const y1 = receiverSlotY.get(transferIndex)!;
    const laneX = laneStartX + transferIndex * laneGap;
    return {
      transferIndex,
      path: curvePath(leftX + nodeRadius, y0, laneX, y1, rightX - nodeRadius),
      amountX: amountColumnRight,
      amountY: y0,
    };
  });

  return { width, height, nodes, edges };
}

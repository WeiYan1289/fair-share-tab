import { describe, expect, it } from "vitest";
import { layoutTransferGraph } from "./graph-layout";
import type { Transfer } from "./types";

const MIN_LABEL_GAP = 36; // an amount pill (px-3.5 py-1.5, text-[15px], border) needs roughly this much vertical room

function payerAndReceiverSlotYs(transfers: Transfer[]) {
  const layout = layoutTransferGraph(transfers);
  // The layout only exposes the receiver-side y implicitly via the path's
  // final V/L endpoint; reconstruct both sides from edge.amountY (payer
  // side, by contract) and by parsing the path's last coordinate pair
  // (receiver side) so the invariants can be checked without depending on
  // SVG-path internals in the assertions themselves.
  const payerYs = layout.edges.map((e) => e.amountY);
  const receiverYs = layout.edges.map((e) => {
    // The path ends in `... postCornerX,y1 H x1` (or, for a same-row edge,
    // `M x0,y0 L x1,y1`) -- either way the last "x,y" pair carries y1.
    const pairs = [...e.path.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)];
    if (pairs.length === 0) throw new Error(`unparseable path: ${e.path}`);
    return Number(pairs[pairs.length - 1][2]);
  });
  return { layout, payerYs, receiverYs };
}

function assertAllDistinct(values: number[], minGap = 0) {
  const sorted = [...values].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(minGap);
  }
}

describe("layoutTransferGraph", () => {
  it("lays out a single transfer without error", () => {
    const transfers: Transfer[] = [{ fromMemberId: "a", toMemberId: "b", amount: 100 }];
    const { layout, payerYs, receiverYs } = payerAndReceiverSlotYs(transfers);

    expect(layout.nodes).toHaveLength(2);
    expect(layout.edges).toHaveLength(1);
    expect(payerYs[0]).not.toBe(receiverYs[0]);
  });

  it("keeps payer-side and receiver-side y-slots disjoint even on a crossing pair", () => {
    // A pays X, B pays Y, but drawn with B/Y's row above A/X's -- the case
    // that defeats naive "connect same-index rows" routing, since the two
    // edges must cross without their slots or lanes colliding.
    const transfers: Transfer[] = [
      { fromMemberId: "b", toMemberId: "y", amount: 50 },
      { fromMemberId: "a", toMemberId: "x", amount: 75 },
      { fromMemberId: "a", toMemberId: "y", amount: 10 },
      { fromMemberId: "b", toMemberId: "x", amount: 5 },
    ];
    const { layout, payerYs, receiverYs } = payerAndReceiverSlotYs(transfers);

    expect(layout.nodes.filter((n) => n.side === "payer")).toHaveLength(2);
    expect(layout.nodes.filter((n) => n.side === "receiver")).toHaveLength(2);

    assertAllDistinct(payerYs, MIN_LABEL_GAP);
    assertAllDistinct(receiverYs, MIN_LABEL_GAP);

    const payerSet = new Set(payerYs);
    for (const y of receiverYs) {
      expect(payerSet.has(y)).toBe(false);
    }
  });

  it("gives a payer with four outgoing edges four distinct, evenly spaced slots", () => {
    const transfers: Transfer[] = [
      { fromMemberId: "hub", toMemberId: "w", amount: 1 },
      { fromMemberId: "hub", toMemberId: "x", amount: 2 },
      { fromMemberId: "hub", toMemberId: "y", amount: 3 },
      { fromMemberId: "hub", toMemberId: "z", amount: 4 },
    ];
    const { layout, payerYs, receiverYs } = payerAndReceiverSlotYs(transfers);

    expect(new Set(payerYs).size).toBe(4);
    assertAllDistinct(payerYs, MIN_LABEL_GAP);
    assertAllDistinct(receiverYs, MIN_LABEL_GAP);

    const hubNode = layout.nodes.find((n) => n.memberId === "hub");
    expect(hubNode).toBeDefined();
    // Symmetric around the node's own center.
    const meanY = payerYs.reduce((s, y) => s + y, 0) / payerYs.length;
    expect(meanY).toBeCloseTo(hubNode!.cy, 5);
  });

  it("holds all four invariants at 12 transfers", () => {
    const names = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"];
    const transfers: Transfer[] = names.map((from, i) => ({
      fromMemberId: from,
      toMemberId: names[(i + 5) % names.length],
      amount: (i + 1) * 10,
    }));
    const { layout, payerYs, receiverYs } = payerAndReceiverSlotYs(transfers);

    // Rule 3: every edge has its own lane (unique x at the curve's control point).
    const laneXs = layout.edges.map((e) => {
      const match = e.path.match(/C(-?\d+(?:\.\d+)?),/);
      if (!match) throw new Error(`unparseable path: ${e.path}`);
      return Number(match[1]);
    });
    expect(new Set(laneXs).size).toBe(laneXs.length);

    // Rule 2: unique within each side, and disjoint across sides.
    assertAllDistinct(payerYs, MIN_LABEL_GAP);
    assertAllDistinct(receiverYs, MIN_LABEL_GAP);
    const payerSet = new Set(payerYs);
    for (const y of receiverYs) expect(payerSet.has(y)).toBe(false);

    // Rule 1: node baselines are shared between the two columns.
    const payerBaselines = new Set(layout.nodes.filter((n) => n.side === "payer").map((n) => n.cy));
    const receiverBaselines = new Set(layout.nodes.filter((n) => n.side === "receiver").map((n) => n.cy));
    for (const y of receiverBaselines) expect(payerBaselines.has(y)).toBe(true);
  });

  it("is a pure function of its input -- same transfers, same layout", () => {
    const transfers: Transfer[] = [
      { fromMemberId: "a", toMemberId: "b", amount: 100 },
      { fromMemberId: "c", toMemberId: "b", amount: 50 },
    ];
    expect(layoutTransferGraph(transfers)).toEqual(layoutTransferGraph(transfers));
  });
});

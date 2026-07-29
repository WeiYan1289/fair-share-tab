"use client";

import { useEffect, useState } from "react";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { formatMoney } from "@/lib/format";
import { layoutTransferGraph } from "@/lib/settlement/graph-layout";
import type { SettleMember, Transfer } from "./SettleUpFlow";

interface TransferGraphProps {
  transfers: Transfer[];
  members: SettleMember[];
  currency: string;
}

const NODE_RADIUS = 20;
// Past this the graph scrolls in its own box rather than pushing the
// confirm button off-screen -- SettleUpFlow defaults to the TransferList
// view well before a graph gets anywhere near needing this.
const MAX_GRAPH_HEIGHT = 420;

// Screen Spec P6-02/P6-04 -- "the signature moment": debtors on the left,
// creditors on the right, arrows connecting who pays whom. Desktop-only --
// the graph has no mobile shape of its own; TransferList is the mobile
// (and toggle-selected) view, not a scaled-down version of this one.
//
// All positions come from layoutTransferGraph, a pure function of
// `transfers` -- no DOM measurement, no resize listener, and no two amount
// pills can ever land on the same spot.
export function TransferGraph({ transfers, members, currency }: TransferGraphProps) {
  const memberById = new Map(members.map((m) => [m.id, m]));
  const layout = layoutTransferGraph(transfers, { nodeRadius: NODE_RADIUS });

  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setRevealed(true), 30);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="flex w-full justify-center overflow-auto" style={{ maxHeight: MAX_GRAPH_HEIGHT }}>
      <div className="shrink-0" style={{ width: layout.width }}>
        {/* A row in normal flow, not absolutely positioned over the graph --
            with only one row of nodes, layoutTransferGraph's topPadding is
            sized for node/lane spacing, not for a label sitting above it, so
            overlaying this at y=0 could collide with the first node. */}
        <div className="mb-2 flex items-center justify-between text-[10.5px] font-extrabold tracking-wide uppercase">
          <span className="text-coral">Debtors</span>
          <span className="text-emerald">Creditors</span>
        </div>

        <div className="relative" style={{ width: layout.width, height: layout.height }}>
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
            viewBox={`0 0 ${layout.width} ${layout.height}`}
          >
            <defs>
              <marker id="settle-arrowhead" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
                <path d="M0,0 L9,4.5 L0,9 Z" className="fill-ink/50 dark:fill-white/45" />
              </marker>
            </defs>
            {layout.edges.map((edge, i) => (
              <path
                key={edge.transferIndex}
                d={edge.path}
                fill="none"
                strokeWidth={2.5}
                markerEnd="url(#settle-arrowhead)"
                className="stroke-ink/20 dark:stroke-white/18"
                style={{
                  opacity: revealed ? 1 : 0,
                  transition: "opacity 400ms ease-out",
                  transitionDelay: `${i * 150}ms`,
                }}
              />
            ))}
          </svg>

          {layout.edges.map((edge, i) => (
            <div
              key={edge.transferIndex}
              className="num absolute z-10 rounded-full border border-ink/10 bg-white px-3.5 py-1.5 text-[15px] whitespace-nowrap text-ink shadow-[0_8px_18px_-8px_rgba(19,46,40,0.3)] dark:border-white/12 dark:bg-dark-card dark:text-dark-text"
              style={{
                left: edge.amountX,
                top: edge.amountY,
                transform: "translate(-100%, -50%)",
                opacity: revealed ? 1 : 0,
                transition: "opacity 400ms ease-out",
                transitionDelay: `${i * 150}ms`,
              }}
            >
              {formatMoney(transfers[edge.transferIndex].amount, currency)}
            </div>
          ))}

          {layout.nodes.map((node) => {
            const member = memberById.get(node.memberId);
            if (!member) return null;
            return (
              <div
                key={node.memberId}
                className="absolute flex flex-col items-center gap-1.5"
                style={{ left: node.cx, top: node.cy, width: 104, transform: "translate(-50%, -50%)" }}
              >
                <InitialsAvatar
                  name={member.name}
                  color={member.avatarColor}
                  size={NODE_RADIUS * 2}
                  className="text-[19px] shadow-[0_10px_22px_-8px_rgba(19,46,40,0.35)]"
                />
                <p
                  className="w-full truncate text-center text-[13px] font-bold text-ink dark:text-dark-text"
                  title={member.name}
                >
                  {member.name}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

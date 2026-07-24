"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { SettleMember, Transfer } from "./SettleUpFlow";

interface TransferGraphProps {
  transfers: Transfer[];
  members: SettleMember[];
  viewerMemberId: string | null;
}

interface Point {
  x: number;
  y: number;
}

const NODE_SIZE = 56;
const ROW_HEIGHT = 92;

// Screen Spec P6-02/P6-04 -- "the signature moment": debtors on the left,
// creditors on the right, arrows connecting who pays whom. Node-and-arrow
// graph on sm+ (desktop mockup), a simpler stacked transfer-card list below
// that (mobile mockup) -- these aren't just two sizes of the same layout in
// the designs, they're different shapes, so both are implemented rather
// than one being a scaled-down version of the other.
export function TransferGraph({ transfers, members, viewerMemberId }: TransferGraphProps) {
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const debtorIds = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const t of transfers) {
      if (!seen.has(t.fromMemberId)) {
        seen.add(t.fromMemberId);
        order.push(t.fromMemberId);
      }
    }
    return order;
  }, [transfers]);

  const creditorIds = useMemo(() => {
    const seen = new Set<string>();
    const order: string[] = [];
    for (const t of transfers) {
      if (!seen.has(t.toMemberId)) {
        seen.add(t.toMemberId);
        order.push(t.toMemberId);
      }
    }
    return order;
  }, [transfers]);

  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [positions, setPositions] = useState<Record<string, Point>>({});
  const [revealed, setRevealed] = useState(false);

  useLayoutEffect(() => {
    function measure() {
      const container = containerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const next: Record<string, Point> = {};
      for (const [id, el] of nodeRefs.current) {
        const rect = el.getBoundingClientRect();
        next[id] = {
          x: rect.left - containerRect.left + rect.width / 2,
          y: rect.top - containerRect.top + rect.height / 2,
        };
      }
      setPositions(next);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [debtorIds, creditorIds]);

  useEffect(() => {
    const id = setTimeout(() => setRevealed(true), 30);
    return () => clearTimeout(id);
  }, []);

  const height = Math.max(debtorIds.length, creditorIds.length, 1) * ROW_HEIGHT + 20;

  return (
    <>
      <div
        ref={containerRef}
        className="relative hidden w-full sm:block"
        style={{ height }}
      >
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <marker
              id="settle-arrowhead"
              markerWidth="9"
              markerHeight="9"
              refX="7"
              refY="4.5"
              orient="auto"
            >
              <path d="M0,0 L9,4.5 L0,9 Z" className="fill-ink/50 dark:fill-white/45" />
            </marker>
          </defs>
          {transfers.map((t, i) => {
            const from = positions[t.fromMemberId];
            const to = positions[t.toMemberId];
            if (!from || !to) return null;
            const midX = (from.x + to.x) / 2;
            const controlY = Math.min(from.y, to.y) - 40;
            return (
              <path
                key={i}
                d={`M${from.x},${from.y} Q${midX},${controlY} ${to.x},${to.y}`}
                fill="none"
                strokeWidth={2.5}
                markerEnd="url(#settle-arrowhead)"
                className="stroke-ink/20 dark:stroke-white/18"
                style={{
                  opacity: revealed ? 1 : 0,
                  transition: `opacity 400ms ease-out`,
                  transitionDelay: `${i * 150}ms`,
                }}
              />
            );
          })}
        </svg>

        {transfers.map((t, i) => {
          const from = positions[t.fromMemberId];
          const to = positions[t.toMemberId];
          if (!from || !to) return null;
          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2 - 20;
          return (
            <div
              key={i}
              className="num absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-ink/10 bg-white px-3.5 py-1.5 text-[15px] text-ink shadow-[0_8px_18px_-8px_rgba(19,46,40,0.3)] dark:border-white/12 dark:bg-dark-card dark:text-[#F2F6F3]"
              style={{
                left: midX,
                top: midY,
                opacity: revealed ? 1 : 0,
                transition: `opacity 400ms ease-out`,
                transitionDelay: `${i * 150}ms`,
              }}
            >
              {formatMoney(t.amount)}
            </div>
          );
        })}

        <div className="absolute top-0 left-0 text-[10.5px] font-extrabold tracking-wide text-coral uppercase">
          Debtors
        </div>
        <div className="absolute top-0 right-0 text-[10.5px] font-extrabold tracking-wide text-emerald uppercase">
          Creditors
        </div>

        <div className="absolute top-6 left-0 flex flex-col items-center gap-8">
          {debtorIds.map((id) => (
            <GraphNode
              key={id}
              member={memberById.get(id)}
              isYou={id === viewerMemberId}
              setRef={(el) => {
                if (el) nodeRefs.current.set(id, el);
              }}
            />
          ))}
        </div>
        <div className="absolute top-6 right-0 flex flex-col items-center gap-8">
          {creditorIds.map((id) => (
            <GraphNode
              key={id}
              member={memberById.get(id)}
              isYou={id === viewerMemberId}
              setRef={(el) => {
                if (el) nodeRefs.current.set(id, el);
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex w-full flex-col gap-3 sm:hidden">
        {transfers.map((t, i) => {
          const from = memberById.get(t.fromMemberId);
          const to = memberById.get(t.toMemberId);
          return (
            <div key={i} className="rounded-lg border border-ink/8 bg-white p-3.5">
              <div className="flex items-center justify-between">
                <TransferEndpoint member={from} isYou={t.fromMemberId === viewerMemberId} />
                <div className="flex flex-1 flex-col items-center gap-1 px-1">
                  <span className="num rounded-full border border-ink/10 bg-white px-2.5 py-1 text-[13px] text-ink">
                    {formatMoney(t.amount)}
                  </span>
                  <div className="h-0.5 w-full bg-ink/18" />
                </div>
                <TransferEndpoint member={to} isYou={t.toMemberId === viewerMemberId} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function GraphNode({
  member,
  isYou,
  setRef,
}: {
  member: SettleMember | undefined;
  isYou: boolean;
  setRef: (el: HTMLDivElement | null) => void;
}) {
  if (!member) return null;
  return (
    <div ref={setRef} className="flex flex-col items-center gap-1.5" style={{ width: 130 }}>
      <InitialsAvatar
        name={member.name}
        color={member.avatarColor}
        size={NODE_SIZE}
        className={cn(
          "text-[19px] shadow-[0_10px_22px_-8px_rgba(19,46,40,0.35)]",
          isYou && "ring-4 ring-[#E4F9EE] dark:ring-mint/18",
        )}
      />
      <p className="text-center text-[13px] font-bold text-ink dark:text-[#F2F6F3]">
        {member.name}
        {isYou && (
          <>
            <br />
            <span className="rounded-full bg-[#E4F9EE] px-[7px] py-px text-[9.5px] font-extrabold text-emerald dark:bg-mint/16 dark:text-mint">
              you
            </span>
          </>
        )}
      </p>
    </div>
  );
}

function TransferEndpoint({ member, isYou }: { member: SettleMember | undefined; isYou: boolean }) {
  if (!member) return null;
  return (
    <div className="flex w-[66px] flex-col items-center gap-1.5">
      <InitialsAvatar
        name={member.name}
        color={member.avatarColor}
        size={34}
        className={cn(isYou && "ring-2 ring-mint")}
      />
      <p className="text-center text-[10.5px] font-bold text-ink">{member.name}</p>
      {isYou && (
        <span className="rounded-full bg-[#E4F9EE] px-[5px] py-px text-[8px] font-extrabold text-emerald">
          you
        </span>
      )}
    </div>
  );
}

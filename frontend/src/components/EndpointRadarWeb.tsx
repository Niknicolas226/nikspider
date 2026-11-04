import React, { useState } from 'react';

export interface DiscoveredEndpointNode {
  url: string;
  status: 'clean' | 'flagged';
  depth: number;
}

interface EndpointRadarWebProps {
  endpoints: DiscoveredEndpointNode[];
  scanRunning: boolean;
}

function hashUrlToPolar(url: string, idx: number): { angleDeg: number; ringIndex: number } {
  let h = 2166136261;
  for (let i = 0; i < url.length; i++) {
    h ^= url.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const unsigned = h >>> 0;
  const angleDeg = (unsigned % 360 + idx * 37) % 360;
  const ringIndex = unsigned % 3; // 0 = inner, 1 = middle, 2 = outer
  return { angleDeg, ringIndex };
}

export const EndpointRadarWeb: React.FC<EndpointRadarWebProps> = ({
  endpoints,
  scanRunning,
}) => {
  const [hoveredNode, setHoveredNode] = useState<DiscoveredEndpointNode | null>(null);

  const ringRadii = [44, 68, 92];
  const visibleNodes = endpoints.slice(0, 36);

  return (
    <div
      className="relative rounded-2xl border border-purple-500/35 bg-[#07030d]/90 backdrop-blur-xl p-4 flex flex-col items-center justify-center h-full min-h-[250px] overflow-hidden"
      style={{
        boxShadow: '0 0 28px rgba(168, 85, 247, 0.14), inset 0 1px 0 rgba(192, 132, 252, 0.12)',
      }}
    >
      {/* Background radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(168, 85, 247, 0.24) 0%, rgba(7, 3, 13, 0) 70%)',
        }}
      />

      {/* Radar SVG */}
      <div className="relative w-52 h-52 flex items-center justify-center">
        <svg viewBox="0 0 220 220" className="w-full h-full overflow-visible">
          {/* Outer frame glow */}
          <circle
            cx="110"
            cy="110"
            r="98"
            fill="none"
            stroke="rgba(168, 85, 247, 0.35)"
            strokeWidth="2"
          />

          {/* Concentric Depth Rings */}
          {ringRadii.map((r, i) => (
            <circle
              key={r}
              cx="110"
              cy="110"
              r={r}
              fill="none"
              stroke={
                i === 2
                  ? 'rgba(192, 132, 252, 0.45)'
                  : 'rgba(168, 85, 247, 0.25)'
              }
              strokeWidth={i === 2 ? '1.5' : '1'}
              strokeDasharray={i === 1 ? '4 4' : undefined}
            />
          ))}

          {/* Spider-web Spokes */}
          {[0, 30, 60, 90, 120, 150].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            const x1 = 110 + Math.cos(rad) * 92;
            const y1 = 110 + Math.sin(rad) * 92;
            const x2 = 110 - Math.cos(rad) * 92;
            const y2 = 110 - Math.sin(rad) * 92;
            return (
              <line
                key={angle}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(168, 85, 247, 0.16)"
                strokeWidth="1"
              />
            );
          })}

          {/* Center Spider-Web Emblem */}
          <polygon
            points="110,82 130,90 138,110 130,130 110,138 90,130 82,110 90,90"
            fill="rgba(168, 85, 247, 0.12)"
            stroke="rgba(216, 180, 254, 0.65)"
            strokeWidth="1.2"
          />
          <polygon
            points="110,94 121,99 126,110 121,121 110,126 99,121 94,110 99,99"
            fill="none"
            stroke="rgba(216, 180, 254, 0.5)"
            strokeWidth="1"
          />

          {/* Sweeping radar line when scan is active */}
          {scanRunning && (
            <g className="origin-center animate-spin" style={{ transformOrigin: '110px 110px', animationDuration: '4s' }}>
              <line
                x1="110"
                y1="110"
                x2="110"
                y2="18"
                stroke="#c084fc"
                strokeWidth="2"
              />
            </g>
          )}

          {/* Real Discovered Endpoint Nodes */}
          {visibleNodes.map((ep, idx) => {
            const { angleDeg, ringIndex } = hashUrlToPolar(ep.url, idx);
            const r = ringRadii[Math.min(ep.depth || ringIndex, 2)];
            const rad = (angleDeg * Math.PI) / 180;
            const cx = 110 + Math.cos(rad) * r;
            const cy = 110 + Math.sin(rad) * r;
            const isFlagged = ep.status === 'flagged';

            return (
              <g
                key={ep.url}
                onMouseEnter={() => setHoveredNode(ep)}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer"
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={isFlagged ? 5.5 : 4}
                  fill={isFlagged ? '#ef4444' : '#c084fc'}
                  opacity={0.95}
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={isFlagged ? 9 : 7}
                  fill="none"
                  stroke={isFlagged ? 'rgba(239,68,68,0.55)' : 'rgba(192,132,252,0.45)'}
                  strokeWidth="1.5"
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Hover Tooltip or Live Node Counter */}
      <div className="mt-1 text-center font-mono text-[11px] min-h-[20px]">
        {hoveredNode ? (
          <div className="px-2.5 py-0.5 rounded-full bg-black/90 border border-purple-500/40 text-zinc-200 flex items-center gap-2 max-w-[230px] truncate">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                hoveredNode.status === 'flagged' ? 'bg-red-400' : 'bg-emerald-400'
              }`}
            />
            <span className="truncate">{hoveredNode.url}</span>
            <span
              className={`uppercase text-[9px] font-bold ${
                hoveredNode.status === 'flagged' ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              [{hoveredNode.status}]
            </span>
          </div>
        ) : (
          <span className="text-zinc-400">
            Web Surface Radar ·{' '}
            <strong className="text-purple-300">{endpoints.length}</strong> mapped nodes
          </span>
        )}
      </div>
    </div>
  );
};


import React, { useState } from 'react';
import { useScanStore } from '../store/scanStore';
import { StepNavFooter } from './StepNavFooter';
import { Globe, Layers, Search, ExternalLink, Copy, Check, Loader2, Sparkles } from 'lucide-react';

export const StepEndpointsView: React.FC = () => {
  const crawl = useScanStore((s) => s.crawl);
  const endpoints = useScanStore((s) => s.endpoints);
  const targetUrl = useScanStore((s) => s.targetUrl);
  const isRunning = useScanStore((s) => s.steps[2] === 'running');
  const isDone = useScanStore((s) => s.steps[2] === 'done');

  const [search, setSearch] = useState('');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Combine crawled URLs and discovered endpoints list
  const allUrls = Array.from(new Set([targetUrl, ...endpoints].filter(Boolean))) as string[];

  const filtered = allUrls.filter((u) => u.toLowerCase().includes(search.toLowerCase()));

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 1500);
  };

  return (
    <div className="space-y-6 text-left">
      {/* ═══════════════════════════════════════════════════════════════════
          HEADER & TELEMETRY
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="p-5 rounded-2xl bg-[#090514]/90 border border-purple-500/30 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-purple-600/30 border border-purple-400/40 text-purple-200 text-xs font-mono font-bold flex items-center justify-center">
              2
            </span>
            <h3 className="text-base font-bold text-white">
              SpiderEyes — Surface Mapping & Endpoints Report
            </h3>
            {isRunning && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono bg-purple-500/15 text-purple-300 border border-purple-400 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" /> Crawling Target...
              </span>
            )}
            {isDone && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-semibold">
                ✓ Crawl Complete
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Autonomous crawler maps links, HTML forms, API parameters, and SPA client routes.
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="px-3.5 py-2 rounded-xl bg-black/60 border border-purple-500/25">
            <span className="text-zinc-400">Pages Mapped:</span>{' '}
            <span className="text-white font-bold">{Math.max(crawl.pages, allUrls.length)}</span>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-black/60 border border-purple-500/25">
            <span className="text-zinc-400">Queue:</span>{' '}
            <span className="text-purple-300 font-bold">{crawl.queue}</span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SEARCH & ENDPOINT TABLE
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="p-5 rounded-2xl bg-black/80 border border-purple-500/25 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter discovered endpoints by path, route, or parameter..."
              className="w-full bg-black/70 border border-purple-500/30 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white placeholder-zinc-500 outline-none focus:border-purple-400"
            />
          </div>

          <span className="text-xs font-mono text-zinc-400">
            Showing {filtered.length} of {allUrls.length} routes
          </span>
        </div>

        <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
              {isRunning
                ? 'SpiderEyes is actively mapping pages... Endpoints will populate live.'
                : 'No endpoints discovered yet. Start scan on Step 1.'}
            </div>
          ) : (
            filtered.map((ep, idx) => {
              let path = ep;
              try {
                const parsed = new URL(ep);
                path = parsed.pathname + parsed.search;
              } catch {}

              return (
                <div
                  key={`${ep}-${idx}`}
                  className="p-3 rounded-xl bg-black/60 hover:bg-purple-950/20 border border-purple-500/20 flex items-center justify-between gap-3 text-xs font-mono transition"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="text-purple-400 font-bold">#{idx + 1}</span>
                    <Globe className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="text-white font-medium truncate">{path || '/'}</span>
                    <span className="text-zinc-500 text-[11px] truncate hidden md:inline">
                      ({ep})
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopy(ep)}
                      className="p-1.5 rounded bg-zinc-900 hover:bg-purple-950 text-zinc-300 hover:text-white transition cursor-pointer"
                      title="Copy URL"
                    >
                      {copiedUrl === ep ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-purple-950 text-purple-300 border border-purple-500/30">
                      In Scope
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Navigation */}
      <StepNavFooter currentStep={2} />
    </div>
  );
};


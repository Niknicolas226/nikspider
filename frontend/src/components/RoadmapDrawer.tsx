import React, { useEffect, useState } from 'react';
import { RoadmapNode } from '../types';
import { retestFindingDetailed, getNodePrompt } from '../api/client';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Loader2,
  RefreshCw,
  Sparkles,
  Terminal,
} from 'lucide-react';

interface RoadmapDrawerProps {
  node: RoadmapNode | null;
  onClose: () => void;
  onNodeFixed: (nodeId: string, findingId: string, newScore?: number) => void;
}

export const RoadmapDrawer: React.FC<RoadmapDrawerProps> = ({ node, onClose, onNodeFixed }) => {
  const [retesting, setRetesting] = useState(false);
  const [retestToast, setRetestToast] = useState<string | null>(null);
  const [retestSuccess, setRetestSuccess] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [fixPrompt, setFixPrompt] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  useEffect(() => {
    setRetesting(false);
    setRetestToast(null);
    setRetestSuccess(false);
    setFixPrompt(null);
  }, [node?.id]);

  if (!node) return null;

  const isFixed = node.status === 'fixed' || retestSuccess;

  const handleRetest = async () => {
    if (!node.finding_ids || node.finding_ids.length === 0) return;
    setRetesting(true);
    setRetestToast(null);
    setRetestSuccess(false);

    try {
      const primaryFindingId = node.finding_ids[0];
      const result = await retestFindingDetailed(primaryFindingId);

      if (result.passed) {
        setRetestSuccess(true);
        onNodeFixed(node.id, primaryFindingId, result.score);
      } else {
        setRetestToast(
          result.message ||
            'Still OPEN: Live probe re-execution reproduced the vulnerability signal on the target endpoint.'
        );
      }
    } catch (err: unknown) {
      setRetestToast(
        err instanceof Error
          ? `Still OPEN: ${err.message}`
          : 'Still OPEN: Retest probe encountered an error communicating with the target.'
      );
    } finally {
      setRetesting(false);
    }
  };

  const handleGeneratePrompt = async () => {
    setGeneratingPrompt(true);
    try {
      const prompt = await getNodePrompt(node.id);
      setFixPrompt(prompt);
    } catch (err: unknown) {
      setFixPrompt(
        err instanceof Error ? `Error: ${err.message}` : 'Failed to generate fix prompt.'
      );
    } finally {
      setGeneratingPrompt(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(node.code_example || '');
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyPrompt = () => {
    if (!fixPrompt) return;
    navigator.clipboard.writeText(fixPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-[#000000] border-l border-[#00d9ff]/40 shadow-[0_0_60px_rgba(0,0,0,0.95)] z-50 flex flex-col">
      {/* Top Header */}
      <div className="p-5 border-b border-white/10 flex items-start justify-between bg-[#0a0a0a]">
        <div className="space-y-1.5 pr-4">
          <div className="flex flex-wrap items-center gap-2 font-mono">
            <span
              className={`text-xs font-extrabold px-2.5 py-0.5 rounded uppercase ${
                isFixed
                  ? 'bg-emerald-500 text-black shadow-[0_0_16px_rgba(16,185,129,0.7)] animate-pulse'
                  : 'bg-red-500/20 text-red-300 border border-red-500/50'
              }`}
            >
              {isFixed ? 'FIXED' : `OPEN · ${node.severity}`}
            </span>
            <span className="text-xs text-[#a855f7] bg-[#a855f7]/15 px-2.5 py-0.5 rounded border border-[#a855f7]/40">
              {node.owasp}
            </span>
          </div>
          <h2 className="text-base font-extrabold text-white leading-tight">{node.issue}</h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable Content Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs text-zinc-300">
        {/* Retest Fixed Pulse Banner */}
        {isFixed && (
          <div className="p-3.5 bg-emerald-500/15 border border-emerald-400 rounded-xl flex items-center gap-3 text-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.3)] animate-pulse font-mono">
            <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-400" />
            <div>
              <div className="font-bold text-white">Node Flipped to FIXED ✓</div>
              <div className="text-[11px] text-emerald-300">
                1-click live probe re-execution confirmed the vulnerability is remediated.
              </div>
            </div>
          </div>
        )}

        {/* Toast explaining why node is still OPEN */}
        {retestToast && !isFixed && (
          <div className="p-3.5 bg-[#0a0a0a] border border-red-500 rounded-xl flex items-start justify-between gap-3 text-red-300 shadow-[0_0_24px_rgba(239,68,68,0.25)] font-mono">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <div>
                <div className="font-bold text-red-300">Node Remains OPEN</div>
                <p className="text-[11px] text-zinc-300 mt-0.5">{retestToast}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRetestToast(null)}
              className="text-zinc-500 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Root Cause */}
        <div className="space-y-1.5">
          <div className="text-[11px] uppercase font-mono font-bold text-[#00d9ff] tracking-wider">
            Root Cause
          </div>
          <p className="bg-[#0a0a0a] p-3.5 rounded-xl border border-white/10 leading-relaxed font-mono text-zinc-200">
            {node.root_cause}
          </p>
        </div>

        {/* Affected Endpoints */}
        <div className="space-y-1.5">
          <div className="text-[11px] uppercase font-mono font-bold text-zinc-400 tracking-wider">
            Affected Endpoints ({node.affects.length})
          </div>
          <div className="bg-[#0a0a0a] p-3 rounded-xl border border-white/10 space-y-1 font-mono">
            {node.affects.map((url, i) => (
              <div key={i} className="text-xs text-[#00d9ff] break-all select-all">
                {url}
              </div>
            ))}
          </div>
        </div>

        {/* Ordered Fix Steps */}
        <div className="space-y-1.5">
          <div className="text-[11px] uppercase font-mono font-bold text-zinc-400 tracking-wider">
            Ordered Fix Steps
          </div>
          <ol className="list-decimal list-inside bg-[#0a0a0a] p-3.5 rounded-xl border border-white/10 space-y-2 text-zinc-200 font-mono">
            {node.fix_steps.map((step, i) => (
              <li key={i} className="leading-relaxed">
                {step}
              </li>
            ))}
          </ol>
        </div>

        {/* Syntax-Highlighted Code Example */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between font-mono">
            <div className="text-[11px] uppercase font-bold text-[#00d9ff] tracking-wider flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-[#00d9ff]" />
              <span>Code Example</span>
            </div>
            <button
              type="button"
              onClick={copyCode}
              className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              {copiedCode ? <Check className="w-3 h-3 text-[#00d9ff]" /> : <Copy className="w-3 h-3" />}
              <span>{copiedCode ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre className="bg-[#0a0a0a] p-4 rounded-xl border border-[#00d9ff]/30 overflow-x-auto font-mono text-xs text-[#00d9ff] leading-relaxed select-all">
            {node.code_example}
          </pre>
        </div>

        {/* Generate Fix Prompt (POST /api/v2/nodes/{id}/prompt) */}
        <div className="pt-3 border-t border-white/10 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="font-bold text-white flex items-center gap-1.5 text-xs font-mono">
                <Sparkles className="w-3.5 h-3.5 text-[#a855f7]" />
                <span>AI Coding Assistant Fix Prompt</span>
              </div>
              <div className="text-[11px] text-zinc-400 font-mono">
                POST /api/v2/nodes/{node.id.slice(0, 8)}/prompt
              </div>
            </div>

            <button
              type="button"
              onClick={handleGeneratePrompt}
              disabled={generatingPrompt}
              className="px-3.5 py-2 bg-[#a855f7] hover:bg-[#a855f7]/90 disabled:opacity-50 text-white text-xs font-mono font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-[0_0_20px_rgba(168,85,247,0.35)]"
            >
              {generatingPrompt ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>Generate Fix Prompt</span>
            </button>
          </div>

          {fixPrompt && (
            <div className="relative">
              <pre className="w-full bg-[#0a0a0a] border border-[#a855f7]/40 rounded-xl p-4 pr-24 text-xs font-mono text-[#a855f7] overflow-x-auto whitespace-pre-wrap select-all max-h-52">
                {fixPrompt}
              </pre>
              <button
                type="button"
                onClick={copyPrompt}
                className="absolute top-3 right-3 px-2.5 py-1 bg-[#000000] hover:bg-white/10 text-white rounded-lg text-[11px] font-mono flex items-center gap-1 cursor-pointer border border-white/15"
              >
                {copiedPrompt ? (
                  <Check className="w-3 h-3 text-[#00d9ff]" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>{copiedPrompt ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Drawer Action Footer */}
      <div className="p-4 border-t border-white/10 bg-[#0a0a0a] flex items-center justify-between font-mono">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-[#000000] hover:bg-white/5 text-zinc-300 border border-white/15 text-xs rounded-xl transition cursor-pointer"
        >
          Close
        </button>

        <button
          type="button"
          onClick={handleRetest}
          disabled={retesting || isFixed}
          className={`px-5 py-2.5 text-xs font-extrabold rounded-xl transition flex items-center gap-2 cursor-pointer ${
            isFixed
              ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.5)] cursor-default'
              : 'bg-[#00d9ff] hover:bg-[#00d9ff]/90 text-black shadow-[0_0_22px_rgba(0,217,255,0.4)]'
          }`}
        >
          {retesting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Re-probing Endpoint...</span>
            </>
          ) : isFixed ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>FIXED ✓</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              <span>1-Click Retest</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default RoadmapDrawer;

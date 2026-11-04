import React, { useState } from 'react';
import { RoadmapNode } from '../../types';
import { generateAiFixPrompt } from '../../utils/roadmapUtils';
import {
  X,
  Copy,
  Check,
  Terminal,
  FileCode,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';

interface PromptBridgeProps {
  node: RoadmapNode | null;
  isOpen: boolean;
  onClose: () => void;
  evidenceSnippet?: string;
}

export const PromptBridge: React.FC<PromptBridgeProps> = ({
  node,
  isOpen,
  onClose,
  evidenceSnippet,
}) => {
  const [activeTab, setActiveTab] = useState<'claude' | 'cursor' | 'generic'>('claude');
  const [includeEvidence, setIncludeEvidence] = useState(true);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !node) return null;

  const generatedPrompt = generateAiFixPrompt(
    node,
    activeTab,
    includeEvidence,
    evidenceSnippet || `GET ${node.affects?.[0] || '/'} HTTP/1.1\nSignal: Anomaly identified.`
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl rounded-2xl bg-[#0b0617] border border-purple-500/40 shadow-[0_0_40px_rgba(168,85,247,0.35)] overflow-hidden flex flex-col max-h-[90vh] text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-purple-500/20 bg-purple-950/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-purple-600/40 border border-purple-400/50 text-purple-200">
              <Sparkles className="w-4 h-4 text-purple-300" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                <span>AI Fix Prompt Generator</span>
                <span className="text-[10px] text-purple-300 bg-purple-900/60 px-2 py-0.5 rounded border border-purple-500/30">
                  {node.severity}
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400 truncate max-w-md">{node.issue}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 bg-black/40 border-b border-zinc-800 text-xs font-mono">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('claude')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition cursor-pointer ${
                activeTab === 'claude'
                  ? 'bg-purple-600 text-white font-bold shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-purple-300" />
              <span>Claude Code</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('cursor')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition cursor-pointer ${
                activeTab === 'cursor'
                  ? 'bg-purple-600 text-white font-bold shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-cyan-300" />
              <span>Cursor (@file)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('generic')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition cursor-pointer ${
                activeTab === 'generic'
                  ? 'bg-purple-600 text-white font-bold shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span>Generic LLM</span>
            </button>
          </div>

          {/* Evidence Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer text-zinc-300 text-[11px]">
            <input
              type="checkbox"
              checked={includeEvidence}
              onChange={(e) => setIncludeEvidence(e.target.checked)}
              className="rounded bg-black border-zinc-700 text-purple-600 focus:ring-0 cursor-pointer"
            />
            <span>Include HTTP proof</span>
          </label>
        </div>

        {/* Prompt Viewport */}
        <div className="p-4 flex-1 overflow-y-auto">
          <pre className="p-3.5 rounded-xl bg-black/80 border border-zinc-800 text-xs font-mono text-zinc-200 leading-relaxed overflow-x-auto whitespace-pre-wrap break-all select-all">
            {generatedPrompt}
          </pre>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-purple-500/20 bg-purple-950/20 flex items-center justify-between text-xs font-mono">
          <span className="text-zinc-400 text-[11px]">
            Ready to paste into your IDE terminal or AI coding agent.
          </span>

          <button
            type="button"
            onClick={handleCopy}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center gap-2 transition cursor-pointer shadow-[0_0_16px_rgba(168,85,247,0.4)]"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy Prompt'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};


import React, { useState } from 'react';
import { EvidenceRecord } from '../../types';
import { HighlightEvidence } from '../HighlightEvidence';
import { X, ShieldCheck, Copy, Check, Terminal, FileCode2, Fingerprint } from 'lucide-react';

interface EvidenceModalProps {
  evidence: EvidenceRecord | null;
  loading?: boolean;
  onClose: () => void;
  initialTab?: 'both' | 'request' | 'response';
}

export const EvidenceModal: React.FC<EvidenceModalProps> = ({
  evidence,
  loading = false,
  onClose,
  initialTab = 'both',
}) => {
  const [activeTab, setActiveTab] = useState<'both' | 'request' | 'response'>(initialTab);
  const [copied, setCopied] = useState(false);

  if (!evidence && !loading) return null;

  const handleCopy = () => {
    if (!evidence) return;
    const content = `# Evidence ${evidence.evidence_id} (${evidence.endpoint})\n\n## Request\n${evidence.request}\n\n## Response\n${evidence.response}`;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-2xl bg-[#070b14] border border-cyan-500/40 shadow-[0_25px_90px_rgba(0,0,0,0.9),0_0_40px_rgba(34,211,238,0.18)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#0b1222] border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-300">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white font-mono">
                  Evidence Record: <span className="text-cyan-300">{evidence?.evidence_id || '...'}</span>
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 text-[#61f5ae] border border-emerald-500/30">
                  <ShieldCheck className="w-3 h-3" /> Grounded & Verified
                </span>
              </div>
              {evidence && (
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  {evidence.module.toUpperCase()} · {evidence.endpoint} · {evidence.owasp}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied Trace' : 'Copy Trace'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        {loading || !evidence ? (
          <div className="p-12 text-center font-mono text-xs text-cyan-300">
            Loading evidence blob from evidence_store...
          </div>
        ) : (
          <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            {/* Signal & SHA256 Metadata Banner */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-950/90 p-3.5 rounded-xl border border-slate-800 text-xs font-mono">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Deterministic Signal</span>
                <span className="text-amber-300 font-semibold">{evidence.signal}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">Evidence SHA-256 Digest</span>
                <span className="text-cyan-400/90 break-all text-[11px]">{evidence.sha256}</span>
              </div>
            </div>

            {/* View Selector Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs font-mono">
              {(['both', 'request', 'response'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg capitalize transition cursor-pointer ${
                    activeTab === tab
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                      : 'text-slate-400 hover:text-white bg-slate-900/50'
                  }`}
                >
                  {tab === 'both' ? 'Split Request & Response' : `Raw HTTP ${tab}`}
                </button>
              ))}
            </div>

            {/* Raw HTTP Request */}
            {(activeTab === 'both' || activeTab === 'request') && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span className="flex items-center gap-1.5 text-cyan-300 font-semibold">
                    <Terminal className="w-3.5 h-3.5" /> Raw HTTP Probe Request
                  </span>
                  <span className="text-[11px] text-slate-500">{evidence.ts}</span>
                </div>
                <pre className="p-4 rounded-xl bg-[#03060c] border border-cyan-500/25 font-mono text-xs text-cyan-200 overflow-x-auto whitespace-pre-wrap select-all leading-relaxed">
                  {evidence.request}
                </pre>
              </div>
            )}

            {/* Raw HTTP Response */}
            {(activeTab === 'both' || activeTab === 'response') && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span className="flex items-center gap-1.5 text-emerald-300 font-semibold">
                    <FileCode2 className="w-3.5 h-3.5" /> Raw Server Response Excerpt (Signal Highlighted)
                  </span>
                  <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Canary / Error Match
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-[#03060c] border border-slate-800 max-h-64 overflow-y-auto">
                  <HighlightEvidence text={evidence.response} signal={evidence.signal} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EvidenceModal;


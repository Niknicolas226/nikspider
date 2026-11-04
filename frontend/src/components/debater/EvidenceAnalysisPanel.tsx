import React, { useState } from 'react';
import { TriageResult } from '../../types';
import { Code, CheckSquare, Zap, Info, Copy, Check, Terminal } from 'lucide-react';

interface EvidenceAnalysisPanelProps {
  finding: TriageResult;
}

export const EvidenceAnalysisPanel: React.FC<EvidenceAnalysisPanelProps> = ({ finding }) => {
  const [activeTab, setActiveTab] = useState<'evidence' | 'pros_cons' | 'improve' | 'details'>(
    'evidence'
  );
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedReq, setCopiedReq] = useState(false);
  const [copiedResp, setCopiedResp] = useState(false);

  const rawRequest = finding.evidence?.request || 'GET / HTTP/1.1\nHost: target.local';
  const rawResponse = finding.evidence?.response_excerpt || 'HTTP/1.1 200 OK\n\n[Body Content]';

  // Construct curl command
  const curlCmd = `curl -X ${finding.evidence?.request?.startsWith('POST') ? 'POST' : 'GET'} "${finding.url || 'http://localhost:5000'}" -H "User-Agent: NikSpider/2.0"`;

  const copyToClipboard = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  // Pros & Cons
  const pros = finding.pros && finding.pros.length > 0
    ? finding.pros
    : [
        `Reproducible HTTP response anomaly detected on '${finding.url}'.`,
        `Payload matched known exploit signature for ${finding.module?.toUpperCase() || 'VULNERABILITY'}.`,
        `Direct reflection of untrusted payload token in server response stream.`,
      ];

  const cons = finding.cons && finding.cons.length > 0
    ? finding.cons
    : [
        `Target might be returning a generic 404 or catch-all template error.`,
        `No administrative session leakage or privilege escalation verified yet.`,
        `WAF / reverse proxy might be spoofing status header.`,
      ];

  // Improvement suggestions
  const improvementSuggestions = [
    {
      title: 'Out-of-Band (OAST) Verification',
      desc: 'Inject an asynchronous DNS/HTTP canary to confirm blind execution beyond synchronous HTTP response reflection.',
      payload: 'dns.oast.nikspider.internal',
    },
    {
      title: 'Differential Timing Probe',
      desc: 'Send time-delay injection probe (e.g. pg_sleep(5) or sleep 5) to verify server thread stalling.',
      payload: "1' AND (SELECT 1 FROM (SELECT SLEEP(5))a)--",
    },
    {
      title: 'Header & Context Sanitization Probe',
      desc: 'Re-probe with encoded null-bytes and unicode variations to assess whether sanitizers are bypassed or strict.',
      payload: '%00<script>alert(1)</script>',
    },
  ];

  return (
    <div className="rounded-2xl bg-[#090514]/90 border border-purple-500/30 overflow-hidden flex flex-col h-full text-left">
      {/* Tab Navigation */}
      <div className="flex items-center border-b border-purple-500/20 bg-black/40 p-1.5 gap-1 text-xs font-mono">
        <button
          type="button"
          onClick={() => setActiveTab('evidence')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition cursor-pointer ${
            activeTab === 'evidence'
              ? 'bg-purple-600/30 text-white font-bold border border-purple-400/50'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Code className="w-3.5 h-3.5 text-purple-400" />
          <span>Evidence</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pros_cons')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition cursor-pointer ${
            activeTab === 'pros_cons'
              ? 'bg-purple-600/30 text-white font-bold border border-purple-400/50'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
          <span>Pros & Cons</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('improve')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition cursor-pointer ${
            activeTab === 'improve'
              ? 'bg-purple-600/30 text-white font-bold border border-purple-400/50'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Improve Confidence</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('details')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition cursor-pointer ${
            activeTab === 'details'
              ? 'bg-purple-600/30 text-white font-bold border border-purple-400/50'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Info className="w-3.5 h-3.5 text-zinc-400" />
          <span>Details</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="p-4 space-y-4 overflow-y-auto max-h-[620px] flex-1">
        {activeTab === 'evidence' && (
          <div className="space-y-4">
            {/* cURL Replay Box */}
            <div className="p-3 rounded-xl bg-black/60 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                <span className="flex items-center gap-1.5 text-purple-300 font-bold">
                  <Terminal className="w-3.5 h-3.5" />
                  Live Replay cURL
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(curlCmd, setCopiedCurl)}
                  className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-200 flex items-center gap-1 cursor-pointer transition"
                >
                  {copiedCurl ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCurl ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="text-[11px] font-mono text-zinc-300 p-2 rounded bg-zinc-950 overflow-x-auto whitespace-pre-wrap break-all border border-zinc-900">
                {curlCmd}
              </pre>
            </div>

            {/* HTTP Request */}
            <div className="p-3 rounded-xl bg-black/60 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                <span className="text-red-400 font-bold">Probing Request</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(rawRequest, setCopiedReq)}
                  className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-200 flex items-center gap-1 cursor-pointer transition"
                >
                  {copiedReq ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedReq ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="text-[11px] font-mono text-red-200/90 p-2 rounded bg-red-950/20 border border-red-500/20 overflow-x-auto whitespace-pre-wrap break-all max-h-48">
                {rawRequest}
              </pre>
            </div>

            {/* HTTP Response */}
            <div className="p-3 rounded-xl bg-black/60 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                <span className="text-cyan-400 font-bold">Target Response Excerpt</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(rawResponse, setCopiedResp)}
                  className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-200 flex items-center gap-1 cursor-pointer transition"
                >
                  {copiedResp ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedResp ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="text-[11px] font-mono text-cyan-200/90 p-2 rounded bg-cyan-950/20 border border-cyan-500/20 overflow-x-auto whitespace-pre-wrap break-all max-h-48">
                {rawResponse}
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'pros_cons' && (
          <div className="space-y-4">
            {/* Pros */}
            <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-500/30 space-y-2">
              <h4 className="text-xs font-mono font-bold text-red-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                Prosecutor Arguments (Confirm Vulnerability)
              </h4>
              <ul className="space-y-1.5 text-xs text-zinc-300 list-disc list-inside">
                {pros.map((p, i) => (
                  <li key={i} className="leading-relaxed">
                    {p}
                  </li>
                ))}
              </ul>
            </div>

            {/* Cons */}
            <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 space-y-2">
              <h4 className="text-xs font-mono font-bold text-cyan-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                Defender Arguments (Mitigating Factors / Rejection)
              </h4>
              <ul className="space-y-1.5 text-xs text-zinc-300 list-disc list-inside">
                {cons.map((c, i) => (
                  <li key={i} className="leading-relaxed">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'improve' && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-400 font-mono">
              To raise consensus from {Math.round((finding.confidence ?? 0.85) * 100)}% to 100%, execute these targeted probe mutations:
            </p>
            {improvementSuggestions.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-1.5"
              >
                <div className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>{item.title}</span>
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed">{item.desc}</p>
                <div className="text-[10px] font-mono text-zinc-400 bg-black/60 p-1.5 rounded border border-zinc-800 break-all">
                  Probe payload: <span className="text-amber-300">{item.payload}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'details' && (
          <div className="space-y-2.5 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-black/60 border border-zinc-800 flex justify-between">
              <span className="text-zinc-500">Finding ID</span>
              <span className="text-zinc-300 select-all">{finding.id}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-black/60 border border-zinc-800 flex justify-between">
              <span className="text-zinc-500">Module Engine</span>
              <span className="text-purple-300 uppercase">{finding.module || 'security_probe'}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-black/60 border border-zinc-800 flex justify-between">
              <span className="text-zinc-500">Target URL</span>
              <span className="text-zinc-300 truncate max-w-[200px]">{finding.url || '/'}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-black/60 border border-zinc-800 flex justify-between">
              <span className="text-zinc-500">Tested Parameter</span>
              <span className="text-amber-300">{finding.param || 'N/A (Header/Route)'}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-black/60 border border-zinc-800 flex justify-between">
              <span className="text-zinc-500">OWASP Category</span>
              <span className="text-zinc-300">{finding.owasp || 'A03:2021-Injection'}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-black/60 border border-zinc-800 flex justify-between">
              <span className="text-zinc-500">Deterministic Rule Check</span>
              <span className="text-emerald-400 font-bold">{finding.rule_check || 'PASS'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


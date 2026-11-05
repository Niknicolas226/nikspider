import React, { useState, useEffect } from 'react';
import { TriageResult, DebateTranscript } from '../../types';
import { getFindingDebate } from '../../api/client';
import { DebateMessage } from './DebateMessage';
import { Play, RotateCcw, Copy, Check, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

interface DebateThreadProps {
  finding: TriageResult;
}

export const DebateThread: React.FC<DebateThreadProps> = ({ finding }) => {
  const [transcript, setTranscript] = useState<DebateTranscript | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  // Replay animation state: visible step (0..N)
  const [replayStep, setReplayStep] = useState<number>(999);
  const [isReplaying, setIsReplaying] = useState(false);

  // Fetch full transcript when finding changes
  useEffect(() => {
    let active = true;
    setLoading(true);
    setReplayStep(999);
    setIsReplaying(false);

    getFindingDebate(finding.id)
      .then((data) => {
        if (active) {
          setTranscript(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setTranscript(null);
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [finding.id]);

  // Prosecutor text
  const prosecutorText =
    transcript?.prosecutor ||
    finding.agent_a ||
    (finding.verdict === 'confirmed'
      ? `The payload sent to parameter '${finding.param || 'input'}' provoked an unambiguous reflection and execution signature. This confirms vulnerability in unvalidated request parameters.`
      : '');

  // Defender text
  const defenderText =
    transcript?.defender ||
    finding.agent_b ||
    (finding.verdict === 'rejected'
      ? `The target responded with standard generic error markup without executing untrusted payload commands. Mitigations in the web application framework prevent actual execution.`
      : '');

  // Judge text
  const judgeText =
    transcript?.judge?.reason ||
    finding.reason ||
    'Consensus reached based on deterministic probe response signals.';

  // Rule override text
  const ruleCheck =
    transcript?.rule_check ||
    finding.rule_check ||
    (transcript?.enforcement_overrides && transcript.enforcement_overrides[0]);

  const hasRule = Boolean(ruleCheck && ruleCheck !== 'PASS' && ruleCheck !== 'NONE');

  const hasAnyTranscript = Boolean(prosecutorText || defenderText || transcript?.judge?.reason);

  // Messages sequence
  const messagesList = [
    prosecutorText && {
      persona: 'prosecutor' as const,
      speakerName: 'Agent A — The Prosecutor',
      roleSubtitle: 'Attacking Assumptions',
      content: prosecutorText,
      confidence: transcript?.judge?.confidence ?? finding.confidence ?? 0.85,
      evidenceQuote: finding.evidence_quote || finding.evidence?.signal,
    },
    defenderText && {
      persona: 'defender' as const,
      speakerName: 'Agent B — The Defender',
      roleSubtitle: 'Examining Mitigations & Context',
      content: defenderText,
      confidence: Math.max(0.2, 1 - (transcript?.judge?.confidence ?? finding.confidence ?? 0.85)),
      evidenceQuote: finding.evidence?.response_excerpt?.slice(0, 150),
    },
    hasRule && {
      persona: 'enforcer' as const,
      speakerName: 'Rule Engine Enforcer',
      roleSubtitle: 'Deterministic Policy Enforcement',
      content: `SAFETY RULE TRIGGERED: ${ruleCheck}. Overriding statistical LLM deliberation with zero-tolerance safety guarantee.`,
      isEnforcementRule: true,
    },
    judgeText && {
      persona: 'judge' as const,
      speakerName: 'The Judge — Consensus Model',
      roleSubtitle: 'Final Verdict Arbiter',
      content: `VERDICT: ${finding.verdict.toUpperCase()} (${finding.severity} Severity, ${Math.round(
        (transcript?.judge?.confidence ?? finding.confidence ?? 0.85) * 100
      )}% confidence). ${judgeText}`,
      confidence: transcript?.judge?.confidence ?? finding.confidence ?? 0.85,
    },
  ].filter(Boolean) as Array<{
    persona: 'prosecutor' | 'defender' | 'judge' | 'enforcer';
    speakerName: string;
    roleSubtitle: string;
    content: string;
    confidence?: number;
    evidenceQuote?: string;
    isEnforcementRule?: boolean;
  }>;

  // Handle replay animation
  const handleStartReplay = () => {
    setIsReplaying(true);
    setReplayStep(0);
  };

  useEffect(() => {
    if (!isReplaying) return;
    if (replayStep < messagesList.length - 1) {
      const timer = setTimeout(() => {
        setReplayStep((prev) => prev + 1);
      }, 1600);
      return () => clearTimeout(timer);
    } else {
      setIsReplaying(false);
    }
  }, [isReplaying, replayStep, messagesList.length]);

  const handleCopyTranscript = () => {
    const text = messagesList
      .map((m) => `[${m.speakerName}]\n${m.content}`)
      .join('\n\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Thread Controls Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 text-xs font-mono">
        <div className="flex items-center gap-2 text-zinc-300">
          <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
          <span className="font-bold text-white">Adversarial Debate Stream</span>
          <span className="text-[11px] text-zinc-400">
            ({messagesList.length} argument rounds)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {loading && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-900/30 text-purple-300 text-[10px] border border-purple-500/30">
              <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
              <span>Syncing transcript...</span>
            </div>
          )}

          {hasAnyTranscript && (
            <>
              <button
                type="button"
                onClick={handleStartReplay}
                disabled={isReplaying}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                title="Replay debate with animated typing"
              >
                {isReplaying ? (
                  <RotateCcw className="w-3.5 h-3.5 animate-spin text-purple-400" />
                ) : (
                  <Play className="w-3.5 h-3.5 text-purple-400" />
                )}
                <span>Replay Debate</span>
              </button>

              <button
                type="button"
                onClick={handleCopyTranscript}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
                title="Copy full debate transcript"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                )}
                <span>{copied ? 'Copied!' : 'Copy Transcript'}</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-white transition cursor-pointer"
            title={isExpanded ? 'Collapse debate thread' : 'Expand debate thread'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {loading && !hasAnyTranscript && (
        <div className="p-8 text-center text-xs font-mono text-purple-300 flex items-center justify-center gap-2 bg-purple-950/20 border border-purple-500/20 rounded-xl">
          <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
          <span>Synchronizing grounded debate transcripts from engine...</span>
        </div>
      )}

      {/* Messages list */}
      {isExpanded && (!loading || hasAnyTranscript) && (
        <div className="space-y-3">
          {!hasAnyTranscript ? (
            <div className="p-8 text-center text-xs font-mono text-zinc-500 border border-dashed border-zinc-800 rounded-xl bg-black/40">
              Transcript not available for this finding.
            </div>
          ) : (
            messagesList.slice(0, replayStep + 1).map((msg, idx) => (
              <DebateMessage
                key={idx}
                persona={msg.persona}
                speakerName={msg.speakerName}
                roleSubtitle={msg.roleSubtitle}
                content={msg.content}
                confidence={msg.confidence}
                evidenceQuote={msg.evidenceQuote}
                isEnforcementRule={msg.isEnforcementRule}
              />
            ))
          )}

          {isReplaying && replayStep < messagesList.length - 1 && (
            <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/30 flex items-center gap-2 text-xs font-mono text-purple-300 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              <span>Next agent deliberating next counter-argument...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


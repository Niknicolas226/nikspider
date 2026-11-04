import React from 'react';
import { FileSearch } from 'lucide-react';

interface EvidenceLinkProps {
  evidenceId: string;
  onSelect: (evidenceId: string) => void;
  label?: string;
}

export const EvidenceLink: React.FC<EvidenceLinkProps> = ({ evidenceId, onSelect, label }) => {
  return (
    <button
      type="button"
      onClick={() => onSelect(evidenceId)}
      className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(34,211,238,0.18)] transition cursor-pointer align-baseline"
      title={`Inspect verified evidence record ${evidenceId}`}
    >
      <FileSearch className="w-3 h-3 text-cyan-400 shrink-0" />
      <span>{label || `[evidence_id: ${evidenceId}]`}</span>
    </button>
  );
};

interface GroundedTextProps {
  text: string;
  defaultEvidenceId: string;
  onSelectEvidence: (evidenceId: string) => void;
}

/**
 * Parses text containing `[evidence_id: ev_xxxx]` tokens and renders each citation
 * as a clickable EvidenceLink chip.
 */
export const GroundedText: React.FC<GroundedTextProps> = ({
  text,
  defaultEvidenceId,
  onSelectEvidence,
}) => {
  const parts = text.split(/(\[evidence_id:\s*[a-zA-Z0-9_-]+\])/g);

  return (
    <span>
      {parts.map((part, i) => {
        const match = part.match(/^\[evidence_id:\s*([a-zA-Z0-9_-]+)\]$/);
        if (match) {
          const evId = match[1];
          return <EvidenceLink key={`${evId}-${i}`} evidenceId={evId} onSelect={onSelectEvidence} />;
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
      {!text.includes('[evidence_id:') && defaultEvidenceId && (
        <EvidenceLink evidenceId={defaultEvidenceId} onSelect={onSelectEvidence} />
      )}
    </span>
  );
};

export default EvidenceLink;


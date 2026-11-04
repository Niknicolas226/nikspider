import React from 'react';

interface HighlightEvidenceProps {
  text: string;
  signal: string;
}

/**
 * Safely renders untrusted text without dangerouslySetInnerHTML.
 * Extracts keywords or quoted tokens from the signal and renders them inside highlighted <span> elements.
 */
export const HighlightEvidence: React.FC<HighlightEvidenceProps> = ({ text, signal }) => {
  if (!text) return <span className="text-slate-500 italic">No response excerpt available.</span>;

  // Extract quoted tokens from signal like 'syntax error' or marker tag '<nspmarker id="z">'
  const quotesMatch = signal.match(/['"]([^'"]+)['"]/);
  const targetToken = quotesMatch ? quotesMatch[1] : null;

  if (!targetToken || !text.toLowerCase().includes(targetToken.toLowerCase())) {
    return <span className="font-mono text-xs text-slate-300 break-all">{text}</span>;
  }

  // Split string safely around the target token (case-insensitive)
  const escaped = targetToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return (
    <span className="font-mono text-xs text-slate-300 break-all">
      {parts.map((part, i) =>
        part.toLowerCase() === targetToken.toLowerCase() ? (
          <span
            key={i}
            className="bg-amber-500/25 text-amber-300 font-bold px-1 py-0.5 rounded border border-amber-500/40"
          >
            {part}
          </span>
        ) : (
          part
        )
      )}
    </span>
  );
};


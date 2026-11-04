/**
 * NikSpider Single Source of Truth Theme
 * Pure black (#000000) background, violet/purple neon accent (#a855f7, #c084fc for glow),
 * glassmorphic translucent dark panels with thin purple borders & soft outer glow.
 */

export const THEME = {
  colors: {
    bgPure: '#000000',
    bgSurface: '#07050f',
    bgGlass: 'rgba(11, 7, 22, 0.78)',
    bgElevated: '#0f0a1e',
    neonPurple: '#a855f7',
    neonVioletGlow: '#c084fc',
    neonBlue: '#00d9ff',
    borderPurple: 'rgba(168, 85, 247, 0.35)',
    borderPurpleBright: 'rgba(192, 132, 252, 0.65)',
    borderSubtle: 'rgba(168, 85, 247, 0.18)',
  },
  glow: {
    purple: '0 0 24px rgba(168, 85, 247, 0.25)',
    purpleStrong: '0 0 36px rgba(192, 132, 252, 0.45)',
    red: '0 0 24px rgba(239, 68, 68, 0.35)',
    green: '0 0 24px rgba(16, 185, 129, 0.35)',
  },
  classes: {
    pageBg:
      'min-h-screen bg-[#000000] text-white antialiased selection:bg-[#a855f7]/30 selection:text-[#c084fc]',
    glassCard:
      'bg-[#080512]/80 backdrop-blur-xl border border-[#a855f7]/30 rounded-2xl shadow-[0_0_28px_rgba(168,85,247,0.10)]',
    glassCardBright:
      'bg-[#0a0617]/85 backdrop-blur-xl border border-[#c084fc]/50 rounded-2xl shadow-[0_0_32px_rgba(168,85,247,0.22)]',
    btnPurple:
      'bg-gradient-to-r from-[#a855f7] to-[#7e22ce] hover:from-[#c084fc] hover:to-[#9333ea] text-white font-bold rounded-xl transition shadow-[0_0_22px_rgba(168,85,247,0.45)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed',
    btnOutlinePurple:
      'bg-[#080512]/90 hover:bg-[#a855f7]/15 text-[#c084fc] border border-[#a855f7]/45 rounded-xl font-mono text-xs transition cursor-pointer',
    mono: 'font-mono tracking-tight',
  },
  profiles: [
    {
      id: 'safe' as const,
      label: 'Safe',
      budget: 'Max 100 reqs',
      moduleCount: 5,
      description: 'Passive headers, cookies, CORS, and zero-noise surface checks only.',
    },
    {
      id: 'standard' as const,
      label: 'Standard',
      budget: 'Max 500 reqs',
      moduleCount: 11,
      description: 'SPA-aware crawl plus non-destructive SQLi, XSS, Session, and Access probes.',
    },
    {
      id: 'aggressive' as const,
      label: 'Aggressive',
      budget: 'Max 2,000 reqs',
      moduleCount: 13,
      description: 'Deep surface discovery across all 13 modules with full differential confirmation replays.',
    },
  ],
} as const;

export type ScanProfileId = 'safe' | 'standard' | 'aggressive';

export const PROFILES: Record<
  ScanProfileId,
  { id: ScanProfileId; label: string; budget: string; moduleCount: number; description: string }
> = {
  safe: THEME.profiles[0],
  standard: THEME.profiles[1],
  aggressive: THEME.profiles[2],
};

export function getRiskBand(score: number): { label: string; color: string } {
  if (score >= 75) return { label: 'Critical', color: '#ef4444' };
  if (score >= 50) return { label: 'High', color: '#f59e0b' };
  if (score >= 25) return { label: 'Medium', color: '#a855f7' };
  return { label: 'Low', color: '#10b981' };
}

export interface StageDefinition {
  stage: number;
  code: string;
  name: string;
  shortName: string;
  description: string;
}

export const PIPELINE_STAGES: StageDefinition[] = [
  {
    stage: 0,
    code: 'STAGE 0',
    name: 'Intake & Guard',
    shortName: 'Guard',
    description: 'Ownership token proof, DNS rebinding lock & RFC1918 guard',
  },
  {
    stage: 1,
    code: 'STAGE 1',
    name: 'SpiderEyes Discovery',
    shortName: 'SpiderEyes',
    description: 'SPA-aware crawl, route extraction & parameter surface classification',
  },
  {
    stage: 2,
    code: 'STAGE 2',
    name: 'SpiderPois Safe Probes',
    shortName: 'SpiderPois',
    description: 'Policy-gated non-destructive probes & confirmation replay',
  },
  {
    stage: 3,
    code: 'STAGE 3',
    name: 'SpiderWeb Validation',
    shortName: 'SpiderWeb',
    description: 'Deterministic validators, deduplication & evidence store indexing',
  },
  {
    stage: 4,
    code: 'STAGE 4',
    name: 'Grounded Synthesis',
    shortName: 'Arguments',
    description: 'Structured reasoning grounded to evidence_quote',
  },
  {
    stage: 5,
    code: 'STAGE 5',
    name: 'Report & Roadmap',
    shortName: 'Report',
    description: 'Root-cause remediation DAG & report exports',
  },
  {
    stage: 6,
    code: 'STAGE 6',
    name: 'Close-the-Loop Retest',
    shortName: 'Retest',
    description: '1-click live probe re-execution to verify remediation',
  },
];

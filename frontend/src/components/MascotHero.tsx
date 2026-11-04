import React from 'react';
import mascotImage from '../assets/nikspider-mascot.png';
import './MascotHero.css';

const readout = [
  { text: '> nikspider scan ~', tone: 'success' },
  { text: '✓ Target: verified ✓', tone: 'success' },
  { text: '✓ Guard: scope locked ✓', tone: 'success' },
  { text: '✓ Crawling: 47/124 pages', tone: 'success' },
  { text: '✓ Surface map: 212 params classified', tone: 'success' },
  { text: '→ Running probe: sqli on /search?q=...', tone: 'normal' },
  { text: '⚠ Signal: SQLi boolean-diff (medium)', tone: 'warning' },
  { text: '✓ CONFIRMED: SQLi — /search?q= [HIGH]', tone: 'success' },
];

export const MascotHero: React.FC = () => (
  <div className="mascot-hero" role="img" aria-label="NikSpider cyberpunk spider robot with a live security scan terminal">
    <img className="mascot-hero-image" src={mascotImage} alt="" />
    <div className="mascot-terminal" aria-hidden="true">
      {readout.map((line) => (
        <div className={`mascot-terminal-line ${line.tone}`} key={line.text}>{line.text}</div>
      ))}
      <div className="mascot-terminal-line muted">
        ↳ debating severity... <span className="debate-dots"><i /><i /><i /></span>
      </div>
      <div className="mascot-terminal-line final-line">3 findings (1 high, 2 medium)</div>
      <div className="mascot-progress"><span /></div>
      <div className="mascot-terminal-line cursor-line">&gt; <i /></div>
    </div>
  </div>
);

export default MascotHero;

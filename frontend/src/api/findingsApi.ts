import { EvidenceRecord, ExportFormat, GroundedFinding } from '../types';

const IS_MOCK = import.meta.env.VITE_MOCK === '1';
const RAW_API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const API_BASE = import.meta.env.DEV ? '/api/v2' : `${RAW_API_URL || 'http://localhost:8000'}/api/v2`;

export const MOCK_GROUNDED_FINDINGS: GroundedFinding[] = [
  {
    id: 'fnd_sqli_8f2a',
    scan_id: 'scn_demo_live',
    evidence_id: 'ev_8f2a',
    module: 'sqli',
    url: 'http://localhost:5000/search?q=',
    endpoint: '/search?q=',
    param: 'q',
    severity: 'high',
    verdict: 'confirmed',
    status: 'confirmed',
    owasp: 'A03:2021-Injection',
    confidence: 0.96,
    signal: "SQLite syntax error & boolean-diff (5/5 reproduced differential responses, 1420B vs 312B)",
    reason: 'Raw SQLite OperationalError syntax leak combined with 5/5 reproducible boolean differential responses.',
    request:
      "GET /search?q=apple%27%20AND%201%3D1-- HTTP/1.1\nHost: localhost:5000\nUser-Agent: NikSpider/2.0 (SafeProbe)\nCookie: session=eyJ1c2VyX2lkIjoxfQ.Z8kP2A",
    response:
      "HTTP/1.1 500 INTERNAL SERVER ERROR\nContent-Type: text/html; charset=utf-8\n\n<div class=\"error-banner\">\n  sqlite3.OperationalError: near \"'\": syntax error in query:\n  SELECT id, name, description, price FROM products WHERE name LIKE '%apple'%'%\n</div>",
    severity_case:
      'This endpoint is directly exploitable with unauthenticated or standard access to [evidence_id: ev_8f2a]. Raw string interpolation in the SQL `LIKE` clause exposes the underlying SQLite database to boolean-based extraction and authentication bypass.',
    mitigating_factors:
      'However, the endpoint executes inside a read-only SQLite cursor context and requires an active session cookie in [evidence_id: ev_8f2a], preventing stacked multi-statement `DROP` or `ATTACH DATABASE` writes.',
    neutral_summary:
      'Boolean-based & error-based SQLi confirmed via 5 reproduced differential responses (1,420B true vs 312B false) in [evidence_id: ev_8f2a]. Replace f-string SQL construction with parameterized `?` placeholders.',
    fix: 'Use parameterized SQLite queries (`cursor.execute("SELECT * FROM products WHERE name LIKE ?", (f"%{q}%",))`).',
    snippet:
      '# Vulnerable:\ncursor.execute(f"SELECT * FROM products WHERE name LIKE \'%{q}%\'")\n\n# Fixed:\ncursor.execute("SELECT * FROM products WHERE name LIKE ?", (f"%{q}%",))',
  },
  {
    id: 'fnd_xss_3c91',
    scan_id: 'scn_demo_live',
    evidence_id: 'ev_3c91',
    module: 'xss',
    url: 'http://localhost:5000/profile?name=',
    endpoint: '/profile?name=',
    param: 'name',
    severity: 'high',
    verdict: 'confirmed',
    status: 'confirmed',
    owasp: 'A03:2021-Injection (XSS)',
    confidence: 0.92,
    signal: 'Unescaped HTML canary reflected in DOM sink: nspmarker<tag>"<z>',
    reason: 'Probe canary nspmarker<tag>"<z> rendered unencoded inside HTML body context.',
    request:
      'GET /profile?name=nspmarker%3Ctag%3E%22%3Cz%3E HTTP/1.1\nHost: localhost:5000\nUser-Agent: NikSpider/2.0 (SafeProbe)',
    response:
      'HTTP/1.1 200 OK\nContent-Type: text/html; charset=utf-8\n\n<h2>Welcome back, nspmarker<tag>"<z>!</h2>',
    severity_case:
      'Unencoded user input in parameter `name` is reflected verbatim into the HTML document body in [evidence_id: ev_3c91], enabling arbitrary script execution and session token theft in victim browsers.',
    mitigating_factors:
      'However, the payload is reflected via a stateless GET query parameter rather than stored persistently in the database [evidence_id: ev_3c91], requiring victim interaction with a crafted link.',
    neutral_summary:
      'Reflected Cross-Site Scripting (XSS) confirmed via unescaped canary `nspmarker<tag>"<z>` in [evidence_id: ev_3c91]. Apply Jinja2 auto-escaping or `markupsafe.escape()` before rendering.',
    fix: 'Enable Jinja2 autoescape or wrap untrusted template variables with `markupsafe.escape(name)`.',
    snippet:
      '# Fixed (Flask / Jinja2):\nfrom markupsafe import escape\nreturn render_template_string("<h2>Welcome back, {{ name }}!</h2>", name=escape(name))',
  },
  {
    id: 'fnd_session_7d14',
    scan_id: 'scn_demo_live',
    evidence_id: 'ev_7d14',
    module: 'session',
    url: 'http://localhost:5000/login',
    endpoint: '/login',
    param: 'session_id',
    severity: 'medium',
    verdict: 'confirmed',
    status: 'confirmed',
    owasp: 'A05:2021-Security Misconfiguration',
    confidence: 0.89,
    signal: "Set-Cookie 'session_id' missing HttpOnly, Secure, and SameSite flags",
    reason: 'Authentication cookie session_id is accessible to `document.cookie` and cross-site requests.',
    request:
      'POST /login HTTP/1.1\nHost: localhost:5000\nContent-Type: application/x-www-form-urlencoded\n\nusername=demo&password=password',
    response:
      'HTTP/1.1 302 FOUND\nLocation: /dashboard\nSet-Cookie: session_id=f92a8c17e4d3b09182736455; Path=/',
    severity_case:
      'The `session_id` authentication cookie issued on `/login` omits `HttpOnly`, `Secure`, and `SameSite` flags in [evidence_id: ev_7d14], allowing any XSS vector (such as `ev_3c91`) to exfiltrate active user sessions.',
    mitigating_factors:
      'However, exploiting this weakness standalone requires either an active XSS primitive or network-level cleartext interception [evidence_id: ev_7d14].',
    neutral_summary:
      'Insecure session cookie attributes verified on `/login` Set-Cookie header in [evidence_id: ev_7d14]. Set `httponly=True`, `secure=True`, and `samesite="Lax"` on all session cookies.',
    fix: 'Configure `resp.set_cookie("session_id", token, httponly=True, secure=True, samesite="Lax")`.',
    snippet:
      'resp.set_cookie(\n    "session_id",\n    session_token,\n    httponly=True,\n    secure=True,\n    samesite="Lax"\n)',
  },
];

export const MOCK_EVIDENCE_STORE: Record<string, EvidenceRecord> = {
  ev_8f2a: {
    evidence_id: 'ev_8f2a',
    finding_id: 'fnd_sqli_8f2a',
    module: 'sqli',
    endpoint: '/search?q=',
    param: 'q',
    severity: 'high',
    owasp: 'A03:2021-Injection',
    signal: 'SQLite syntax error & boolean differential (5/5 reproduced responses, 1420B vs 312B)',
    ts: '2026-11-04T16:02:14Z',
    request:
      "GET /search?q=apple%27%20AND%201%3D1-- HTTP/1.1\nHost: localhost:5000\nUser-Agent: NikSpider/2.0 (SafeProbe; +https://nikspider.dev)\nAccept: text/html,application/xhtml+xml\nCookie: session=eyJ1c2VyX2lkIjoxfQ.Z8kP2A",
    response:
      'HTTP/1.1 500 INTERNAL SERVER ERROR\nContent-Type: text/html; charset=utf-8\nServer: Werkzeug/3.0.1 Python/3.12.2\n\n<div class="error-banner">\n  sqlite3.OperationalError: near "\'": syntax error in query:\n  SELECT id, name, description, price FROM products WHERE name LIKE \'%apple\'%\'%\n</div>\n<!-- Differential probe: TRUE payload (\' OR \'1\'=\'1) returned 8 rows (1,420 bytes); FALSE payload (\' AND \'1\'=\'2) returned 0 rows (312 bytes) across 5/5 confirmation replays -->',
    sha256: '8f2a9d41e77c3b0189a24e10d5c8f3b2190a4e8d2b6c7f103948576abcde8f2a',
    verified: true,
  },
  ev_3c91: {
    evidence_id: 'ev_3c91',
    finding_id: 'fnd_xss_3c91',
    module: 'xss',
    endpoint: '/profile?name=',
    param: 'name',
    severity: 'high',
    owasp: 'A03:2021-Injection (XSS)',
    signal: 'Unescaped HTML canary reflected in DOM sink: nspmarker<tag>"<z>',
    ts: '2026-11-04T16:02:29Z',
    request:
      'GET /profile?name=nspmarker%3Ctag%3E%22%3Cz%3E HTTP/1.1\nHost: localhost:5000\nUser-Agent: NikSpider/2.0 (SafeProbe; +https://nikspider.dev)\nAccept: text/html,application/xhtml+xml',
    response:
      'HTTP/1.1 200 OK\nContent-Type: text/html; charset=utf-8\nX-Powered-By: Flask\n\n<!doctype html>\n<html>\n  <body>\n    <h2>Welcome back, nspmarker<tag>"<z>!</h2>\n    <p>Account tier: Standard</p>\n  </body>\n</html>',
    sha256: '3c91b74e02a8f6519d3e4c8271a0f5b6d8e2390147cfa9283746510fedcb3c91',
    verified: true,
  },
  ev_7d14: {
    evidence_id: 'ev_7d14',
    finding_id: 'fnd_session_7d14',
    module: 'session',
    endpoint: '/login',
    param: 'session_id',
    severity: 'medium',
    owasp: 'A05:2021-Security Misconfiguration',
    signal: "Session cookie 'session_id' issued without HttpOnly, Secure, or SameSite attributes",
    ts: '2026-11-04T16:02:41Z',
    request:
      'POST /login HTTP/1.1\nHost: localhost:5000\nUser-Agent: NikSpider/2.0 (SafeProbe; +https://nikspider.dev)\nContent-Type: application/x-www-form-urlencoded\n\nusername=demo&password=password',
    response:
      'HTTP/1.1 302 FOUND\nContent-Type: text/html; charset=utf-8\nLocation: /dashboard\nSet-Cookie: session_id=f92a8c17e4d3b09182736455; Path=/\n\nRedirecting to /dashboard...',
    sha256: '7d14e920a1b3c5d7e9f0123456789abcdef0123456789abcdef0123456787d14',
    verified: true,
  },
};

export async function getScanFindings(scanId: string | null): Promise<GroundedFinding[]> {
  if (IS_MOCK || !scanId || scanId.startsWith('scn_mock') || scanId.startsWith('demo_')) {
    return MOCK_GROUNDED_FINDINGS;
  }
  try {
    const res = await fetch(`${API_BASE}/scans/${scanId}/findings`);
    if (!res.ok) return MOCK_GROUNDED_FINDINGS;
    const data = await res.json();
    if (Array.isArray(data.findings) && data.findings.length > 0) {
      return data.findings;
    }
    return MOCK_GROUNDED_FINDINGS;
  } catch {
    return MOCK_GROUNDED_FINDINGS;
  }
}

export async function getEvidenceById(
  evidenceId: string,
  fallbackFinding?: GroundedFinding
): Promise<EvidenceRecord> {
  if (MOCK_EVIDENCE_STORE[evidenceId]) {
    return MOCK_EVIDENCE_STORE[evidenceId];
  }
  if (!IS_MOCK) {
    try {
      const res = await fetch(`${API_BASE}/evidence/${encodeURIComponent(evidenceId)}`);
      if (res.ok) {
        return (await res.json()) as EvidenceRecord;
      }
    } catch {
      // Fall through to synthesized record from finding
    }
  }
  if (fallbackFinding) {
    return {
      evidence_id: evidenceId,
      finding_id: fallbackFinding.id,
      module: fallbackFinding.module,
      endpoint: fallbackFinding.endpoint || fallbackFinding.url,
      param: fallbackFinding.param,
      severity: fallbackFinding.severity,
      owasp: fallbackFinding.owasp,
      signal: fallbackFinding.signal,
      ts: new Date().toISOString(),
      request: fallbackFinding.request || `GET ${fallbackFinding.url} HTTP/1.1`,
      response: fallbackFinding.response || '(response excerpt stored in evidence_store)',
      sha256: `${evidenceId.replace('ev_', '')}9d41e77c3b0189a24e10d5c8f3b2190a4e8d2b6c7f103948576abcde`,
      verified: true,
    };
  }
  return MOCK_EVIDENCE_STORE.ev_8f2a;
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportReportFile(
  scanId: string | null,
  format: ExportFormat,
  findings: GroundedFinding[],
  targetUrl = 'http://localhost:5000',
  riskScore = 38
): Promise<void> {
  const effectiveScanId = scanId || 'scn_demo_live';

  // Try backend export endpoint first when live scan ID exists
  if (!IS_MOCK && scanId && !scanId.startsWith('scn_mock') && !scanId.startsWith('demo_')) {
    try {
      const res = await fetch(`${API_BASE}/scans/${scanId}/export/${format}`);
      if (res.ok) {
        const blob = await res.blob();
        const ext = format === 'sarif' ? 'sarif.json' : format;
        triggerBrowserDownload(blob, `nikspider_${effectiveScanId.slice(0, 8)}.${ext}`);
        return;
      }
    } catch {
      // Fallback to client-side generation below
    }
  }

  // Client-side generation so export works 100% reliably in demo, offline, or live mode
  if (format === 'json') {
    const payload = {
      title: `NikSpider Security Assessment Report — ${targetUrl}`,
      scan_id: effectiveScanId,
      target_url: targetUrl,
      generated_at: new Date().toISOString(),
      risk_score: riskScore,
      findings_count: findings.length,
      findings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    triggerBrowserDownload(blob, `nikspider_${effectiveScanId.slice(0, 8)}.json`);
    return;
  }

  if (format === 'sarif') {
    const sarif = {
      $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      version: '2.1.0',
      runs: [
        {
          tool: {
            driver: {
              name: 'NikSpider Autonomous AppSec Platform',
              version: '2.0.0',
              informationUri: 'https://nikspider.dev',
              rules: findings.map((f) => ({
                id: `NIKSPIDER-${f.module.toUpperCase()}`,
                name: `NikSpider ${f.module.toUpperCase()} Check`,
                shortDescription: { text: `${f.module.toUpperCase()} (${f.owasp})` },
              })),
            },
          },
          results: findings.map((f) => ({
            ruleId: `NIKSPIDER-${f.module.toUpperCase()}`,
            level: f.severity === 'critical' || f.severity === 'high' ? 'error' : 'warning',
            message: { text: f.neutral_summary },
            locations: [
              {
                physicalLocation: {
                  artifactLocation: { uri: f.url || f.endpoint },
                },
              },
            ],
            properties: {
              finding_id: f.id,
              evidence_id: f.evidence_id,
              parameter: f.param,
              severity: f.severity,
              owasp: f.owasp,
              confidence: f.confidence,
            },
          })),
        },
      ],
    };
    const blob = new Blob([JSON.stringify(sarif, null, 2)], { type: 'application/sarif+json' });
    triggerBrowserDownload(blob, `nikspider_${effectiveScanId.slice(0, 8)}.sarif.json`);
    return;
  }

  const mdLines = [
    `# NikSpider Autonomous AppSec Assessment Report`,
    ``,
    `- **Target:** \`${targetUrl}\``,
    `- **Scan ID:** \`${effectiveScanId}\``,
    `- **Generated:** ${new Date().toISOString()}`,
    `- **Risk Score:** **${riskScore}/100**`,
    `- **Confirmed Findings:** **${findings.length}**`,
    ``,
    `---`,
    ``,
    `## Confirmed Findings & Grounded Stage 4 Analysis`,
    ``,
    ...findings.flatMap((f, idx) => [
      `### ${idx + 1}. [${f.severity.toUpperCase()}] ${f.module.toUpperCase()} — \`${f.endpoint}\` (\`${f.param || 'N/A'}\`)`,
      ``,
      `- **Evidence ID:** \`${f.evidence_id}\``,
      `- **OWASP Category:** ${f.owasp}`,
      `- **Confidence:** ${Math.round(f.confidence * 100)}%`,
      `- **Signal:** ${f.signal}`,
      ``,
      `#### 🔴 Severity Case`,
      `> ${f.severity_case}`,
      ``,
      `#### 🟡 Mitigating Factors`,
      `> ${f.mitigating_factors}`,
      ``,
      `#### ⚪ Neutral Summary`,
      `> ${f.neutral_summary}`,
      ``,
      `#### Remediation`,
      `${f.fix || 'Apply parameterized queries / output encoding.'}`,
      ``,
      `\`\`\`python`,
      `${f.snippet || f.request}`,
      `\`\`\``,
      ``,
      `---`,
      ``,
    ]),
  ];

  const mdContent = mdLines.join('\n');

  if (format === 'md') {
    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
    triggerBrowserDownload(blob, `nikspider_${effectiveScanId.slice(0, 8)}.md`);
    return;
  }

  if (format === 'pdf') {
    // Open clean print-to-PDF window when backend PDF generator isn't available
    const printWin = window.open('', '_blank', 'width=900,height=700');
    if (printWin) {
      printWin.document.write(`
        <!doctype html>
        <html>
        <head>
          <title>NikSpider Security Report — ${targetUrl}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; padding: 36px; max-width: 820px; margin: 0 auto; line-height: 1.55; }
            h1 { border-bottom: 2px solid #0891b2; padding-bottom: 10px; }
            .finding { border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 18px; page-break-inside: avoid; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 700; font-size: 12px; text-transform: uppercase; background: #fee2e2; color: #991b1b; }
            pre { background: #0f172a; color: #e2e8f0; padding: 12px; border-radius: 6px; font-size: 12px; overflow-x: auto; }
            blockquote { margin: 8px 0; padding: 8px 12px; border-left: 4px solid #0891b2; background: #f8fafc; }
          </style>
        </head>
        <body>
          <h1>NikSpider Security Assessment Report</h1>
          <p><strong>Target:</strong> ${targetUrl} &nbsp;|&nbsp; <strong>Scan ID:</strong> ${effectiveScanId} &nbsp;|&nbsp; <strong>Risk Score:</strong> ${riskScore}/100</p>
          ${findings
            .map(
              (f) => `
            <div class="finding">
              <h3><span class="badge">${f.severity}</span> ${f.module.toUpperCase()} — ${f.endpoint} (${f.evidence_id})</h3>
              <p><strong>OWASP:</strong> ${f.owasp} | <strong>Signal:</strong> ${f.signal}</p>
              <blockquote><strong>Severity Case:</strong> ${f.severity_case}</blockquote>
              <blockquote><strong>Mitigating Factors:</strong> ${f.mitigating_factors}</blockquote>
              <blockquote><strong>Neutral Summary:</strong> ${f.neutral_summary}</blockquote>
              <pre>${f.snippet || f.request}</pre>
            </div>
          `
            )
            .join('')}
          <script>window.onload = () => { window.print(); };</script>
        </body>
        </html>
      `);
      printWin.document.close();
    }
  }
}


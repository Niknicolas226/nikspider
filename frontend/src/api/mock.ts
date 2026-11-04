import { Target, RoadmapResponse, RequestLogEntry, SSEEvent } from '../types';

export const MOCK_TARGET: Target = {
  id: 'tgt_mock_demo_101',
  url: 'http://localhost:5000',
  token: 'nikspider-verify=mock_token_demo_987654321',
  verified: true,
};

export const MOCK_ROADMAP: RoadmapResponse = {
  score: 46,
  raw_count: 4,
  confirmed_count: 3,
  rejected_count: 1,
  nodes: [
    {
      id: 'node-sqli-01',
      issue: 'SQL Injection in Search Query Handler',
      severity: 'High',
      owasp: 'A03:2021-Injection',
      root_cause: 'Dynamic query string concatenation in database access layer without parameter binding.',
      affects: ['/search?q='],
      fix_steps: [
        'Replace raw SQL string interpolation with parameterized bindings.',
        'Validate and sanitize search input before executing queries.'
      ],
      code_example: `// Before:\nconst query = \`SELECT * FROM items WHERE name LIKE '%\${q}%'\`;\n\n// After (Parameterized):\ncursor.execute("SELECT * FROM items WHERE name LIKE ?", ('%' + q + '%',))`,
      verify: "Probe with single quote probe ' ; confirm no syntax error occurs.",
      resolves_count: 1,
      status: 'open',
      finding_ids: ['f_mock_sqli_1'],
    },
    {
      id: 'node-xss-01',
      issue: 'Reflected Cross-Site Scripting in User Profile',
      severity: 'Medium',
      owasp: 'A03:2021-Injection',
      root_cause: 'Dynamic user input reflected directly into HTML output context without contextual entity encoding.',
      affects: ['/profile?name='],
      fix_steps: [
        'Encode HTML entities before rendering into DOM responses.',
        'Configure a strict Content-Security-Policy (CSP).'
      ],
      code_example: `// Secure escaping in view template:\nfrom markupsafe import escape\nreturn f"<h1>User Profile: {escape(name)}</h1>"`,
      verify: "Send probe '<nspmarker id=\"z\">'; verify it reflects as '&lt;nspmarker id=&quot;z&quot;&gt;'.",
      resolves_count: 1,
      status: 'open',
      finding_ids: ['f_mock_xss_1'],
    },
    {
      id: 'node-session-01',
      issue: 'Missing HttpOnly & Secure Flags on Session Cookie',
      severity: 'Medium',
      owasp: 'A01:2021-Broken Access Control',
      root_cause: 'Authentication session cookie emitted without essential transport and script protection flags.',
      affects: ['/login'],
      fix_steps: [
        'Set HttpOnly flag to prevent client-side script access.',
        'Set Secure and SameSite=Lax flags on Set-Cookie.'
      ],
      code_example: `response.set_cookie('session_id', token, httponly=True, secure=True, samesite='Lax')`,
      verify: 'Inspect Set-Cookie header on /login response and verify flags are present.',
      resolves_count: 1,
      status: 'open',
      finding_ids: ['f_mock_session_1'],
    }
  ],
};

export const MOCK_REQUEST_LOGS: RequestLogEntry[] = [
  { id: 104, scan_id: 'scn_mock', ts: new Date().toISOString(), method: 'GET', url: 'http://localhost:5000/settings', status: 200 },
  { id: 103, scan_id: 'scn_mock', ts: new Date().toISOString(), method: 'GET', url: 'http://localhost:5000/search_safe?query=test', status: 200 },
  { id: 102, scan_id: 'scn_mock', ts: new Date().toISOString(), method: 'GET', url: 'http://localhost:5000/profile?name=Guest', status: 200 },
  { id: 101, scan_id: 'scn_mock', ts: new Date().toISOString(), method: 'GET', url: 'http://localhost:5000/search?q=Widget', status: 200 },
  { id: 100, scan_id: 'scn_mock', ts: new Date().toISOString(), method: 'GET', url: 'http://localhost:5000/', status: 200 },
];

export function runMockSSE(onEvent: (event: SSEEvent) => void): () => void {
  let timer1: ReturnType<typeof setTimeout>;
  let timer2: ReturnType<typeof setTimeout>;
  let timer3: ReturnType<typeof setTimeout>;
  let timer4: ReturnType<typeof setTimeout>;
  let timer5: ReturnType<typeof setTimeout>;
  let timer6: ReturnType<typeof setTimeout>;

  timer1 = setTimeout(() => {
    onEvent({ type: 'crawl_progress', pages: 5, queue: 0 });
    onEvent({
      type: 'plan_ready',
      plan: [
        { url: 'http://localhost:5000/search?q=Widget', checks: ['sqli'], why: 'Search parameter with direct database query' },
        { url: 'http://localhost:5000/profile?name=Guest', checks: ['xss'], why: 'Reflected user profile parameter' },
        { url: 'http://localhost:5000/login', checks: ['session'], why: 'Authentication endpoint issuing session cookies' },
        { url: 'http://localhost:5000/search_safe?query=Widget', checks: ['xss'], why: 'Decoy search endpoint' },
      ],
    });
  }, 600);

  timer2 = setTimeout(() => {
    onEvent({ type: 'raw_flag', id: 'f_mock_sqli_1', module: 'sqli', url: 'http://localhost:5000/search?q=' });
    onEvent({ type: 'raw_flag', id: 'f_mock_xss_1', module: 'xss', url: 'http://localhost:5000/profile?name=' });
    onEvent({ type: 'raw_flag', id: 'f_mock_session_1', module: 'session', url: 'http://localhost:5000/login' });
    onEvent({ type: 'raw_flag', id: 'f_mock_decoy_1', module: 'xss', url: 'http://localhost:5000/search_safe?query=' });
  }, 1400);

  timer3 = setTimeout(() => {
    // Finding 1: Confirmed SQLi
    onEvent({
      type: 'triage_result',
      id: 'f_mock_sqli_1',
      verdict: 'confirmed',
      severity: 'High',
      owasp: 'A03:2021-Injection',
      confidence: 0.96,
      reason: 'SQL syntax error explicitly verified in response under single-quote probe.',
      agent_a: 'Single quote causes unhandled OperationalError syntax error leaking query structure. Unsanitized input reaches database execution.',
      agent_b: 'Could be custom error page, but response reveals raw sqlite3 syntax error token.',
      evidence: {
        request: "GET /search?q=test'",
        response_excerpt: 'Database OperationalError: syntax error: near line 1',
        signal: "SQL error pattern: 'syntax error'",
      },
    });
  }, 2200);

  timer4 = setTimeout(() => {
    // Finding 2: Confirmed XSS
    onEvent({
      type: 'triage_result',
      id: 'f_mock_xss_1',
      verdict: 'confirmed',
      severity: 'Medium',
      owasp: 'A03:2021-Injection',
      confidence: 0.94,
      reason: 'Unescaped HTML marker tag directly rendered in HTML body.',
      agent_a: 'Input reflects verbatim without entity encoding, allowing arbitrary tag and script injection.',
      agent_b: 'Response lacks user cookies in immediate body, but DOM execution context is completely unconfined.',
      evidence: {
        request: 'GET /profile?name=nsp"<nspmarker id="z">',
        response_excerpt: '<h1>User Profile: nsp"<nspmarker id="z"></h1>',
        signal: 'Unescaped HTML marker tag reflected: \'<nspmarker id="z">\'',
      },
    });

    // Finding 3: Confirmed Session
    onEvent({
      type: 'triage_result',
      id: 'f_mock_session_1',
      verdict: 'confirmed',
      severity: 'Medium',
      owasp: 'A01:2021-Broken Access Control',
      confidence: 0.91,
      reason: 'Session cookie session_id lacks HttpOnly and Secure flags.',
      agent_a: 'JavaScript on the origin can steal active session identifiers via document.cookie, enabling session hijacking.',
      agent_b: 'Local network testing only, but flags are missing at protocol level.',
      evidence: {
        request: 'GET /login',
        response_excerpt: 'Set-Cookie: session_id=demo_session_secret_token_xyz',
        signal: "Session cookie 'session_id' missing security flags: HttpOnly, Secure, SameSite",
      },
    });
  }, 3000);

  timer5 = setTimeout(() => {
    // Finding 4: REJECTED False Positive Decoy
    onEvent({
      type: 'triage_result',
      id: 'f_mock_decoy_1',
      verdict: 'rejected',
      severity: 'Low',
      owasp: 'A03:2021-Injection',
      confidence: 0.98,
      reason: 'Output is properly entity-encoded with &lt; and &gt;. Harmless decoy reflection.',
      agent_a: 'The query string appears in the response body.',
      agent_b: 'The characters < and > are safely encoded as &lt; and &gt;, rendering execution impossible. Definitive false positive.',
      evidence: {
        request: 'GET /search_safe?query=nsp"<nspmarker id="z">',
        response_excerpt: '<p>Results for: nsp&quot;&lt;nspmarker id=&quot;z&quot;&gt;</p>',
        signal: 'Encoded reflection detected - no raw tag execution possible',
      },
    });
  }, 3800);

  timer6 = setTimeout(() => {
    onEvent({
      type: 'roadmap_ready',
      nodes: 3,
      score: 46,
    });
  }, 4400);

  return () => {
    clearTimeout(timer1);
    clearTimeout(timer2);
    clearTimeout(timer3);
    clearTimeout(timer4);
    clearTimeout(timer5);
    clearTimeout(timer6);
  };
}


"""Remediation records for roadmap fallback grouping.

Each entry: (issue, severity, owasp, root_cause, fix_steps, code_example, verify)
"""

SITE_CHECK_FIX = {
    "stored_xss": (
        "Stored Cross-Site Scripting", "High", "A03:2021-Injection",
        "User-submitted content is saved and rendered without output encoding.",
        ["HTML-encode stored values on output.",
         "Deploy a strict Content-Security-Policy."],
        "import html\nsafe = html.escape(stored_value)",
        "Submit a marker; re-fetch; confirm it is escaped.",
    ),
    "idor": (
        "Broken Object-Level Authorization", "High", "A01:2021-Broken Access Control",
        "Object lookups do not verify the requester owns the object.",
        ["Check object ownership on every read and write.",
         "Return 404 for objects the caller does not own."],
        "if obj.owner_id != current_user.id:\n    abort(404)",
        "Read another account's object; expect denial.",
    ),
    "csrf": (
        "Missing CSRF Protection", "Medium", "A01:2021-Broken Access Control",
        "State-changing forms accept requests without an anti-CSRF token or SameSite cookie.",
        ["Add a per-session CSRF token to every POST form.",
         "Set SameSite=Lax or Strict on session cookies."],
        '<input type="hidden" name="csrf_token" value="{{ token }}">',
        "Submit form from a foreign origin; expect rejection.",
    ),
    "security_headers": (
        "Missing Security Headers", "Low", "A05:2021-Security Misconfiguration",
        "Responses omit CSP, HSTS, X-Frame-Options or X-Content-Type-Options.",
        ["Send Content-Security-Policy, Strict-Transport-Security, X-Frame-Options "
         "and X-Content-Type-Options on all responses."],
        "response.headers['X-Content-Type-Options'] = 'nosniff'",
        "Inspect response headers.",
    ),
    "exposed_files": (
        "Exposed Sensitive Files or Debug Endpoints", "High",
        "A05:2021-Security Misconfiguration",
        "Source control metadata, environment files or debug pages are reachable.",
        ["Block /.git, /.env and debug routes at the web server.",
         "Disable debug mode in production."],
        r"location ~ /\.(git|env) { deny all; }",
        "Request the path; expect 404 or 403.",
    ),
    "open_redirect": (
        "Open Redirect", "Medium", "A01:2021-Broken Access Control",
        "A redirect parameter forwards users to arbitrary external hosts.",
        ["Validate redirect targets against an allowlist of relative paths or known hosts."],
        "if urlparse(next).netloc not in ALLOWED_HOSTS:\n    next = '/'",
        "Pass an external URL; expect rejection.",
    ),
    "cors": (
        "CORS Misconfiguration", "Medium", "A05:2021-Security Misconfiguration",
        "Access-Control-Allow-Origin reflects arbitrary origins, sometimes with credentials.",
        ["Allow only explicit trusted origins.",
         "Never combine wildcard origins with credentials."],
        "ALLOWED_ORIGINS = {'https://app.example.com'}",
        "Send a foreign Origin; expect no ACAO header.",
    ),
    "clickjacking": (
        "Clickjacking Exposure", "Low", "A05:2021-Security Misconfiguration",
        "Pages can be framed by other sites because neither frame-ancestors nor "
        "X-Frame-Options is set.",
        ["Set Content-Security-Policy: frame-ancestors 'self' or X-Frame-Options: DENY."],
        "response.headers['Content-Security-Policy'] = \"frame-ancestors 'self'\"",
        "Inspect response headers.",
    ),
    "ssrf": (
        "Server-Side Request Forgery Surface", "High", "A10:2021-Server-Side Request Forgery",
        "A parameter causes the server to fetch a user-supplied URL.",
        ["Allowlist outbound destinations.",
         "Block private, loopback and metadata address ranges."],
        "if not is_public(url):\n    abort(400)",
        "Supply a canary URL; expect rejection.",
    ),
    "cache": (
        "Web Cache Poisoning", "Medium", "A05:2021-Security Misconfiguration",
        "Unkeyed request headers are reflected into cacheable responses.",
        ["Do not reflect unkeyed headers.",
         "Include reflected inputs in the cache key or disable caching for them."],
        "Vary: X-Forwarded-Host",
        "Send a unique header; confirm it is absent from a clean response.",
    ),
    "headers": (
        "Missing Security Headers", "Low", "A05:2021-Security Misconfiguration",
        "Responses omit hardening headers.",
        ["Send a full set of hardening headers on every response."],
        "response.headers['X-Content-Type-Options'] = 'nosniff'",
        "Inspect response headers.",
    ),
    "graphql": (
        "GraphQL Introspection Enabled", "Low", "A05:2021-Security Misconfiguration",
        "The GraphQL schema is publicly queryable through introspection.",
        ["Disable introspection in production."],
        "# Disable introspection in the GraphQL server configuration",
        "Send an __schema query; expect an error.",
    ),
    "oauth_jwt": (
        "OAuth or JWT Weakness", "High",
        "A07:2021-Identification and Authentication Failures",
        "The redirect_uri is not exact-matched, or JWT headers allow weak algorithms.",
        ["Exact-match redirect_uri against registered values.",
         "Reject alg=none and pin the expected algorithm."],
        "jwt.decode(token, key, algorithms=['HS256'])",
        "Send a decoy redirect_uri; expect rejection.",
    ),
    "subdomain_takeover": (
        "Subdomain Takeover Risk", "High", "A05:2021-Security Misconfiguration",
        "A DNS record points at a hosting service that is no longer claimed.",
        ["Remove dangling DNS records.", "Claim or delete the external resource."],
        "# Delete the CNAME record for the decommissioned host",
        "Resolve the host; expect no dangling CNAME.",
    ),
    "websocket": (
        "WebSocket Origin Not Validated", "Medium",
        "A01:2021-Broken Access Control",
        "The WebSocket handshake accepts connections from foreign origins.",
        ["Verify the Origin header during the handshake.",
         "Require authentication before accepting messages."],
        "if origin not in ALLOWED_ORIGINS:\n    reject()",
        "Connect with a foreign Origin; expect rejection.",
    ),
    "sqli": (
        "Unparameterized Database Queries in Data Access Layer", "High",
        "A03:2021-Injection",
        "Raw SQL concatenation without parameter binding.",
        ["Replace string interpolation with query parameter binding.",
         "Enforce ORM or prepared statements."],
        "# Before:\ncursor.execute(f'SELECT * FROM t WHERE q = {q}')\n"
        "# After:\ncursor.execute('SELECT * FROM t WHERE q = ?', (q,))",
        "Run single quote probe; verify no DB error occurs.",
    ),
    "xss": (
        "Unescaped Dynamic Output Rendering in Views", "Medium", "A03:2021-Injection",
        "Output rendered directly to HTML DOM without contextual entity encoding.",
        ["Contextually HTML-encode user input before rendering.",
         "Deploy Content-Security-Policy."],
        "# Fix:\nimport html\nsafe_output = html.escape(user_input)",
        "Inject harmless marker tag; verify it is escaped as &lt;tag&gt;.",
    ),
    "session": (
        "Insecure Session Cookie Configuration", "Medium",
        "A05:2021-Security Misconfiguration",
        "Session identifier cookies emitted without HttpOnly, Secure, or SameSite.",
        ["Configure session cookie with HttpOnly=True, Secure=True, "
         "SameSite='Lax' or 'Strict'."],
        "response.set_cookie('session_id', token, httponly=True, secure=True, "
        "samesite='Lax')",
        "Inspect Set-Cookie header; confirm flags are present.",
    ),
    "access": (
        "Broken Access Control / IDOR in Resource Endpoints", "High",
        "A01:2021-Broken Access Control",
        "Missing authorization checks on resource endpoints.",
        ["Implement server-side authorization checks for every resource endpoint.",
         "Validate that the caller owns the requested resource."],
        "# Check ownership before returning resource\n"
        "if resource.owner_id != current_user.id:\n"
        "    raise HTTPException(status_code=403)",
        "Retest with modified resource ID; confirm 403 or redirect to login.",
    ),
}

DEFAULT_FIX = (
    "General Security Finding", "Medium", "A05:2021-Security Misconfiguration",
    "Security configuration or implementation needs review.",
    ["Review and apply recommended security controls."],
    "# Apply appropriate security hardening",
    "Retest with security probe to confirm fix.",
)

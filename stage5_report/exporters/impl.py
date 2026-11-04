"""Report exporters — HTML, JSON, PDF (future), Slack (future)."""

import json
import os
from datetime import datetime

# HTML template (lightweight — no external CDN, dark/light via CSS variables)
HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<style>
:root {{ --bg: #fff; --fg: #1a1a2e; --card-bg: #f8f9fa; --border: #e2e8f0;
  --critical: #dc2626; --high: #ea580c; --medium: #ca8a04; --low: #16a34a; --info: #2563eb; }}
[data-theme="dark"] {{ --bg: #0f172a; --fg: #e2e8f0; --card-bg: #1e293b; --border: #334155; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--fg); padding: 2rem; max-width: 960px; margin: 0 auto; }}
h1 {{ font-size: 1.5rem; margin-bottom: 0.5rem; }}
h2 {{ font-size: 1.2rem; margin: 2rem 0 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }}
.summary {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; margin: 1.5rem 0; }}
.summary .box {{ background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; text-align: center; }}
.summary .box .count {{ font-size: 2rem; font-weight: 700; }}
.critical {{ color: var(--critical); }} .high {{ color: var(--high); }} .medium {{ color: var(--medium); }} .low {{ color: var(--low); }} .info {{ color: var(--info); }}
.card {{ background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; }}
.card h3 {{ font-size: 1rem; margin-bottom: 0.5rem; }}
.card .badge {{ display: inline-block; padding: 0.15rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; color: white; margin-right: 0.5rem; }}
.badge.critical {{ background: var(--critical); }} .badge.high {{ background: var(--high); }}
.badge.medium {{ background: var(--medium); }} .badge.low {{ background: var(--low); }} .badge.info {{ background: var(--info); }}
pre {{ background: #1e293b; color: #e2e8f0; padding: 1rem; border-radius: 6px; overflow-x: auto; font-size: 0.85rem; margin: 0.5rem 0; }}
.theme-toggle {{ position: fixed; top: 1rem; right: 1rem; background: var(--card-bg); border: 1px solid var(--border); border-radius: 4px; padding: 0.5rem 1rem; cursor: pointer; }}
</style>
</head>
<body>
<button class="theme-toggle" onclick="toggleTheme()">☀/☾</button>
{body}
<script>
function toggleTheme() {{
  const html = document.documentElement;
  html.setAttribute('data-theme', html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}}
</script>
</body>
</html>"""


def _badge(severity: str) -> str:
    return f'<span class="badge {severity}">{severity.upper()}</span>'


def export_html(report: dict, output_path: str | None = None) -> str:
    """Export report as a standalone HTML file with dark mode toggle."""
    rs = report.get("risk_summary", {})
    body_parts = [
        f"<h1>{report.get('title', 'Security Report')}</h1>",
        f"<p>Target: {report.get('target_url', '')} | Scan ID: {report.get('scan_id', '')}</p>",
        f"<p>Generated: {report.get('generated_at', '')}</p>",
        "<h2>Risk Summary</h2>",
        f"<p>{rs.get('summary', '')}</p>",
        '<div class="summary">',
    ]
    for sev in ("critical", "high", "medium", "low"):
        count = rs.get("severity_counts", {}).get(sev, 0)
        if count:
            body_parts.append(f'<div class="box"><span class="count {sev}">{count}</span><br>{sev}</div>')
    body_parts.append("</div>")

    body_parts.append("<h2>Findings</h2>")
    for f in report.get("findings", []):
        body_parts.append(
            f'<div class="card">'
            f'<h3>{_badge(f.get("severity", "unknown"))} {f.get("module", "").upper()} — {f.get("param", "")}</h3>'
            f'<p><strong>URL:</strong> {f.get("url", "")}</p>'
            f'<p><strong>Signal:</strong> {f.get("signal", "")}</p>'
            f'<p><strong>OWASP:</strong> {f.get("owasp", "")} | Confidence: {f.get("confidence", 0):.0%}</p>'
        )
        if f.get("fix"):
            body_parts.append(f"<p><strong>Fix:</strong> {f.get('fix', '')}</p>")
        if f.get("snippet"):
            body_parts.append(f"<pre>{f.get('snippet', '')}</pre>")
        body_parts.append("</div>")

    html = HTML_TEMPLATE.format(
        title=report.get("title", "Security Report"),
        body="\n".join(body_parts),
    )

    if output_path:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html)

    return html


def export_json(report: dict, output_path: str | None = None) -> str:
    """Export report as JSON string."""
    json_str = json.dumps(report, indent=2, default=str)
    if output_path:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(json_str)
    return json_str
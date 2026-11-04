"""Technology fingerprinting via response headers, paths, and body signatures.

Lookup-table based (no ML). Detects frameworks, languages, servers.
"""

import re

# Response header fingerprints
HEADER_FINGERPRINTS = {
    "Server": {
        "Microsoft-IIS": "iis",
        "nginx": "nginx",
        "Apache": "apache",
        "cloudflare": "cloudflare",
        "gws": "google-web-server",
    },
    "X-Powered-By": {
        "Express": "express",
        "PHP": "php",
        "ASP.NET": "aspnet",
        "Next.js": "nextjs",
        "Flask": "flask",
    },
    "X-Generator": {
        "Drupal": "drupal",
        "WordPress": "wordpress",
        "Joomla": "joomla",
    },
}

# Static path fingerprints — existence check only
STATIC_PATH_FINGERPRINTS = {
    "/wp-admin": "wordpress",
    "/wp-login.php": "wordpress",
    "/.git/HEAD": "git-exposed",
    "/.env": "env-exposed",
    "/admin": "admin-panel",
    "/phpmyadmin": "phpmyadmin",
    "/.DS_Store": "macos-dsstore",
    "/robots.txt": "robots",
    "/sitemap.xml": "sitemap",
    "/crossdomain.xml": "flash-crossdomain",
}

# Body signature regex patterns
BODY_FINGERPRINTS = [
    (re.compile(r"wp-content/themes/", re.I), "wordpress"),
    (re.compile(r"Drupal\.settings", re.I), "drupal"),
    (re.compile(r"<meta\s+name=\"generator\"\s+content=\"WordPress", re.I), "wordpress"),
    (re.compile(r"<meta\s+name=\"generator\"\s+content=\"Drupal", re.I), "drupal"),
    (re.compile(r"react@\d+\.\d+", re.I), "react"),
    (re.compile(r"vue@\d+\.\d+", re.I), "vue"),
    (re.compile(r"angular@\d+", re.I), "angular"),
    (re.compile(r"__NEXT_DATA__", re.I), "nextjs"),
    (re.compile(r"Flask", re.I), "flask"),
    (re.compile(r"Django", re.I), "django"),
    (re.compile(r"Laravel", re.I), "laravel"),
    (re.compile(r"jQuery\s+v?\d+", re.I), "jquery"),
    (re.compile(r"Bootstrap\s+v?\d+", re.I), "bootstrap"),
]


async def fingerprint_headers(headers: dict) -> list[str]:
    """Fingerprint technologies from response headers."""
    found = []
    for header, patterns in HEADER_FINGERPRINTS.items():
        value = headers.get(header, "")
        if value:
            for pattern, tech in patterns.items():
                if pattern.lower() in value.lower():
                    found.append(tech)
    return found


def fingerprint_body(html: str) -> list[str]:
    """Fingerprint technologies from HTML body."""
    found = []
    for pattern, tech in BODY_FINGERPRINTS:
        if pattern.search(html):
            found.append(tech)
    return found


def fingerprint_static_path(path: str) -> str | None:
    """Check if a static path matches a known fingerprint."""
    return STATIC_PATH_FINGERPRINTS.get(path.lower())


async def run_fingerprint(url: str, headers: dict, body: str) -> list[str]:
    """Run all fingerprint checks and return deduplicated tech list."""
    from_header = await fingerprint_headers(headers)
    from_body = fingerprint_body(body)
    return sorted(set(from_header + from_body))


__all__ = ["run_fingerprint", "fingerprint_headers", "fingerprint_body", "fingerprint_static_path"]
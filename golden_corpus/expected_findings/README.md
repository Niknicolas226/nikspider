# Golden Corpus — expected findings

This directory holds golden expectations for end-to-end regression tests: for a
known vulnerable target, the fully staged pipeline (stages 0-6) must produce at
least the findings listed here with matching module + severity.

## Structure

One JSON file per target template:

```
expected_findings/<target-name>.json
```

Each file is a list of expected findings:

```json
[
  {
    "module": "sqli",
    "url_contains": "/search",
    "min_severity": "high",
    "signal_contains": "syntax error"
  }
]
```

## Targets

- `demo_app.json` — the bundled Flask demo app (vulnerable by default):

  | module             | endpoint           | severity | signal hint               |
  |--------------------|--------------------|----------|---------------------------|
  | sqli               | /search            | high     | syntax error              |
  | xss                | /search, /profile  | high     | nspmarker                 |
  | session            | /login             | medium   | HttpOnly                  |
  | headers            | any page           | low      | Content-Security-Policy   |
  | clickjacking       | any page           | low      | frame-ancestors           |
  | open_redirect      | /redirect          | medium   | evil-canary               |
  | cors               | /api/items         | medium   | confirmed_cors_origin     |
  | exposed_files      | /.git/HEAD         | high     | git                       |
  | ssrf               | /fetch             | high     | OAST callback             |
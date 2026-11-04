import html
import os
import sqlite3
from flask import Flask, request, make_response, jsonify

app = Flask(__name__)

FIXED = os.getenv("FIXED", "0").lower() in ("1", "true", "yes")
TOKEN = os.getenv("NIKSPIDER_TOKEN", "nikspider-verify=demo_token_12345678")

def init_demo_db():
    conn = sqlite3.connect("demo.db")
    with conn:
        conn.execute("CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, name TEXT, description TEXT)")
        conn.execute("DELETE FROM items")
        conn.executemany(
            "INSERT INTO items (name, description) VALUES (?, ?)",
            [
                ("Widget A", "High performance widget"),
                ("Gadget B", "Standard diagnostic gadget"),
                ("Super Tool", "Industrial grade utility"),
            ]
        )
    conn.close()

init_demo_db()

@app.route("/.well-known/nikspider.txt", methods=["GET", "POST"])
def well_known_token():
    # 1. Prefer the token file: the backend writes this on every target creation,
    #    so it is always the freshest token (the DB fallback below may hold stale rows).
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(here)
    for path in [
        os.path.join(root, ".nikspider-token"),
        os.path.join(here, ".nikspider-token"),
        ".nikspider-token",
    ]:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    tok = f.read().strip()
                    if tok:
                        return make_response(tok, 200, {"Content-Type": "text/plain"})
            except Exception:
                pass

    # 2. Fall back to the SQLite database for the latest registered token for this target
    db_path = os.getenv("NIKSPIDER_DB_PATH", os.path.join(root, "nikspider.db"))
    if os.path.exists(db_path):
        try:
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            cur.execute("SELECT token FROM targets WHERE url LIKE '%5000%' OR url LIKE '%localhost%' OR url LIKE '%127.0.0.1%' ORDER BY rowid DESC LIMIT 1")
            row = cur.fetchone()
            conn.close()
            if row and row[0]:
                return make_response(row[0], 200, {"Content-Type": "text/plain"})
        except Exception:
            pass

    return make_response(TOKEN, 200, {"Content-Type": "text/plain"})

@app.route("/set_token", methods=["GET", "POST"])
def set_token():
    global TOKEN
    new_tok = request.args.get("token") or request.values.get("token")
    if new_tok:
        TOKEN = new_tok
        try:
            with open(".nikspider-token", "w", encoding="utf-8") as f:
                f.write(new_tok)
        except Exception:
            pass
        return jsonify({"status": "updated", "token": TOKEN})
    return jsonify({"error": "missing token parameter"}), 400

@app.route("/")
def index():
    return """<!DOCTYPE html>
<html>
<head><title>NikSpider Demo Target</title></head>
<body>
    <h1>NikSpider Demo Target Application</h1>
    <ul>
        <li><a href="/search?q=Widget">SQLi Search (/search?q=...)</a></li>
        <li><a href="/profile?name=Guest">Reflected XSS (/profile?name=...)</a></li>
        <li><a href="/login">Session Login Cookie (/login)</a></li>
        <li><a href="/search_safe?query=Widget">Decoy 1: Safe Escaped Search (/search_safe?query=...)</a></li>
        <li><a href="/settings">Decoy 2: Benign Cookie (/settings)</a></li>
        <li><a href="/redirect?next=https://evil.com/">Open Redirect (/redirect?next=...)</a></li>
        <li><a href="/api/items">CORS API (/api/items)</a></li>
        <li><a href="/graphql">GraphQL (/graphql)</a></li>
        <li><a href="/guestbook">Stored XSS Guestbook (/guestbook)</a></li>
        <li><a href="/transfer">CSRF Transfer (/transfer)</a></li>
        <li><a href="/fetch?url=http://example.com/">SSRF Fetch (/fetch?url=...)</a></li>
    </ul>
</body>
</html>"""

@app.route("/search")
def search():
    q = request.args.get("q", "")
    conn = sqlite3.connect("demo.db")
    cursor = conn.cursor()

    if not FIXED:
        # VULNERABLE: Direct string concatenation leading to SQL injection syntax error or boolean differential
        query = f"SELECT id, name, description FROM items WHERE name LIKE '%{q}%'"
        try:
            cursor.execute(query)
            rows = cursor.fetchall()
            conn.close()
            return f"<html><body><h3>Search Results for: {q}</h3><ul>" + "".join(f"<li>{r[1]} - {r[2]}</li>" for r in rows) + "</ul></body></html>"
        except sqlite3.OperationalError as e:
            conn.close()
            return make_response(f"<html><body><h3>Database OperationalError: syntax error: {str(e)}</h3></body></html>", 500)
    else:
        # FIXED: Parameterized query
        try:
            cursor.execute("SELECT id, name, description FROM items WHERE name LIKE ?", (f"%{q}%",))
            rows = cursor.fetchall()
            conn.close()
            return f"<html><body><h3>Search Results for: {html.escape(q)}</h3><ul>" + "".join(f"<li>{html.escape(r[1])}</li>" for r in rows) + "</ul></body></html>"
        except Exception as e:
            conn.close()
            return make_response(f"<html><body>An error occurred.</body></html>", 500)

@app.route("/profile", methods=["GET", "POST"])
def profile():
    name = request.values.get("name", "Guest")
    if not FIXED:
        # VULNERABLE: Unescaped reflected output
        return f"<!DOCTYPE html><html><body><h1>User Profile: {name}</h1></body></html>"
    else:
        # FIXED: Contextually escaped HTML
        return f"<!DOCTYPE html><html><body><h1>User Profile: {html.escape(name)}</h1></body></html>"

@app.route("/login")
def login():
    resp = make_response("<!DOCTYPE html><html><body><p>Logged in successfully.</p></body></html>")
    if not FIXED:
        # VULNERABLE: Missing HttpOnly, Secure, SameSite on session cookie
        resp.set_cookie("session_id", "demo_session_secret_token_xyz")
    else:
        # FIXED: Enforce secure session attributes
        resp.set_cookie("session_id", "demo_session_secret_token_xyz", httponly=True, secure=True, samesite="Strict")
    return resp

@app.route("/search_safe")
def search_safe():
    # DECOY 1: Safely escapes input; looks like an XSS probe target but is completely safe
    query = request.args.get("query", "")
    return f"<!DOCTYPE html><html><body><h3>Safe Search:</h3><p>Results for: {html.escape(query)}</p></body></html>"

@app.route("/settings")
def settings():
    # DECOY 2: Non-session cosmetic cookie without security flags
    resp = make_response("<!DOCTYPE html><html><body><p>Settings saved.</p></body></html>")
    resp.set_cookie("theme", "dark")
    return resp


# ---------------------------------------------------------------- spiderattack demo routes

@app.route("/redirect")
def open_redirect_demo():
    # VULNERABLE: forwards to any URL in `next`. FIXED: only relative paths.
    from flask import redirect
    nxt = request.args.get("next", "/")
    if FIXED and not nxt.startswith("/"):
        nxt = "/"
    return redirect(nxt, code=302)

@app.route("/fetch")
def ssrf_demo():
    # VULNERABLE: server-side fetches any user-supplied URL.
    # FIXED: only allow-listed hosts are fetched.
    target = request.args.get("url", "")
    if not target:
        return "usage: /fetch?url=https://example.com", 400
    if FIXED:
        from urllib.parse import urlparse
        host = (urlparse(target).hostname or "").lower()
        # Fixed: only public allow-listed hosts. Loopback/link-local are the
        # exact thing SSRF is meant to reach, so they must be blocked.
        if not host.endswith("example.com"):
            return "blocked", 403
    try:
        import urllib.request
        with urllib.request.urlopen(target, timeout=5) as r:
            return f"fetched {target}: {r.status}"
    except Exception as e:
        return f"fetch error: {e}", 502


@app.route("/api/items")
def api_items():
    # Used by CORS / clickjacking checks: reflects origin only when VULNERABLE.
    resp = make_response(jsonify([{"id": 1, "name": "Widget A"}]))
    origin = request.headers.get("Origin", "")
    if not FIXED and origin:
        resp.headers["Access-Control-Allow-Origin"] = origin
        resp.headers["Access-Control-Allow-Credentials"] = "true"
    return resp

@app.route("/graphql", methods=["GET", "POST"])
def graphql_demo():
    # VULNERABLE: introspection answered. FIXED: introspection rejected.
    body = request.get_json(silent=True) or {}
    q = body.get("query", "")
    if "__schema" in q and not FIXED:
        return jsonify({"data": {"__schema": {"queryType": {"name": "Query"}}}})
    if "__schema" in q:
        return jsonify({"errors": [{"message": "Introspection disabled"}]}), 400
    return jsonify({"data": {"ok": True}})

_GUESTBOOK: list[str] = []

@app.route("/guestbook", methods=["GET", "POST"])
def guestbook():
    # Stored XSS demo: VULNERABLE stores raw HTML and renders it; FIXED escapes it.
    if request.method == "POST":
        msg = request.form.get("message", "")
        _GUESTBOOK.append(msg)
    rows = "".join(f"<li>{m if not FIXED else html.escape(m)}</li>" for m in _GUESTBOOK)
    form = ('<form method="post"><input name="message"><button>Post</button></form>')
    return f"<!DOCTYPE html><html><body>{form}<ul>{rows}</ul></body></html>"

@app.route("/transfer", methods=["GET", "POST"])
def transfer():
    # CSRF demo: VULNERABLE form has no token; FIXED form requires one.
    form = ('<form method="post" action="/transfer">'
            + ('' if FIXED else '')
            + ('<input type="hidden" name="csrf_token" value="tok">' if FIXED else '')
            + '<input name="amount"><button>Send</button></form>')
    resp = make_response(f"<!DOCTYPE html><html><body>{form}</body></html>")
    if FIXED:
        resp.set_cookie("csrf_marker", "1", samesite="Strict")
    return resp

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)


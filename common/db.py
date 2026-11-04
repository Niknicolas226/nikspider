"""SQLite database layer with WAL mode, migrations, and context manager.

Tables: targets, scans, findings, triage, roadmap_nodes, request_log,
        surface_targets, surface_params, flows, role_sessions, evidence,
        findings_history, planner_decisions
"""

import json
import os
import sqlite3
from contextlib import contextmanager
from typing import Any

DB_PATH = os.getenv("NIKSPIDER_DB_PATH", os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "nikspider.db"))

SCHEMA_VERSION = 2


def _ensure_tables(conn: sqlite3.Connection) -> None:
    # init_db is idempotent: CREATE IF NOT EXISTS plus guarded ALTER for new
    # columns, so it is safe (and necessary for migrations) on every connect.
    init_db(conn)


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    _ensure_tables(conn)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db(existing_conn: sqlite3.Connection | None = None) -> None:
    conn = existing_conn or sqlite3.connect(DB_PATH)
    with conn:
        conn.executescript("""
        -- Core tables (v1)
        CREATE TABLE IF NOT EXISTS targets (
            id TEXT PRIMARY KEY,
            url TEXT NOT NULL,
            token TEXT NOT NULL,
            verified_at TEXT
        );

        CREATE TABLE IF NOT EXISTS scans (
            id TEXT PRIMARY KEY,
            target_id TEXT NOT NULL,
            started_at TEXT NOT NULL,
            finished_at TEXT,
            risk_score INTEGER DEFAULT 0,
            raw_count INTEGER DEFAULT 0,
            confirmed_count INTEGER DEFAULT 0,
            profile TEXT DEFAULT 'standard',
            FOREIGN KEY (target_id) REFERENCES targets (id)
        );

        CREATE TABLE IF NOT EXISTS findings (
            id TEXT PRIMARY KEY,
            scan_id TEXT NOT NULL,
            module TEXT NOT NULL,
            url TEXT NOT NULL,
            param TEXT,
            request TEXT,
            response TEXT,
            signal TEXT,
            status TEXT DEFAULT 'raw',
            extra TEXT,
            dedup_key TEXT,
            surface_id TEXT,
            role TEXT DEFAULT 'anon',
            confidence TEXT DEFAULT 'medium',
            FOREIGN KEY (scan_id) REFERENCES scans (id)
        );

        CREATE TABLE IF NOT EXISTS triage (
            finding_id TEXT PRIMARY KEY,
            agent_a TEXT,
            agent_b TEXT,
            verdict TEXT NOT NULL,
            severity TEXT,
            owasp TEXT,
            confidence REAL,
            reason TEXT,
            evidence_quote TEXT,
            source TEXT DEFAULT 'llm',
            FOREIGN KEY (finding_id) REFERENCES findings (id)
        );

        CREATE TABLE IF NOT EXISTS roadmap_nodes (
            id TEXT PRIMARY KEY,
            scan_id TEXT NOT NULL,
            parent_id TEXT,
            json TEXT NOT NULL,
            status TEXT DEFAULT 'open',
            FOREIGN KEY (scan_id) REFERENCES scans (id)
        );

        CREATE TABLE IF NOT EXISTS request_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scan_id TEXT,
            ts TEXT NOT NULL,
            method TEXT NOT NULL,
            url TEXT NOT NULL,
            status INTEGER
        );

        -- v2 tables
        CREATE TABLE IF NOT EXISTS surface_targets (
            id TEXT PRIMARY KEY, scan_id TEXT, url TEXT, method TEXT,
            auth_required INTEGER, cacheable INTEGER, mutating INTEGER, upload INTEGER,
            api_kind TEXT, json TEXT
        );

        CREATE TABLE IF NOT EXISTS surface_params (
            id TEXT PRIMARY KEY, target_id TEXT, name TEXT, location TEXT,
            sink TEXT, reflection TEXT, tainted_by TEXT
        );

        CREATE TABLE IF NOT EXISTS flows (
            id TEXT PRIMARY KEY, scan_id TEXT, name TEXT, json TEXT, discovered_at TEXT
        );

        CREATE TABLE IF NOT EXISTS role_sessions (
            id TEXT PRIMARY KEY, scan_id TEXT, role TEXT,
            cookies TEXT, headers TEXT, valid INTEGER
        );

        CREATE TABLE IF NOT EXISTS evidence (
            id TEXT PRIMARY KEY, finding_id TEXT, kind TEXT,
            blob TEXT, ts TEXT
        );

        CREATE TABLE IF NOT EXISTS findings_history (
            dedup_key TEXT PRIMARY KEY, module TEXT, url_template TEXT, param TEXT,
            first_seen TEXT, last_seen TEXT, state TEXT, severity TEXT
        );

        CREATE TABLE IF NOT EXISTS planner_decisions (
            id TEXT PRIMARY KEY, scan_id TEXT, surface_id TEXT, module TEXT,
            decision TEXT, reason TEXT, ts TEXT
        );

        CREATE TABLE IF NOT EXISTS schema_version (
            version INTEGER PRIMARY KEY
        );
        """)
        conn.execute("INSERT OR IGNORE INTO schema_version (version) VALUES (?)", (SCHEMA_VERSION,))

        # In-place column migrations for pre-existing databases (CREATE IF NOT
        # EXISTS cannot add columns). Each ALTER is guarded on column existence.
        migs = [
            ("scans", "profile", "TEXT DEFAULT 'standard'"),
            ("findings", "dedup_key", "TEXT"),
            ("findings", "surface_id", "TEXT"),
            ("findings", "role", "TEXT DEFAULT 'anon'"),
            ("findings", "confidence", "TEXT DEFAULT 'medium'"),
            ("triage", "evidence_quote", "TEXT"),
            ("triage", "source", "TEXT DEFAULT 'llm'"),
        ]
        for table, column, ddl in migs:
            cols = [r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()]
            if column not in cols:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")

    if existing_conn is None:
        conn.close()


def log_request(scan_id: str | None, ts: str, method: str, url: str, status: int | None) -> None:
    try:
        conn = get_db()
        with conn:
            conn.execute(
                "INSERT INTO request_log (scan_id, ts, method, url, status) VALUES (?, ?, ?, ?, ?)",
                (scan_id, ts, method, url, status)
            )
        conn.close()
    except Exception:
        pass


@contextmanager
def get_db_ctx():
    """Context-managed database connection with auto commit/rollback."""
    conn = get_db()
    try:
        with conn:
            yield conn
    finally:
        conn.close()


def get_request_logs(scan_id: str, limit: int = 100) -> list[dict]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, scan_id, ts, method, url, status FROM request_log WHERE scan_id = ? ORDER BY id DESC LIMIT ?",
        (scan_id, limit)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]
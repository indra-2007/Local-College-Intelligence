"""
Centralized Authentication & Chat History Storage for Local College Intelligence
Database: SQLite at data/app_storage.db (isolated from institutional dataset tables)
"""

import os
import sqlite3
import hashlib
import hmac
import secrets
import json
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
STORAGE_DB_PATH = os.environ.get(
    "STORAGE_DB_PATH",
    os.path.join(ROOT_DIR, "data", "app_storage.db")
)

def get_storage_db():
    os.makedirs(os.path.dirname(STORAGE_DB_PATH), exist_ok=True)
    conn = sqlite3.connect(STORAGE_DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def hash_password(password: str) -> str:
    """Generate a PBKDF2-SHA256 password hash with random salt."""
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000)
    return f"pbkdf2_sha256$100000${salt}${dk.hex()}"

def verify_password(password: str, hashed: str) -> bool:
    """Verify password against stored PBKDF2-SHA256 hash using constant-time comparison."""
    try:
        parts = hashed.split("$")
        if len(parts) != 4 or parts[0] != "pbkdf2_sha256":
            return False
        iterations = int(parts[1])
        salt = parts[2].encode("utf-8")
        expected_dk = bytes.fromhex(parts[3])
        actual_dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
        return hmac.compare_digest(actual_dk, expected_dk)
    except Exception:
        return False

def init_storage_db():
    """Create tables for authentication, sessions, and chat history if not present."""
    conn = get_storage_db()
    with conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                name TEXT NOT NULL,
                role TEXT NOT NULL,
                department TEXT DEFAULT 'CSE',
                created_at TEXT NOT NULL
            );
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS auth_sessions (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                model TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                mode TEXT NOT NULL DEFAULT 'chat',
                timestamp TEXT NOT NULL,
                metadata TEXT,
                FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
            );
        """)

        # Check if users table is empty; if so, seed standard institutional dev accounts
        cur = conn.execute("SELECT COUNT(*) FROM users;")
        if cur.fetchone()[0] == 0:
            seed_accounts = [
                ("usr_student_01", "student@rvce.edu.in", "Student@123", "Rohan K.", "student", "CSE"),
                ("usr_student_02", "aditi@rvce.edu.in", "Student@123", "Aditi Rao", "student", "CSE"),
                ("usr_faculty_01", "faculty@rvce.edu.in", "Faculty@123", "Dr. Rajesh K.", "faculty", "Mathematics"),
                ("usr_hod_01", "hod@rvce.edu.in", "Hod@123", "Dr. Sunitha M.", "hod", "CSE"),
                ("usr_admin_01", "admin@rvce.edu.in", "Admin@123", "Campus Administrator", "admin", "IT Administration"),
            ]
            now = datetime.utcnow().isoformat()
            for uid, email, pwd, name, role, dept in seed_accounts:
                phash = hash_password(pwd)
                conn.execute(
                    "INSERT INTO users (id, email, password_hash, name, role, department, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (uid, email.lower(), phash, name, role, dept, now)
                )

    conn.close()

# ─── User Management ──────────────────────────────────────────────────────────

def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    """Validate user credentials and return user dict if valid."""
    init_storage_db()
    conn = get_storage_db()
    cur = conn.execute(
        "SELECT id, email, password_hash, name, role, department FROM users WHERE email = ?",
        (email.strip().lower(),)
    )
    row = cur.fetchone()
    conn.close()

    if not row:
        return None

    uid, uemail, phash, name, role, dept = row
    if not verify_password(password, phash):
        return None

    return {
        "id": uid,
        "email": uemail,
        "name": name,
        "role": role,
        "department": dept
    }

def create_auth_session(user_id: str, days_valid: int = 30) -> str:
    """Generate and store a cryptographically secure session token."""
    token = secrets.token_urlsafe(32)
    created_at = datetime.utcnow()
    expires_at = created_at + timedelta(days=days_valid)

    conn = get_storage_db()
    with conn:
        conn.execute(
            "INSERT INTO auth_sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
            (token, user_id, created_at.isoformat(), expires_at.isoformat())
        )
    conn.close()
    return token

def get_user_by_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify session token and return user info if active."""
    if not token:
        return None
    init_storage_db()
    now = datetime.utcnow().isoformat()
    conn = get_storage_db()
    cur = conn.execute(
        """
        SELECT u.id, u.email, u.name, u.role, u.department, s.expires_at
        FROM auth_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ? AND s.expires_at > ?
        """,
        (token, now)
    )
    row = cur.fetchone()
    conn.close()

    if not row:
        return None

    return {
        "id": row[0],
        "email": row[1],
        "name": row[2],
        "role": row[3],
        "department": row[4]
    }

def delete_auth_session(token: str) -> bool:
    """Invalidate a session token on logout."""
    conn = get_storage_db()
    with conn:
        conn.execute("DELETE FROM auth_sessions WHERE token = ?", (token,))
    conn.close()
    return True

def create_or_update_user(email: str, password: str, name: str, role: str, department: str = "CSE") -> Dict[str, Any]:
    """Create or update a user account with a secure PBKDF2 hash."""
    init_storage_db()
    email_clean = email.strip().lower()
    phash = hash_password(password)
    now = datetime.utcnow().isoformat()
    conn = get_storage_db()

    with conn:
        cur = conn.execute("SELECT id FROM users WHERE email = ?", (email_clean,))
        existing = cur.fetchone()
        if existing:
            uid = existing[0]
            conn.execute(
                "UPDATE users SET password_hash = ?, name = ?, role = ?, department = ? WHERE id = ?",
                (phash, name, role, department, uid)
            )
        else:
            uid = f"usr_{secrets.token_hex(6)}"
            conn.execute(
                "INSERT INTO users (id, email, password_hash, name, role, department, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (uid, email_clean, phash, name, role, department, now)
            )
    conn.close()
    return {"id": uid, "email": email_clean, "name": name, "role": role, "department": department}

def list_users() -> List[Dict[str, Any]]:
    """Return all registered institutional users without exposing password hashes."""
    init_storage_db()
    conn = get_storage_db()
    cur = conn.execute("SELECT id, email, name, role, department, created_at FROM users ORDER BY created_at ASC")
    rows = cur.fetchall()
    conn.close()
    return [
        {"id": r[0], "email": r[1], "name": r[2], "role": r[3], "department": r[4], "created_at": r[5]}
        for r in rows
    ]

# ─── Chat History Management ──────────────────────────────────────────────────

def get_user_chat_sessions(user_id: str) -> List[Dict[str, Any]]:
    """Retrieve all chat sessions and their messages for a specific user."""
    init_storage_db()
    conn = get_storage_db()
    
    # 1. Fetch sessions
    cur = conn.execute(
        "SELECT id, title, model, created_at, updated_at FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC",
        (user_id,)
    )
    session_rows = cur.fetchall()

    sessions = []
    for s in session_rows:
        sid = s[0]
        cur_msg = conn.execute(
            "SELECT role, content, mode, timestamp, metadata FROM chat_messages WHERE session_id = ? ORDER BY id ASC",
            (sid,)
        )
        msg_rows = cur_msg.fetchall()
        messages = []
        for m in msg_rows:
            msg_obj = {
                "role": m[0],
                "content": m[1],
                "mode": m[2],
                "timestamp": m[3],
            }
            if m[4]:
                try:
                    meta = json.loads(m[4])
                    if "sqlMeta" in meta:
                        msg_obj["sqlMeta"] = meta["sqlMeta"]
                    if "result" in meta:
                        msg_obj["result"] = meta["result"]
                    if "docSources" in meta:
                        msg_obj["docSources"] = meta["docSources"]
                except Exception:
                    pass
            messages.append(msg_obj)

        sessions.append({
            "id": sid,
            "title": s[1],
            "model": s[2],
            "createdAt": s[3],
            "updatedAt": s[4],
            "messages": messages,
        })

    conn.close()
    return sessions

def get_chat_session(session_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve a single session by ID, ensuring user ownership."""
    init_storage_db()
    conn = get_storage_db()
    cur = conn.execute(
        "SELECT id, title, model, created_at, updated_at FROM chat_sessions WHERE id = ? AND user_id = ?",
        (session_id, user_id)
    )
    s = cur.fetchone()
    if not s:
        conn.close()
        return None

    cur_msg = conn.execute(
        "SELECT role, content, mode, timestamp, metadata FROM chat_messages WHERE session_id = ? ORDER BY id ASC",
        (session_id,)
    )
    msg_rows = cur_msg.fetchall()
    conn.close()

    messages = []
    for m in msg_rows:
        msg_obj = {
            "role": m[0],
            "content": m[1],
            "mode": m[2],
            "timestamp": m[3],
        }
        if m[4]:
            try:
                meta = json.loads(m[4])
                if "sqlMeta" in meta:
                    msg_obj["sqlMeta"] = meta["sqlMeta"]
                if "result" in meta:
                    msg_obj["result"] = meta["result"]
                if "docSources" in meta:
                    msg_obj["docSources"] = meta["docSources"]
            except Exception:
                pass
        messages.append(msg_obj)

    return {
        "id": s[0],
        "title": s[1],
        "model": s[2],
        "createdAt": s[3],
        "updatedAt": s[4],
        "messages": messages,
    }

def upsert_chat_session(session_data: Dict[str, Any], user_id: str) -> Dict[str, Any]:
    """Insert or update a chat session and all its messages for the specified user."""
    init_storage_db()
    sid = session_data.get("id") or secrets.token_hex(8)
    title = session_data.get("title", "Untitled chat")
    model = session_data.get("model", "qwen3-4b")
    now_str = datetime.utcnow().isoformat()
    created_at = session_data.get("createdAt") or now_str
    updated_at = session_data.get("updatedAt") or now_str
    messages = session_data.get("messages", [])

    conn = get_storage_db()
    with conn:
        # Check ownership if session already exists
        cur = conn.execute("SELECT user_id FROM chat_sessions WHERE id = ?", (sid,))
        existing = cur.fetchone()
        if existing and existing[0] != user_id:
            conn.close()
            raise PermissionError("Session belongs to another user")

        if existing:
            conn.execute(
                "UPDATE chat_sessions SET title = ?, model = ?, updated_at = ? WHERE id = ? AND user_id = ?",
                (title, model, updated_at, sid, user_id)
            )
        else:
            conn.execute(
                "INSERT INTO chat_sessions (id, user_id, title, model, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                (sid, user_id, title, model, created_at, updated_at)
            )

        # Replace messages for this session
        conn.execute("DELETE FROM chat_messages WHERE session_id = ?", (sid,))
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            mode = msg.get("mode", "chat")
            timestamp = msg.get("timestamp") or now_str
            meta_dict = {}
            if "sqlMeta" in msg:
                meta_dict["sqlMeta"] = msg["sqlMeta"]
            if "result" in msg:
                meta_dict["result"] = msg["result"]
            if "docSources" in msg:
                meta_dict["docSources"] = msg["docSources"]

            metadata_json = json.dumps(meta_dict) if meta_dict else None
            conn.execute(
                "INSERT INTO chat_messages (session_id, role, content, mode, timestamp, metadata) VALUES (?, ?, ?, ?, ?, ?)",
                (sid, role, content, mode, timestamp, metadata_json)
            )

    conn.close()
    return {
        "id": sid,
        "title": title,
        "model": model,
        "createdAt": created_at,
        "updatedAt": updated_at,
        "messages": messages,
    }

def delete_chat_session(session_id: str, user_id: str) -> bool:
    """Delete a chat session and cascade delete its messages, if owned by user."""
    init_storage_db()
    conn = get_storage_db()
    with conn:
        cur = conn.execute("SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?", (session_id, user_id))
        if not cur.fetchone():
            conn.close()
            return False
        conn.execute("DELETE FROM chat_sessions WHERE id = ? AND user_id = ?", (session_id, user_id))
    conn.close()
    return True

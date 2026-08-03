import os
import json
import logging
import uuid
import hashlib
import hmac
import time
import base64
import secrets
from typing import Optional


logger = logging.getLogger(__name__)

_SECRET_KEY = os.environ.get("AUTH_SECRET_KEY")
if not _SECRET_KEY:
    logger.warning("AUTH_SECRET_KEY not set — using insecure dev key. Do NOT use in production.")
    _SECRET_KEY = "dev-secret-change-in-production"


def hash_password(password: str) -> str:
    """Hash a password using PBKDF2-SHA256 with a random salt."""
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return f"{salt}${dk.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a password against a stored PBKDF2-SHA256 hash."""
    try:
        salt, expected_hex = stored_hash.split("$", 1)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
        return hmac.compare_digest(dk.hex(), expected_hex)
    except Exception:
        return False


def create_token(user_id: int, email: str, role: str, name: str) -> str:
    """Create a simple HMAC-signed token."""
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "name": name,
        "iat": int(time.time()),
        "exp": int(time.time()) + 86400,
        "jti": str(uuid.uuid4())
    }
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    sig = hashlib.sha256(f"{payload_b64}.{_SECRET_KEY}".encode()).hexdigest()
    return f"{payload_b64}.{sig}"


def verify_token(token: str) -> Optional[dict]:
    """Verify and decode a token. Returns None if invalid."""
    try:
        parts = token.split(".")
        if len(parts) != 2:
            return None
        payload_b64, sig = parts
        expected_sig = hashlib.sha256(f"{payload_b64}.{_SECRET_KEY}".encode()).hexdigest()
        if sig != expected_sig:
            return None
        payload = json.loads(base64.urlsafe_b64decode(payload_b64 + "=="))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None

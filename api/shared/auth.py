import os
import json
import logging
import uuid
import hashlib
import time
import base64
from functools import wraps
from typing import Optional
import azure.functions as func


logger = logging.getLogger(__name__)

_SECRET_KEY = os.environ.get("AUTH_SECRET_KEY", "dev-secret-change-in-production")


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


def get_user_from_request(req: func.HttpRequest) -> Optional[dict]:
    """
    Extract user from Bearer token.
    Returns dict with user_id, email, role, name or None if not authenticated.
    """
    auth_header = req.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header[7:]
    payload = verify_token(token)
    if not payload:
        return None

    return {
        "user_id": str(payload.get("sub", "")),
        "email": payload.get("email", ""),
        "role": payload.get("role", "seller"),
        "name": payload.get("name", "")
    }


def require_auth(func):
    """Decorator to require authentication on Azure Functions."""
    @wraps(func)
    def wrapper(req: func.HttpRequest) -> func.HttpResponse:
        user = get_user_from_request(req)
        if not user:
            return func.HttpResponse(
                json.dumps({"error": "Unauthorized"}),
                status_code=401,
                mimetype="application/json"
            )
        req.route_data["user"] = user
        return func(req)
    return wrapper


def require_admin(func):
    """Decorator to require admin role."""
    @wraps(func)
    def wrapper(req: func.HttpRequest) -> func.HttpResponse:
        user = get_user_from_request(req)
        if not user:
            return func.HttpResponse(
                json.dumps({"error": "Unauthorized"}),
                status_code=401,
                mimetype="application/json"
            )
        if user.get("role") != "admin":
            return func.HttpResponse(
                json.dumps({"error": "Forbidden: admin role required"}),
                status_code=403,
                mimetype="application/json"
            )
        req.route_data["user"] = user
        return func(req)
    return wrapper

import os
import json
import logging
import requests
from functools import wraps
from typing import Optional
import azure.functions as func


logger = logging.getLogger(__name__)

B2C_TENANT = os.environ.get("AZURE_B2C_TENANT_NAME", "")
B2C_POLICY = os.environ.get("AZURE_B2C_POLICY_NAME", "")
B2C_CLIENT_ID = os.environ.get("AZURE_B2C_CLIENT_ID", "")
JWKS_URL = f"https://{B2C_TENANT}.b2clogin.com/{B2C_TENANT}.onmicrosoft.com/{B2C_POLICY}/discovery/v2.0/keys"

_jwks_cache: Optional[dict] = None


def _get_jwks() -> dict:
    """Fetch and cache JWKS from Azure AD B2C."""
    global _jwks_cache
    if _jwks_cache is None:
        try:
            resp = requests.get(JWKS_URL, timeout=10)
            resp.raise_for_status()
            _jwks_cache = resp.json()
        except Exception as e:
            logger.error(f"Failed to fetch JWKS: {e}")
            _jwks_cache = {}
    return _jwks_cache


def get_user_from_request(req: func.HttpRequest) -> Optional[dict]:
    """
    Extract user claims from the request.
    Returns dict with user_id, email, role or None if not authenticated.
    """
    auth_header = req.headers.get("x-ms-client-principal")
    if not auth_header:
        auth_header = req.headers.get("Authorization", "")

    try:
        # Azure Static Web Apps passes user info via header
        if "x-ms-client-principal" in req.headers:
            import base64
            decoded = base64.b64decode(req.headers["x-ms-client-principal"]).decode("utf-8")
            principal = json.loads(decoded)
            user_claims = {}
            for claim in principal.get("userRoles", []):
                pass
            for claim in principal.get("claims", []):
                user_claims[claim["typ"]] = claim["val"]
            return {
                "user_id": user_claims.get("oid", ""),
                "email": user_claims.get("emails", user_claims.get("email", "")),
                "role": user_claims.get("extension_role", "seller"),
                "name": user_claims.get("name", "")
            }
    except Exception as e:
        logger.warning(f"Could not parse principal header: {e}")

    return None


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

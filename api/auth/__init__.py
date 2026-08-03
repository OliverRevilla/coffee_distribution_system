import json
import logging
import azure.functions as func
from shared.db import get_connection
from shared.auth import create_token, hash_password, verify_password, require_admin

app = func.FunctionApp()


@app.route(route="auth/login", methods=["POST"], auth_level="anonymous")
def login(req: func.HttpRequest) -> func.HttpResponse:
    """Login with email and password."""
    try:
        body = req.get_json()
        email = body.get("email", "").strip().lower()
        password = body.get("password", "")

        if not email:
            return func.HttpResponse(
                json.dumps({"error": "Email is required"}),
                status_code=400,
                mimetype="application/json"
            )
        if not password:
            return func.HttpResponse(
                json.dumps({"error": "Password is required"}),
                status_code=400,
                mimetype="application/json"
            )

        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, email, full_name, role, status, password_hash FROM distribution.users WHERE email = %s",
            (email,)
        )
        row = cursor.fetchone()

        if not row:
            return func.HttpResponse(
                json.dumps({"error": "Invalid email or password"}),
                status_code=401,
                mimetype="application/json"
            )

        user_id, user_email, full_name, role, status, password_hash = row

        if status != "active":
            return func.HttpResponse(
                json.dumps({"error": "Account is inactive. Contact your administrator."}),
                status_code=403,
                mimetype="application/json"
            )

        if not password_hash or not verify_password(password, password_hash):
            return func.HttpResponse(
                json.dumps({"error": "Invalid email or password"}),
                status_code=401,
                mimetype="application/json"
            )

        token = create_token(user_id, user_email, role, full_name)

        return func.HttpResponse(
            json.dumps({
                "token": token,
                "user": {
                    "user_id": user_id,
                    "email": user_email,
                    "name": full_name,
                    "role": role
                }
            }),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Login error: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )


@app.route(route="auth/register/seller", methods=["POST"], auth_level="anonymous")
def register_seller(req: func.HttpRequest) -> func.HttpResponse:
    """Public registration for sellers."""
    try:
        body = req.get_json()
        email = body.get("email", "").strip().lower()
        password = body.get("password", "")
        full_name = body.get("full_name", "").strip()

        if not email:
            return func.HttpResponse(
                json.dumps({"error": "Email is required"}),
                status_code=400,
                mimetype="application/json"
            )
        if not password or len(password) < 6:
            return func.HttpResponse(
                json.dumps({"error": "Password must be at least 6 characters"}),
                status_code=400,
                mimetype="application/json"
            )
        if not full_name:
            return func.HttpResponse(
                json.dumps({"error": "Full name is required"}),
                status_code=400,
                mimetype="application/json"
            )

        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM distribution.users WHERE email = %s", (email,))
        if cursor.fetchone():
            return func.HttpResponse(
                json.dumps({"error": "A user with this email already exists"}),
                status_code=409,
                mimetype="application/json"
            )

        password_hash = hash_password(password)
        cursor.execute(
            """INSERT INTO distribution.users (email, full_name, password_hash, role, status, azure_b2c_id)
               VALUES (%s, %s, %s, 'seller', 'active', %s)
               RETURNING id""",
            (email, full_name, password_hash, email)
        )
        new_id = cursor.fetchone()[0]
        conn.commit()

        return func.HttpResponse(
            json.dumps({"id": new_id, "message": "Seller registered successfully"}),
            status_code=201,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Seller registration error: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )


@app.route(route="auth/register", methods=["POST"], auth_level="anonymous")
@require_admin
def register(req: func.HttpRequest) -> func.HttpResponse:
    """Register a new user (admin only, for creating users from dashboard)."""
    try:
        body = req.get_json()
        email = body.get("email", "").strip().lower()
        password = body.get("password", "")
        full_name = body.get("full_name", "").strip()
        role = body.get("role", "seller")

        if not email:
            return func.HttpResponse(
                json.dumps({"error": "Email is required"}),
                status_code=400,
                mimetype="application/json"
            )
        if not password or len(password) < 6:
            return func.HttpResponse(
                json.dumps({"error": "Password must be at least 6 characters"}),
                status_code=400,
                mimetype="application/json"
            )
        if not full_name:
            return func.HttpResponse(
                json.dumps({"error": "Full name is required"}),
                status_code=400,
                mimetype="application/json"
            )
        if role not in ("admin", "seller"):
            return func.HttpResponse(
                json.dumps({"error": "Role must be 'admin' or 'seller'"}),
                status_code=400,
                mimetype="application/json"
            )

        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT id FROM distribution.users WHERE email = %s", (email,))
        if cursor.fetchone():
            return func.HttpResponse(
                json.dumps({"error": "A user with this email already exists"}),
                status_code=409,
                mimetype="application/json"
            )

        password_hash = hash_password(password)
        cursor.execute(
            """INSERT INTO distribution.users (email, full_name, password_hash, role, status, azure_b2c_id)
               VALUES (%s, %s, %s, %s, 'active', %s)
               RETURNING id""",
            (email, full_name, password_hash, role, email)
        )
        new_id = cursor.fetchone()[0]
        conn.commit()

        return func.HttpResponse(
            json.dumps({"id": new_id, "message": "User registered successfully"}),
            status_code=201,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Registration error: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )

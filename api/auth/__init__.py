import json
import logging
import uuid
import azure.functions as func
from shared.db import get_connection
from shared.auth import create_token

app = func.FunctionApp()


@app.route(route="auth/login", methods=["POST"], auth_level="anonymous")
def login(req: func.HttpRequest) -> func.HttpResponse:
    """Login with email. Creates user if not exists."""
    try:
        body = req.get_json()
        email = body.get("email", "").strip().lower()
        if not email:
            return func.HttpResponse(
                json.dumps({"error": "Email is required"}),
                status_code=400,
                mimetype="application/json"
            )

        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, email, full_name, role, status FROM distribution.users WHERE email = %s",
            (email,)
        )
        row = cursor.fetchone()

        if not row:
            cursor.execute(
                """INSERT INTO distribution.users (email, full_name, role, status, azure_b2c_id)
                   VALUES (%s, %s, 'seller', 'active', %s)
                   RETURNING id, email, full_name, role, status""",
                (email, email.split("@")[0], str(uuid.uuid4()))
            )
            row = cursor.fetchone()
            conn.commit()

        user_id, user_email, full_name, role, status = row

        if status != "active":
            return func.HttpResponse(
                json.dumps({"error": "Account is inactive. Contact your administrator."}),
                status_code=403,
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

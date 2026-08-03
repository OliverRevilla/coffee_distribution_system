import json
import logging
import azure.functions as func
from shared.auth import require_admin
from shared.db import get_connection

app = func.FunctionApp()


@app.route(route="sellers", methods=["GET"], auth_level="anonymous")
@require_admin
def list_sellers(req: func.HttpRequest) -> func.HttpResponse:
    """List all sellers (admin only)."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, email, full_name, role, status, azure_b2c_id, created_at
            FROM distribution.users
            WHERE role = 'seller'
            ORDER BY full_name
        """)
        columns = [desc[0] for desc in cursor.description]
        sellers = [dict(zip(columns, row)) for row in cursor.fetchall()]

        for seller in sellers:
            if seller.get("created_at"):
                seller["created_at"] = seller["created_at"].isoformat()

        return func.HttpResponse(
            json.dumps({"sellers": sellers}),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error listing sellers: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )


@app.route(route="sellers", methods=["POST"], auth_level="anonymous")
@require_admin
def create_seller(req: func.HttpRequest) -> func.HttpResponse:
    """Create a new seller (admin only)."""
    try:
        body = req.get_json()
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO distribution.users (email, full_name, role, status, azure_b2c_id)
            VALUES (%s, %s, 'seller', 'active', %s)
            RETURNING id
        """, (body["email"], body["full_name"], body.get("azure_b2c_id") or body["email"]))
        new_id = cursor.fetchone()[0]
        conn.commit()
        return func.HttpResponse(
            json.dumps({"id": new_id, "message": "Seller created"}),
            status_code=201,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error creating seller: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )


@app.route(route="sellers/{id}", methods=["PUT"], auth_level="anonymous")
@require_admin
def update_seller(req: func.HttpRequest) -> func.HttpResponse:
    """Update a seller (admin only)."""
    seller_id = req.route_params.get("id")
    try:
        body = req.get_json()
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE distribution.users
            SET email = %s, full_name = %s
            WHERE id = %s AND role = 'seller'
        """, (body.get("email"), body.get("full_name"), seller_id))
        conn.commit()
        if cursor.rowcount == 0:
            return func.HttpResponse(
                json.dumps({"error": "Seller not found"}),
                status_code=404,
                mimetype="application/json"
            )
        return func.HttpResponse(
            json.dumps({"message": "Seller updated"}),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error updating seller: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )


@app.route(route="sellers/{id}/status", methods=["PUT"], auth_level="anonymous")
@require_admin
def update_seller_status(req: func.HttpRequest) -> func.HttpResponse:
    """Activate/deactivate a seller (admin only)."""
    seller_id = req.route_params.get("id")
    try:
        body = req.get_json()
        new_status = body.get("status")
        if new_status not in ("active", "inactive"):
            return func.HttpResponse(
                json.dumps({"error": "Invalid status. Must be 'active' or 'inactive'"}),
                status_code=400,
                mimetype="application/json"
            )
        
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE distribution.users
            SET status = %s
            WHERE id = %s AND role = 'seller'
        """, (new_status, seller_id))
        conn.commit()
        if cursor.rowcount == 0:
            return func.HttpResponse(
                json.dumps({"error": "Seller not found"}),
                status_code=404,
                mimetype="application/json"
            )
        return func.HttpResponse(
            json.dumps({"message": f"Seller status updated to {new_status}"}),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error updating seller status: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )

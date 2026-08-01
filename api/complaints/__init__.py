import json
import logging
import azure.functions as func
from shared.auth import require_auth, require_admin
from shared.db import get_connection

app = func.FunctionApp()


@app.route(route="complaints", methods=["GET"], auth_level="anonymous")
@require_auth
def list_complaints(req: func.HttpRequest) -> func.HttpResponse:
    """List complaints. Sellers see only their own, admins see all."""
    user = req.route_data.get("user", {})
    try:
        conn = get_connection()
        cursor = conn.cursor()
        is_admin = user.get("role") == "admin"

        if is_admin:
            cursor.execute("""
                SELECT c.id, c.seller_id, u.full_name as seller_name,
                       c.customer_name, c.subject, c.description,
                       c.category, c.status, c.priority,
                       c.created_at, c.resolved_at, c.resolution_notes
                FROM distribution.complaints c
                JOIN distribution.users u ON c.seller_id = u.id
                ORDER BY c.created_at DESC
            """)
        else:
            cursor.execute("""
                SELECT c.id, c.seller_id, u.full_name as seller_name,
                       c.customer_name, c.subject, c.description,
                       c.category, c.status, c.priority,
                       c.created_at, c.resolved_at, c.resolution_notes
                FROM distribution.complaints c
                JOIN distribution.users u ON c.seller_id = u.id
                WHERE c.seller_id = %s
                ORDER BY c.created_at DESC
            """, (user.get("user_id"),))

        columns = [desc[0] for desc in cursor.description]
        complaints = [dict(zip(columns, row)) for row in cursor.fetchall()]

        for complaint in complaints:
            if complaint.get("created_at"):
                complaint["created_at"] = complaint["created_at"].isoformat()
            if complaint.get("resolved_at"):
                complaint["resolved_at"] = complaint["resolved_at"].isoformat()

        return func.HttpResponse(
            json.dumps({"complaints": complaints}),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error listing complaints: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )


@app.route(route="complaints", methods=["POST"], auth_level="anonymous")
@require_auth
def create_complaint(req: func.HttpRequest) -> func.HttpResponse:
    """Submit a new complaint (sellers only)."""
    user = req.route_data.get("user", {})
    try:
        body = req.get_json()
        seller_id = user.get("user_id")

        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO distribution.complaints (seller_id, customer_name, subject, description,
                                   category, priority)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (seller_id, body.get("customer_name"), body["subject"],
              body["description"], body.get("category", "other"),
              body.get("priority", "medium")))
        new_id = cursor.fetchone()[0]
        conn.commit()

        return func.HttpResponse(
            json.dumps({"id": new_id, "message": "Complaint submitted"}),
            status_code=201,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error creating complaint: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )


@app.route(route="complaints/{id}", methods=["PUT"], auth_level="anonymous")
@require_admin
def update_complaint(req: func.HttpRequest) -> func.HttpResponse:
    """Update complaint status (admin only)."""
    complaint_id = req.route_params.get("id")
    try:
        body = req.get_json()
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE distribution.complaints
            SET status = %s, priority = %s, resolution_notes = %s
            WHERE id = %s
        """, (body.get("status"), body.get("priority"),
              body.get("resolution_notes"), complaint_id))
        conn.commit()
        if cursor.rowcount == 0:
            return func.HttpResponse(
                json.dumps({"error": "Complaint not found"}),
                status_code=404,
                mimetype="application/json"
            )
        return func.HttpResponse(
            json.dumps({"message": "Complaint updated"}),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error updating complaint: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )


@app.route(route="complaints/{id}/resolve", methods=["PUT"], auth_level="anonymous")
@require_admin
def resolve_complaint(req: func.HttpRequest) -> func.HttpResponse:
    """Resolve a complaint (admin only)."""
    complaint_id = req.route_params.get("id")
    try:
        body = req.get_json()
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE distribution.complaints
            SET status = 'resolved', resolved_at = NOW(),
                resolution_notes = %s
            WHERE id = %s
        """, (body.get("resolution_notes", ""), complaint_id))
        conn.commit()
        if cursor.rowcount == 0:
            return func.HttpResponse(
                json.dumps({"error": "Complaint not found"}),
                status_code=404,
                mimetype="application/json"
            )
        return func.HttpResponse(
            json.dumps({"message": "Complaint resolved"}),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error resolving complaint: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )

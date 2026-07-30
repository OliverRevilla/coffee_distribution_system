import json
import logging
import azure.functions as func
from shared.auth import require_auth, require_admin
from shared.db import get_connection

app = func.FunctionApp()


@app.route(route="variants", methods=["GET"], auth_level="anonymous")
@require_auth
def list_variants(req: func.HttpRequest) -> func.HttpResponse:
    """List all coffee variants (all authenticated users)."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, name, description, sku, price, image_url, is_active, created_at
            FROM CoffeeVariants
            WHERE is_active = 1
            ORDER BY name
        """)
        columns = [desc[0] for desc in cursor.description]
        variants = [dict(zip(columns, row)) for row in cursor.fetchall()]

        for v in variants:
            if v.get("created_at"):
                v["created_at"] = v["created_at"].isoformat()

        return func.HttpResponse(
            json.dumps({"variants": variants}),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error listing variants: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )


@app.route(route="variants", methods=["POST"], auth_level="anonymous")
@require_admin
def create_variant(req: func.HttpRequest) -> func.HttpResponse:
    """Add a new coffee variant (admin only)."""
    try:
        body = req.get_json()
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO CoffeeVariants (name, description, sku, price, image_url)
            VALUES (?, ?, ?, ?, ?)
        """, body["name"], body.get("description"), body["sku"],
           body["price"], body.get("image_url"))
        conn.commit()
        new_id = cursor.execute("SELECT SCOPE_IDENTITY()").fetchone()[0]
        return func.HttpResponse(
            json.dumps({"id": new_id, "message": "Variant created"}),
            status_code=201,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error creating variant: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )

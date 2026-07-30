import json
import logging
import azure.functions as func
from shared.auth import require_admin, get_user_from_request
from shared.db import get_connection

app = func.FunctionApp()


@app.route(route="inventory", methods=["GET"], auth_level="anonymous")
@require_admin
def list_inventory(req: func.HttpRequest) -> func.HttpResponse:
    """List all inventory items (admin only)."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT i.id, i.variant_id, cv.name, cv.sku, i.quantity,
                   i.warehouse_location, i.reorder_point, i.last_updated
            FROM Inventory i
            JOIN CoffeeVariants cv ON i.variant_id = cv.id
            ORDER BY cv.name
        """)
        columns = [desc[0] for desc in cursor.description]
        items = [dict(zip(columns, row)) for row in cursor.fetchall()]

        # Convert datetime objects to strings
        for item in items:
            if item.get("last_updated"):
                item["last_updated"] = item["last_updated"].isoformat()

        return func.HttpResponse(
            json.dumps({"items": items}),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error listing inventory: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )


@app.route(route="inventory/{id}", methods=["GET"], auth_level="anonymous")
@require_admin
def get_inventory(req: func.HttpRequest) -> func.HttpResponse:
    """Get a single inventory item by ID (admin only)."""
    item_id = req.route_params.get("id")
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT i.id, i.variant_id, cv.name, cv.sku, i.quantity,
                   i.warehouse_location, i.reorder_point, i.last_updated
            FROM Inventory i
            JOIN CoffeeVariants cv ON i.variant_id = cv.id
            WHERE i.id = ?
        """, item_id)
        columns = [desc[0] for desc in cursor.description]
        row = cursor.fetchone()
        if not row:
            return func.HttpResponse(
                json.dumps({"error": "Item not found"}),
                status_code=404,
                mimetype="application/json"
            )
        item = dict(zip(columns, row))
        if item.get("last_updated"):
            item["last_updated"] = item["last_updated"].isoformat()

        return func.HttpResponse(
            json.dumps(item),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error getting inventory: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )


@app.route(route="inventory", methods=["POST"], auth_level="anonymous")
@require_admin
def create_inventory(req: func.HttpRequest) -> func.HttpResponse:
    """Create a new inventory item (admin only)."""
    try:
        body = req.get_json()
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO Inventory (variant_id, quantity, warehouse_location, reorder_point, updated_by)
            VALUES (?, ?, ?, ?, ?)
        """, body["variant_id"], body.get("quantity", 0),
           body.get("warehouse_location"), body.get("reorder_point", 10),
           body.get("updated_by"))
        conn.commit()
        new_id = cursor.execute("SELECT SCOPE_IDENTITY()").fetchone()[0]
        return func.HttpResponse(
            json.dumps({"id": new_id, "message": "Inventory item created"}),
            status_code=201,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error creating inventory: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )


@app.route(route="inventory/{id}", methods=["PUT"], auth_level="anonymous")
@require_admin
def update_inventory(req: func.HttpRequest) -> func.HttpResponse:
    """Update an inventory item (admin only)."""
    item_id = req.route_params.get("id")
    try:
        body = req.get_json()
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE Inventory
            SET quantity = ?, warehouse_location = ?, reorder_point = ?,
                last_updated = SYSUTCDATETIME(), updated_by = ?
            WHERE id = ?
        """, body.get("quantity"), body.get("warehouse_location"),
           body.get("reorder_point"), body.get("updated_by"), item_id)
        conn.commit()
        if cursor.rowcount == 0:
            return func.HttpResponse(
                json.dumps({"error": "Item not found"}),
                status_code=404,
                mimetype="application/json"
            )
        return func.HttpResponse(
            json.dumps({"message": "Inventory item updated"}),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error updating inventory: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )

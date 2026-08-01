import json
import logging
import azure.functions as func
from shared.auth import require_auth
from shared.db import get_connection

app = func.FunctionApp()


@app.route(route="sales", methods=["GET"], auth_level="anonymous")
@require_auth
def list_sales(req: func.HttpRequest) -> func.HttpResponse:
    """List sales. Sellers see only their own, admins see all."""
    user = req.route_data.get("user", {})
    try:
        conn = get_connection()
        cursor = conn.cursor()

        is_admin = user.get("role") == "admin"

        if is_admin:
            cursor.execute("""
                SELECT s.id, s.seller_id, u.full_name as seller_name,
                       s.variant_id, cv.name as variant_name, cv.sku,
                       s.quantity, s.unit_price, s.total_amount,
                       s.customer_name, s.customer_address,
                       s.gps_latitude, s.gps_longitude, s.sale_date, s.notes
                FROM distribution.sales s
                JOIN distribution.users u ON s.seller_id = u.id
                JOIN distribution.coffee_variants cv ON s.variant_id = cv.id
                ORDER BY s.sale_date DESC
            """)
        else:
            cursor.execute("""
                SELECT s.id, s.seller_id, u.full_name as seller_name,
                       s.variant_id, cv.name as variant_name, cv.sku,
                       s.quantity, s.unit_price, s.total_amount,
                       s.customer_name, s.customer_address,
                       s.gps_latitude, s.gps_longitude, s.sale_date, s.notes
                FROM distribution.sales s
                JOIN distribution.users u ON s.seller_id = u.id
                JOIN distribution.coffee_variants cv ON s.variant_id = cv.id
                WHERE s.seller_id = %s
                ORDER BY s.sale_date DESC
            """, (user.get("user_id"),))

        columns = [desc[0] for desc in cursor.description]
        sales = [dict(zip(columns, row)) for row in cursor.fetchall()]

        for sale in sales:
            if sale.get("sale_date"):
                sale["sale_date"] = sale["sale_date"].isoformat()

        return func.HttpResponse(
            json.dumps({"sales": sales}),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error listing sales: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )


@app.route(route="sales", methods=["POST"], auth_level="anonymous")
@require_auth
def create_sale(req: func.HttpRequest) -> func.HttpResponse:
    """Register a new sale (sellers only)."""
    user = req.route_data.get("user", {})
    try:
        body = req.get_json()
        seller_id = user.get("user_id")
        variant_id = body["variant_id"]
        quantity = body["quantity"]

        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT price FROM distribution.coffee_variants WHERE id = %s", (variant_id,))
        variant = cursor.fetchone()
        if not variant:
            return func.HttpResponse(
                json.dumps({"error": "Variant not found"}),
                status_code=404,
                mimetype="application/json"
            )

        unit_price = variant[0]
        total_amount = unit_price * quantity

        cursor.execute("""
            INSERT INTO distribution.sales (seller_id, variant_id, quantity, unit_price, total_amount,
                             customer_name, customer_address, gps_latitude, gps_longitude, notes)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (seller_id, variant_id, quantity, unit_price, total_amount,
              body.get("customer_name"), body.get("customer_address"),
              body.get("gps_latitude"), body.get("gps_longitude"), body.get("notes")))
        new_id = cursor.fetchone()[0]
        conn.commit()

        return func.HttpResponse(
            json.dumps({"id": new_id, "total_amount": total_amount, "message": "Sale registered"}),
            status_code=201,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error creating sale: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )


@app.route(route="sales/{id}", methods=["GET"], auth_level="anonymous")
@require_auth
def get_sale(req: func.HttpRequest) -> func.HttpResponse:
    """Get a single sale by ID."""
    sale_id = req.route_params.get("id")
    user = req.route_data.get("user", {})
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT s.id, s.seller_id, u.full_name as seller_name,
                   s.variant_id, cv.name as variant_name, cv.sku,
                   s.quantity, s.unit_price, s.total_amount,
                   s.customer_name, s.customer_address,
                   s.gps_latitude, s.gps_longitude, s.sale_date, s.notes
            FROM distribution.sales s
            JOIN distribution.users u ON s.seller_id = u.id
            JOIN distribution.coffee_variants cv ON s.variant_id = cv.id
            WHERE s.id = %s
        """, (sale_id,))
        columns = [desc[0] for desc in cursor.description]
        row = cursor.fetchone()
        if not row:
            return func.HttpResponse(
                json.dumps({"error": "Sale not found"}),
                status_code=404,
                mimetype="application/json"
            )
        sale = dict(zip(columns, row))
        if user.get("role") != "admin" and sale["seller_id"] != user.get("user_id"):
            return func.HttpResponse(
                json.dumps({"error": "Forbidden"}),
                status_code=403,
                mimetype="application/json"
            )
        if sale.get("sale_date"):
            sale["sale_date"] = sale["sale_date"].isoformat()

        return func.HttpResponse(
            json.dumps(sale),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error getting sale: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )

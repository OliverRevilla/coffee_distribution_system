#!/usr/bin/env python3
"""Flask API server for Cafe Distribution System."""

import os
import json
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS

from shared.db import get_connection, close_connection
from shared.auth import (
    hash_password, verify_password, create_token, verify_token
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)


@app.teardown_appcontext
def shutdown_session(exception=None):
    """Ensure connection is properly cleaned up."""
    pass


# ──────────────────────────────────────────────
# Auth helpers
# ──────────────────────────────────────────────

def get_current_user():
    auth_header = request.headers.get("Authorization", "")
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


def require_auth(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Unauthorized"}), 401
        request.user = user
        return f(*args, **kwargs)
    return decorated


def require_admin(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Unauthorized"}), 401
        if user.get("role") != "admin":
            return jsonify({"error": "Forbidden: admin role required"}), 403
        request.user = user
        return f(*args, **kwargs)
    return decorated


# ──────────────────────────────────────────────
# Auth routes
# ──────────────────────────────────────────────

@app.route("/api/auth/login", methods=["POST"])
def login():
    body = request.get_json()
    email = body.get("email", "").strip().lower()
    password = body.get("password", "")

    if not email:
        return jsonify({"error": "Email is required"}), 400
    if not password:
        return jsonify({"error": "Password is required"}), 400

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, email, full_name, role, status, password_hash FROM distribution.users WHERE email = %s",
        (email,)
    )
    row = cursor.fetchone()

    if not row:
        return jsonify({"error": "Invalid email or password"}), 401

    user_id, user_email, full_name, role, status, password_hash = row

    if status != "active":
        return jsonify({"error": "Account is inactive. Contact your administrator."}), 403

    if not password_hash or not verify_password(password, password_hash):
        return jsonify({"error": "Invalid email or password"}), 401

    token = create_token(user_id, user_email, role, full_name)

    return jsonify({
        "token": token,
        "user": {
            "user_id": user_id,
            "email": user_email,
            "name": full_name,
            "role": role
        }
    })


@app.route("/api/auth/register/seller", methods=["POST"])
def register_seller():
    body = request.get_json()
    email = body.get("email", "").strip().lower()
    password = body.get("password", "")
    full_name = body.get("full_name", "").strip()

    if not email:
        return jsonify({"error": "Email is required"}), 400
    if not password or len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    if not full_name:
        return jsonify({"error": "Full name is required"}), 400

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM distribution.users WHERE email = %s", (email,))
    if cursor.fetchone():
        return jsonify({"error": "A user with this email already exists"}), 409

    password_hash = hash_password(password)
    cursor.execute(
        """INSERT INTO distribution.users (email, full_name, password_hash, role, status, azure_b2c_id)
           VALUES (%s, %s, %s, 'seller', 'active', %s)
           RETURNING id""",
        (email, full_name, password_hash, email)
    )
    new_id = cursor.fetchone()[0]
    conn.commit()

    return jsonify({"id": new_id, "message": "Seller registered successfully"}), 201


@app.route("/api/auth/register", methods=["POST"])
@require_admin
def register():
    body = request.get_json()
    email = body.get("email", "").strip().lower()
    password = body.get("password", "")
    full_name = body.get("full_name", "").strip()
    role = body.get("role", "seller")

    if not email:
        return jsonify({"error": "Email is required"}), 400
    if not password or len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    if not full_name:
        return jsonify({"error": "Full name is required"}), 400
    if role not in ("admin", "seller"):
        return jsonify({"error": "Role must be 'admin' or 'seller'"}), 400

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM distribution.users WHERE email = %s", (email,))
    if cursor.fetchone():
        return jsonify({"error": "A user with this email already exists"}), 409

    password_hash = hash_password(password)
    cursor.execute(
        """INSERT INTO distribution.users (email, full_name, password_hash, role, status, azure_b2c_id)
           VALUES (%s, %s, %s, %s, 'active', %s)
           RETURNING id""",
        (email, full_name, password_hash, role, email)
    )
    new_id = cursor.fetchone()[0]
    conn.commit()

    return jsonify({"id": new_id, "message": "User registered successfully"}), 201


# ──────────────────────────────────────────────
# Sellers routes
# ──────────────────────────────────────────────

@app.route("/api/sellers", methods=["GET"])
@require_admin
def list_sellers():
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
    for s in sellers:
        if s.get("created_at"):
            s["created_at"] = s["created_at"].isoformat()
    return jsonify({"sellers": sellers})


@app.route("/api/sellers", methods=["POST"])
@require_admin
def create_seller():
    body = request.get_json()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO distribution.users (email, full_name, role, status, azure_b2c_id)
        VALUES (%s, %s, 'seller', 'active', %s)
        RETURNING id
    """, (body["email"], body["full_name"], body.get("azure_b2c_id") or body["email"]))
    new_id = cursor.fetchone()[0]
    conn.commit()
    return jsonify({"id": new_id, "message": "Seller created"}), 201


@app.route("/api/sellers/<int:seller_id>", methods=["PUT"])
@require_admin
def update_seller(seller_id):
    body = request.get_json()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE distribution.users
        SET email = %s, full_name = %s
        WHERE id = %s AND role = 'seller'
    """, (body.get("email"), body.get("full_name"), seller_id))
    conn.commit()
    if cursor.rowcount == 0:
        return jsonify({"error": "Seller not found"}), 404
    return jsonify({"message": "Seller updated"})


@app.route("/api/sellers/<int:seller_id>/status", methods=["PUT"])
@require_admin
def update_seller_status(seller_id):
    body = request.get_json()
    new_status = body.get("status")
    if new_status not in ("active", "inactive"):
        return jsonify({"error": "Invalid status. Must be 'active' or 'inactive'"}), 400

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE distribution.users
        SET status = %s
        WHERE id = %s AND role = 'seller'
    """, (new_status, seller_id))
    conn.commit()
    if cursor.rowcount == 0:
        return jsonify({"error": "Seller not found"}), 404
    return jsonify({"message": f"Seller status updated to {new_status}"})


# ──────────────────────────────────────────────
# Inventory routes
# ──────────────────────────────────────────────

@app.route("/api/inventory", methods=["GET"])
@require_admin
def list_inventory():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT i.id, i.variant_id, cv.name, cv.sku, cv.category, i.quantity,
               i.warehouse_location, i.reorder_point, i.last_updated
        FROM distribution.inventory i
        JOIN distribution.coffee_variants cv ON i.variant_id = cv.id
        ORDER BY cv.category, cv.name
    """)
    columns = [desc[0] for desc in cursor.description]
    items = [dict(zip(columns, row)) for row in cursor.fetchall()]
    for item in items:
        if item.get("last_updated"):
            item["last_updated"] = item["last_updated"].isoformat()
    return jsonify({"items": items})


@app.route("/api/inventory/<int:item_id>", methods=["GET"])
@require_admin
def get_inventory(item_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT i.id, i.variant_id, cv.name, cv.sku, i.quantity,
               i.warehouse_location, i.reorder_point, i.last_updated
        FROM distribution.inventory i
        JOIN distribution.coffee_variants cv ON i.variant_id = cv.id
        WHERE i.id = %s
    """, (item_id,))
    columns = [desc[0] for desc in cursor.description]
    row = cursor.fetchone()
    if not row:
        return jsonify({"error": "Item not found"}), 404
    item = dict(zip(columns, row))
    if item.get("last_updated"):
        item["last_updated"] = item["last_updated"].isoformat()
    return jsonify(item)


@app.route("/api/inventory", methods=["POST"])
@require_admin
def create_inventory():
    body = request.get_json()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO distribution.inventory (variant_id, quantity, warehouse_location, reorder_point, updated_by)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id
    """, (body["variant_id"], body.get("quantity", 0),
          body.get("warehouse_location"), body.get("reorder_point", 10),
          body.get("updated_by")))
    new_id = cursor.fetchone()[0]
    conn.commit()
    return jsonify({"id": new_id, "message": "Inventory item created"}), 201


@app.route("/api/inventory/<int:item_id>", methods=["PUT"])
@require_admin
def update_inventory(item_id):
    body = request.get_json()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE distribution.inventory
        SET quantity = %s, warehouse_location = %s, reorder_point = %s,
            last_updated = NOW(), updated_by = %s
        WHERE id = %s
    """, (body.get("quantity"), body.get("warehouse_location"),
          body.get("reorder_point"), body.get("updated_by"), item_id))
    conn.commit()
    if cursor.rowcount == 0:
        return jsonify({"error": "Item not found"}), 404
    return jsonify({"message": "Inventory item updated"})


# ──────────────────────────────────────────────
# Variants routes
# ──────────────────────────────────────────────

@app.route("/api/variants", methods=["GET"])
@require_auth
def list_variants():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, description, sku, price, category, image_url, is_active, created_at
        FROM distribution.coffee_variants
        WHERE is_active = TRUE
        ORDER BY category, name
    """)
    columns = [desc[0] for desc in cursor.description]
    variants = [dict(zip(columns, row)) for row in cursor.fetchall()]
    for v in variants:
        if v.get("created_at"):
            v["created_at"] = v["created_at"].isoformat()
    return jsonify({"variants": variants})


@app.route("/api/variants", methods=["POST"])
@require_admin
def create_variant():
    body = request.get_json()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO distribution.coffee_variants (name, description, sku, price, category, image_url)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (body["name"], body.get("description"), body["sku"],
          body["price"], body.get("category", "C"), body.get("image_url")))
    new_id = cursor.fetchone()[0]
    conn.commit()
    return jsonify({"id": new_id, "message": "Variant created"}), 201


# ──────────────────────────────────────────────
# Sales routes
# ──────────────────────────────────────────────

@app.route("/api/sales", methods=["GET"])
@require_auth
def list_sales():
    user = request.user
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
    return jsonify({"sales": sales})


@app.route("/api/sales", methods=["POST"])
@require_auth
def create_sale():
    user = request.user
    body = request.get_json()
    seller_id = user.get("user_id")
    variant_id = body["variant_id"]
    quantity = body["quantity"]

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT price FROM distribution.coffee_variants WHERE id = %s", (variant_id,))
    variant = cursor.fetchone()
    if not variant:
        return jsonify({"error": "Variant not found"}), 404

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

    return jsonify({"id": new_id, "total_amount": total_amount, "message": "Sale registered"}), 201


@app.route("/api/sales/<int:sale_id>", methods=["GET"])
@require_auth
def get_sale(sale_id):
    user = request.user
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
        return jsonify({"error": "Sale not found"}), 404
    sale = dict(zip(columns, row))
    if user.get("role") != "admin" and sale["seller_id"] != user.get("user_id"):
        return jsonify({"error": "Forbidden"}), 403
    if sale.get("sale_date"):
        sale["sale_date"] = sale["sale_date"].isoformat()
    return jsonify(sale)


# ──────────────────────────────────────────────
# Complaints routes
# ──────────────────────────────────────────────

@app.route("/api/complaints", methods=["GET"])
@require_auth
def list_complaints():
    user = request.user
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
    for c in complaints:
        if c.get("created_at"):
            c["created_at"] = c["created_at"].isoformat()
        if c.get("resolved_at"):
            c["resolved_at"] = c["resolved_at"].isoformat()
    return jsonify({"complaints": complaints})


@app.route("/api/complaints", methods=["POST"])
@require_auth
def create_complaint():
    user = request.user
    body = request.get_json()
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
    return jsonify({"id": new_id, "message": "Complaint submitted"}), 201


@app.route("/api/complaints/<int:complaint_id>", methods=["PUT"])
@require_admin
def update_complaint(complaint_id):
    body = request.get_json()
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
        return jsonify({"error": "Complaint not found"}), 404
    return jsonify({"message": "Complaint updated"})


@app.route("/api/complaints/<int:complaint_id>/resolve", methods=["PUT"])
@require_admin
def resolve_complaint(complaint_id):
    body = request.get_json()
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
        return jsonify({"error": "Complaint not found"}), 404
    return jsonify({"message": "Complaint resolved"})


# ──────────────────────────────────────────────
# Routes (delivery) routes
# ──────────────────────────────────────────────

@app.route("/api/routes", methods=["GET"])
@require_auth
def list_routes():
    user = request.user
    conn = get_connection()
    cursor = conn.cursor()
    is_admin = user.get("role") == "admin"

    if is_admin:
        cursor.execute("""
            SELECT r.id, r.name, r.description, r.assigned_seller_id,
                   u.full_name as seller_name, r.status, r.route_date, r.created_at
            FROM distribution.routes r
            LEFT JOIN distribution.users u ON r.assigned_seller_id = u.id
            ORDER BY r.route_date DESC
        """)
    else:
        cursor.execute("""
            SELECT r.id, r.name, r.description, r.assigned_seller_id,
                   u.full_name as seller_name, r.status, r.route_date, r.created_at
            FROM distribution.routes r
            LEFT JOIN distribution.users u ON r.assigned_seller_id = u.id
            WHERE r.assigned_seller_id = %s
            ORDER BY r.route_date DESC
        """, (user.get("user_id"),))

    columns = [desc[0] for desc in cursor.description]
    routes = [dict(zip(columns, row)) for row in cursor.fetchall()]
    for r in routes:
        if r.get("route_date"):
            r["route_date"] = r["route_date"].isoformat()
        if r.get("created_at"):
            r["created_at"] = r["created_at"].isoformat()
    return jsonify({"routes": routes})


@app.route("/api/routes", methods=["POST"])
@require_admin
def create_route():
    body = request.get_json()
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO distribution.routes (name, description, assigned_seller_id, route_date)
        VALUES (%s, %s, %s, %s)
        RETURNING id
    """, (body["name"], body.get("description"),
          body.get("assigned_seller_id"), body["route_date"]))
    route_id = cursor.fetchone()[0]

    waypoints = body.get("waypoints", [])
    for i, wp in enumerate(waypoints):
        cursor.execute("""
            INSERT INTO distribution.route_waypoints (route_id, sequence, customer_name, address,
                                       latitude, longitude, estimated_arrival)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (route_id, i + 1, wp.get("customer_name"), wp.get("address"),
              wp["latitude"], wp["longitude"], wp.get("estimated_arrival")))
    conn.commit()
    return jsonify({"id": route_id, "message": "Route created"}), 201


@app.route("/api/routes/<int:route_id>/assign", methods=["PUT"])
@require_admin
def assign_route(route_id):
    body = request.get_json()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE distribution.routes
        SET assigned_seller_id = %s, status = 'pending'
        WHERE id = %s
    """, (body["seller_id"], route_id))
    conn.commit()
    if cursor.rowcount == 0:
        return jsonify({"error": "Route not found"}), 404
    return jsonify({"message": "Route assigned"})


@app.route("/api/routes/<int:route_id>/checkin", methods=["POST"])
@require_auth
def checkin_waypoint(route_id):
    user = request.user
    body = request.get_json()
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT assigned_seller_id FROM distribution.routes WHERE id = %s", (route_id,))
    route = cursor.fetchone()
    if not route or route[0] != user.get("user_id"):
        return jsonify({"error": "Route not found or not assigned to you"}), 403

    cursor.execute("""
        UPDATE distribution.route_waypoints
        SET status = 'visited', actual_arrival = NOW()
        WHERE route_id = %s AND id = %s
    """, (route_id, body["waypoint_id"]))
    conn.commit()
    return jsonify({"message": "Checked in successfully"})


# ──────────────────────────────────────────────
# Tracking routes
# ──────────────────────────────────────────────

@app.route("/api/tracking/location", methods=["POST"])
@require_auth
def update_location():
    user = request.user
    body = request.get_json()
    seller_id = user.get("user_id")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO distribution.gps_locations (seller_id, latitude, longitude, accuracy)
        VALUES (%s, %s, %s, %s)
    """, (seller_id, body["latitude"], body["longitude"], body.get("accuracy")))
    conn.commit()
    return jsonify({"message": "Location updated"}), 201


@app.route("/api/tracking/seller/<int:seller_id>", methods=["GET"])
@require_admin
def get_seller_locations(seller_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, seller_id, latitude, longitude, accuracy, timestamp
        FROM distribution.gps_locations
        WHERE seller_id = %s
        ORDER BY timestamp DESC
        LIMIT 100
    """, (seller_id,))
    columns = [desc[0] for desc in cursor.description]
    locations = [dict(zip(columns, row)) for row in cursor.fetchall()]
    for loc in locations:
        if loc.get("timestamp"):
            loc["timestamp"] = loc["timestamp"].isoformat()
    return jsonify({"locations": locations})


@app.route("/api/tracking/seller/<int:seller_id>/latest", methods=["GET"])
@require_admin
def get_seller_latest_location(seller_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, seller_id, latitude, longitude, accuracy, timestamp
        FROM distribution.gps_locations
        WHERE seller_id = %s
        ORDER BY timestamp DESC
        LIMIT 1
    """, (seller_id,))
    columns = [desc[0] for desc in cursor.description]
    row = cursor.fetchone()
    if not row:
        return jsonify({"error": "No location data found"}), 404
    location = dict(zip(columns, row))
    if location.get("timestamp"):
        location["timestamp"] = location["timestamp"].isoformat()
    return jsonify(location)


# ──────────────────────────────────────────────
# Reports routes
# ──────────────────────────────────────────────

@app.route("/api/reports/sales", methods=["GET"])
@require_admin
def sales_report():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT u.full_name, COUNT(*) as total_sales, SUM(s.total_amount) as total_revenue
        FROM distribution.sales s
        JOIN distribution.users u ON s.seller_id = u.id
        GROUP BY u.full_name
        ORDER BY total_revenue DESC
    """)
    by_seller = [{"seller": row[0], "total_sales": row[1], "total_revenue": float(row[2])}
                 for row in cursor.fetchall()]

    cursor.execute("""
        SELECT cv.name, cv.sku, SUM(s.quantity) as total_quantity,
               SUM(s.total_amount) as total_revenue
        FROM distribution.sales s
        JOIN distribution.coffee_variants cv ON s.variant_id = cv.id
        GROUP BY cv.name, cv.sku
        ORDER BY total_revenue DESC
    """)
    by_variant = [{"variant": row[0], "sku": row[1], "total_quantity": row[2],
                   "total_revenue": float(row[3])} for row in cursor.fetchall()]

    cursor.execute("""
        SELECT sale_date::date as sale_day, COUNT(*) as total_sales,
               SUM(total_amount) as total_revenue
        FROM distribution.sales
        WHERE sale_date >= NOW() - INTERVAL '30 days'
        GROUP BY sale_date::date
        ORDER BY sale_day DESC
    """)
    by_date = [{"date": row[0].isoformat() if row[0] else None, "total_sales": row[1],
                "total_revenue": float(row[2])} for row in cursor.fetchall()]

    cursor.execute("""
        SELECT COUNT(*) as total_sales, COALESCE(SUM(total_amount), 0) as total_revenue
        FROM distribution.sales
    """)
    overall = cursor.fetchone()
    summary = {"total_sales": overall[0], "total_revenue": float(overall[1])}

    return jsonify({
        "summary": summary,
        "by_seller": by_seller,
        "by_variant": by_variant,
        "by_date": by_date
    })


# ──────────────────────────────────────────────
# Run
# ──────────────────────────────────────────────

if __name__ == "__main__":
    app.run(debug=True, port=7071)

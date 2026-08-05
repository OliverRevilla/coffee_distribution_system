#!/usr/bin/env python3
"""Flask API server for Cafe Distribution System."""

import logging
from dotenv import load_dotenv

load_dotenv()

from flask import Flask, request, jsonify  # noqa: E402
from flask_cors import CORS  # noqa: E402
from datetime import datetime, timezone  # noqa: E402

from shared.db import get_connection, close_connection  # noqa: E402
from shared.auth import (  # noqa: E402
    hash_password, verify_password, create_token, verify_token
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/api/*": {
    "origins": [
        "https://gray-plant-0f392e01e.7.azurestaticapps.net",
        "http://localhost:5173",
    ],
    "supports_credentials": True,
    "allow_headers": ["Content-Type", "Authorization"],
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}})


@app.teardown_appcontext
def shutdown_session(exception=None):
    """Ensure connection is properly cleaned up."""
    pass


@app.route("/api/health", methods=["GET"])
def health():
    """Health check endpoint for monitoring and liveness probes."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        close_connection(conn)
        return jsonify({
            "status": "ok",
            "db": "connected",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            "status": "error",
            "db": "disconnected",
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }), 503


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
    dni = body.get("dni", "").strip() or None
    phone = body.get("phone", "").strip() or None
    residency = body.get("residency", "").strip() or None

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
        """INSERT INTO distribution.users
           (email, full_name, password_hash, role, status, dni, phone, residency, azure_b2c_id)
           VALUES (%s, %s, %s, 'seller', 'active', %s, %s, %s, %s)
           RETURNING id""",
        (email, full_name, password_hash, dni, phone, residency, email)
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
    dni = body.get("dni", "").strip() or None
    phone = body.get("phone", "").strip() or None
    residency = body.get("residency", "").strip() or None

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
        """INSERT INTO distribution.users
           (email, full_name, password_hash, role, status, dni, phone, residency, azure_b2c_id)
           VALUES (%s, %s, %s, %s, 'active', %s, %s, %s, %s)
           RETURNING id""",
        (email, full_name, password_hash, role, dni, phone, residency, email)
    )
    new_id = cursor.fetchone()[0]
    conn.commit()

    return jsonify({"id": new_id, "message": "User registered successfully"}), 201


# ──────────────────────────────────────────────
# Profile routes
# ──────────────────────────────────────────────

@app.route("/api/profile", methods=["GET"])
@require_auth
def get_profile():
    user = request.user
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, email, full_name, role, status, dni, phone, residency, created_at
        FROM distribution.users WHERE id = %s
    """, (user.get("user_id"),))
    columns = [desc[0] for desc in cursor.description]
    row = cursor.fetchone()
    close_connection(conn)
    if not row:
        return jsonify({"error": "User not found"}), 404
    profile = dict(zip(columns, row))
    if profile.get("created_at"):
        profile["created_at"] = profile["created_at"].isoformat()
    return jsonify(profile)


@app.route("/api/profile", methods=["PUT"])
@require_auth
def update_profile():
    user = request.user
    body = request.get_json()
    full_name = body.get("full_name", "").strip()
    dni = body.get("dni", "").strip() or None
    phone = body.get("phone", "").strip() or None
    residency = body.get("residency", "").strip() or None

    if not full_name:
        return jsonify({"error": "Full name is required"}), 400

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE distribution.users
        SET full_name = %s, dni = %s, phone = %s, residency = %s
        WHERE id = %s
    """, (full_name, dni, phone, residency, user.get("user_id")))
    conn.commit()
    close_connection(conn)
    return jsonify({"message": "Profile updated"})


@app.route("/api/profile/password", methods=["PUT"])
@require_auth
def change_password():
    user = request.user
    body = request.get_json()
    current_password = body.get("current_password", "")
    new_password = body.get("new_password", "")

    if not current_password:
        return jsonify({"error": "Current password is required"}), 400
    if not new_password or len(new_password) < 6:
        return jsonify({"error": "New password must be at least 6 characters"}), 400

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT password_hash FROM distribution.users WHERE id = %s", (user.get("user_id"),))
    row = cursor.fetchone()
    if not row or not verify_password(current_password, row[0]):
        close_connection(conn)
        return jsonify({"error": "Current password is incorrect"}), 401

    new_hash = hash_password(new_password)
    cursor.execute("UPDATE distribution.users SET password_hash = %s WHERE id = %s",
                   (new_hash, user.get("user_id")))
    conn.commit()
    close_connection(conn)
    return jsonify({"message": "Password changed successfully"})


# ──────────────────────────────────────────────
# Sellers routes
# ──────────────────────────────────────────────

@app.route("/api/sellers", methods=["GET"])
@require_admin
def list_sellers():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, email, full_name, role, status, dni, phone, residency, azure_b2c_id, created_at
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
    dni = body.get("dni", "").strip() or None
    phone = body.get("phone", "").strip() or None
    residency = body.get("residency", "").strip() or None
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO distribution.users (email, full_name, role, status, dni, phone, residency, azure_b2c_id)
        VALUES (%s, %s, 'seller', 'active', %s, %s, %s, %s)
        RETURNING id
    """, (body["email"], body["full_name"], dni, phone, residency, body.get("azure_b2c_id") or body["email"]))
    new_id = cursor.fetchone()[0]
    conn.commit()
    return jsonify({"id": new_id, "message": "Seller created"}), 201


@app.route("/api/sellers/<int:seller_id>", methods=["PUT"])
@require_admin
def update_seller(seller_id):
    body = request.get_json()
    dni = body.get("dni", "").strip() or None
    phone = body.get("phone", "").strip() or None
    residency = body.get("residency", "").strip() or None
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE distribution.users
        SET email = %s, full_name = %s, dni = %s, phone = %s, residency = %s
        WHERE id = %s AND role = 'seller'
    """, (body.get("email"), body.get("full_name"), dni, phone, residency, seller_id))
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
# Customers routes
# ──────────────────────────────────────────────

@app.route("/api/customers", methods=["GET"])
@require_auth
def list_customers():
    user = request.user
    conn = get_connection()
    cursor = conn.cursor()
    is_admin = user.get("role") == "admin"

    if is_admin:
        cursor.execute("""
            SELECT c.id, c.seller_id, u.full_name as seller_name,
                   c.name, c.nickname, c.address, c.district, c.phone,
                   c.dni, c.ruc, c.payment_mode, c.cycle_days, c.is_active, c.created_at, c.updated_at
            FROM distribution.customers c
            JOIN distribution.users u ON c.seller_id = u.id
            WHERE c.is_active = TRUE
            ORDER BY c.name
        """)
    else:
        cursor.execute("""
            SELECT c.id, c.seller_id, u.full_name as seller_name,
                   c.name, c.nickname, c.address, c.district, c.phone,
                   c.dni, c.ruc, c.payment_mode, c.cycle_days, c.is_active, c.created_at, c.updated_at
            FROM distribution.customers c
            JOIN distribution.users u ON c.seller_id = u.id
            WHERE c.seller_id = %s AND c.is_active = TRUE
            ORDER BY c.name
        """, (user.get("user_id"),))

    columns = [desc[0] for desc in cursor.description]
    customers = [dict(zip(columns, row)) for row in cursor.fetchall()]
    for c in customers:
        if c.get("created_at"):
            c["created_at"] = c["created_at"].isoformat()
        if c.get("updated_at"):
            c["updated_at"] = c["updated_at"].isoformat()
    return jsonify({"customers": customers})


@app.route("/api/customers/<int:customer_id>", methods=["GET"])
@require_auth
def get_customer(customer_id):
    user = request.user
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT c.id, c.seller_id, u.full_name as seller_name,
               c.name, c.nickname, c.address, c.district, c.phone,
               c.dni, c.ruc, c.payment_mode, c.cycle_days, c.is_active, c.created_at, c.updated_at
        FROM distribution.customers c
        JOIN distribution.users u ON c.seller_id = u.id
        WHERE c.id = %s
    """, (customer_id,))
    columns = [desc[0] for desc in cursor.description]
    row = cursor.fetchone()
    if not row:
        return jsonify({"error": "Customer not found"}), 404
    customer = dict(zip(columns, row))
    if user.get("role") != "admin" and customer["seller_id"] != user.get("user_id"):
        return jsonify({"error": "Forbidden"}), 403
    if customer.get("created_at"):
        customer["created_at"] = customer["created_at"].isoformat()
    if customer.get("updated_at"):
        customer["updated_at"] = customer["updated_at"].isoformat()
    return jsonify(customer)


@app.route("/api/customers", methods=["POST"])
@require_auth
def create_customer():
    user = request.user
    body = request.get_json()
    seller_id = user.get("user_id")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO distribution.customers
            (seller_id, name, nickname, address, district, phone, dni, ruc, payment_mode, cycle_days)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (
        seller_id,
        body["name"],
        body.get("nickname"),
        body.get("address"),
        body.get("district"),
        body.get("phone"),
        body.get("dni"),
        body.get("ruc"),
        body.get("payment_mode", "cash"),
        body.get("cycle_days", 30),
    ))
    new_id = cursor.fetchone()[0]
    conn.commit()
    return jsonify({"id": new_id, "message": "Customer created"}), 201


@app.route("/api/customers/<int:customer_id>", methods=["PUT"])
@require_auth
def update_customer(customer_id):
    user = request.user
    body = request.get_json()
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT seller_id FROM distribution.customers WHERE id = %s", (customer_id,))
    row = cursor.fetchone()
    if not row:
        return jsonify({"error": "Customer not found"}), 404
    if user.get("role") != "admin" and row[0] != user.get("user_id"):
        return jsonify({"error": "Forbidden"}), 403

    cursor.execute("""
        UPDATE distribution.customers
        SET name = %s, nickname = %s, address = %s, district = %s, phone = %s,
            dni = %s, ruc = %s, payment_mode = %s, cycle_days = %s, updated_at = NOW()
        WHERE id = %s
    """, (
        body.get("name"),
        body.get("nickname"),
        body.get("address"),
        body.get("district"),
        body.get("phone"),
        body.get("dni"),
        body.get("ruc"),
        body.get("payment_mode"),
        body.get("cycle_days", 30),
        customer_id,
    ))
    conn.commit()
    return jsonify({"message": "Customer updated"})


@app.route("/api/customers/<int:customer_id>", methods=["DELETE"])
@require_auth
def delete_customer(customer_id):
    user = request.user
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT seller_id FROM distribution.customers WHERE id = %s", (customer_id,))
    row = cursor.fetchone()
    if not row:
        return jsonify({"error": "Customer not found"}), 404
    if user.get("role") != "admin" and row[0] != user.get("user_id"):
        return jsonify({"error": "Forbidden"}), 403

    cursor.execute(
        "UPDATE distribution.customers SET is_active = FALSE, updated_at = NOW() WHERE id = %s",
        (customer_id,),
    )
    conn.commit()
    return jsonify({"message": "Customer deleted"})


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
# Products routes (admin manages catalog)
# ──────────────────────────────────────────────

@app.route("/api/products", methods=["GET"])
@require_auth
def list_products():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, description, presentation, recommended_price, category, is_active, created_at
        FROM distribution.products
        WHERE is_active = TRUE
        ORDER BY category, name
    """)
    columns = [desc[0] for desc in cursor.description]
    products = [dict(zip(columns, row)) for row in cursor.fetchall()]
    for p in products:
        p["recommended_price"] = float(p["recommended_price"])
        if p.get("created_at"):
            p["created_at"] = p["created_at"].isoformat()
    close_connection(conn)
    return jsonify({"products": products})


@app.route("/api/products", methods=["POST"])
@require_admin
def create_product():
    body = request.get_json()
    name = body.get("name", "").strip()
    presentation = body.get("presentation", "").strip()
    recommended_price = body.get("recommended_price")

    if not name:
        return jsonify({"error": "Name is required"}), 400
    if not presentation:
        return jsonify({"error": "Presentation is required"}), 400
    if recommended_price is None or float(recommended_price) < 0:
        return jsonify({"error": "Valid recommended price is required"}), 400

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO distribution.products (name, description, presentation, recommended_price, category)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id
    """, (name, body.get("description"), presentation, recommended_price, body.get("category", "C")))
    new_id = cursor.fetchone()[0]
    conn.commit()
    close_connection(conn)
    return jsonify({"id": new_id, "message": "Product created"}), 201


@app.route("/api/products/<int:product_id>", methods=["PUT"])
@require_admin
def update_product(product_id):
    body = request.get_json()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE distribution.products
        SET name = %s, description = %s, presentation = %s,
            recommended_price = %s, category = %s
        WHERE id = %s
    """, (
        body.get("name"), body.get("description"), body.get("presentation"),
        body.get("recommended_price"), body.get("category"), product_id
    ))
    conn.commit()
    if cursor.rowcount == 0:
        close_connection(conn)
        return jsonify({"error": "Product not found"}), 404
    close_connection(conn)
    return jsonify({"message": "Product updated"})


@app.route("/api/products/<int:product_id>", methods=["DELETE"])
@require_admin
def delete_product(product_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE distribution.products SET is_active = FALSE WHERE id = %s", (product_id,))
    conn.commit()
    if cursor.rowcount == 0:
        close_connection(conn)
        return jsonify({"error": "Product not found"}), 404
    close_connection(conn)
    return jsonify({"message": "Product deleted"})


# ──────────────────────────────────────────────
# Seller Products routes (seller picks products + sets price)
# ──────────────────────────────────────────────

@app.route("/api/seller/products", methods=["GET"])
@require_auth
def list_seller_products():
    user = request.user
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT sp.id, sp.product_id, p.name, p.description, p.presentation,
               p.recommended_price, p.category,
               sp.real_price, sp.is_active, sp.created_at
        FROM distribution.seller_products sp
        JOIN distribution.products p ON sp.product_id = p.id
        WHERE sp.seller_id = %s AND sp.is_active = TRUE AND p.is_active = TRUE
        ORDER BY p.category, p.name
    """, (user.get("user_id"),))
    columns = [desc[0] for desc in cursor.description]
    items = [dict(zip(columns, row)) for row in cursor.fetchall()]
    for item in items:
        item["recommended_price"] = float(item["recommended_price"])
        item["real_price"] = float(item["real_price"])
        if item.get("created_at"):
            item["created_at"] = item["created_at"].isoformat()
    close_connection(conn)
    return jsonify({"seller_products": items})


@app.route("/api/seller/products", methods=["POST"])
@require_auth
def add_seller_product():
    user = request.user
    body = request.get_json()
    product_id = body.get("product_id")
    real_price = body.get("real_price")

    if not product_id:
        return jsonify({"error": "product_id is required"}), 400
    if real_price is None or float(real_price) < 0:
        return jsonify({"error": "Valid real_price is required"}), 400

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM distribution.products WHERE id = %s AND is_active = TRUE", (product_id,))
    if not cursor.fetchone():
        close_connection(conn)
        return jsonify({"error": "Product not found"}), 404

    cursor.execute("SELECT id FROM distribution.seller_products WHERE seller_id = %s AND product_id = %s",
                   (user.get("user_id"), product_id))
    if cursor.fetchone():
        close_connection(conn)
        return jsonify({"error": "Product already in your list"}), 409

    cursor.execute("""
        INSERT INTO distribution.seller_products (seller_id, product_id, real_price)
        VALUES (%s, %s, %s)
        RETURNING id
    """, (user.get("user_id"), product_id, real_price))
    new_id = cursor.fetchone()[0]
    conn.commit()
    close_connection(conn)
    return jsonify({"id": new_id, "message": "Product added to your catalog"}), 201


@app.route("/api/seller/products/<int:sp_id>", methods=["PUT"])
@require_auth
def update_seller_product(sp_id):
    user = request.user
    body = request.get_json()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE distribution.seller_products
        SET real_price = %s
        WHERE id = %s AND seller_id = %s
    """, (body.get("real_price"), sp_id, user.get("user_id")))
    conn.commit()
    if cursor.rowcount == 0:
        close_connection(conn)
        return jsonify({"error": "Not found"}), 404
    close_connection(conn)
    return jsonify({"message": "Price updated"})


@app.route("/api/seller/products/<int:sp_id>", methods=["DELETE"])
@require_auth
def remove_seller_product(sp_id):
    user = request.user
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE distribution.seller_products SET is_active = FALSE
        WHERE id = %s AND seller_id = %s
    """, (sp_id, user.get("user_id")))
    conn.commit()
    if cursor.rowcount == 0:
        close_connection(conn)
        return jsonify({"error": "Not found"}), 404
    close_connection(conn)
    return jsonify({"message": "Product removed from your catalog"})


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
                   s.customer_id, c.name as customer_name, c.district as customer_district,
                   s.variant_id, cv.name as variant_name, cv.sku, cv.category,
                   s.presentation, s.quantity, s.unit_price, s.total_amount,
                   s.sale_date, s.payment_date, s.expected_payment_date,
                   s.partial_payments, s.remanent_payment, s.notes,
                   s.gps_latitude, s.gps_longitude
            FROM distribution.sales s
            JOIN distribution.users u ON s.seller_id = u.id
            JOIN distribution.coffee_variants cv ON s.variant_id = cv.id
            LEFT JOIN distribution.customers c ON s.customer_id = c.id
            ORDER BY s.sale_date DESC
        """)
    else:
        cursor.execute("""
            SELECT s.id, s.seller_id, u.full_name as seller_name,
                   s.customer_id, c.name as customer_name, c.district as customer_district,
                   s.variant_id, cv.name as variant_name, cv.sku, cv.category,
                   s.presentation, s.quantity, s.unit_price, s.total_amount,
                   s.sale_date, s.payment_date, s.expected_payment_date,
                   s.partial_payments, s.remanent_payment, s.notes,
                   s.gps_latitude, s.gps_longitude
            FROM distribution.sales s
            JOIN distribution.users u ON s.seller_id = u.id
            JOIN distribution.coffee_variants cv ON s.variant_id = cv.id
            LEFT JOIN distribution.customers c ON s.customer_id = c.id
            WHERE s.seller_id = %s
            ORDER BY s.sale_date DESC
        """, (user.get("user_id"),))

    columns = [desc[0] for desc in cursor.description]
    sales = [dict(zip(columns, row)) for row in cursor.fetchall()]
    for sale in sales:
        for field in ("sale_date", "payment_date", "expected_payment_date", "created_at", "updated_at"):
            if sale.get(field):
                sale[field] = sale[field].isoformat()
    return jsonify({"sales": sales})


@app.route("/api/sales", methods=["POST"])
@require_auth
def create_sale():
    user = request.user
    body = request.get_json()
    seller_id = user.get("user_id")
    variant_id = body["variant_id"]
    quantity = body["quantity"]

    if quantity < 1 or quantity > 100:
        return jsonify({"error": "Quantity must be between 1 and 100"}), 400

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT price FROM distribution.coffee_variants WHERE id = %s", (variant_id,))
    variant = cursor.fetchone()
    if not variant:
        return jsonify({"error": "Variant not found"}), 404

    unit_price = float(variant[0])
    total_amount = unit_price * quantity
    partial = float(body.get("partial_payments", 0) or 0)
    remanent = total_amount - partial
    sale_status = "completed" if remanent <= 0 else "pending"

    customer_id = body.get("customer_id")

    cursor.execute("""
        INSERT INTO distribution.sales
            (seller_id, customer_id, variant_id, presentation, quantity,
             unit_price, total_amount, sale_date, payment_date, expected_payment_date,
             partial_payments, remanent_payment, status, notes)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id
    """, (
        seller_id, customer_id, variant_id,
        body.get("presentation", "granel"), quantity,
        unit_price, total_amount,
        body.get("sale_date") or datetime.now(timezone.utc).isoformat(),
        body.get("payment_date"),
        body.get("expected_payment_date"),
        partial, remanent, sale_status,
        body.get("notes"),
    ))
    new_id = cursor.fetchone()[0]
    conn.commit()

    return jsonify({
        "id": new_id,
        "total_amount": total_amount,
        "remanent_payment": remanent,
        "message": "Sale registered",
    }), 201


@app.route("/api/sales/<int:sale_id>", methods=["GET"])
@require_auth
def get_sale(sale_id):
    user = request.user
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT s.id, s.seller_id, u.full_name as seller_name,
               s.customer_id, c.name as customer_name, c.district as customer_district,
               s.variant_id, cv.name as variant_name, cv.sku, cv.category,
               s.presentation, s.quantity, s.unit_price, s.total_amount,
               s.sale_date, s.payment_date, s.expected_payment_date,
               s.partial_payments, s.remanent_payment, s.notes
        FROM distribution.sales s
        JOIN distribution.users u ON s.seller_id = u.id
        JOIN distribution.coffee_variants cv ON s.variant_id = cv.id
        LEFT JOIN distribution.customers c ON s.customer_id = c.id
        WHERE s.id = %s
    """, (sale_id,))
    columns = [desc[0] for desc in cursor.description]
    row = cursor.fetchone()
    if not row:
        return jsonify({"error": "Sale not found"}), 404
    sale = dict(zip(columns, row))
    if user.get("role") != "admin" and sale["seller_id"] != user.get("user_id"):
        return jsonify({"error": "Forbidden"}), 403
    for field in ("sale_date", "payment_date", "expected_payment_date", "created_at", "updated_at"):
        if sale.get(field):
            sale[field] = sale[field].isoformat()
    return jsonify(sale)


@app.route("/api/sales/<int:sale_id>", methods=["PUT"])
@require_auth
def update_sale(sale_id):
    user = request.user
    body = request.get_json()
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT seller_id FROM distribution.sales WHERE id = %s", (sale_id,))
    row = cursor.fetchone()
    if not row:
        return jsonify({"error": "Sale not found"}), 404
    if user.get("role") != "admin" and row[0] != user.get("user_id"):
        return jsonify({"error": "Forbidden"}), 403

    variant_id = body.get("variant_id")
    quantity = body.get("quantity")

    if variant_id and quantity:
        cursor.execute("SELECT price FROM distribution.coffee_variants WHERE id = %s", (variant_id,))
        variant = cursor.fetchone()
        if not variant:
            return jsonify({"error": "Variant not found"}), 404
        unit_price = float(variant[0])
        total_amount = unit_price * quantity
    else:
        cursor.execute(
            "SELECT unit_price, quantity FROM distribution.sales WHERE id = %s",
            (sale_id,),
        )
        ex = cursor.fetchone()
        unit_price = float(ex[0]) if ex else 0
        quantity = quantity or (ex[1] if ex else 0)
        total_amount = unit_price * quantity

    partial = float(body.get("partial_payments", 0) or 0)
    remanent = total_amount - partial
    sale_status = "completed" if remanent <= 0 else "pending"

    cursor.execute("""
        UPDATE distribution.sales
        SET customer_id = %s, variant_id = %s, presentation = %s, quantity = %s,
            unit_price = %s, total_amount = %s, sale_date = %s, payment_date = %s,
            expected_payment_date = %s, partial_payments = %s, remanent_payment = %s,
            status = %s, notes = %s, updated_at = NOW()
        WHERE id = %s
    """, (
        body.get("customer_id"), variant_id, body.get("presentation"), quantity,
        unit_price, total_amount, body.get("sale_date"), body.get("payment_date"),
        body.get("expected_payment_date"), partial, remanent, sale_status,
        body.get("notes"), sale_id,
    ))
    conn.commit()
    return jsonify({"message": "Sale updated", "total_amount": total_amount, "remanent_payment": remanent})


# ──────────────────────────────────────────────
# Tracking routes
# ──────────────────────────────────────────────

@app.route("/api/tracking/customers", methods=["GET"])
@require_auth
def tracking_customers():
    user = request.user
    conn = get_connection()
    cursor = conn.cursor()
    is_admin = user.get("role") == "admin"

    if is_admin:
        cursor.execute("""
            SELECT c.id, c.seller_id, u.full_name as seller_name,
                   c.name, c.nickname, c.district, c.phone, c.cycle_days,
                   ls.last_sale_date, ls.last_sale_amount
            FROM distribution.customers c
            JOIN distribution.users u ON c.seller_id = u.id
            LEFT JOIN LATERAL (
                SELECT sale_date as last_sale_date, total_amount as last_sale_amount
                FROM distribution.sales
                WHERE customer_id = c.id
                ORDER BY sale_date DESC
                LIMIT 1
            ) ls ON TRUE
            WHERE c.is_active = TRUE
            ORDER BY c.name
        """)
    else:
        cursor.execute("""
            SELECT c.id, c.seller_id, u.full_name as seller_name,
                   c.name, c.nickname, c.district, c.phone, c.cycle_days,
                   ls.last_sale_date, ls.last_sale_amount
            FROM distribution.customers c
            JOIN distribution.users u ON c.seller_id = u.id
            LEFT JOIN LATERAL (
                SELECT sale_date as last_sale_date, total_amount as last_sale_amount
                FROM distribution.sales
                WHERE customer_id = c.id
                ORDER BY sale_date DESC
                LIMIT 1
            ) ls ON TRUE
            WHERE c.seller_id = %s AND c.is_active = TRUE
            ORDER BY c.name
        """, (user.get("user_id"),))

    columns = [desc[0] for desc in cursor.description]
    rows = cursor.fetchall()
    close_connection(conn)

    result = []
    for row in rows:
        record = dict(zip(columns, row))
        cycle = record.get("cycle_days") or 30
        last_sale = record.get("last_sale_date")

        if last_sale:
            last_sale_str = last_sale.isoformat() if hasattr(last_sale, 'isoformat') else str(last_sale)
            from datetime import datetime as dt, timedelta
            last_dt = last_sale if isinstance(last_sale, dt) else dt.fromisoformat(str(last_sale))
            next_expected = last_dt + timedelta(days=cycle)
            days_since = (dt.utcnow() - last_dt.replace(tzinfo=None)).days
            is_active = days_since <= 90
        else:
            last_sale_str = None
            next_expected = None
            days_since = None
            is_active = False

        result.append({
            "id": record["id"],
            "seller_id": record["seller_id"],
            "seller_name": record["seller_name"],
            "name": record["name"],
            "nickname": record.get("nickname"),
            "district": record.get("district"),
            "phone": record.get("phone"),
            "cycle_days": cycle,
            "last_sale_date": last_sale_str,
            "last_sale_amount": float(record.get("last_sale_amount") or 0),
            "next_expected_date": next_expected.isoformat() if next_expected else None,
            "days_since_last_sale": days_since,
            "status": "active" if is_active else "inactive",
        })

    return jsonify({"customers": result})


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

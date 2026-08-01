import json
import logging
import azure.functions as func
from shared.auth import require_auth, require_admin
from shared.db import get_connection

app = func.FunctionApp()


@app.route(route="routes", methods=["GET"], auth_level="anonymous")
@require_auth
def list_routes(req: func.HttpRequest) -> func.HttpResponse:
    """List routes. Sellers see assigned routes, admins see all."""
    user = req.route_data.get("user", {})
    try:
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

        for route in routes:
            if route.get("route_date"):
                route["route_date"] = route["route_date"].isoformat()
            if route.get("created_at"):
                route["created_at"] = route["created_at"].isoformat()

        return func.HttpResponse(
            json.dumps({"routes": routes}),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error listing routes: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )


@app.route(route="routes", methods=["POST"], auth_level="anonymous")
@require_admin
def create_route(req: func.HttpRequest) -> func.HttpResponse:
    """Create a new route with waypoints (admin only)."""
    try:
        body = req.get_json()
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

        return func.HttpResponse(
            json.dumps({"id": route_id, "message": "Route created"}),
            status_code=201,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error creating route: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )


@app.route(route="routes/{id}/assign", methods=["PUT"], auth_level="anonymous")
@require_admin
def assign_route(req: func.HttpRequest) -> func.HttpResponse:
    """Assign a route to a seller (admin only)."""
    route_id = req.route_params.get("id")
    try:
        body = req.get_json()
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE distribution.routes
            SET assigned_seller_id = %s, status = 'pending'
            WHERE id = %s
        """, (body["seller_id"], route_id))
        conn.commit()
        if cursor.rowcount == 0:
            return func.HttpResponse(
                json.dumps({"error": "Route not found"}),
                status_code=404,
                mimetype="application/json"
            )
        return func.HttpResponse(
            json.dumps({"message": "Route assigned"}),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error assigning route: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )


@app.route(route="routes/{id}/checkin", methods=["POST"], auth_level="anonymous")
@require_auth
def checkin_waypoint(req: func.HttpRequest) -> func.HttpResponse:
    """Check in at a waypoint (sellers only)."""
    route_id = req.route_params.get("id")
    user = req.route_data.get("user", {})
    try:
        body = req.get_json()
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT assigned_seller_id FROM distribution.routes WHERE id = %s", (route_id,))
        route = cursor.fetchone()
        if not route or route[0] != user.get("user_id"):
            return func.HttpResponse(
                json.dumps({"error": "Route not found or not assigned to you"}),
                status_code=403,
                mimetype="application/json"
            )

        cursor.execute("""
            UPDATE distribution.route_waypoints
            SET status = 'visited', actual_arrival = NOW()
            WHERE route_id = %s AND id = %s
        """, (route_id, body["waypoint_id"]))
        conn.commit()

        return func.HttpResponse(
            json.dumps({"message": "Checked in successfully"}),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error checking in: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )

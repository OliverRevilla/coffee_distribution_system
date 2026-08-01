import json
import logging
import azure.functions as func
from shared.auth import require_auth, require_admin
from shared.db import get_connection

app = func.FunctionApp()


@app.route(route="tracking/location", methods=["POST"], auth_level="anonymous")
@require_auth
def update_location(req: func.HttpRequest) -> func.HttpResponse:
    """Update seller GPS location (sellers only)."""
    user = req.route_data.get("user", {})
    try:
        body = req.get_json()
        seller_id = user.get("user_id")

        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO distribution.gps_locations (seller_id, latitude, longitude, accuracy)
            VALUES (%s, %s, %s, %s)
        """, (seller_id, body["latitude"], body["longitude"], body.get("accuracy")))
        conn.commit()

        return func.HttpResponse(
            json.dumps({"message": "Location updated"}),
            status_code=201,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error updating location: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )


@app.route(route="tracking/seller/{id}", methods=["GET"], auth_level="anonymous")
@require_admin
def get_seller_locations(req: func.HttpRequest) -> func.HttpResponse:
    """Get seller location history (admin only)."""
    seller_id = req.route_params.get("id")
    try:
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

        return func.HttpResponse(
            json.dumps({"locations": locations}),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error getting seller locations: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )


@app.route(route="tracking/seller/{id}/latest", methods=["GET"], auth_level="anonymous")
@require_admin
def get_seller_latest_location(req: func.HttpRequest) -> func.HttpResponse:
    """Get seller latest location (admin only)."""
    seller_id = req.route_params.get("id")
    try:
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
            return func.HttpResponse(
                json.dumps({"error": "No location data found"}),
                status_code=404,
                mimetype="application/json"
            )

        location = dict(zip(columns, row))
        if location.get("timestamp"):
            location["timestamp"] = location["timestamp"].isoformat()

        return func.HttpResponse(
            json.dumps(location),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error getting seller latest location: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )

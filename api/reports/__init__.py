import json
import logging
import azure.functions as func
from shared.auth import require_admin
from shared.db import get_connection

app = func.FunctionApp()


@app.route(route="reports/sales", methods=["GET"], auth_level="anonymous")
@require_admin
def sales_report(req: func.HttpRequest) -> func.HttpResponse:
    """Get sales report/analytics (admin only)."""
    try:
        conn = get_connection()
        cursor = conn.cursor()

        # Total sales by seller
        cursor.execute("""
            SELECT u.full_name, COUNT(*) as total_sales, SUM(s.total_amount) as total_revenue
            FROM Sales s
            JOIN Users u ON s.seller_id = u.id
            GROUP BY u.full_name
            ORDER BY total_revenue DESC
        """)
        by_seller = [{"seller": row[0], "total_sales": row[1], "total_revenue": float(row[2])}
                     for row in cursor.fetchall()]

        # Total sales by variant
        cursor.execute("""
            SELECT cv.name, cv.sku, SUM(s.quantity) as total_quantity,
                   SUM(s.total_amount) as total_revenue
            FROM Sales s
            JOIN CoffeeVariants cv ON s.variant_id = cv.id
            GROUP BY cv.name, cv.sku
            ORDER BY total_revenue DESC
        """)
        by_variant = [{"variant": row[0], "sku": row[1], "total_quantity": row[2],
                       "total_revenue": float(row[3])} for row in cursor.fetchall()]

        # Sales by date (last 30 days)
        cursor.execute("""
            SELECT CAST(s.sale_date AS DATE) as sale_day, COUNT(*) as total_sales,
                   SUM(s.total_amount) as total_revenue
            FROM Sales s
            WHERE s.sale_date >= DATEADD(day, -30, SYSUTCDATETIME())
            GROUP BY CAST(s.sale_date AS DATE)
            ORDER BY sale_day DESC
        """)
        by_date = [{"date": row[0].isoformat() if row[0] else None, "total_sales": row[1],
                    "total_revenue": float(row[2])} for row in cursor.fetchall()]

        # Overall totals
        cursor.execute("""
            SELECT COUNT(*) as total_sales, ISNULL(SUM(total_amount), 0) as total_revenue
            FROM Sales
        """)
        overall = cursor.fetchone()
        summary = {"total_sales": overall[0], "total_revenue": float(overall[1])}

        return func.HttpResponse(
            json.dumps({
                "summary": summary,
                "by_seller": by_seller,
                "by_variant": by_variant,
                "by_date": by_date
            }),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"Error generating sales report: {e}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )

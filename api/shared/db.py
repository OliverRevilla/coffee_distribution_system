import os
import psycopg2
from typing import Optional


def get_connection():
    """Create a new database connection each time."""
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL not configured")
    return psycopg2.connect(database_url)


def close_connection(conn: Optional[psycopg2.extensions.connection] = None):
    """Close a database connection if open."""
    if conn and not conn.closed:
        try:
            conn.close()
        except Exception:
            pass

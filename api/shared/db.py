import os
import psycopg2
from typing import Optional


_connection: Optional[psycopg2.extensions.connection] = None


def get_connection() -> psycopg2.extensions.connection:
    """Get or create a database connection singleton."""
    global _connection
    if _connection is not None and not _connection.closed:
        try:
            _connection.rollback()
        except Exception:
            pass
    if _connection is None or _connection.closed:
        database_url = os.environ.get("DATABASE_URL")
        if not database_url:
            raise ValueError("DATABASE_URL not configured")
        _connection = psycopg2.connect(database_url)
    return _connection


def close_connection():
    """Close the database connection."""
    global _connection
    if _connection and not _connection.closed:
        _connection.close()
        _connection = None

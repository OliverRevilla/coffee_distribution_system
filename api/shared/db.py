import os
import pyodbc
from typing import Optional


_connection: Optional[pyodbc.Connection] = None


def get_connection() -> pyodbc.Connection:
    """Get or create a database connection singleton."""
    global _connection
    if _connection is None or _connection.closed:
        conn_str = os.environ.get("AZURE_SQL_CONNECTION_STRING")
        if not conn_str:
            raise ValueError("AZURE_SQL_CONNECTION_STRING not configured")
        _connection = pyodbc.connect(conn_str)
    return _connection


def close_connection():
    """Close the database connection."""
    global _connection
    if _connection and not _connection.closed:
        _connection.close()
        _connection = None

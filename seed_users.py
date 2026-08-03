#!/usr/bin/env python3
"""
Seed script to create initial admin and test seller users.
Usage: DATABASE_URL="postgresql://..." python seed_users.py
"""

import os
import sys
import hashlib
import hmac
import secrets
import psycopg2


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000)
    return f"{salt}${dk.hex()}"


def main():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL environment variable is not set.")
        print('Example: export DATABASE_URL="postgresql://user:pass@localhost:5432/dbname"')
        sys.exit(1)

    conn = psycopg2.connect(database_url)
    cursor = conn.cursor()

    users = [
        {
            "email": "admin@test.com",
            "full_name": "Test Admin",
            "password": "admin123",
            "role": "admin",
        },
        {
            "email": "seller@test.com",
            "full_name": "Test Seller",
            "password": "seller123",
            "role": "seller",
        },
    ]

    for user in users:
        cursor.execute("SELECT id FROM distribution.users WHERE email = %s", (user["email"],))
        if cursor.fetchone():
            print(f"  SKIP  {user['email']} (already exists)")
            continue

        password_hash = hash_password(user["password"])
        cursor.execute(
            """INSERT INTO distribution.users (email, full_name, password_hash, role, status, azure_b2c_id)
               VALUES (%s, %s, %s, %s, 'active', %s)
               RETURNING id""",
            (user["email"], user["full_name"], password_hash, user["role"], user["email"]),
        )
        new_id = cursor.fetchone()[0]
        print(f"  OK    {user['email']} (id={new_id}, role={user['role']})")

    conn.commit()
    cursor.close()
    conn.close()
    print("\nDone! You can now log in with:")
    print("  Admin:  admin@test.com  / admin123")
    print("  Seller: seller@test.com / seller123")
    print(f"\nAdmin invite code: {os.environ.get('ADMIN_INVITE_CODE', 'admin-invite-2024')}")


if __name__ == "__main__":
    main()

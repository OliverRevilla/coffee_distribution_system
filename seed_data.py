#!/usr/bin/env python3
"""
Seed script to insert fake data for testing the dashboard.
Uses real Lima, Peru locations with GPS coordinates.
Usage: DATABASE_URL="postgresql://..." python seed_data.py
"""

import os
import sys
import random
from datetime import datetime, timedelta
import psycopg2


# Lima, Peru locations with Departamento, Provincia, Distrito, Dirección, Lat, Lng
LIMA_CUSTOMERS = [
    ("Carlos Mendoza", "Lima, Lima, Jesús María, Av. Salaverry 1234", -12.0795, -77.0325),
    ("María Fernández", "Lima, Lima, Miraflores, Av. Larco 567", -12.1195, -77.0295),
    ("Juan Pérez", "Lima, Lima, San Isidro, Av. Javier Prado Este 3456", -12.0985, -77.0355),
    ("Ana García", "Lima, Lima, Barranco, Jr. Bolognesi 890", -12.1455, -77.0225),
    ("Luis Torres", "Lima, Lima, San Borja, Av. Aviación 2345", -12.1095, -76.9955),
    ("Rosa López", "Lima, Lima, Surco, Av. Benavides 4567", -12.1395, -76.9895),
    ("Pedro Ramírez", "Lima, Lima, La Molina, Av. La Molina 1890", -12.0845, -76.9505),
    ("Lucía Vargas", "Lima, Lima, Pueblo Libre, Jr. San Martín 456", -12.0725, -77.0405),
    ("Miguel Ángel Rojas", "Lima, Lima, Lince, Av. Gregorio Escobedo 789", -12.0845, -77.0325),
    ("Carmen Silva", "Lima, Lima, Magdalena del Mar, Av. Marina 1234", -12.0895, -77.0595),
    ("Fernando Castillo", "Lima, Lima, San Miguel, Av. La Marina 5678", -12.0775, -77.0845),
    ("Isabel Morales", "Lima, Lima, Breña, Jr. Cuzco 901", -12.0645, -77.0505),
    ("Roberto Díaz", "Lima, Lima, Cercado de Lima, Jr. Huancavelica 234", -12.0455, -77.0305),
    ("Patricia Gutiérrez", "Lima, Lima, Rímac, Av. 28 de Julio 567", -12.0245, -77.0495),
    ("Diego Aguilar", "Lima, Lima, Los Olivos, Av. Alfredo Mendiola 8901", -12.0145, -77.0495),
]

LIMA_WAYPOINTS = {
    "Jesus_Miraflores": [
        ("Café La Mar", "Lima, Lima, Jesús María, Av. Jose Galvez 1234", -12.0775, -77.0285),
        ("Café Aroma", "Lima, Lima, Miraflores, Av. José Larco 567", -12.1180, -77.0310),
        ("Café del Parque", "Lima, Lima, Jesús María, Av. Italia 890", -12.0810, -77.0340),
        ("Café Victoria", "Lima, Lima, Miraflores, Grimaldo del Solar 345", -12.1210, -77.0280),
    ],
    "SanIsidro_Barranco": [
        ("Café El Olivar", "Lima, Lima, San Isidro, Av. Pasaje de los Olivos 100", -12.0970, -77.0320),
        ("Café Barranco", "Lima, Lima, Barranco, Av. Grau 456", -12.1440, -77.0200),
        ("Café La Barranca", "Lima, Lima, Barranco, Jr. Union 789", -12.1480, -77.0240),
        ("Café Portón", "Lima, Lima, San Isidro, Av. José Larco 234", -12.0990, -77.0340),
    ],
    "SanBorja_Surco": [
        ("Café Sur", "Lima, Lima, San Borja, Av. Aviación 1800", -12.1110, -76.9970),
        ("Café Benavides", "Lima, Lima, Surco, Av. Benavides 3200", -12.1370, -76.9870),
        ("Café La Molina", "Lima, Lima, La Molina, Av. La Molina 2100", -12.0860, -76.9520),
        ("Café del Sol", "Lima, Lima, Surco, Av. del Progreso 456", -12.1420, -76.9910),
    ],
    "PuebloLibre_Lince": [
        ("Café Pueblo", "Lima, Lima, Pueblo Libre, Jr. San Martín 234", -12.0740, -77.0420),
        ("Café Lince", "Lima, Lima, Lince, Av. Salaverry 1200", -12.0830, -77.0310),
        ("Café Magdalena", "Lima, Lima, Magdalena del Mar, Av. San Miguel 567", -12.0910, -77.0610),
        ("Café Breña", "Lima, Lima, Breña, Av. Brasil 890", -12.0660, -77.0520),
    ],
}


def main():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL environment variable is not set.")
        sys.exit(1)

    conn = psycopg2.connect(database_url)
    cursor = conn.cursor()

    # Check for existing sellers
    cursor.execute("SELECT id, email FROM distribution.users WHERE role = 'seller' LIMIT 5")
    sellers = cursor.fetchall()
    if not sellers:
        print("ERROR: No sellers found. Run seed_users.py first.")
        sys.exit(1)

    seller_id = sellers[0][0]
    print(f"Using seller: {sellers[0][1]} (id={seller_id})")

    # ── Coffee Variants ──
    # Category A: Premium (highest price), B: Standard, C: Economy (lowest price)
    variants = [
        ("Cafe Extra Molido", "Cafe extra molido de calidad superior", "EXT-001", 12.00, "A"),
        ("Cafe Gourmet Molido", "Cafe gourmet molido, aroma intenso y sabor equilibrado", "GOU-002", 15.00, "A"),
        ("Cafe de Especialidad", "Cafe de especialidad, origen unico, tueste artesanal", "ESP-003", 18.00, "A"),
        ("Cacao en Polvo", "Cacao en polvo puro, ideal para bebidas y reposteria", "CAC-004", 10.00, "B"),
        ("Cafe a Granel", "Cafe a granel, por kilogramo, para clientes frecuentes", "GRA-005", 8.50, "C"),
    ]

    variant_ids = []
    for name, desc, sku, price, category in variants:
        cursor.execute("SELECT id FROM distribution.coffee_variants WHERE sku = %s", (sku,))
        existing = cursor.fetchone()
        if existing:
            variant_ids.append(existing[0])
            print(f"  SKIP  {sku} (already exists)")
        else:
            cursor.execute(
                """INSERT INTO distribution.coffee_variants (name, description, sku, price, category)
                   VALUES (%s, %s, %s, %s, %s) RETURNING id""",
                (name, desc, sku, price, category)
            )
            vid = cursor.fetchone()[0]
            variant_ids.append(vid)
            print(f"  OK    {sku} (id={vid}, category={category})")

    # ── Inventory ──
    warehouses = [
        ("Almacén Central", "Lima, Lima, Cercado de Lima, Jr. Iquitos 1000"),
        ("Almacén Sur", "Lima, Lima, Surco, Av. Los Álamos 500"),
        ("Almacén Norte", "Lima, Lima, Los Olivos, Av. Alfredo Mendiola 2000"),
    ]
    for vid in variant_ids:
        cursor.execute("SELECT id FROM distribution.inventory WHERE variant_id = %s", (vid,))
        if cursor.fetchone():
            print(f"  SKIP  inventory for variant {vid}")
            continue
        wh = random.choice(warehouses)
        cursor.execute(
            """INSERT INTO distribution.inventory (variant_id, quantity, warehouse_location, reorder_point, updated_by)
               VALUES (%s, %s, %s, %s, %s)""",
            (vid, random.randint(20, 200), wh[0], 10, seller_id)
        )
        print(f"  OK    inventory for variant {vid}")

    # ── Customers ──
    cursor.execute("DELETE FROM distribution.customers WHERE seller_id = %s", (seller_id,))

    customers_data = [
        ("Carlos Mendoza", "Carlitos", "Av. Salaverry 1234, Jesús María", "Jesús María", "999111222", "12345678", "20123456789", "cash"),
        ("María Fernández", "Mari", "Av. Larco 567, Miraflores", "Miraflores", "999222333", "87654321", "20987654321", "credit"),
        ("Juan Pérez", "Juancho", "Av. Javier Prado Este 3456, San Isidro", "San Isidro", "999333444", "11223344", "20112233445", "cash"),
        ("Ana García", None, "Jr. Bolognesi 890, Barranco", "Barranco", "999444555", "44332211", None, "cash"),
        ("Luis Torres", "Lucho", "Av. Aviación 2345, San Borja", "San Borja", "999555666", "55667788", "20556677889", "credit"),
        ("Rosa López", "Rosita", "Av. Benavides 4567, Surco", "Surco", "999666777", "99887766", None, "cash"),
        ("Pedro Ramírez", None, "Av. La Molina 1890, La Molina", "La Molina", "999777888", "66778899", "20667788990", "credit"),
        ("Lucía Vargas", "Lu", "Jr. San Martín 456, Pueblo Libre", "Pueblo Libre", "999888999", "33445566", None, "cash"),
    ]

    customer_ids = []
    for name, nick, addr, district, phone, dni, ruc, mode in customers_data:
        cursor.execute(
            """INSERT INTO distribution.customers
               (seller_id, name, nickname, address, district, phone, dni, ruc, payment_mode)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (seller_id, name, nick, addr, district, phone, dni, ruc, mode)
        )
        cid = cursor.fetchone()[0]
        customer_ids.append(cid)
        print(f"  OK    customer '{name}' (id={cid}, mode={mode})")
    print(f"  OK    {len(customer_ids)} customers")

    # ── Sales ──
    presentations = ['granel', '250gr', '1kg']
    notes_options = [
        "Cliente regular, prefiere entrega en la mañana",
        "Pedido grande para evento de oficina",
        "Pedido recurrente, suscripción mensual",
        "Nuevo cliente, referido por Carlos",
        "Pedido al por mayor para restaurante",
        None,
        None,
    ]

    # Clear existing sales for clean test data
    cursor.execute("DELETE FROM distribution.sales WHERE seller_id = %s", (seller_id,))

    # Generate 40 sales spread across 30 days with varied quantities
    for i in range(40):
        cust_id = random.choice(customer_ids)
        vid = random.choice(variant_ids)
        qty = random.randint(1, 25)
        pres = random.choice(presentations)
        cursor.execute("SELECT price FROM distribution.coffee_variants WHERE id = %s", (vid,))
        price = cursor.fetchone()[0]
        total = float(price) * qty
        days_ago = random.randint(0, 29)
        sale_date = datetime.now() - timedelta(days=days_ago, hours=random.randint(7, 19), minutes=random.randint(0, 59))

        # Credit sales get partial payments and expected payment dates
        is_credit = random.random() < 0.4
        if is_credit:
            partial = round(total * random.uniform(0.2, 0.8), 2)
            expected_date = (datetime.now() + timedelta(days=random.randint(7, 30))).isoformat()
            pay_date = None
        else:
            partial = total
            expected_date = None
            pay_date = sale_date.isoformat()

        remanent = total - partial

        cursor.execute(
            """INSERT INTO distribution.sales
               (seller_id, customer_id, variant_id, presentation, quantity, unit_price, total_amount,
                sale_date, payment_date, expected_payment_date, partial_payments, remanent_payment, notes)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (seller_id, cust_id, vid, pres, qty, price, total,
             sale_date, pay_date, expected_date, partial, remanent,
             random.choice(notes_options))
        )
    print(f"  OK    40 sales records")

    # ── Routes with Lima locations ──
    cursor.execute("DELETE FROM distribution.route_waypoints WHERE route_id IN (SELECT id FROM distribution.routes WHERE assigned_seller_id = %s)", (seller_id,))
    cursor.execute("DELETE FROM distribution.routes WHERE assigned_seller_id = %s", (seller_id,))

    routes = [
        ("Ruta Jesús María - Miraflores", "Entregas matutinas en Jesús María y Miraflores", "in_progress", "Jesus_Miraflores"),
        ("Ruta San Isidro - Barranco", "Entregas vespertinas en San Isidro y Barranco", "pending", "SanIsidro_Barranco"),
        ("Ruta San Borja - Surco", "Entregas de fin de semana en San Borja y Surco", "completed", "SanBorja_Surco"),
        ("Ruta Pueblo Libre - Lince", "Ruta express de fin de semana", "pending", "PuebloLibre_Lince"),
    ]

    for name, desc, status, wp_key in routes:
        route_date = datetime.now().date() + timedelta(days=random.randint(-5, 5))
        cursor.execute(
            """INSERT INTO distribution.routes (name, description, assigned_seller_id, status, route_date)
               VALUES (%s, %s, %s, %s, %s) RETURNING id""",
            (name, desc, seller_id, status, route_date)
        )
        route_id = cursor.fetchone()[0]

        waypoints = LIMA_WAYPOINTS[wp_key]

        for i, (cname, addr, lat, lng) in enumerate(waypoints):
            arrival = "visited" if status == "completed" or (status == "in_progress" and i < 2) else "pending"
            actual = datetime.now() - timedelta(hours=random.randint(1, 5)) if arrival == "visited" else None
            estimated = datetime.now().replace(hour=9 + i * 2, minute=0) if arrival == "pending" else None
            cursor.execute(
                """INSERT INTO distribution.route_waypoints
                   (route_id, sequence, customer_name, address, latitude, longitude,
                    estimated_arrival, status, actual_arrival)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (route_id, i + 1, cname, addr, lat, lng, estimated, arrival, actual)
            )
        print(f"  OK    route '{name}' with {len(waypoints)} waypoints")

    # ── Complaints ──
    cursor.execute("DELETE FROM distribution.complaints WHERE seller_id = %s", (seller_id,))

    complaints = [
        ("Entrega tardía", "El cliente se quejó de un retraso de 2 horas en la entrega", "delivery", "open", "high"),
        ("Pedido incorrecto", "El cliente recibió Espresso en lugar de Colombiano", "quality", "in_progress", "medium"),
        ("Empaque dañado", "El paquete de café llegó roto, los granzes se derramaron", "quality", "open", "medium"),
        ("Discrepancia de precio", "La factura muestra un precio diferente al cotizado", "pricing", "resolved", "low"),
    ]

    for subj, desc, cat, status, priority in complaints:
        days_ago = random.randint(1, 14)
        created = datetime.now() - timedelta(days=days_ago)
        resolved = (created + timedelta(days=random.randint(1, 3))).isoformat() if status == "resolved" else None
        resolution = "Reposición enviada al cliente" if status == "resolved" else None

        customer = random.choice(LIMA_CUSTOMERS)
        cursor.execute(
            """INSERT INTO distribution.complaints
               (seller_id, customer_name, subject, description, category, status, priority, created_at, resolved_at, resolution_notes)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (seller_id, customer[0], subj, desc, cat, status, priority, created, resolved, resolution)
        )
    print(f"  OK    4 complaints")

    conn.commit()
    cursor.close()
    conn.close()
    print("\nDone! Test data seeded successfully with Lima, Peru locations.")


if __name__ == "__main__":
    main()

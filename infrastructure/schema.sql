-- Create custom schema
CREATE SCHEMA IF NOT EXISTS distribution;

-- Users table
CREATE TABLE IF NOT EXISTS distribution.users (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(256) NOT NULL UNIQUE,
    full_name       VARCHAR(256) NOT NULL,
    password_hash   VARCHAR(512),
    role            VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'seller')),
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    azure_b2c_id    VARCHAR(256) DEFAULT '',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Coffee variants
CREATE TABLE IF NOT EXISTS distribution.coffee_variants (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(256) NOT NULL,
    description     TEXT,
    sku             VARCHAR(50) NOT NULL UNIQUE,
    price           DECIMAL(10,2) NOT NULL,
    category        VARCHAR(1) NOT NULL DEFAULT 'C' CHECK (category IN ('A', 'B', 'C')),
    image_url       VARCHAR(512),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory tracking
CREATE TABLE IF NOT EXISTS distribution.inventory (
    id                  SERIAL PRIMARY KEY,
    variant_id          INT NOT NULL REFERENCES distribution.coffee_variants(id),
    quantity            INT NOT NULL DEFAULT 0,
    warehouse_location  VARCHAR(256),
    reorder_point       INT DEFAULT 10,
    last_updated        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by          INT REFERENCES distribution.users(id)
);

-- Sales records
CREATE TABLE IF NOT EXISTS distribution.sales (
    id                      SERIAL PRIMARY KEY,
    seller_id               INT NOT NULL REFERENCES distribution.users(id),
    customer_id             INT REFERENCES distribution.customers(id),
    variant_id              INT NOT NULL REFERENCES distribution.coffee_variants(id),
    presentation            VARCHAR(20) NOT NULL DEFAULT 'granel'
                            CHECK (presentation IN ('granel', '250gr', '1kg')),
    quantity                INT NOT NULL CHECK (quantity BETWEEN 1 AND 100),
    unit_price              DECIMAL(10,2) NOT NULL,
    total_amount            DECIMAL(10,2) NOT NULL,
    sale_date               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_date            TIMESTAMP,
    expected_payment_date   TIMESTAMP,
    partial_payments        DECIMAL(10,2) DEFAULT 0,
    remanent_payment        DECIMAL(10,2) DEFAULT 0,
    status                  VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'completed')),
    notes                   TEXT,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Delivery routes
CREATE TABLE IF NOT EXISTS distribution.routes (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(256) NOT NULL,
    description         TEXT,
    assigned_seller_id  INT REFERENCES distribution.users(id),
    status              VARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending', 'in_progress', 'completed')),
    route_date          DATE NOT NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Route waypoints (delivery stops)
CREATE TABLE IF NOT EXISTS distribution.route_waypoints (
    id                  SERIAL PRIMARY KEY,
    route_id            INT NOT NULL REFERENCES distribution.routes(id) ON DELETE CASCADE,
    sequence            INT NOT NULL,
    customer_name       VARCHAR(256),
    address             VARCHAR(512),
    latitude            DECIMAL(9,6) NOT NULL,
    longitude           DECIMAL(9,6) NOT NULL,
    estimated_arrival   TIMESTAMP,
    actual_arrival      TIMESTAMP,
    status              VARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending', 'visited', 'skipped')),
    notes               TEXT
);

-- GPS location tracking
CREATE TABLE IF NOT EXISTS distribution.gps_locations (
    id          BIGSERIAL PRIMARY KEY,
    seller_id   INT NOT NULL REFERENCES distribution.users(id),
    latitude    DECIMAL(9,6) NOT NULL,
    longitude   DECIMAL(9,6) NOT NULL,
    accuracy    DECIMAL(5,2),
    timestamp   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customers
CREATE TABLE IF NOT EXISTS distribution.customers (
    id              SERIAL PRIMARY KEY,
    seller_id       INT NOT NULL REFERENCES distribution.users(id),
    name            VARCHAR(256) NOT NULL,
    nickname        VARCHAR(256),
    address         VARCHAR(512),
    district        VARCHAR(100),
    phone           VARCHAR(50),
    dni             VARCHAR(20),
    ruc             VARCHAR(20),
    payment_mode    VARCHAR(10) NOT NULL DEFAULT 'cash'
                    CHECK (payment_mode IN ('cash', 'credit')),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Complaints
CREATE TABLE IF NOT EXISTS distribution.complaints (
    id              SERIAL PRIMARY KEY,
    seller_id       INT NOT NULL REFERENCES distribution.users(id),
    customer_name   VARCHAR(256),
    subject         VARCHAR(256) NOT NULL,
    description     TEXT NOT NULL,
    category        VARCHAR(50) CHECK (category IN ('quality', 'delivery', 'pricing', 'other')),
    status          VARCHAR(20) DEFAULT 'open'
                    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority        VARCHAR(10) DEFAULT 'medium'
                    CHECK (priority IN ('low', 'medium', 'high')),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at     TIMESTAMP,
    resolution_notes TEXT
);

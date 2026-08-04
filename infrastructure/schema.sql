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
    dni             VARCHAR(20),
    phone           VARCHAR(50),
    residency       VARCHAR(256),
    azure_b2c_id    VARCHAR(256) DEFAULT '',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE distribution.users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(512);
ALTER TABLE distribution.users ADD COLUMN IF NOT EXISTS azure_b2c_id VARCHAR(256) DEFAULT '';
ALTER TABLE distribution.users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE distribution.users ADD COLUMN IF NOT EXISTS dni VARCHAR(20);
ALTER TABLE distribution.users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE distribution.users ADD COLUMN IF NOT EXISTS residency VARCHAR(256);

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

ALTER TABLE distribution.coffee_variants ADD COLUMN IF NOT EXISTS image_url VARCHAR(512);
ALTER TABLE distribution.coffee_variants ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE distribution.coffee_variants ADD COLUMN IF NOT EXISTS category VARCHAR(1) NOT NULL DEFAULT 'C';

-- Customers (must be created before sales due to FK reference)
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
    cycle_days      INT NOT NULL DEFAULT 30,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE distribution.customers ADD COLUMN IF NOT EXISTS nickname VARCHAR(256);
ALTER TABLE distribution.customers ADD COLUMN IF NOT EXISTS district VARCHAR(100);
ALTER TABLE distribution.customers ADD COLUMN IF NOT EXISTS dni VARCHAR(20);
ALTER TABLE distribution.customers ADD COLUMN IF NOT EXISTS ruc VARCHAR(20);
ALTER TABLE distribution.customers ADD COLUMN IF NOT EXISTS payment_mode VARCHAR(10) NOT NULL DEFAULT 'cash';
ALTER TABLE distribution.customers ADD COLUMN IF NOT EXISTS cycle_days INT NOT NULL DEFAULT 30;
ALTER TABLE distribution.customers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE distribution.customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

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

ALTER TABLE distribution.inventory ADD COLUMN IF NOT EXISTS reorder_point INT DEFAULT 10;
ALTER TABLE distribution.inventory ADD COLUMN IF NOT EXISTS updated_by INT REFERENCES distribution.users(id);

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
    gps_latitude            DECIMAL(9,6),
    gps_longitude           DECIMAL(9,6),
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE distribution.sales ADD COLUMN IF NOT EXISTS customer_id INT REFERENCES distribution.customers(id);
ALTER TABLE distribution.sales ADD COLUMN IF NOT EXISTS presentation VARCHAR(20) NOT NULL DEFAULT 'granel';
ALTER TABLE distribution.sales ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP;
ALTER TABLE distribution.sales ADD COLUMN IF NOT EXISTS expected_payment_date TIMESTAMP;
ALTER TABLE distribution.sales ADD COLUMN IF NOT EXISTS partial_payments DECIMAL(10,2) DEFAULT 0;
ALTER TABLE distribution.sales ADD COLUMN IF NOT EXISTS remanent_payment DECIMAL(10,2) DEFAULT 0;
ALTER TABLE distribution.sales ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending';
ALTER TABLE distribution.sales ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE distribution.sales ADD COLUMN IF NOT EXISTS gps_latitude DECIMAL(9,6);
ALTER TABLE distribution.sales ADD COLUMN IF NOT EXISTS gps_longitude DECIMAL(9,6);
ALTER TABLE distribution.sales ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

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

ALTER TABLE distribution.routes ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE distribution.routes ADD COLUMN IF NOT EXISTS route_date DATE NOT NULL DEFAULT CURRENT_DATE;

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

ALTER TABLE distribution.route_waypoints ADD COLUMN IF NOT EXISTS customer_name VARCHAR(256);
ALTER TABLE distribution.route_waypoints ADD COLUMN IF NOT EXISTS address VARCHAR(512);
ALTER TABLE distribution.route_waypoints ADD COLUMN IF NOT EXISTS estimated_arrival TIMESTAMP;
ALTER TABLE distribution.route_waypoints ADD COLUMN IF NOT EXISTS actual_arrival TIMESTAMP;
ALTER TABLE distribution.route_waypoints ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE distribution.route_waypoints ADD COLUMN IF NOT EXISTS notes TEXT;

-- GPS location tracking
CREATE TABLE IF NOT EXISTS distribution.gps_locations (
    id          BIGSERIAL PRIMARY KEY,
    seller_id   INT NOT NULL REFERENCES distribution.users(id),
    latitude    DECIMAL(9,6) NOT NULL,
    longitude   DECIMAL(9,6) NOT NULL,
    accuracy    DECIMAL(5,2),
    timestamp   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

ALTER TABLE distribution.complaints ADD COLUMN IF NOT EXISTS customer_name VARCHAR(256);
ALTER TABLE distribution.complaints ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;
ALTER TABLE distribution.complaints ADD COLUMN IF NOT EXISTS resolution_notes TEXT;

-- Products catalog (admin manages, sellers pick from)
CREATE TABLE IF NOT EXISTS distribution.products (
    id                  SERIAL PRIMARY KEY,
    name                VARCHAR(256) NOT NULL,
    description         TEXT,
    presentation        VARCHAR(50) NOT NULL,
    recommended_price   DECIMAL(10,2) NOT NULL,
    category            VARCHAR(1) DEFAULT 'C' CHECK (category IN ('A', 'B', 'C')),
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE distribution.products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE distribution.products ADD COLUMN IF NOT EXISTS category VARCHAR(1) DEFAULT 'C';
ALTER TABLE distribution.products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Seller product assignments (seller picks products and sets their own price)
CREATE TABLE IF NOT EXISTS distribution.seller_products (
    id                  SERIAL PRIMARY KEY,
    seller_id           INT NOT NULL REFERENCES distribution.users(id),
    product_id          INT NOT NULL REFERENCES distribution.products(id),
    real_price          DECIMAL(10,2) NOT NULL,
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(seller_id, product_id)
);

ALTER TABLE distribution.seller_products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

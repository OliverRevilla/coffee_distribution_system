-- ============================================================
-- Coffee Distribution System - Database Schema
-- Version: 1.0.0
-- ============================================================

-- Users table (synced from Azure AD B2C)
CREATE TABLE Users (
    id              INT PRIMARY KEY IDENTITY,
    email           NVARCHAR(256) NOT NULL UNIQUE,
    full_name       NVARCHAR(256) NOT NULL,
    role            NVARCHAR(20) NOT NULL CHECK (role IN ('admin', 'seller')),
    status          NVARCHAR(20) NOT NULL DEFAULT 'active',
    azure_b2c_id    NVARCHAR(256) NOT NULL UNIQUE,
    created_at      DATETIME2 DEFAULT SYSUTCDATETIME()
);

-- Coffee variants
CREATE TABLE CoffeeVariants (
    id              INT PRIMARY KEY IDENTITY,
    name            NVARCHAR(256) NOT NULL,
    description     NVARCHAR(MAX),
    sku             NVARCHAR(50) NOT NULL UNIQUE,
    price           DECIMAL(10,2) NOT NULL,
    image_url       NVARCHAR(512),
    is_active       BIT DEFAULT 1,
    created_at      DATETIME2 DEFAULT SYSUTCDATETIME()
);

-- Inventory tracking
CREATE TABLE Inventory (
    id                  INT PRIMARY KEY IDENTITY,
    variant_id          INT NOT NULL REFERENCES CoffeeVariants(id),
    quantity            INT NOT NULL DEFAULT 0,
    warehouse_location  NVARCHAR(256),
    reorder_point       INT DEFAULT 10,
    last_updated        DATETIME2 DEFAULT SYSUTCDATETIME(),
    updated_by          INT REFERENCES Users(id)
);

-- Sales records
CREATE TABLE Sales (
    id              INT PRIMARY KEY IDENTITY,
    seller_id       INT NOT NULL REFERENCES Users(id),
    variant_id      INT NOT NULL REFERENCES CoffeeVariants(id),
    quantity        INT NOT NULL,
    unit_price      DECIMAL(10,2) NOT NULL,
    total_amount    DECIMAL(10,2) NOT NULL,
    customer_name   NVARCHAR(256),
    customer_address NVARCHAR(512),
    gps_latitude    DECIMAL(9,6),
    gps_longitude   DECIMAL(9,6),
    sale_date       DATETIME2 DEFAULT SYSUTCDATETIME(),
    notes           NVARCHAR(MAX)
);

-- Delivery routes
CREATE TABLE Routes (
    id                  INT PRIMARY KEY IDENTITY,
    name                NVARCHAR(256) NOT NULL,
    description         NVARCHAR(MAX),
    assigned_seller_id  INT REFERENCES Users(id),
    status              NVARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending', 'in_progress', 'completed')),
    route_date          DATE NOT NULL,
    created_at          DATETIME2 DEFAULT SYSUTCDATETIME()
);

-- Route waypoints (delivery stops)
CREATE TABLE RouteWaypoints (
    id                  INT PRIMARY KEY IDENTITY,
    route_id            INT NOT NULL REFERENCES Routes(id) ON DELETE CASCADE,
    sequence            INT NOT NULL,
    customer_name       NVARCHAR(256),
    address             NVARCHAR(512),
    latitude            DECIMAL(9,6) NOT NULL,
    longitude           DECIMAL(9,6) NOT NULL,
    estimated_arrival   DATETIME2,
    actual_arrival      DATETIME2,
    status              NVARCHAR(20) DEFAULT 'pending'
                        CHECK (status IN ('pending', 'visited', 'skipped')),
    notes               NVARCHAR(MAX)
);

-- GPS location tracking
CREATE TABLE GPSLocations (
    id          BIGINT PRIMARY KEY IDENTITY,
    seller_id   INT NOT NULL REFERENCES Users(id),
    latitude    DECIMAL(9,6) NOT NULL,
    longitude   DECIMAL(9,6) NOT NULL,
    accuracy    DECIMAL(5,2),
    timestamp   DATETIME2 DEFAULT SYSUTCDATETIME()
);

-- Complaints
CREATE TABLE Complaints (
    id              INT PRIMARY KEY IDENTITY,
    seller_id       INT NOT NULL REFERENCES Users(id),
    customer_name   NVARCHAR(256),
    subject         NVARCHAR(256) NOT NULL,
    description     NVARCHAR(MAX) NOT NULL,
    category        NVARCHAR(50) CHECK (category IN ('quality', 'delivery', 'pricing', 'other')),
    status          NVARCHAR(20) DEFAULT 'open'
                    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority        NVARCHAR(10) DEFAULT 'medium'
                    CHECK (priority IN ('low', 'medium', 'high')),
    created_at      DATETIME2 DEFAULT SYSUTCDATETIME(),
    resolved_at     DATETIME2,
    resolution_notes NVARCHAR(MAX)
);

-- Indexes for performance
CREATE INDEX IX_Sales_SellerId ON Sales(seller_id);
CREATE INDEX IX_Sales_SaleDate ON Sales(sale_date);
CREATE INDEX IX_Sales_VariantId ON Sales(variant_id);
CREATE INDEX IX_Inventory_VariantId ON Inventory(variant_id);
CREATE INDEX IX_Routes_AssignedSellerId ON Routes(assigned_seller_id);
CREATE INDEX IX_Routes_RouteDate ON Routes(route_date);
CREATE INDEX IX_RouteWaypoints_RouteId ON RouteWaypoints(route_id);
CREATE INDEX IX_GPSLocations_SellerId ON GPSLocations(seller_id);
CREATE INDEX IX_GPSLocations_Timestamp ON GPSLocations(timestamp);
CREATE INDEX IX_Complaints_SellerId ON Complaints(seller_id);
CREATE INDEX IX_Complaints_Status ON Complaints(status);

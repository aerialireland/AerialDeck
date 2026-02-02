-- AerialDeck Database Schema
-- IAA Compliant Record Keeping

-- Flight Plans (created in Dronedeck, referenced here)
CREATE TABLE IF NOT EXISTS flight_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date DATE,
    location TEXT,
    status TEXT DEFAULT 'Open',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Flight Logs (IAA Section 11.2 compliant)
CREATE TABLE IF NOT EXISTS flight_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    flight_plan_id INTEGER,
    date_time_utc DATETIME NOT NULL,
    air_time_minutes REAL,
    pic TEXT NOT NULL,
    assistant TEXT,
    fts_activation INTEGER DEFAULT 0,
    flight_mode TEXT CHECK(flight_mode IN ('N', 'C', 'S')),
    latitude REAL,
    longitude REAL,
    takeoff_landing_address TEXT,
    drone TEXT NOT NULL,
    battery TEXT,
    accident_or_incident TEXT,
    defects_or_rectification TEXT,
    repairs_changes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (flight_plan_id) REFERENCES flight_plans(id)
);

-- Pilots (IAA requires up-to-date pilot list)
CREATE TABLE IF NOT EXISTS pilots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT,
    license_number TEXT,
    license_expiry DATE,
    a2_cert_number TEXT,
    a2_cert_expiry DATE,
    sts_cert_number TEXT,
    sts_cert_expiry DATE,
    medical_expiry DATE,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Drones (IAA requires UAS identification records)
CREATE TABLE IF NOT EXISTS drones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    manufacturer TEXT,
    model TEXT,
    serial_number TEXT UNIQUE,
    registration_number TEXT,
    purchase_date DATE,
    status TEXT DEFAULT 'Active',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Batteries
CREATE TABLE IF NOT EXISTS batteries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    serial TEXT UNIQUE NOT NULL,
    name TEXT,
    drone_id INTEGER,
    purchase_date DATE,
    cycles INTEGER DEFAULT 0,
    health INTEGER DEFAULT 100,
    status TEXT DEFAULT 'Active',
    last_charged DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (drone_id) REFERENCES drones(id)
);

-- Maintenance Logs (IAA Section 11.3)
CREATE TABLE IF NOT EXISTS maintenance_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    drone_id INTEGER,
    date DATE NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    performed_by TEXT,
    status TEXT DEFAULT 'Completed',
    next_due DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (drone_id) REFERENCES drones(id)
);

-- Training Logs (IAA Section 11.3)
CREATE TABLE IF NOT EXISTS training_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pilot_id INTEGER,
    date DATE NOT NULL,
    course TEXT NOT NULL,
    provider TEXT,
    hours REAL,
    certificate TEXT,
    expiry DATE,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pilot_id) REFERENCES pilots(id)
);

-- Incidents/Accidents (IAA Section 10 & 11.3)
CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    flight_log_id INTEGER,
    date DATE NOT NULL,
    type TEXT CHECK(type IN ('Incident', 'Accident', 'Serious Incident')),
    description TEXT NOT NULL,
    reported_to_iaa INTEGER DEFAULT 0,
    iaa_reference TEXT,
    outcome TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (flight_log_id) REFERENCES flight_logs(id)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_flight_logs_plan ON flight_logs(flight_plan_id);
CREATE INDEX IF NOT EXISTS idx_flight_logs_date ON flight_logs(date_time_utc);
CREATE INDEX IF NOT EXISTS idx_flight_logs_pic ON flight_logs(pic);
CREATE INDEX IF NOT EXISTS idx_maintenance_drone ON maintenance_logs(drone_id);
CREATE INDEX IF NOT EXISTS idx_training_pilot ON training_logs(pilot_id);

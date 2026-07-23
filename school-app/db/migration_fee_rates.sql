-- Adds a single-row configurable rates table the Director can edit any time.
-- Values persist until explicitly changed (no auto-reset, no history needed for now).

CREATE TABLE IF NOT EXISTS fee_rates (
    id                     INTEGER PRIMARY KEY DEFAULT 1,
    canteen_rate_per_student NUMERIC(10,2) NOT NULL DEFAULT 5.00,
    bus_rate_per_student     NUMERIC(10,2) NOT NULL DEFAULT 3.00,
    anomaly_threshold_pct    NUMERIC(5,2) NOT NULL DEFAULT 70.00,
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO fee_rates (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
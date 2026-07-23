-- School Management & Financial Tracker — Core Schema
-- Run once against school_app_db

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- gen_random_uuid()

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(120) NOT NULL,
    email         VARCHAR(160) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          VARCHAR(20) NOT NULL CHECK (role IN ('teacher', 'director')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS classes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_name VARCHAR(120) NOT NULL,
    teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id      UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    date          DATE NOT NULL DEFAULT CURRENT_DATE,
    present_count INTEGER NOT NULL CHECK (present_count >= 0),
    absent_count  INTEGER NOT NULL CHECK (absent_count >= 0),
    submitted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Enforces "exactly ONE report per class per day" at the DB level,
    -- not just in application logic.
    UNIQUE (class_id, date)
);

CREATE TABLE IF NOT EXISTS daily_finances (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_id           UUID NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
    tuition_arrears  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tuition_arrears >= 0),
    canteen_fees     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (canteen_fees >= 0),
    bus_fares        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (bus_fares >= 0),
    total_calculated NUMERIC(12,2) NOT NULL,
    submitted_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON daily_logs(date);
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);

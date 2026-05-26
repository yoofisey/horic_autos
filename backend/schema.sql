PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL CHECK (year BETWEEN 1980 AND 2100),
  price INTEGER NOT NULL CHECK (price >= 0),
  condition TEXT NOT NULL CHECK (condition IN ('new', 'used')),
  status TEXT NOT NULL DEFAULT 'In Stock',
  body_type TEXT NOT NULL,
  fuel TEXT NOT NULL CHECK (fuel IN ('petrol', 'diesel', 'hybrid', 'electric')),
  mileage INTEGER NOT NULL DEFAULT 0 CHECK (mileage >= 0),
  engine TEXT NOT NULL DEFAULT 'N/A',
  transmission TEXT NOT NULL CHECK (transmission IN ('automatic', 'manual')),
  description TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vehicle_images (
  id INTEGER PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS running_costs (
  vehicle_id INTEGER PRIMARY KEY REFERENCES vehicles(id) ON DELETE CASCADE,
  fuel_monthly INTEGER NOT NULL CHECK (fuel_monthly >= 0),
  maintenance_monthly INTEGER NOT NULL CHECK (maintenance_monthly >= 0),
  insurance_monthly INTEGER NOT NULL CHECK (insurance_monthly >= 0),
  total_monthly INTEGER NOT NULL CHECK (total_monthly >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS enquiries (
  id INTEGER PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  message TEXT NOT NULL,
  buyer_income INTEGER DEFAULT 0 CHECK (buyer_income >= 0),
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_notifications (
  id INTEGER PRIMARY KEY,
  enquiry_id INTEGER REFERENCES enquiries(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_enquiries_status_created ON enquiries(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_status_created ON admin_notifications(status, created_at DESC);

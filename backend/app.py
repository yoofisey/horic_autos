import json
import os
import re
import sqlite3
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "horic_autos.sqlite3"
SCHEMA_PATH = BASE_DIR / "schema.sql"
ADMIN_TOKEN = os.environ.get("HORIC_ADMIN_TOKEN", "change-this-admin-token")
ALLOWED_ORIGIN = os.environ.get("HORIC_ALLOWED_ORIGIN", "http://127.0.0.1:4173")
RATE_LIMIT_WINDOW = 60
RATE_LIMIT_MAX = 30
RATE_LIMITS = {}


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with db() as conn:
        conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))


def clean_text(value, limit=500):
    text = str(value or "").strip()
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    return text[:limit]


def json_response(handler, status, payload):
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    security_headers(handler)
    handler.end_headers()
    handler.wfile.write(body)


def security_headers(handler):
    handler.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
    handler.send_header("Access-Control-Allow-Headers", "Content-Type, X-Admin-Token")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
    handler.send_header("X-Content-Type-Options", "nosniff")
    handler.send_header("X-Frame-Options", "DENY")
    handler.send_header("Referrer-Policy", "no-referrer")
    handler.send_header("Content-Security-Policy", "default-src 'self'")
    handler.send_header("Cache-Control", "no-store")


def read_json(handler):
    length = int(handler.headers.get("Content-Length", "0"))
    if length > 64_000:
        raise ValueError("Request is too large.")
    return json.loads(handler.rfile.read(length) or b"{}")


def authorized(handler):
    return handler.headers.get("X-Admin-Token") == ADMIN_TOKEN


def rate_limited(handler):
    ip = handler.client_address[0]
    now = time.time()
    bucket = [stamp for stamp in RATE_LIMITS.get(ip, []) if now - stamp < RATE_LIMIT_WINDOW]
    bucket.append(now)
    RATE_LIMITS[ip] = bucket
    return len(bucket) > RATE_LIMIT_MAX


def running_cost_for(vehicle):
    price = int(vehicle["price"] or 0)
    fuel = 180 if vehicle["fuel"] == "electric" else 520 if vehicle["fuel"] == "diesel" else 390 if vehicle["fuel"] == "hybrid" else 680
    maintenance = 80 if vehicle["fuel"] == "electric" else 120 if vehicle["condition"] == "new" else 360 if vehicle["body_type"] == "truck" else 280
    insurance = round(price * 0.002)
    return {"fuel_monthly": fuel, "maintenance_monthly": maintenance, "insurance_monthly": insurance, "total_monthly": fuel + maintenance + insurance}


def inventory_knowledge():
    with db() as conn:
        rows = conn.execute(
            """
            SELECT v.*, COALESCE(rc.total_monthly, 0) AS total_monthly
            FROM vehicles v
            LEFT JOIN running_costs rc ON rc.vehicle_id = v.id
            ORDER BY v.price ASC
            """
        ).fetchall()
    return [dict(row) for row in rows]


def ai_reply(prompt):
    text = clean_text(prompt, 1000).lower()
    numbers = [int(num) for num in re.findall(r"\d{4,9}", text.replace(",", ""))]
    income = next((num for num in numbers if num < 100000 and re.search(r"income|earn|salary|month", text)), 0)
    budget = next((num for num in numbers if num >= 30000 and re.search(r"budget|cash|afford|price|have", text)), 0)
    vehicles = inventory_knowledge()
    if budget:
        vehicles = [v for v in vehicles if int(v["price"]) <= budget]
    if "family" in text or "suv" in text:
        vehicles = [v for v in vehicles if v["body_type"] in ("suv", "sedan", "van")]
    if "cheap" in text or "fuel" in text or "daily" in text:
        vehicles = [v for v in vehicles if v["fuel"] in ("hybrid", "electric", "diesel") or int(v["price"]) < 180000]
    vehicles = sorted(vehicles, key=lambda v: int(v["total_monthly"] or 0) + int(v["price"]) / 600)
    if not vehicles:
        return "I do not have a current vehicle that fits those numbers. Ask Horic to source a lower-cost option."
    ceiling = f" Your comfort ceiling is about GHS {round(income * 0.25):,}/mo." if income else ""
    picks = "\n".join(
        f"{v['year']} {v['make']} {v['model']}: GHS {int(v['price']):,}, about GHS {int(v['total_monthly'] or 0):,}/mo running cost."
        for v in vehicles[:3]
    )
    return f"I checked current prices and running costs.{ceiling}\n{picks}"


class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        security_headers(self)
        self.end_headers()

    def do_GET(self):
        if rate_limited(self):
            return json_response(self, 429, {"error": "Too many requests."})
        path = urlparse(self.path).path
        if path == "/api/admin/enquiries":
            if not authorized(self):
                return json_response(self, 401, {"error": "Unauthorized."})
            with db() as conn:
                rows = conn.execute("SELECT * FROM enquiries ORDER BY created_at DESC LIMIT 100").fetchall()
            return json_response(self, 200, {"enquiries": [dict(row) for row in rows]})
        if path == "/api/admin/notifications":
            if not authorized(self):
                return json_response(self, 401, {"error": "Unauthorized."})
            with db() as conn:
                rows = conn.execute("SELECT * FROM admin_notifications ORDER BY created_at DESC LIMIT 100").fetchall()
            return json_response(self, 200, {"notifications": [dict(row) for row in rows]})
        return json_response(self, 404, {"error": "Not found."})

    def do_POST(self):
        if rate_limited(self):
            return json_response(self, 429, {"error": "Too many requests."})
        path = urlparse(self.path).path
        try:
            payload = read_json(self)
        except Exception:
            return json_response(self, 400, {"error": "Invalid JSON."})

        if path == "/api/enquiries":
            message = clean_text(payload.get("message"), 1000)
            vehicle_id = int(payload.get("vehicle_id") or 0) or None
            if not message:
                return json_response(self, 400, {"error": "Message is required."})
            with db() as conn:
                cur = conn.execute(
                    """
                    INSERT INTO enquiries(vehicle_id, customer_name, customer_phone, customer_email, message, buyer_income)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        vehicle_id,
                        clean_text(payload.get("customer_name"), 120),
                        clean_text(payload.get("customer_phone"), 40),
                        clean_text(payload.get("customer_email"), 120),
                        message,
                        int(payload.get("buyer_income") or 0),
                    ),
                )
                enquiry_id = cur.lastrowid
                conn.execute(
                    "INSERT INTO admin_notifications(enquiry_id, title, body) VALUES (?, ?, ?)",
                    (enquiry_id, "New vehicle enquiry", message[:240]),
                )
            return json_response(self, 201, {"ok": True, "enquiry_id": enquiry_id})

        if path == "/api/ai/chat":
            return json_response(self, 200, {"reply": ai_reply(payload.get("message", ""))})

        if path == "/api/admin/push-subscriptions":
            if not authorized(self):
                return json_response(self, 401, {"error": "Unauthorized."})
            with db() as conn:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO push_subscriptions(endpoint, p256dh, auth, user_agent)
                    VALUES (?, ?, ?, ?)
                    """,
                    (
                        clean_text(payload.get("endpoint"), 1000),
                        clean_text(payload.get("p256dh"), 300),
                        clean_text(payload.get("auth"), 300),
                        clean_text(self.headers.get("User-Agent"), 300),
                    ),
                )
            return json_response(self, 201, {"ok": True})

        return json_response(self, 404, {"error": "Not found."})


if __name__ == "__main__":
    init_db()
    host = os.environ.get("HORIC_HOST", "127.0.0.1")
    port = int(os.environ.get("HORIC_PORT", "8080"))
    print(f"Horic backend running on http://{host}:{port}")
    ThreadingHTTPServer((host, port), Handler).serve_forever()

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
ALLOWED_ORIGIN = os.environ.get(
    "HORIC_ALLOWED_ORIGIN", "http://127.0.0.1:4173")
DEV_ORIGINS = {
    ALLOWED_ORIGIN,
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "http://127.0.0.1:4173",
    "http://localhost:4173",
    "null",
}
RATE_LIMIT_WINDOW = 60
RATE_LIMIT_MAX = 30
RATE_LIMITS = {}

# Ghana market knowledge base (May 2026)
# Sources: GOIL, NIC, COPEC, AutolastGH, CediRates, GhanaWeb
GHANA_KB = {
    "fuel": {
        # GOIL pump prices, May 2026 pricing window (GHS/litre)
        "petrol_per_litre": 16.50,       # approx mid-range across OMCs
        "diesel_per_litre": 17.10,       # GOIL Diesel XP, April 2026 window
        "lpg_per_kg": 10.71,             # national average
        "note": "Prices are reviewed every two weeks by GOIL/TotalEnergies/StarOil. "
                "Petrol ranges GHS 15.50–17.50/L; diesel GHS 16.00–17.50/L depending on OMC.",
    },

    # Typical litres consumed per 100 km by vehicle category
    "consumption_l_per_100km": {
        "saloon_petrol": 9.5,
        "saloon_diesel": 7.0,
        "suv_petrol": 13.0,
        "suv_diesel": 9.5,
        "pickup_diesel": 11.0,
        "hybrid": 5.5,
        "electric_kwh": 18,              # kWh/100 km — ECG rate ~GHS 1.60/kWh
    },

    # Average km driven per month in Ghana (Accra heavy traffic assumed)
    "avg_monthly_km": 2000,

    # Routine service intervals and typical costs at a reputable workshop
    "service": {
        "oil_change_interval_km": 5000,
        "oil_change_cost_ghs": {
            "synthetic_4L": 650,         # synthetic oil + OEM filter
            "mineral_4L": 320,           # mineral oil + generic filter
        },
        # oil + filter + air filter + plugs (petrol)
        "minor_service_ghs": 800,
        "major_service_ghs": 1800,       # adds timing belt, coolant flush, transmission fluid
        "ac_regas_ghs": 450,
        "tyre_rotation_ghs": 80,
        "alignment_ghs": 200,
    },

    # Tyre replacement (popular sizes, Accra tyre shops)
    "tyres": {
        "budget_per_tyre_ghs": 600,      # e.g. Roadstone, Austone
        "mid_per_tyre_ghs": 950,         # e.g. Bridgestone, Michelin imported
        "premium_per_tyre_ghs": 1500,    # e.g. Pirelli, Continental
        "note": "SUV/4x4 tyres cost 30–50% more than saloon sizes.",
    },

    # Common spare parts (Accra parts market / authorised dealers)
    "parts": {
        "brake_pads_front_ghs": 350,     # generic; OEM adds 40–80%
        "brake_discs_pair_ghs": 600,
        "shock_absorber_each_ghs": 800,
        "battery_60ah_ghs": 1100,
        "battery_75ah_ghs": 1400,
        "alternator_recon_ghs": 1200,
        "radiator_flush_kit_ghs": 180,
        "timing_belt_kit_ghs": 900,
        "labour_per_hour_ghs": 120,      # independent workshop rate; dealer 200–300/hr
        "note": "Japanese makes (Toyota, Honda, Nissan) have the most affordable "
                "parts in Ghana. European and American parts can cost 2–4× more.",
    },

    # Motor insurance (NIC tariff, effective Feb 2025 with 10% increase)
    "insurance": {
        "third_party_saloon_ghs_pa": 530,
        "third_party_suv_ghs_pa": 620,
        "third_party_pickup_ghs_pa": 680,
        # % of vehicle value per annum (typical)
        "comprehensive_rate_pct": 3.5,
        "comprehensive_min_ghs": 1200,   # minimum premium
        "major_insurers": "Enterprise Insurance, SIC Insurance, Star Assurance, Hollard Ghana",
    },

    # Road worthiness / annual costs
    "annual_charges": {
        "roadworthy_ghs": 250,           # DVLA road-worthiness certificate
        "vehicle_registration_renewal_ghs": 180,
        "drivers_licence_renewal_ghs": 80,
    },

    # Brand reliability notes for Ghana roads
    "reliability": {
        "best_for_parts_availability": ["Toyota", "Honda", "Nissan", "Hyundai", "Kia"],
        "pricier_parts": ["BMW", "Mercedes-Benz", "Audi", "Volkswagen", "Land Rover"],
        "good_for_potholed_roads": ["Toyota Land Cruiser", "Nissan Patrol", "Toyota Hilux",
                                    "Ford Ranger", "Isuzu D-Max"],
        "fuel_efficient_for_accra": ["Toyota Yaris", "Honda Fit", "Hyundai i10",
                                     "Toyota Prius", "Kia Picanto"],
    },
}

DEFAULT_VEHICLES = [
    {
        "id": 1,
        "make": "Toyota",
        "model": "Land Cruiser V8",
        "year": 2022,
        "price": 580000,
        "condition": "used",
        "status": "In Stock",
        "body_type": "suv",
        "fuel": "petrol",
        "mileage": 42000,
        "engine": "4500cc",
        "transmission": "automatic",
        "description": "Full spec, dual sunroof, 7-seater, low mileage. Excellent condition.",
    },
    {
        "id": 2,
        "make": "Toyota",
        "model": "Corolla Cross",
        "year": 2024,
        "price": 195000,
        "condition": "new",
        "status": "In Stock",
        "body_type": "suv",
        "fuel": "hybrid",
        "mileage": 0,
        "engine": "1800cc",
        "transmission": "automatic",
        "description": "Brand new hybrid SUV. Outstanding fuel economy. Ideal daily driver.",
    },
    {
        "id": 3,
        "make": "Hyundai",
        "model": "Tucson",
        "year": 2023,
        "price": 220000,
        "condition": "new",
        "status": "In Stock",
        "body_type": "suv",
        "fuel": "petrol",
        "mileage": 0,
        "engine": "2000cc",
        "transmission": "automatic",
        "description": "Panoramic roof, heated seats, ADAS safety suite, wireless CarPlay.",
    },
    {
        "id": 4,
        "make": "Toyota",
        "model": "Hilux Revo",
        "year": 2021,
        "price": 310000,
        "condition": "used",
        "status": "In Stock",
        "body_type": "truck",
        "fuel": "diesel",
        "mileage": 68000,
        "engine": "2800cc",
        "transmission": "automatic",
        "description": "Double cab, 4x4. Hardcover. Very clean. Well maintained.",
    },
    {
        "id": 5,
        "make": "Honda",
        "model": "Accord",
        "year": 2020,
        "price": 145000,
        "condition": "used",
        "status": "In Stock",
        "body_type": "sedan",
        "fuel": "petrol",
        "mileage": 55000,
        "engine": "1500cc",
        "transmission": "automatic",
        "description": "Turbocharged. Leather seats, Honda Sensing, reverse camera.",
    },
    {
        "id": 6,
        "make": "Tesla",
        "model": "Model 3",
        "year": 2023,
        "price": 420000,
        "condition": "new",
        "status": "In Stock",
        "body_type": "sedan",
        "fuel": "electric",
        "mileage": 0,
        "engine": "283kW",
        "transmission": "automatic",
        "description": "Long Range RWD. 560km range. Autopilot included.",
    },
    {
        "id": 7,
        "make": "Kia",
        "model": "Sportage",
        "year": 2024,
        "price": 210000,
        "condition": "new",
        "status": "In Stock",
        "body_type": "suv",
        "fuel": "petrol",
        "mileage": 0,
        "engine": "1600cc",
        "transmission": "automatic",
        "description": "Panoramic display, 360 camera, heated seats.",
    },
    {
        "id": 8,
        "make": "Nissan",
        "model": "Navara",
        "year": 2022,
        "price": 275000,
        "condition": "used",
        "status": "In Stock",
        "body_type": "truck",
        "fuel": "diesel",
        "mileage": 38000,
        "engine": "2300cc",
        "transmission": "manual",
        "description": "Single cab. Bull bar, tow hitch. Solid workhorse.",
    },
]


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with db() as conn:
        conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
        seed_inventory(conn)
        refresh_running_costs(conn)


def seed_inventory(conn):
    count = conn.execute("SELECT COUNT(*) FROM vehicles").fetchone()[0]
    if count:
        return
    conn.executemany(
        """
        INSERT INTO vehicles(
          id, make, model, year, price, condition, status, body_type,
          fuel, mileage, engine, transmission, description
        )
        VALUES (
          :id, :make, :model, :year, :price, :condition, :status, :body_type,
          :fuel, :mileage, :engine, :transmission, :description
        )
        """,
        DEFAULT_VEHICLES,
    )


def refresh_running_costs(conn):
    rows = conn.execute("SELECT * FROM vehicles").fetchall()
    for row in rows:
        vehicle = dict(row)
        costs = running_cost_for(vehicle)
        conn.execute(
            """
            INSERT INTO running_costs(
              vehicle_id, fuel_monthly, maintenance_monthly,
              insurance_monthly, total_monthly, updated_at
            )
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(vehicle_id) DO UPDATE SET
              fuel_monthly = excluded.fuel_monthly,
              maintenance_monthly = excluded.maintenance_monthly,
              insurance_monthly = excluded.insurance_monthly,
              total_monthly = excluded.total_monthly,
              updated_at = CURRENT_TIMESTAMP
            """,
            (
                vehicle["id"],
                costs["fuel_monthly"],
                costs["maintenance_monthly"],
                costs["insurance_monthly"],
                costs["total_monthly"],
            ),
        )


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
    handler.send_header("Access-Control-Allow-Origin", cors_origin(handler))
    handler.send_header("Vary", "Origin")
    handler.send_header("Access-Control-Allow-Headers",
                        "Content-Type, X-Admin-Token")
    handler.send_header("Access-Control-Allow-Methods",
                        "GET, POST, PATCH, OPTIONS")
    handler.send_header("X-Content-Type-Options", "nosniff")
    handler.send_header("X-Frame-Options", "DENY")
    handler.send_header("Referrer-Policy", "no-referrer")
    handler.send_header("Content-Security-Policy", "default-src 'self'")
    handler.send_header("Cache-Control", "no-store")


def cors_origin(handler):
    origin = handler.headers.get("Origin") or ALLOWED_ORIGIN
    if origin in DEV_ORIGINS or origin.startswith("http://127.0.0.1:") or origin.startswith("http://localhost:"):
        return origin
    return ALLOWED_ORIGIN


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
    bucket = [stamp for stamp in RATE_LIMITS.get(
        ip, []) if now - stamp < RATE_LIMIT_WINDOW]
    bucket.append(now)
    RATE_LIMITS[ip] = bucket
    return len(bucket) > RATE_LIMIT_MAX


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


# Cost calculators using Ghana KB

def calc_monthly_fuel(fuel_type, body_type, km=None):
    """Return estimated monthly fuel cost in GHS."""
    km = km or GHANA_KB["avg_monthly_km"]
    f = GHANA_KB["fuel"]
    c = GHANA_KB["consumption_l_per_100km"]

    if fuel_type == "electric":
        kwh = c["electric_kwh"] * km / 100
        return round(kwh * 1.60)  # ECG residential rate ~GHS 1.60/kWh

    if fuel_type == "hybrid":
        litres = c["hybrid"] * km / 100
        return round(litres * f["petrol_per_litre"])

    if fuel_type == "diesel":
        key = "suv_diesel" if body_type in ("suv", "truck", "pickup") else (
              "pickup_diesel" if body_type in ("van",) else "saloon_diesel")
        litres = c[key] * km / 100
        return round(litres * f["diesel_per_litre"])

    # petrol default
    key = "suv_petrol" if body_type in (
        "suv", "truck", "pickup", "van") else "saloon_petrol"
    litres = c[key] * km / 100
    return round(litres * f["petrol_per_litre"])


def calc_monthly_maintenance(fuel_type, condition, body_type, price):
    """Return estimated monthly maintenance provision in GHS."""
    svc = GHANA_KB["service"]
    # oil change frequency: every 5 000 km; at 2 000 km/mo = once every 2.5 mo
    oil_monthly = svc["oil_change_cost_ghs"]["synthetic_4L"] / 2.5

    # minor service every 10 000 km (~5 months)
    minor_monthly = svc["minor_service_ghs"] / 5

    # tyres: replace set every 40 000 km (~20 months for 4 tyres)
    tyre_unit = GHANA_KB["tyres"]["mid_per_tyre_ghs"]
    tyre_monthly = (tyre_unit * 4) / 20

    # brake pads every 25 000 km (~12.5 months)
    brakes_monthly = GHANA_KB["parts"]["brake_pads_front_ghs"] / 12.5

    base = oil_monthly + minor_monthly + tyre_monthly + brakes_monthly

    # Adjustments
    if fuel_type == "electric":
        base *= 0.55   # far fewer moving parts
    if condition == "new":
        base *= 0.75   # still under warranty, parts not worn
    if body_type in ("suv", "truck", "pickup"):
        base *= 1.30   # bigger parts, harder wear
    if condition == "used" and int(price or 0) < 120_000:
        base *= 1.40   # older vehicles need more attention

    return round(base)


def calc_monthly_insurance(body_type, price, comprehensive=False):
    ins = GHANA_KB["insurance"]
    if comprehensive:
        annual = max(ins["comprehensive_min_ghs"], price *
                     ins["comprehensive_rate_pct"] / 100)
    else:
        if body_type in ("suv", "truck", "pickup"):
            annual = ins["third_party_suv_ghs_pa"]
        elif body_type in ("van",):
            annual = ins["third_party_pickup_ghs_pa"]
        else:
            annual = ins["third_party_saloon_ghs_pa"]
    return round(annual / 12)


def running_cost_for(vehicle):
    price = int(vehicle["price"] or 0)
    fuel = calc_monthly_fuel(
        vehicle["fuel"], vehicle.get("body_type", "saloon"))
    maintenance = calc_monthly_maintenance(
        vehicle["fuel"], vehicle.get("condition", "used"),
        vehicle.get("body_type", "saloon"), price
    )
    insurance = calc_monthly_insurance(
        vehicle.get("body_type", "saloon"), price)
    return {
        "fuel_monthly": fuel,
        "maintenance_monthly": maintenance,
        "insurance_monthly": insurance,
        "total_monthly": fuel + maintenance + insurance,
    }


# Intent detection helpers

def extract_numbers(text):
    return [int(n) for n in re.findall(r"\d[\d,]*", text.replace(",", ""))]


def detect_intent(text):
    """Return a list of matched intents from the user message."""
    intents = []
    patterns = {
        "cost_table":       r"\b(all cars|all vehicles|every car|every vehicle|full inventory|cost table|running costs for all)\b",
        "fuel_price":       r"\b(fuel|petrol|diesel|pump price|litre|liter|lpg)\b",
        "insurance":        r"\b(insur|premium|third.?party|policy|cover|nif)\b",
        "maintenance":      r"\b(service|maintain|maintain|oil.?change|repair|workshop|mechanic|"
                            r"parts?|tyre|tire|brake|battery|shock|alternator)\b",
        "running_cost":     r"\b(running cost|monthly cost|how much to run|cost per month|"
                            r"afford|maintain monthly)\b",
        "budget_search":    r"\b(budget|afford|price|cost|how much|cheapest|within)\b",
        "fuel_efficiency":  r"\b(fuel.?effici|economical|consume|mileage|range|save fuel|"
                            r"best mpg|km per litre)\b",
        "reliability":      r"\b(reliable|last long|durable|parts.?availab|best brand|"
                            r"which car|recommend|good for ghana|ghana roads|pothole)\b",
        "compare":          r"\b(compare|vs\.?|versus|or|difference between|better)\b",
        "electric_hybrid":  r"\b(electric|ev|hybrid|plug.?in|ev.?car|ecg|charging)\b",
        "inventory_search": r"\b(stock|available|sell|do you have|looking for|want to buy|"
                            r"show me|list|find me)\b",
        "greeting":         r"^(hi|hello|hey|good\s+(morning|afternoon|evening)|how are you)\b",
        "financing":        r"\b(loan|finance|installment|monthly payment|hire purchase|leasing)\b",
        "registration":     r"\b(register|roadworth|dvla|number plate|documentation|papers)\b",
    }
    for intent, pattern in patterns.items():
        if re.search(pattern, text):
            intents.append(intent)
    return intents


# Intent handlers

def handle_fuel_price(text):
    f = GHANA_KB["fuel"]
    lines = [
        "⛽ Current Ghana fuel prices (GOIL / major OMCs, May 2026 window):",
        f"  • Petrol (Super/RON 91): ~GHS {f['petrol_per_litre']:.2f}/litre",
        f"  • Diesel (AGO/XP):       ~GHS {f['diesel_per_litre']:.2f}/litre",
        f"  • LPG:                   ~GHS {f['lpg_per_kg']:.2f}/kg",
        "",
        f"Prices are revised every two weeks. {f['note']}",
    ]
    return "\n".join(lines)


def handle_insurance(text):
    ins = GHANA_KB["insurance"]
    lines = [
        "🛡️ Motor Insurance in Ghana (NIC tariffs, effective Feb 2025):",
        f"  • Third-party (saloon):    GHS {ins['third_party_saloon_ghs_pa']:,}/year (~GHS {ins['third_party_saloon_ghs_pa']//12}/mo)",
        f"  • Third-party (SUV/4×4):   GHS {ins['third_party_suv_ghs_pa']:,}/year",
        f"  • Third-party (pickup/van): GHS {ins['third_party_pickup_ghs_pa']:,}/year",
        f"  • Comprehensive: ~{ins['comprehensive_rate_pct']}% of vehicle value per year "
        f"(minimum GHS {ins['comprehensive_min_ghs']:,})",
        "",
        f"Major insurers: {ins['major_insurers']}.",
        "Tip: Comprehensive cover is worth considering for newer or higher-value vehicles.",
    ]
    return "\n".join(lines)


def handle_maintenance(text):
    svc = GHANA_KB["service"]
    parts = GHANA_KB["parts"]
    lines = [
        "🔧 Typical maintenance costs in Ghana (Accra workshop rates, 2025–26):",
        "",
        "Routine services:",
        f"  • Oil change (synthetic 4L + filter): GHS {svc['oil_change_cost_ghs']['synthetic_4L']:,}",
        f"  • Oil change (mineral):               GHS {svc['oil_change_cost_ghs']['mineral_4L']:,}",
        f"  • Minor service (oil + air filter + plugs): GHS {svc['minor_service_ghs']:,}",
        f"  • Major service (inc. timing belt etc.):    GHS {svc['major_service_ghs']:,}",
        f"  • AC re-gas: GHS {svc['ac_regas_ghs']:,}   •  Wheel alignment: GHS {svc['alignment_ghs']:,}",
        "",
        "Common parts (supply + fit):",
        f"  • Front brake pads: GHS {parts['brake_pads_front_ghs']:,}",
        f"  • Brake discs (pair): GHS {parts['brake_discs_pair_ghs']:,}",
        f"  • Shock absorber (each): GHS {parts['shock_absorber_each_ghs']:,}",
        f"  • Car battery (60Ah): GHS {parts['battery_60ah_ghs']:,}",
        f"  • Alternator (reconditioned): GHS {parts['alternator_recon_ghs']:,}",
        f"  • Labour rate: ~GHS {parts['labour_per_hour_ghs']:,}/hr (independent); "
        f"GHS 200–300/hr (authorised dealer)",
        "",
        f"💡 {parts['note']}",
    ]
    return "\n".join(lines)


def handle_running_cost(text, vehicles):
    """Estimate monthly running cost for a named/described vehicle."""
    numbers = extract_numbers(text)
    price = next((n for n in numbers if n >= 30_000), 0)

    # Try to match a vehicle from inventory
    matched = None
    for v in vehicles:
        name = f"{v['year']} {v['make']} {v['model']}".lower()
        if v["make"].lower() in text or v["model"].lower() in text:
            matched = v
            break

    if matched:
        costs = running_cost_for(matched)
        v = matched
        lines = [
            f"📊 Estimated monthly running costs for {v['year']} {v['make']} {v['model']} "
            f"(GHS {int(v['price']):,}, {v.get('fuel', 'petrol')}, {v.get('body_type', 'saloon')}):",
            f"  • Fuel (≈{GHANA_KB['avg_monthly_km']:,} km/mo): GHS {costs['fuel_monthly']:,}",
            f"  • Maintenance provision:                        GHS {costs['maintenance_monthly']:,}",
            f"  • Insurance (third-party):                      GHS {costs['insurance_monthly']:,}",
            f"  ─────────────────────────────────────────────────────",
            f"  • Total estimated:                              GHS {costs['total_monthly']:,}/month",
            "",
            "Note: Actual costs vary with driving habits, road conditions and mechanic rates.",
        ]
        return "\n".join(lines)

    # Generic estimate by fuel type guess
    fuel = "diesel" if "diesel" in text else "hybrid" if "hybrid" in text or "prius" in text else "petrol"
    body = "suv" if any(w in text for w in (
        "suv", "4x4", "land", "cruiser", "hilux", "ranger")) else "saloon"
    fuel_cost = calc_monthly_fuel(fuel, body)
    maint = calc_monthly_maintenance(fuel, "used", body, price or 150_000)
    ins = calc_monthly_insurance(body, price or 150_000)
    lines = [
        f"📊 Estimated monthly running costs ({fuel.title()}, {body.title()}, ~{GHANA_KB['avg_monthly_km']:,} km/mo):",
        f"  • Fuel:        GHS {fuel_cost:,}",
        f"  • Maintenance: GHS {maint:,}",
        f"  • Insurance:   GHS {ins:,}",
        f"  • Total:       GHS {fuel_cost + maint + ins:,}/month",
        "",
        "Tell me the specific vehicle you have in mind for a more precise estimate.",
    ]
    return "\n".join(lines)


def handle_cost_table(vehicles):
    if not vehicles:
        return "I do not have inventory data loaded yet. Please check that the backend database has vehicles."

    lines = [
        "Current Horic Autos running-cost estimates:",
        "",
        f"{'Vehicle':<34} {'Fuel':>10} {'Maint.':>10} {'Ins.':>9} {'Total/mo':>10}",
        "-" * 78,
    ]
    for v in sorted(vehicles, key=lambda item: running_cost_for(item)["total_monthly"]):
        costs = running_cost_for(v)
        name = f"{v['year']} {v['make']} {v['model']}"[:34]
        lines.append(
            f"{name:<34} "
            f"GHS {costs['fuel_monthly']:>5,} "
            f"GHS {costs['maintenance_monthly']:>5,} "
            f"GHS {costs['insurance_monthly']:>4,} "
            f"GHS {costs['total_monthly']:>5,}"
        )
    lines += [
        "",
        f"Assumption: about {GHANA_KB['avg_monthly_km']:,} km/month in Ghana driving conditions.",
    ]
    return "\n".join(lines)


def handle_fuel_efficiency(text):
    c = GHANA_KB["consumption_l_per_100km"]
    f = GHANA_KB["fuel"]
    km = GHANA_KB["avg_monthly_km"]
    lines = [
        "⚡ Fuel efficiency guide for Ghana (estimates at 2,000 km/month):",
        "",
        f"  {'Category':<28} {'L/100km':<10} {'Monthly fuel cost (GHS)'}",
        f"  {'─'*65}",
    ]
    categories = [
        ("Saloon – Petrol", c["saloon_petrol"], f["petrol_per_litre"]),
        ("Saloon – Diesel", c["saloon_diesel"], f["diesel_per_litre"]),
        ("SUV/Pickup – Petrol", c["suv_petrol"], f["petrol_per_litre"]),
        ("SUV/Pickup – Diesel", c["suv_diesel"], f["diesel_per_litre"]),
        ("Hybrid (e.g. Prius)", c["hybrid"], f["petrol_per_litre"]),
    ]
    for label, cons, price_per_l in categories:
        monthly = round(cons * km / 100 * price_per_l)
        lines.append(f"  {label:<28} {cons:<10} GHS {monthly:,}")
    lines += [
        "",
        "💡 Most fuel-efficient picks in the Ghanaian market: Toyota Prius, "
        "Honda Fit, Hyundai i10, Toyota Yaris, Kia Picanto.",
    ]
    return "\n".join(lines)


def handle_reliability(text):
    rel = GHANA_KB["reliability"]
    lines = [
        "🏆 Vehicle reliability & parts availability in Ghana:",
        "",
        "✅ Best for parts availability & affordability:",
        "   " + ", ".join(rel["best_for_parts_availability"]),
        "",
        "⚠️  European/American brands (pricier parts, fewer workshops):",
        "   " + ", ".join(rel["pricier_parts"]),
        "",
        "🚙 Best for Ghana's roads (potholes, flooding, rough terrain):",
        "   " + ", ".join(rel["good_for_potholed_roads"]),
        "",
        "🏙️ Most fuel-efficient for Accra traffic:",
        "   " + ", ".join(rel["fuel_efficient_for_accra"]),
        "",
        "General rule: Toyota and Honda models hold their value best in Ghana "
        "and have the widest network of mechanics and spare parts depots.",
    ]
    return "\n".join(lines)


def handle_financing(text):
    numbers = extract_numbers(text)
    price = next((n for n in numbers if n >= 30_000), 0)
    income = next((n for n in numbers if n < 50_000 and re.search(
        r"earn|income|salary", text)), 0)
    lines = [
        "💳 Car financing in Ghana — what to know:",
        "",
        "Common options:",
        "  • Bank hire purchase: typically 25–30% deposit + 24–36 months repayment",
        "  • Interest rates: ~28–34% per annum (varies by bank, 2025 rates)",
        "  • Major lenders: CalBank, Absa, Stanbic, GCB, Fidelity, Republic Bank",
        "  • Dealer in-house financing: sometimes available, usually shorter terms",
    ]
    if price and income:
        max_monthly = round(income * 0.25)
        deposit = round(price * 0.28)
        loan = price - deposit
        # simple approximation: 30% pa, 36 months
        monthly_rate = 0.30 / 12
        n = 36
        repayment = round(loan * monthly_rate / (1 - (1 + monthly_rate) ** -n))
        total_monthly = repayment + calc_monthly_insurance("saloon", price) + \
            calc_monthly_fuel("petrol", "saloon") + \
            calc_monthly_maintenance("petrol", "used", "saloon", price)
        lines += [
            "",
            f"📐 For a GHS {price:,} vehicle on your income of GHS {income:,}/mo:",
            f"  • Suggested deposit (28%): GHS {deposit:,}",
            f"  • Estimated loan repayment (36 mo, ~30% pa): GHS {repayment:,}/mo",
            f"  • + Running costs (fuel, service, insurance): ~GHS {total_monthly - repayment:,}/mo",
            f"  • Total monthly commitment: ~GHS {total_monthly:,}",
            f"  • Your 25% income ceiling: GHS {max_monthly:,}/mo",
        ]
        if total_monthly > max_monthly:
            lines.append(
                f"\n  ⚠️  That exceeds a comfortable 25% ceiling by GHS {total_monthly - max_monthly:,}. "
                "Consider a lower price point or larger deposit."
            )
        else:
            lines.append(
                f"\n  ✅ Within a comfortable budget. You have GHS {max_monthly - total_monthly:,} headroom."
            )
    else:
        lines.append(
            "\nTell me the vehicle price and your monthly income for a personalised estimate.")
    return "\n".join(lines)


def handle_registration(text):
    ch = GHANA_KB["annual_charges"]
    lines = [
        "📋 Vehicle documentation & annual charges in Ghana (DVLA, 2025):",
        "",
        f"  • Road-worthiness certificate:  GHS {ch['roadworthy_ghs']:,}/year",
        f"  • Vehicle registration renewal: GHS {ch['vehicle_registration_renewal_ghs']:,}/year",
        f"  • Driver's licence renewal:     GHS {ch['drivers_licence_renewal_ghs']:,}/year",
        "",
        "New registration (imported vehicle):",
        "  • Import duty: 5–20% of CIF value (depends on engine size & age)",
        "  • VAT (NHIL + GETFund): 21.9% of (CIF + duty)",
        "  • ECOWAS levy, EXIM levy, and other charges add ~5–8%",
        "  • Authorised clearing agents charge GHS 2,000–5,000 service fee",
        "",
        "💡 Vehicles over 10 years old attract higher duty rates under Ghana Revenue Authority rules.",
    ]
    return "\n".join(lines)


def handle_inventory_search(text, vehicles):
    """Filter and recommend from live inventory."""
    numbers = extract_numbers(text)
    budget = next((n for n in numbers if n >= 30_000), 0)
    income = next((n for n in numbers if n < 100_000 and re.search(
        r"income|earn|salary|month", text)), 0)

    filtered = list(vehicles)
    if budget:
        filtered = [v for v in filtered if int(v["price"]) <= budget]
    if "family" in text or "suv" in text or "space" in text:
        filtered = [v for v in filtered if v.get(
            "body_type") in ("suv", "sedan", "van")]
    if any(w in text for w in ("cheap", "econom", "daily", "fuel", "save")):
        filtered = [v for v in filtered if v.get("fuel") in ("hybrid", "electric", "diesel")
                    or int(v["price"]) < 180_000]
    if "diesel" in text:
        filtered = [v for v in filtered if v.get("fuel") == "diesel"]
    if "electric" in text or " ev " in text:
        filtered = [v for v in filtered if v.get("fuel") == "electric"]
    if "hybrid" in text:
        filtered = [v for v in filtered if v.get("fuel") == "hybrid"]

    filtered = sorted(filtered, key=lambda v: int(
        v.get("total_monthly") or 0) + int(v["price"]) / 600)

    if not filtered:
        return ("I don't have a vehicle matching those filters in stock right now. "
                "Contact Horic directly — they can source specific vehicles to order.")

    ceiling = (f" Your comfortable spending ceiling is about GHS {round(income * 0.25):,}/mo "
               f"(25% of stated income)." if income else "")
    lines = [f"🚗 Best matches from current inventory:{ceiling}", ""]
    for v in filtered[:3]:
        costs = running_cost_for(v)
        lines.append(
            f"  {v['year']} {v['make']} {v['model']} ({v.get('condition', '').title()}, "
            f"{v.get('fuel', '').title()})"
        )
        lines.append(
            f"  Price: GHS {int(v['price']):,}  •  Est. running cost: GHS {costs['total_monthly']:,}/mo")
        lines.append("")
    lines.append("Reply with a specific model to get a full cost breakdown.")
    return "\n".join(lines)


def handle_compare(text, vehicles):
    """Basic comparison between two makes/models mentioned."""
    # extract make/model tokens
    tokens = re.findall(r"\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b", text.title())
    matched = []
    for v in vehicles:
        for tok in tokens:
            if tok.lower() in v["make"].lower() or tok.lower() in v["model"].lower():
                if v not in matched:
                    matched.append(v)
    if len(matched) < 2:
        return ("Tell me the two vehicles you'd like to compare — e.g. "
                "'compare Toyota Corolla vs Honda Civic' and I'll break down the costs.")
    lines = ["⚖️  Side-by-side cost comparison:", ""]
    for v in matched[:2]:
        costs = running_cost_for(v)
        lines += [
            f"  {v['year']} {v['make']} {v['model']}",
            f"    Price:       GHS {int(v['price']):,}",
            f"    Fuel:        GHS {costs['fuel_monthly']:,}/mo",
            f"    Maintenance: GHS {costs['maintenance_monthly']:,}/mo",
            f"    Insurance:   GHS {costs['insurance_monthly']:,}/mo",
            f"    Total:       GHS {costs['total_monthly']:,}/mo",
            "",
        ]
    cheaper = min(matched[:2], key=lambda v: running_cost_for(v)[
                  "total_monthly"])
    lines.append(
        f"💡 {cheaper['make']} {cheaper['model']} has the lower monthly running cost.")
    return "\n".join(lines)


def handle_electric_hybrid(text):
    lines = [
        "🔋 Electric & hybrid vehicles in Ghana — what you should know:",
        "",
        "Fuel savings vs petrol:",
        f"  • Hybrid (e.g. Toyota Prius): ~GHS {calc_monthly_fuel('hybrid', 'saloon'):,}/mo vs "
        f"GHS {calc_monthly_fuel('petrol', 'saloon'):,}/mo for equivalent petrol — saves ~40%",
        f"  • Full EV: ECG electricity at ~GHS 1.60/kWh — "
        f"about GHS {calc_monthly_fuel('electric', 'saloon'):,}/mo",
        "",
        "Considerations for Ghana:",
        "  • EVs: Limited public charging — mostly home charging (ECG single-phase 240 V)",
        "  • Load shedding (dumsor) can reduce EV practicality — consider solar backup",
        "  • Hybrid: No charging needed; regenerative braking suits stop-start Accra traffic",
        "  • Parts: Toyota hybrid batteries are available locally; pure EV parts may need importing",
        "  • Resale value: Hybrids hold value well; EV resale market is still developing",
        "",
        "💡 Best compromise for Ghana right now: Toyota Prius or Lexus CT200h hybrid.",
    ]
    return "\n".join(lines)


def handle_greeting():
    return ("Hello! I'm the Horic Autos assistant. I can help you with:\n"
            "  • Fuel prices & running costs in Ghana\n"
            "  • Vehicle maintenance & spare parts costs\n"
            "  • Insurance premiums (NIC 2025 rates)\n"
            "  • Finding the right car from our inventory\n"
            "  • Financing estimates & registration charges\n"
            "  • Comparing models or checking fuel efficiency\n\n"
            "What can I help you with today?")


# Main AI reply router

def ai_reply(prompt):
    text = clean_text(prompt, 1500).lower()
    intents = detect_intent(text)
    vehicles = inventory_knowledge()

    # Priority routing — most specific first
    if "greeting" in intents and len(intents) == 1:
        return handle_greeting()
    if "cost_table" in intents:
        return handle_cost_table(vehicles)
    if "fuel_price" in intents and "running_cost" not in intents and "inventory_search" not in intents:
        return handle_fuel_price(text)
    if "insurance" in intents and "running_cost" not in intents:
        return handle_insurance(text)
    if "maintenance" in intents and "running_cost" not in intents:
        return handle_maintenance(text)
    if "electric_hybrid" in intents and "running_cost" not in intents:
        return handle_electric_hybrid(text)
    if "fuel_efficiency" in intents:
        return handle_fuel_efficiency(text)
    if "reliability" in intents:
        return handle_reliability(text)
    if "financing" in intents:
        return handle_financing(text)
    if "registration" in intents:
        return handle_registration(text)
    if "compare" in intents:
        return handle_compare(text, vehicles)
    if "running_cost" in intents:
        return handle_running_cost(text, vehicles)
    if "inventory_search" in intents or "budget_search" in intents:
        return handle_inventory_search(text, vehicles)

    # Fallback: try inventory search for any car-related message
    if any(w in text for w in ("car", "vehicle", "auto", "drive", "buy", "toyota",
                               "honda", "nissan", "hyundai", "ford", "vw", "benz",
                               "bmw", "kia", "lexus", "isuzu", "mitsubishi")):
        return handle_inventory_search(text, vehicles)

    return ("I'm here to help with anything car-related in Ghana — running costs, fuel prices, "
            "insurance, maintenance, financing, or finding a vehicle. "
            "Could you tell me more about what you're looking for?")


# HTTP handler (unchanged structure)
class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # suppress default access log noise

    def do_OPTIONS(self):
        self.send_response(204)
        security_headers(self)
        self.end_headers()

    def do_GET(self):
        if rate_limited(self):
            return json_response(self, 429, {"error": "Too many requests."})
        path = urlparse(self.path).path
        if path == "/api/health":
            return json_response(self, 200, {"ok": True})
        if path == "/api/inventory":
            return json_response(self, 200, {"vehicles": inventory_knowledge()})
        if path == "/api/admin/enquiries":
            if not authorized(self):
                return json_response(self, 401, {"error": "Unauthorized."})
            with db() as conn:
                rows = conn.execute(
                    "SELECT * FROM enquiries ORDER BY created_at DESC LIMIT 100").fetchall()
            return json_response(self, 200, {"enquiries": [dict(row) for row in rows]})
        if path == "/api/admin/notifications":
            if not authorized(self):
                return json_response(self, 401, {"error": "Unauthorized."})
            with db() as conn:
                rows = conn.execute(
                    "SELECT * FROM admin_notifications ORDER BY created_at DESC LIMIT 100").fetchall()
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
    print(f"Horic Autos backend running on http://{host}:{port}")
    ThreadingHTTPServer((host, port), Handler).serve_forever()

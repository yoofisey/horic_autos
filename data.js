/* ============================================================
   data.js — Horic Autos
   Shared inventory store, constants, and utility functions
   Used by both app.js (public site) and admin.js (admin panel)
   ============================================================ */

const STORE_KEY = 'horicautos-inventory';

/* ── DEFAULT SEED DATA ── */
const DEFAULT_INVENTORY = [
  {
    id: 1, make: 'Toyota', model: 'Land Cruiser V8',
    year: 2022, price: 580000,
    condition: 'used', type: 'suv', fuel: 'petrol',
    mileage: 42000, engine: '4500cc', transmission: 'automatic',
    desc: 'Full spec, dual sunroof, 7-seater, low mileage. Excellent condition.',
    images: []
  },
  {
    id: 2, make: 'Toyota', model: 'Corolla Cross',
    year: 2024, price: 195000,
    condition: 'new', type: 'suv', fuel: 'hybrid',
    mileage: 0, engine: '1800cc', transmission: 'automatic',
    desc: 'Brand new hybrid SUV. Outstanding fuel economy. Ideal daily driver.',
    images: []
  },
  {
    id: 3, make: 'Hyundai', model: 'Tucson',
    year: 2023, price: 220000,
    condition: 'new', type: 'suv', fuel: 'petrol',
    mileage: 0, engine: '2000cc', transmission: 'automatic',
    desc: 'Panoramic roof, heated seats, ADAS safety suite, wireless CarPlay.',
    images: []
  },
  {
    id: 4, make: 'Toyota', model: 'Hilux Revo',
    year: 2021, price: 310000,
    condition: 'used', type: 'truck', fuel: 'diesel',
    mileage: 68000, engine: '2800cc', transmission: 'automatic',
    desc: 'Double cab, 4x4. Hardcover. Very clean. Well maintained.',
    images: []
  },
  {
    id: 5, make: 'Honda', model: 'Accord',
    year: 2020, price: 145000,
    condition: 'used', type: 'sedan', fuel: 'petrol',
    mileage: 55000, engine: '1500cc', transmission: 'automatic',
    desc: 'Turbocharged. Leather seats, Honda Sensing, reverse camera.',
    images: []
  },
  {
    id: 6, make: 'Tesla', model: 'Model 3',
    year: 2023, price: 420000,
    condition: 'new', type: 'sedan', fuel: 'electric',
    mileage: 0, engine: '283kW', transmission: 'automatic',
    desc: 'Long Range RWD. 560km range. Autopilot included.',
    images: []
  },
  {
    id: 7, make: 'Kia', model: 'Sportage',
    year: 2024, price: 210000,
    condition: 'new', type: 'suv', fuel: 'petrol',
    mileage: 0, engine: '1600cc', transmission: 'automatic',
    desc: 'Panoramic display, 360 camera, heated seats.',
    images: []
  },
  {
    id: 8, make: 'Nissan', model: 'Navara',
    year: 2022, price: 275000,
    condition: 'used', type: 'truck', fuel: 'diesel',
    mileage: 38000, engine: '2300cc', transmission: 'manual',
    desc: 'Single cab. Bull bar, tow hitch. Solid workhorse.',
    images: []
  },
];

/* ── BODY TYPE EMOJI MAP ── */
const BODY_EMOJI = {
  suv:       '\u{1F699}',  // 🚙
  sedan:     '\u{1F697}',  // 🚗
  truck:     '\u{1F6FB}',  // 🛻
  hatchback: '\u{1F698}',  // 🚘
  coupe:     '\u{1F3CE}',  // 🏎️
  van:       '\u{1F690}',  // 🚐
};

/* ── INVENTORY STORE ── */

/**
 * Load inventory from localStorage.
 * Falls back to DEFAULT_INVENTORY on first visit.
 */
function loadInventory() {
  const raw = localStorage.getItem(STORE_KEY);
  return raw ? JSON.parse(raw) : DEFAULT_INVENTORY;
}

/**
 * Persist inventory to localStorage.
 * @param {Array} inventory
 */
function saveInventory(inventory) {
  localStorage.setItem(STORE_KEY, JSON.stringify(inventory));
}

/* ── UTILITY FUNCTIONS ── */

/**
 * Format a number as GHS currency string.
 * @param {number} amount
 * @returns {string}  e.g. "GHS 195,000"
 */
function formatPrice(amount) {
  return 'GHS ' + amount.toLocaleString();
}

/**
 * Estimate monthly running costs for a car.
 * Factors in fuel, routine maintenance, and insurance.
 * @param {Object} car
 * @returns {{ fuel: number, maintenance: number, insurance: number, total: number }}
 */
function estimateRunningCosts(car) {
  // Fuel cost — assumes ~1,500 km/month
  const fuel = car.fuel === 'electric' ? 180
             : car.fuel === 'diesel'   ? 520
             : 680; // petrol / hybrid

  // Maintenance — EVs and new cars cost less
  const maintenance = car.fuel === 'electric' ? 80
                    : car.condition === 'new'  ? 120
                    : 280;

  // Insurance — rough 0.2% of car value per month
  const insurance = Math.round(car.price * 0.002);

  return { fuel, maintenance, insurance, total: fuel + maintenance + insurance };
}

/**
 * Get the emoji for a car's body type.
 * @param {Object} car
 * @returns {string}
 */
function getCarEmoji(car) {
  if (car.fuel === 'electric') return '\u26A1\u{1F697}'; // ⚡🚗
  return BODY_EMOJI[car.type] || '\u{1F697}';
}

/**
 * Generate a unique numeric ID (timestamp-based).
 * @returns {number}
 */
function generateId() {
  return Date.now();
}
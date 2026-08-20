require('dotenv').config();
const express = require('express');
const { neon } = require('@neondatabase/serverless');
const OpenAI = require('openai');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
const JWT_SECRET = process.env.JWT_SECRET;

const SITE_NAME = process.env.SITE_NAME || 'Dealership Name';
const SITE_PHONE = process.env.SITE_PHONE || '+233 00 000 0000';
const SITE_EMAIL = process.env.SITE_EMAIL || 'info@yourdealership.com';

app.use(express.json({ limit: '5mb' }));
app.use(express.static(__dirname));
app.use((req, res, next) => {
  if (/\.(sql|bak)$/.test(req.path) || /^\/(seed|migrate-images|package)/.test(req.path) || /^\/supabase\//.test(req.path)) {
    return res.status(404).end();
  }
  next();
});

// ── DATABASE ──
const sql = neon(process.env.DATABASE_URL);

// ── CLOUDINARY (optional: set CLOUDINARY_URL to enable hosted image uploads) ──
const CLOUDINARY_CONFIGURED = !!(process.env.CLOUDINARY_URL && process.env.CLOUDINARY_URL.trim());

// ── EMAIL (optional: set SMTP_* to enable real email sending) ──
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || (SMTP_USER ? SMTP_USER : SITE_NAME + ' <no-reply@yourdealership.com>');
const SMTP_CONFIGURED = !!(SMTP_HOST && SMTP_USER);
const SMTP_NOTIFY_TO = process.env.SMTP_NOTIFY_TO || SMTP_USER;

const transporter = SMTP_CONFIGURED ? nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS }
}) : null;

async function sendEmail(to, subject, html) {
  if (!transporter || !to) return false;
  try {
    await transporter.sendMail({ from: SMTP_FROM, to, subject, html });
    return true;
  } catch (err) {
    console.error('Email error:', err.message);
    return false;
  }
}

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\n/g, '<br>');
}

function emailShell(inner) {
  return '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;line-height:1.5">'
    + '<h2 style="font-family:Georgia,serif;color:#FF6A00;margin:0 0 16px;">' + SITE_NAME + '</h2>'
    + inner
    + '<hr style="border:none;border-top:1px solid #eee;margin:24px 0 12px;">'
    + '<p style="color:#888;font-size:12px;">Mon–Sat 9am–6pm · Sundays by appointment<br>Phone/WhatsApp: ' + SITE_PHONE + ' · ' + SITE_EMAIL + '</p>'
    + '</div>';
}

function buildEnquiryConfirmation(e) {
  return emailShell(
    '<p>Hello <strong>' + escHtml(e.customer_name) + '</strong>,</p>'
    + '<p>Thank you for contacting <strong>' + SITE_NAME + '</strong>. We have received your enquiry and a member of our team will get back to you shortly.</p>'
    + '<p style="border-left:3px solid #FF6A00;padding:10px 14px;background:#f9f9f9;color:#555;">' + escHtml(e.message) + '</p>'
    + '<p>Want a faster answer? Message us on WhatsApp: <a href="https://wa.me/233000000000" style="color:#FF6A00;">' + SITE_PHONE + '</a></p>'
    + '<p style="color:#888;font-size:12px;">This is an automated confirmation. Please reply to the team member who contacts you.</p>'
  );
}

function buildEnquiryAlert(e) {
  return emailShell(
    '<p><strong>New enquiry</strong> received on the website.</p>'
    + '<p style="border-left:3px solid #FF6A00;padding:10px 14px;background:#f9f9f9;color:#555;">' + escHtml(e.message) + '</p>'
    + '<p><strong>Name:</strong> ' + escHtml(e.customer_name) + '<br>'
    + '<strong>Phone:</strong> ' + escHtml(e.customer_phone) + '<br>'
    + '<strong>Email:</strong> ' + escHtml(e.customer_email || '—') + '</p>'
    + '<p>Reply from the admin panel, or open WhatsApp: <a href="https://wa.me/233000000000" style="color:#FF6A00;">' + SITE_PHONE + '</a></p>'
  );
}

function buildVisitConfirmation(v, vehicleLabel) {
  return emailShell(
    '<p>Hello <strong>' + escHtml(v.customer_name) + '</strong>,</p>'
    + '<p>Thanks for booking a visit to <strong>' + SITE_NAME + '</strong>. Here is what we have on file:</p>'
    + '<p style="border-left:3px solid #FF6A00;padding:10px 14px;background:#f9f9f9;color:#555;">'
    + '<strong>Date:</strong> ' + escHtml(v.preferred_date) + '<br>'
    + '<strong>Time:</strong> ' + escHtml(v.preferred_time || 'during business hours') + '<br>'
    + (vehicleLabel ? '<strong>Vehicle:</strong> ' + escHtml(vehicleLabel) + '<br>' : '')
    + '</p><p>Our team will confirm your appointment. If you need to change or cancel, WhatsApp us at <a href="https://wa.me/233000000000" style="color:#FF6A00;">' + SITE_PHONE + '</a>.</p>'
    + '<p style="color:#888;font-size:12px;">Business hours: Mon–Sat 9am–6pm, Sundays by appointment.</p>'
  );
}

function buildVisitAlert(v, vehicleLabel) {
  return emailShell(
    '<p><strong>New visit request</strong> from the website.</p>'
    + '<p style="border-left:3px solid #FF6A00;padding:10px 14px;background:#f9f9f9;color:#555;">'
    + '<strong>Date:</strong> ' + escHtml(v.preferred_date) + '<br>'
    + '<strong>Time:</strong> ' + escHtml(v.preferred_time || '—') + '<br>'
    + (vehicleLabel ? '<strong>Vehicle:</strong> ' + escHtml(vehicleLabel) + '<br>' : '')
    + '<strong>Message:</strong> ' + escHtml(v.message || '—') + '</p>'
    + '<p><strong>Name:</strong> ' + escHtml(v.customer_name) + '<br>'
    + '<strong>Phone:</strong> ' + escHtml(v.customer_phone) + '<br>'
    + '<strong>Email:</strong> ' + escHtml(v.customer_email || '—') + '</p>'
    + '<p>Confirm or manage from the admin panel.</p>'
  );
}

function sendEnquiryEmails(e) {
  if (e.customer_email) sendEmail(e.customer_email, 'We received your enquiry — ' + SITE_NAME, buildEnquiryConfirmation(e)).catch(() => {});
  if (SMTP_NOTIFY_TO) sendEmail(SMTP_NOTIFY_TO, 'New enquiry: ' + (e.customer_name || 'Website visitor'), buildEnquiryAlert(e)).catch(() => {});
}

function sendVisitEmails(v, vehicleLabel) {
  if (v.customer_email) sendEmail(v.customer_email, 'Visit request received — ' + SITE_NAME, buildVisitConfirmation(v, vehicleLabel)).catch(() => {});
  if (SMTP_NOTIFY_TO) sendEmail(SMTP_NOTIFY_TO, 'Visit request: ' + (v.customer_name || 'Website visitor') + ' on ' + v.preferred_date, buildVisitAlert(v, vehicleLabel)).catch(() => {});
}

// ── VALID ENUMS ──
const VALID_STATUSES = ['in_stock', 'sold', 'coming_soon'];
const VALID_CONDITIONS = ['new', 'used'];
const VALID_BODY_TYPES = ['sedan', 'suv', 'hatchback', 'pickup', 'coupe', 'convertible', 'minivan', 'truck', 'van', 'wagon'];
const VALID_FUELS = ['petrol', 'diesel', 'electric', 'hybrid', 'cng'];
const VALID_TRANSMISSIONS = ['automatic', 'manual'];
const VALID_VISIT_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];

// ── RATE LIMITING (DB-backed, survives restarts) ──
function rateLimit(maxReqs, windowMs) {
  return async function(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const key = (ip + ':' + req.baseUrl + req.path).substring(0, 255);
    const cutoff = new Date(Date.now() - windowMs).toISOString();
    try {
      await sql`INSERT INTO rate_limits (key, ts) VALUES (${key}, now())`;
      const [row] = await sql`SELECT count(*)::int AS count FROM rate_limits WHERE key = ${key} AND ts >= ${cutoff}::timestamptz`;
      if (row.count > maxReqs) {
        return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
      }
      if (Math.random() < 0.02) {
        sql`DELETE FROM rate_limits WHERE ts < now() - interval '1 hour'`.catch(() => {});
      }
    } catch (e) {
      // Fail open if the rate-limit table is unavailable
    }
    next();
  };
}

// ── OPENAI (guarded) ──
const OPENAI_CONFIGURED = !!process.env.OPENAI_API_KEY;
const openai = OPENAI_CONFIGURED ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function genId() { return 'v_' + crypto.randomUUID(); }
function genEnqId() { return 'e_' + crypto.randomUUID(); }
function genVisitId() { return 'vs_' + crypto.randomUUID(); }

// Parse a numeric value from user input, tolerating commas/currency symbols.
function toInt(value) {
  if (value === null || value === undefined || value === '') return null;
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function generateToken(admin) {
  return jwt.sign({ id: admin.id, email: admin.email, v: admin.token_version || 0 }, JWT_SECRET, { expiresIn: '7d' });
}

async function cloudifyImages(images) {
  if (!Array.isArray(images) || images.length === 0) return images || [];
  const out = [];
  for (const img of images) {
    if (!CLOUDINARY_CONFIGURED || typeof img !== 'string' || !img.startsWith('data:image')) {
      out.push(img);
      continue;
    }
    try {
      const result = await cloudinary.uploader.upload(img, { folder: 'rhule-auto-hub' });
      out.push(result.secure_url);
    } catch (e) {
      out.push(img);
    }
  }
  return out;
}

function notifId() {
  return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function addNotification(type, title, message) {
  sql`INSERT INTO notification_log (id, type, title, message, link, seen)
    VALUES (${notifId()}, ${type}, ${title}, ${message}, '/admin.html', false)`.catch(function() {});
}

// ── AUTH MIDDLEWARE ──
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    sql`SELECT token_version FROM admins WHERE id = ${decoded.id}`.then(([row]) => {
      if (!row || (row.token_version || 0) !== (decoded.v || 0)) {
        return res.status(401).json({ error: 'Token revoked. Please log in again.' });
      }
      next();
    }).catch(() => {
      res.status(500).json({ error: 'Internal server error' });
    });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── AUTH ROUTES ──
app.post('/api/auth/login', rateLimit(5, 300000), async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const [admin] = await sql`SELECT * FROM admins WHERE email = ${email}`;
    if (!admin) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = generateToken(admin);
    res.json({ token, user: { id: admin.id, email: admin.email } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/signup', requireAuth, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email format' });

    const hash = await bcrypt.hash(password, 10);
    const [admin] = await sql`INSERT INTO admins (email, password_hash) VALUES (${email}, ${hash}) RETURNING id, email`;
    res.json({ user: admin });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email already exists' });
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password required' });
    if (String(newPassword).length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

    const [admin] = await sql`SELECT * FROM admins WHERE id = ${req.user.id}`;
    if (!admin) return res.status(404).json({ error: 'Admin not found' });

    const valid = await bcrypt.compare(currentPassword, admin.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(String(newPassword), 10);
    await sql`UPDATE admins SET password_hash = ${hash}, token_version = token_version + 1 WHERE id = ${admin.id}`;
    res.json({ ok: true });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── ADMIN ACCOUNT MANAGEMENT ──
app.get('/api/admins', requireAuth, async (req, res) => {
  try {
    const rows = await sql`SELECT id, email, created_at FROM admins ORDER BY created_at ASC`;
    res.json(rows);
  } catch (err) {
    console.error('List admins error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/admins/:id', requireAuth, async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' });
    const [target] = await sql`SELECT id FROM admins WHERE id = ${req.params.id}`;
    if (!target) return res.status(404).json({ error: 'Admin not found' });
    const [{ count }] = await sql`SELECT count(*)::int AS count FROM admins`;
    if (count <= 1) return res.status(400).json({ error: 'Cannot delete the last admin account' });
    await sql`DELETE FROM admins WHERE id = ${req.params.id}`;
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete admin error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/admins/:id/reset-password', requireAuth, async (req, res) => {
  try {
    if (req.params.id !== req.user.id) {
      return res.status(403).json({ error: 'You can only reset your own password' });
    }
    const [target] = await sql`SELECT id FROM admins WHERE id = ${req.params.id}`;
    if (!target) return res.status(404).json({ error: 'Admin not found' });
    const tempPassword = crypto.randomBytes(4).toString('hex') + Math.floor(100 + Math.random() * 900);
    const hash = await bcrypt.hash(tempPassword, 10);
    await sql`UPDATE admins SET password_hash = ${hash}, token_version = token_version + 1 WHERE id = ${req.params.id}`;
    res.json({ ok: true, tempPassword });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── EMBEDDING GENERATION ──
async function generateEmbedding(text) {
  if (!openai) return null;
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text
    });
    return response.data[0].embedding;
  } catch (err) {
    console.error('Embedding error:', err.message);
    return null;
  }
}

// ── KNOWLEDGE BASE → EMBEDDING PIPELINE ──
function vehicleToKnowledge(vehicle) {
  const condition = vehicle.condition === 'new' ? 'New' : 'Pre-Owned';
  const status = vehicle.status === 'in_stock' ? 'Available' : vehicle.status === 'sold' ? 'Sold' : 'Coming Soon';
  const features = (vehicle.features || []).join(', ');
  const trimStr = vehicle.trim ? ' ' + vehicle.trim : '';
  return `Vehicle: ${vehicle.year} ${vehicle.make} ${vehicle.model}${trimStr}
Price: GHS ${Number(vehicle.price).toLocaleString()}
Condition: ${condition} | Status: ${status}
Availability: ${(vehicle.quantity || 1) > 1 ? vehicle.quantity + ' units available' : 'Single unit available'}
Body Type: ${vehicle.body_type} | Fuel: ${vehicle.fuel} | Transmission: ${vehicle.transmission}
Engine: ${vehicle.engine || 'N/A'} | Color: ${vehicle.color || 'N/A'}
Mileage: ${vehicle.mileage > 0 ? vehicle.mileage.toLocaleString() + ' km' : 'Brand New'}
Description: ${vehicle.description || 'No description available.'}
Features: ${features || 'Standard features'}
${vehicle.sold_price ? `Sold Price: GHS ${Number(vehicle.sold_price).toLocaleString()}` : ''}`;
}

async function embedAndStore(text, contentType, metadata) {
  const embedding = await generateEmbedding(text);
  if (!embedding) return null;

  const embeddingStr = '[' + embedding.join(',') + ']';
  const metaJson = JSON.stringify(metadata);

  const [data] = await sql`INSERT INTO knowledge_base (content, content_type, metadata, embedding)
    VALUES (${text}, ${contentType}, ${metaJson}::jsonb, ${embeddingStr}::vector)
    RETURNING id, content, content_type, metadata, created_at`;

  return data;
}

// ── RAG SEARCH ──
async function ragSearch(query, matchCount = 5, filterType = null) {
  if (!openai) return [];
  const queryEmbedding = await generateEmbedding(query);
  if (!queryEmbedding) return [];

  const embeddingStr = '[' + queryEmbedding.join(',') + ']';
  const threshold = 0.25;

  let results;
  if (filterType) {
    results = await sql`SELECT id, content, content_type, metadata,
      1 - (embedding <=> ${embeddingStr}::vector) as similarity
      FROM knowledge_base
      WHERE content_type = ${filterType}
        AND 1 - (embedding <=> ${embeddingStr}::vector) > ${threshold}
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${matchCount}`;
  } else {
    results = await sql`SELECT id, content, content_type, metadata,
      1 - (embedding <=> ${embeddingStr}::vector) as similarity
      FROM knowledge_base
      WHERE 1 - (embedding <=> ${embeddingStr}::vector) > ${threshold}
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${matchCount}`;
  }

  return results || [];
}

// ── VEHICLE ROUTES (public read) ──
app.get('/api/vehicles', async (req, res) => {
  try {
    const vehicles = await sql`SELECT * FROM vehicles ORDER BY created_at DESC`;
    res.json(vehicles);
  } catch (err) {
    console.error('List vehicles error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/vehicles/:id', async (req, res) => {
  try {
    const [vehicle] = await sql`SELECT * FROM vehicles WHERE id = ${req.params.id}`;
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    res.json(vehicle);
  } catch (err) {
    console.error('Get vehicle error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/vehicles/:id/view', rateLimit(20, 60000), async (req, res) => {
  try {
    await sql`UPDATE vehicles SET views = views + 1 WHERE id = ${req.params.id}`;
    res.json({ ok: true });
  } catch (err) {
    console.error('View increment error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── VEHICLE ROUTES (admin write) ──
app.post('/api/vehicles', requireAuth, async (req, res) => {
  try {
    const id = genId();
    const now = new Date().toISOString();
    const v = req.body;

    if (v.status && !VALID_STATUSES.includes(v.status)) return res.status(400).json({ error: 'Invalid status' });
    if (v.condition && !VALID_CONDITIONS.includes(v.condition)) return res.status(400).json({ error: 'Invalid condition' });
    if (v.body_type && !VALID_BODY_TYPES.includes(v.body_type)) return res.status(400).json({ error: 'Invalid body_type' });
    if (v.fuel && !VALID_FUELS.includes(v.fuel)) return res.status(400).json({ error: 'Invalid fuel type' });
    if (v.transmission && !VALID_TRANSMISSIONS.includes(v.transmission)) return res.status(400).json({ error: 'Invalid transmission' });

    const featuresJson = JSON.stringify(v.features || []);
    const images = await cloudifyImages(v.images || []);
    const imagesJson = JSON.stringify(images);

    const [vehicle] = await sql`INSERT INTO vehicles (id, make, model, trim, year, price, condition, status, body_type, fuel, mileage, engine, transmission, color, description, features, images, quantity, created_at, updated_at, views, enquiries)
      VALUES (${id}, ${v.make || ''}, ${v.model || ''}, ${v.trim || ''}, ${toInt(v.year) || 2024}, ${toInt(v.price) || 0}, ${v.condition || 'new'}, ${v.status || 'in_stock'}, ${v.body_type || 'sedan'}, ${v.fuel || 'petrol'}, ${toInt(v.mileage) || 0}, ${v.engine || ''}, ${v.transmission || 'automatic'}, ${v.color || ''}, ${v.description || ''}, ${featuresJson}::jsonb, ${imagesJson}::jsonb, ${toInt(v.quantity) > 0 ? toInt(v.quantity) : 1}, ${now}::timestamptz, ${now}::timestamptz, 0, 0)
      RETURNING *`;

    const kbText = vehicleToKnowledge(vehicle);
    await embedAndStore(kbText, 'vehicle', { vehicle_id: vehicle.id, make: vehicle.make, model: vehicle.model, year: vehicle.year, price: vehicle.price, status: vehicle.status });

    res.json(vehicle);
  } catch (err) {
    console.error('Create vehicle error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/vehicles/:id', requireAuth, async (req, res) => {
  try {
    const v = req.body;

    const [existing] = await sql`SELECT id, make, model, year, status, price FROM vehicles WHERE id = ${req.params.id}`;
    if (!existing) return res.status(404).json({ error: 'Vehicle not found' });

    if (v.status && !VALID_STATUSES.includes(v.status)) return res.status(400).json({ error: 'Invalid status' });
    if (v.condition && !VALID_CONDITIONS.includes(v.condition)) return res.status(400).json({ error: 'Invalid condition' });
    if (v.body_type && !VALID_BODY_TYPES.includes(v.body_type)) return res.status(400).json({ error: 'Invalid body_type' });
    if (v.fuel && !VALID_FUELS.includes(v.fuel)) return res.status(400).json({ error: 'Invalid fuel type' });
    if (v.transmission && !VALID_TRANSMISSIONS.includes(v.transmission)) return res.status(400).json({ error: 'Invalid transmission' });

    const sets = [];
    const values = [];
    const push = (name, value) => { values.push(value); sets.push(name + ' = $' + values.length); };

    const fields = [
      ['make', v.make],
      ['model', v.model],
      ['trim', v.trim],
      ['year', v.year !== undefined ? toInt(v.year) : undefined],
      ['price', v.price !== undefined ? toInt(v.price) : undefined],
      ['quantity', v.quantity !== undefined ? (toInt(v.quantity) > 0 ? toInt(v.quantity) : 1) : undefined],
      ['condition', v.condition],
      ['status', v.status],
      ['body_type', v.body_type],
      ['fuel', v.fuel],
      ['mileage', v.mileage !== undefined ? toInt(v.mileage) : undefined],
      ['engine', v.engine],
      ['transmission', v.transmission],
      ['color', v.color],
      ['description', v.description],
      ['sold_price', v.sold_price !== undefined ? toInt(v.sold_price) : undefined],
      ['sold_date', v.sold_date],
      ['sold_to', v.sold_to]
    ];
    for (const [name, value] of fields) {
      if (value !== undefined) push(name, value);
    }

    if (v.features !== undefined) {
      values.push(JSON.stringify(v.features || []));
      sets.push('features = $' + values.length + '::jsonb');
    }
    if (v.images !== undefined) {
      const images = await cloudifyImages(v.images || []);
      values.push(JSON.stringify(images));
      sets.push('images = $' + values.length + '::jsonb');
    }

    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });

    push('updated_at', new Date().toISOString());
    values.push(req.params.id);
    const query = 'UPDATE vehicles SET ' + sets.join(', ') + ' WHERE id = $' + values.length + ' RETURNING *';
    const [vehicle] = await sql(query, values);

    if (existing.status !== 'sold' && vehicle.status === 'sold') {
      addNotification('sale', existing.make + ' ' + existing.model + ' (' + existing.year + ') marked as sold', 'Recorded as sold at GHS ' + (vehicle.sold_price ? Number(vehicle.sold_price).toLocaleString() : vehicle.price));
    }

    const kbText = vehicleToKnowledge(vehicle);
    await sql`DELETE FROM knowledge_base WHERE content_type = 'vehicle' AND metadata->>'vehicle_id' = ${req.params.id}`;
    await embedAndStore(kbText, 'vehicle', { vehicle_id: vehicle.id, make: vehicle.make, model: vehicle.model, year: vehicle.year, price: vehicle.price, status: vehicle.status });

    res.json(vehicle);
  } catch (err) {
    console.error('Update vehicle error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/vehicles/:id/clone', requireAuth, async (req, res) => {
  try {
    const [source] = await sql`SELECT * FROM vehicles WHERE id = ${req.params.id}`;
    if (!source) return res.status(404).json({ error: 'Vehicle not found' });
    const id = genId();
    const now = new Date().toISOString();
    const [vehicle] = await sql`INSERT INTO vehicles (id, make, model, trim, year, price, condition, status, body_type, fuel, mileage, engine, transmission, color, description, features, images, quantity, created_at, updated_at, views, enquiries)
      VALUES (${id}, ${source.make}, ${source.model}, ${source.trim}, ${source.year}, ${source.price}, ${source.condition}, 'in_stock', ${source.body_type}, ${source.fuel}, ${source.mileage}, ${source.engine}, ${source.transmission}, ${source.color}, ${source.description}, ${JSON.stringify(source.features)}::jsonb, ${JSON.stringify(source.images)}::jsonb, 1, ${now}::timestamptz, ${now}::timestamptz, 0, 0)
      RETURNING *`;

    const kbText = vehicleToKnowledge(vehicle);
    await embedAndStore(kbText, 'vehicle', { vehicle_id: vehicle.id, make: vehicle.make, model: vehicle.model, year: vehicle.year, price: vehicle.price, status: vehicle.status });

    res.json(vehicle);
  } catch (err) {
    console.error('Clone vehicle error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/vehicles/:id', requireAuth, async (req, res) => {
  try {
    await sql`DELETE FROM knowledge_base WHERE content_type = 'vehicle' AND metadata->>'vehicle_id' = ${req.params.id}`;
    const [deleted] = await sql`DELETE FROM vehicles WHERE id = ${req.params.id} RETURNING id`;
    if (!deleted) return res.status(404).json({ error: 'Vehicle not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete vehicle error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── ENQUIRY ROUTES ──
app.get('/api/enquiries', requireAuth, async (req, res) => {
  try {
    const enquiries = await sql`
      SELECT e.*, v.make, v.model, v.year
      FROM enquiries e
      LEFT JOIN vehicles v ON e.vehicle_id = v.id
      ORDER BY e.created_at DESC`;
    res.json(enquiries);
  } catch (err) {
    console.error('List enquiries error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/enquiries', rateLimit(10, 60000), async (req, res) => {
  try {
    const id = genEnqId();
    const e = req.body;
    const [enquiry] = await sql`INSERT INTO enquiries (id, vehicle_id, customer_name, customer_phone, customer_email, message, status, created_at)
      VALUES (${id}, ${e.vehicle_id || null}, ${e.customer_name || 'Anonymous'}, ${e.customer_phone || ''}, ${e.customer_email || ''}, ${e.message || ''}, 'unread', now())
      RETURNING *`;
    addNotification('enquiry', 'New enquiry from ' + (e.customer_name || 'Anonymous'), (e.message || '').substring(0, 100));
    sendEnquiryEmails(enquiry);
    res.json(enquiry);
  } catch (err) {
    console.error('Create enquiry error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/enquiries/:id', requireAuth, async (req, res) => {
  try {
    const e = req.body;
    const sets = [];
    const values = [];
    if (e.status !== undefined && e.status !== null) {
      values.push(e.status);
      sets.push('status = $' + values.length);
    }
    if (e.admin_reply !== undefined && e.admin_reply !== null) {
      values.push(e.admin_reply);
      sets.push('admin_reply = $' + values.length);
      values.push(new Date().toISOString());
      sets.push('replied_at = $' + values.length);
    }
    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(req.params.id);
    const query = 'UPDATE enquiries SET ' + sets.join(', ') + ' WHERE id = $' + values.length + ' RETURNING *';
    const [enquiry] = await sql(query, values);
    res.json(enquiry);
  } catch (err) {
    console.error('Update enquiry error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/enquiries/:id', requireAuth, async (req, res) => {
  try {
    const [deleted] = await sql`DELETE FROM enquiries WHERE id = ${req.params.id} RETURNING id`;
    if (!deleted) return res.status(404).json({ error: 'Enquiry not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete enquiry error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/enquiries/:id/send-email', requireAuth, async (req, res) => {
  try {
    const { subject, body } = req.body;
    const [enq] = await sql`SELECT * FROM enquiries WHERE id = ${req.params.id}`;
    if (!enq) return res.status(404).json({ error: 'Enquiry not found' });
    if (!enq.customer_email) return res.status(400).json({ error: 'No email address on file for this enquiry' });

    const html = '<p>' + escHtml(body) + '</p>';
    const sent = await sendEmail(enq.customer_email, String(subject || 'Re: Your ' + SITE_NAME + ' Enquiry'), html);
    if (!sent) return res.status(400).json({ error: 'Email sending is not configured. Set the SMTP_* env vars to enable it.' });
    res.json({ ok: true, to: enq.customer_email });
  } catch (err) {
    console.error('Send email error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── VISIT SCHEDULING ──
app.post('/api/visits', rateLimit(10, 60000), async (req, res) => {
  try {
    const v = req.body;
    if (!v.customer_name || !v.customer_phone || !v.preferred_date) {
      return res.status(400).json({ error: 'Name, phone, and preferred date are required' });
    }

    const d = new Date(v.preferred_date + 'T12:00:00Z');
    if (isNaN(d.getTime())) {
      return res.status(400).json({ error: 'Invalid preferred date' });
    }
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (d < today) {
      return res.status(400).json({ error: 'Preferred date cannot be in the past' });
    }
    if (d.getUTCDay() === 0) {
      return res.status(400).json({ error: 'We are closed Sundays. Sundays are by appointment only — please contact us on WhatsApp.' });
    }
    if (v.preferred_time) {
      const tp = String(v.preferred_time).split(':');
      const mins = parseInt(tp[0], 10) * 60 + parseInt(tp[1], 10);
      if (isNaN(mins) || mins < 9 * 60 || mins > 18 * 60) {
        return res.status(400).json({ error: 'Business hours are 9:00 AM – 6:00 PM (Mon–Sat)' });
      }
    }

    const id = genVisitId();
    const [visit] = await sql`INSERT INTO visit_schedules (id, customer_name, customer_phone, customer_email, preferred_date, preferred_time, message, vehicle_id, status)
      VALUES (${id}, ${v.customer_name}, ${v.customer_phone}, ${v.customer_email || ''}, ${v.preferred_date}, ${v.preferred_time || ''}, ${v.message || ''}, ${v.vehicle_id || null}, 'pending')
      RETURNING *`;
    addNotification('visit', 'Visit scheduled by ' + v.customer_name, (v.customer_name || '') + ' wants to view a vehicle on ' + v.preferred_date + (v.preferred_time ? ' at ' + v.preferred_time : ''));
    let vehicleLabel = '';
    if (v.vehicle_id) {
      const [veh] = await sql`SELECT make, model, year FROM vehicles WHERE id = ${v.vehicle_id}`;
      if (veh) vehicleLabel = veh.year + ' ' + veh.make + ' ' + veh.model;
    }
    sendVisitEmails(visit, vehicleLabel);
    res.json(visit);
  } catch (err) {
    console.error('Create visit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/visits', requireAuth, async (req, res) => {
  try {
    const status = req.query.status || '';
    let rows;
    if (status) {
      rows = await sql`SELECT v.*, veh.make, veh.model, veh.year FROM visit_schedules v LEFT JOIN vehicles veh ON v.vehicle_id = veh.id WHERE v.status = ${status} ORDER BY v.preferred_date ASC`;
    } else {
      rows = await sql`SELECT v.*, veh.make, veh.model, veh.year FROM visit_schedules v LEFT JOIN vehicles veh ON v.vehicle_id = veh.id ORDER BY v.created_at DESC`;
    }
    res.json(rows);
  } catch (err) {
    console.error('List visits error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/visits/:id', requireAuth, async (req, res) => {
  try {
    const v = req.body;
    if (v.status && !VALID_VISIT_STATUSES.includes(v.status)) {
      return res.status(400).json({ error: 'Invalid visit status' });
    }
    const [visit] = await sql`UPDATE visit_schedules SET status = ${v.status}, updated_at = now() WHERE id = ${req.params.id} RETURNING *`;
    if (!visit) return res.status(404).json({ error: 'Visit not found' });
    res.json(visit);
  } catch (err) {
    console.error('Update visit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/visits/:id', requireAuth, async (req, res) => {
  try {
    const [deleted] = await sql`DELETE FROM visit_schedules WHERE id = ${req.params.id} RETURNING id`;
    if (!deleted) return res.status(404).json({ error: 'Visit not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete visit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── STATS (SQL-aggregated, no full-table scans) ──
app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const [carStats] = await sql`
      SELECT
        count(*)::int AS "totalCars",
        count(*) FILTER (WHERE status = 'in_stock')::int AS "inStock",
        count(*) FILTER (WHERE status = 'sold')::int AS "sold",
        coalesce(sum(CASE WHEN status = 'in_stock' THEN price ELSE 0 END), 0)::int AS "totalValue"
      FROM vehicles`;
    const [enqStats] = await sql`
      SELECT
        count(*)::int AS "totalEnquiries",
        count(*) FILTER (WHERE status = 'unread')::int AS "unreadEnquiries"
      FROM enquiries`;
    const [kbRow] = await sql`SELECT count(*)::int as count FROM knowledge_base`;
    const [visitCount] = await sql`SELECT count(*)::int as count FROM visit_schedules WHERE status = 'pending'`;
    res.json({
      totalCars: carStats.totalCars,
      inStock: carStats.inStock,
      sold: carStats.sold,
      totalValue: carStats.totalValue,
      totalEnquiries: enqStats.totalEnquiries,
      unreadEnquiries: enqStats.unreadEnquiries,
      knowledgeEntries: kbRow?.count || 0,
      pendingVisits: visitCount?.count || 0
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/stats/body-distribution', requireAuth, async (req, res) => {
  try {
    const rows = await sql`SELECT body_type, count(*)::int as count FROM vehicles GROUP BY body_type ORDER BY count DESC`;
    res.json(rows);
  } catch (err) {
    console.error('Body distribution error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

async function monthlyTrend(tableName, whereClause) {
  let rows;
  if (whereClause) {
    rows = await sql`SELECT to_char(created_at, 'Mon') as month, count(*)::int as count
      FROM ${sql(tableName)} WHERE ${sql.unsafe(whereClause)}
      GROUP BY to_char(created_at, 'Mon'), date_trunc('month', created_at)
      ORDER BY date_trunc('month', created_at) ASC`;
  } else {
    rows = await sql`SELECT to_char(created_at, 'Mon') as month, count(*)::int as count
      FROM ${sql(tableName)}
      GROUP BY to_char(created_at, 'Mon'), date_trunc('month', created_at)
      ORDER BY date_trunc('month', created_at) ASC`;
  }
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthsInData = new Set(rows.map(r => r.month));
  return monthNames.filter(m => monthsInData.has(m)).map(m => {
    const found = rows.find(r => r.month === m);
    return { month: m, count: found ? found.count : 0 };
  });
}

app.get('/api/stats/monthly-sold', requireAuth, async (req, res) => {
  try {
    res.json(await monthlyTrend('vehicles', "status = 'sold'"));
  } catch (err) {
    console.error('Monthly sold error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/stats/enquiry-trend', requireAuth, async (req, res) => {
  try {
    res.json(await monthlyTrend('enquiries'));
  } catch (err) {
    console.error('Enquiry trend error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/stats/sales', requireAuth, async (req, res) => {
  try {
    const [row] = await sql`
      SELECT
        count(*)::int AS "totalSold",
        coalesce(sum(COALESCE(sold_price, price)), 0)::int AS "totalRevenue",
        CASE WHEN count(*) > 0 THEN coalesce(sum(COALESCE(sold_price, price)), 0) / count(*) ELSE 0 END::int AS "avgPrice"
      FROM vehicles WHERE status = 'sold'`;
    res.json(row);
  } catch (err) {
    console.error('Sales stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── IMAGE UPLOAD ──
app.post('/api/upload', requireAuth, async (req, res) => {
  try {
    const { filename, data: base64Data } = req.body;
    if (!filename || !base64Data) return res.status(400).json({ error: 'filename and data required' });

    if (CLOUDINARY_CONFIGURED) {
      const ext = filename.split('.').pop() || 'jpg';
      const result = await cloudinary.uploader.upload(`data:image/${ext};base64,${base64Data}`, { folder: 'rhule-auto-hub' });
      return res.json({ url: result.secure_url });
    }

    const ext = filename.split('.').pop() || 'jpg';
    const dataUrl = `data:image/${ext};base64,${base64Data}`;
    res.json({ url: dataUrl });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── KNOWLEDGE BASE MANAGEMENT ──
app.get('/api/knowledge', requireAuth, async (req, res) => {
  try {
    const { type } = req.query;
    let entries;
    if (type) {
      entries = await sql`SELECT id, content, content_type, metadata, created_at, updated_at FROM knowledge_base WHERE content_type = ${type} ORDER BY created_at DESC`;
    } else {
      entries = await sql`SELECT id, content, content_type, metadata, created_at, updated_at FROM knowledge_base ORDER BY created_at DESC`;
    }
    const [counts] = await sql`
      SELECT count(*)::int AS total,
        count(*) FILTER (WHERE content_type = 'vehicle')::int AS vehicle,
        count(*) FILTER (WHERE content_type = 'faq')::int AS faq,
        count(*) FILTER (WHERE content_type = 'policy')::int AS policy
      FROM knowledge_base`;
    res.json({ entries, counts });
  } catch (err) {
    console.error('List knowledge error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/knowledge', requireAuth, async (req, res) => {
  try {
    const { content, content_type, metadata } = req.body;
    if (!content) return res.status(400).json({ error: 'content required' });

    const entry = await embedAndStore(content, content_type || 'faq', metadata || {});
    if (!entry) return res.status(500).json({ error: 'Failed to generate embedding' });
    res.json(entry);
  } catch (err) {
    console.error('Create knowledge error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/knowledge/:id', requireAuth, async (req, res) => {
  try {
    const { content, content_type, metadata } = req.body;
    const [existing] = await sql`SELECT content_type, metadata FROM knowledge_base WHERE id = ${req.params.id}`;
    if (!existing) return res.status(404).json({ error: 'Entry not found' });

    const newType = content_type !== undefined ? content_type : existing.content_type;
    const newMeta = metadata !== undefined ? metadata : existing.metadata;

    if (content !== undefined) {
      const embedding = await generateEmbedding(content);
      if (!embedding) return res.status(500).json({ error: 'Failed to generate embedding' });
      const embeddingStr = '[' + embedding.join(',') + ']';
      const [entry] = await sql`UPDATE knowledge_base SET content = ${content}, content_type = ${newType}, metadata = ${JSON.stringify(newMeta)}::jsonb, embedding = ${embeddingStr}::vector WHERE id = ${req.params.id} RETURNING id, content, content_type, metadata, created_at, updated_at`;
      return res.json(entry);
    }
    const [entry] = await sql`UPDATE knowledge_base SET content_type = ${newType}, metadata = ${JSON.stringify(newMeta)}::jsonb WHERE id = ${req.params.id} RETURNING id, content, content_type, metadata, created_at, updated_at`;
    res.json(entry);
  } catch (err) {
    console.error('Update knowledge error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/knowledge/:id', requireAuth, async (req, res) => {
  try {
    await sql`DELETE FROM knowledge_base WHERE id = ${req.params.id}`;
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete knowledge error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bulk sync: re-embed all vehicles into knowledge base
app.post('/api/knowledge/sync-vehicles', requireAuth, async (req, res) => {
  try {
    const vehicles = await sql`SELECT * FROM vehicles`;
    if (vehicles.length === 0) return res.json({ synced: 0 });
    await sql`DELETE FROM knowledge_base WHERE content_type = 'vehicle'`;
    for (const v of vehicles) {
      const kbText = vehicleToKnowledge(v);
      await embedAndStore(kbText, 'vehicle', { vehicle_id: v.id, make: v.make, model: v.model, year: v.year, price: v.price, status: v.status });
    }
    console.log('KB sync complete: ' + vehicles.length + ' vehicles');
    res.json({ synced: vehicles.length });
  } catch (err) {
    console.error('KB sync error:', err.message);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// ── CHATBOT (RAG + OpenAI) ──
const SYSTEM_PROMPT = `You are the AI Car Advisor for ${SITE_NAME}, Ghana's premier car dealership based in Accra.

## Your Role
You help customers find the right vehicle, estimate running costs, compare cars, and answer questions about buying/owning a car in Ghana. Be warm, knowledgeable, and concise.

## Context System
You have access to a Retrieval-Augmented Generation (RAG) system. Relevant knowledge base entries are provided below as RETRIEVED CONTEXT. Use them to answer the customer's question accurately. If the retrieved context doesn't contain enough information, use your general knowledge about cars and the Ghanaian market.

## Ghana-Specific Knowledge
- Fuel prices: Petrol ~GHS 14.50/L, Diesel ~GHS 16.14/L, Electric ~GHS 1.97/kWh (residential)
- Insurance: Third-party GHS 557/yr (flat), Comprehensive ~6% of vehicle value
- Maintenance: Oil change ~GHS 400, Minor service ~GHS 800/yr, Major service ~GHS 1,800/30k km
- Tyres: Budget ~GHS 600, Mid-range ~GHS 950, Premium ~GHS 1,500 per tyre
- Registration: Roadworthy ~GHS 100-150/yr
- Hire purchase typical: 25-30% deposit, 28-34% interest, 36-month term
- Monthly driving assumption: 2,000 km

## Running Cost Calculation
For any vehicle, estimate monthly fuel cost: (2000km / 100) * fuel_consumption_per_100km * fuel_price
- Petrol sedan: ~9.5 L/100km
- Petrol SUV: ~13 L/100km
- Diesel sedan: ~7 L/100km
- Diesel SUV: ~9.5 L/100km
- Hybrid: ~5.5 L/100km
- Electric: ~18 kWh/100km
Add maintenance (~GHS 480/mo base, lower for new/electric, higher for SUVs) and insurance monthly.

## Guidelines
- Always mention prices in GHS (Ghana Cedis)
- When recommending, include the monthly running cost estimate
- Be specific with vehicle names, prices, and features from the retrieved context
- If a customer mentions a budget, show all matching in-stock vehicles sorted by price
- Suggest alternatives if exact request isn't available
- Keep responses concise and helpful, use line breaks for readability
- You can compare two vehicles side by side when asked
- Encourage browsing the inventory page or chatting further`;

app.post('/api/chat', rateLimit(15, 60000), async (req, res) => {
  try {
    if (!openai) return res.status(503).json({ error: 'AI assistant is not configured yet.' });

    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }

    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    const query = lastUserMsg ? lastUserMsg.content : '';

    const ragResults = await ragSearch(query, 6);

    let contextStr = '';
    if (ragResults.length > 0) {
      contextStr = '\n\n## RETRIEVED CONTEXT\n' +
        ragResults.map((r, i) => `### Source ${i + 1} (${r.content_type}, similarity: ${(r.similarity * 100).toFixed(0)}%)\n${r.content}`).join('\n\n');
    }

    const systemPrompt = SYSTEM_PROMPT + contextStr;

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: chatMessages,
      max_tokens: 1024,
      temperature: 0.7
    });

    res.json({ reply: response.choices[0]?.message?.content || 'No response generated.' });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: 'Failed to get AI response. Please try again.' });
  }
});

// ── ENQUIRY COUNT (unseen by admin) ──
app.get('/api/enquiries/unread-count', requireAuth, async (req, res) => {
  try {
    const [result] = await sql`SELECT count(*)::int as count FROM enquiries WHERE status = 'unread'`;
    res.json({ count: result.count });
  } catch (err) {
    console.error('Unread count error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── NOTIFICATIONS ──
app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM notification_log ORDER BY created_at DESC LIMIT 20`;
    res.json(rows);
  } catch (err) {
    console.error('Notifications error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/notifications/seen', requireAuth, async (req, res) => {
  try {
    await sql`UPDATE notification_log SET seen = true WHERE seen = false`;
    res.json({ ok: true });
  } catch (err) {
    console.error('Mark seen error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/notifications/unread-count', requireAuth, async (req, res) => {
  try {
    const [row] = await sql`SELECT count(*)::int as count FROM notification_log WHERE seen = false`;
    res.json({ count: row.count });
  } catch (err) {
    console.error('Notification count error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── SITEMAP ──
app.get('/sitemap.xml', async (req, res) => {
  try {
    const vehicles = await sql`SELECT id, updated_at FROM vehicles WHERE status != 'sold'`;
    const BASE = 'https://gallant-passion-production-680f.up.railway.app';
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    xml += '  <url><loc>' + BASE + '/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n';
    xml += '  <url><loc>' + BASE + '/inventory.html</loc><changefreq>daily</changefreq><priority>0.9</priority></url>\n';
    xml += '  <url><loc>' + BASE + '/contact.html</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>\n';
    xml += '  <url><loc>' + BASE + '/terms.html</loc><changefreq>yearly</changefreq><priority>0.3</priority></url>\n';
    xml += '  <url><loc>' + BASE + '/privacy.html</loc><changefreq>yearly</changefreq><priority>0.3</priority></url>\n';
    xml += '  <url><loc>' + BASE + '/refund.html</loc><changefreq>yearly</changefreq><priority>0.3</priority></url>\n';
    xml += '  <url><loc>' + BASE + '/used-suvs-accra.html</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>\n';
    xml += '  <url><loc>' + BASE + '/used-sedans-accra.html</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>\n';
    xml += '  <url><loc>' + BASE + '/used-pickups-accra.html</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>\n';
    xml += '  <url><loc>' + BASE + '/electric-cars-ghana.html</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>\n';
    vehicles.forEach(v => {
      xml += '  <url><loc>' + BASE + '/inventory.html?v=' + v.id + '</loc><lastmod>' + (v.updated_at instanceof Date ? v.updated_at.toISOString().split('T')[0] : String(v.updated_at || '').split('T')[0]) + '</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>\n';
    });
    xml += '</urlset>';
    res.set('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    console.error('Sitemap error:', err);
    res.status(500).send('Error generating sitemap');
  }
});

// ── API 404 ──
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ── 404 for non-API routes ──
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(path.join(__dirname, '404.html'));
});

// Export for Vercel serverless + local dev
module.exports = app;

if (require.main === module) {
  sql`ALTER TABLE admins ADD COLUMN IF NOT EXISTS token_version int DEFAULT 0`.catch(() => {});

  sql`CREATE TABLE IF NOT EXISTS notification_log (
    id text PRIMARY KEY,
    type text NOT NULL DEFAULT 'info',
    title text NOT NULL DEFAULT '',
    message text NOT NULL DEFAULT '',
    link text NOT NULL DEFAULT '',
    seen boolean DEFAULT false,
    created_at timestamp DEFAULT now()
  )`.catch(e => console.error('Notification table creation warning:', e.message));

  sql`CREATE TABLE IF NOT EXISTS rate_limits (
    id serial PRIMARY KEY,
    key text NOT NULL,
    ts timestamp DEFAULT now()
  )`.catch(e => console.error('Rate limit table creation warning:', e.message));
  sql`CREATE INDEX IF NOT EXISTS idx_rate_limits_key_ts ON rate_limits (key, ts)`.catch(function() {});

  sql`CREATE TABLE IF NOT EXISTS visit_schedules (
    id text PRIMARY KEY,
    customer_name text NOT NULL,
    customer_phone text NOT NULL,
    customer_email text NOT NULL DEFAULT '',
    preferred_date date NOT NULL,
    preferred_time text NOT NULL DEFAULT '',
    message text NOT NULL DEFAULT '',
    vehicle_id text,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
  )`.catch(e => console.error('Visit schedules table creation warning:', e.message));

  app.listen(PORT, () => {
    console.log(SITE_NAME + ' running at http://localhost:' + PORT);
  });
}

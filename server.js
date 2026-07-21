require('dotenv').config();
const express = require('express');
const { neon } = require('@neondatabase/serverless');
const OpenAI = require('openai');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname)));

// ── DATABASE ──
const sql = neon(process.env.DATABASE_URL);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function genId() {
  return 'v' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
}

function genEnqId() {
  return 'e' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
}

function generateToken(admin) {
  return jwt.sign({ id: admin.id, email: admin.email }, JWT_SECRET, { expiresIn: '7d' });
}

// ── AUTH MIDDLEWARE ──
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ── AUTH ROUTES ──
app.post('/api/auth/login', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/signup', requireAuth, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const hash = await bcrypt.hash(password, 10);
    const [admin] = await sql`INSERT INTO admins (email, password_hash) VALUES (${email}, ${hash}) RETURNING id, email`;
    res.json({ user: admin });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

// ── EMBEDDING GENERATION ──
async function generateEmbedding(text) {
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
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/vehicles/:id', async (req, res) => {
  try {
    const [vehicle] = await sql`SELECT * FROM vehicles WHERE id = ${req.params.id}`;
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    res.json(vehicle);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vehicles/:id/view', async (req, res) => {
  try {
    await sql`UPDATE vehicles SET views = views + 1 WHERE id = ${req.params.id}`;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── VEHICLE ROUTES (admin write) ──
app.post('/api/vehicles', requireAuth, async (req, res) => {
  try {
    const id = genId();
    const now = new Date().toISOString();
    const v = req.body;
    const featuresJson = JSON.stringify(v.features || []);
    const imagesJson = JSON.stringify(v.images || []);

    const [vehicle] = await sql`INSERT INTO vehicles (id, make, model, trim, year, price, condition, status, body_type, fuel, mileage, engine, transmission, color, description, features, images, created_at, updated_at, views, enquiries)
      VALUES (${id}, ${v.make || ''}, ${v.model || ''}, ${v.trim || ''}, ${Number(v.year) || 2024}, ${Number(v.price) || 0}, ${v.condition || 'new'}, ${v.status || 'in_stock'}, ${v.body_type || 'sedan'}, ${v.fuel || 'petrol'}, ${Number(v.mileage) || 0}, ${v.engine || ''}, ${v.transmission || 'automatic'}, ${v.color || ''}, ${v.description || ''}, ${featuresJson}::jsonb, ${imagesJson}::jsonb, ${now}::timestamptz, ${now}::timestamptz, 0, 0)
      RETURNING *`;

    // Auto-embed into knowledge base
    const kbText = vehicleToKnowledge(vehicle);
    await embedAndStore(kbText, 'vehicle', { vehicle_id: vehicle.id, make: vehicle.make, model: vehicle.model, year: vehicle.year, price: vehicle.price, status: vehicle.status });

    res.json(vehicle);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/vehicles/:id', requireAuth, async (req, res) => {
  try {
    const v = req.body;
    const now = new Date().toISOString();
    const featuresJson = JSON.stringify(v.features || []);
    const imagesJson = JSON.stringify(v.images || []);

    const [vehicle] = await sql`UPDATE vehicles SET
      make = ${v.make}, model = ${v.model}, trim = ${v.trim || ''}, year = ${Number(v.year)}, price = ${Number(v.price)},
      condition = ${v.condition}, status = ${v.status}, body_type = ${v.body_type},
      fuel = ${v.fuel}, mileage = ${Number(v.mileage)}, engine = ${v.engine},
      transmission = ${v.transmission}, color = ${v.color}, description = ${v.description},
      features = ${featuresJson}::jsonb, images = ${imagesJson}::jsonb,
      sold_price = ${v.sold_price ? Number(v.sold_price) : null},
      sold_date = ${v.sold_date || null}, sold_to = ${v.sold_to || null},
      updated_at = ${now}::timestamptz
      WHERE id = ${req.params.id}
      RETURNING *`;

    // Re-embed updated vehicle
    const kbText = vehicleToKnowledge(vehicle);
    // Delete old knowledge entry
    await sql`DELETE FROM knowledge_base WHERE content_type = 'vehicle' AND metadata->>'vehicle_id' = ${req.params.id}`;
    // Insert new
    await embedAndStore(kbText, 'vehicle', { vehicle_id: vehicle.id, make: vehicle.make, model: vehicle.model, year: vehicle.year, price: vehicle.price, status: vehicle.status });

    res.json(vehicle);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/vehicles/:id', requireAuth, async (req, res) => {
  try {
    // Remove from knowledge base
    await sql`DELETE FROM knowledge_base WHERE content_type = 'vehicle' AND metadata->>'vehicle_id' = ${req.params.id}`;
    await sql`DELETE FROM vehicles WHERE id = ${req.params.id}`;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ENQUIRY ROUTES ──
app.get('/api/enquiries', requireAuth, async (req, res) => {
  try {
    const enquiries = await sql`SELECT * FROM enquiries ORDER BY created_at DESC`;
    res.json(enquiries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/enquiries', async (req, res) => {
  try {
    const id = genEnqId();
    const e = req.body;
    const [enquiry] = await sql`INSERT INTO enquiries (id, vehicle_id, customer_name, customer_phone, customer_email, message, status, created_at)
      VALUES (${id}, ${e.vehicle_id || null}, ${e.customer_name || 'Anonymous'}, ${e.customer_phone || ''}, ${e.customer_email || ''}, ${e.message || ''}, 'unread', now())
      RETURNING *`;
    res.json(enquiry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/enquiries/:id', requireAuth, async (req, res) => {
  try {
    const e = req.body;
    const [enquiry] = await sql`UPDATE enquiries SET
      status = ${e.status}, customer_name = ${e.customer_name}, message = ${e.message}
      WHERE id = ${req.params.id}
      RETURNING *`;
    res.json(enquiry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/enquiries/:id', requireAuth, async (req, res) => {
  try {
    await sql`DELETE FROM enquiries WHERE id = ${req.params.id}`;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── STATS ──
app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const cars = await sql`SELECT * FROM vehicles`;
    const enqs = await sql`SELECT * FROM enquiries`;
    const [kbRow] = await sql`SELECT count(*)::int as count FROM knowledge_base`;
    const inStock = cars.filter(c => c.status === 'in_stock');
    const sold = cars.filter(c => c.status === 'sold');
    const totalValue = inStock.reduce((s, c) => s + (Number(c.price) || 0), 0);
    res.json({
      totalCars: cars.length,
      inStock: inStock.length,
      sold: sold.length,
      totalValue,
      totalEnquiries: enqs.length,
      unreadEnquiries: enqs.filter(e => e.status === 'unread').length,
      knowledgeEntries: kbRow?.count || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── IMAGE UPLOAD ──
app.post('/api/upload', requireAuth, async (req, res) => {
  // For Neon, we'll use a simple file system approach
  // In production, use Cloudinary, S3, or similar
  try {
    const { filename, data: base64Data } = req.body;
    if (!filename || !base64Data) return res.status(400).json({ error: 'filename and data required' });

    // Return base64 data URL directly (for simplicity)
    // In production, upload to cloud storage
    const ext = filename.split('.').pop() || 'jpg';
    const dataUrl = `data:image/${ext};base64,${base64Data}`;
    res.json({ url: dataUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/knowledge/:id', requireAuth, async (req, res) => {
  try {
    const { content, content_type, metadata } = req.body;
    const updates = {};
    if (content !== undefined) {
      const embedding = await generateEmbedding(content);
      if (!embedding) return res.status(500).json({ error: 'Failed to generate embedding' });
      const embeddingStr = '[' + embedding.join(',') + ']';
      const [entry] = await sql`UPDATE knowledge_base SET content = ${content}, content_type = ${content_type}, metadata = ${JSON.stringify(metadata)}::jsonb, embedding = ${embeddingStr}::vector WHERE id = ${req.params.id} RETURNING id, content, content_type, metadata, created_at, updated_at`;
      return res.json(entry);
    }
    const [entry] = await sql`UPDATE knowledge_base SET content_type = ${content_type}, metadata = ${JSON.stringify(metadata)}::jsonb WHERE id = ${req.params.id} RETURNING id, content, content_type, metadata, created_at, updated_at`;
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/knowledge/:id', requireAuth, async (req, res) => {
  try {
    await sql`DELETE FROM knowledge_base WHERE id = ${req.params.id}`;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk sync: re-embed all vehicles into knowledge base
app.post('/api/knowledge/sync-vehicles', requireAuth, async (req, res) => {
  try {
    const vehicles = await sql`SELECT * FROM vehicles`;
    if (vehicles.length === 0) return res.json({ synced: 0 });

    // Remove old vehicle entries
    await sql`DELETE FROM knowledge_base WHERE content_type = 'vehicle'`;

    // Embed and store each vehicle
    let synced = 0;
    for (const v of vehicles) {
      const kbText = vehicleToKnowledge(v);
      const result = await embedAndStore(kbText, 'vehicle', { vehicle_id: v.id, make: v.make, model: v.model, year: v.year, price: v.price, status: v.status });
      if (result) synced++;
    }

    res.json({ synced });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CHATBOT (RAG + Gemini) ──
const SYSTEM_PROMPT = `You are the AI Car Advisor for Horic Autos, Ghana's premier car dealership based in Accra.

## Your Role
You help customers find the right vehicle, estimate running costs, compare cars, and answer questions about buying/owning a car in Ghana. Be warm, knowledgeable, and concise.

## Context System
You have access to a Retrieval-Augmented Generation (RAG) system. Relevant knowledge base entries are provided below as RETRIEVED CONTEXT. Use them to answer the customer's question accurately. If the retrieved context doesn't contain enough information, use your general knowledge about cars and the Ghanaian market.

## Ghana-Specific Knowledge
- Fuel prices: Petrol ~GHS 16.50/L, Diesel ~GHS 17.10/L, Electric ~GHS 1.60/kWh
- Insurance: Third-party sedan ~GHS 530/yr, SUV ~GHS 620/yr, Comprehensive ~3.5% of vehicle value
- Maintenance: Oil change GHS 320-650, Minor service ~GHS 800, Major service ~GHS 1,800
- Tyres: Budget ~GHS 600, Mid-range ~GHS 950, Premium ~GHS 1,500 per tyre
- Registration: Roadworthy ~GHS 250/yr, Renewal ~GHS 180/yr
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
Add maintenance (~GHS 638/mo base, lower for new/electric, higher for SUVs) and insurance monthly.

## Guidelines
- Always mention prices in GHS (Ghana Cedis)
- When recommending, include the monthly running cost estimate
- Be specific with vehicle names, prices, and features from the retrieved context
- If a customer mentions a budget, show all matching in-stock vehicles sorted by price
- Suggest alternatives if exact request isn't available
- Keep responses concise and helpful, use line breaks for readability
- You can compare two vehicles side by side when asked
- Encourage browsing the inventory page or chatting further`;

app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }

    // Get the latest user message for RAG search
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    const query = lastUserMsg ? lastUserMsg.content : '';

    // RAG: Search knowledge base for relevant context
    const ragResults = await ragSearch(query, 6);

    // Build context from RAG results
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
    res.status(500).json({ error: 'Failed to get AI response: ' + err.message });
  }
});

// ── CATCH ALL ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log('Horic Autos running at http://localhost:' + PORT);
});

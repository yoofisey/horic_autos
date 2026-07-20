require('dotenv').config();
const express = require('express');
const { GoogleGenAI } = require('@google/genai');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname)));

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function genId() {
  return 'v' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
}

function genEnqId() {
  return 'e' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
}

// ── AUTH MIDDLEWARE ──
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid session' });
  req.user = user;
  next();
}

// ── AUTH ROUTES ──
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });
  res.json({ session: data.session, user: data.user });
});

app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return res.status(400).json({ error: error.message });
  res.json({ session: data.session, user: data.user });
});

app.post('/api/auth/logout', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) await supabase.auth.admin.signOut(token);
  res.json({ ok: true });
});

// ── VEHICLE ROUTES (public read) ──
app.get('/api/vehicles', async (req, res) => {
  const { data, error } = await supabase.from('vehicles').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.get('/api/vehicles/:id', async (req, res) => {
  const { data, error } = await supabase.from('vehicles').select('*').eq('id', req.params.id).single();
  if (error) return res.status(404).json({ error: 'Vehicle not found' });
  res.json(data);
});

app.post('/api/vehicles/:id/view', async (req, res) => {
  const { data } = await supabase.from('vehicles').select('views').eq('id', req.params.id).single();
  if (data) {
    await supabase.from('vehicles').update({ views: (data.views || 0) + 1 }).eq('id', req.params.id);
  }
  res.json({ ok: true });
});

// ── VEHICLE ROUTES (admin write) ──
app.post('/api/vehicles', requireAuth, async (req, res) => {
  const vehicle = { ...req.body, id: genId(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), views: 0, enquiries: 0 };
  const { data, error } = await supabase.from('vehicles').insert(vehicle).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/vehicles/:id', requireAuth, async (req, res) => {
  const updates = { ...req.body, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from('vehicles').update(updates).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/vehicles/:id', requireAuth, async (req, res) => {
  const { error } = await supabase.from('vehicles').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ── ENQUIRY ROUTES ──
app.get('/api/enquiries', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('enquiries').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/enquiries', async (req, res) => {
  const enquiry = { ...req.body, id: genEnqId(), status: 'unread', created_at: new Date().toISOString() };
  const { data, error } = await supabase.from('enquiries').insert(enquiry).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/enquiries/:id', requireAuth, async (req, res) => {
  const { data, error } = await supabase.from('enquiries').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/enquiries/:id', requireAuth, async (req, res) => {
  const { error } = await supabase.from('enquiries').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ── STATS ──
app.get('/api/stats', requireAuth, async (req, res) => {
  const { data: cars } = await supabase.from('vehicles').select('*');
  const { data: enqs } = await supabase.from('enquiries').select('*');
  const inStock = (cars || []).filter(c => c.status === 'in_stock');
  const sold = (cars || []).filter(c => c.status === 'sold');
  const totalValue = inStock.reduce((s, c) => s + (c.price || 0), 0);
  res.json({
    totalCars: (cars || []).length,
    inStock: inStock.length,
    sold: sold.length,
    totalValue,
    totalEnquiries: (enqs || []).length,
    unreadEnquiries: (enqs || []).filter(e => e.status === 'unread').length
  });
});

// ── IMAGE UPLOAD ──
app.post('/api/upload', requireAuth, async (req, res) => {
  try {
    const { filename, data: base64Data } = req.body;
    if (!filename || !base64Data) return res.status(400).json({ error: 'filename and data required' });
    const buffer = Buffer.from(base64Data, 'base64');
    const ext = filename.split('.').pop() || 'jpg';
    const path = `vehicles/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from('vehicle-images').upload(path, buffer, {
      contentType: `image/${ext}`,
      upsert: false
    });
    if (error) return res.status(500).json({ error: error.message });
    const { data: urlData } = supabase.storage.from('vehicle-images').getPublicUrl(path);
    res.json({ url: urlData.publicUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── CHATBOT (Gemini) ──
const SYSTEM_PROMPT = `You are the AI Car Advisor for Horic Autos, Ghana's premier car dealership based in Accra.

## Your Role
You help customers find the right vehicle, estimate running costs, compare cars, and answer questions about buying/owning a car in Ghana. Be warm, knowledgeable, and concise.

## Inventory Data
The dealership's current inventory is provided below. When a customer asks about a specific car, refer to this data. When recommending, always pull from this inventory.

INVENTORY:
{{INVENTORY}}

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
- Be specific with vehicle names, prices, and features from the inventory
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

    const { data: inventory } = await supabase.from('vehicles').select('*');
    const inventoryStr = (inventory || []).map(c =>
      `- ${c.year} ${c.make} ${c.model} | ${c.condition === 'new' ? 'New' : 'Pre-Owned'} | ${c.status} | ${c.body_type} | ${c.fuel} | ${c.transmission} | ${c.engine || 'N/A'} | GHS ${Number(c.price).toLocaleString()} | ${c.mileage > 0 ? c.mileage.toLocaleString() + ' km' : 'New'} | ${c.description || ''} | Features: ${(c.features || []).join(', ')}`
    ).join('\n');

    const systemPrompt = SYSTEM_PROMPT.replace('{{INVENTORY}}', inventoryStr || 'No vehicles currently in inventory.');

    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const response = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 1024
      }
    });

    res.json({ reply: response.text || 'No response generated.' });
  } catch (err) {
    console.error('Gemini API error:', err.message);
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

require('dotenv').config();
const express = require('express');
const { GoogleGenAI } = require('@google/genai');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname)));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function loadInventory() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8');
    const match = raw.match(/const DEFAULT_INVENTORY\s*=\s*(\[[\s\S]*?\]);/);
    if (match) return JSON.parse(match[1]);
  } catch (e) { /* ignore */ }
  return [];
}

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

    const inventory = loadInventory();
    const inventoryStr = inventory.map(c =>
      `- ${c.year} ${c.make} ${c.model} | ${c.condition === 'new' ? 'New' : 'Pre-Owned'} | ${c.status} | ${c.body_type} | ${c.fuel} | ${c.transmission} | ${c.engine || 'N/A'} | GHS ${c.price.toLocaleString()} | ${c.mileage > 0 ? c.mileage.toLocaleString() + ' km' : 'New'} | ${c.description || ''} | Features: ${(c.features || []).join(', ')}`
    ).join('\n');

    const systemPrompt = SYSTEM_PROMPT.replace('{{INVENTORY}}', inventoryStr);

    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 1024
      }
    });

    const reply = response.text || 'No response generated.';

    res.json({ reply });
  } catch (err) {
    console.error('Gemini API error:', err.message);
    console.error('Full error:', JSON.stringify(err, null, 2));
    res.status(500).json({ error: 'Failed to get AI response: ' + err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log('Horic Autos running at http://localhost:' + PORT);
});

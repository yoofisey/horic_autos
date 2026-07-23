require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const OpenAI = require('openai');

const sql = neon(process.env.DATABASE_URL);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const KB_ENTRIES = [
  {
    content: "Horic Autos is a premium car dealership based in Accra, Ghana. We specialize in quality pre-owned and brand-new vehicles imported directly from Japan, UAE, UK, and the USA. Our showroom is located in Accra and we serve customers across all regions of Ghana. We are known for transparent pricing with no hidden fees.",
    type: "business"
  },
  {
    content: "Horic Autos Location & Contact: We are located in Accra, Ghana. WhatsApp us at +233 548 000 393 for enquiries. You can also reach us via our website live chat. Our working hours are Monday to Saturday, 8:00 AM to 6:00 PM. Sundays by appointment only.",
    type: "business"
  },
  {
    content: "Horic Autos Pricing Policy: All prices are in Ghana Cedis (GHS). Our listed prices are competitive and include basic documentation. Prices are negotiable for serious buyers. We offer both cash and hire purchase (HP) payment options. There are no hidden charges — what you see is what you pay.",
    type: "business"
  },
  {
    content: "Horic Autos Hire Purchase Terms: We offer flexible hire purchase plans. Typical terms: 25-30% down payment required, interest rates between 28-34% per annum, repayment period of up to 36 months. Monthly installments are fixed. Early settlement discounts may be available. Contact us for a personalized quote.",
    type: "business"
  },
  {
    content: "Horic Autos Vehicle Guarantee: All vehicles undergo a thorough multi-point inspection before listing. We check engine health, transmission, electrical systems, body condition, and more. Every vehicle comes with a basic 3-month mechanical warranty. Extended warranty packages are available at additional cost.",
    type: "business"
  },
  {
    content: "Horic Autos Import Process: We import vehicles directly from Japan (Tokyo/Yokohama ports), UAE (Dubai), UK, and USA. Import timeline is typically 6-8 weeks from order. We handle all customs clearance, DVLA registration, and roadworthy certification. Customers can also request specific vehicles for import.",
    type: "business"
  },
  {
    content: "Horic Autos Popular Car Brands: We stock a wide range of brands including Toyota (Camry, Corolla, RAV4, Land Cruiser, Hilux), Honda (Civic, CR-V), Mercedes-Benz (C-Class, E-Class, GLC), BMW (3 Series, 5 Series, X3, X5), Hyundai (Tucson, Sonata), Kia (Sportage, Sorento), Nissan (X-Trail, Altima), Mitsubishi (Outlander, Pajero), and more.",
    type: "faq"
  },
  {
    content: "Ghana Car Running Costs: Monthly fuel for a typical sedan driving 2000km: Petrol ~GHS 2,755/month (9.5L/100km at GHS 14.50/L). SUV ~GHS 3,770/month (13L/100km). Diesel sedan ~GHS 2,260/month (7L/100km at GHS 16.14/L). Hybrid ~GHS 1,595/month (5.5L/100km). Electric ~GHS 709/month (18kWh/100km at GHS 1.97/kWh). Add insurance ~GHS 46/month (third-party GHS 557/yr), maintenance ~GHS 480/month base, and tyres ~GHS 40-63/month amortized.",
    type: "faq"
  },
  {
    content: "Ghana Car Registration Requirements: To register a car in Ghana you need: Valid national ID (passport or voter's ID), Proof of residence, Insurance certificate (third-party minimum), Roadworthy certificate, Customs import duty receipt (for imported vehicles). DVLA registration fee is approximately GHS 250/year for roadworthy + GHS 180/year for renewal. Horic Autos handles all registration paperwork for you.",
    type: "faq"
  },
  {
    content: "Ghana Fuel Prices (July 2026): Petrol (Gasoline) averages GHS 14.50 per litre (NPA floor GHS 13.28). Diesel averages GHS 16.14 per litre (NPA floor GHS 14.35). LPG approximately GHS 10 per kilogram. Electricity for EVs is approximately GHS 1.97 per kWh (residential rate, 0-300 kWh band). Fuel prices are adjusted every two weeks by the National Petroleum Authority based on international crude prices and the cedi exchange rate.",
    type: "faq"
  },
  {
    content: "Ghana Insurance Costs (2026): Third-party insurance (mandatory): GHS 557/year for all private vehicles (flat rate as of Feb 2026). Comprehensive insurance (recommended): Approximately 5-7% of the vehicle's value per year. For a GHS 200,000 car, comprehensive would be ~GHS 10,000-14,000/year. All vehicles must have minimum third-party insurance to be road-legal in Ghana. Horic Autos can help arrange insurance.",
    type: "faq"
  },
  {
    content: "Ghana Maintenance Costs (2026): Oil change: GHS 400-650 depending on vehicle type and oil grade. Minor service (oil, filters, fluids): ~GHS 800. Major service (includes timing belt, spark plugs, brake fluid): ~GHS 1,800. Tyre replacement: Budget ~GHS 600 each, Mid-range ~GHS 950 each, Premium ~GHS 1,500 each. Brake pad replacement: GHS 400-800 per axle. Battery replacement: GHS 400-1,200. Roadworthy certificate: GHS 100-150/year.",
    type: "faq"
  },
  {
    content: "Buying Tips from Horic Autos: 1) Always check the mileage vs year — average is 15,000-20,000km per year. 2) Ask for service history records. 3) Test drive on both smooth and rough roads. 4) Check for accident damage by looking at panel gaps and paint consistency. 5) Verify the chassis number matches the import documents. 6) Consider total cost of ownership, not just purchase price. Horic Autos provides full transparency on every vehicle.",
    type: "faq"
  },
  {
    content: "Horic Autos Specialization: We are particularly known for our curated collection of Mercedes-Benz C63 AMG models and other high-performance vehicles. Our signature green C63S is a fan favorite. We also stock practical family cars, fuel-efficient hybrids, and rugged SUVs perfect for Ghanaian roads.",
    type: "business"
  },
  {
    content: "Best Cars for Ghanaian Roads: For city driving in Accra, consider a Toyota Corolla or Honda Civic (fuel-efficient, low maintenance). For families, the Toyota RAV4 or Hyundai Tucson offer great value. For long-distance and rough roads, a Toyota Land Cruiser or Mitsubishi Pajero is ideal. For luxury, the Mercedes C-Class or BMW 3 Series. For commercial use, the Toyota Hilux or Nissan Navara are reliable workhorses.",
    type: "faq"
  }
];

async function getEmbedding(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  });
  return response.data[0].embedding;
}

async function main() {
  console.log('--- Running migrations ---');
  
  // 1. Add trim column
  console.log('Adding trim column...');
  await sql`ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS trim text default ''`;
  console.log('✓ trim column ready');
  
  // 2. Count existing KB entries
  const [count] = await sql`SELECT count(*)::int as count FROM knowledge_base`;
  console.log(`Knowledge base has ${count.count} entries`);
  
  // 3. Seed knowledge base
  console.log('Seeding knowledge base with Horic Autos info...');
  let seeded = 0;
  
  for (const entry of KB_ENTRIES) {
    try {
      // Check if similar content already exists
      const [existing] = await sql`SELECT id FROM knowledge_base WHERE content = ${entry.content} LIMIT 1`;
      if (existing) {
        console.log(`  Skipping duplicate: ${entry.type} (${entry.content.substring(0, 60)}...)`);
        continue;
      }
      
      const embedding = await getEmbedding(entry.content);
      const embeddingStr = '[' + embedding.join(',') + ']';
      
      await sql`INSERT INTO knowledge_base (content, content_type, metadata, embedding) VALUES (${entry.content}, ${entry.type}, ${JSON.stringify({ source: 'manual_seed' })}::jsonb, ${embeddingStr}::vector)`;
      
      seeded++;
      console.log(`  ✓ [${entry.type}] ${entry.content.substring(0, 80)}...`);
    } catch (err) {
      console.error(`  ✗ Error seeding entry: ${err.message}`);
    }
  }
  
  console.log(`\n--- Done ---`);
  console.log(`Added ${seeded} knowledge base entries`);
  
  const [finalCount] = await sql`SELECT count(*)::int as count FROM knowledge_base`;
  console.log(`Total knowledge base entries: ${finalCount.count}`);
}

main().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});

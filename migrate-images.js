require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const cloudinary = require('cloudinary').v2;

const sql = neon(process.env.DATABASE_URL);

(async () => {
  if (!process.env.CLOUDINARY_URL) {
    console.error('CLOUDINARY_URL is not set in .env');
    process.exit(1);
  }

  const vehicles = await sql`SELECT id, images FROM vehicles`;
  let dataUrls = 0;
  let uploaded = 0;
  let updated = 0;

  for (const v of vehicles) {
    let images = v.images;
    if (typeof images === 'string') {
      try { images = JSON.parse(images); } catch (e) { images = []; }
    }
    if (!Array.isArray(images)) images = [];

    const out = [];
    let changed = false;
    for (const img of images) {
      if (typeof img === 'string' && img.startsWith('data:image')) {
        dataUrls++;
        try {
          const result = await cloudinary.uploader.upload(img, { folder: 'rhule-auto-hub' });
          out.push(result.secure_url);
          uploaded++;
          changed = true;
          console.log('  migrated ' + v.id + ' -> ' + result.secure_url.substring(0, 60) + '...');
        } catch (e) {
          out.push(img);
          console.error('  upload failed for ' + v.id + ': ' + e.message);
        }
      } else {
        out.push(img);
      }
    }

    if (changed) {
      await sql`UPDATE vehicles SET images = ${JSON.stringify(out)}::jsonb, updated_at = now() WHERE id = ${v.id}`;
      updated++;
    }
  }

  console.log('Done. data URLs found: ' + dataUrls + ', uploaded: ' + uploaded + ', vehicles updated: ' + updated);
  process.exit(0);
})();

# Acceleren Motors GH Ltd — Website Documentation & Strategic Review

**Version:** 1.2
**Date:** August 2026
**Live URL:** https://gallant-passion-production-680f.up.railway.app
**Repository:** https://github.com/yoofisey/horic_autos.git
**Business:** Car dealership — Accra, Ghana

---

## Part 1 — Site Details

### 1.1 Overview

Acceleren Motors GH Ltd is a premium single-dealership website for a Ghanaian car business. It combines a polished public storefront with a full back-office admin panel, an AI car-shopping assistant, and lead-management tooling. The site is live in production and is fully custom-built (no website-builder templates).

### 1.2 Brand & Visual Identity

| Element | Detail |
|---|---|
| Business name | Acceleren Motors GH Ltd |
| Tagline | Ghana's trusted partner for quality vehicles |
| Logo | Orange/black Acceleren logo — `acceleren.jpg` (header/footer/OG) + `acceleren.png` (favicon) |
| Primary colour | Orange `#FF6A00` |
| Accent | Orange `#FF8A1F` |
| Amber highlight | `#FFB13B` |
| Deep orange | `#E65100` |
| Dark / light | Black `#000000` / White `#FFFFFF` |
| Dark surfaces | `--dark-900: #121212`, `--dark-800: #1f1f1f` |
| Fonts | DM Serif Display (headings), system sans (body) |
| Contact | +233 53 262 7932 (phone / WhatsApp) |
| Admin login | admin@accelerenmotors.com (password changeable in Settings) |

### 1.3 Public Website — Pages & Features

| Page | Features |
|---|---|
| **Home** (`index.html`) | Hero, Why Acceleren Motors, Featured Collection, testimonials, Acceleren AI advisor section, schedule-visit modal, WhatsApp float button |
| **Inventory** (`inventory.html`) | Search, filters (make, model, body type, fuel, price, mileage), sort, favourites (heart), side-by-side vehicle comparison, vehicle detail view with photo gallery, share links, per-vehicle view counters, finance calculator, JSON-LD structured data |
| **Contact** (`contact.html`) | Enquiry form (name, phone, email, message), phone/WhatsApp links, AI advisor CTA, WhatsApp / Instagram / Facebook / Snapchat links |
| **Finance Calculator** | On the inventory page: deposit %, rate, term → monthly payment, total interest, one-tap WhatsApp financing enquiry. Also linked from every vehicle detail modal ("Estimate my monthly payment") |
| **Trust pages** | `terms.html`, `privacy.html`, `refund.html` (deposits, imports, warranty, hire purchase terms) — linked from the footer |
| **Local SEO pages** | `used-suvs-accra.html`, `used-sedans-accra.html`, `used-pickups-accra.html`, `electric-cars-ghana.html` — live-filtered inventory, AutoDealer + Breadcrumb JSON-LD, WhatsApp CTA. Listed in the footer, sitemap, and robots.txt |
| **404** (`404.html`) | Branded not-found page |
| **Global** | Sticky nav + footer across pages, mobile responsive, lazy-loaded images, loading skeletons, GA4 conversion tracking (`analytics.js`) |

> **Location:** No showroom is published on the site (removed in the rebrand). Contact is by phone / WhatsApp / email; visiting hours Mon–Sat 09:00–18:00, Sunday by appointment.

### 1.4 Acceleren AI — AI Car Advisor Chatbot

- Floating chat widget available site-wide.
- **RAG pipeline:** knowledge-base entries (FAQs, policies, vehicle specs) are embedded with OpenAI `text-embedding-3-small` and retrieved by similarity for each question.
- **Answer generation:** OpenAI `gpt-4o-mini` with a Ghana-specific system prompt (fuel prices, insurance, maintenance, registration, hire purchase terms, running-cost calculations).
- **Capabilities:** recommend cars by budget, estimate monthly running costs, compare two vehicles, answer financing/import questions.
- **Rate limiting:** 15 requests/minute per IP (DB-backed, survives restarts).
- **Admin-controlled knowledge base:** FAQs, policies, and auto-synced vehicle entries can be edited in the admin panel.

### 1.5 Admin Panel (`admin.html`)

| Tab | Capabilities |
|---|---|
| **Dashboard** | Stats cards (total vehicles, enquiries, sales, pending visits), charts (body-type distribution, monthly sales trend, enquiry trend) |
| **Inventory** | Add/edit/delete vehicles, image upload (Cloudinary), features, mark sold (price/buyer/date), relist, search |
| **Sales History** | Sold vehicles with price/buyer/date |
| **Enquiries** | Read/unread/replied status, contact rows (phone, email, WhatsApp), vehicle reference, inline reply box, Save & Mark Replied, send via WhatsApp / Email / Call, delete |
| **Knowledge Base** | Manage FAQs & policies, sync vehicle entries, view content types and metadata |
| **Scheduled Visits** | Visit management with status flow (pending → confirmed → completed / cancelled), value-first stat cards, per-status filtering |
| **Notifications** | Bell icon with unread badge (new enquiry, new visit, vehicle sold), mark-all-seen |
| **Settings** | Change password, admin account management (add/delete/reset-password) |

**Lead management flow:** an enquiry arrives → notification bell alerts the admin → admin replies in-app, via WhatsApp (opens chat with pre-filled text), via email (SMTP when configured, otherwise opens the visitor's mail app), or by phone.

### 1.6 Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js, Express |
| Database | Neon (serverless Postgres) |
| AI | OpenAI — `text-embedding-3-small` (RAG), `gpt-4o-mini` (chat) |
| Images | Cloudinary (`rhule-auto-hub` folder) |
| Auth | JWT (bcrypt password hashing) |
| Email (optional) | Nodemailer (SMTP env vars) |
| Frontend | Vanilla HTML/CSS/JS + Chart.js (admin charts) |
| Hosting | Railway (auto-deploy from GitHub) |

### 1.7 Database (Postgres) Tables

| Table | Purpose |
|---|---|
| `vehicles` | Inventory, status (in_stock / sold / coming_soon), images (Cloudinary URLs), features, view/enquiry counters, sold metadata |
| `enquiries` | Lead form submissions + `admin_reply`, `replied_at` |
| `visit_schedules` | Customer visit bookings (name, phone, preferred date/time, vehicle) |
| `admins` | Admin accounts (email, bcrypt hash) |
| `knowledge_base` | RAG content + embedding vectors, metadata |
| `notification_log` | Admin notifications (enquiry/visit/sale), seen flag |
| `rate_limits` | DB-backed rate limiting |

### 1.8 Deployment & Operations

- **CI/CD:** push to GitHub `main` → Railway auto-builds and deploys.
- **Database:** managed Postgres on Neon (pooled connection, TLS).
- **Images:** Cloudinary CDN with on-the-fly optimization; a one-time migration moved legacy base64 images to Cloudinary (0 data URLs remain).
- **Sitemap:** `/sitemap.xml` auto-generated from live inventory.
- **Robots:** robots.txt allows public pages, blocks `/admin*` and `/api/*`.

### 1.9 Security

- JWT auth on all admin/API write routes; tokens expire after 7 days.
- bcrypt password hashing.
- DB-backed rate limiting on the AI chatbot (persists across restarts).
- `JWT_SECRET` and `CLOUDINARY_URL` set as strong/production values on Railway.
- `.env` (secrets) is gitignored — never committed.
- Admin protections: cannot delete your own account or the last admin.

### 1.10 Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Neon Postgres connection |
| `JWT_SECRET` | Yes | Signs admin auth tokens |
| `OPENAI_API_KEY` | Yes | RAG embeddings + chat |
| `CLOUDINARY_URL` | Yes | Image hosting (set) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seed only | Initial admin account |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | No | Real email sending (not yet set) |

### 1.11 Current Status

**Complete:** rebrand to Acceleren Motors GH Ltd, public site, inventory, AI advisor, enquiries + replies, visit scheduling, dashboard, notifications, admin accounts, image hosting, rate limiting, finance calculator, trust pages, GA4 conversion tracking, local SEO landing pages, SEO foundation, WhatsApp-first contact without a published showroom.

**Pending / your action:**
- Custom domain (needs a domain purchase + Railway networking setup)
- SMTP email (needs an SMTP account for info@accelerenmotors.com; set SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_NOTIFY_TO on Railway)

---

## Part 2 — Comparison with Top Car Sites

### 2.1 Reference set

International leaders: **CarMax**, **Autotrader**, **Cars.com**, **Cazoo**. Local/Ghana marketplaces: **Cheki Ghana**, **Carmart**, **Jiji Ghana**.

### 2.2 Feature comparison

| Feature | Top global sites | Acceleren Motors GH Ltd | Status |
|---|---|---|---|
| Search + multi-filter inventory | Yes | Yes | ✅ Match |
| Vehicle detail pages (VDP) with gallery | Yes | Yes | ✅ Match |
| Transparent pricing | Yes | Yes (price always shown) | ✅ Match |
| Save favourites / shortlist | Yes | Yes (heart icon) | ✅ Match |
| Side-by-side compare | Yes | Yes | ✅ Match |
| AI shopping assistant | Emerging (2026) | Yes (Acceleren AI) | 🚀 Ahead |
| Book a test drive online | Yes | Yes (Schedule Visit) | ✅ Match |
| Live chat / instant contact | Yes | AI chat + WhatsApp float | ✅ Match |
| WhatsApp lead channel | Rare (US) | Yes | ✅ Local edge |
| Finance / hire-purchase calculator | Yes | Yes (deposit/rate/term → monthly payment + WhatsApp enquiry) | ✅ Match |
| Trade-in valuation tool | Yes | No | ❌ Gap |
| Saved searches + email alerts | Yes | No | ❌ Gap |
| Customer reviews / Google rating widget | Yes | Testimonials only (static) | ⚠️ Partial |
| Video listings / 360° walkaround | Yes | No | ❌ Gap |
| Showroom location + hours + map | Yes | No (deliberately removed in rebrand) | ⚠️ Partial |
| Trust pages (Terms/Privacy/Returns) | Yes | Yes (Terms, Privacy, Refund) | ✅ Match |
| Blog / educational content | Yes | Removed | ❌ Gap |
| Email lead notifications | Yes | In-app only (SMTP not set) | ⚠️ Partial |
| Local SEO pages (city/area) | Yes | Yes (4 landing pages, live-filtered inventory) | ✅ Match |
| Analytics / conversion tracking | Yes | GA4 live (`G-QR9DP6E1G6`) + data-track events | ✅ Match |

**Bottom line:** Acceleren Motors GH Ltd now outranks most Ghanaian competitors on design, AI assistance, structured inventory, trust content, and local SEO. Remaining gaps are reach items (blog, reviews), conversion aids (trade-in, saved searches), and email automation.

---

## Part 3 — Recommendations to Increase Value

### 3.1 Quick wins (low effort, high impact)

1. **Google Business Profile** — claim it, add the business location, and link it to GA4/Google Ads for local SEO + call tracking.
2. **Custom domain + branded email** — e.g. `accelerenmotors.com` and `info@accelerenmotors.com`. Moves the site from a `railway.app` subdomain to a professional presence.
3. **Real customer reviews** — replace placeholder testimonials with genuine feedback; embed the Google rating widget on the homepage.
4. **Enable SMTP email** — auto-send: (a) confirmation to the customer when they enquire, (b) alert email to the admin for every enquiry/visit. Keep the in-app bell too.
5. **Submit to Google Search Console** — index the sitemap (already at `/sitemap.xml`); verify the property for `accelerenmotors.com` once the custom domain is live.

### 3.2 Medium-term (moderate effort, clear ROI)

7. **Finance / hire-purchase calculator** — ✅ Shipped (inventory page + vehicle modals). Next step: add a "finance" toggle to the comparison tool.
8. **WhatsApp Business integration** — dedicated business account with quick-reply templates; every enquiry/visit generates a one-tap WhatsApp conversation with the customer's details pre-filled.
9. **Saved searches & alerts** — let visitors save a search and get notified (email/WhatsApp) when a matching car is listed. Turns one-time visitors into long-term leads.
10. **Video walkarounds** — record short (60–90s) walkaround videos per car; embed on the VDP. Video listings materially lift enquiries on marketplaces like Cazoo and Carmart.
11. **Educational content** — reintroduce a lightweight "Buying Guide" section (top 5 checks before buying used cars, import duty guide, financing options) to win SEO and build authority.
12. **Vehicle inspection checklist** — display a "160-point check" style badge on each VDP with the inspection report as a downloadable PDF. Trust sells.

### 3.3 Strategic (longer-term, differentiate)

13. **Online deposit / reservation** — let customers reserve a car with a small refundable deposit (MoMo/MTN Mobile Money) — a first for many Ghanaian dealers.
14. **Trade-in valuation tool** — visitors answer a few questions about their current car and get an instant rough offer that feeds a lead to the admin.
15. **CRM light** — track enquiry → visit → sale as one pipeline in the admin panel (status per lead, follow-up reminders).
16. **Local SEO landing pages** — ✅ Shipped (SUVs, Sedans, Pickups & Trucks, Electric Cars — Accra/Ghana focused). Expand to more makes/body types as inventory grows.
17. **Analytics** — ✅ GA4 live (`G-QR9DP6E1G6`) + `data-track` conversion events on Call/WhatsApp/Schedule Visit/Send Enquiry/Finance. Retargeting and Google Ads linking are next.
18. **Testimonial capture** — post-sale, send buyers a WhatsApp/SMS link to leave a 5-star review (feeds Google + the site).

### 3.4 Prioritised recommendation

> **Do first:** Google Business Profile, custom domain + SMTP email.
> **Do next:** saved searches, video walkarounds, review capture, trade-in tool.
> **Then consider:** deposit/reservation via MoMo, lead pipeline CRM.

---

*Documentation current as of August 2026. Living document — update as features ship.*

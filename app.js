/* ============================================================
   app.js — Horic Autos Public Site
   Handles: page navigation, inventory grid, car modal,
            AI chat advisor
   ============================================================ */

/* ── STATE ── */
let inventory    = loadInventory();
let activeFilter = 'all';
let chatHistory  = [];
let isBotTyping  = false;

// Modal inline carousel state
let modalCarousel = { idx: 0, imgs: [] };

/* ── HELPERS (Previously Missing) ── */

/** Pulls data from localStorage shared with admin.js */
function loadInventory() {
    const data = localStorage.getItem('horic_inventory');
    return data ? JSON.parse(data) : [];
}

/** Formats numbers into GHS Currency */
function formatPrice(price) {
    return 'GHS ' + Number(price).toLocaleString();
}

/** Returns an emoji based on car type if no image is found */
function getCarEmoji(car) {
    const name = (car.model || "").toLowerCase();
    if (name.includes('truck') || name.includes('hilux')) return '🛻';
    if (name.includes('suv') || name.includes('gle')) return '🚙';
    return '🚗';
}

/** Estimates monthly running costs for the Ghanaian market */
function estimateRunningCosts(car) {
    const price = Number(car.price) || 0;
    // Basic logic: SUVs/Luxury cost more to run
    const fuel = 950; 
    const maintenance = car.condition === 'new' ? 150 : 450;
    const insurance = Math.round((price * 0.025) / 12); // 2.5% annual rate
    
    return {
        fuel,
        maintenance,
        insurance,
        total: fuel + maintenance + insurance
    };
}

/* ══════════════════════════════════════════
   PAGE NAVIGATION
══════════════════════════════════════════ */

function showPage(page) {
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));

  const targetPage = document.getElementById('page-' + page);
  if (targetPage) targetPage.classList.add('active');

  const navLink = document.getElementById('nav-' + page);
  if (navLink) navLink.classList.add('active');

  // Always sync latest inventory
  inventory = loadInventory();

  if (page === 'inventory') renderInventory();
  if (page === 'home')      updateHeroStats();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateHeroStats() {
  const el = document.getElementById('stat-cars');
  if (el) el.innerHTML = inventory.length + '<span class="g">+</span>';
}

/* ══════════════════════════════════════════
   INVENTORY GRID
══════════════════════════════════════════ */

function setFilter(filter, el) {
  activeFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  renderInventory();
}

function renderInventory() {
  inventory = loadInventory();
  const searchInput = document.getElementById('search-input');
  const query = (searchInput ? searchInput.value : '').toLowerCase();

  const filtered = inventory.filter(car => {
    const matchesFilter =
      activeFilter === 'all' ||
      (car.condition && car.condition.toLowerCase() === activeFilter.toLowerCase());

    const matchesSearch =
      !query ||
      `${car.make} ${car.model} ${car.year}`
        .toLowerCase().includes(query);

    return matchesFilter && matchesSearch;
  });

  const countEl = document.getElementById('inv-count');
  if (countEl) {
    countEl.textContent = filtered.length + ' vehicle' + (filtered.length !== 1 ? 's' : '') + ' found';
  }

  const grid = document.getElementById('car-grid');
  if (!grid) return;

  if (!filtered.length) {
    grid.innerHTML = `
      <div class="no-results">
        <div class="icon">🔍</div>
        <p>No vehicles match your search.</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(car => buildCarCard(car)).join('');
}

function buildCarCard(car) {
  const imgs  = car.images || (car.img ? [car.img] : []);
  const costs = estimateRunningCosts(car);
  const isNew = car.condition?.toLowerCase() === 'new';

  const imgAreaInner = imgs.length > 0
    ? `<img class="car-img-photo" src="${imgs[0]}" alt="${car.model}"/>
       ${imgs.length > 1 ? `<div class="car-photo-count">📷 ${imgs.length}</div>` : ''}`
    : `<span class="car-emoji">${getCarEmoji(car)}</span>`;

  return `
    <div class="car-card" onclick="openCarModal(${car.id})">
      <div class="card-speed"></div>
      <div class="car-badge ${isNew ? 'badge-new' : 'badge-used'}">
        ${isNew ? 'New' : 'Pre-Owned'}
      </div>
      <div class="car-img-area">
        ${imgAreaInner}
        <div class="car-img-lines"></div>
      </div>
      <div class="car-body">
        <div class="car-make">${car.make || 'HORIC SELECTION'}</div>
        <div class="car-name">${car.model}</div>
        <div class="car-specs">
          <span class="spec-pill">${car.year}</span>
          <span class="spec-pill">${car.fuel || 'Petrol'}</span>
          <span class="spec-pill">${car.transmission || 'Auto'}</span>
        </div>
        <div class="car-footer">
          <div>
            <div class="car-price">${formatPrice(car.price)}</div>
            <div class="car-price-sub">~GHS ${costs.total.toLocaleString()}/mo running</div>
          </div>
          <button class="btn-view">Details →</button>
        </div>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════
   CAR DETAIL MODAL
══════════════════════════════════════════ */

function openCarModal(id) {
  const car = inventory.find(c => c.id === id);
  if (!car) return;

  const costs = estimateRunningCosts(car);
  const imgs  = car.images || (car.img ? [car.img] : []);
  modalCarousel = { idx: 0, imgs };

  document.getElementById('modal-title').textContent = `${car.make || ''} ${car.model}`;
  document.getElementById('modal-body').innerHTML = buildModalBody(car, costs, imgs);
  document.getElementById('car-modal').classList.add('open');
}

function buildModalBody(car, costs, imgs) {
  return `
    ${buildModalImageArea(imgs, car)}
    <div class="detail-grid">
      <div class="detail-item"><div class="detail-label">Model</div><div class="detail-value">${car.model}</div></div>
      <div class="detail-item"><div class="detail-label">Year</div><div class="detail-value">${car.year}</div></div>
      <div class="detail-item"><div class="detail-label">Condition</div><div class="detail-value">${car.condition}</div></div>
      <div class="detail-item"><div class="detail-label">Fuel</div><div class="detail-value">${car.fuel || 'Petrol'}</div></div>
    </div>
    <div class="cost-box">
      <h4>Estimated Monthly Running Costs</h4>
      <div class="cost-row"><span>Fuel & Maintenance</span><span>GHS ${(costs.fuel + costs.maintenance).toLocaleString()}</span></div>
      <div class="cost-row"><span>Insurance (est.)</span><span>GHS ${costs.insurance.toLocaleString()}</span></div>
      <div class="cost-row"><span>Total Monthly Cost</span><span class="cost-total">GHS ${costs.total.toLocaleString()}</span></div>
    </div>
    <div class="modal-actions">
      <button class="btn-inquire" onclick="startInquiry(${car.id})">Inquire Now</button>
      <button class="btn-ask-ai" onclick="askAIAboutCar(${car.id})">Ask AI Advisor</button>
    </div>`;
}

function buildModalImageArea(imgs, car) {
  if (imgs.length > 1) {
    return `
      <div class="modal-carousel" id="mc">
        <div class="modal-carousel-track" id="mc-track">
          ${imgs.map((src, i) => `
            <div class="modal-carousel-slide">
              <img src="${src}" alt="Photo ${i + 1}"/>
            </div>`).join('')}
        </div>
        <button class="mc-arrow prev" onclick="mcStep(-1)">❮</button>
        <button class="mc-arrow next" onclick="mcStep(1)">❯</button>
      </div>`;
  }
  return `
    <div class="modal-carousel" style="display:flex;align-items:center;justify-content:center">
      ${imgs.length === 1 ? `<img src="${imgs[0]}" style="max-width:100%;max-height:240px;object-fit:contain"/>` : `<span style="font-size:7rem">${getCarEmoji(car)}</span>`}
    </div>`;
}

/* Modal carousel controls */
function mcStep(dir) {
  modalCarousel.idx = (modalCarousel.idx + dir + modalCarousel.imgs.length) % modalCarousel.imgs.length;
  const track = document.getElementById('mc-track');
  if (track) track.style.transform = `translateX(-${modalCarousel.idx * 100}%)`;
}

function closeModalDirect() {
  document.getElementById('car-modal').classList.remove('open');
}

/* ══════════════════════════════════════════
   CHAT & INQUIRIES
══════════════════════════════════════════ */

/** * Opens WhatsApp with a pre-filled message about the specific car.
 * @param {number} id - The ID of the car 
 */
function startInquiry(id) {
  const car = inventory.find(c => c.id === id);
  if (!car) return;

  // 1. Your WhatsApp Number (Use international format without the +)
  const myNumber = "233XXXXXXXXX"; // e.g., 233244123456

  // 2. Craft the message
  const message = `Hello Horic Autos! 🏎️ %0A%0AI am interested in the following vehicle:%0A` +
                  `*Model:* ${car.model}%0A` +
                  `*Year:* ${car.year}%0A` +
                  `*Price:* ${formatPrice(car.price)}%0A%0A` +
                  `Is it still available for a viewing?`;

  // 3. Generate the WhatsApp Link
  const whatsappUrl = `https://wa.me/${myNumber}?text=${message}`;

  // 4. Open in a new tab
  window.open(whatsappUrl, '_blank');
  
  // Optional: Close the modal after they click
  closeModalDirect();
}

/* ══════════════════════════════════════════
   INITIALISATION
══════════════════════════════════════════ */
(function init() {
  inventory = loadInventory();
  updateHeroStats();
  // Render home grid if it exists
  renderInventory();
})();
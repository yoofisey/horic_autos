/* ============================================================
   Horic Autos public experience
   Secure inventory rendering, affordability tools, and local AI advisor
   ============================================================ */

const GHANA_WHATSAPP_NUMBER = '233XXXXXXXXX';
const INCOME_FIT_RATIO = 0.25;
const ENQUIRY_STORE_KEY = 'horicautos-enquiries';

const state = {
  inventory: [],
  buyerIncome: Number(localStorage.getItem('horic-buyer-income')) || 0,
  filters: {
    query: '',
    condition: 'all',
    type: 'all',
    fuel: 'all',
    sort: 'recommended'
  }
};

function initSite() {
  state.inventory = safeLoadInventory();
  renderHome();
  renderInventoryPage();
  bindUi();
  initChatbot();
}

function safeLoadInventory() {
  try {
    if (typeof loadInventory === 'function') {
      const data = loadInventory();
      return Array.isArray(data) && data.length ? data : DEFAULT_INVENTORY;
    }
  } catch (error) {
    console.warn('Inventory load failed, using defaults.', error);
  }
  return Array.isArray(window.DEFAULT_INVENTORY) ? window.DEFAULT_INVENTORY : [];
}

function bindUi() {
  document.querySelector('[data-close-modal]')?.addEventListener('click', closeVehicleModal);
  document.getElementById('vehicle-modal')?.addEventListener('click', event => {
    if (event.target.id === 'vehicle-modal') closeVehicleModal();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeVehicleModal();
      window.HoricAdvisor?.close();
    }
  });

  const filterBindings = [
    ['search-input', 'query', event => event.target.value.trim().toLowerCase()],
    ['condition-filter', 'condition', event => event.target.value],
    ['type-filter', 'type', event => event.target.value],
    ['fuel-filter', 'fuel', event => event.target.value],
    ['sort-filter', 'sort', event => event.target.value]
  ];

  filterBindings.forEach(([id, key, read]) => {
    document.getElementById(id)?.addEventListener('input', event => {
      state.filters[key] = read(event);
      renderInventoryPage();
    });
  });

  document.getElementById('reset-filters')?.addEventListener('click', resetFilters);
  document.getElementById('apply-income')?.addEventListener('click', applyIncome);
  bindAdminUi();
}

function renderHome() {
  const stat = document.getElementById('stat-cars');
  if (stat) {
    stat.textContent = `${state.inventory.length}+`;
  }

  const featured = document.getElementById('featured-grid');
  if (!featured) return;

  const picks = [...state.inventory]
    .sort((a, b) => estimateRunningCosts(a).total - estimateRunningCosts(b).total)
    .slice(0, 3);

  replaceChildren(featured, picks.map(car => buildVehicleCard(car)));
}

function renderInventoryPage() {
  const grid = document.getElementById('vehicle-grid');
  if (!grid) return;

  const incomeInput = document.getElementById('income-input');
  if (incomeInput && state.buyerIncome) incomeInput.value = state.buyerIncome;
  updateIncomeNote();

  const vehicles = filteredVehicles();
  const count = document.getElementById('inventory-count');
  if (count) {
    count.textContent = `${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'} found`;
  }

  if (!vehicles.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No vehicles match those filters. Reset filters or ask the advisor for alternatives.';
    replaceChildren(grid, [empty]);
    return;
  }

  replaceChildren(grid, vehicles.map(car => buildVehicleCard(car)));
}

function filteredVehicles() {
  const { query, condition, type, fuel, sort } = state.filters;
  const filtered = state.inventory.filter(car => {
    const haystack = `${car.make} ${car.model} ${car.year} ${car.type} ${car.fuel} ${car.desc}`.toLowerCase();
    return (!query || haystack.includes(query))
      && (condition === 'all' || car.condition === condition)
      && (type === 'all' || car.type === type)
      && (fuel === 'all' || car.fuel === fuel);
  });

  return filtered.sort((a, b) => {
    if (sort === 'price-asc') return a.price - b.price;
    if (sort === 'price-desc') return b.price - a.price;
    if (sort === 'cost-asc') return estimateRunningCosts(a).total - estimateRunningCosts(b).total;
    if (sort === 'year-desc') return b.year - a.year;
    return recommendationScore(a) - recommendationScore(b);
  });
}

function recommendationScore(car) {
  const costs = estimateRunningCosts(car);
  const affordabilityPenalty = state.buyerIncome
    ? Math.max(0, costs.total - state.buyerIncome * INCOME_FIT_RATIO) * 3
    : 0;
  const usedPenalty = car.condition === 'used' ? 250 : 0;
  return costs.total + affordabilityPenalty + usedPenalty;
}

function buildVehicleCard(car) {
  const costs = estimateRunningCosts(car);
  const card = document.createElement('article');
  card.className = 'vehicle-card';
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `View details for ${car.year} ${car.make} ${car.model}`);

  const image = document.createElement('div');
  image.className = 'vehicle-image';
  const img = primaryImage(car);
  if (img) {
    const photo = document.createElement('img');
    photo.src = img;
    photo.alt = `${car.make} ${car.model}`;
    image.append(photo);
  } else {
    const emoji = document.createElement('span');
    emoji.textContent = getCarEmoji(car);
    image.append(emoji);
  }

  const badge = document.createElement('span');
  const status = car.status || (car.condition === 'new' ? 'New' : 'Pre-owned');
  badge.className = `vehicle-badge ${statusClass(status)}`;
  badge.textContent = status;
  image.append(badge);

  const specs = vehicleTags(car).map(tag => `<span>${escapeText(tag)}</span>`).join('');
  const body = document.createElement('div');
  body.className = 'vehicle-body';
  body.innerHTML = `
    <div class="vehicle-meta">${escapeText(car.year)} · ${escapeText(titleCase(car.fuel))} · ${escapeText(titleCase(car.transmission))}</div>
    <h3>${escapeText(car.make)} ${escapeText(car.model)}</h3>
    <p>${escapeText(car.desc)}</p>
    <div class="vehicle-specs">
      ${specs}
    </div>
    <div class="vehicle-footer">
      <div>
        <strong>${formatPrice(car.price)}</strong>
        <span>~GHS ${costs.total.toLocaleString()}/mo to run</span>
      </div>
      <span class="fit-chip ${incomeFit(car, costs).className}">${incomeFit(car, costs).label}</span>
    </div>
  `;

  card.append(image, body);
  card.addEventListener('click', () => openVehicleModal(car.id));
  card.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') openVehicleModal(car.id);
  });
  return card;
}

function openVehicleModal(id) {
  const car = state.inventory.find(item => item.id === id);
  if (!car) return;

  const costs = estimateRunningCosts(car);
  const fit = incomeFit(car, costs);
  const content = document.getElementById('modal-content');
  const modal = document.getElementById('vehicle-modal');
  if (!content || !modal) return;

  content.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'modal-layout';
  wrap.innerHTML = `
    <div class="modal-visual">${modalVisual(car)}</div>
    <div class="modal-details">
      <p class="eyebrow">${escapeText(titleCase(car.condition))} ${escapeText(titleCase(car.type))}</p>
      <h2 id="modal-title">${escapeText(car.year)} ${escapeText(car.make)} ${escapeText(car.model)}</h2>
      <p>${escapeText(car.desc)}</p>
      <div class="detail-grid">
        ${detailItem('Price', formatPrice(car.price))}
        ${detailItem('Mileage', `${Number(car.mileage || 0).toLocaleString()} km`)}
        ${detailItem('Fuel', titleCase(car.fuel))}
        ${detailItem('Transmission', titleCase(car.transmission))}
      </div>
      <div class="cost-box">
        <h3>Monthly ownership estimate</h3>
        ${costRow('Fuel / charging', costs.fuel)}
        ${costRow('Maintenance', costs.maintenance)}
        ${costRow('Insurance', costs.insurance)}
        ${costRow('Estimated total', costs.total, true)}
      </div>
      <div class="fit-callout ${fit.className}">
        <strong>${fit.label}</strong>
        <span>${escapeText(fit.message)}</span>
      </div>
      <div class="modal-actions">
        <button class="btn-primary" type="button" data-send-enquiry="${car.id}">Send enquiry to admin</button>
        <a class="btn-primary" href="${whatsappUrl(car)}" target="_blank" rel="noopener noreferrer">Inquire on WhatsApp</a>
        <button class="btn-secondary" type="button" data-ask-car="${car.id}">Ask AI about this car</button>
      </div>
    </div>
  `;

  content.append(wrap);
  bindVehicleCarousel(content, car);
  content.querySelector('[data-ask-car]')?.addEventListener('click', () => window.HoricAdvisor?.askAboutCar(car));
  content.querySelector('[data-send-enquiry]')?.addEventListener('click', () => sendVehicleEnquiry(car));
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function closeVehicleModal() {
  const modal = document.getElementById('vehicle-modal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

function applyIncome() {
  const value = Number(document.getElementById('income-input')?.value || 0);
  state.buyerIncome = Math.max(0, value);
  localStorage.setItem('horic-buyer-income', String(state.buyerIncome));
  updateIncomeNote();
  renderInventoryPage();
}

function updateIncomeNote() {
  const note = document.getElementById('income-note');
  if (!note) return;
  if (!state.buyerIncome) {
    note.textContent = 'Add income to tag each listing as ideal, stretch, or high risk.';
    return;
  }
  note.textContent = `Comfort target: running costs below GHS ${Math.round(state.buyerIncome * INCOME_FIT_RATIO).toLocaleString()}/mo.`;
}

function resetFilters() {
  state.filters = { query: '', condition: 'all', type: 'all', fuel: 'all', sort: 'recommended' };
  ['search-input', 'condition-filter', 'type-filter', 'fuel-filter', 'sort-filter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = id === 'search-input' ? '' : state.filters[id.split('-')[0]] || 'all';
  });
  document.getElementById('sort-filter').value = 'recommended';
  renderInventoryPage();
}

function initChatbot() {
  window.HoricAdvisor?.init({
    getInventory: () => state.inventory,
    getIncome: () => state.buyerIncome,
    setIncome: income => {
      state.buyerIncome = Math.max(0, Number(income) || 0);
      localStorage.setItem('horic-buyer-income', String(state.buyerIncome));
      updateIncomeNote();
      renderInventoryPage();
    },
    getCosts: car => estimateRunningCosts(car),
    getFit: (car, costs, income) => incomeFit(car, costs, income),
    priceText: amount => formatPrice(amount)
  });
}

function seedAdvisor() {
  const messages = document.getElementById('chat-messages');
  if (!messages || messages.childElementCount) return;
  appendMessage('bot', 'Welcome. Tell me your monthly income, cash budget, and how you drive, and I will recommend cars with realistic running costs.');
}

function toggleChat() {
  const panel = document.getElementById('chat-panel');
  if (panel?.classList.contains('open')) closeChat();
  else openChat();
}

function openChat() {
  document.getElementById('chat-panel')?.classList.add('open');
  document.getElementById('chat-panel')?.setAttribute('aria-hidden', 'false');
  document.getElementById('chat-toggle')?.setAttribute('aria-expanded', 'true');
  setTimeout(() => document.getElementById('chat-input')?.focus(), 50);
}

function closeChat() {
  document.getElementById('chat-panel')?.classList.remove('open');
  document.getElementById('chat-panel')?.setAttribute('aria-hidden', 'true');
  document.getElementById('chat-toggle')?.setAttribute('aria-expanded', 'false');
}

function handleChatSubmit(event) {
  event.preventDefault();
  const input = document.getElementById('chat-input');
  const prompt = input?.value.trim();
  if (!prompt) return;
  input.value = '';
  submitAdvisorPrompt(prompt);
}

function submitAdvisorPrompt(prompt) {
  openChat();
  appendMessage('user', prompt);
  const answer = buildAdvisorResponse(prompt);
  setTimeout(() => appendMessage('bot', answer), 250);
}

function askAdvisorAboutCar(car) {
  closeVehicleModal();
  submitAdvisorPrompt(`Can I afford the ${car.year} ${car.make} ${car.model}? My monthly income is ${state.buyerIncome ? `GHS ${state.buyerIncome}` : 'not set yet'}.`);
}

function buildAdvisorResponse(prompt) {
  const parsed = parseMoneyContext(prompt);
  const income = parsed.income || state.buyerIncome;
  if (parsed.income) {
    state.buyerIncome = parsed.income;
    localStorage.setItem('horic-buyer-income', String(parsed.income));
  }

  const lifestyle = inferLifestyle(prompt);
  const cars = recommendCars({ income, budget: parsed.budget, lifestyle });

  if (!income && !parsed.budget) {
    return 'I can help, but I need one number first: your monthly income or total cash budget in GHS. As a rule, monthly running costs should stay under 20-25% of income, and cheaper-to-run cars are usually better for daily use.';
  }

  if (!cars.length) {
    return `Based on ${income ? `GHS ${income.toLocaleString()} monthly income` : `a GHS ${parsed.budget.toLocaleString()} budget`}, the current stock is tight. I would avoid stretching into high maintenance cars and either increase budget, consider a used sedan, or ask Horic to source a lower-cost option.`;
  }

  const top = cars.slice(0, 3).map(({ car, costs, fit }) => (
    `${car.year} ${car.make} ${car.model}: ${formatPrice(car.price)}, about GHS ${costs.total.toLocaleString()}/mo running cost, ${fit.label.toLowerCase()}`
  )).join('\n');

  const incomeLine = income
    ? `With GHS ${income.toLocaleString()} monthly income, your comfort ceiling is about GHS ${Math.round(income * INCOME_FIT_RATIO).toLocaleString()}/mo for ownership costs.`
    : `With a GHS ${parsed.budget.toLocaleString()} cash budget, I focused on purchase price and monthly running costs.`;

  return `${incomeLine}\n${top}\nMy first pick is the ${cars[0].car.make} ${cars[0].car.model} because it has the strongest mix of price, practicality, and running-cost control for your use case. Would you like a stricter low-maintenance shortlist or a more premium shortlist?`;
}

function recommendCars({ income, budget, lifestyle }) {
  return state.inventory
    .filter(car => !budget || car.price <= budget)
    .filter(car => {
      if (lifestyle === 'family') return ['suv', 'sedan'].includes(car.type);
      if (lifestyle === 'work') return ['truck', 'suv'].includes(car.type);
      if (lifestyle === 'low-cost') return ['hybrid', 'electric', 'diesel'].includes(car.fuel) || car.price < 180000;
      return true;
    })
    .map(car => {
      const costs = estimateRunningCosts(car);
      const fit = incomeFit(car, costs, income);
      return { car, costs, fit, score: advisorScore(car, costs, fit, lifestyle) };
    })
    .sort((a, b) => a.score - b.score);
}

function advisorScore(car, costs, fit, lifestyle) {
  let score = costs.total + car.price / 600;
  if (fit.className === 'stretch') score += 1500;
  if (fit.className === 'risk') score += 5000;
  if (lifestyle === 'low-cost' && ['hybrid', 'electric', 'diesel'].includes(car.fuel)) score -= 500;
  if (lifestyle === 'family' && car.type === 'suv') score -= 400;
  return score;
}

function parseMoneyContext(text) {
  const normalized = text.toLowerCase().replace(/,/g, '');
  const numbers = [...normalized.matchAll(/(?:ghs|₵)?\s*(\d{4,9})/g)].map(match => Number(match[1]));
  const income = numbers.find(num => /income|earn|salary|monthly|month|per month/.test(normalized) && num < 100000);
  const budget = numbers.find(num => /budget|cash|have|price|afford/.test(normalized) && num >= 30000) || 0;
  return { income: income || 0, budget };
}

function inferLifestyle(text) {
  const lower = text.toLowerCase();
  if (/family|kids|school|suv|space/.test(lower)) return 'family';
  if (/work|site|farm|cargo|pickup|truck/.test(lower)) return 'work';
  if (/low|cheap|economy|fuel|daily|commute|maintenance/.test(lower)) return 'low-cost';
  return 'balanced';
}

function incomeFit(car, costs = estimateRunningCosts(car), income = state.buyerIncome) {
  if (!income) {
    return { className: 'neutral', label: 'Add income', message: 'Add monthly income for a personalized affordability rating.' };
  }
  const ratio = costs.total / income;
  if (ratio <= 0.18) {
    return { className: 'ideal', label: 'Ideal fit', message: 'Running costs sit comfortably below the 20-25% income guardrail.' };
  }
  if (ratio <= INCOME_FIT_RATIO) {
    return { className: 'stretch', label: 'Manageable', message: 'This can work, but leave room for repairs, fuel changes, and registration costs.' };
  }
  return { className: 'risk', label: 'High risk', message: 'Running costs exceed the comfort range for the income provided.' };
}

function estimateRunningCosts(car) {
  if (typeof window.estimateRunningCosts === 'function' && window.estimateRunningCosts !== estimateRunningCosts) {
    return window.estimateRunningCosts(car);
  }
  const price = Number(car.price) || 0;
  const fuel = car.fuel === 'electric' ? 180 : car.fuel === 'diesel' ? 520 : car.fuel === 'hybrid' ? 390 : 680;
  const maintenance = car.fuel === 'electric' ? 80 : car.condition === 'new' ? 120 : car.type === 'truck' ? 360 : 280;
  const insurance = Math.round(price * 0.002);
  return { fuel, maintenance, insurance, total: fuel + maintenance + insurance };
}

function formatPrice(amount) {
  if (typeof window.formatPrice === 'function' && window.formatPrice !== formatPrice) {
    return window.formatPrice(amount);
  }
  return `GHS ${Number(amount || 0).toLocaleString()}`;
}

function getCarEmoji(car) {
  if (typeof window.getCarEmoji === 'function' && window.getCarEmoji !== getCarEmoji) {
    return window.getCarEmoji(car);
  }
  if (car.fuel === 'electric') return '⚡';
  return { suv: '🚙', sedan: '🚗', truck: '🛻', hatchback: '🚘', coupe: '🏎️', van: '🚐' }[car.type] || '🚗';
}

function primaryImage(car) {
  return Array.isArray(car.images) && car.images.length ? car.images[0] : '';
}

function modalVisual(car) {
  const images = Array.isArray(car.images) ? car.images.filter(Boolean) : [];
  if (images.length) {
    return `
      <div class="vehicle-carousel" data-carousel>
        ${images.length > 1 ? '<button class="carousel-arrow prev" type="button" data-carousel-prev aria-label="Previous vehicle photo">‹</button>' : ''}
        <img src="${escapeAttribute(images[0])}" alt="${escapeAttribute(`${car.make} ${car.model}`)}" data-carousel-image>
        ${images.length > 1 ? '<button class="carousel-arrow next" type="button" data-carousel-next aria-label="Next vehicle photo">›</button>' : ''}
        ${images.length > 1 ? `<span class="carousel-count" data-carousel-count>1 / ${images.length}</span>` : ''}
      </div>
    `;
  }
  return `<span>${escapeText(getCarEmoji(car))}</span>`;
}

function detailItem(label, value) {
  return `<div><span>${escapeText(label)}</span><strong>${escapeText(value)}</strong></div>`;
}

function costRow(label, amount, total = false) {
  return `<div class="cost-row ${total ? 'total' : ''}"><span>${escapeText(label)}</span><strong>GHS ${Number(amount || 0).toLocaleString()}</strong></div>`;
}

function whatsappUrl(car) {
  const message = `Hello Horic Autos. I am interested in the ${car.year} ${car.make} ${car.model} listed at ${formatPrice(car.price)}. Is it available for inspection?`;
  return `https://wa.me/${GHANA_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function bindVehicleCarousel(container, car) {
  const images = Array.isArray(car.images) ? car.images.filter(Boolean) : [];
  if (images.length < 2) return;
  const image = container.querySelector('[data-carousel-image]');
  const count = container.querySelector('[data-carousel-count]');
  let index = 0;

  const render = () => {
    image.src = images[index];
    count.textContent = `${index + 1} / ${images.length}`;
  };

  container.querySelector('[data-carousel-prev]')?.addEventListener('click', event => {
    event.stopPropagation();
    index = (index - 1 + images.length) % images.length;
    render();
  });

  container.querySelector('[data-carousel-next]')?.addEventListener('click', event => {
    event.stopPropagation();
    index = (index + 1) % images.length;
    render();
  });
}

async function sendVehicleEnquiry(car) {
  const enquiries = loadEnquiries();
  const enquiry = {
    id: Date.now(),
    carId: car.id,
    vehicle: `${car.year} ${car.make} ${car.model}`,
    price: car.price,
    buyerIncome: state.buyerIncome || 0,
    status: 'unread',
    message: `Customer is interested in ${car.year} ${car.make} ${car.model}.`,
    createdAt: new Date().toISOString()
  };
  enquiries.unshift(enquiry);
  localStorage.setItem(ENQUIRY_STORE_KEY, JSON.stringify(enquiries));
  try {
    await fetch('/api/enquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehicle_id: car.id,
        message: enquiry.message,
        buyer_income: enquiry.buyerIncome
      })
    });
  } catch (error) {
    // Static deployments use localStorage; Python backend deployments receive the API call above.
  }
  showLocalNotification('New vehicle enquiry sent', enquiry.vehicle);
  alert('Your enquiry has been sent to the admin dashboard.');
}

function loadEnquiries() {
  try {
    const data = JSON.parse(localStorage.getItem(ENQUIRY_STORE_KEY) || '[]');
    return Array.isArray(data) ? data : [];
  } catch (error) {
    return [];
  }
}

function showLocalNotification(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

function replaceChildren(parent, children) {
  parent.innerHTML = '';
  children.forEach(child => parent.append(child));
}

function titleCase(value = '') {
  return String(value).replace(/\b\w/g, letter => letter.toUpperCase());
}

function appendMessage(role, text) {
  const messages = document.getElementById('chat-messages');
  if (!messages) return;
  const row = document.createElement('div');
  row.className = `message ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  bubble.textContent = text;
  row.append(bubble);
  messages.append(row);
  messages.scrollTop = messages.scrollHeight;
}

function escapeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function escapeAttribute(value) {
  return escapeText(value).replace(/`/g, '&#096;');
}

document.addEventListener('DOMContentLoaded', initSite);

/* ============================================================
   Admin compatibility
   The existing admin.html calls these globals. They now use the same
   shared inventory store as the public site.
   ============================================================ */

let pendingDeleteId = null;

function renderAdminTable() {
  state.inventory = safeLoadInventory();
  const tbody = document.getElementById('adminTableBody');
  if (!tbody) return;

  const inStock = state.inventory.length;
  const totalValue = state.inventory.reduce((sum, car) => sum + Number(car.price || 0), 0);

  setText('statTotal', state.inventory.length);
  setText('statInStock', `${inStock} active listings`);
  setText('statValue', `GHS ${Math.round(totalValue / 1000).toLocaleString()}k`);
  setText('statSoon', state.inventory.filter(car => car.condition === 'new').length);
  renderAdminNotifications();

  tbody.innerHTML = '';
  state.inventory.forEach(car => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        <div class="admin-vehicle-cell">
          ${adminThumbMarkup(car)}
          <div>
            <strong>${escapeText(car.year)} ${escapeText(car.make)} ${escapeText(car.model)}</strong>
            <span>${escapeText(titleCase(car.fuel))} · ${escapeText(titleCase(car.transmission))}</span>
          </div>
        </div>
      </td>
      <td><span class="status-badge">${escapeText(titleCase(car.condition || 'available'))}</span></td>
      <td>${escapeText(formatPrice(car.price))}</td>
      <td>${escapeText(car.year)}</td>
      <td>
        <div class="action-group">
          <button class="action-btn edit" type="button" data-edit="${car.id}">Edit</button>
          <button class="action-btn delete" type="button" data-delete="${car.id}">Remove</button>
        </div>
      </td>
    `;
    tbody.append(row);
  });

  tbody.querySelectorAll('[data-edit]').forEach(button => {
    button.addEventListener('click', () => editVehicle(Number(button.dataset.edit)));
  });
  tbody.querySelectorAll('[data-delete]').forEach(button => {
    button.addEventListener('click', () => confirmDelete(Number(button.dataset.delete)));
  });
}

function filterAdminTable(term) {
  const query = String(term || '').toLowerCase();
  document.querySelectorAll('#adminTableBody tr').forEach(row => {
    row.style.display = row.textContent.toLowerCase().includes(query) ? '' : 'none';
  });
}

function openAddCarModal() {
  openAdminModal('addCarModal');
}

function closeAdminModal(event) {
  if (event && event.target.id !== 'addCarModal') return;
  closeAdminModalById('addCarModal');
}

async function addVehicle() {
  const make = readField('f-make');
  const model = readField('f-model');
  const year = Number(readField('f-year')) || new Date().getFullYear();
  const price = Number(readField('f-price'));
  const desc = readField('f-desc');
  if (!make || !model || !price) {
    alert('Please fill in Make, Model, and Price.');
    return;
  }

  let images = [];
  try {
    images = await readImageFiles('f-image');
  } catch (error) {
    alert(error.message);
    return;
  }

  const car = {
    id: generateAdminId(),
    make,
    model,
    year,
    price,
    condition: readField('f-condition') || statusToCondition(readField('f-status')),
    status: readField('f-status') || 'In Stock',
    type: readField('f-type') || 'sedan',
    fuel: readField('f-fuel') || 'petrol',
    mileage: Number(readField('f-mileage')) || 0,
    engine: readField('f-engine') || 'N/A',
    transmission: readField('f-transmission') || 'automatic',
    desc: desc || `${year} ${make} ${model} listed by Horic Autos.`,
    images
  };

  state.inventory.push(car);
  persistInventory();
  clearAddVehicleForm();
  closeAdminModalById('addCarModal');
  renderAdminTable();
}

function editVehicle(id) {
  const car = state.inventory.find(item => item.id === id);
  if (!car) return;
  setField('e-id', car.id);
  setField('e-make', car.make);
  setField('e-model', car.model);
  setField('e-year', car.year);
  setField('e-price', car.price);
  setField('e-accel', '');
  setField('e-topspeed', '');
  setField('e-status', car.condition === 'new' ? 'In Stock' : 'In Stock');
  openAdminModal('editCarModal');
}

function openEditModal() {
  openAdminModal('editCarModal');
}

function closeEditModal(event) {
  if (event && event.target.id !== 'editCarModal') return;
  closeAdminModalById('editCarModal');
}

function saveEditVehicle() {
  const id = Number(readField('e-id'));
  const car = state.inventory.find(item => item.id === id);
  if (!car) return;

  const make = readField('e-make');
  const model = readField('e-model');
  const price = Number(readField('e-price'));
  if (!make || !model || !price) {
    alert('Please fill in Make, Model, and Price.');
    return;
  }

  car.make = make;
  car.model = model;
  car.year = Number(readField('e-year')) || car.year;
  car.price = price;
  car.condition = statusToCondition(readField('e-status'));
  persistInventory();
  closeAdminModalById('editCarModal');
  renderAdminTable();
}

function confirmDelete(id) {
  pendingDeleteId = id;
  openAdminModal('deleteConfirmModal');
  const confirm = document.getElementById('confirmDeleteBtn');
  if (confirm) {
    confirm.onclick = () => {
      state.inventory = state.inventory.filter(car => car.id !== pendingDeleteId);
      persistInventory();
      closeDeleteModal();
      renderAdminTable();
    };
  }
}

function closeDeleteModal(event) {
  if (event && event.target.id !== 'deleteConfirmModal') return;
  closeAdminModalById('deleteConfirmModal');
  pendingDeleteId = null;
}

function openAdminModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('active');
  document.body.classList.add('modal-open');
}

function closeAdminModalById(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('active');
  document.body.classList.remove('modal-open');
}

function persistInventory() {
  if (typeof saveInventory === 'function') saveInventory(state.inventory);
  else localStorage.setItem('horicautos-inventory', JSON.stringify(state.inventory));
}

function generateAdminId() {
  if (typeof generateId === 'function') return generateId();
  return Date.now();
}

function statusToCondition(status) {
  return status === 'Sold' ? 'used' : 'new';
}

function statusClass(status = '') {
  const key = String(status).toLowerCase();
  if (key.includes('sold')) return 'sold';
  if (key.includes('soon')) return 'soon';
  if (key.includes('pre') || key.includes('used')) return 'used';
  return 'new';
}

function vehicleTags(car) {
  const tags = [
    car.condition === 'new' ? 'New' : 'Pre-owned',
    car.type && titleCase(car.type),
    car.fuel && titleCase(car.fuel),
    car.transmission && titleCase(car.transmission),
    Number(car.mileage || 0) ? `${Number(car.mileage).toLocaleString()} km` : 'Zero mileage',
    car.engine || 'N/A'
  ];
  return tags.filter(Boolean);
}

function readField(id) {
  return document.getElementById(id)?.value.trim() || '';
}

function setField(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function adminThumbMarkup(car) {
  const img = primaryImage(car);
  if (img) {
    return `<span class="admin-thumb has-image"><img src="${escapeAttribute(img)}" alt="${escapeAttribute(`${car.make} ${car.model}`)}"></span>`;
  }
  return `<span class="admin-thumb">${escapeText(getCarEmoji(car))}</span>`;
}

function renderAdminNotifications() {
  const list = document.getElementById('adminNotifications');
  if (!list) return;
  const enquiries = loadEnquiries();
  const unread = enquiries.filter(item => item.status !== 'read').length;
  setText('statEnquiries', enquiries.length);
  setText('statUnreadEnquiries', `${unread} unread`);

  if (!enquiries.length) {
    list.innerHTML = '<div class="empty-notification">No enquiries yet.</div>';
    return;
  }

  list.innerHTML = enquiries.slice(0, 10).map(item => `
    <article class="notification-item ${item.status !== 'read' ? 'unread' : ''}">
      <div>
        <strong>${escapeText(item.vehicle)}</strong>
        <p>${escapeText(item.message)}</p>
        <span>${new Date(item.createdAt).toLocaleString()}</span>
      </div>
      <button type="button" class="action-btn" data-mark-enquiry="${item.id}">Mark read</button>
    </article>
  `).join('');

  list.querySelectorAll('[data-mark-enquiry]').forEach(button => {
    button.addEventListener('click', () => markEnquiryRead(Number(button.dataset.markEnquiry)));
  });
}

function markEnquiryRead(id) {
  const enquiries = loadEnquiries().map(item => (
    item.id === id ? { ...item, status: 'read' } : item
  ));
  localStorage.setItem(ENQUIRY_STORE_KEY, JSON.stringify(enquiries));
  renderAdminNotifications();
}

function enableAdminNotifications() {
  if (!('Notification' in window)) {
    alert('This browser does not support device notifications.');
    return;
  }
  Notification.requestPermission().then(permission => {
    if (permission === 'granted') {
      showLocalNotification('Horic notifications enabled', 'New enquiries can now notify this admin device while the dashboard is open.');
    }
  });
}

function readImageFiles(inputId) {
  const files = [...(document.getElementById(inputId)?.files || [])];
  if (!files.length) return Promise.resolve([]);
  if (files.length > 8) {
    return Promise.reject(new Error('Please upload 8 images or fewer per vehicle.'));
  }

  return Promise.all(files.map(readImageFile));
}

function readImageFile(file) {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('Please choose a valid image file.'));
  }
  if (file.size > 1024 * 1024) {
    return Promise.reject(new Error('Each image must be smaller than 1 MB so it can be saved in this browser.'));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('The image could not be read. Please try another file.'));
    reader.readAsDataURL(file);
  });
}

function clearAddVehicleForm() {
  ['f-make', 'f-model', 'f-year', 'f-price', 'f-mileage', 'f-engine', 'f-desc', 'f-image'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  setField('f-type', 'sedan');
  setField('f-fuel', 'petrol');
  setField('f-transmission', 'automatic');
  setField('f-condition', 'new');
  setField('f-status', 'In Stock');
}

function bindAdminUi() {
  if (!document.querySelector('.admin-wrapper')) return;
  document.getElementById('openAddVehicle')?.addEventListener('click', openAddCarModal);
  document.getElementById('adminSearch')?.addEventListener('input', event => filterAdminTable(event.target.value));
  document.getElementById('addVehicleBtn')?.addEventListener('click', addVehicle);
  document.getElementById('saveVehicleBtn')?.addEventListener('click', saveEditVehicle);
  document.getElementById('enableAdminNotifications')?.addEventListener('click', enableAdminNotifications);

  window.addEventListener('storage', event => {
    if (event.key === ENQUIRY_STORE_KEY) {
      const latest = loadEnquiries()[0];
      if (latest && latest.status !== 'read') {
        showLocalNotification('New vehicle enquiry', latest.vehicle);
      }
      renderAdminNotifications();
    }
  });

  document.querySelectorAll('[data-admin-close]').forEach(button => {
    button.addEventListener('click', () => {
      closeAdminModalById(button.dataset.adminClose);
      pendingDeleteId = null;
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', event => {
      if (event.target === modal) {
        closeAdminModalById(modal.id);
        pendingDeleteId = null;
      }
    });
  });

  renderAdminTable();
}

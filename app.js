const HoricApp = (() => {
  let modalCar = null;
  let modalImageIndex = 0;
  let cachedVehicles = [];

  async function fetchVehicles() {
    try {
      const res = await fetch('/api/vehicles');
      if (res.ok) {
        cachedVehicles = await res.json();
      } else {
        cachedVehicles = [];
      }
    } catch (e) {
      cachedVehicles = [];
    }
    return cachedVehicles;
  }

  function statusBadge(status) {
    const map = {
      in_stock: '<span class="badge badge-new">In Stock</span>',
      sold: '<span class="badge badge-sold">Sold</span>',
      coming_soon: '<span class="badge badge-coming">Coming Soon</span>'
    };
    return map[status] || '';
  }

  function conditionBadge(cond) {
    return cond === 'new' ? '<span class="badge badge-new">New</span>' : '<span class="badge badge-used">Pre-Owned</span>';
  }

  const CAR_SVG = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M5 17h14M5 17a2 2 0 01-2-2V9a2 2 0 012-2h1l2-3h8l2 3h1a2 2 0 012 2v6a2 2 0 01-2 2M5 17l-1 2h1m14-2l1 2h-1"/><circle cx="7.5" cy="17" r="1" /><circle cx="16.5" cy="17" r="1" /></svg>';

  function buildCarCard(car) {
    const costs = HoricData.estimateRunningCosts(car);
    let imgHtml;
    if (car.images && car.images.length > 0) {
      imgHtml = '<img src="' + car.images[0] + '" alt="' + car.make + ' ' + car.model + '">';
    } else {
      imgHtml = '<div class="car-card-img-placeholder"><div class="car-card-img-icon">' + CAR_SVG + '</div><div class="car-card-img-label">' + car.make + '</div></div>';
    }

    return '<div class="car-card reveal" onclick="HoricApp.openModal(\'' + car.id + '\')">' +
      '<div class="car-card-image">' + imgHtml +
      '<div class="car-card-badges">' + conditionBadge(car.condition) + statusBadge(car.status) + '</div></div>' +
      '<div class="car-card-body">' +
      '<div class="car-card-year">' + car.year + '</div>' +
      '<div class="car-card-name">' + car.make + ' ' + car.model + (car.trim ? ' ' + car.trim : '') + '</div>' +
      '<div class="car-card-specs">' +
      '<span class="spec-pill">' + car.body_type + '</span>' +
      '<span class="spec-pill">' + car.fuel + '</span>' +
      '<span class="spec-pill">' + car.transmission + '</span>' +
      (car.mileage > 0 ? '<span class="spec-pill">' + car.mileage.toLocaleString() + ' km</span>' : '') +
      '</div>' +
      '<div class="car-card-footer">' +
      '<div><div class="car-card-price">' + HoricData.formatPrice(car.price) + '</div>' +
      '<div class="car-card-cost">~<span>' + HoricData.formatPrice(costs.total) + '/mo</span> running</div></div>' +
      '</div></div></div>';
  }

  async function renderFeatured() {
    const grid = document.getElementById('featuredGrid');
    if (!grid) return;
    const cars = await fetchVehicles();
    const inStock = cars.filter(c => c.status === 'in_stock').slice(0, 6);
    grid.innerHTML = inStock.map(buildCarCard).join('');
    observeReveal();
  }

  function renderHero() {
    const cars = cachedVehicles.length ? cachedVehicles : [];
    const stats = { inStock: cars.filter(c => c.status === 'in_stock').length };
    const el = (id) => document.getElementById(id);

    if (el('statCars')) el('statCars').textContent = stats.inStock + '+';
    if (el('trustCount')) el('trustCount').textContent = stats.inStock + '+';

    if (cars.length > 0) {
      const featured = cars.filter(c => c.status === 'in_stock')[Math.floor(Math.random() * Math.min(stats.inStock, 3))];
      if (featured) {
        if (el('heroCarName')) el('heroCarName').textContent = featured.year + ' ' + featured.make + ' ' + featured.model;
        if (el('heroCarPrice')) el('heroCarPrice').textContent = HoricData.formatPrice(featured.price);
        const costs = HoricData.estimateRunningCosts(featured);
        if (el('heroCarCost')) el('heroCarCost').textContent = 'Est. ' + HoricData.formatPrice(costs.total) + '/month running cost';
      }
    }
  }

  async function renderInventoryGrid() {
    const grid = document.getElementById('inventoryGrid');
    const noResults = document.getElementById('noResults');
    const countEl = document.getElementById('resultCount');
    if (!grid) return;

    if (!cachedVehicles.length) await fetchVehicles();

    const search = document.getElementById('filterSearch')?.value || '';
    const make = document.getElementById('filterMake')?.value || '';
    const model = document.getElementById('filterModel')?.value || '';
    const body_type = document.getElementById('filterBody')?.value || '';
    const fuel = document.getElementById('filterFuel')?.value || '';
    const condition = document.getElementById('filterCondition')?.value || '';
    const status = document.getElementById('filterStatus')?.value || '';
    const minPrice = Number(document.getElementById('filterMinPrice')?.value) || 0;
    const maxPrice = Number(document.getElementById('filterMaxPrice')?.value) || Infinity;
    const minYear = Number(document.getElementById('filterMinYear')?.value) || 0;
    const maxMileage = Number(document.getElementById('filterMaxMileage')?.value) || Infinity;
    const sort = document.getElementById('sortSelect')?.value || 'newest';

    const results = HoricData.filterInventory(cachedVehicles, { search, make, model, body_type, fuel, condition, status, minPrice, maxPrice, minYear, maxMileage: maxMileage === 0 ? Infinity : maxMileage, sort });

    if (countEl) countEl.textContent = results.length;
    if (results.length === 0) {
      grid.innerHTML = '';
      if (noResults) {
        noResults.style.display = 'block';
        var titleEl = document.getElementById('noResultsTitle');
        var textEl = document.getElementById('noResultsText');
        if (make && model && titleEl) {
          titleEl.textContent = 'No ' + make + ' ' + model + ' found';
          textEl.textContent = 'We don\'t currently have any ' + make + ' ' + model + ' in our inventory. Try browsing other models or let our AI advisor help.';
        } else if (make && titleEl) {
          titleEl.textContent = 'No ' + make + ' vehicles found';
          textEl.textContent = 'We don\'t currently have any ' + make + ' vehicles in stock. Browse other makes or chat with our AI advisor for alternatives.';
        } else if (search && titleEl) {
          titleEl.textContent = 'No results for "' + search + '"';
          textEl.textContent = 'We couldn\'t find any vehicles matching your search. Try different keywords or reset your filters.';
        } else if (titleEl) {
          titleEl.textContent = 'No vehicles found';
          textEl.textContent = 'We couldn\'t find any vehicles matching your current filters. Try broadening your search criteria.';
        }
      }
    } else {
      if (noResults) noResults.style.display = 'none';
      grid.innerHTML = results.map(buildCarCard).join('');
    }
    observeReveal();
  }

  function applyFilters() { renderInventoryGrid(); }

  function resetFilters() {
    ['filterSearch', 'filterMake', 'filterModel', 'filterBody', 'filterFuel', 'filterCondition', 'filterStatus', 'filterMinPrice', 'filterMaxPrice', 'filterMinYear', 'filterMaxMileage'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const sortEl = document.getElementById('sortSelect');
    if (sortEl) sortEl.value = 'newest';
    populateModels();
    renderInventoryGrid();
  }

  function populateFilters() {
    const makeSelect = document.getElementById('filterMake');
    const modelSelect = document.getElementById('filterModel');
    if (!makeSelect) return;

    var makes = Object.keys(HoricData.CAR_MAKES_MODELS).sort();
    const currentMake = makeSelect.value;

    makeSelect.innerHTML = '<option value="">All Makes</option>' +
      makes.map(m => '<option value="' + m + '"' + (m === currentMake ? ' selected' : '') + '>' + m + '</option>').join('');

    populateModels();

    makeSelect.addEventListener('change', function() {
      populateModels();
      renderInventoryGrid();
    });
    modelSelect.addEventListener('change', function() {
      renderInventoryGrid();
    });
  }

  function populateModels() {
    const makeSelect = document.getElementById('filterMake');
    const modelSelect = document.getElementById('filterModel');
    if (!makeSelect || !modelSelect) return;

    const selectedMake = makeSelect.value;
    const models = selectedMake && HoricData.CAR_MAKES_MODELS[selectedMake]
      ? HoricData.CAR_MAKES_MODELS[selectedMake].slice().sort()
      : [];
    const currentModel = modelSelect.value;

    modelSelect.innerHTML = '<option value="">All Models</option>' +
      models.map(m => '<option value="' + m + '"' + (m === currentModel ? ' selected' : '') + '>' + m + '</option>').join('');
  }

  function openModal(id) {
    const car = cachedVehicles.find(c => c.id === id);
    if (!car) return;
    modalCar = car;
    modalImageIndex = 0;

    const el = (eid) => document.getElementById(eid);
    el('modalTitle').textContent = car.make + ' ' + car.model + (car.trim ? ' ' + car.trim : '');
    el('modalYear').textContent = car.year + '  ·  ' + (car.condition === 'new' ? 'New' : 'Pre-Owned') + '  ·  ' + (car.status === 'in_stock' ? 'In Stock' : car.status === 'sold' ? 'Sold' : 'Coming Soon');
    el('modalPrice').textContent = HoricData.formatPrice(car.price);
    el('modalDesc').textContent = car.description || '';

    el('modalSpecs').innerHTML = [
      { label: 'Body', value: car.body_type },
      { label: 'Fuel', value: car.fuel },
      { label: 'Engine', value: car.engine || '—' },
      { label: 'Transmission', value: car.transmission },
      { label: 'Mileage', value: car.mileage > 0 ? car.mileage.toLocaleString() + ' km' : 'New' },
      { label: 'Color', value: car.color || '—' }
    ].map(function(s) { return '<div class="spec-card"><div class="spec-card-label">' + s.label + '</div><div class="spec-card-value">' + s.value + '</div></div>'; }).join('');

    el('modalFeatures').innerHTML = (car.features || []).map(function(f) { return '<span class="modal-feature-tag">' + f + '</span>'; }).join('');

    const costs = HoricData.estimateRunningCosts(car);
    el('modalCosts').innerHTML =
      '<h4>Monthly Running Cost Estimate</h4>' +
      '<div class="cost-row"><span class="cost-label">Fuel</span><span class="cost-value">' + HoricData.formatPrice(costs.fuel) + '</span></div>' +
      '<div class="cost-row"><span class="cost-label">Maintenance</span><span class="cost-value">' + HoricData.formatPrice(costs.maintenance) + '</span></div>' +
      '<div class="cost-row"><span class="cost-label">Insurance</span><span class="cost-value">' + HoricData.formatPrice(costs.insurance) + '</span></div>' +
      '<div class="cost-row cost-total"><span class="cost-label">Total Monthly</span><span class="cost-value">' + HoricData.formatPrice(costs.total) + '</span></div>';

    const waMsg = encodeURIComponent('Hi, I am interested in the ' + car.year + ' ' + car.make + ' ' + car.model + (car.trim ? ' ' + car.trim : '') + ' priced at ' + HoricData.formatPrice(car.price) + '. Can I get more details?');
    el('modalWhatsApp').href = 'https://wa.me/233XXXXXXXXX?text=' + waMsg;

    updateGallery();
    el('carModal').classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    document.getElementById('carModal')?.classList.remove('active');
    document.body.style.overflow = '';
    modalCar = null;
  }

  function updateGallery() {
    if (!modalCar) return;
    const counter = document.getElementById('modalCounter');
    const icon = document.getElementById('modalGalleryIcon');
    const gallery = document.getElementById('modalGallery');
    const hasImages = modalCar.images && modalCar.images.length > 0;

    if (hasImages) {
      if (icon) icon.style.display = 'none';
      let img = gallery.querySelector('.modal-gallery-img');
      if (!img) {
        img = document.createElement('img');
        img.className = 'modal-gallery-img';
        img.style.cssText = 'position:relative;z-index:2;max-height:100%;max-width:100%;object-fit:contain;';
        gallery.appendChild(img);
      }
      img.src = modalCar.images[modalImageIndex];
      img.style.display = '';
      counter.textContent = (modalImageIndex + 1) + ' / ' + modalCar.images.length;
    } else {
      if (icon) icon.style.display = '';
      const img = gallery.querySelector('.modal-gallery-img');
      if (img) img.style.display = 'none';
      counter.textContent = 'No images uploaded';
    }
  }

  function prevImage() {
    if (!modalCar || !modalCar.images || modalCar.images.length <= 1) return;
    modalImageIndex = (modalImageIndex - 1 + modalCar.images.length) % modalCar.images.length;
    updateGallery();
  }

  function nextImage() {
    if (!modalCar || !modalCar.images || modalCar.images.length <= 1) return;
    modalImageIndex = (modalImageIndex + 1) % modalCar.images.length;
    updateGallery();
  }

  function observeReveal() {
    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal:not(.visible)').forEach(function(el) { observer.observe(el); });
  }

  function showToast(message, type) {
    type = type || 'info';
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function() { toast.style.opacity = '0'; setTimeout(function() { toast.remove(); }, 300); }, 3000);
  }

  async function init() {
    await fetchVehicles();
    renderHero();
    renderFeatured();
    if (document.getElementById('inventoryGrid')) {
      populateFilters();
      await renderInventoryGrid();
      var searchInput = document.getElementById('filterSearch');
      if (searchInput) {
        var debounce;
        searchInput.addEventListener('input', function() {
          clearTimeout(debounce);
          debounce = setTimeout(function() { renderInventoryGrid(); }, 250);
        });
      }
    }
    observeReveal();

    document.getElementById('carModal')?.addEventListener('click', function(e) {
      if (e.target.classList.contains('modal-backdrop')) closeModal();
    });
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeModal(); });
  }

  document.addEventListener('DOMContentLoaded', init);

  return { openModal: openModal, closeModal: closeModal, prevImage: prevImage, nextImage: nextImage, applyFilters: applyFilters, resetFilters: resetFilters, showToast: showToast, renderInventoryGrid: renderInventoryGrid, populateFilters: populateFilters, populateModels: populateModels };
})();
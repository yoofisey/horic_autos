const HoricApp = (() => {
  let modalCar = null;
  let modalImageIndex = 0;
  let cachedVehicles = [];
  let fetchError = false;
  let compareList = [];
  let favourites = JSON.parse(localStorage.getItem('horic_favourites') || '[]');

  async function fetchVehicles() {
    fetchError = false;
    try {
      const res = await fetch('/api/vehicles');
      if (res.ok) {
        cachedVehicles = await res.json();
      } else {
        cachedVehicles = [];
        fetchError = true;
      }
    } catch (e) {
      cachedVehicles = [];
      fetchError = true;
    }
    return cachedVehicles;
  }

  const SKELETON_CARD = '<div class="car-card skeleton-card"><div class="skeleton-img"></div><div class="car-card-body"><div class="skeleton-line skeleton-line-short"></div><div class="skeleton-line skeleton-line-long"></div><div class="skeleton-line skeleton-line-medium"></div><div class="skeleton-pill-row"><div class="skeleton-pill"></div><div class="skeleton-pill"></div><div class="skeleton-pill"></div></div><div class="skeleton-line skeleton-line-medium"></div></div></div>';

  function showSkeletons(gridId, count) {
    var grid = document.getElementById(gridId);
    if (grid) grid.innerHTML = Array(count).fill(SKELETON_CARD).join('');
  }

  function statusBadge(status) {
    var map = {
      in_stock: '<span class="badge badge-new">In Stock</span>',
      sold: '<span class="badge badge-sold">Sold</span>',
      coming_soon: '<span class="badge badge-coming">Coming Soon</span>'
    };
    return map[status] || '';
  }

  function conditionBadge(cond) {
    return cond === 'new' ? '<span class="badge badge-new">New</span>' : '<span class="badge badge-used">Pre-Owned</span>';
  }

  var CAR_SVG = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M5 17h14M5 17a2 2 0 01-2-2V9a2 2 0 012-2h1l2-3h8l2 3h1a2 2 0 012 2v6a2 2 0 01-2 2M5 17l-1 2h1m14-2l1 2h-1"/><circle cx="7.5" cy="17" r="1" /><circle cx="16.5" cy="17" r="1" /></svg>';

  var HEART_SVG = '<svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';

  var CHECK_SVG = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';

  function buildCarCard(car) {
    var costs = HoricData.estimateRunningCosts(car);
    var imgHtml;
    if (car.images && car.images.length > 0) {
      imgHtml = '<img src="' + car.images[0] + '" alt="' + car.make + ' ' + car.model + '">';
    } else {
      imgHtml = '<div class="car-card-img-placeholder"><div class="car-card-img-icon">' + CAR_SVG + '</div><div class="car-card-img-label">' + car.make + '</div></div>';
    }

    var isFav = favourites.indexOf(car.id) !== -1;
    var isCompared = compareList.indexOf(car.id) !== -1;
    var isOnInventory = !!document.getElementById('inventoryGrid');
    var favClass = 'favourite-btn' + (isFav ? ' active' : '');
    var checkClass = 'compare-check' + (isCompared ? ' checked' : '');

    var controls = '';
    if (isOnInventory) {
      controls = '<button class="' + favClass + '" onclick="event.stopPropagation();HoricApp.toggleFavourite(\'' + car.id + '\')" aria-label="Save to favourites">' + HEART_SVG + '</button>' +
        '<div class="' + checkClass + '" onclick="event.stopPropagation();HoricApp.toggleCompare(\'' + car.id + '\')">' + CHECK_SVG + '</div>';
    } else {
      controls = '<button class="' + favClass + '" onclick="event.stopPropagation();HoricApp.toggleFavourite(\'' + car.id + '\')" aria-label="Save to favourites">' + HEART_SVG + '</button>';
    }

    return '<div class="car-card reveal" onclick="HoricApp.openModal(\'' + car.id + '\')">' +
      '<div class="car-card-image">' + controls + imgHtml +
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
    var grid = document.getElementById('featuredGrid');
    if (!grid) return;
    showSkeletons('featuredGrid', 6);
    await fetchVehicles();
    if (fetchError) {
      grid.innerHTML = '<div class="error-state"><div class="error-icon">!</div><h3>Something went wrong</h3><p>We could not load our inventory. Please try refreshing the page.</p><button onclick="HoricApp.renderFeatured()" class="btn btn-primary">Retry</button></div>';
      return;
    }
    var inStock = cachedVehicles.filter(function(c) { return c.status === 'in_stock'; }).slice(0, 6);
    grid.innerHTML = inStock.map(buildCarCard).join('');
    observeReveal();
  }

  function renderHero() {
    var cars = cachedVehicles.length ? cachedVehicles : [];
    var stats = { inStock: cars.filter(function(c) { return c.status === 'in_stock'; }).length };
    var el = function(id) { return document.getElementById(id); };

    if (el('statCars')) el('statCars').textContent = stats.inStock + '+';
    if (el('trustCount')) el('trustCount').textContent = stats.inStock + '+';

    if (cars.length > 0) {
      var inStockCars = cars.filter(function(c) { return c.status === 'in_stock'; });
      var featured = inStockCars[Math.floor(Math.random() * Math.min(stats.inStock, 3))];
      if (featured) {
        if (el('heroCarName')) el('heroCarName').textContent = featured.year + ' ' + featured.make + ' ' + featured.model;
        if (el('heroCarPrice')) el('heroCarPrice').textContent = HoricData.formatPrice(featured.price);
        var costs = HoricData.estimateRunningCosts(featured);
        if (el('heroCarCost')) el('heroCarCost').textContent = 'Est. ' + HoricData.formatPrice(costs.total) + '/month running cost';
      }
    }
  }

  async function renderInventoryGrid() {
    var grid = document.getElementById('inventoryGrid');
    var noResults = document.getElementById('noResults');
    var countEl = document.getElementById('resultCount');
    if (!grid) return;

    if (!cachedVehicles.length && !fetchError) {
      showSkeletons('inventoryGrid', 8);
      await fetchVehicles();
    }

    if (fetchError) {
      grid.innerHTML = '<div class="error-state"><div class="error-icon">!</div><h3>Could not connect to server</h3><p>We could not load our vehicle inventory. Please check your connection and try again.</p><button onclick="HoricApp.renderInventoryGrid()" class="btn btn-primary">Retry</button></div>';
      if (noResults) noResults.style.display = 'none';
      if (countEl) countEl.textContent = '0';
      return;
    }

    var search = (document.getElementById('filterSearch') || {}).value || '';
    var make = (document.getElementById('filterMake') || {}).value || '';
    var model = (document.getElementById('filterModel') || {}).value || '';
    var body_type = (document.getElementById('filterBody') || {}).value || '';
    var fuel = (document.getElementById('filterFuel') || {}).value || '';
    var condition = (document.getElementById('filterCondition') || {}).value || '';
    var status = (document.getElementById('filterStatus') || {}).value || '';
    var minPrice = Number((document.getElementById('filterMinPrice') || {}).value) || 0;
    var maxPrice = Number((document.getElementById('filterMaxPrice') || {}).value) || Infinity;
    var minYear = Number((document.getElementById('filterMinYear') || {}).value) || 0;
    var maxMileage = Number((document.getElementById('filterMaxMileage') || {}).value) || Infinity;
    var sort = (document.getElementById('sortSelect') || {}).value || 'newest';

    var results = HoricData.filterInventory(cachedVehicles, { search: search, make: make, model: model, body_type: body_type, fuel: fuel, condition: condition, status: status, minPrice: minPrice, maxPrice: maxPrice, minYear: minYear, maxMileage: maxMileage === 0 ? Infinity : maxMileage, sort: sort });

    if (countEl) countEl.textContent = results.length;
    if (results.length === 0) {
      grid.innerHTML = '';
      if (noResults) {
        noResults.style.display = 'block';
        var titleEl = document.getElementById('noResultsTitle');
        var textEl = document.getElementById('noResultsText');
        if (make && model && titleEl) {
          titleEl.textContent = 'No ' + make + ' ' + model + ' found';
          textEl.textContent = 'We don\'t currently have any ' + make + ' ' + model + ' in our inventory. Try browsing other models or let our Horic AI help.';
        } else if (make && titleEl) {
          titleEl.textContent = 'No ' + make + ' vehicles found';
          textEl.textContent = 'We don\'t currently have any ' + make + ' vehicles in stock. Browse other makes or chat with our Horic AI for alternatives.';
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
    ['filterSearch', 'filterMake', 'filterModel', 'filterBody', 'filterFuel', 'filterCondition', 'filterStatus', 'filterMinPrice', 'filterMaxPrice', 'filterMinYear', 'filterMaxMileage'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    var sortEl = document.getElementById('sortSelect');
    if (sortEl) sortEl.value = 'newest';
    populateModels();
    renderInventoryGrid();
  }

  function populateFilters() {
    var makeSelect = document.getElementById('filterMake');
    var modelSelect = document.getElementById('filterModel');
    if (!makeSelect) return;

    var makes = Object.keys(HoricData.CAR_MAKES_MODELS).sort();
    var currentMake = makeSelect.value;

    makeSelect.innerHTML = '<option value="">All Makes</option>' +
      makes.map(function(m) { return '<option value="' + m + '"' + (m === currentMake ? ' selected' : '') + '>' + m + '</option>'; }).join('');

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
    var makeSelect = document.getElementById('filterMake');
    var modelSelect = document.getElementById('filterModel');
    if (!makeSelect || !modelSelect) return;

    var selectedMake = makeSelect.value;
    var models = selectedMake && HoricData.CAR_MAKES_MODELS[selectedMake]
      ? HoricData.CAR_MAKES_MODELS[selectedMake].slice().sort()
      : [];
    var currentModel = modelSelect.value;

    modelSelect.innerHTML = '<option value="">All Models</option>' +
      models.map(function(m) { return '<option value="' + m + '"' + (m === currentModel ? ' selected' : '') + '>' + m + '</option>'; }).join('');
  }

  function openModal(id) {
    var car = cachedVehicles.find(function(c) { return c.id === id; });
    if (!car) return;
    modalCar = car;
    modalImageIndex = 0;

    var el = function(eid) { return document.getElementById(eid); };
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

    var costs = HoricData.estimateRunningCosts(car);
    el('modalCosts').innerHTML =
      '<h4>Monthly Running Cost Estimate</h4>' +
      '<div class="cost-row"><span class="cost-label">Fuel</span><span class="cost-value">' + HoricData.formatPrice(costs.fuel) + '</span></div>' +
      '<div class="cost-row"><span class="cost-label">Maintenance</span><span class="cost-value">' + HoricData.formatPrice(costs.maintenance) + '</span></div>' +
      '<div class="cost-row"><span class="cost-label">Insurance</span><span class="cost-value">' + HoricData.formatPrice(costs.insurance) + '</span></div>' +
      '<div class="cost-row cost-total"><span class="cost-label">Total Monthly</span><span class="cost-value">' + HoricData.formatPrice(costs.total) + '</span></div>';

    var waMsg = encodeURIComponent('Hi, I am interested in the ' + car.year + ' ' + car.make + ' ' + car.model + (car.trim ? ' ' + car.trim : '') + ' priced at ' + HoricData.formatPrice(car.price) + '. Can I get more details?');
    el('modalWhatsApp').href = 'https://wa.me/233548000393?text=' + waMsg;

    updateGallery();
    el('carModal').classList.add('active');
    document.body.style.overflow = 'hidden';

    fetch('/api/vehicles/' + id + '/view', { method: 'POST' }).catch(function() {});
  }

  function closeModal() {
    var modal = document.getElementById('carModal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
    modalCar = null;
  }

  function updateGallery() {
    if (!modalCar) return;
    var counter = document.getElementById('modalCounter');
    var icon = document.getElementById('modalGalleryIcon');
    var gallery = document.getElementById('modalGallery');
    var hasImages = modalCar.images && modalCar.images.length > 0;

    if (hasImages) {
      if (icon) icon.style.display = 'none';
      var img = gallery.querySelector('.modal-gallery-img');
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
      var existingImg = gallery.querySelector('.modal-gallery-img');
      if (existingImg) existingImg.style.display = 'none';
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
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal:not(.visible)').forEach(function(el) { observer.observe(el); });
  }

  function showToast(message, type) {
    type = type || 'info';
    var container = document.getElementById('toastContainer');
    if (!container) return;
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function() { toast.style.opacity = '0'; setTimeout(function() { toast.remove(); }, 300); }, 3000);
  }

  // ── SHARE ──
  function shareVehicle() {
    if (!modalCar) return;
    var title = modalCar.year + ' ' + modalCar.make + ' ' + modalCar.model + (modalCar.trim ? ' ' + modalCar.trim : '');
    var text = 'Check out this ' + title + ' at Horic Autos - ' + HoricData.formatPrice(modalCar.price);
    var url = window.location.origin + '/inventory.html';

    if (navigator.share) {
      navigator.share({ title: title, text: text, url: url }).catch(function() {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text + ' ' + url).then(function() {
        showToast('Link copied to clipboard!', 'success');
      }).catch(function() {
        showToast('Could not copy link', 'error');
      });
    } else {
      showToast('Share this vehicle via WhatsApp', 'info');
    }
  }

  // ── FAVOURITES ──
  function toggleFavourite(id) {
    var idx = favourites.indexOf(id);
    if (idx === -1) {
      favourites.push(id);
      showToast('Added to favourites', 'success');
    } else {
      favourites.splice(idx, 1);
      showToast('Removed from favourites', 'info');
    }
    localStorage.setItem('horic_favourites', JSON.stringify(favourites));
    renderFavouritesBar();
    renderInventoryGrid();
  }

  function renderFavouritesBar() {
    var bar = document.getElementById('favouriteBar');
    var items = document.getElementById('favouriteBarItems');
    if (!bar || !items) return;

    if (favourites.length === 0) {
      bar.classList.remove('active');
      return;
    }
    bar.classList.add('active');
    items.innerHTML = favourites.map(function(id) {
      var car = cachedVehicles.find(function(c) { return c.id === id; });
      if (!car) return '';
      return '<div class="favourite-chip">' + car.year + ' ' + car.make + ' ' + car.model + '<button onclick="HoricApp.toggleFavourite(\'' + id + '\')">&times;</button></div>';
    }).join('');
  }

  function clearFavourites() {
    favourites = [];
    localStorage.setItem('horic_favourites', JSON.stringify(favourites));
    renderFavouritesBar();
    renderInventoryGrid();
    showToast('Favourites cleared', 'info');
  }

  // ── COMPARE ──
  function toggleCompare(id) {
    var idx = compareList.indexOf(id);
    if (idx === -1) {
      if (compareList.length >= 3) {
        showToast('Maximum 3 vehicles for comparison', 'error');
        return;
      }
      compareList.push(id);
    } else {
      compareList.splice(idx, 1);
    }
    renderCompareBar();
    renderInventoryGrid();
  }

  function renderCompareBar() {
    var bar = document.getElementById('compareBar');
    var items = document.getElementById('compareBarItems');
    var countEl = document.getElementById('compareBarCount');
    if (!bar || !items) return;

    if (compareList.length === 0) {
      bar.classList.remove('active');
      return;
    }
    bar.classList.add('active');
    items.innerHTML = compareList.map(function(id) {
      var car = cachedVehicles.find(function(c) { return c.id === id; });
      if (!car) return '';
      return '<div class="compare-bar-item">' + car.year + ' ' + car.make + ' ' + car.model + '<button onclick="HoricApp.toggleCompare(\'' + id + '\')">&times;</button></div>';
    }).join('');
    if (countEl) countEl.textContent = compareList.length + ' selected';
  }

  function clearCompare() {
    compareList = [];
    renderCompareBar();
    renderInventoryGrid();
  }

  function openCompare() {
    if (compareList.length < 2) {
      showToast('Select at least 2 vehicles to compare', 'error');
      return;
    }
    var cars = compareList.map(function(id) { return cachedVehicles.find(function(c) { return c.id === id; }); }).filter(Boolean);
    var rows = [
      { label: 'Year', key: 'year' },
      { label: 'Price', key: 'price', format: function(v) { return HoricData.formatPrice(v); } },
      { label: 'Body Type', key: 'body_type' },
      { label: 'Fuel', key: 'fuel' },
      { label: 'Transmission', key: 'transmission' },
      { label: 'Mileage', key: 'mileage', format: function(v) { return v > 0 ? v.toLocaleString() + ' km' : 'New'; } },
      { label: 'Engine', key: 'engine', fallback: '—' },
      { label: 'Color', key: 'color', fallback: '—' },
      { label: 'Condition', key: 'condition', format: function(v) { return v === 'new' ? 'New' : 'Pre-Owned'; } },
      { label: 'Monthly Fuel', compute: function(c) { return HoricData.estimateRunningCosts(c).fuel; }, format: function(v) { return HoricData.formatPrice(v); } },
      { label: 'Monthly Maintenance', compute: function(c) { return HoricData.estimateRunningCosts(c).maintenance; }, format: function(v) { return HoricData.formatPrice(v); } },
      { label: 'Monthly Insurance', compute: function(c) { return HoricData.estimateRunningCosts(c).insurance; }, format: function(v) { return HoricData.formatPrice(v); } },
      { label: 'Total Monthly Cost', compute: function(c) { return HoricData.estimateRunningCosts(c).total; }, format: function(v) { return HoricData.formatPrice(v); } }
    ];

    var header = '<thead><tr><th></th>' + cars.map(function(c) {
      return '<th style="text-align:left;min-width:160px;">' + c.year + ' ' + c.make + ' ' + c.model + (c.trim ? ' ' + c.trim : '') + '</th>';
    }).join('') + '</tr></thead>';

    var body = '<tbody>' + rows.map(function(row) {
      return '<tr><td>' + row.label + '</td>' + cars.map(function(c) {
        var val = row.compute ? row.compute(c) : c[row.key];
        if (row.format) val = row.format(val);
        else if (val === undefined || val === null || val === '') val = row.fallback || '—';
        return '<td>' + val + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody>';

    document.getElementById('compareTable').innerHTML = header + body;
    document.getElementById('compareOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeCompare() {
    var overlay = document.getElementById('compareOverlay');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  // ── INIT ──
  async function init() {
    await fetchVehicles();
    renderHero();
    renderFeatured();
    renderFavouritesBar();
    if (document.getElementById('inventoryGrid')) {
      populateFilters();
      await renderInventoryGrid();
      renderCompareBar();
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

    var carModal = document.getElementById('carModal');
    if (carModal) {
      carModal.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal-backdrop')) closeModal();
      });
    }
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') { closeModal(); closeCompare(); } });

    var compareOverlay = document.getElementById('compareOverlay');
    if (compareOverlay) {
      compareOverlay.addEventListener('click', function(e) {
        if (e.target.classList.contains('compare-table-overlay')) closeCompare();
      });
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    openModal: openModal,
    closeModal: closeModal,
    prevImage: prevImage,
    nextImage: nextImage,
    applyFilters: applyFilters,
    resetFilters: resetFilters,
    showToast: showToast,
    renderInventoryGrid: renderInventoryGrid,
    populateFilters: populateFilters,
    populateModels: populateModels,
    shareVehicle: shareVehicle,
    toggleFavourite: toggleFavourite,
    clearFavourites: clearFavourites,
    toggleCompare: toggleCompare,
    clearCompare: clearCompare,
    openCompare: openCompare,
    closeCompare: closeCompare
  };
})();

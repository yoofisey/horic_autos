const HoricAdmin = (() => {
  let session = null;
  let uploadedImages = [];

  const CAR_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 17h14M5 17a2 2 0 01-2-2V9a2 2 0 012-2h1l2-3h8l2 3h1a2 2 0 012 2v6a2 2 0 01-2 2M5 17l-1 2h1m14-2l1 2h-1"/><circle cx="7.5" cy="17" r="1"/><circle cx="16.5" cy="17" r="1"/></svg>';

  function formatPrice(n) { return n == null ? '—' : 'GHS ' + Number(n).toLocaleString('en-US'); }

  async function api(path, opts) {
    opts = opts || {};
    const headers = { 'Content-Type': 'application/json' };
    if (session?.access_token) headers['Authorization'] = 'Bearer ' + session.access_token;
    const res = await fetch(path, { ...opts, headers: { ...headers, ...opts.headers } });
    if (res.status === 401) { session = null; localStorage.removeItem('horic_admin_session'); showLogin(); throw new Error('Session expired'); }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function toast(msg, type) {
    type = type || 'info';
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(function() { t.style.opacity = '0'; setTimeout(function() { t.remove(); }, 300); }, 3000);
  }

  // ── AUTH ──
  function showLogin() {
    document.getElementById('adminLayout').style.display = 'none';
    document.getElementById('loginOverlay').style.display = 'flex';
  }

  async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    const errEl = document.getElementById('loginError');
    try {
      errEl.classList.remove('show');
      const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password: pass }) });
      session = data.session;
      localStorage.setItem('horic_admin_session', JSON.stringify(session));
      document.getElementById('loginOverlay').style.display = 'none';
      document.getElementById('adminLayout').style.display = '';
      init();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.add('show');
    }
  }

  // ── TABS ──
  function switchTab(tab) {
    document.querySelectorAll('.admin-panel').forEach(function(p) { p.classList.remove('active'); });
    document.querySelectorAll('.sidebar-nav-item').forEach(function(n) { n.classList.remove('active'); });
    document.getElementById('panel-' + tab)?.classList.add('active');
    document.querySelector('[data-tab="' + tab + '"]')?.classList.add('active');
    var titles = { dashboard: 'Dashboard', inventory: 'Inventory Management', sales: 'Sales History', enquiries: 'Enquiries' };
    document.getElementById('adminPageTitle').textContent = titles[tab] || 'Dashboard';
    if (tab === 'dashboard') renderDashboard();
    if (tab === 'inventory') renderInventoryTable();
    if (tab === 'sales') renderSales();
    if (tab === 'enquiries') renderEnquiries();
  }

  function switchDashTab(tab, el) {
    document.querySelectorAll('.admin-tab').forEach(function(t) { t.classList.remove('active'); });
    if (el) el.classList.add('active');
    renderDashboardTable(tab);
  }

  // ── DASHBOARD ──
  async function renderDashboard() {
    try {
      const stats = await api('/api/stats');
      document.getElementById('statTotal').textContent = stats.totalCars;
      document.getElementById('statInStock').textContent = stats.inStock;
      document.getElementById('statValue').textContent = formatPrice(stats.totalValue);
      document.getElementById('statUnread').textContent = stats.unreadEnquiries;
      document.getElementById('enquiryBadge').textContent = stats.unreadEnquiries;
      renderDashboardTable('recent');
    } catch (e) { console.error(e); }
  }

  async function renderDashboardTable(mode) {
    var tbody = document.getElementById('dashTableBody');
    if (!tbody) return;
    try {
      var cars = await api('/api/vehicles');
      if (mode === 'popular') {
        cars.sort(function(a, b) { return (b.views || 0) - (a.views || 0); });
      }
      cars = cars.slice(0, 8);
      tbody.innerHTML = cars.map(function(car) {
        return '<tr>' +
          '<td><div class="table-car-info"><div class="table-car-thumb">' + CAR_SVG + '</div>' +
          '<div><div class="table-car-name">' + car.make + ' ' + car.model + '</div><div class="table-car-sub">' + car.year + '</div></div></div></td>' +
          '<td><span class="table-status status-' + car.status + '">' + car.status.replace('_', ' ') + '</span></td>' +
          '<td>' + formatPrice(car.price) + '</td>' +
          '<td>' + (car.views || 0) + '</td>' +
          '<td>' + (car.enquiries || 0) + '</td></tr>';
      }).join('');
    } catch (e) { console.error(e); }
  }

  // ── INVENTORY ──
  async function renderInventoryTable(filter) {
    filter = filter || '';
    var tbody = document.getElementById('inventoryTableBody');
    if (!tbody) return;
    try {
      var cars = await api('/api/vehicles');
      if (filter) {
        var q = filter.toLowerCase();
        cars = cars.filter(function(c) { return c.make.toLowerCase().includes(q) || c.model.toLowerCase().includes(q); });
      }
      tbody.innerHTML = cars.map(function(car) {
        return '<tr>' +
          '<td><div class="table-car-info"><div class="table-car-thumb">' + CAR_SVG + '</div>' +
          '<div><div class="table-car-name">' + car.make + ' ' + car.model + '</div><div class="table-car-sub">' + car.year + ' | ' + car.fuel + '</div></div></div></td>' +
          '<td><span class="table-status status-' + car.status + '">' + car.status.replace('_', ' ') + '</span></td>' +
          '<td>' + formatPrice(car.price) + '</td>' +
          '<td>' + car.year + '</td>' +
          '<td>' + (car.mileage > 0 ? car.mileage.toLocaleString() + ' km' : '—') + '</td>' +
          '<td><div class="table-actions">' +
          '<button title="Edit" onclick="HoricAdmin.editVehicle(\'' + car.id + '\')">&#9998;</button>' +
          (car.status !== 'sold' ? '<button title="Mark Sold" onclick="HoricAdmin.openSoldModal(\'' + car.id + '\')">$</button>' : '') +
          '<button title="Delete" class="danger" onclick="HoricAdmin.openDeleteModal(\'' + car.id + '\')">&#10005;</button>' +
          '</div></td></tr>';
      }).join('');
    } catch (e) { console.error(e); }
  }

  function searchInventory(q) {
    var active = document.querySelector('.sidebar-nav-item.active');
    if (active && active.dataset.tab === 'inventory') renderInventoryTable(q);
  }

  // ── SALES ──
  async function renderSales() {
    try {
      var cars = await api('/api/vehicles');
      var sold = cars.filter(function(c) { return c.status === 'sold'; });
      var totalRevenue = sold.reduce(function(s, c) { return s + (c.sold_price || c.price); }, 0);
      document.getElementById('salesTotalSold').textContent = sold.length;
      document.getElementById('salesRevenue').textContent = formatPrice(totalRevenue);
      document.getElementById('salesAvgPrice').textContent = sold.length ? formatPrice(Math.round(totalRevenue / sold.length)) : 'GHS 0';

      var tbody = document.getElementById('salesTableBody');
      if (!tbody) return;
      if (sold.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--gray-400);padding:40px;">No sales recorded yet.</td></tr>';
        return;
      }
      tbody.innerHTML = sold.map(function(car) {
        return '<tr>' +
          '<td><div class="table-car-info"><div class="table-car-thumb">' + CAR_SVG + '</div>' +
          '<div><div class="table-car-name">' + car.make + ' ' + car.model + '</div><div class="table-car-sub">' + car.year + '</div></div></div></td>' +
          '<td style="font-weight:600;color:var(--green-700);">' + formatPrice(car.sold_price || car.price) + '</td>' +
          '<td>' + (car.sold_to || '—') + '</td>' +
          '<td>' + (car.sold_date || '—') + '</td>' +
          '<td><div class="table-actions"><button title="Relist" onclick="HoricAdmin.relistVehicle(\'' + car.id + '\')">&#8634;</button></div></td></tr>';
      }).join('');
    } catch (e) { console.error(e); }
  }

  // ── ENQUIRIES ──
  async function renderEnquiries() {
    var list = document.getElementById('enquiriesList');
    if (!list) return;
    try {
      var enquiries = await api('/api/enquiries');
      var vehicles = await api('/api/vehicles');
      var vMap = {};
      vehicles.forEach(function(v) { vMap[v.id] = v; });
      if (enquiries.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:60px;color:var(--gray-400);">No enquiries yet.</div>';
        return;
      }
      list.innerHTML = enquiries.map(function(enq) {
        var car = enq.vehicle_id ? vMap[enq.vehicle_id] : null;
        return '<div class="enquiry-card ' + (enq.status === 'unread' ? 'unread' : '') + '">' +
          '<div class="enquiry-header"><div class="enquiry-customer">' + enq.customer_name + '</div>' +
          '<div class="enquiry-date">' + enq.created_at + '</div></div>' +
          (car ? '<div class="enquiry-vehicle">Re: ' + car.year + ' ' + car.make + ' ' + car.model + ' — ' + formatPrice(car.price) + '</div>' : '') +
          '<div class="enquiry-message">' + enq.message + '</div>' +
          '<div class="enquiry-contact">' + (enq.customer_phone || 'N/A') + ' | ' + (enq.customer_email || 'N/A') + '</div>' +
          '<div class="enquiry-actions">' +
          (enq.status === 'unread' ? '<button class="btn btn-sm btn-outline" onclick="HoricAdmin.markEnquiryRead(\'' + enq.id + '\')">Mark Read</button>' : '') +
          '<button class="btn btn-sm btn-ghost" onclick="HoricAdmin.deleteEnquiry(\'' + enq.id + '\')" style="color:var(--red-500);">Delete</button>' +
          '</div></div>';
      }).join('');
    } catch (e) { console.error(e); }
  }

  async function markEnquiryRead(id) {
    await api('/api/enquiries/' + id, { method: 'PUT', body: JSON.stringify({ status: 'read' }) });
    renderEnquiries();
    toast('Enquiry marked as read', 'success');
  }

  async function deleteEnquiry(id) {
    await api('/api/enquiries/' + id, { method: 'DELETE' });
    renderEnquiries();
    toast('Enquiry deleted', 'success');
  }

  // ── VEHICLE MODAL ──
  function openVehicleModal() {
    uploadedImages = [];
    document.getElementById('vehicleForm').reset();
    document.getElementById('vf-id').value = '';
    document.getElementById('vehicleModalTitle').textContent = 'Add New Vehicle';
    document.getElementById('imagePreviewGrid').innerHTML = '';
    document.getElementById('vehicleModal').classList.add('active');
  }

  function closeVehicleModal() {
    document.getElementById('vehicleModal').classList.remove('active');
    uploadedImages = [];
  }

  async function editVehicle(id) {
    try {
      var car = await api('/api/vehicles/' + id);
      uploadedImages = car.images ? car.images.slice() : [];
      document.getElementById('vf-id').value = car.id;
      document.getElementById('vf-make').value = car.make;
      document.getElementById('vf-model').value = car.model;
      document.getElementById('vf-year').value = car.year;
      document.getElementById('vf-price').value = car.price;
      document.getElementById('vf-body').value = car.body_type;
      document.getElementById('vf-fuel').value = car.fuel;
      document.getElementById('vf-mileage').value = car.mileage;
      document.getElementById('vf-engine').value = car.engine || '';
      document.getElementById('vf-transmission').value = car.transmission;
      document.getElementById('vf-color').value = car.color || '';
      document.getElementById('vf-condition').value = car.condition;
      document.getElementById('vf-status').value = car.status;
      document.getElementById('vf-desc').value = car.description || '';
      document.getElementById('vf-features').value = (car.features || []).join(', ');
      renderImagePreviews();
      document.getElementById('vehicleModalTitle').textContent = 'Edit Vehicle';
      document.getElementById('vehicleModal').classList.add('active');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function saveVehicle(e) {
    e.preventDefault();
    var id = document.getElementById('vf-id').value;
    var features = document.getElementById('vf-features').value.split(',').map(function(f) { return f.trim(); }).filter(Boolean);
    var data = {
      make: document.getElementById('vf-make').value,
      model: document.getElementById('vf-model').value,
      year: Number(document.getElementById('vf-year').value),
      price: Number(document.getElementById('vf-price').value),
      body_type: document.getElementById('vf-body').value,
      fuel: document.getElementById('vf-fuel').value,
      mileage: Number(document.getElementById('vf-mileage').value) || 0,
      engine: document.getElementById('vf-engine').value,
      transmission: document.getElementById('vf-transmission').value,
      color: document.getElementById('vf-color').value,
      condition: document.getElementById('vf-condition').value,
      status: document.getElementById('vf-status').value,
      description: document.getElementById('vf-desc').value,
      features: features,
      images: uploadedImages
    };

    try {
      if (id) {
        await api('/api/vehicles/' + id, { method: 'PUT', body: JSON.stringify(data) });
        toast('Vehicle updated', 'success');
      } else {
        await api('/api/vehicles', { method: 'POST', body: JSON.stringify(data) });
        toast('Vehicle added', 'success');
      }
      closeVehicleModal();
      renderInventoryTable();
      renderDashboard();
    } catch (e) { toast(e.message, 'error'); }
  }

  // ── DELETE / SOLD / RELIST ──
  function openDeleteModal(id) {
    document.getElementById('deleteVehicleId').value = id;
    document.getElementById('deleteModal').classList.add('active');
  }

  async function confirmDelete() {
    var id = document.getElementById('deleteVehicleId').value;
    try {
      await api('/api/vehicles/' + id, { method: 'DELETE' });
      document.getElementById('deleteModal').classList.remove('active');
      renderInventoryTable();
      renderDashboard();
      toast('Vehicle deleted', 'success');
    } catch (e) { toast(e.message, 'error'); }
  }

  function openSoldModal(id) {
    document.getElementById('soldVehicleId').value = id;
    document.getElementById('soldPrice').value = '';
    document.getElementById('soldTo').value = '';
    document.getElementById('soldModal').classList.add('active');
  }

  async function confirmSold() {
    var id = document.getElementById('soldVehicleId').value;
    var price = document.getElementById('soldPrice').value;
    var to = document.getElementById('soldTo').value;
    try {
      await api('/api/vehicles/' + id, { method: 'PUT', body: JSON.stringify({
        status: 'sold', sold_price: Number(price), sold_date: new Date().toISOString().slice(0, 10), sold_to: to || 'Client'
      })});
      document.getElementById('soldModal').classList.remove('active');
      renderInventoryTable();
      renderDashboard();
      toast('Vehicle marked as sold', 'success');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function relistVehicle(id) {
    try {
      await api('/api/vehicles/' + id, { method: 'PUT', body: JSON.stringify({ status: 'in_stock', sold_price: null, sold_date: null, sold_to: null }) });
      renderSales();
      renderDashboard();
      toast('Vehicle relisted', 'success');
    } catch (e) { toast(e.message, 'error'); }
  }

  // ── IMAGE UPLOAD ──
  function renderImagePreviews() {
    var grid = document.getElementById('imagePreviewGrid');
    grid.innerHTML = uploadedImages.map(function(src, i) {
      return '<div class="image-preview-item"><img src="' + src + '" alt="Upload ' + (i + 1) + '">' +
        '<button class="image-preview-remove" onclick="HoricAdmin.removeImage(' + i + ')">&#10005;</button></div>';
    }).join('');
  }

  function removeImage(i) {
    uploadedImages.splice(i, 1);
    renderImagePreviews();
  }

  function initImageUpload() {
    var zone = document.getElementById('uploadZone');
    var input = document.getElementById('vf-images');
    if (!zone || !input) return;
    zone.addEventListener('click', function() { input.click(); });
    zone.addEventListener('dragover', function(e) { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', function() { zone.classList.remove('dragover'); });
    zone.addEventListener('drop', function(e) {
      e.preventDefault(); zone.classList.remove('dragover');
      handleFiles(e.dataTransfer.files);
    });
    input.addEventListener('change', function() { handleFiles(input.files); });

    function handleFiles(files) {
      Array.from(files).forEach(function(file) {
        if (!file.type.startsWith('image/')) return;
        var reader = new FileReader();
        reader.onload = function(e) {
          uploadedImages.push(e.target.result);
          renderImagePreviews();
        };
        reader.readAsDataURL(file);
      });
    }
  }

  // ── INIT ──
  function init() {
    if (!document.querySelector('.admin-layout')) return;
    
    // Attach login form handler
    var loginForm = document.getElementById('loginForm');
    if (loginForm && !loginForm._attached) {
      loginForm.addEventListener('submit', handleLogin);
      loginForm._attached = true;
    }

    var saved = localStorage.getItem('horic_admin_session');
    if (saved) {
      try {
        session = JSON.parse(saved);
        var exp = session.expires_at ? new Date(session.expires_at * 1000) : null;
        if (exp && exp < new Date()) { session = null; localStorage.removeItem('horic_admin_session'); }
      } catch (e) { session = null; }
    }
    if (!session) { showLogin(); return; }
    document.getElementById('adminLayout').style.display = '';
    renderDashboard();
    initImageUpload();
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    switchTab: switchTab, switchDashTab: switchDashTab, searchInventory: searchInventory,
    openVehicleModal: openVehicleModal, closeVehicleModal: closeVehicleModal, editVehicle: editVehicle, saveVehicle: saveVehicle,
    openDeleteModal: openDeleteModal, confirmDelete: confirmDelete, openSoldModal: openSoldModal, confirmSold: confirmSold, relistVehicle: relistVehicle,
    removeImage: removeImage, markEnquiryRead: markEnquiryRead, deleteEnquiry: deleteEnquiry
  };
})();

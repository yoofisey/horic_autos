const HoricAdmin = (() => {
  let session = null;
  let uploadedImages = [];

  const CAR_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 17h14M5 17a2 2 0 01-2-2V9a2 2 0 012-2h1l2-3h8l2 3h1a2 2 0 012 2v6a2 2 0 01-2 2M5 17l-1 2h1m14-2l1 2h-1"/><circle cx="7.5" cy="17" r="1"/><circle cx="16.5" cy="17" r="1"/></svg>';

  function formatPrice(n) { return n == null ? '—' : 'GHS ' + Number(n).toLocaleString('en-US'); }

  async function api(path, opts) {
    opts = opts || {};
    const headers = { 'Content-Type': 'application/json' };
    if (session?.token) headers['Authorization'] = 'Bearer ' + session.token;
    const res = await fetch(path, { ...opts, headers: { ...headers, ...opts.headers } });
    if (res.status === 401) {
      session = null;
      localStorage.removeItem('horic_admin_session');
      showLogin();
      throw new Error('__AUTH_EXPIRED__');
    }
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
    var overlay = document.getElementById('loginOverlay');
    var layout = document.getElementById('adminLayout');
    if (overlay) { overlay.style.display = 'flex'; overlay.style.zIndex = '9999'; }
    if (layout) layout.style.display = 'none';
  }

  async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPassword').value;
    const errEl = document.getElementById('loginError');
    try {
      errEl.classList.remove('show');
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      session = { token: data.token, user: data.user };
      localStorage.setItem('horic_admin_session', JSON.stringify(session));
      document.getElementById('loginOverlay').style.display = 'none';
      document.getElementById('adminLayout').style.display = '';
      renderDashboard();
      initImageUpload();
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
    var titles = { dashboard: 'Dashboard', inventory: 'Inventory Management', sales: 'Sales History', enquiries: 'Enquiries', knowledge: 'Knowledge Base (RAG)' };
    document.getElementById('adminPageTitle').textContent = titles[tab] || 'Dashboard';
    if (tab === 'dashboard') renderDashboard();
    if (tab === 'inventory') renderInventoryTable();
    if (tab === 'sales') renderSales();
    if (tab === 'enquiries') renderEnquiries();
    if (tab === 'knowledge') renderKnowledgeBase();
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
          '<div><div class="table-car-name">' + car.make + ' ' + car.model + (car.trim ? ' ' + car.trim : '') + '</div><div class="table-car-sub">' + car.year + '</div></div></div></td>' +
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
          '<div><div class="table-car-name">' + car.make + ' ' + car.model + (car.trim ? ' ' + car.trim : '') + '</div><div class="table-car-sub">' + car.year + ' | ' + car.fuel + '</div></div></div></td>' +
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
        var car = vMap[enq.vehicle_id];
        return '<div class="enquiry-card ' + (enq.status === 'unread' ? 'unread' : '') + '" onclick="HoricAdmin.markEnquiryRead(\'' + enq.id + '\')">' +
          '<div class="enquiry-header">' +
          '<div><strong>' + enq.customer_name + '</strong> <span class="enquiry-date">' + enq.created_at + '</span></div>' +
          (car ? '<span class="enquiry-vehicle">' + car.year + ' ' + car.make + ' ' + car.model + '</span>' : '') +
          '</div>' +
          '<p class="enquiry-message">' + enq.message + '</p>' +
          '<div class="enquiry-actions">' +
          '<button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); HoricAdmin.deleteEnquiry(\'' + enq.id + '\')">Delete</button>' +
          '</div></div>';
      }).join('');
    } catch (e) { console.error(e); }
  }

  async function markEnquiryRead(id) {
    try {
      await api('/api/enquiries/' + id, { method: 'PUT', body: JSON.stringify({ status: 'read' }) });
      renderEnquiries();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function deleteEnquiry(id) {
    if (!confirm('Delete this enquiry?')) return;
    try {
      await api('/api/enquiries/' + id, { method: 'DELETE' });
      toast('Enquiry deleted', 'success');
      renderEnquiries();
    } catch (e) { toast(e.message, 'error'); }
  }

  // ── VEHICLE MODAL ──
  function populateAdminMakeDropdown(selectMake) {
    var makeSelect = document.getElementById('vf-make');
    var modelSelect = document.getElementById('vf-model');
    if (!makeSelect) return;
    var makes = Object.keys(HoricData.CAR_MAKES_MODELS).sort();
    var currentMake = selectMake || '';
    makeSelect.innerHTML = '<option value="">Select Make</option>' +
      makes.map(function(m) { return '<option value="' + m + '"' + (m === currentMake ? ' selected' : '') + '>' + m + '</option>'; }).join('');
    populateAdminModels(currentMake);
  }

  function populateAdminModels(selectedMake) {
    var modelSelect = document.getElementById('vf-model');
    if (!modelSelect) return;
    selectedMake = selectedMake || document.getElementById('vf-make').value;
    var models = selectedMake && HoricData.CAR_MAKES_MODELS[selectedMake]
      ? HoricData.CAR_MAKES_MODELS[selectedMake].slice().sort()
      : [];
    modelSelect.innerHTML = '<option value="">' + (models.length ? 'Select Model' : 'Select Make First') + '</option>' +
      models.map(function(m) { return '<option value="' + m + '">' + m + '</option>'; }).join('');
  }

  function openVehicleModal(id) {
    uploadedImages = [];
    document.getElementById('vf-id').value = '';
    document.getElementById('vf-trim').value = '';
    document.getElementById('vf-year').value = new Date().getFullYear();
    document.getElementById('vf-price').value = '';
    document.getElementById('vf-body').value = 'suv';
    document.getElementById('vf-fuel').value = 'petrol';
    document.getElementById('vf-mileage').value = '0';
    document.getElementById('vf-engine').value = '';
    document.getElementById('vf-transmission').value = 'automatic';
    document.getElementById('vf-color').value = '';
    document.getElementById('vf-condition').value = 'new';
    document.getElementById('vf-status').value = 'in_stock';
    document.getElementById('vf-desc').value = '';
    document.getElementById('vf-features').value = '';
    document.getElementById('imagePreviewGrid').innerHTML = '';
    document.getElementById('vehicleModalTitle').textContent = 'Add New Vehicle';
    populateAdminMakeDropdown('');
    document.getElementById('vehicleModal').classList.add('active');
  }

  function closeVehicleModal() {
    document.getElementById('vehicleModal').classList.remove('active');
    uploadedImages = [];
  }

  async function editVehicle(id) {
    try {
      var car = await api('/api/vehicles/' + id);
      document.getElementById('vf-id').value = car.id;
      populateAdminMakeDropdown(car.make);
      setTimeout(function() { document.getElementById('vf-model').value = car.model; }, 10);
      document.getElementById('vf-trim').value = car.trim || '';
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
      uploadedImages = car.images || [];
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
      trim: document.getElementById('vf-trim').value,
      year: Number(document.getElementById('vf-year').value),
      price: Number(document.getElementById('vf-price').value),
      body_type: document.getElementById('vf-body').value,
      fuel: document.getElementById('vf-fuel').value,
      mileage: Number(document.getElementById('vf-mileage').value),
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
        toast('Vehicle updated & re-embedded', 'success');
      } else {
        await api('/api/vehicles', { method: 'POST', body: JSON.stringify(data) });
        toast('Vehicle added & embedded', 'success');
      }
      closeVehicleModal();
      renderInventoryTable();
    } catch (e) { toast(e.message, 'error'); }
  }

  // ── SOLD ──
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
    if (!price || !to) return toast('Please fill all fields', 'error');
    try {
      await api('/api/vehicles/' + id, { method: 'PUT', body: JSON.stringify({
        status: 'sold',
        sold_price: Number(price),
        sold_date: new Date().toISOString().slice(0, 10),
        sold_to: to
      })});
      document.getElementById('soldModal').classList.remove('active');
      toast('Vehicle marked as sold', 'success');
      renderInventoryTable();
    } catch (e) { toast(e.message, 'error'); }
  }

  // ── DELETE ──
  function openDeleteModal(id) {
    document.getElementById('deleteVehicleId').value = id;
    document.getElementById('deleteModal').classList.add('active');
  }

  async function confirmDelete() {
    var id = document.getElementById('deleteVehicleId').value;
    try {
      await api('/api/vehicles/' + id, { method: 'DELETE' });
      document.getElementById('deleteModal').classList.remove('active');
      toast('Vehicle deleted', 'success');
      renderInventoryTable();
    } catch (e) { toast(e.message, 'error'); }
  }

  // ── RELIST ──
  async function relistVehicle(id) {
    try {
      await api('/api/vehicles/' + id, { method: 'PUT', body: JSON.stringify({ status: 'in_stock', sold_price: null, sold_date: null, sold_to: null }) });
      toast('Vehicle relisted', 'success');
      renderSales();
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

  // ── KNOWLEDGE BASE ──
  var currentKbFilter = 'all';

  async function renderKnowledgeBase(filter) {
    filter = filter || currentKbFilter;
    var tbody = document.getElementById('knowledgeTableBody');
    if (!tbody) return;
    try {
      var url = '/api/knowledge' + (filter !== 'all' ? '?type=' + filter : '');
      var entries = await api(url);

      // Update counts
      var allEntries = await api('/api/knowledge');
      document.getElementById('kbTotalCount').textContent = allEntries.length;
      document.getElementById('kbVehicleCount').textContent = allEntries.filter(function(e) { return e.content_type === 'vehicle'; }).length;
      document.getElementById('kbFaqCount').textContent = allEntries.filter(function(e) { return e.content_type === 'faq'; }).length;
      document.getElementById('kbPolicyCount').textContent = allEntries.filter(function(e) { return e.content_type === 'policy'; }).length;

      if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--gray-400);padding:40px;">No knowledge base entries found. Click "Sync Vehicles" to add your inventory, or add FAQs and policies manually.</td></tr>';
        return;
      }

      tbody.innerHTML = entries.map(function(entry) {
        var content = entry.content.length > 120 ? entry.content.substring(0, 120) + '...' : entry.content;
        var meta = entry.metadata ? Object.entries(entry.metadata).map(function(kv) { return kv[0] + ': ' + kv[1]; }).join(', ') : '—';
        var date = entry.updated_at ? new Date(entry.updated_at).toLocaleDateString() : '—';
        return '<tr>' +
          '<td><div style="max-width:350px;"><div style="font-weight:500;color:var(--gray-800);margin-bottom:2px;">' + content.replace(/</g, '&lt;') + '</div></div></td>' +
          '<td><span class="table-status status-' + (entry.content_type === 'vehicle' ? 'in_stock' : entry.content_type === 'faq' ? 'coming_soon' : 'sold') + '">' + entry.content_type + '</span></td>' +
          '<td style="font-size:0.8rem;color:var(--gray-500);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + meta + '</td>' +
          '<td style="white-space:nowrap;">' + date + '</td>' +
          '<td><div class="table-actions">' +
          '<button title="Edit" onclick="HoricAdmin.editKnowledgeEntry(\'' + entry.id + '\')">&#9998;</button>' +
          '<button title="Delete" class="danger" onclick="HoricAdmin.deleteKnowledgeEntry(\'' + entry.id + '\')">&#10005;</button>' +
          '</div></td></tr>';
      }).join('');
    } catch (e) { console.error(e); }
  }

  function filterKnowledge(filter, btn) {
    currentKbFilter = filter;
    document.querySelectorAll('.kb-filter-btn').forEach(function(b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    renderKnowledgeBase(filter);
  }

  function openKnowledgeModal(id) {
    document.getElementById('kb-id').value = '';
    document.getElementById('kb-type').value = 'faq';
    document.getElementById('kb-category').value = '';
    document.getElementById('kb-question').value = '';
    document.getElementById('kb-answer').value = '';
    document.getElementById('knowledgeModalTitle').textContent = 'Add Knowledge Entry';
    document.getElementById('knowledgeModal').classList.add('active');
  }

  function closeKnowledgeModal() {
    document.getElementById('knowledgeModal').classList.remove('active');
  }

  async function editKnowledgeEntry(id) {
    try {
      var entries = await api('/api/knowledge');
      var entry = entries.find(function(e) { return e.id === id; });
      if (!entry) return;
      document.getElementById('kb-id').value = entry.id;
      document.getElementById('kb-type').value = entry.content_type;
      document.getElementById('kb-category').value = (entry.metadata && entry.metadata.category) || '';
      document.getElementById('kb-question').value = (entry.metadata && entry.metadata.question) || '';
      document.getElementById('kb-answer').value = entry.content;
      document.getElementById('knowledgeModalTitle').textContent = 'Edit Knowledge Entry';
      document.getElementById('knowledgeModal').classList.add('active');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function saveKnowledgeEntry(e) {
    e.preventDefault();
    var id = document.getElementById('kb-id').value;
    var type = document.getElementById('kb-type').value;
    var category = document.getElementById('kb-category').value;
    var question = document.getElementById('kb-question').value;
    var answer = document.getElementById('kb-answer').value;

    var content = answer;
    if (type === 'faq' && question) {
      content = 'Question: ' + question + '\nAnswer: ' + answer;
    }

    var metadata = { category: category, type: type };
    if (type === 'faq' && question) metadata.question = question;

    try {
      if (id) {
        await api('/api/knowledge/' + id, { method: 'PUT', body: JSON.stringify({ content: content, content_type: type, metadata: metadata }) });
        toast('Knowledge entry updated & re-embedded', 'success');
      } else {
        await api('/api/knowledge', { method: 'POST', body: JSON.stringify({ content: content, content_type: type, metadata: metadata }) });
        toast('Knowledge entry created & embedded', 'success');
      }
      closeKnowledgeModal();
      renderKnowledgeBase();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function deleteKnowledgeEntry(id) {
    if (!confirm('Delete this knowledge base entry?')) return;
    try {
      await api('/api/knowledge/' + id, { method: 'DELETE' });
      toast('Entry deleted', 'success');
      renderKnowledgeBase();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function syncVehicleKnowledge() {
    try {
      toast('Syncing vehicles to knowledge base...', 'info');
      var result = await api('/api/knowledge/sync-vehicles', { method: 'POST' });
      toast('Synced ' + result.synced + ' vehicles to knowledge base', 'success');
      renderKnowledgeBase();
    } catch (e) { toast(e.message, 'error'); }
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

    // Check saved session
    var saved = localStorage.getItem('horic_admin_session');
    if (saved) {
      try {
        session = JSON.parse(saved);
        if (!session?.token) { session = null; localStorage.removeItem('horic_admin_session'); }
      } catch (e) { session = null; localStorage.removeItem('horic_admin_session'); }
    }
    if (!session) { showLogin(); return; }

    // Show admin, hide login
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('adminLayout').style.display = '';
    renderDashboard();
    initImageUpload();

    // Poll unread enquiry count every 30s
    setInterval(async function() {
      try {
        var data = await api('/api/enquiries/unread-count');
        var badge = document.getElementById('enquiryBadge');
        if (badge) badge.textContent = data.count;
      } catch (e) {}
    }, 30000);
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    switchTab: switchTab, switchDashTab: switchDashTab, searchInventory: searchInventory,
    openVehicleModal: openVehicleModal, closeVehicleModal: closeVehicleModal, editVehicle: editVehicle, saveVehicle: saveVehicle,
    populateAdminMakeDropdown: populateAdminMakeDropdown, populateAdminModels: populateAdminModels,
    openDeleteModal: openDeleteModal, confirmDelete: confirmDelete, openSoldModal: openSoldModal, confirmSold: confirmSold, relistVehicle: relistVehicle,
    removeImage: removeImage, markEnquiryRead: markEnquiryRead, deleteEnquiry: deleteEnquiry,
    filterKnowledge: filterKnowledge, openKnowledgeModal: openKnowledgeModal, closeKnowledgeModal: closeKnowledgeModal,
    editKnowledgeEntry: editKnowledgeEntry, saveKnowledgeEntry: saveKnowledgeEntry, deleteKnowledgeEntry: deleteKnowledgeEntry, syncVehicleKnowledge: syncVehicleKnowledge
  };
})();

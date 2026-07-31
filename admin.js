const RhuleAdmin = (() => {
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
      localStorage.removeItem('rhule_admin_session');
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
      localStorage.setItem('rhule_admin_session', JSON.stringify(session));
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
    var titles = { dashboard: 'Dashboard', inventory: 'Inventory Management', sales: 'Sales History', enquiries: 'Enquiries', knowledge: 'Knowledge Base (RAG)', visits: 'Scheduled Visits', settings: 'Settings' };
    document.getElementById('adminPageTitle').textContent = titles[tab] || 'Dashboard';
    if (tab === 'dashboard') renderDashboard();
    if (tab === 'inventory') renderInventoryTable();
    if (tab === 'sales') renderSales();
    if (tab === 'enquiries') renderEnquiries();
    if (tab === 'knowledge') renderKnowledgeBase();
    if (tab === 'visits') renderVisits();
    if (tab === 'settings') renderAdmins();
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
      var visitBadge = document.getElementById('visitBadge');
      if (visitBadge) visitBadge.textContent = stats.pendingVisits || 0;
      renderDashboardTable('recent');
      initCharts();
    } catch (e) { console.error(e); }
  }

  let chartsInitialized = false;
  async function initCharts() {
    if (chartsInitialized) return;
    chartsInitialized = true;
    try {
      const [bodyData, salesData, enqData] = await Promise.all([
        api('/api/stats/body-distribution'),
        api('/api/stats/monthly-sold'),
        api('/api/stats/enquiry-trend')
      ]);
      const colors = ['#C9242B','#A01D23','#2970ff','#f79009','#039855','#9b8afb','#dd2590','#175cd3'];
      var bodyCtx = document.getElementById('bodyChart');
      if (bodyCtx) {
        new Chart(bodyCtx, {
          type: 'doughnut',
          data: {
            labels: bodyData.map(function(d) { return d.body_type; }),
            datasets: [{ data: bodyData.map(function(d) { return d.count; }), backgroundColor: colors.slice(0, bodyData.length) }]
          },
          options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11 } } } } }
        });
      }
      var salesCtx = document.getElementById('salesChart');
      if (salesCtx) {
        new Chart(salesCtx, {
          type: 'bar',
          data: {
            labels: salesData.map(function(d) { return d.month; }),
            datasets: [{ label: 'Sold', data: salesData.map(function(d) { return d.count; }), backgroundColor: '#C9242B', borderRadius: 4 }]
          },
          options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } } }, x: { ticks: { font: { size: 11 } } } } }
        });
      }
      var enqCtx = document.getElementById('enquiryChart');
      if (enqCtx) {
        new Chart(enqCtx, {
          type: 'line',
          data: {
            labels: enqData.map(function(d) { return d.month; }),
            datasets: [{ label: 'Enquiries', data: enqData.map(function(d) { return d.count; }), borderColor: '#E31E24', backgroundColor: 'rgba(227,30,36,0.08)', fill: true, tension: 0.3, pointRadius: 3 }]
          },
          options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1, font: { size: 11 } } }, x: { ticks: { font: { size: 11 } } } } }
        });
      }
    } catch (e) { console.error('Charts init error:', e); }
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
          '<button title="Edit" onclick="RhuleAdmin.editVehicle(\'' + car.id + '\')">&#9998;</button>' +
          (car.status !== 'sold' ? '<button title="Mark Sold" onclick="RhuleAdmin.openSoldModal(\'' + car.id + '\')">$</button>' : '') +
          '<button title="Delete" class="danger" onclick="RhuleAdmin.openDeleteModal(\'' + car.id + '\')">&#10005;</button>' +
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
          '<td><div class="table-actions"><button title="Relist" onclick="RhuleAdmin.relistVehicle(\'' + car.id + '\')">&#8634;</button></div></td></tr>';
      }).join('');
    } catch (e) { console.error(e); }
  }

  // ── ENQUIRIES ──
  let enquiriesCache = [];

  async function renderEnquiries() {
    var list = document.getElementById('enquiriesList');
    if (!list) return;
    try {
      var enquiries = await api('/api/enquiries');
      enquiriesCache = enquiries;
      var vehicles = await api('/api/vehicles');
      var vMap = {};
      vehicles.forEach(function(v) { vMap[v.id] = v; });
      if (enquiries.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:60px;color:var(--gray-400);font-size:0.9rem;">No enquiries yet.</div>';
        return;
      }
      list.innerHTML = enquiries.map(function(enq) {
        var car = vMap[enq.vehicle_id];
        var statusClass = enq.status === 'unread' ? 'unread' : (enq.status === 'replied' ? 'replied' : '');
        var statusLabel = enq.status === 'unread' ? 'Unread' : (enq.status === 'replied' ? 'Replied' : 'Read');
        var phone = enq.customer_phone || '';
        var email = enq.customer_email || '';
        var waLink = phone ? 'https://wa.me/' + phone.replace(/^0/, '233') : '#';
        var waMsg = encodeURIComponent('Hello ' + (enq.customer_name || 'there') + ', thank you for your enquiry at Rhule Auto Hub. ' + (enq.message ? 'Re: "' + enq.message.substring(0, 60) + '"' : '') + '\n\nHow can we assist you further?');
        var mailSubject = encodeURIComponent('Re: Your Rhule Auto Hub Enquiry');
        var mailBody = encodeURIComponent('Dear ' + (enq.customer_name || 'Customer') + ',\n\nThank you for reaching out to Rhule Auto Hub.\n\n' + (enq.message ? 'Regarding your enquiry: "' + enq.message.substring(0, 100) + '"\n\n' : '') + 'We would be happy to assist you. Please feel free to contact us or visit our showroom.\n\nBest regards,\nRhule Auto Hub\n+233 53 886 1301');

        return '<div class="enquiry-card ' + statusClass + '">' +
          '<div class="enquiry-top">' +
            '<div class="enquiry-name">' + escapeHtml(enq.customer_name || 'Anonymous') + (enq.created_at ? ' <span style="font-weight:400;font-size:0.78rem;color:var(--gray-400);">' + enq.created_at + '</span>' : '') + '</div>' +
            '<span class="enquiry-status-badge ' + (enq.status || 'unread') + '">' + (enq.status === 'replied' ? '&#10003; ' : '') + statusLabel + '</span>' +
          '</div>' +
          '<div class="enquiry-contact-row">' +
            (phone ? '<span class="enquiry-contact-item"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg><a href="https://wa.me/' + phone.replace(/^0/, '233') + '" target="_blank">' + escapeHtml(phone) + '</a></span>' : '') +
            (email ? '<span class="enquiry-contact-item"><svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg><a href="mailto:' + escapeHtml(email) + '?subject=' + mailSubject + '&body=' + mailBody + '">' + escapeHtml(email) + '</a></span>' : '') +
          '</div>' +
          (car ? '<div class="enquiry-vehicle-tag"><svg viewBox="0 0 24 24"><path d="M5 17h14M5 17a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-3h8l2 3h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2M5 17a2 2 0 1 0 4 0M15 17a2 2 0 1 0 4 0M5 9h14"/></svg>' + escapeHtml(car.year + ' ' + car.make + ' ' + car.model) + '</div>' : '') +
          '<div class="enquiry-message">' + escapeHtml(enq.message || '') + '</div>' +

          (enq.admin_reply ? '<div style="padding:8px 12px;margin-bottom:10px;background:#ecfdf5;border-radius:8px;border:1px solid #abefc6;font-size:0.82rem;color:var(--gray-700);"><span style="font-weight:600;color:#067647;">Your reply:</span> ' + escapeHtml(enq.admin_reply) + '</div>' : '') +

          '<div class="enquiry-reply-box" id="replyBox-' + enq.id + '">' +
            '<textarea class="enquiry-reply-textarea" id="replyText-' + enq.id + '" placeholder="Type your reply here..." oninput="document.getElementById(\'replySendWa-' + enq.id + '\').href = \'https://wa.me/' + phone.replace(/^0/, '233') + '?text=\' + encodeURIComponent(this.value)"></textarea>' +
            '<div class="enquiry-reply-actions">' +
              '<button class="btn btn-sm btn-primary" onclick="RhuleAdmin.sendReply(\'' + enq.id + '\')">Save & Mark Replied</button>' +
              '<a class="btn btn-sm" id="replySendWa-' + enq.id + '" href="' + waLink + '?text=' + waMsg + '" target="_blank" style="background:#25d366;color:white;text-decoration:none;padding:7px 14px;border-radius:6px;font-size:0.78rem;font-weight:600;">Send via WhatsApp</a>' +
              (email ? '<button class="btn btn-sm btn-outline" onclick="RhuleAdmin.sendEmailReply(\'' + enq.id + '\')" style="padding:7px 14px;font-size:0.78rem;">Send via Email</button>' : '') +
              '<button class="btn btn-sm btn-ghost" onclick="RhuleAdmin.cancelReply(\'' + enq.id + '\')">Cancel</button>' +
            '</div>' +
            '<div class="enquiry-reply-note">WhatsApp opens in a new tab. Save to mark this enquiry as replied.</div>' +
          '</div>' +

          '<div class="enquiry-actions">' +
            '<button class="enquiry-action enquiry-action-reply" onclick="RhuleAdmin.toggleReply(\'' + enq.id + '\')"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Reply</button>' +
            (phone ? '<a class="enquiry-action enquiry-action-whatsapp" href="' + waLink + '?text=' + waMsg + '" target="_blank"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>WhatsApp</a>' : '') +
            (email ? '<a class="enquiry-action enquiry-action-email" href="mailto:' + escapeHtml(email) + '?subject=' + mailSubject + '&body=' + mailBody + '"><svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>Email</a>' : '') +
            (phone ? '<a class="enquiry-action enquiry-action-call" href="tel:' + phone.replace(/[^0-9+]/g, '') + '"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>Call</a>' : '') +
            (enq.status !== 'replied' ? '<button class="enquiry-action enquiry-action-replied" onclick="RhuleAdmin.markReplied(\'' + enq.id + '\')"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>Mark Replied</button>' : '') +
            '<button class="enquiry-action-delete" title="Delete" onclick="event.stopPropagation(); RhuleAdmin.deleteEnquiry(\'' + enq.id + '\')">&#10005;</button>' +
          '</div></div>';
      }).join('');
    } catch (e) { console.error(e); }
  }

  function toggleReply(id) {
    var box = document.getElementById('replyBox-' + id);
    if (box) box.classList.toggle('open');
  }

  function cancelReply(id) {
    var box = document.getElementById('replyBox-' + id);
    if (box) { box.classList.remove('open'); document.getElementById('replyText-' + id).value = ''; }
  }

  async function sendReply(id) {
    var textarea = document.getElementById('replyText-' + id);
    var reply = textarea ? textarea.value.trim() : '';
    if (!reply) { toast('Please type a reply first', 'error'); return; }
    try {
      await api('/api/enquiries/' + id, { method: 'PUT', body: JSON.stringify({ admin_reply: reply, status: 'replied' }) });
      toast('Reply saved', 'success');
      renderEnquiries();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function markReplied(id) {
    try {
      await api('/api/enquiries/' + id, { method: 'PUT', body: JSON.stringify({ status: 'replied' }) });
      toast('Marked as replied', 'success');
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
    var makes = Object.keys(RhuleData.CAR_MAKES_MODELS).sort();
    var currentMake = selectMake || '';
    makeSelect.innerHTML = '<option value="">Select Make</option>' +
      makes.map(function(m) { return '<option value="' + m + '"' + (m === currentMake ? ' selected' : '') + '>' + m + '</option>'; }).join('');
    populateAdminModels(currentMake);
  }

  function populateAdminModels(selectedMake) {
    var modelSelect = document.getElementById('vf-model');
    if (!modelSelect) return;
    selectedMake = selectedMake || document.getElementById('vf-make').value;
    var models = selectedMake && RhuleData.CAR_MAKES_MODELS[selectedMake]
      ? RhuleData.CAR_MAKES_MODELS[selectedMake].slice().sort()
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
        '<button class="image-preview-remove" onclick="RhuleAdmin.removeImage(' + i + ')">&#10005;</button></div>';
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
          '<button title="Edit" onclick="RhuleAdmin.editKnowledgeEntry(\'' + entry.id + '\')">&#9998;</button>' +
          '<button title="Delete" class="danger" onclick="RhuleAdmin.deleteKnowledgeEntry(\'' + entry.id + '\')">&#10005;</button>' +
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

  function escapeHtml(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ── VISIT SCHEDULING (ADMIN) ──
  let currentVisitFilter = 'all';

  async function renderVisits(filter) {
    filter = filter || currentVisitFilter;
    var tbody = document.getElementById('visitsTableBody');
    if (!tbody) return;
    try {
      var url = '/api/visits' + (filter !== 'all' ? '?status=' + filter : '');
      var visits = await api(url);

      var counts = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
      var allVisits = await api('/api/visits');
      allVisits.forEach(function(v) { if (counts[v.status] !== undefined) counts[v.status]++; });

      document.getElementById('visitPendingCount').textContent = counts.pending;
      document.getElementById('visitConfirmedCount').textContent = counts.confirmed;
      document.getElementById('visitCompletedCount').textContent = counts.completed;
      document.getElementById('visitCancelledCount').textContent = counts.cancelled;
      document.getElementById('visitBadge').textContent = counts.pending;

      if (visits.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6"><div class="visit-empty"><div class="visit-empty-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div><h3>No visits found</h3><p>' + (filter !== 'all' ? 'No visits with "' + filter + '" status.' : 'No scheduled visits yet.') + '</p></div></td></tr>';
        return;
      }

      var statusLabels = { pending: 'Pending', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled' };

      tbody.innerHTML = visits.map(function(v) {
        var vehicleStr = v.vehicle_id ? (v.year + ' ' + v.make + ' ' + v.model).trim() || 'Vehicle #' + v.vehicle_id.slice(0, 8) : '—';
        var dateStr = v.preferred_date ? new Date(v.preferred_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—';
        var timeStr = v.preferred_time || '—';

        var actionsHtml = '';
        if (v.status === 'pending') {
          actionsHtml += '<button class="visit-action visit-action-confirm" onclick="RhuleAdmin.updateVisitStatus(\'' + v.id + '\',\'confirmed\')">Confirm</button>';
        }
        if (v.status === 'confirmed') {
          actionsHtml += '<button class="visit-action visit-action-complete" onclick="RhuleAdmin.updateVisitStatus(\'' + v.id + '\',\'completed\')">Complete</button>';
        }
        if (v.status !== 'cancelled') {
          actionsHtml += '<button class="visit-action visit-action-cancel" onclick="RhuleAdmin.updateVisitStatus(\'' + v.id + '\',\'cancelled\')">Cancel</button>';
        }
        actionsHtml += '<button class="visit-action-delete" title="Delete" onclick="RhuleAdmin.deleteVisit(\'' + v.id + '\')">&#10005;</button>';

        return '<tr>' +
          '<td><div class="visit-customer">' + escapeHtml(v.customer_name) + '</div><div class="visit-email">' + escapeHtml(v.customer_email || '') + '</div><div class="visit-phone"><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg><a href="https://wa.me/' + v.customer_phone.replace(/^0/, '233') + '" target="_blank">' + escapeHtml(v.customer_phone) + '</a></div></td>' +
          '<td style="white-space:nowrap;">' + dateStr + '<br><span style="font-size:0.78rem;color:var(--gray-400);">' + timeStr + '</span></td>' +
          '<td style="font-weight:500;color:var(--gray-800);">' + escapeHtml(vehicleStr) + '</td>' +
          '<td><div class="visit-message" title="' + (v.message ? escapeHtml(v.message) : '') + '">' + (v.message ? escapeHtml(v.message) : '—') + '</div></td>' +
          '<td><span class="visit-status ' + v.status + '"><span class="visit-status-dot"></span>' + (statusLabels[v.status] || v.status) + '</span></td>' +
          '<td><div class="visit-actions">' + actionsHtml + '</div></td></tr>';
      }).join('');
    } catch (e) { console.error(e); }
  }

  function filterVisits(filter, el) {
    currentVisitFilter = filter;
    document.querySelectorAll('[data-visit-filter]').forEach(function(b) { b.classList.remove('active'); });
    if (el) el.classList.add('active');
    renderVisits(filter);
  }

  async function updateVisitStatus(id, status) {
    try {
      await api('/api/visits/' + id, { method: 'PUT', body: JSON.stringify({ status: status }) });
      toast('Visit ' + status, 'success');
      renderVisits();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function deleteVisit(id) {
    if (!confirm('Delete this scheduled visit?')) return;
    try {
      await api('/api/visits/' + id, { method: 'DELETE' });
      toast('Visit deleted', 'info');
      renderVisits();
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
    var saved = localStorage.getItem('rhule_admin_session');
    if (saved) {
      try {
        session = JSON.parse(saved);
        if (!session?.token) { session = null; localStorage.removeItem('rhule_admin_session'); }
      } catch (e) { session = null; localStorage.removeItem('rhule_admin_session'); }
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
        var notifData = await api('/api/notifications/unread-count');
        updateNotifBadge(notifData.count);
        var stats = await api('/api/stats');
        var vb = document.getElementById('visitBadge');
        if (vb) vb.textContent = stats.pendingVisits || 0;
      } catch (e) {}
    }, 30000);

    // Close notification dropdown on outside click
    document.addEventListener('click', function(e) {
      var btn = document.getElementById('notificationBtn');
      if (btn && !btn.contains(e.target)) {
        var dd = document.getElementById('notifDropdown');
        if (dd) dd.style.display = 'none';
      }
    });
  }

  let notifsVisible = false;

  function updateNotifBadge(count) {
    var badge = document.getElementById('notifBadge');
    if (!badge) return;
    if (count > 0) {
      badge.style.display = '';
      badge.textContent = count;
    } else {
      badge.style.display = 'none';
    }
  }

  async function toggleNotifications() {
    var dd = document.getElementById('notifDropdown');
    if (!dd) return;
    notifsVisible = !notifsVisible;
    dd.style.display = notifsVisible ? '' : 'none';
    if (notifsVisible) {
      try {
        var notifs = await api('/api/notifications');
        var list = document.getElementById('notifList');
        if (list) {
          list.innerHTML = notifs.length === 0
            ? '<div style="padding:24px 16px;text-align:center;color:var(--gray-400);font-size:0.85rem;">No notifications yet</div>'
            : notifs.map(function(n) {
                var date = n.created_at ? new Date(n.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
                return '<div style="padding:10px 16px;border-bottom:1px solid var(--gray-50);font-size:0.85rem;' + (n.seen ? '' : 'background:var(--green-50);') + '">' +
                  '<div style="font-weight:600;color:var(--gray-900);margin-bottom:2px;">' + (n.title || '') + '</div>' +
                  '<div style="color:var(--gray-500);font-size:0.8rem;">' + (n.message || '') + '</div>' +
                  '<div style="color:var(--gray-400);font-size:0.72rem;margin-top:4px;">' + date + '</div></div>';
              }).join('');
        }
      } catch (e) {}
    }
  }

  async function markNotifsSeen() {
    try {
      await api('/api/notifications/seen', { method: 'POST' });
      updateNotifBadge(0);
      var list = document.getElementById('notifList');
      if (list) {
        list.querySelectorAll('div[style*="background"]').forEach(function(el) { el.style.background = ''; });
      }
    } catch (e) {}
  }

  async function changePassword(e) {
    e.preventDefault();
    var current = document.getElementById('pw-current').value;
    var next = document.getElementById('pw-new').value;
    var confirm = document.getElementById('pw-confirm').value;
    if (next !== confirm) {
      toast('New passwords do not match', 'error');
      return;
    }
    try {
      await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: current, newPassword: next }) });
      toast('Password updated successfully', 'success');
      e.target.reset();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // ── ADMIN ACCOUNTS ──
  async function renderAdmins() {
    var tbody = document.getElementById('adminsTableBody');
    if (!tbody) return;
    try {
      var admins = await api('/api/admins');
      tbody.innerHTML = admins.length === 0
        ? '<tr><td colspan="3" style="text-align:center;color:var(--gray-400);padding:24px;">No admins found</td></tr>'
        : admins.map(function(a) {
            var date = a.created_at ? new Date(a.created_at).toLocaleDateString('en-GB') : '';
            return '<tr><td>' + escapeHtml(a.email) + '</td><td style="white-space:nowrap;">' + date + '</td>' +
              '<td style="white-space:nowrap;">' +
              '<button class="btn btn-sm btn-outline" onclick="RhuleAdmin.resetAdminPassword(\'' + a.id + '\')" style="margin-right:6px;">Reset Password</button>' +
              '<button class="btn btn-sm btn-danger" onclick="RhuleAdmin.deleteAdmin(\'' + a.id + '\')">Delete</button>' +
              '</td></tr>';
          }).join('');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function addAdmin(e) {
    e.preventDefault();
    var email = document.getElementById('aa-email').value.trim();
    var password = document.getElementById('aa-password').value;
    try {
      await api('/api/auth/signup', { method: 'POST', body: JSON.stringify({ email: email, password: password }) });
      toast('Admin added', 'success');
      e.target.reset();
      renderAdmins();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function deleteAdmin(id) {
    if (!confirm('Delete this admin account? This cannot be undone.')) return;
    try {
      await api('/api/admins/' + id, { method: 'DELETE' });
      toast('Admin deleted', 'info');
      renderAdmins();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function resetAdminPassword(id) {
    if (!confirm('Reset this admin\'s password? They will need the new temporary password to log in.')) return;
    try {
      var result = await api('/api/admins/' + id + '/reset-password', { method: 'POST' });
      toast('Temporary password: ' + result.tempPassword + ' — share it securely.', 'success');
    } catch (err) { toast(err.message, 'error'); }
  }

  async function sendEmailReply(id) {
    var enq = enquiriesCache.find(function(e) { return e.id === id; });
    if (!enq || !enq.customer_email) { toast('No email address on file for this enquiry', 'error'); return; }
    var subject = 'Re: Your Rhule Auto Hub Enquiry';
    var body = 'Dear ' + (enq.customer_name || 'Customer') + ',\n\nThank you for reaching out to Rhule Auto Hub.\n\n' + (enq.message ? 'Regarding your enquiry: "' + enq.message.substring(0, 100) + '"\n\n' : '') + 'We would be happy to assist you. Please feel free to contact us or visit our showroom.\n\nBest regards,\nRhule Auto Hub\n+233 53 886 1301';
    try {
      await api('/api/enquiries/' + id + '/send-email', { method: 'POST', body: JSON.stringify({ subject: subject, body: body }) });
      toast('Email sent to ' + enq.customer_email, 'success');
    } catch (err) {
      window.location.href = 'mailto:' + enq.customer_email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      toast(err.message || 'Email not configured — opened your email app instead', 'info');
    }
  }

  // ── INIT CONTINUED ──

  document.addEventListener('DOMContentLoaded', init);

  return {
    switchTab: switchTab, switchDashTab: switchDashTab, searchInventory: searchInventory,
    openVehicleModal: openVehicleModal, closeVehicleModal: closeVehicleModal, editVehicle: editVehicle, saveVehicle: saveVehicle,
    populateAdminMakeDropdown: populateAdminMakeDropdown, populateAdminModels: populateAdminModels,
    openDeleteModal: openDeleteModal, confirmDelete: confirmDelete, openSoldModal: openSoldModal, confirmSold: confirmSold, relistVehicle: relistVehicle,
    removeImage: removeImage, deleteEnquiry: deleteEnquiry, toggleReply: toggleReply, cancelReply: cancelReply, sendReply: sendReply, markReplied: markReplied,
    filterKnowledge: filterKnowledge, openKnowledgeModal: openKnowledgeModal, closeKnowledgeModal: closeKnowledgeModal,
    editKnowledgeEntry: editKnowledgeEntry, saveKnowledgeEntry: saveKnowledgeEntry, deleteKnowledgeEntry: deleteKnowledgeEntry, syncVehicleKnowledge: syncVehicleKnowledge,
    toggleNotifications: toggleNotifications, markNotifsSeen: markNotifsSeen,
    renderVisits: renderVisits, filterVisits: filterVisits, updateVisitStatus: updateVisitStatus, deleteVisit: deleteVisit,
    changePassword: changePassword, renderAdmins: renderAdmins, addAdmin: addAdmin, deleteAdmin: deleteAdmin, resetAdminPassword: resetAdminPassword, sendEmailReply: sendEmailReply
  };
})();

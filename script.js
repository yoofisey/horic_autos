/* ── INVENTORY DATA ── */
let inventory = [
  { id: 1, make: "Porsche", model: "911 GT3 RS", year: 2024, price: 223800, img: "🏎️", status: "In Stock" },
  { id: 2, make: "BMW", model: "M4 CSL", year: 2023, price: 139900, img: "🏎️", status: "Coming Soon" },
  { id: 3, make: "Mercedes-Benz", model: "C63 S AMG", year: 2023, price: 82000, img: "🏎️", status: "In Stock" },
];

/* ── LOCAL STORAGE ── */
function saveInventory() {
  localStorage.setItem('inventoryData', JSON.stringify(inventory));
}
function loadInventory() {
  const data = localStorage.getItem('inventoryData');
  return data ? JSON.parse(data) : inventory;
}

/* ── 1. ANIMATION ENGINE ── */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('reveal');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

function initScrollReveal() {
  const cards = document.querySelectorAll('.inventory-card');
  cards.forEach(card => revealObserver.observe(card));
}

/* ── 2. RENDERING ENGINE ── */
function renderInventory(data) {
  const grid = document.querySelector('.grid-layout') || document.querySelector('.car-grid');
  const countLabel = document.querySelector('.results-meta');
  if (!grid) return;

  grid.innerHTML = '';
  if (data.length === 0) {
    if (countLabel) countLabel.textContent = `0 Vehicles Found`;
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 5rem 2rem;">
      <h2 style="font-size: 3rem;">🔍</h2>
      <h3>No matches found</h3>
      <p style="color: var(--text-dim);">Try adjusting your search or filters.</p>
    </div>`;
    return;
  }

  if (countLabel) countLabel.textContent = `Showing ${data.length} Vehicles`;

  data.forEach(car => {
    const card = `
      <article class="${grid.classList.contains('grid-layout') ? 'inventory-card' : 'car-card'}" onclick="openDetails(${car.id})">
        <div class="${grid.classList.contains('grid-layout') ? 'card-image-wrap' : 'car-img-placeholder'}">
          ${car.img.startsWith("blob:") ? `<img src="${car.img}" alt="${car.make} ${car.model}" style="width:100%; border-radius:8px;">` : car.img}
          ${car.status === 'In Stock' ? '<span class="status-tag">In Stock</span>' : ''}
        </div>
        <div class="${grid.classList.contains('grid-layout') ? 'card-content' : ''}">
          <h3 class="${grid.classList.contains('grid-layout') ? '' : 'car-name'}">${car.year} ${car.make} ${car.model}</h3>
          <p class="${grid.classList.contains('grid-layout') ? 'specs' : ''}">Performance Series • Premium Trim</p>
          <div class="${grid.classList.contains('grid-layout') ? 'card-footer' : ''}">
            <span class="${grid.classList.contains('grid-layout') ? 'price' : 'car-price'}">$${car.price.toLocaleString()}</span>
            ${grid.classList.contains('grid-layout') ? '<button class="btn-text">Details →</button>' : ''}
          </div>
        </div>
      </article>`;
    grid.innerHTML += card;
  });

  initScrollReveal();
}

/* ── 3. FILTERING & SEARCH ── */
function applyFilters() {
  const searchTerm = (document.querySelector('.minimal-search')?.value || document.querySelector('.search-input')?.value || '').toLowerCase();
  const makeFilter = document.querySelector('.minimal-select:nth-child(1)')?.value || "All Makes";
  const sortType = document.querySelector('.minimal-select:nth-child(2)')?.value || "Default";

  let filtered = inventory.filter(car => {
    const searchableText = `${car.year} ${car.make} ${car.model} ${car.status}`.toLowerCase();
    const matchesSearch = searchableText.includes(searchTerm);
    const matchesMake = makeFilter === "All Makes" || car.make === makeFilter;
    return matchesSearch && matchesMake;
  });

  if (sortType === "Price: Low to High") filtered.sort((a, b) => a.price - b.price);
  if (sortType === "Price: High to Low") filtered.sort((a, b) => b.price - a.price);

  renderInventory(filtered);
}

/* ── 4. MODAL ── */
function openDetails(id) {
  const car = inventory.find(c => c.id === id);
  if (!car) return;

  const modal = document.getElementById('carModal');
  const body = document.getElementById('modalBody');

  body.innerHTML = `
    <div class="modal-grid">
      <div class="modal-visual">
        ${car.img.startsWith("blob:") 
          ? `<img src="${car.img}" alt="${car.make} ${car.model}" style="width:100%; height:350px; object-fit:cover; border-radius:12px;">`
          : `<div class="image-placeholder" style="font-size:8rem; height:350px; background:var(--bg-input); border-radius:12px;">${car.img}</div>`}
      </div>
      <div class="modal-info">
        <h2>${car.year} ${car.make}</h2>
        <h3>${car.model}</h3>
        <p>• Status: ${car.status}</p>
        <p>• Price: $${car.price.toLocaleString()}</p>
      </div>
    </div>`;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  document.getElementById('carModal').classList.remove('active');
  document.body.style.overflow = 'auto';
}

/* ── 5. ADMIN DASHBOARD ── */
function renderAdminTable() {
  const tbody = document.getElementById('adminTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  inventory.forEach(car => {
    tbody.innerHTML += `
      <tr>
        <td>${car.year} ${car.make} ${car.model}</td>
        <td>${car.status}</td>
        <td>$${car.price.toLocaleString()}</td>
        <td>0</td>
        <td class="action-group">
          <button class="action-btn edit">Edit</button>
          <button class="action-btn delete" onclick="openDeleteModal(${car.id})">Delete</button>
        </td>
      </tr>`;
  });
}
function openAddCarModal() { document.getElementById('addCarModal').classList.add('active'); }
function closeAdminModal() { document.getElementById('addCarModal').classList.remove('active'); }
function openDeleteModal(id) {
  document.getElementById('deleteConfirmModal').classList.add('active');
  document.getElementById('confirmDeleteBtn').onclick = () => {
    const index = inventory.findIndex(c => c.id === id);
    if (index > -1) inventory.splice(index, 1);
    saveInventory();
    renderInventory(inventory);
    renderAdminTable();
    closeDeleteModal();
  };
}
function closeDeleteModal() { document.getElementById('deleteConfirmModal').classList.remove('active'); }

/* ── 6. INITIALIZATION ── */
document.addEventListener('DOMContentLoaded', () => {
  // Load from localStorage first
  inventory = loadInventory();

  renderInventory(inventory);
  renderAdminTable();

  const searchBar = document.querySelector('.minimal-search') || document.querySelector('.search-input');
  if (searchBar) searchBar.addEventListener('input', applyFilters);

  const dropdowns = document.querySelectorAll('.minimal-select');
  dropdowns.forEach(select => select.addEventListener('change', applyFilters));

  /* ── 7. ADD VEHICLE FORM HANDLER ── */
  const addCarForm = document.getElementById('addCarForm');
  if (addCarForm) {
    addCarForm.addEventListener('submit', (e) => {
      e.preventDefault();

      // Collect form data
      const formData = new FormData(addCarForm);
      const make = formData.get('make');
      const model = formData.get('model');
      const year = parseInt(formData.get('year')); // ✅ read year from form
      const price = parseFloat(formData.get('price'));
      const status = formData.get('status');

      // Handle image upload
      const fileInput = document.getElementById('carImage');
      let img = "🏎️"; // fallback
      if (fileInput && fileInput.files && fileInput.files[0]) {
        img = URL.createObjectURL(fileInput.files[0]); // preview URL
      }

      // Create new car object
      const newCar = {
        id: inventory.length ? Math.max(...inventory.map(c => c.id)) + 1 : 1,
        make,
        model,
        year,
        price,
        img,
        status
      };

      // Add to inventory
      inventory.push(newCar);

      // Save to localStorage
      saveInventory();

      // Refresh views
      renderInventory(inventory);
      renderAdminTable();

      // Reset form & close modal
      addCarForm.reset();
      closeAdminModal();
    });

    // ✅ Live image preview
    const fileInput = document.getElementById('carImage');
    if (fileInput) {
      fileInput.addEventListener('change', () => {
        const previewZone = fileInput.closest('.upload-section');
        if (fileInput.files && fileInput.files[0]) {
          const previewURL = URL.createObjectURL(fileInput.files[0]);
          previewZone.style.backgroundImage = `url(${previewURL})`;
          previewZone.style.backgroundSize = 'cover';
          previewZone.style.backgroundPosition = 'center';
          previewZone.querySelector('p').textContent = "Image selected ✔";
        }
      });
    }
  }
});
function openEditModal(id) {
  const car = inventory.find(c => c.id === id);
  if (!car) return;

  const modal = document.getElementById('editCarModal');
  modal.classList.add('active');

  const form = document.getElementById('editCarForm');
  form.querySelector('[name="make"]').value = car.make;
  form.querySelector('[name="model"]').value = car.model;
  form.querySelector('[name="year"]').value = car.year;
  form.querySelector('[name="price"]').value = car.price;
  form.querySelector('[name="status"]').value = car.status;

  // Replace submit handler with update logic
  form.onsubmit = (e) => {
    e.preventDefault();
    car.make = form.querySelector('[name="make"]').value;
    car.model = form.querySelector('[name="model"]').value;
    car.year = parseInt(form.querySelector('[name="year"]').value);
    car.price = parseFloat(form.querySelector('[name="price"]').value);
    car.status = form.querySelector('[name="status"]').value;

    saveInventory();
    renderInventory(inventory);
    renderAdminTable();
    closeEditModal();
  };
}

function closeEditModal() {
  document.getElementById('editCarModal').classList.remove('active');
}

function openDeleteModal(id) {
  const modal = document.getElementById('deleteConfirmModal');
  modal.classList.add('active');
  document.getElementById('confirmDeleteBtn').onclick = () => {
    const index = inventory.findIndex(c => c.id === id);
    if (index > -1) inventory.splice(index, 1);
    saveInventory();
    renderInventory(inventory);
    renderAdminTable();
    closeDeleteModal();
  };
}

function closeDeleteModal() {
  document.getElementById('deleteConfirmModal').classList.remove('active');
}


function closeEditModal(e) {
  document.getElementById('editCarModal').classList.remove('active');
}

function openDeleteModal(id) {
  const modal = document.getElementById('deleteConfirmModal');
  modal.classList.add('active');
  document.getElementById('confirmDeleteBtn').onclick = () => {
    const index = inventory.findIndex(c => c.id === id);
    if (index > -1) inventory.splice(index, 1);
    saveInventory();
    renderInventory(inventory);
    renderAdminTable();
    closeDeleteModal();
  };
}

function closeDeleteModal(e) {
  document.getElementById('deleteConfirmModal').classList.remove('active');
}
function renderAdminTable() {
  const tbody = document.getElementById('adminTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  inventory.forEach(car => {
    tbody.innerHTML += `
      <tr>
        <td>${car.year} ${car.make} ${car.model}</td>
        <td>${car.status}</td>
        <td>$${car.price.toLocaleString()}</td>
        <td>0</td>
        <td class="action-group">
          <button class="action-btn edit" onclick="openEditModal(${car.id})">Edit</button>
          <button class="action-btn delete" onclick="openDeleteModal(${car.id})">Delete</button>
        </td>
      </tr>`;
  });
}



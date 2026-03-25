/* ============================================================
   HORIC AUTOS — admin.js
   Logic for Inventory Management and Authentication
   ============================================================ */

let inventory = JSON.parse(localStorage.getItem('horic_inventory')) || [];
let editTargetId = null;

// ── AUTHENTICATION ──
function handleLogin() {
    const pass = document.getElementById('admin-pass').value;
    const err = document.getElementById('login-err');
    
    // Simple demo passcode: 'citrine'
    if (pass === 'citrine') {
        document.getElementById('login-overlay').classList.add('hidden');
        document.getElementById('admin-panel').classList.add('visible');
        renderInventory();
    } else {
        err.classList.add('show');
    }
}

function logout() {
    location.reload();
}

// ── CRUD OPERATIONS ──
function renderInventory() {
    const list = document.getElementById('inventory-list');
    const countLabel = document.getElementById('inv-count');
    
    countLabel.innerText = `${inventory.length} Units`;
    list.innerHTML = inventory.length ? '' : '<tr><td colspan="4" class="no-results">No vehicles in inventory.</td></tr>';

    inventory.forEach(car => {
        const row = document.createElement('tr');
        row.style.borderBottom = "1px solid var(--border)";
        row.innerHTML = `
            <td style="padding: 1rem; width: 80px;">
                <img src="${car.img}" style="width:60px; height:40px; object-fit:cover; border:1px solid var(--border);">
            </td>
            <td style="padding: 1rem;">
                <div style="font-weight:700; text-transform:uppercase;">${car.name}</div>
                <div class="sec-eye" style="font-size:10px;">${car.year} • ${car.condition}</div>
            </td>
            <td style="padding: 1rem; font-weight:800; color:var(--green-dark);">
                GHS ${Number(car.price).toLocaleString()}
            </td>
            <td style="padding: 1rem;">
                <button class="btn-view" onclick="editCar(${car.id})">Edit</button>
                <button class="btn-view" style="color:var(--err); border-color:var(--err-bg);" onclick="deleteCar(${car.id})">Delete</button>
            </td>
        `;
        list.appendChild(row);
    });
}

// ── FORM HANDLING ──
const vForm = document.getElementById('vehicle-form');
vForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const newCar = {
        id: editTargetId || Date.now(),
        name: document.getElementById('v-name').value,
        year: document.getElementById('v-year').value,
        price: document.getElementById('v-price').value,
        condition: document.getElementById('v-cond').value,
        img: document.getElementById('v-img').value || 'https://via.placeholder.com/400x250?text=Horic+Autos'
    };

    if (editTargetId) {
        inventory = inventory.map(c => c.id === editTargetId ? newCar : c);
    } else {
        inventory.push(newCar);
    }

    localStorage.setItem('horic_inventory', JSON.stringify(inventory));
    closeModal();
    renderInventory();
});

// ── MODAL UTILS ──
function openModal() {
    editTargetId = null;
    vForm.reset();
    document.getElementById('modal-type').innerText = "Add New Vehicle";
    document.getElementById('form-modal').classList.add('open');
}

function closeModal() {
    document.getElementById('form-modal').classList.remove('open');
}

function deleteCar(id) {
    if (confirm("Permanently remove this vehicle?")) {
        inventory = inventory.filter(c => c.id !== id);
        localStorage.setItem('horic_inventory', JSON.stringify(inventory));
        renderInventory();
    }
}

function editCar(id) {
    const car = inventory.find(c => c.id === id);
    if (!car) return;
    
    editTargetId = id;
    document.getElementById('modal-type').innerText = "Edit Vehicle";
    document.getElementById('v-name').value = car.name;
    document.getElementById('v-year').value = car.year;
    document.getElementById('v-price').value = car.price;
    document.getElementById('v-cond').value = car.condition;
    document.getElementById('v-img').value = car.img;
    
    document.getElementById('form-modal').classList.add('open');
}
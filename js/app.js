// API Configuration
const API_URL = 'http://localhost:8080/api';

// DOM Elements
const servicesGrid = document.getElementById('servicesGrid');
const productsGrid = document.getElementById('productsGrid');
const ticketItems = document.getElementById('ticketItems');
const subtotalEl = document.getElementById('subtotal');
const taxEl = document.getElementById('tax');
const totalEl = document.getElementById('total');
const inventoryTableBody = document.getElementById('inventoryTableBody');

// Carrito del POS
let cart = [];

// Funciones de API
async function fetchData(endpoint) {
    try {
        const response = await fetch(`${API_URL}${endpoint}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}

async function postData(endpoint, data) {
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        return await response.json();
    } catch (error) {
        console.error('Error posting data:', error);
        return null;
    }
}

// Dashboard
async function loadDashboard() {
    const stats = await fetchData('/dashboard/stats');
    if (stats) {
        document.getElementById('totalRevenue').textContent = `$${stats.ingresoTotal?.toFixed(2) || '0.00'}`;
        document.getElementById('appointmentsToday').textContent = stats.citasDeHoy || 0;
        document.getElementById('lowStockItems').textContent = stats.bajosStock || 0;
    }

    // Cargar tabla de inventario
    const productos = await fetchData('/productos');
    if (productos && inventoryTableBody) {
        inventoryTableBody.innerHTML = productos.slice(0, 5).map(p => `
            <tr>
                <td><i class="fas fa-droplet"></i> ${p.nombre}</td>
                <td>${p.categoria}</td>
                <td>${p.stock} units</td>
                <td><span class="badge ${p.stock > 5 ? 'optimal' : 'warning'}">${p.stock > 5 ? 'OPTIMAL' : 'LOW'}</span></td>
                <td><i class="fas fa-ellipsis-h"></i></td>
            </tr>
        `).join('');
    }
}

// POS Terminal
async function loadPOSTerminal() {
    // Cargar servicios
    const servicios = await fetchData('/servicios');
    if (servicios && servicesGrid) {
        servicesGrid.innerHTML = servicios.map(s => `
            <button class="item-btn" onclick="addToCart('${s.nombre}', ${s.precio}, '${s.id}')">
                <i class="fas fa-cut"></i>
                <div class="item-btn-name">${s.nombre}</div>
                <div class="item-btn-price">S/ ${s.precio.toFixed(2)}</div>
            </button>
        `).join('');
    }

    // Cargar productos
    const productos = await fetchData('/productos');
    if (productos && productsGrid) {
        productsGrid.innerHTML = productos.map(p => `
            <button class="item-btn" onclick="addToCart('${p.nombre}', ${p.precio}, '${p.id}')">
                <i class="fas fa-shopping-bag"></i>
                <div class="item-btn-name">${p.nombre}</div>
                <div class="item-btn-price">S/ ${p.precio.toFixed(2)}</div>
            </button>
        `).join('');
    }
}

function addToCart(nombre, precio, id) {
    const existingItem = cart.find(item => item.id === id);
    if (existingItem) {
        existingItem.cantidad++;
    } else {
        cart.push({ id, nombre, precio, cantidad: 1 });
    }
    updateCart();
}

function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    updateCart();
}

function updateCart() {
    if (ticketItems) {
        ticketItems.innerHTML = cart.map((item, idx) => `
            <div class="ticket-item">
                <div class="ticket-item-name">${item.nombre}</div>
                <div class="ticket-item-qty">×${item.cantidad}</div>
                <div class="ticket-item-price">S/ ${(item.precio * item.cantidad).toFixed(2)}</div>
                <button onclick="removeFromCart('${item.id}')" style="background: none; border: none; color: #ff4444; cursor: pointer;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
    }

    const subtotal = cart.reduce((sum, item) => sum + (item.precio * item.cantidad), 0);
    const tax = subtotal * 0.18;
    const total = subtotal + tax;

    if (subtotalEl) subtotalEl.textContent = `S/ ${subtotal.toFixed(2)}`;
    if (taxEl) taxEl.textContent = `S/ ${tax.toFixed(2)}`;
    if (totalEl) totalEl.textContent = `S/ ${total.toFixed(2)}`;
}

// Inventario
async function loadInventory() {
    const productos = await fetchData('/productos');
    if (productos && inventoryTableBody) {
        inventoryTableBody.innerHTML = productos.map(p => `
            <tr>
                <td>${p.nombre}</td>
                <td>${p.categoria}</td>
                <td>S/ ${p.precio.toFixed(2)}</td>
                <td>${p.stock} units</td>
                <td><span class="badge ${p.stock > 5 ? 'optimal' : 'warning'}">${p.stock > 5 ? 'OPTIMAL' : 'LOW'}</span></td>
                <td><i class="fas fa-ellipsis-h"></i></td>
            </tr>
        `).join('');
    }
}

// Inicializar según la página
document.addEventListener('DOMContentLoaded', function() {
    const page = window.location.pathname.split('/').pop();
    
    if (page === 'dashboard.html' || page === '') {
        loadDashboard();
    } else if (page === 'pos.html') {
        loadPOSTerminal();
    } else if (page === 'inventory.html') {
        loadInventory();
    }
});

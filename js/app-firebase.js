// Firebase Configuration
// Proyecto conectado: barberia-e06e6.
// La app usa Realtime Database por REST para no depender de apiKey/appId.
const firebaseRestUrl = "https://barberia-e06e6-default-rtdb.firebaseio.com";
const firebaseConfig = {
    apiKey: "TU_API_KEY_AQUI",
    authDomain: "TU_AUTH_DOMAIN_AQUI",
    databaseURL: firebaseRestUrl,
    projectId: "barberia-e06e6",
    storageBucket: "barberia-e06e6.firebasestorage.app",
    messagingSenderId: "TU_MESSAGING_SENDER_ID_AQUI",
    appId: "TU_APP_ID_AQUI"
};

// EDITA AQUI LOS CORTES/SERVICIOS DEL POS.
// Ejemplo para agregar otro:
// { id: "s2", nombre: "Corte + barba", precio: 35, duracion_minutos: 45, activo: true }
const serviciosCatalogo = [
    { id: "s1", nombre: "Corte de cabello", precio: 20, duracion_minutos: 30, activo: true }
];

const seedData = {
    servicios: Object.fromEntries(serviciosCatalogo.map(servicio => [servicio.id, servicio])),
    productos: {
        p1: { id: "p1", nombre: "Cera Mate", precio: 55, stock: 12, categoria: "Grooming", activo: true },
        p2: { id: "p2", nombre: "Aceite Barba", precio: 60, stock: 15, categoria: "Grooming", activo: true },
        p3: { id: "p3", nombre: "Shampoo Premium", precio: 48, stock: 4, categoria: "Cuidado", activo: true }
    },
    citas: {
        c1: { id: "c1", cliente: "Cliente Demo", fecha_hora: new Date().toISOString(), servicio_id: "s1", estado: "PENDIENTE" }
    },
    ventas: {}
};

const hasFirebaseConfig = Object.values(firebaseConfig).every(value => value && !value.includes("TU_"));
const canUseFirebase = hasFirebaseConfig && typeof firebase !== "undefined" && firebase.initializeApp;
let canUseFirebaseRest = Boolean(firebaseRestUrl);
const storeKey = "barberia_app_data_v1";
let database = null;
let serviciosRef = null;
let productosRef = null;
let citasRef = null;
let ventasRef = null;

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function getLocalData() {
    const saved = localStorage.getItem(storeKey);
    if (!saved) {
        localStorage.setItem(storeKey, JSON.stringify(seedData));
        return clone(seedData);
    }
    return JSON.parse(saved);
}

function setLocalData(data) {
    localStorage.setItem(storeKey, JSON.stringify(data));
}

function getCollection(name) {
    const data = getLocalData();
    return data[name] || {};
}

function setCollectionItem(name, id, value) {
    const data = getLocalData();
    data[name] = data[name] || {};
    data[name][id] = value;
    setLocalData(data);
}

function deleteCollectionItem(name, id) {
    const data = getLocalData();
    if (data[name]) delete data[name][id];
    setLocalData(data);
}

function updateCollectionItem(name, id, partial) {
    const data = getLocalData();
    data[name] = data[name] || {};
    data[name][id] = { ...(data[name][id] || {}), ...partial };
    setLocalData(data);
}

function nextId(prefix) {
    return `${prefix}${Date.now()}`;
}

function firebaseUrl(pathname) {
    return `${firebaseRestUrl}/${pathname}.json`;
}

async function requestFirebase(pathname, options = {}) {
    const response = await fetch(firebaseUrl(pathname), {
        headers: { "Content-Type": "application/json" },
        ...options
    });

    if (!response.ok) {
        throw new Error(`Firebase ${response.status}: ${await response.text()}`);
    }

    return response.json();
}

if (canUseFirebase) {
    firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    serviciosRef = database.ref("servicios");
    productosRef = database.ref("productos");
    citasRef = database.ref("citas");
    ventasRef = database.ref("ventas");
}

const servicesGrid = document.getElementById("servicesGrid");
const productsGrid = document.getElementById("productsGrid");
const ticketItems = document.getElementById("ticketItems");
const subtotalEl = document.getElementById("subtotal");
const taxEl = document.getElementById("tax");
const totalEl = document.getElementById("total");
const inventoryTableBody = document.getElementById("inventoryTableBody");
const posSalesTableBody = document.getElementById("posSalesTableBody");
const monthlyRevenueChart = document.getElementById("monthlyRevenueChart");
const productForm = document.getElementById("productForm");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const dashboardInventorySearch = document.getElementById("dashboardInventorySearch");
let cart = [];

function loadCollection(ref, name, callback) {
    if (canUseFirebase) {
        ref.once("value", snapshot => callback(Object.values(snapshot.val() || {})));
        return;
    }

    if (canUseFirebaseRest) {
        requestFirebase(name)
            .then(data => {
                if (!data && seedData[name]) {
                    requestFirebase(name, {
                        method: "PUT",
                        body: JSON.stringify(seedData[name])
                    }).catch(error => console.warn(`No se pudo crear datos iniciales en ${name}.`, error));
                    callback(Object.values(seedData[name]));
                    return;
                }
                callback(Object.values(data || {}));
            })
            .catch(error => {
                console.warn(`No se pudo leer ${name} en Firebase. Usando datos locales.`, error);
                callback(Object.values(getCollection(name)));
            });
        return;
    }

    callback(Object.values(getCollection(name)));
}

function loadServicios(callback) {
    callback(serviciosCatalogo.filter(item => item.activo !== false));
}

function loadProductos(callback) {
    loadCollection(productosRef, "productos", data => callback(data.filter(item => item.activo !== false)));
}

function loadCitas(callback) {
    loadCollection(citasRef, "citas", callback);
}

function loadVentas(callback) {
    loadCollection(ventasRef, "ventas", callback);
}

function agregarVenta(subtotal, impuesto, total, metodo_pago, items = []) {
    const id = canUseFirebase ? ventasRef.push().key : nextId("v");
    const venta = { id, fecha: new Date().toISOString(), subtotal, impuesto, total, metodo_pago, items };
    if (canUseFirebase) {
        ventasRef.child(id).set(venta);
    } else if (canUseFirebaseRest) {
        requestFirebase(`ventas/${id}`, {
            method: "PUT",
            body: JSON.stringify(venta)
        }).catch(error => {
            console.warn("No se pudo guardar la venta en Firebase. Se guardo localmente.", error);
            setCollectionItem("ventas", id, venta);
        });
    } else {
        setCollectionItem("ventas", id, venta);
    }
}

function agregarProducto(nombre, precio, stock, categoria) {
    const id = canUseFirebase ? productosRef.push().key : nextId("p");
    const producto = { id, nombre, precio, stock, categoria, activo: true };

    if (canUseFirebase) {
        productosRef.child(id).set(producto).then(refreshCurrentPage);
    } else if (canUseFirebaseRest) {
        requestFirebase(`productos/${id}`, {
            method: "PUT",
            body: JSON.stringify(producto)
        })
            .then(refreshCurrentPage)
            .catch(error => {
                console.warn("No se pudo guardar producto en Firebase. Se guardo localmente.", error);
                setCollectionItem("productos", id, producto);
                canUseFirebaseRest = false;
                refreshCurrentPage();
            });
    } else {
        setCollectionItem("productos", id, producto);
        refreshCurrentPage();
    }
}

function eliminarProducto(id) {
    if (!confirm("¿Eliminar este producto del inventario?")) return;

    if (canUseFirebase) {
        productosRef.child(id).remove().then(refreshCurrentPage);
    } else if (canUseFirebaseRest) {
        requestFirebase(`productos/${id}`, { method: "DELETE" })
            .then(refreshCurrentPage)
            .catch(error => {
                console.warn("No se pudo eliminar producto en Firebase. Se eliminó localmente si existía.", error);
                deleteCollectionItem("productos", id);
                canUseFirebaseRest = false;
                refreshCurrentPage();
            });
    } else {
        deleteCollectionItem("productos", id);
        refreshCurrentPage();
    }
}

function updateProductoStock(productId, cantidad) {
    if (canUseFirebase) {
        productosRef.once("value", snapshot => {
            const products = snapshot.val() || {};
            Object.keys(products).forEach(key => {
                if (products[key].id === productId && typeof products[key].stock === "number") {
                    productosRef.child(key).update({ stock: products[key].stock - cantidad });
                }
            });
        });
        return;
    }

    if (canUseFirebaseRest) {
        requestFirebase("productos")
            .then(products => {
                Object.keys(products || {}).forEach(key => {
                    const product = products[key];
                    if (product.id === productId && typeof product.stock === "number") {
                        requestFirebase(`productos/${key}`, {
                            method: "PATCH",
                            body: JSON.stringify({ stock: product.stock - cantidad })
                        }).catch(error => console.warn("No se pudo actualizar stock en Firebase.", error));
                    }
                });
            })
            .catch(error => console.warn("No se pudo consultar productos en Firebase.", error));
        return;
    }

    const products = getCollection("productos");
    Object.keys(products).forEach(key => {
        if (products[key].id === productId && typeof products[key].stock === "number") {
            updateCollectionItem("productos", key, { stock: products[key].stock - cantidad });
        }
    });
}

function eliminarVenta(id) {
    loadVentas(ventas => {
        const venta = ventas.find(item => item.id === id);
        if (!venta) return;
        if (!confirm("Â¿Eliminar este cliente/registro del POS?")) return;

        const items = Array.isArray(venta.items) ? venta.items : [];
        items.forEach(item => updateProductoStock(item.id, -Number(item.cantidad || 0)));

        if (canUseFirebase) {
            ventasRef.child(id).remove().then(refreshCurrentPage);
        } else if (canUseFirebaseRest) {
            requestFirebase(`ventas/${id}`, { method: "DELETE" })
                .then(refreshCurrentPage)
                .catch(error => {
                    console.warn("No se pudo eliminar en Firebase. Se eliminÃ³ localmente si existÃ­a.", error);
                    deleteCollectionItem("ventas", id);
                    refreshCurrentPage();
                });
        } else {
            deleteCollectionItem("ventas", id);
            refreshCurrentPage();
        }
    });
}

function loadDashboard() {
    loadVentas(ventas => {
        const today = new Date().toDateString();
        const ventasHoy = ventas.filter(venta => new Date(venta.fecha).toDateString() === today);
        const totalRevenue = ventasHoy.reduce((sum, venta) => sum + Number(venta.total || 0), 0);
        const target = document.getElementById("totalRevenue");
        if (target) target.textContent = `S/ ${totalRevenue.toFixed(2)}`;
        const clientsTarget = document.getElementById("clientsToday");
        if (clientsTarget) clientsTarget.textContent = ventasHoy.length;
        if (currentPage() === "clientes.html") renderPOSSalesRows(ventasHoy);
        renderMonthlyRevenueChart(ventas);
    });

    loadProductos(productos => {
        renderInventoryRows(filterProducts(productos, dashboardInventorySearch?.value || "").slice(0, 5), true);
    });
}

function loadPOSTerminal() {
    loadServicios(servicios => {
        if (!servicesGrid) return;
        servicesGrid.innerHTML = servicios.map(servicio => `
            <button class="item-btn" onclick="addToCart('${servicio.nombre.replace(/'/g, "\\'")}', ${Number(servicio.precio)}, '${servicio.id}', this)">
                <i class="fas fa-cut"></i>
                <div class="item-btn-name">${servicio.nombre}</div>
                <div class="item-btn-price">S/ ${Number(servicio.precio).toFixed(2)}</div>
            </button>
        `).join("");
    });

    loadProductos(productos => {
        if (!productsGrid) return;
        productsGrid.innerHTML = productos.map(producto => `
            <button class="item-btn" onclick="addToCart('${producto.nombre.replace(/'/g, "\\'")}', ${Number(producto.precio)}, '${producto.id}', this)">
                <i class="fas fa-shopping-bag"></i>
                <div class="item-btn-name">${producto.nombre}</div>
                <div class="item-btn-price">S/ ${Number(producto.precio).toFixed(2)}</div>
            </button>
        `).join("");
    });
}

function addToCart(nombre, precio, id, button) {
    const existingItem = cart.find(item => item.id === id);
    if (existingItem) {
        existingItem.cantidad++;
    } else {
        cart.push({ id, nombre, precio, cantidad: 1 });
    }
    if (button) {
        button.classList.remove("added");
        void button.offsetWidth;
        button.classList.add("added");
        setTimeout(() => button.classList.remove("added"), 650);
    }
    updateCart();
}

function removeFromCart(id) {
    cart = cart.filter(item => item.id !== id);
    updateCart();
}

function updateCart() {
    if (ticketItems) {
        ticketItems.innerHTML = cart.map(item => `
            <div class="ticket-item">
                <div class="ticket-item-name">${item.nombre}</div>
                <div class="ticket-item-qty">x${item.cantidad}</div>
                <div class="ticket-item-price">S/ ${(item.precio * item.cantidad).toFixed(2)}</div>
                <button onclick="removeFromCart('${item.id}')" style="background: none; border: none; color: #ff4444; cursor: pointer;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join("");
    }

    const subtotal = cart.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
    const tax = 0;
    const total = subtotal;

    if (subtotalEl) subtotalEl.textContent = `S/ ${subtotal.toFixed(2)}`;
    if (taxEl) taxEl.textContent = `S/ ${tax.toFixed(2)}`;
    if (totalEl) totalEl.textContent = `S/ ${total.toFixed(2)}`;
}

function procesarPago(metodoPago) {
    if (cart.length === 0) {
        alert("El carrito esta vacio");
        return;
    }

    const subtotal = cart.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
    const tax = 0;
    const total = subtotal;

    const ventaItems = cart.map(item => ({
        id: item.id,
        nombre: item.nombre,
        precio: item.precio,
        cantidad: item.cantidad,
        total: item.precio * item.cantidad
    }));

    agregarVenta(subtotal, tax, total, metodoPago, ventaItems);
    cart.forEach(item => updateProductoStock(item.id, item.cantidad));
    cart = [];
    updateCart();
    alert(`Venta registrada\nTotal: S/ ${total.toFixed(2)}`);
}

function renderInventoryRows(productos, compact = false) {
    if (!inventoryTableBody) return;
    inventoryTableBody.innerHTML = productos.map(producto => {
        const stock = Number(producto.stock || 0);
        const status = stock > 5 ? "OPTIMAL" : "LOW";
        const badge = stock > 5 ? "optimal" : "warning";
        if (compact) {
            return `
                <tr>
                    <td><i class="fas fa-droplet"></i> ${producto.nombre}</td>
                    <td>${producto.categoria || "N/A"}</td>
                    <td>${stock} units</td>
                    <td><span class="badge ${badge}">${status}</span></td>
                </tr>
            `;
        }
        return `
            <tr>
                <td>${producto.nombre}</td>
                <td>${producto.categoria || "N/A"}</td>
                <td>S/ ${Number(producto.precio || 0).toFixed(2)}</td>
                <td>${stock} units</td>
                <td><span class="badge ${badge}">${status}</span></td>
                <td>
                    <button class="btn-delete-row" onclick="eliminarProducto('${producto.id}')" title="Eliminar producto">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

function filterProducts(productos, term = "", category = "") {
    const query = term.trim().toLowerCase();
    return productos.filter(producto => {
        const matchesText = !query ||
            producto.nombre?.toLowerCase().includes(query) ||
            producto.categoria?.toLowerCase().includes(query);
        const matchesCategory = !category || producto.categoria === category;
        return matchesText && matchesCategory;
    });
}

function renderPOSSalesRows(ventas) {
    if (!posSalesTableBody) return;
    const orderedSales = [...ventas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    if (orderedSales.length === 0) {
        posSalesTableBody.innerHTML = `
            <tr>
                <td colspan="5">Todavia no hay ventas registradas en el POS hoy.</td>
            </tr>
        `;
        return;
    }

    posSalesTableBody.innerHTML = orderedSales.map(venta => {
        const items = Array.isArray(venta.items) ? venta.items : [];
        const detail = items.length > 0
            ? items.map(item => `${item.cantidad} x ${item.nombre}`).join(", ")
            : "Venta registrada";
        return `
            <tr>
                <td>${new Date(venta.fecha).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}</td>
                <td>${venta.metodo_pago || "N/A"}</td>
                <td>${detail}</td>
                <td>S/ ${Number(venta.total || 0).toFixed(2)}</td>
                <td>
                    <button class="btn-delete-row" onclick="eliminarVenta('${venta.id}')" title="Eliminar registro">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}
function renderMonthlyRevenueChart(ventas) {
    if (!monthlyRevenueChart) return;
    const months = {};
    const today = new Date();

    for (let offset = 5; offset >= 0; offset--) {
        const date = new Date(today.getFullYear(), today.getMonth() - offset, 1);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        months[key] = {
            label: date.toLocaleDateString("es-PE", { month: "short" }).replace(".", ""),
            total: 0,
            current: offset === 0
        };
    }

    ventas.forEach(venta => {
        const date = new Date(venta.fecha);
        if (Number.isNaN(date.getTime())) return;
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        if (months[key]) months[key].total += Number(venta.total || 0);
    });

    const values = Object.values(months);
    const max = Math.max(5000, ...values.map(month => month.total));
    const step = max / 5;
    const axis = [5, 4, 3, 2, 1, 0].map(mark => {
        const value = step * mark;
        return value === 0 ? "0" : `S/${Math.round(value / 1000)}k`;
    });

    monthlyRevenueChart.innerHTML = `
        <div class="monthly-axis">
            ${axis.map(label => `<span>${label}</span>`).join("")}
        </div>
        ${values.map(month => `
            <div class="monthly-bar-wrap" title="${month.label}: S/ ${month.total.toFixed(2)}">
                <div class="monthly-bar ${month.current ? "current" : ""}" style="height: ${Math.max(2, (month.total / max) * 100)}%"></div>
            </div>
        `).join("")}
        <div></div>
        ${values.map(month => `<div class="monthly-label">${month.label}</div>`).join("")}
    `;
}
function loadInventory() {
    loadProductos(productos => {
        renderInventoryRows(filterProducts(
            productos,
            searchInput?.value || "",
            categoryFilter?.value || ""
        ));
    });
}

function loadAppointments() {
    loadCitas(citas => {
        const list = document.getElementById("appointmentsList");
        if (!list) return;
        list.innerHTML = citas.map(cita => `
            <div class="appointment-card">
                <div class="appointment-info">
                    <h4>${cita.cliente}</h4>
                    <p class="appointment-time">${new Date(cita.fecha_hora).toLocaleString("es-PE")}</p>
                </div>
                <span class="appointment-status">${cita.estado}</span>
            </div>
        `).join("");
    });
}

function currentPage() {
    const page = window.location.pathname.split("/").pop();
    return page || "index.html";
}

function refreshCurrentPage() {
    const page = currentPage();
    if (page === "index.html" || page === "dashboard.html") loadDashboard();
    if (page === "clientes.html") loadDashboard();
    if (page === "pos-firebase.html" || page === "pos.html") loadPOSTerminal();
    if (page === "inventory-firebase.html" || page === "inventory.html") loadInventory();
    if (page === "appointments-firebase.html" || page === "appointments.html") loadAppointments();
}

document.addEventListener("DOMContentLoaded", refreshCurrentPage);

if (productForm) {
    productForm.addEventListener("submit", event => {
        event.preventDefault();
        const nombre = document.getElementById("productName").value.trim();
        const precio = Number(document.getElementById("productPrice").value);
        const stock = Number(document.getElementById("productStock").value);
        const categoria = document.getElementById("productCategory").value.trim();

        if (!nombre || !categoria || Number.isNaN(precio) || Number.isNaN(stock)) return;
        agregarProducto(nombre, precio, stock, categoria);
        productForm.reset();
    });
}

if (searchInput) searchInput.addEventListener("input", loadInventory);
if (categoryFilter) categoryFilter.addEventListener("change", loadInventory);
if (dashboardInventorySearch) dashboardInventorySearch.addEventListener("input", loadDashboard);

if (canUseFirebase) {
    [serviciosRef, productosRef, citasRef, ventasRef].forEach(ref => ref.on("value", refreshCurrentPage));
}

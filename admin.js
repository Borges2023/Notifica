const ADMIN_CREDENTIALS = { username: 'admin', password: 'senha123' };
const STORAGE_KEY = 'notificaCompanies';
const HISTORY_KEY = 'notificaNotificationHistory';
const defaultCompanies = [
  { id: 1, name: 'Lavanderia do Sergio', lat: -23.5489, lng: -46.6388, message: 'Lavanderia do Beltrano: preços imperdíveis! Chegou a hora de aproveitar.' },
  { id: 2, name: 'Padaria da Maria', lat: -23.547, lng: -46.635, message: 'Padaria da Dinha: ofertas fresquinhas no pão da manhã.' },
  { id: 3, name: 'Oficina do João', lat: -23.549, lng: -46.640, message: 'Oficina do Cicrano: desconto em serviço rápido quando você passar por aqui.' }
];

let companies = [];
let map;
let markers = [];

function getStoredCompanies() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return [...defaultCompanies];
  try {
    return JSON.parse(saved);
  } catch {
    return [...defaultCompanies];
  }
}

function getNotificationHistory() {
  const saved = localStorage.getItem(HISTORY_KEY);
  if (!saved) return [];
  try {
    return JSON.parse(saved);
  } catch {
    return [];
  }
}

function clearNotificationHistory() {
  localStorage.removeItem(HISTORY_KEY);
  updateNotificationHistory();
}

function saveCompanies() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(companies));
}

function saveNotificationHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function showSection(sectionId) {
  document.getElementById('loginCard').classList.add('hidden');
  document.getElementById('dashboardCard').classList.add('hidden');
  document.getElementById(sectionId).classList.remove('hidden');
}

function updateCompaniesTable() {
  const tbody = document.querySelector('#companiesTable tbody');
  tbody.innerHTML = '';
  companies.forEach((company) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${company.name}</td>
      <td>${company.lat.toFixed(6)}</td>
      <td>${company.lng.toFixed(6)}</td>
      <td>${company.message}</td>
      <td><button class="small-delete" data-id="${company.id}">Excluir</button></td>
    `;
    tbody.appendChild(row);
  });

  document.querySelectorAll('.small-delete').forEach((button) => {
    button.addEventListener('click', (event) => {
      const id = Number(event.target.dataset.id);
      companies = companies.filter((item) => item.id !== id);
      saveCompanies();
      updateCompaniesTable();
      refreshMapMarkers();
    });
  });
}

function updateNotificationHistory() {
  const history = getNotificationHistory();
  const list = document.getElementById('notificationHistory');
  const status = document.getElementById('historyStatus');
  list.innerHTML = '';

  if (!history.length) {
    status.textContent = 'Nenhuma notificação registrada ainda.';
    const emptyItem = document.createElement('li');
    emptyItem.textContent = 'Nenhuma notificação ainda.';
    list.appendChild(emptyItem);
    return;
  }

  status.textContent = `${history.length} notificação(ões) registradas`;
  history.slice().reverse().forEach((entry) => {
    const item = document.createElement('li');
    const when = new Date(entry.timestamp).toLocaleString('pt-BR');
    item.innerHTML = `<strong>${entry.companyName}</strong> — ${entry.message} <span class="history-time">(${when})</span>`;
    list.appendChild(item);
  });
}

function bindStorageEvents() {
  window.addEventListener('storage', (event) => {
    if (event.key === HISTORY_KEY) {
      updateNotificationHistory();
    }
    if (event.key === STORAGE_KEY) {
      companies = getStoredCompanies();
      updateCompaniesTable();
      refreshMapMarkers();
    }
  });
}

function refreshMapMarkers() {
  markers.forEach((marker) => marker.remove());
  markers = [];
  companies.forEach((company) => {
    const marker = L.marker([company.lat, company.lng]).addTo(map).bindPopup(`<strong>${company.name}</strong><br>${company.message}`);
    markers.push(marker);
  });
}

function initAdminMap() {
  if (!map) {
    map = L.map('adminMap').setView([companies[0].lat, companies[0].lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
  }
  refreshMapMarkers();
  setTimeout(() => map.invalidateSize(), 200);
}

function bindAdminEvents() {
  const loginForm = document.getElementById('loginForm');
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const error = document.getElementById('loginError');

    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
      error.textContent = '';
      sessionStorage.setItem('notifica-admin-authenticated', 'true');
      showAdminDashboard();
      return;
    }

    error.textContent = 'Usuário ou senha incorretos. Tente novamente.';
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem('notifica-admin-authenticated');
    showSection('loginCard');
  });

  document.getElementById('refreshHistoryBtn').addEventListener('click', () => {
    updateNotificationHistory();
  });

  document.getElementById('clearHistoryBtn').addEventListener('click', () => {
    clearNotificationHistory();
  });

  document.getElementById('addCompanyForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('companyName').value.trim();
    const lat = parseFloat(document.getElementById('companyLat').value);
    const lng = parseFloat(document.getElementById('companyLng').value);
    const message = document.getElementById('companyMessage').value.trim();

    if (!name || Number.isNaN(lat) || Number.isNaN(lng) || !message) {
      return;
    }

    const nextId = companies.length ? Math.max(...companies.map((c) => c.id)) + 1 : 1;
    companies.push({ id: nextId, name, lat, lng, message });
    saveCompanies();
    updateCompaniesTable();
    refreshMapMarkers();
    updateNotificationHistory();
    e.target.reset();
  });
}

function showAdminDashboard() {
  companies = getStoredCompanies();
  showSection('dashboardCard');
  updateCompaniesTable();
  updateNotificationHistory();
  initAdminMap();
}

function initAdminApp() {
  bindAdminEvents();
  bindStorageEvents();
  window.addEventListener('focus', () => {
    if (sessionStorage.getItem('notifica-admin-authenticated') === 'true') {
      updateNotificationHistory();
    }
  });
  companies = getStoredCompanies();
  if (sessionStorage.getItem('notifica-admin-authenticated') === 'true') {
    showAdminDashboard();
  } else {
    showSection('loginCard');
  }
}

initAdminApp();

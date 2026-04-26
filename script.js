const STORAGE_KEY = 'notificaCompanies';
const HISTORY_KEY = 'notificaNotificationHistory';
const notifyDistanceMeters = 150;
let companies = [];
let map;
let userMarker;
let selectedCompany;
let notifiedSet = new Set();
let markers = [];

function getStoredCompanies() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
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

function saveNotificationHistory(entry) {
  const history = getNotificationHistory();
  history.push(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function renderStoredHistory() {
  const history = getNotificationHistory();
  const logArea = document.getElementById('logArea');
  logArea.innerHTML = '';

  if (!history.length) {
    const li = document.createElement('li');
    li.textContent = 'Nenhuma notificação registrada ainda.';
    logArea.appendChild(li);
    return;
  }

  history.slice().reverse().forEach((entry) => {
    const li = document.createElement('li');
    const when = new Date(entry.timestamp).toLocaleString('pt-BR');
    li.textContent = `[${when}] ${entry.companyName}: ${entry.message}`;
    logArea.appendChild(li);
  });
}

function getDefaultCompanies() {
  return [
    { id: 1, name: 'Lavanderia do Sergio', lat: -23.5489, lng: -46.6388, message: 'Lavanderia do Beltrano: preços imperdíveis! Chegou a hora de aproveitar.' },
    { id: 2, name: 'Padaria da Maria', lat: -23.547, lng: -46.635, message: 'Padaria da Dinha: ofertas fresquinhas no pão da manhã.' },
    { id: 3, name: 'Oficina do João', lat: -23.549, lng: -46.640, message: 'Oficina do Cicrano: desconto em serviço rápido quando você passar por aqui.' }
  ];
}

function resolveCompanies() {
  const stored = getStoredCompanies();
  return stored.length ? stored : getDefaultCompanies();
}

function initMap() {
  companies = resolveCompanies();
  selectedCompany = companies[0];
  const center = [selectedCompany.lat, selectedCompany.lng];

  map = L.map('map').setView(center, 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  renderCompanyOptions();
  drawAllCompanyMarkers();
  requestPermissions();
}

function renderCompanyOptions() {
  const select = document.getElementById('companySelect');
  select.innerHTML = '';

  companies.forEach((company) => {
    const option = document.createElement('option');
    option.value = company.id;
    option.textContent = company.name;
    select.appendChild(option);
  });

  select.addEventListener('change', (event) => {
    selectedCompany = companies.find((item) => item.id === Number(event.target.value));
    drawAllCompanyMarkers();
    updateStatus(`Empresa selecionada: ${selectedCompany.name}`);
  });

  select.value = selectedCompany.id;

  document.getElementById('testVoiceBtn').addEventListener('click', () => {
    if (!selectedCompany) return;
    speakMessage(selectedCompany.message);
    log(`Teste de voz: ${selectedCompany.name}`);
  });
}

function drawAllCompanyMarkers() {
  markers.forEach((marker) => marker.remove());
  markers = [];

  companies.forEach((company) => {
    const iconUrl = company.id === selectedCompany.id
      ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png'
      : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png';

    const marker = L.marker([company.lat, company.lng], {
      icon: L.icon({
        iconUrl,
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      })
    }).addTo(map).bindPopup(`<strong>${company.name}</strong><br>${company.message}`);

    markers.push(marker);
  });
}

function requestPermissions() {
  if ('Notification' in window) {
    Notification.requestPermission().then(() => initGeolocation());
  } else {
    initGeolocation();
  }
}

function initGeolocation() {
  if (!('geolocation' in navigator)) {
    updateStatus('Geolocalização não disponível neste dispositivo.');
    return;
  }

  navigator.geolocation.watchPosition(
    (position) => {
      const coords = { lat: position.coords.latitude, lng: position.coords.longitude };

      if (!userMarker) {
        userMarker = L.marker([coords.lat, coords.lng], {
          icon: L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
          })
        }).addTo(map).bindPopup('Você');
      } else {
        userMarker.setLatLng([coords.lat, coords.lng]);
      }

      map.panTo([coords.lat, coords.lng]);
      checkProximity(coords);
      updateStatus(`Sua posição: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}. Distância até ${selectedCompany.name}: ${distanceToSelected(coords).toFixed(0)} m.`);
    },
    (error) => {
      updateStatus(`Erro ao obter localização: ${error.message}`);
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
  );
}

function distanceToSelected(coords) {
  return calculateDistance(coords.lat, coords.lng, selectedCompany.lat, selectedCompany.lng);
}

function checkProximity(coords) {
  const distance = distanceToSelected(coords);
  if (distance <= notifyDistanceMeters && !notifiedSet.has(selectedCompany.id)) {
    notifiedSet.add(selectedCompany.id);
    const message = `${selectedCompany.name}: ${selectedCompany.message}`;
    speakMessage(message);
    sendBrowserNotification('Você está próximo ao ponto selecionado', message);
    const entry = {
      companyId: selectedCompany.id,
      companyName: selectedCompany.name,
      message: selectedCompany.message,
      timestamp: new Date().toISOString()
    };
    saveNotificationHistory(entry);
  } else if (distance > notifyDistanceMeters && notifiedSet.has(selectedCompany.id)) {
    notifiedSet.delete(selectedCompany.id);
    log(`Saiu da área de proximidade de ${selectedCompany.name}.`);
  }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const deg2rad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function speakMessage(text) {
  if (!('speechSynthesis' in window)) {
    log('SpeechSynthesis não disponível no navegador.');
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'pt-BR';
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
}

function sendBrowserNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification(title, { body });
}

function updateStatus(message) {
  document.getElementById('status').textContent = message;
}

function log(message) {
  const logArea = document.getElementById('logArea');
  if (!logArea) return;
  const line = document.createElement('li');
  line.textContent = `[${new Date().toLocaleTimeString('pt-BR')}] ${message}`;
  logArea.prepend(line);
}

initMap();

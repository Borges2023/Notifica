const STORAGE_KEY = 'notificaCompanies';
const HISTORY_KEY = 'notificaNotificationHistory';
const notifyDistanceMeters = 150;
let companies = [];
let map;
let userMarker;
let currentUserCoords = null;
let selectedDestination = null;
let destinationMarker = null;
let routeLayer = null;
let lastRouteCoords = null;
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

function bindDestinationForm() {
  const button = document.getElementById('searchDestinationBtn');
  const input = document.getElementById('destinationInput');

  button.addEventListener('click', () => {
    const query = input.value.trim();
    if (!query) {
      updateStatus('Digite um destino para buscar no mapa.');
      return;
    }
    searchDestination(query);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      button.click();
    }
  });

  const testBtn = document.getElementById('testNotificationBtn');
  testBtn.addEventListener('click', () => {
    testProximityNotification();
  });
}

function searchDestination(query) {
  const formattedQuery = encodeURIComponent(query);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${formattedQuery}&limit=5&addressdetails=1`;

  updateStatus('Buscando destino...');
  fetch(url, { headers: { 'Accept': 'application/json' } })
    .then((response) => response.json())
    .then((results) => {
      if (!results.length) {
        updateStatus('Destino não encontrado. Tente outro endereço.');
        renderDestinationResults([]);
        return;
      }
      renderDestinationResults(results);
      updateStatus(`Selecione um destino encontrado para traçar a rota.`);
    })
    .catch(() => {
      updateStatus('Erro ao buscar destino. Verifique sua conexão.');
    });
}

function renderDestinationResults(results) {
  const list = document.getElementById('destinationResults');
  list.innerHTML = '';

  if (!results.length) {
    return;
  }

  results.forEach((place) => {
    const item = document.createElement('li');
    item.textContent = place.display_name;
    item.addEventListener('click', () => selectDestination(place));
    list.appendChild(item);
  });
}

function selectDestination(place) {
  const lat = Number(place.lat);
  const lon = Number(place.lon);
  selectedDestination = {
    lat,
    lng: lon,
    label: place.display_name
  };

  if (destinationMarker) {
    destinationMarker.remove();
  }

  destinationMarker = L.marker([lat, lon], {
    icon: L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    })
  }).addTo(map).bindPopup(`<strong>Destino</strong><br>${place.display_name}`).openPopup();

  if (routeLayer) {
    routeLayer.remove();
    routeLayer = null;
  }

  document.getElementById('destinationResults').innerHTML = '';
  updateStatus(`Destino definido: ${place.display_name}`);
  updateRouteInfo('Calculando melhor rota...');
  if (currentUserCoords) {
    requestRoute(currentUserCoords, selectedDestination);
  } else {
    map.panTo([lat, lon]);
  }
  updateDistanceDisplay(currentUserCoords);
}

function updateDestinationRoute(coords) {
  if (!selectedDestination || !coords) return;
  if (!lastRouteCoords || calculateDistance(coords.lat, coords.lng, lastRouteCoords.lat, lastRouteCoords.lng) > 50) {
    requestRoute(coords, selectedDestination);
  }
}

function requestRoute(startCoords, destination) {
  if (!startCoords || !destination) return;

  const source = `${startCoords.lng},${startCoords.lat}`;
  const target = `${destination.lng},${destination.lat}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${source};${target}?overview=full&geometries=geojson&steps=true&annotations=duration,distance`;

  fetch(url)
    .then((response) => response.json())
    .then((data) => {
      if (!data.routes || data.code !== 'Ok' || !data.routes.length) {
        throw new Error('Rota não encontrada');
      }

      const route = data.routes[0];
      renderRoutePath(route.geometry);
      updateRouteInfo(`Rota: ${route.distance.toFixed(0)} m • ${formatDuration(route.duration)}`);
      updateStatus(`Rota pronta para ${destination.label}`);
      lastRouteCoords = { ...startCoords };
    })
    .catch(() => {
      drawDirectLine(startCoords, destination);
      updateRouteInfo('Não foi possível calcular a rota detalhada. Traçado linha direta.');
      updateStatus(`Destino definido: ${destination.label}`);
    });
}

function renderRoutePath(geojson) {
  if (routeLayer) {
    routeLayer.remove();
  }

  routeLayer = L.geoJSON(geojson, {
    style: {
      color: '#1976d2',
      weight: 5,
      opacity: 0.8
    }
  }).addTo(map);

  map.fitBounds(routeLayer.getBounds().pad(0.2));
}

function drawDirectLine(startCoords, destination) {
  if (routeLayer) {
    routeLayer.remove();
  }

  const latLngs = [
    [startCoords.lat, startCoords.lng],
    [destination.lat, destination.lng]
  ];

  routeLayer = L.polyline(latLngs, { color: '#1976d2', weight: 4, opacity: 0.7, dashArray: '6, 8' }).addTo(map);
  map.fitBounds(routeLayer.getBounds().pad(0.2));
}

function updateRouteInfo(message) {
  const info = document.getElementById('routeInfo');
  if (info) {
    info.textContent = message;
  }
}

function formatDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${remainder} min`;
}

function initMap() {
  companies = resolveCompanies();
  const center = [companies[0].lat, companies[0].lng];

  map = L.map('map').setView(center, 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  drawAllCompanyMarkers();
  bindDestinationForm();
  requestPermissions();
}



function drawAllCompanyMarkers() {
  markers.forEach((marker) => marker.remove());
  markers = [];

  companies.forEach((company) => {
    const marker = L.marker([company.lat, company.lng], {
      icon: L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
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

function testProximityNotification() {
  if (!companies.length) {
    updateStatus('Nenhuma empresa cadastrada para testar.');
    return;
  }

  const testCompany = companies[0];
  const testCoords = {
    lat: testCompany.lat + 0.0001, // Simula estar muito próximo (cerca de 10m)
    lng: testCompany.lng + 0.0001
  };

  updateStatus(`Testando notificação para ${testCompany.name}...`);
  checkProximity(testCoords);
  updateDistanceDisplay(testCoords);
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
      updateDestinationRoute(coords);
      updateDistanceDisplay(coords);
    },
    (error) => {
      updateStatus(`Erro ao obter localização: ${error.message}`);
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
  );
}

function checkProximity(coords) {
  console.log('Verificando proximidade para coords:', coords);
  companies.forEach((company) => {
    const distance = calculateDistance(coords.lat, coords.lng, company.lat, company.lng);
    console.log(`Distância para ${company.name}: ${distance.toFixed(0)}m`);
    if (distance <= notifyDistanceMeters && !notifiedSet.has(company.id)) {
      notifiedSet.add(company.id);
      const message = `${company.name}: ${company.message}`;
      speakMessage(message);
      sendBrowserNotification('Você está próximo de um ponto comercial', message);
      const entry = {
        companyId: company.id,
        companyName: company.name,
        message: company.message,
        timestamp: new Date().toISOString()
      };
      saveNotificationHistory(entry);
      console.log('Notificação enviada para:', company.name);
    } else if (distance > notifyDistanceMeters && notifiedSet.has(company.id)) {
      notifiedSet.delete(company.id);
      log(`Saiu da área de proximidade de ${company.name}.`);
    }
  });
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

function updateDistanceDisplay(coords) {
  if (!coords) {
    document.getElementById('distanceInfo').textContent = '';
    return;
  }

  const nearbyCompanies = companies
    .map((company) => ({
      name: company.name,
      distance: calculateDistance(coords.lat, coords.lng, company.lat, company.lng)
    }))
    .sort((a, b) => a.distance - b.distance);

  const statusText = `Sua posição: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
  updateStatus(statusText);

  let distanceText = nearbyCompanies
    .map((c) => `${c.name}: ${c.distance.toFixed(0)} m`)
    .join(' | ');

  if (selectedDestination) {
    const destinationDistance = calculateDistance(coords.lat, coords.lng, selectedDestination.lat, selectedDestination.lng);
    distanceText = `Destino: ${selectedDestination.label} (${destinationDistance.toFixed(0)} m)` + (distanceText ? ` | ${distanceText}` : '');
  }

  document.getElementById('distanceInfo').textContent = distanceText;
}

function log(message) {
  const logArea = document.getElementById('logArea');
  if (!logArea) return;
  const line = document.createElement('li');
  line.textContent = `[${new Date().toLocaleTimeString('pt-BR')}] ${message}`;
  logArea.prepend(line);
}

initMap();

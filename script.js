const clients = [
  { id: 1, name: 'Lavanderia do Sergio', lat: -23.5489, lng: -46.6388, message: 'Lavanderia do Beltrano: preços imperdíveis! Chegou a hora de aproveitar.' },
  { id: 2, name: 'Padaria da Maria', lat: -23.547, lng: -46.635, message: 'Padaria da Dinha: ofertas fresquinhas no pão da manhã.' },
  { id: 3, name: 'Oficina do João', lat: -23.549, lng: -46.640, message: 'Oficina do Cicrano: desconto em serviço rápido quando você passar por aqui.' }
];

const notifyDistanceMeters = 150;
const notifiedClients = new Set();
let map, userMarker, clientMarker, watchId;
let selectedClient = clients[0];

function initMap() {
  const center = [selectedClient.lat, selectedClient.lng];
  map = L.map('map').setView(center, 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);
  renderClientOptions();
  drawAllClientMarkers();
  setupAddClientForm();
  requestPermissions();
}

function renderClientOptions() {
  const select = document.getElementById('clientSelect');
  select.innerHTML = '';

  clients.forEach((c) => {
    const option = document.createElement('option');
    option.value = c.id;
    option.textContent = c.name;
    select.appendChild(option);
  });

  select.value = selectedClient.id;
  select.addEventListener('change', (event) => {
    selectedClient = clients.find((c) => c.id === Number(event.target.value));
    updateClientMarker();
    updateStatus('Cliente selecionado: ' + selectedClient.name);
  });

  // Botão testar voz
  const testBtn = document.getElementById('testVoiceBtn');
  testBtn.addEventListener('click', () => {
    speakMessage(selectedClient.message);
    log(`Teste de voz: ${selectedClient.message}`);
  });

  updateClientMarker();
}

function drawAllClientMarkers() {
  clients.forEach((c) => {
    L.marker([c.lat, c.lng]).addTo(map).bindPopup(c.name);
  });
}

function updateClientMarker() {
  if (clientMarker) map.removeLayer(clientMarker);
  clientMarker = L.marker([selectedClient.lat, selectedClient.lng], {
    icon: L.icon({
      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    })
  }).addTo(map).bindPopup(selectedClient.name);

  map.setView([selectedClient.lat, selectedClient.lng], 15);
}

function requestPermissions() {
  if ('Notification' in window) {
    Notification.requestPermission().then((perm) => {
      if (perm !== 'granted') log('Permissão de notificação não concedida. Apenas áudio local será exibido.');
      initGeolocation();
    });
  } else {
    initGeolocation();
  }
}

function initGeolocation() {
  if (!('geolocation' in navigator)) {
    updateStatus('Geolocalização não disponível neste dispositivo.');
    return;
  }

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
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
      updateStatus(`Sua posição: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}. Distância de ${selectedClient.name}: ${distanceToSelected(coords).toFixed(0)} m.`);
    },
    (err) => {
      updateStatus('Erro ao obter localização: ' + err.message);
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
  );
}

function distanceToSelected(userCoords) {
  return calculateDistance(userCoords.lat, userCoords.lng, selectedClient.lat, selectedClient.lng);
}

function checkProximity(userCoords) {
  const dist = distanceToSelected(userCoords);
  const id = selectedClient.id;

  if (dist <= notifyDistanceMeters && !notifiedClients.has(id)) {
    notifiedClients.add(id);
    const message = `${selectedClient.name}: ${selectedClient.message}`;
    speakMessage(message);
    sendBrowserNotification('Você está próximo ao cliente', message);
    log(`Notificação disparada: ${message}`);
  } else if (dist > notifyDistanceMeters && notifiedClients.has(id)) {
    notifiedClients.delete(id);
    log(`Saiu da zona de proximidade de ${selectedClient.name}.`);
  }
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const rad = (x) => (x * Math.PI) / 180;
  const R = 6371000;
  const dLat = rad(lat2 - lat1);
  const dLn = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLn / 2) * Math.sin(dLn / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function speakMessage(text) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  } else {
    log('SpeechSynthesis não disponível no seu navegador.');
  }
}

function sendBrowserNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  new Notification(title, { body });
}

function updateStatus(message) {
  const status = document.getElementById('status');
  status.textContent = message;
}

function log(message) {
  const logArea = document.getElementById('logArea');
  const li = document.createElement('li');
  const now = new Date().toLocaleTimeString('pt-BR');
  li.textContent = `[${now}] ${message}`;
  logArea.prepend(li);
}

function setupAddClientForm() {
  const form = document.getElementById('addClientForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('clientName').value.trim();
    const lat = parseFloat(document.getElementById('clientLat').value);
    const lng = parseFloat(document.getElementById('clientLng').value);
    const message = document.getElementById('clientMessage').value.trim();

    if (!name || isNaN(lat) || isNaN(lng) || !message) {
      alert('Preencha todos os campos corretamente!');
      return;
    }

    // Adicionar novo cliente
    const newId = Math.max(...clients.map(c => c.id)) + 1;
    const newClient = { id: newId, name, lat, lng, message };
    clients.push(newClient);

    // Limpar formulário
    form.reset();

    // Atualizar interface
    renderClientOptions();
    drawAllClientMarkers();
    log(`Novo local adicionado: ${name}`);

    // Selecionar o novo cliente
    selectedClient = newClient;
    document.getElementById('clientSelect').value = newId;
    updateClientMarker();
  });
}

initMap();

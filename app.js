// CONFIGURACIÓN
const PROXY_URL = 'https://rastreo-yovoy.vercel.app/api/proxy'; 
const UUID_CLIENTE = '5f39c1fe-4bab-4dad-b51d-595fb5edc190';
const LAT_FIJA = '21.88234';
const LNG_FIJA = '-102.29450';

let rutasMap = {};
let markers = [];

// Mapa Leaflet con OpenStreetMap (100% libre, sin API key)
const map = L.map('map').setView([21.88234, -102.29450], 13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// --- 1. Cargar Rutas y Generar Chips ---
function cargarBarraRutas() {
    fetch('rutas_comerciales.json')
        .then(r => r.json())
        .then(data => {
            const contenedor = document.getElementById('chips-rutas');
            const contador = document.getElementById('total-rutas');
            contenedor.innerHTML = '';
            rutasMap = data;
            
            const llaves = Object.keys(rutasMap);
            contador.innerText = `${llaves.length} rutas`;

            llaves.forEach(nombreRuta => {
                const btn = document.createElement('button');
                // APLICAMOS LA CLASE route-chip DEFINIDA EN TU CSS
                btn.className = "route-chip px-4 py-2 text-sm whitespace-nowrap";
                btn.innerText = `Ruta ${nombreRuta}`;
                
                btn.onclick = () => {
                    buscar(nombreRuta);
                    
                    // Manejo de la clase 'active' (Rosa Mexicano)
                    document.querySelectorAll('#chips-rutas button').forEach(b => {
                        b.classList.remove('active');
                    });
                    btn.classList.add('active');
                };
                
                contenedor.appendChild(btn);
            });
        })
        .catch(e => {
            console.error("Error cargando rutas:", e);
            document.getElementById('total-rutas').innerText = 'Error';
        });
}

// --- 2. Lógica de Búsqueda ---
async function buscar(input) {
    const status = document.getElementById('status');
    const carousel = document.getElementById('unit-carousel');
    
    status.textContent = '🔍 Consultando API...';
    carousel.innerHTML = '';

    markers.forEach(m => map.removeLayer(m));
    markers = [];

    let id = rutasMap[input.toUpperCase()];
    if (!id && /^\d+$/.test(input)) id = parseInt(input);

    if (!id) {
        status.textContent = '❌ Ruta no encontrada.';
        return;
    }

    const payloadIda = `10#${UUID_CLIENTE}#0#0#1#${LAT_FIJA}#${LNG_FIJA}#${id}#${LAT_FIJA}#${LNG_FIJA}`;
    const payloadRegreso = `10#${UUID_CLIENTE}#0#0#2#${LAT_FIJA}#${LNG_FIJA}#${id}#${LAT_FIJA}#${LNG_FIJA}`;

    try {
        const [res1, res2] = await Promise.all([
            fetch(PROXY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload: payloadIda }) }),
            fetch(PROXY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload: payloadRegreso }) })
        ]);
        
        const [raw1, raw2] = await Promise.all([res1.text(), res2.text()]);
        const unidades = new Set();
        let bounds = L.latLngBounds(); 

        [raw1, raw2].forEach((raw, idx) => {
            if (!raw || raw.trim().length === 0) return;
            const sentido = idx === 0 ? 'Ida' : 'Regreso';
            try {
                const decoded = atob(raw.trim());
                const clean = decoded.replace(/^\$/, '').replace(/&$/, '');
                if (!clean || !clean.includes('#')) return;

                clean.split('|').slice(0, -1).forEach(bloque => {
                    const campos = bloque.split('#');
                    if (campos.length >= 5) {
                        const eco = (campos[0].replace(/^\$/, '').replace(/^0+/, '') || "0");
                        if (!unidades.has(eco)) {
                            unidades.add(eco);
                            const lat = parseFloat(campos[3]) / 100000;
                            const lon = -Math.abs(parseFloat(campos[4]) / 100000);

                            // Marcador
                            const marker = L.marker([lat, lon]).addTo(map).bindPopup(`<b>N° ${eco}</b><br>${sentido}`);
                            markers.push(marker);
                            bounds.extend([lat, lon]);

                            // Tarjeta Flotante
                            const card = document.createElement('div');
                            card.className = "bg-white rounded-full p-3 shadow-md flex items-center min-w-[140px] border border-gray-100 hover:scale-105 transition-transform cursor-pointer";
                            card.onclick = () => map.setView([lat, lon], 16);
                            
                            card.innerHTML = `
                                <div class="flex flex-col flex-1">
                                    <span class="text-sm font-bold text-purple-700">N° ${eco}</span>
                                    <span class="text-[10px] text-gray-500 mt-0.5">${sentido}</span>
                                </div>
                                <div class="ml-2 bg-purple-50 p-2 rounded-full">
                                    🚌
                                </div>
                            `;
                            carousel.appendChild(card);
                        }
                    }
                });
            } catch (e) { console.error('Decoding error:', e); }
        });

        if (unidades.size > 0) {
            status.textContent = `✅ ${unidades.size} unidades encontradas.`;
            map.invalidateSize();
            map.fitBounds(bounds, { padding: [30, 30] });
        } else {
            status.textContent = '❌ No hay unidades reportando.';
        }

    } catch (error) {
        console.error(error);
        status.textContent = '❌ Error de conexión.';
    }
}

// --- 3. Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
    cargarBarraRutas();
    setTimeout(() => {
        map.invalidateSize();
    }, 200);
});


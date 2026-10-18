// CONFIGURACIÓN
const PROXY_URL = 'https://rastreo-yovoy.vercel.app/api/proxy'; 
const UUID_CLIENTE = '5f39c1fe-4bab-4dad-b51d-595fb5edc190';
const LAT_FIJA = '21.88234';
const LNG_FIJA = '-102.29450';

let rutasMap = {};
let markers = [];

// Mapa Leaflet
const map = L.map('map').setView([21.88, -102.29], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// --- 1. Cargar Rutas y Generar Chips (Tu código mejorado) ---
function cargarBarraRutas() {
    fetch('rutas_comerciales.json')
        .then(response => {
            if (!response.ok) throw new Error('No se pudo cargar rutas_comerciales.json');
            return response.json();
        })
        .then(rutas => {
            const contenedor = document.getElementById('chips-rutas');
            const contador = document.getElementById('total-rutas');
            contenedor.innerHTML = '';
            
            const llaves = Object.keys(rutas);
            rutasMap = rutas; // Guardamos el mapa globalmente
            contador.innerText = `${llaves.length} rutas disponibles`;

            llaves.forEach(nombreRuta => {
                const btn = document.createElement('button');
                btn.className = "px-3 py-1.5 bg-gray-100 hover:bg-blue-600 hover:text-white text-gray-700 text-sm font-semibold rounded-full transition whitespace-nowrap shadow-sm border border-gray-200";
                btn.innerText = `Ruta ${nombreRuta}`;
                
                btn.onclick = () => {
                    // Removemos lo del input porque ya no lo usamos en el HTML actual
                    buscar(nombreRuta); 
                    
                    // Resaltar botón activo
                    document.querySelectorAll('#chips-rutas button').forEach(b => {
                        b.classList.remove('bg-blue-600', 'text-white', 'border-blue-600');
                        b.classList.add('bg-gray-100', 'text-gray-700');
                    });
                    btn.classList.remove('bg-gray-100', 'text-gray-700');
                    btn.classList.add('bg-blue-600', 'text-white', 'border-blue-600');
                };
                
                contenedor.appendChild(btn);
            });
        })
        .catch(error => {
            console.error("Error cargando el catálogo de rutas:", error);
            const contador = document.getElementById('total-rutas');
            if(contador) contador.innerText = 'Error cargando';
        });
}

// --- 2. Lógica de Búsqueda (Unificada con tu estructura) ---
async function buscar(input) {
    const results = document.getElementById('results');
    const status = document.getElementById('status');
    
    if(results) results.innerHTML = '';
    if(status) status.textContent = '🔍 Consultando API...';

    // Limpiar mapa
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    if(markers.length) map.setView([21.88, -102.29], 13);

    let id = rutasMap[input.toUpperCase()];
    if (!id && /^\d+$/.test(input)) id = parseInt(input);

    if (!id) {
        if(status) status.textContent = '❌ Ruta no encontrada.';
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

                            // Mapa
                            const marker = L.marker([lat, lon]).addTo(map).bindPopup(`<b>Unidad #${eco}</b><br>${sentido}`);
                            markers.push(marker);
                            bounds.extend([lat, lon]);

                            // Lista
                            if(results) {
                                const div = document.createElement('div');
                                div.className = "bg-white p-3 rounded border border-gray-200 flex justify-between items-center hover:shadow-md transition";
                                div.innerHTML = `<div><span class="font-bold text-gray-800">Unidad #${eco}</span><span class="text-xs text-blue-600 ml-2">${sentido}</span></div><div class="text-right"><div class="text-sm font-mono text-gray-500">${lat.toFixed(5)}, ${lon.toFixed(5)}</div><a href="https://www.google.com/maps/search/?api=1&query=${lat},${lon}" target="_blank" class="text-xs text-blue-500 mt-1 inline-block hover:underline">Ver mapa</a></div>`;
                                results.appendChild(div);
                            }
                        }
                    }
                });
            } catch (e) { console.error('Decoding error:', e); }
        });

        if (unidades.size > 0) {
            if(status) status.textContent = `✅ Se encontraron ${unidades.size} unidades.`;
            map.fitBounds(bounds);
        } else {
            if(status) status.textContent = '❌ No hay unidades reportando en este momento.';
        }

    } catch (error) {
        console.error(error);
        if(status) status.textContent = '❌ Error de conexión.';
    }
}

// --- 3. Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
    cargarBarraRutas();
});

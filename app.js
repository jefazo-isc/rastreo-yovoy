// CONFIGURACIÓN
const PROXY_URL = 'https://rastreo-yovoy.vercel.app/api/proxy'; 
const UUID_CLIENTE = '5f39c1fe-4bab-4dad-b51d-595fb5edc190';
const LAT_FIJA = '21.88234';
const LNG_FIJA = '-102.29450';

let rutasMap = {};
let markers = [];
let circuitosLayers = {
    Ida: null,
    Regreso: null
};

// Estado actual
let rutaActual = null;
let unidadesActuales = []; // lista de { eco, lat, lon, sentido, bearing }
let filtroSentidoActual = 'Ida'; // 'Ida', 'Regreso', 'Ambos'

// Mapa Leaflet con OpenStreetMap (100% libre, sin API key)
const map = L.map('map').setView([21.88234, -102.29450], 13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Grupos de capas para controlar visibilidad
const layerGroupIda = L.layerGroup().addTo(map);
const layerGroupRegreso = L.layerGroup().addTo(map);

// Función para crear ícono rotado con flecha y color oficial
function crearIconoUnidad(sentido, bearing) {
    const esIda = (sentido === 'Ida');
    const colorBg = esIda ? '#00aeef' : '#e60000'; // Azul para Ida, Rojo para Regreso
    const arrowImg = esIda ? 'arrow_blue.png' : 'arrow_red.png';
    const rotacion = (bearing !== null && bearing !== undefined) ? bearing : 0;

    return L.divIcon({
        className: 'custom-bus-marker',
        html: `
            <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
                <div style="transform: rotate(${rotacion}deg); transition: transform 0.3s ease; position: absolute;">
                    <img src="${arrowImg}" style="width: 32px; height: 32px; filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.4));" />
                </div>
                <div style="width: 14px; height: 14px; background: ${colorBg}; border: 2px solid white; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.5); z-index: 2;"></div>
            </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18]
    });
}

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
                btn.className = "route-chip px-4 py-2 text-sm whitespace-nowrap";
                btn.innerText = `Ruta ${nombreRuta}`;
                
                btn.onclick = () => {
                    buscar(nombreRuta);
                    
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

// --- 2. Lógica de Cambio de Filtro de Sentido ---
function cambiarFiltroSentido(nuevoSentido) {
    filtroSentidoActual = nuevoSentido;

    // Actualizar estilo visual de los botones de sentido
    const btnIda = document.getElementById('btn-dir-ida');
    const btnRegreso = document.getElementById('btn-dir-regreso');
    const btnAmbos = document.getElementById('btn-dir-ambos');

    [btnIda, btnRegreso, btnAmbos].forEach(btn => {
        if (!btn) return;
        btn.className = "px-3 py-1 text-xs font-semibold rounded-full transition-all border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 flex items-center gap-1";
    });

    if (nuevoSentido === 'Ida' && btnIda) {
        btnIda.className = "px-3 py-1 text-xs font-semibold rounded-full transition-all border border-blue-500 bg-blue-500 text-white shadow-sm flex items-center gap-1";
    } else if (nuevoSentido === 'Regreso' && btnRegreso) {
        btnRegreso.className = "px-3 py-1 text-xs font-semibold rounded-full transition-all border border-red-500 bg-red-500 text-white shadow-sm flex items-center gap-1";
    } else if (nuevoSentido === 'Ambos' && btnAmbos) {
        btnAmbos.className = "px-3 py-1 text-xs font-semibold rounded-full transition-all border border-purple-600 bg-purple-600 text-white shadow-sm flex items-center gap-1";
    }

    renderizarElementosMapa();
}

// --- 3. Renderizar Unidades y Trazados en el Mapa y Carrusel ---
let trazadosMap = {};

// Cargar trazados oficiales de circuitos si existen
fetch('trazados_oficiales.json')
    .then(r => r.json())
    .then(data => { trazadosMap = data; })
    .catch(() => {});

// --- 3. Renderizar Unidades y Trazados en el Mapa y Carrusel ---
function renderizarElementosMapa() {
    layerGroupIda.clearLayers();
    layerGroupRegreso.clearLayers();

    const carousel = document.getElementById('unit-carousel');
    carousel.innerHTML = '';

    const unidadesFiltradas = unidadesActuales.filter(u => {
        if (filtroSentidoActual === 'Ambos') return true;
        return u.sentido === filtroSentidoActual;
    });

    let bounds = L.latLngBounds();

    // Dibujar circuito/polilínea oficial continuo si existe
    ['Ida', 'Regreso'].forEach(sentido => {
        if (filtroSentidoActual !== 'Ambos' && filtroSentidoActual !== sentido) return;

        let pts = [];
        if (trazadosMap[rutaActual] && trazadosMap[rutaActual][sentido]) {
            pts = trazadosMap[rutaActual][sentido];
        }

        if (pts.length > 1) {
            const colorPoly = sentido === 'Ida' ? '#00aeef' : '#e60000';
            const polyline = L.polyline(pts, {
                color: colorPoly,
                weight: 5,
                opacity: 0.85,
                lineJoin: 'round'
            });

            if (sentido === 'Ida') {
                layerGroupIda.addLayer(polyline);
            } else {
                layerGroupRegreso.addLayer(polyline);
            }
            bounds.extend(polyline.getBounds());
        }
    });

    // Dibujar marcadores de unidades
    unidadesFiltradas.forEach(u => {
        const markerIcon = crearIconoUnidad(u.sentido, u.bearing);
        const marker = L.marker([u.lat, u.lon], { icon: markerIcon })
            .bindPopup(`
                <div style="text-align: center;">
                    <b style="color: ${u.sentido === 'Ida' ? '#00aeef' : '#e60000'}; font-size: 14px;">Unidad N° ${u.eco}</b><br>
                    <span>Sentido: <b>${u.sentido}</b></span><br>
                    <span style="font-size: 11px; color: #666;">Rumbo: ${u.bearing || 0}°</span>
                </div>
            `);

        if (u.sentido === 'Ida') {
            layerGroupIda.addLayer(marker);
        } else {
            layerGroupRegreso.addLayer(marker);
        }

        bounds.extend([u.lat, u.lon]);

        // Botón circular dentro de la cápsula para alternar sentido
        const colorPill = u.sentido === 'Ida' ? '#00aeef' : '#e60000';
        const card = document.createElement('div');
        card.className = "bg-white rounded-full p-2.5 px-3.5 shadow-md flex items-center gap-2.5 min-w-[155px] border border-gray-100 hover:scale-105 transition-transform cursor-pointer";
        
        card.innerHTML = `
            <div class="flex flex-col flex-1" onclick="map.setView([${u.lat}, ${u.lon}], 16)">
                <span class="text-xs font-black text-gray-800">N° ${u.eco}</span>
                <span class="text-[10px] font-semibold" style="color: ${colorPill};">${u.sentido}</span>
            </div>
            <!-- Botón circular interactivo para alternar sentido -->
            <button title="Cambiar sentido de visualización" onclick="alternarSentidoIndividual(event)" style="background-color: ${colorPill};" class="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-sm hover:opacity-90 active:scale-95 transition-all">
                <img src="${u.sentido === 'Ida' ? 'arrow_blue.png' : 'arrow_red.png'}" style="width: 16px; height: 16px; filter: brightness(0) invert(1);" />
            </button>
        `;

        carousel.appendChild(card);
    });

    if (unidadesFiltradas.length > 0 && bounds.isValid()) {
        map.invalidateSize();
        map.fitBounds(bounds, { padding: [40, 40] });
    }
}

// Alternar cíclicamente: Ida -> Regreso -> Ambos -> Ida
function alternarSentidoIndividual(e) {
    if (e) e.stopPropagation();
    if (filtroSentidoActual === 'Ida') {
        cambiarFiltroSentido('Regreso');
    } else if (filtroSentidoActual === 'Regreso') {
        cambiarFiltroSentido('Ambos');
    } else {
        cambiarFiltroSentido('Ida');
    }
}

// --- 4. Lógica de Consulta a la API ---
async function buscar(input) {
    const status = document.getElementById('status');
    const carousel = document.getElementById('unit-carousel');
    
    rutaActual = input.toUpperCase();
    status.textContent = '🔍 Consultando API de unidades en tiempo real...';
    carousel.innerHTML = '';

    layerGroupIda.clearLayers();
    layerGroupRegreso.clearLayers();
    unidadesActuales = [];

    let id = rutasMap[rutaActual];
    if (!id && /^\d+$/.test(input)) id = parseInt(input);

    if (!id) {
        status.textContent = '❌ Ruta no encontrada en el catálogo.';
        return;
    }

    // Detección de circuitos cerrados (como 40Nte o 40Sur)
    const esCircuitoUnidireccional = (rutaActual.includes('40N') || rutaActual.includes('40S') || rutaActual.includes('20N') || rutaActual.includes('20S'));

    const payloadIda = `10#${UUID_CLIENTE}#0#0#1#${LAT_FIJA}#${LNG_FIJA}#${id}#${LAT_FIJA}#${LNG_FIJA}`;
    const payloadRegreso = `10#${UUID_CLIENTE}#0#0#2#${LAT_FIJA}#${LNG_FIJA}#${id}#${LAT_FIJA}#${LNG_FIJA}`;

    try {
        const peticiones = [
            fetch(PROXY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload: payloadIda }) })
        ];

        // Solo consultamos sentido 2 si no es circuito con ID ya separado
        peticiones.push(
            fetch(PROXY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload: payloadRegreso }) })
        );

        const respuestas = await Promise.all(peticiones);
        const textos = await Promise.all(respuestas.map(r => r.text()));

        const mapaUnidades = new Map();

        textos.forEach((raw, idx) => {
            if (!raw || raw.trim().length === 0) return;
            // Para circuitos como 40Nte o 40Sur, si la API devuelve unidades en ambos canales, se etiquetan correctamente
            const sentido = idx === 0 ? 'Ida' : 'Regreso';

            try {
                const decoded = atob(raw.trim());
                const clean = decoded.replace(/^\$/, '').replace(/&$/, '');
                if (!clean || !clean.includes('#')) return;

                clean.split('|').slice(0, -1).forEach(bloque => {
                    const campos = bloque.split('#');
                    if (campos.length >= 5) {
                        const eco = (campos[0].replace(/^\$/, '').replace(/^0+/, '') || "0");
                        if (!mapaUnidades.has(eco)) {
                            const lat = parseFloat(campos[3]) / 100000;
                            const lon = -Math.abs(parseFloat(campos[4]) / 100000);
                            const bearing = campos.length >= 10 ? parseInt(campos[9]) || 0 : 0;

                            mapaUnidades.set(eco, {
                                eco: eco,
                                lat: lat,
                                lon: lon,
                                sentido: sentido,
                                bearing: bearing
                            });
                        }
                    }
                });
            } catch (e) {
                console.error('Error decodificando Base64:', e);
            }
        });

        unidadesActuales = Array.from(mapaUnidades.values());

        if (unidadesActuales.length > 0) {
            status.textContent = `✅ ${unidadesActuales.length} unidades activas en la Ruta ${rutaActual}.`;
            renderizarElementosMapa();
        } else {
            status.textContent = `❌ No hay unidades reportando en la Ruta ${rutaActual} en este momento.`;
        }

    } catch (error) {
        console.error(error);
        status.textContent = '❌ Error al conectar con el servidor.';
    }
}

// --- 5. Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
    cargarBarraRutas();
    setTimeout(() => {
        map.invalidateSize();
    }, 200);
});

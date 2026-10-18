// =============================================================================
// CONFIGURACIÓN
// =============================================================================

// ⚠️ URL directa de tu Google Apps Script (No concatenar nada extra)
const PROXY_URL = 'https://rastreo-yovoy.vercel.app/api/proxy';

const UUID_CLIENTE = '5f39c1fe-4bab-4dad-b51d-595fb5edc190';
const LAT_FIJA = '21.88234';
const LNG_FIJA = '-102.29450';

// Mapa de rutas (se carga desde rutas_comerciales.json)
let rutasMap = {};

// =============================================================================
// CARGA DE DATOS
// =============================================================================

fetch('rutas_comerciales.json')
    .then(response => {
        if (!response.ok) throw new Error('No se pudo cargar rutas_comerciales.json');
        return response.json();
    })
    .then(data => {
        rutasMap = data;
        console.log('Rutas cargadas:', Object.keys(rutasMap).length);
    })
    .catch(error => {
        console.error('Error cargando rutas:', error);
    });

// =============================================================================
// LÓGICA DE BÚSQUEDA
// =============================================================================

async function buscar(input) {
    const resultsDiv = document.getElementById('results');
    const statusDiv = document.getElementById('status');
    
    // Limpiar interfaz
    resultsDiv.innerHTML = '';
    statusDiv.textContent = '🔍 Consultando API...';

    // 1. Resolver ID de subruta
    let idSubruta = null;
    let nombre = input.toUpperCase().trim();

    if (rutasMap[nombre]) {
        idSubruta = rutasMap[nombre];
    } else if (/^\d+$/.test(nombre)) {
        idSubruta = parseInt(nombre);
    }

    if (idSubruta === null) {
        statusDiv.textContent = '❌ Ruta no encontrada en el mapa.';
        return;
    }

    // 2. Generar payloads
    const payloadIda = `10#${UUID_CLIENTE}#0#0#1#${LAT_FIJA}#${LNG_FIJA}#${idSubruta}#${LAT_FIJA}#${LNG_FIJA}`;
    const payloadRegreso = `10#${UUID_CLIENTE}#0#0#2#${LAT_FIJA}#${LNG_FIJA}#${idSubruta}#${LAT_FIJA}#${LNG_FIJA}`;

    try {
        // 3. Enviar al PROXY (Google Apps Script)
        // ⚠️ NO concatenamos la URL de la API aquí. Enviamos solo el payload.
        const [resIda, resRegreso] = await Promise.all([
            fetch(PROXY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: payloadIda
            }),
            fetch(PROXY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: payloadRegreso
            })
        ]);

        if (!resIda.ok || !resRegreso.ok) {
            throw new Error(`HTTP error! status: ${resIda.status}`);
        }

        // 4. Procesar respuestas
        const [rawIda, rawRegreso] = await Promise.all([resIda.text(), resRegreso.text()]);
        const unidades = new Set();

        [rawIda, rawRegreso].forEach((raw, idx) => {
            if (!raw || raw.trim().length === 0) return;
            
            const sentido = idx === 0 ? "Ida" : "Regreso";

            try {
                const decoded = atob(raw.trim());
                const clean = decoded.replace(/^\$/, '').replace(/&$/, '');

                if (!clean || !clean.includes('#')) return;

                const bloques = clean.split('|');
                
                bloques.forEach((bloque, i) => {
                    if (i === bloques.length - 1) return;

                    const campos = bloque.split('#');
                    
                    if (campos.length >= 5) {
                        let ecoRaw = campos[0].replace(/^\$/, '');
                        const eco = ecoRaw.replace(/^0+/, '') || "0";

                        const lat = parseFloat(campos[3]) / 100000.0;
                        let lon = parseFloat(campos[4]) / 100000.0;
                        lon = -Math.abs(lon);

                        if (!unidades.has(eco)) {
                            unidades.add(eco);
                            agregarTarjeta(eco, lat, lon, sentido);
                        }
                    }
                });
            } catch (e) {
                console.error('Error decodificando respuesta:', e);
            }
        });

        statusDiv.textContent = `✅ Se encontraron ${unidades.size} unidades.`;

    } catch (error) {
        console.error('Error general:', error);
        statusDiv.textContent = `❌ Error: ${error.message}. Verifica CORS o el Proxy.`;
    }
}

// =============================================================================
// INTERFAZ
// =============================================================================

function agregarTarjeta(eco, lat, lon, sentido) {
    const resultsDiv = document.getElementById('results');
    const div = document.createElement('div');
    div.className = "bg-white p-3 rounded border border-gray-200 shadow-sm flex justify-between items-center";
    div.innerHTML = `
        <div class="flex flex-col">
            <span class="font-bold text-gray-800">Unidad #${eco}</span>
            <span class="text-xs text-blue-600 font-medium">${sentido}</span>
        </div>
        <div class="text-right">
            <div class="text-sm font-mono text-gray-500">${lat.toFixed(5)}, ${lon.toFixed(5)}</div>
            <a href="https://www.google.com/maps/search/?api=1&query=${lat},${lon}" target="_blank" class="text-xs text-blue-500 hover:underline">Ver en mapa</a>
        </div>
    `;
    resultsDiv.appendChild(div);
}

// Event Listeners
const input = document.getElementById('rutaInput');
const btn = document.getElementById('buscarBtn');

btn.addEventListener('click', () => {
    if (input.value.trim()) buscar(input.value.trim());
});

input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
        buscar(input.value.trim());
    }
});

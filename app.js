// CONFIGURACIÓN
const PROXY_URL = 'https://rastreo-yovoy.vercel.app/api/proxy'; 
const UUID_CLIENTE = '5f39c1fe-4bab-4dad-b51d-595fb5edc190';
const LAT_FIJA = '21.88234';
const LNG_FIJA = '-102.29450';
let rutasMap = {};

// Cargar rutas
fetch('rutas_comerciales.json')
    .then(r => r.json())
    .then(d => rutasMap = d)
    .catch(e => console.error('Error cargando rutas:', e));

async function buscar(input) {
    const results = document.getElementById('results');
    const status = document.getElementById('status');
    results.innerHTML = '';
    status.textContent = '🔍 Consultando...';

    let id = rutasMap[input.toUpperCase()];
    if (!id && /^\d+$/.test(input)) id = parseInt(input);

    if (!id) {
        status.textContent = '❌ Ruta no encontrada.';
        return;
    }

    // Generar payloads
    const payloadIda = `10#${UUID_CLIENTE}#0#0#1#${LAT_FIJA}#${LNG_FIJA}#${id}#${LAT_FIJA}#${LNG_FIJA}`;
    const payloadRegreso = `10#${UUID_CLIENTE}#0#0#2#${LAT_FIJA}#${LNG_FIJA}#${id}#${LAT_FIJA}#${LNG_FIJA}`;

    try {
        // Enviar JSON al proxy
        const [res1, res2] = await Promise.all([
            fetch(PROXY_URL, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ payload: payloadIda }) 
            }),
            fetch(PROXY_URL, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ payload: payloadRegreso }) 
            })
        ]);

        // Leer texto plano directo (sin .json())
        const raw1 = await res1.text();
        const raw2 = await res2.text();

        const unidades = new Set();

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
                            const div = document.createElement('div');
                            div.className = "bg-white p-3 rounded border border-gray-200 flex justify-between items-center";
                            div.innerHTML = `<div><span class="font-bold">Unidad #${eco}</span><span class="text-xs text-blue-600 ml-2">${sentido}</span></div><div class="text-right"><div class="text-sm font-mono">${lat.toFixed(5)}, ${lon.toFixed(5)}</div><a href="https://www.google.com/maps/search/?api=1&query=${lat},${lon}" target="_blank" class="text-xs text-blue-500">Ver en mapa</a></div>`;
                            results.appendChild(div);
                        }
                    }
                });
            } catch (e) { console.error('Decoding error:', e); }
        });

        status.textContent = `✅ Se encontraron ${unidades.size} unidades.`;

    } catch (error) {
        console.error('Network Error:', error);
        status.textContent = '❌ Error de conexión. Revisa consola.';
    }
}

document.getElementById('buscarBtn').onclick = () => buscar(document.getElementById('rutaInput').value);
document.getElementById('rutaInput').onkeypress = (e) => { if(e.key === 'Enter') buscar(e.target.value); };

// api/proxy.js
export default async function handler(req, res) {
  // 1. Permitir CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // 2. Obtener el payload desde req.body (Vercel parsea JSON automáticamente)
    const payload = req.body?.payload;
    
    if (!payload) {
        return res.status(400).send('No se recibió payload');
    }

    // 3. Petición a la API real
    const API_URL = 'https://ags-qa-stopbus7f9c.nrtec-sys.com/working_units';
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload
    });

    // 4. Devolver texto puro
    const text = await response.text();
    res.status(200).send(text);

  } catch (error) {
    console.error('Proxy error:', error);
    // En caso de error, devolvemos texto plano para que app.js no rompa el JSON
    res.status(500).send('Proxy Error'); 
  }
}

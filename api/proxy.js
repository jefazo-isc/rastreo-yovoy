export default async function handler(req, res) {
  // Habilitar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Recibir payload
    const body = await req.text();
    
    // Petición a API real
    const API_URL = 'https://ags-qa-stopbus7f9c.nrtec-sys.com/working_units';
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body
    });

    // Devolver texto puro directamente
    const text = await response.text();
    res.status(200).send(text);

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).send('Proxy Error');
  }
}

export default async function handler(req, res) {
  // 1. Habilitar CORS explícitamente (lo que GAS no puede hacer)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Si el navegador pregunta "puedes hacer CORS?", responde sí
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. Obtener el payload que envía tu navegador
  const body = await req.text();
  const API_URL = 'https://ags-qa-stopbus7f9c.nrtec-sys.com/working_units';

  // 3. Hacer la petición a la API real (desde el servidor Vercel)
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body
    });

    // 4. Devolver la respuesta tal cual
    const text = await response.text();
    return res.status(200).json({ data: text }); 
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

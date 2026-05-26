export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, imageType } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'Missing image' });

  const mediaType = imageType || 'image/jpeg';
  const year = new Date().getFullYear();

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mediaType};base64,${imageBase64}` }
            },
            {
              type: 'text',
              text: `Du er en kalenderassistent. Analysér dette billede af en vagtplan og udtræk ALLE vagter.

Returner KUN et JSON-array uden forklaring eller markdown:
[{"title":"Dagvagt","date":"${year}-06-03","start":"08:00","end":"16:00"},...]

Regler:
- date skal være YYYY-MM-DD
- Brug år ${year} hvis ikke synligt
- title er vagtens navn — brug "Arbejdsvagt" hvis intet navn
- start og end er HH:MM — udelad hvis ikke synligt
- Returner [] hvis ingen vagter findes`
            }
          ]
        }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'OpenAI fejl' });

    const raw = data.choices?.[0]?.message?.content?.trim() || '[]';
    const cleaned = raw.replace(/```json|```/g, '').trim();

    let events = [];
    try { events = JSON.parse(cleaned); } catch { events = []; }

    return res.status(200).json({ events });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

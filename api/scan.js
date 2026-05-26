export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, imageType, source } = req.body;
  if (!imageBase64 || !imageType) return res.status(400).json({ error: 'Missing image data' });

  const today = new Date();
  const prompt = `Du er en kalenderassistent. Analysér dette billede af en vagtplan og udtræk ALLE vagter du kan se.

Returner KUN et JSON-array (ingen forklaring, ingen markdown, ingen kodeblokke):
[{"title":"Dagvagt","date":"2026-06-03","start":"08:00","end":"16:00"},...]

Regler:
- date skal være YYYY-MM-DD format
- Hvis år mangler, brug ${today.getFullYear()}
- title skal være vagtens navn/type — hvis ingen navn, brug "Arbejdsvagt"
- start og end skal være HH:MM — udelad hvis ikke synlig
- Returner [] hvis ingen vagter findes`;

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
            { type: 'image_url', image_url: { url: `data:${imageType};base64,${imageBase64}` } },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.error?.message || 'OpenAI fejl' });

    const raw = data.choices?.[0]?.message?.content?.trim() || '[]';
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const events = JSON.parse(cleaned);
    return res.status(200).json({ events });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Kun POST tilladt' });
    }

    const { imageBase64, imageType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Mangler billede' });
    }

    // 🔑 OPENAI KEY (sæt i Vercel env)
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: 'Mangler OPENAI_API_KEY' });
    }

    const prompt = `
Du er en ekspert i vagtplaner.

Find ALLE vagter i billedet.

Returner KUN JSON (ingen tekst, ingen markdown):

[
  {
    "title": "Dagvagt",
    "date": "2026-06-03",
    "start": "08:00",
    "end": "16:00"
  }
]

Regler:
- Brug YYYY-MM-DD
- Hvis år mangler → brug 2026
- Hvis tid mangler → null
- Hvis ingen vagter → returner []
`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${imageType};base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error: data.error?.message || "OpenAI fejl"
      });
    }

    // 🧠 AI output tekst
    const text = data.choices?.[0]?.message?.content || "[]";

    // 🔧 clean hvis AI finder på tekst
    let cleaned = text
      .replace(/```json|```/g, '')
      .trim();

    let events;
    try {
      events = JSON.parse(cleaned);
    } catch (e) {
      return res.status(500).json({
        error: "AI returnerede ikke gyldig JSON",
        raw: text
      });
    }

    return res.status(200).json({ events });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

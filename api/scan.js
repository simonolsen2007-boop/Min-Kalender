export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method !== 'POST') {
      return res.status(200).json({ ok: true, message: "API is running" });
    }

    const { imageBase64, imageType } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({ error: "Missing imageBase64" });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: [
            {
              type: "text",
              text: "Læs billedet og returnér JSON vagter."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${imageType};base64,${imageBase64}`
              }
            }
          ]
        }]
      })
    });

    const data = await response.json();

    const raw = data.choices?.[0]?.message?.content || "[]";

    let events;
    try {
      events = JSON.parse(raw);
    } catch (e) {
      return res.status(200).json({ events: [] });
    }

    return res.status(200).json({ events });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

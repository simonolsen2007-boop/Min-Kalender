export default async function handler(req, res) {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Missing image" });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Find alle vagter i dette billede. Returner KUN JSON array med: title, date (YYYY-MM-DD), start, end"
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        temperature: 0
      })
    });

    const data = await response.json();

    const text = data.choices?.[0]?.message?.content || "[]";

    let events;
    try {
      events = JSON.parse(text);
    } catch {
      events = [];
    }

    return res.status(200).json({ events });

  } catch (err) {
    return res.status(500).json({
      error: err.message || "Server error"
    });
  }
}

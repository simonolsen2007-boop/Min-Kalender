export default async function handler(req, res) {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Missing image" });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text:
                  "Find alle vagter i billedet. Returnér KUN JSON array med title, date (YYYY-MM-DD), start, end."
              },
              {
                type: "input_image",
                image_base64: imageBase64
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();

    const text =
      data.output?.[0]?.content?.[0]?.text ||
      "[]";

    let events = [];

    try {
      events = JSON.parse(text);
    } catch {
      events = [];
    }

    return res.status(200).json({ events });

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
}

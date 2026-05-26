import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  try {
    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "No image" });
    }

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Udtræk vagter fra billedet. Returnér KUN JSON array: [{title,date,start,end}]. Brug YYYY-MM-DD og HH:MM."
            },
            {
              type: "input_image",
              image_url: `data:image/jpeg;base64,${imageBase64}`
            }
          ]
        }
      ]
    });

    const text = response.output_text;

    return res.status(200).json({
      events: JSON.parse(text)
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

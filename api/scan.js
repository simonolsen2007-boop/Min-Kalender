export default async function handler(req, res) {
  try {
    const { imageBase64, imageType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "Missing image" });
    }

    // TEST RESPONSE (midlertidigt)
    // (så vi ved API virker før AI)
    return res.status(200).json({
      events: [
        {
          title: "Test vagt",
          date: "2026-06-03",
          start: "08:00",
          end: "16:00"
        }
      ]
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message || "Server error"
    });
  }
}

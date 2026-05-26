export default function handler(req, res) {
  res.status(200).json({
    events: [
      {
        title: "Test vagt",
        date: "2026-06-03",
        start: "08:00",
        end: "16:00"
      }
    ]
  });
}

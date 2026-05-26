# 🗓 KalenderAI

> Add appointments automatically — via text, photo, or voice. Free. No login. Works on any smartphone.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-romanigor.github.io%2FKalenderAI-orange?style=for-the-badge)](https://romanigor.github.io/KalenderAI/)

---

## ✨ What it does

KalenderAI uses AI to extract dates, times, and locations from anything you give it — and adds them to your calendar with one tap. No more manual typing.

| Input | Example |
|---|---|
| ✏️ Text | "Team meeting Thursday May 15 at 2pm in the conference room" |
| 📷 Photo | Photograph an invitation, ticket, flyer, or handwritten note |
| 🎙️ Voice | Say the appointment out loud — Whisper transcribes it precisely |

---

## 🚀 Live Demo

👉 **[romanigor.github.io/KalenderAI](https://romanigor.github.io/KalenderAI/)**

No login. No installation. No API key needed. Just open and use.

---

## 📅 Supported Calendars

| Calendar | Method |
|---|---|
| 🗓 Google Calendar | Opens directly in browser |
| 📘 Outlook / Microsoft | Opens directly in browser |
| 📱 Samsung Calendar | Downloads ICS — Android opens automatically |
| 📥 Other (Apple, Thunderbird...) | ICS file download |

---

## 📱 Features

- 🤖 **AI-powered extraction** — understands natural language in any language
- 📷 **Vision support** — reads text from photos using Llama 4 Scout
- 🎙️ **Voice input** — Whisper Large V3 transcribes with high accuracy
- 📅 **Multiple calendars** — Google, Outlook, Samsung, ICS
- ✏️ **Edit before saving** — review and adjust every detail
- 🌙☀️ **Dark / Light mode**
- 📲 **PWA** — installable as native app on Android
- 🔒 **Privacy first** — no accounts, no tracking, no data stored

---

## 🛠 Tech Stack

- **Frontend:** Vanilla HTML, CSS, JavaScript — zero dependencies
- **Backend:** Node.js on Render.com
- **AI (Text/Voice):** Groq · `llama-3.3-70b-versatile`
- **AI (Photos):** Groq · `meta-llama/llama-4-scout-17b-16e-instruct`
- **Voice:** Groq Whisper · `whisper-large-v3`
- **Hosting:** GitHub Pages (frontend) + Render.com (backend)

---

## 🔒 Privacy & GDPR

- No user data is stored — only anonymous request counts per day
- No tracking, no analytics, no accounts required
- All AI processing goes through a secure backend proxy
- Fully GDPR compliant

---

## 📄 License

MIT — free to use, modify, and share.

# 🧠 MeetingBrain

> Turn any meeting transcript into instant action — summaries, tasks, decisions, mood analysis & follow-up emails in seconds.

Built in 48 hours at a hackathon using React + Groq AI (LLaMA 3.3 70B).

---

## ✨ Features

- 🧠 **Smart Summary** — 2-3 sentence overview of any meeting
- ✅ **Action Items** — Every task automatically extracted
- ⚡ **Key Decisions** — What was agreed on, crystal clear
- 😊 **Team Mood Meter** — Sentiment score with visual indicator
- 📧 **Follow-up Email Draft** — Ready-to-send email in one click
- 🕐 **Meeting History** — Last 10 meetings saved in browser
- 📄 **PDF Export** — Download the full report instantly

---

## 🚀 Getting Started

### Prerequisites
- Node.js 16+
- Free Groq API key from [console.groq.com](https://console.groq.com)

### Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/meeting-brain
cd meeting-brain

# Install dependencies
npm install

# Create your .env file
echo "REACT_APP_GROQ_KEY=your_groq_key_here" > .env

# Start the app
npm start
```

Open [http://localhost:3000](http://localhost:3000) to use the app.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| React.js | Frontend UI |
| Groq API (LLaMA 3.3 70B) | AI analysis |
| jsPDF | PDF export |
| localStorage | Meeting history |

---

## 💡 How to Use

1. Paste your meeting transcript into the input box
2. Click **⚡ Analyze Meeting**
3. Get instant summary, action items, decisions, mood score & email draft
4. Export as PDF or copy the email draft
5. Access past meetings from the history panel

---

## 🏗️ Project Structure

```
src/
├── App.js       # Main app logic + API calls
├── App.css      # All styles
└── index.js     # Entry point
```

---

## 🔑 Environment Variables

| Variable | Description |
|---|---|
| `REACT_APP_GROQ_KEY` | Your Groq API key |

---

## 📸 Demo

Paste this sample transcript to try it out:

```
Alex (PM): Good morning everyone. Let's start Q4 planning.
Priya (Design): I've completed user research. 60% of users drop off at onboarding step 3.
Alex: That's a big problem. We need to fix that before the next release.
Priya: I can redesign onboarding by next Wednesday.
Alex: Approved. Raj, how long to implement?
Raj (Dev): 3 days after designs are ready.
Alex: Perfect. Beta launch confirmed for November 15th.
```

---

## 🙏 Acknowledgements

- [Groq](https://groq.com) for the blazing fast free LLM API
- [Meta](https://ai.meta.com) for the LLaMA 3.3 model
- Built with ❤️ at a hackathon

---

## 📄 License

MIT
import React, { useState, useEffect } from 'react';
import './App.css';
import { jsPDF } from 'jspdf';

const ICONS = {
  summary: '🧠',
  actions: '✅',
  decisions: '⚡',
  email: '📧',
};

function App() {
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState([]);

  // Load history from localStorage on startup
  useEffect(() => {
    const saved = localStorage.getItem('meetingHistory');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const saveToHistory = (transcript, results) => {
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      preview: transcript.slice(0, 60) + '...',
      results,
    };
    const updated = [newEntry, ...history].slice(0, 10); // keep last 10
    setHistory(updated);
    localStorage.setItem('meetingHistory', JSON.stringify(updated));
  };

  const deleteFromHistory = (e, id) => {
    e.stopPropagation();
    const updated = history.filter((h) => h.id !== id);
    setHistory(updated);
    localStorage.setItem('meetingHistory', JSON.stringify(updated));
  };

  const loadFromHistory = (entry) => {
    setResults(entry.results);
    setTranscript(entry.preview);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const analyzeMeeting = async () => {
    if (!transcript.trim()) return;
    setLoading(true);
    setError('');
    setResults(null);

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_GROQ_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 2000,
          messages: [
            {
              role: 'user',
              content: `You are a meeting intelligence assistant. Analyze this meeting transcript and respond ONLY with a valid JSON object, no extra text, no markdown.

Transcript:
"""
${transcript}
"""

Respond with exactly this JSON structure:
{
  "summary": "2-3 sentence overview of the meeting",
  "actionItems": ["action item 1", "action item 2", "action item 3"],
  "decisions": ["decision 1", "decision 2"],
  "emailDraft": "A professional follow-up email based on the meeting",
  "sentiment": {
    "overall": "positive or neutral or negative",
    "score": a number between 0 and 100,
    "mood": "one emoji that best represents the meeting mood",
    "insight": "one sentence about the team energy and tone"
  }
}`,
            },
          ],
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'API call failed');

      const text = data.choices[0].message.content;
      const clean = text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      setResults(parsed);
      saveToHistory(transcript, parsed);
    } catch (err) {
      setError('Something went wrong: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyEmail = () => {
    navigator.clipboard.writeText(results.emailDraft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const lineHeight = 7;
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth() - margin * 2;
    let y = 20;
  
    const addText = (text, fontSize = 11, isBold = false) => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      const lines = doc.splitTextToSize(text, pageWidth);
      lines.forEach((line) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(line, margin, y);
        y += lineHeight;
      });
      y += 2;
    };
  
    // Title
    doc.setTextColor(100, 80, 220);
    addText('MeetingBrain — Analysis Report', 18, true);
    doc.setTextColor(0, 0, 0);
    addText(`Generated: ${new Date().toLocaleString()}`, 9);
    y += 4;
  
    // Summary
    doc.setTextColor(100, 80, 220);
    addText('SUMMARY', 11, true);
    doc.setTextColor(50, 50, 50);
    addText(results.summary);
    y += 4;
  
    // Action Items
    doc.setTextColor(34, 197, 94);
    addText('ACTION ITEMS', 11, true);
    doc.setTextColor(50, 50, 50);
    results.actionItems.forEach((item, i) => addText(`${i + 1}. ${item}`));
    y += 4;
  
    // Decisions
    doc.setTextColor(245, 158, 11);
    addText('KEY DECISIONS', 11, true);
    doc.setTextColor(50, 50, 50);
    results.decisions.forEach((d, i) => addText(`${i + 1}. ${d}`));
    y += 4;
  
    // Sentiment
    if (results.sentiment) {
      doc.setTextColor(244, 114, 182);
      addText('TEAM MOOD', 11, true);
      doc.setTextColor(50, 50, 50);
      addText(`Overall: ${results.sentiment.overall} (Score: ${results.sentiment.score}/100)`);
      addText(results.sentiment.insight);
      y += 4;
    }
  
    // Email
    doc.setTextColor(96, 165, 250);
    addText('FOLLOW-UP EMAIL DRAFT', 11, true);
    doc.setTextColor(50, 50, 50);
    addText(results.emailDraft);
  
    doc.save('meeting-report.pdf');
  };

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <h1>🧠 MeetingBrain</h1>
        <p>Paste your meeting transcript and get instant insights</p>
      </div>

      {/* History */}
      <div className="history-section">
        <h2>🕐 Recent Meetings</h2>
        {history.length === 0 ? (
          <div className="no-history">No meetings analyzed yet — paste a transcript below!</div>
        ) : (
          <div className="history-list">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="history-item"
                onClick={() => loadFromHistory(entry)}
              >
                <div className="history-item-left">
                  <h4>{entry.date}</h4>
                  <p>{entry.preview}</p>
                </div>
                <div className="history-item-right">
                  <span className="history-mood">{entry.results.sentiment?.mood}</span>
                  <button className="delete-btn" onClick={(e) => deleteFromHistory(e, entry.id)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="input-panel">
        <h2>📋 Meeting Transcript</h2>
        <textarea
          placeholder="Paste your meeting transcript here..."
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
        />
      </div>

      {/* Button */}
      <button
        className="analyze-btn"
        onClick={analyzeMeeting}
        disabled={loading || !transcript.trim()}
      >
        {loading ? 'Analyzing...' : '⚡ Analyze Meeting'}
      </button>

      {/* Loading */}
      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Extracting insights from your meeting...</p>
        </div>
      )}

      {/* Error */}
      {error && <div className="error">{error}</div>}

      {/* Results */}
      {results && (
        <div className="results">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
            <button className="copy-btn" onClick={exportPDF} style={{ fontSize: '0.95rem', padding: '10px 20px' }}>
              📄 Export as PDF
            </button>
          </div>
          <div className="result-card summary">
            <h3>{ICONS.summary} Summary</h3>
            <p>{results.summary}</p>
          </div>

          <div className="result-card actions">
            <h3>{ICONS.actions} Action Items</h3>
            <ul>
              {results.actionItems.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="result-card decisions">
            <h3>{ICONS.decisions} Key Decisions</h3>
            <ul>
              {results.decisions.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>

          {results.sentiment && (
            <div className="result-card sentiment">
              <h3>😊 Team Mood Meter</h3>
              <div className="mood-meter">
                <div className="mood-emoji">{results.sentiment.mood}</div>
                <div className="mood-meter-bar-bg">
                  <div
                    className="mood-meter-bar-fill"
                    style={{
                      width: `${results.sentiment.score}%`,
                      background: results.sentiment.score >= 60
                        ? 'linear-gradient(90deg, #34d399, #6ee7b7)'
                        : results.sentiment.score >= 40
                        ? 'linear-gradient(90deg, #f59e0b, #fcd34d)'
                        : 'linear-gradient(90deg, #f87171, #fca5a5)',
                    }}
                  />
                </div>
                <div className="mood-labels">
                  <span>😤 Negative</span>
                  <span>😐 Neutral</span>
                  <span>😄 Positive</span>
                </div>
                <div className="mood-score">Score: {results.sentiment.score}/100</div>
              </div>
              <p className="mood-insight">"{results.sentiment.insight}"</p>
            </div>
          )}

          <div className="result-card email">
            <h3>{ICONS.email} Follow-up Email Draft</h3>
            <div className="email-body">{results.emailDraft}</div>
            <button className="copy-btn" onClick={copyEmail}>
              {copied ? '✅ Copied!' : '📋 Copy Email'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
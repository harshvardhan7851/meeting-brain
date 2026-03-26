import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import './App.css';

const GROQ_KEY = process.env.REACT_APP_GROQ_KEY;

const ICONS = {
  summary: '🧠',
  actions: '✅',
  decisions: '⚡',
  email: '📧',
};

function App() {
  const [activeTab, setActiveTab] = useState('text'); // 'text' or 'audio'
  const [manualTranscript, setManualTranscript] = useState('');
  const [audioTranscript, setAudioTranscript] = useState('');
  const [audioFile, setAudioFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem('meetingHistory');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const saveToHistory = (transcriptText, results) => {
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString(),
      preview: transcriptText.slice(0, 60) + '...',
      results,
    };
    const updated = [newEntry, ...history].slice(0, 10);
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
    setManualTranscript(entry.preview);
    setActiveTab('text');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Audio Handlers ──────────────────────────────────────────────────────────
  const handleFileChange = (file) => {
    if (!file) return;
    const allowed = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/mp4',
                     'audio/m4a', 'audio/ogg', 'audio/webm', 'video/mp4'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|ogg|webm|mp4)$/i)) {
      setError('Please upload an audio file (MP3, WAV, M4A, OGG, WebM)');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError('File too large. Max size is 25MB.');
      return;
    }
    setError('');
    setAudioFile(file);
    setAudioTranscript('');
    setResults(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    handleFileChange(file);
  };

  const transcribeAudio = async (file) => {
    setTranscribing(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('model', 'whisper-large-v3');
      formData.append('response_format', 'text');

      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_KEY}` },
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Transcription failed');
      }

      const text = await response.text();
      return text.trim();
    } finally {
      setTranscribing(false);
    }
  };

  // ── Main Analyze ────────────────────────────────────────────────────────────
  const analyzeMeeting = async () => {
    setLoading(true);
    setError('');
    setResults(null);

    try {
      let finalTranscript = activeTab === 'text' ? manualTranscript : audioTranscript;

      // If audio tab, transcribe first (but don't overwrite the manual textarea)
      if (activeTab === 'audio' && audioFile && !finalTranscript.trim()) {
        finalTranscript = await transcribeAudio(audioFile);
        setAudioTranscript(finalTranscript);
      }

      if (!finalTranscript.trim()) {
        setError('No transcript to analyze.');
        setLoading(false);
        return;
      }

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_KEY}`,
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
${finalTranscript}
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
      saveToHistory(finalTranscript, parsed);
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

    doc.setTextColor(100, 80, 220);
    addText('MeetingBrain — Analysis Report', 18, true);
    doc.setTextColor(0, 0, 0);
    addText(`Generated: ${new Date().toLocaleString()}`, 9);
    y += 4;

    doc.setTextColor(100, 80, 220);
    addText('SUMMARY', 11, true);
    doc.setTextColor(50, 50, 50);
    addText(results.summary);
    y += 4;

    doc.setTextColor(34, 197, 94);
    addText('ACTION ITEMS', 11, true);
    doc.setTextColor(50, 50, 50);
    results.actionItems.forEach((item, i) => addText(`${i + 1}. ${item}`));
    y += 4;

    doc.setTextColor(245, 158, 11);
    addText('KEY DECISIONS', 11, true);
    doc.setTextColor(50, 50, 50);
    results.decisions.forEach((d, i) => addText(`${i + 1}. ${d}`));
    y += 4;

    if (results.sentiment) {
      doc.setTextColor(244, 114, 182);
      addText('TEAM MOOD', 11, true);
      doc.setTextColor(50, 50, 50);
      addText(`Overall: ${results.sentiment.overall} (Score: ${results.sentiment.score}/100)`);
      addText(results.sentiment.insight);
      y += 4;
    }

    doc.setTextColor(96, 165, 250);
    addText('FOLLOW-UP EMAIL DRAFT', 11, true);
    doc.setTextColor(50, 50, 50);
    addText(results.emailDraft);

    doc.save('meeting-report.pdf');
  };

  const canAnalyze = activeTab === 'text'
    ? manualTranscript.trim().length > 0
    : audioFile !== null;

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <h1>🧠 MeetingBrain</h1>
        <p>Paste a transcript or upload audio — get instant meeting insights</p>
      </div>

      {/* History */}
      <div className="history-section">
        <h2>🕐 Recent Meetings</h2>
        {history.length === 0 ? (
          <div className="no-history">No meetings analyzed yet — try it below!</div>
        ) : (
          <div className="history-list">
            {history.map((entry) => (
              <div key={entry.id} className="history-item" onClick={() => loadFromHistory(entry)}>
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

      {/* Input Panel */}
      <div className="input-panel">
        <h2>📋 Meeting Input</h2>

        {/* Tabs */}
        <div className="input-tabs">
          <button
            className={`tab-btn ${activeTab === 'text' ? 'active' : ''}`}
            onClick={() => setActiveTab('text')}
          >
            📝 Paste Transcript
          </button>
          <button
            className={`tab-btn ${activeTab === 'audio' ? 'active' : ''}`}
            onClick={() => setActiveTab('audio')}
          >
            🎙️ Upload Audio
          </button>
        </div>

        {/* Text Tab */}
        {activeTab === 'text' && (
          <textarea
            placeholder="Paste your meeting transcript here..."
            value={manualTranscript}
            onChange={(e) => setManualTranscript(e.target.value)}
          />
        )}

        {/* Audio Tab */}
        {activeTab === 'audio' && (
          <>
            {!audioFile ? (
              <div
                className={`audio-upload-area ${dragging ? 'dragging' : ''}`}
                onClick={() => fileInputRef.current.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <div className="upload-icon">🎙️</div>
                <div className="upload-title">Drop your audio file here</div>
                <p>or click to browse</p>
                <p>MP3, WAV, M4A, OGG, WebM — max 25MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileChange(e.target.files[0])}
                />
              </div>
            ) : (
              <>
                <div className="audio-file-selected">
                  <span style={{ fontSize: '2rem' }}>🎵</span>
                  <div className="file-info">
                    <div className="file-name">{audioFile.name}</div>
                    <div className="file-size">{(audioFile.size / 1024 / 1024).toFixed(2)} MB</div>
                  </div>
                  <button
                    className="remove-file-btn"
                    onClick={() => {
                      setAudioFile(null);
                      setAudioTranscript('');
                    }}
                  >
                    Remove
                  </button>
                </div>

                {audioTranscript.trim().length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h3 style={{ margin: 0, fontSize: '1rem', color: '#c7c7d6' }}>Transcript (from audio)</h3>
                      <button
                        className="copy-btn"
                        onClick={() => {
                          setManualTranscript(audioTranscript);
                          setActiveTab('text');
                        }}
                        style={{ fontSize: '0.9rem', padding: '8px 12px' }}
                      >
                        📝 Edit in text tab
                      </button>
                    </div>
                    <textarea
                      value={audioTranscript}
                      readOnly
                      style={{ minHeight: '160px' }}
                    />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Transcribing status */}
      {transcribing && (
        <div className="transcribing-status">
          <div className="spinner"></div>
          Transcribing audio with Whisper AI...
        </div>
      )}

      {/* Analyze Button */}
      <button
        className="analyze-btn"
        onClick={analyzeMeeting}
        disabled={loading || transcribing || !canAnalyze}
      >
        {transcribing
          ? 'Transcribing...'
          : loading
          ? 'Analyzing...'
          : activeTab === 'audio'
          ? '⚡ Transcribe & Analyze'
          : '⚡ Analyze Meeting'}
      </button>

      {/* Loading */}
      {loading && !transcribing && (
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
            <ul>{results.actionItems.map((item, i) => <li key={i}>{item}</li>)}</ul>
          </div>

          <div className="result-card decisions">
            <h3>{ICONS.decisions} Key Decisions</h3>
            <ul>{results.decisions.map((d, i) => <li key={i}>{d}</li>)}</ul>
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
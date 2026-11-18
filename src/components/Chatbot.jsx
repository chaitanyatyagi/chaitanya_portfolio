import { useState, useRef, useEffect } from 'react';
import { theme as t } from '../data.js';
import { useContent } from '../ContentContext.jsx';
import Reveal from './Reveal.jsx';
import { SectionHeader } from './ui.jsx';

export default function Chatbot() {
  const { chatbot } = useContent();
  const comingSoon = !!chatbot.comingSoon;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  const allMessages = [{ role: 'assistant', content: chatbot.greeting }, ...messages];

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  async function ask(question) {
    if (comingSoon) return;
    const q = (question || '').trim();
    if (!q || loading) return;

    const history = [...messages, { role: 'user', content: q }];
    setMessages(history);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'assistant', content: chatbot.greeting }, ...history]
            .filter((m) => m.role === 'user' || m.role === 'assistant')
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      const data = await res.json();
      setMessages([...history, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setMessages([
        ...history,
        { role: 'assistant', content: "Sorry — I couldn't reach the model just now. Please try again in a moment." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const bubbleBase = {
    maxWidth: '78%', padding: '13px 17px', fontSize: 14.5, lineHeight: 1.6,
    borderRadius: 14, whiteSpace: 'pre-wrap',
  };

  return (
    <section id="chatbot" style={{ padding: '84px var(--px)', maxWidth: 1180, margin: '0 auto' }}>
      <Reveal>
        <SectionHeader
          kicker={chatbot.kicker}
          no="07"
          center
          heading={chatbot.heading}
          description={chatbot.description}
          after={comingSoon && chatbot.badge ? (
            <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.faint, background: '#fff', border: `1px solid ${t.line}`, padding: '4px 10px', borderRadius: 20 }}>{chatbot.badge}</span>
          ) : null}
        />
      </Reveal>

      <Reveal delay={120}>
        <div style={{ maxWidth: 820, margin: '0 auto', border: `1px solid ${t.line}`, borderRadius: 18, background: '#fff', overflow: 'hidden', boxShadow: '0 20px 50px -30px rgba(26,23,20,.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderBottom: `1px solid ${t.line}`, background: t.bg }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: comingSoon ? t.fainter : t.accent, animation: comingSoon ? 'none' : 'pulseDot 2s ease-in-out infinite' }} />
            <span style={{ fontFamily: t.fontMono, fontSize: 12.5, color: '#4a453e' }}>{chatbot.statusText}</span>
            <span style={{ marginLeft: 'auto', fontFamily: t.fontMono, fontSize: 11, color: t.fainter }}>{chatbot.poweredBy}</span>
          </div>

          <div ref={scrollRef} style={{ height: comingSoon ? 170 : 400, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {allMessages.map((m, i) => {
              const isUser = m.role === 'user';
              return (
                <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    ...bubbleBase,
                    ...(isUser
                      ? { background: t.ink, color: t.bg, borderBottomRightRadius: 4 }
                      : { background: t.bg, color: '#2a251f', border: `1px solid ${t.line}`, borderBottomLeftRadius: 4 }),
                  }}>
                    {m.content}
                  </div>
                </div>
              );
            })}
            {loading && (
              <div style={{ alignSelf: 'flex-start', fontFamily: t.fontMono, fontSize: 12.5, color: t.fainter }}>
                thinking<span style={{ animation: 'pulseDot 1s infinite' }}>…</span>
              </div>
            )}
          </div>

          <div style={{ padding: '16px 20px', borderTop: `1px solid ${t.line}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(chatbot.suggestions || []).map((s) => (
                <button
                  key={s.label}
                  onClick={() => ask(s.q)}
                  disabled={comingSoon}
                  className={comingSoon ? undefined : 'chip-lift'}
                  style={{ fontFamily: t.fontMono, fontSize: 11.5, color: '#4a453e', background: t.bg, border: `1px solid ${t.line}`, padding: '6px 12px', borderRadius: 20, cursor: comingSoon ? 'default' : 'pointer', opacity: comingSoon ? 0.55 : 1 }}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                value={input}
                disabled={comingSoon}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); ask(input); } }}
                placeholder={comingSoon ? 'The assistant is in training — launching soon.' : chatbot.placeholder}
                style={{ flex: 1, minWidth: 0, fontFamily: t.fontBody, fontSize: 15, padding: '13px 16px', border: '1px solid #d8d2c6', borderRadius: 11, outline: 'none', background: t.bg, opacity: comingSoon ? 0.65 : 1 }}
              />
              <button
                onClick={() => ask(input)}
                disabled={comingSoon}
                style={{ fontFamily: t.fontBody, fontSize: 15, fontWeight: 500, color: t.bg, background: t.ink, border: 'none', padding: '13px 22px', borderRadius: 11, cursor: comingSoon ? 'default' : 'pointer', opacity: comingSoon ? 0.55 : 1 }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

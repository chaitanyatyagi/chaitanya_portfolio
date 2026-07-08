import { useEffect, useMemo, useState } from 'react';
import { theme as t } from '../data.js';
import { useContent } from '../ContentContext.jsx';
import Reveal from './Reveal.jsx';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_HEADS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const pad = (n) => String(n).padStart(2, '0');
const dateKey = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

export default function Scheduler() {
  const { scheduler } = useContent();
  const slots = scheduler.slots || [];
  const availableWeekdays = scheduler.availableWeekdays || [1, 2, 3, 4, 5];

  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [booked, setBooked] = useState({}); // { 'YYYY-MM-DD': [times] }
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', topic: '' });
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  // Fetch booked slots whenever the visible month changes.
  useEffect(() => {
    let alive = true;
    fetch(`/api/booked?month=${view.y}-${pad(view.m + 1)}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((map) => { if (alive) setBooked(map || {}); })
      .catch(() => {});
    return () => { alive = false; };
  }, [view]);

  const isCurrentMonth = view.y === today.getFullYear() && view.m === today.getMonth();

  function shiftMonth(delta) {
    setView(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
    setSelectedDate(null);
    setSelectedSlot(null);
    setStatus(null);
  }

  function dayInfo(d) {
    const key = dateKey(view.y, view.m, d);
    const date = new Date(view.y, view.m, d);
    const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1); // today + past not bookable
    const weekdayOk = availableWeekdays.includes(date.getDay());
    const fullyBooked = (booked[key] || []).length >= slots.length && slots.length > 0;
    return { key, bookable: !isPast && weekdayOk && !fullyBooked };
  }

  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const leadingBlanks = new Date(view.y, view.m, 1).getDay();

  async function confirmBooking() {
    if (busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const slot = slots.find((s) => s.time === selectedSlot);
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, email: form.email, topic: form.topic,
          date: selectedDate, time: selectedSlot, duration: slot?.dur || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Booking failed — try again.');
      setStatus({ ok: true, message: data.message });
      setBooked((prev) => ({ ...prev, [selectedDate]: [...(prev[selectedDate] || []), selectedSlot] }));
      setSelectedSlot(null);
      setForm({ name: '', email: '', topic: '' });
    } catch (err) {
      setStatus({ ok: false, message: err.message });
    } finally {
      setBusy(false);
    }
  }

  const cellBase = { textAlign: 'center', fontSize: 13, padding: '9px 0', borderRadius: 8 };
  const inputStyle = {
    fontFamily: t.fontBody, fontSize: 14, padding: '11px 14px', borderRadius: 9,
    border: `1px solid ${t.darkLine}`, background: '#1d1915', color: t.bg, outline: 'none', width: '100%',
  };

  const selectedDayLabel = selectedDate
    ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()
    : null;

  return (
    <section id="connect" style={{ background: t.ink, color: t.bg, padding: '84px var(--px)' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <Reveal>
          <div style={{ fontFamily: t.fontMono, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: t.accent, marginBottom: 16 }}>// 1:1 connect</div>
          <h2 style={{ fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 34, letterSpacing: '-.02em', margin: '0 0 12px' }}>
            {scheduler.heading}
          </h2>
          <p style={{ fontSize: 16, color: '#a9a296', margin: '0 0 40px', maxWidth: '56ch' }}>
            {scheduler.description}
          </p>
        </Reveal>
        <div className="grid-collapse" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20 }}>
          {/* Calendar */}
          <Reveal>
            <div style={{ background: t.darkPanel, border: `1px solid ${t.darkLine}`, borderRadius: 16, padding: 28, height: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <span style={{ fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 17 }}>
                  {MONTHS[view.m]} {view.y}
                </span>
                <span style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => shiftMonth(-1)}
                    disabled={isCurrentMonth}
                    aria-label="Previous month"
                    style={{ fontFamily: t.fontMono, fontSize: 14, color: isCurrentMonth ? '#453f37' : '#c9c2b6', background: 'transparent', border: `1px solid ${t.darkLine}`, borderRadius: 8, width: 32, height: 32, cursor: isCurrentMonth ? 'default' : 'pointer' }}
                  >‹</button>
                  <button
                    onClick={() => shiftMonth(1)}
                    aria-label="Next month"
                    style={{ fontFamily: t.fontMono, fontSize: 14, color: '#c9c2b6', background: 'transparent', border: `1px solid ${t.darkLine}`, borderRadius: 8, width: 32, height: 32, cursor: 'pointer' }}
                  >›</button>
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 6 }}>
                {DAY_HEADS.map((h, i) => (
                  <div key={`h${i}`} style={{ textAlign: 'center', fontFamily: t.fontMono, fontSize: 11, color: '#6b655c', padding: '6px 0' }}>{h}</div>
                ))}
                {Array.from({ length: leadingBlanks }, (_, i) => <div key={`b${i}`} />)}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const d = i + 1;
                  const { key, bookable } = dayInfo(d);
                  const isSelected = selectedDate === key;
                  const style = isSelected
                    ? { ...cellBase, color: t.ink, background: t.accent, fontWeight: 600, cursor: 'pointer' }
                    : bookable
                      ? { ...cellBase, color: t.bg, border: '1px solid #4a3a2e', cursor: 'pointer', transition: 'border-color .15s' }
                      : { ...cellBase, color: '#6b655c' };
                  return (
                    <div
                      key={key}
                      style={style}
                      onClick={() => { if (bookable) { setSelectedDate(key); setSelectedSlot(null); setStatus(null); } }}
                      onMouseOver={(e) => { if (bookable && !isSelected) e.currentTarget.style.borderColor = t.accent; }}
                      onMouseOut={(e) => { if (bookable && !isSelected) e.currentTarget.style.borderColor = '#4a3a2e'; }}
                    >
                      {d}
                    </div>
                  );
                })}
              </div>
            </div>
          </Reveal>

          {/* Slots + booking form */}
          <Reveal delay={120}>
            <div style={{ background: t.darkPanel, border: `1px solid ${t.darkLine}`, borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ fontFamily: t.fontMono, fontSize: 11, color: '#6b655c', marginBottom: 16 }}>
                {selectedDate ? `AVAILABLE SLOTS · ${selectedDayLabel}` : 'PICK A DATE TO SEE SLOTS'}
              </div>

              {!selectedDate && (
                <div style={{ color: '#a9a296', fontSize: 14, lineHeight: 1.6 }}>
                  Highlighted days on the calendar are open for booking. Choose one to see available times.
                </div>
              )}

              {selectedDate && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {slots.map((s) => {
                    const isTaken = (booked[selectedDate] || []).includes(s.time);
                    const isActive = selectedSlot === s.time;
                    return (
                      <button
                        key={s.time}
                        disabled={isTaken}
                        onClick={() => { setSelectedSlot(s.time); setStatus(null); }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '13px 16px', borderRadius: 10, fontSize: 14, fontFamily: t.fontBody,
                          background: isActive ? t.accent : 'transparent',
                          color: isTaken ? '#57514a' : isActive ? t.ink : '#c9c2b6',
                          border: `1px solid ${isActive ? t.accent : t.darkLine}`,
                          cursor: isTaken ? 'not-allowed' : 'pointer',
                          textDecoration: isTaken ? 'line-through' : 'none',
                          fontWeight: isActive ? 600 : 400,
                          transition: 'border-color .15s, background .15s',
                        }}
                      >
                        <span>{s.time}</span>
                        <span style={{ fontFamily: t.fontMono, fontSize: 11, color: isActive ? t.ink : '#6b655c' }}>
                          {isTaken ? 'BOOKED' : s.dur}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedDate && selectedSlot && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16, animation: 'floatUp .3s ease both' }}>
                  <input
                    placeholder="Your name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    style={inputStyle}
                  />
                  <input
                    type="email"
                    placeholder="you@email.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    style={inputStyle}
                  />
                  <input
                    placeholder="What do you want to talk about? (optional)"
                    value={form.topic}
                    onChange={(e) => setForm({ ...form, topic: e.target.value })}
                    style={inputStyle}
                  />
                  <button
                    onClick={confirmBooking}
                    disabled={busy}
                    style={{
                      fontFamily: t.fontBody, fontSize: 15, fontWeight: 600, color: t.ink,
                      background: t.accent, border: 'none', padding: '13px 18px', borderRadius: 10,
                      cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1,
                    }}
                  >
                    {busy ? 'Booking…' : `Confirm · ${selectedSlot}`}
                  </button>
                </div>
              )}

              {status && (
                <div style={{ marginTop: 14, fontSize: 13.5, lineHeight: 1.5, color: status.ok ? '#8fd39a' : '#f0907a', animation: 'floatUp .3s ease both' }}>
                  {status.ok ? '✓ ' : '✗ '}{status.message}
                </div>
              )}

              <div style={{ marginTop: 'auto', paddingTop: 20, textAlign: 'center', fontFamily: t.fontMono, fontSize: 12, color: '#6b655c' }}>
                {scheduler.note}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

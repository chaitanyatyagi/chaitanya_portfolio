import { theme as t } from '../data.js';

// Shared UI primitives for the admin panel — same design language as the site.

export const S = {
  label: {
    display: 'block', fontFamily: t.fontMono, fontSize: 11, letterSpacing: '.1em',
    textTransform: 'uppercase', color: t.faint, marginBottom: 6,
  },
  input: {
    width: '100%', fontFamily: t.fontBody, fontSize: 14, padding: '10px 12px',
    border: `1px solid #d8d2c6`, borderRadius: 8, background: '#fff', color: t.ink, outline: 'none',
  },
  card: {
    background: '#fff', border: `1px solid ${t.line}`, borderRadius: 14, padding: 20, marginBottom: 16,
  },
  btn: {
    fontFamily: t.fontBody, fontSize: 13.5, fontWeight: 500, color: t.ink, background: '#fff',
    border: `1px solid #d8d2c6`, padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
  },
  btnPrimary: {
    fontFamily: t.fontBody, fontSize: 14, fontWeight: 600, color: t.bg, background: t.ink,
    border: 'none', padding: '11px 20px', borderRadius: 9, cursor: 'pointer',
  },
  btnDanger: {
    fontFamily: t.fontBody, fontSize: 12.5, fontWeight: 500, color: '#c0392b', background: '#fff',
    border: '1px solid #eabcb4', padding: '6px 10px', borderRadius: 7, cursor: 'pointer',
  },
  btnSmall: {
    fontFamily: t.fontMono, fontSize: 12, color: t.muted, background: '#fff',
    border: `1px solid ${t.line}`, padding: '5px 9px', borderRadius: 7, cursor: 'pointer',
  },
  sectionTitle: {
    fontFamily: t.fontDisplay, fontWeight: 600, fontSize: 20, letterSpacing: '-.01em', margin: '0 0 18px',
  },
};

export function Field({ label, value, onChange, textarea, rows = 3, type = 'text', placeholder }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={S.label}>{label}</label>
      {textarea ? (
        <textarea
          value={value ?? ''}
          rows={rows}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...S.input, resize: 'vertical', lineHeight: 1.55 }}
        />
      ) : (
        <input
          type={type}
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={S.input}
        />
      )}
    </div>
  );
}

// Generic editor for an array of objects.
// fields: [{ key, label, textarea?, list? }]  — `list` = comma-separated array of strings
export function ListEditor({ title, items = [], fields, onChange, addLabel = '+ Add item', newItem }) {
  const update = (i, key, value) => {
    const next = items.map((it, idx) => (idx === i ? { ...it, [key]: value } : it));
    onChange(next);
  };
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, newItem ? newItem() : Object.fromEntries(fields.map((f) => [f.key, f.list ? [] : '']))]);

  return (
    <div style={{ marginBottom: 20 }}>
      {title && <div style={{ ...S.label, marginBottom: 10 }}>{title}</div>}
      {items.map((item, i) => (
        <div key={i} style={{ ...S.card, padding: 16, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontFamily: t.fontMono, fontSize: 11, color: t.fainter }}>#{i + 1}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={S.btnSmall} onClick={() => move(i, -1)} title="Move up">↑</button>
              <button style={S.btnSmall} onClick={() => move(i, 1)} title="Move down">↓</button>
              <button style={S.btnDanger} onClick={() => remove(i)}>Remove</button>
            </div>
          </div>
          {fields.map((f) => (
            <Field
              key={f.key}
              label={f.label}
              textarea={f.textarea}
              rows={f.rows || 3}
              value={f.list ? (item[f.key] || []).join(', ') : item[f.key]}
              onChange={(v) => update(i, f.key, f.list ? v.split(',').map((s) => s.trim()).filter(Boolean) : v)}
            />
          ))}
        </div>
      ))}
      <button style={S.btn} onClick={add}>{addLabel}</button>
    </div>
  );
}

// Comma-separated editor for a plain string array.
export function StringListField({ label, value = [], onChange }) {
  return (
    <Field
      label={`${label} (comma-separated)`}
      value={value.join(', ')}
      onChange={(v) => onChange(v.split(',').map((s) => s.trim()).filter(Boolean))}
    />
  );
}

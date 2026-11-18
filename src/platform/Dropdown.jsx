import { useEffect, useId, useMemo, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Dropdown — the platform's select (docs §11.1). A quiet trigger
// ("Role  Any ▾") opening a hairline popover listbox. Keyboard: ↑/↓ move,
// Enter/Space pick, Esc/Tab close, typing filters long lists (> 8 options).
// options: [{ value, label, count? }]. Use instead of a native <select>.
// ---------------------------------------------------------------------------

export default function Dropdown({ label, value, options, onChange, allLabel = 'Any', align = 'left', className = '' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const root = useRef(null);
  const list = useRef(null);
  const search = useRef(null);
  const trigger = useRef(null);
  const id = useId();
  const searchable = options.length > 8;

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => String(o.label).toLowerCase().includes(q)) : options;
  }, [options, query]);
  const current = options.find((o) => o.value === value);
  const isSet = current && current.value !== 'All';

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!root.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    setActive(Math.max(0, shown.findIndex((o) => o.value === value)));
    requestAnimationFrame(() => (searchable ? search.current : list.current)?.focus());
    return () => document.removeEventListener('mousedown', close);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const pick = (o) => { onChange(o.value); setOpen(false); setQuery(''); trigger.current?.focus(); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(shown.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter' || (e.key === ' ' && !searchable)) { e.preventDefault(); if (shown[active]) pick(shown[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); trigger.current?.focus(); }
    else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div className={`pf-dd${open ? ' is-open' : ''}${isSet ? ' is-set' : ''} ${className}`} ref={root}>
      <button
        ref={trigger} type="button" className="pf-dd-trigger"
        aria-haspopup="listbox" aria-expanded={open} aria-controls={`${id}-list`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true); } }}
      >
        {label && <span className="pf-dd-label">{label}</span>}
        <span className="pf-dd-value">{isSet ? current.label : allLabel}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div className={`pf-dd-pop is-${align}`} onKeyDown={onKey}>
          {searchable && (
            <input
              ref={search} className="pf-dd-search" placeholder={`Filter ${String(label || '').toLowerCase()}…`}
              value={query} onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              aria-label={`Filter ${label || 'options'}`} aria-controls={`${id}-list`}
            />
          )}
          <ul ref={list} id={`${id}-list`} role="listbox" tabIndex={-1} aria-label={label} className="pf-dd-list"
            aria-activedescendant={shown[active] ? `${id}-${active}` : undefined}>
            {shown.map((o, i) => (
              <li
                key={o.value} id={`${id}-${i}`} data-i={i} role="option" aria-selected={o.value === value}
                className={`pf-dd-opt${i === active ? ' is-active' : ''}${o.value === value ? ' is-picked' : ''}`}
                onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); pick(o); }}
              >
                <span>{o.label}</span>
                {o.count != null && <span className="pf-dd-count">{o.count}</span>}
                <svg className="pf-dd-check" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.5l2.5 2.5 4.5-5.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </li>
            ))}
            {!shown.length && <li className="pf-dd-empty">No matches</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

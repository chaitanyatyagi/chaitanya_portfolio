import { createContext, useContext, useEffect, useState } from 'react';
import { defaultContent } from '../server/legacy/defaultContent.js';

// Site content lives in MongoDB (edited via /admin). The static defaults
// render instantly and are swapped for live content once the API responds —
// so the site still works even if the backend is down.
const ContentContext = createContext(defaultContent);

export function ContentProvider({ children }) {
  const [content, setContent] = useState(defaultContent);

  useEffect(() => {
    let alive = true;
    fetch('/api/content')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data && typeof data === 'object') setContent(data);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  return <ContentContext.Provider value={content}>{children}</ContentContext.Provider>;
}

export const useContent = () => useContext(ContentContext);

// Renders "text with *accented* words" — *…* segments get the accent color.
export function Accent({ text, color = '#ff6b35' }) {
  const parts = String(text || '').split(/\*([^*]+)\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <span key={i} style={{ color }}>{part}</span> : part
  );
}

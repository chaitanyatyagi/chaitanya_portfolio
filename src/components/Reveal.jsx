import { useEffect, useRef, useState } from 'react';

// Fades + floats children in when they scroll into view. Respects
// prefers-reduced-motion via the CSS transition defined in index.css.
export default function Reveal({ children, delay = 0, style, ...rest }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) { setVisible(true); return; }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    io.observe(el);
    // Safety net: never leave content hidden (printing, snapshots, odd embeds).
    const failsafe = setTimeout(() => setVisible(true), 3000);
    return () => { io.disconnect(); clearTimeout(failsafe); };
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal${visible ? ' reveal-in' : ''}`}
      style={{ transitionDelay: `${delay}ms`, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}

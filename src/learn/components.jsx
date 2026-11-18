import { Marked } from 'marked';
import hljs from 'highlight.js/lib/core';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import bash from 'highlight.js/lib/languages/bash';
import ini from 'highlight.js/lib/languages/ini';
import json from 'highlight.js/lib/languages/json';
import { makeSlugger } from '../../shared/content/slug.js';
import { courseUrl, formatDuration } from './courseData.js';

hljs.registerLanguage('python', python);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('ini', ini);
hljs.registerLanguage('json', json);

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Markdown → HTML for a module. Drops the leading `# Title` (the page renders
// its own header), gives headings the same ids as the lesson list, and
// syntax-highlights code blocks.
export function renderModuleHtml(md, { slugger = makeSlugger } = {}) {
  const slug = slugger();
  const parser = new Marked({
    renderer: {
      heading(token) {
        const id = slug(token.text);
        return `<h${token.depth} id="${id}">${this.parser.parseInline(token.tokens)}</h${token.depth}>`;
      },
      code(token) {
        const lang = (token.lang || '').trim().split(/\s+/)[0];
        const body = hljs.getLanguage(lang)
          ? hljs.highlight(token.text, { language: lang }).value
          : escapeHtml(token.text);
        const label = lang && lang !== 'text' ? `<span class="pf-code-lang">${lang}</span>` : '';
        return `<pre>${label}<code class="hljs">${body}</code></pre>`;
      },
    },
  });
  const tokens = parser.lexer(md);
  if (tokens[0]?.type === 'heading' && tokens[0].depth === 1) slug(tokens.shift().text);
  return parser.parser(tokens);
}

export function ProgressBar({ pct, style }) {
  return (
    <div className="pf-progress" style={style} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

// Card for a course summary from /api/catalog. `completed` = number of
// modules this learner has finished (when signed in).
export function CourseCard({ course, completed = 0, step }) {
  const pct = course.modules ? Math.round((completed / course.modules) * 100) : 0;
  const started = completed > 0;
  return (
    <a href={courseUrl(course)} className="pf-card pf-course-card" style={{ height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span className={`pf-badge pf-level-${course.level.toLowerCase()}`}>{course.level}</span>
        <span className="pf-meta">{step ? `Course ${step} · ` : ''}{formatDuration(course.minutes)}</span>
      </div>
      <h3>{course.title}</h3>
      <p>{course.description}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 16 }}>
        {course.tags.map((tag) => <span key={tag} className="pf-chip">{tag}</span>)}
      </div>
      <div className="pf-card-foot" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
        {started && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ProgressBar pct={pct} style={{ flex: 1 }} />
            <span className="pf-meta" style={{ color: 'var(--accent)' }}>{pct}%</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <span className="pf-meta">{course.modules} modules · {course.lessons} lessons</span>
          <span className="pf-link-arrow">{started ? 'Continue →' : 'Start →'}</span>
        </div>
      </div>
    </a>
  );
}

export function LoadState({ loading, error, children, label = 'Loading…' }) {
  if (error) return <div className="pf-wrap pf-load-error">Couldn't load this page: {error.message} <button className="pf-text-btn" onClick={() => window.location.reload()}>Retry</button></div>;
  if (loading) return <div className="pf-wrap pf-loading"><span className="pf-spinner" /> {label}</div>;
  return children;
}

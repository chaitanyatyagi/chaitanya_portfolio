import { PlatformLayout } from '../platform/Shell.jsx';
import { useApi } from '../lib/useApi.js';
import { LoadState, renderModuleHtml } from '../learn/components.jsx';
import { Difficulty, StatusIcon } from '../practice/ui.jsx';

// /interview/case/:id — one case study: the shared brief (story + dataset) and
// its parts as a ladder of increasing difficulty.
export default function CaseStudyPage({ id }) {
  const { data, loading, error } = useApi(`/case-studies/${id}`);
  const cs = data?.caseStudy;
  const next = cs?.parts.find((p) => p.status !== 'solved') || cs?.parts[0];
  return (
    <PlatformLayout title={cs ? `${cs.title} · Case study` : 'Case study'}>
      <LoadState loading={loading} error={error?.status === 404 ? null : error} label="Loading case study…">
        {error?.status === 404 && <div className="pf-wrap pf-load-error">No such case study. <a className="pf-link-arrow" href="/interview">All case studies →</a></div>}
        {cs && (
          <>
            <header className="pf-page-head">
              <div className="pf-wrap">
                <nav className="pf-crumbs" aria-label="Breadcrumb"><a href="/interview">Interview prep</a><span>/</span><span>Case study</span></nav>
                <h1>{cs.title}</h1>
                <p>{cs.summary}</p>
                <p className="pf-meta" style={{ marginTop: 12 }}>{cs.parts.length} parts · for {cs.roles.join(', ')}{cs.companies.length ? ` · reported at ${cs.companies.join(', ')}` : ''}</p>
                {next && <a className="pf-btn pf-btn-primary" style={{ marginTop: 18 }} href={`/practice/${cs.track}/${next.id}`}>{next.status === 'solved' ? 'Review part 1' : `Start part ${next.part}`} →</a>}
              </div>
            </header>
            <div className="pf-wrap pf-case-body">
              <section className="pf-pcard">
                <h2 className="pf-ph2">The brief</h2>
                <div className="pf-prose pf-prose-sm" dangerouslySetInnerHTML={{ __html: renderModuleHtml(cs.brief) }} />
              </section>
              <section className="pf-pcard">
                <h2 className="pf-ph2">Parts <span className="pf-meta">{cs.parts.filter((p) => p.status === 'solved').length}/{cs.parts.length} solved</span></h2>
                <ol className="pf-parts">
                  {cs.parts.map((p) => (
                    <li key={p.id}>
                      <a href={`/practice/${cs.track}/${p.id}`} className="pf-part">
                        <span className={`pf-part-no is-${p.difficulty.toLowerCase()}`}>{p.part}</span>
                        <span className="pf-prow-title"><b>{p.title.replace(/^.*?·\s*/, '')}</b><span>{p.points} points</span></span>
                        <Difficulty level={p.difficulty} />
                        <StatusIcon status={p.status} />
                      </a>
                    </li>
                  ))}
                </ol>
                <p className="pf-meta">Each part uses the same tables. Later parts assume the definitions agreed in earlier ones — solve them in order.</p>
              </section>
            </div>
          </>
        )}
      </LoadState>
    </PlatformLayout>
  );
}

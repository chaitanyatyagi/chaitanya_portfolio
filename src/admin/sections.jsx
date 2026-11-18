import { theme as t } from '../data.js';
import { S, Field, ListEditor, StringListField } from './ui.jsx';

// One editor component per content section. Each receives (data, set) where
// `set(patch)` shallow-merges into that section.

export function GeneralEditor({ content, setSection }) {
  const { meta, nav, links, footer } = content;
  return (
    <>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>Identity</h3>
        <Field label="Site name" value={meta.siteName} onChange={(v) => setSection('meta', { siteName: v })} />
        <Field label="Logo letter" value={meta.logoLetter} onChange={(v) => setSection('meta', { logoLetter: v })} />
        <Field label="Role" value={meta.role} onChange={(v) => setSection('meta', { role: v })} />
      </div>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>Links & Contact</h3>
        <Field label="Email" value={links.email} onChange={(v) => setSection('links', { email: v })} />
        <Field label="Phone" value={links.phone} onChange={(v) => setSection('links', { phone: v })} />
        <Field label="Location" value={links.location} onChange={(v) => setSection('links', { location: v })} />
        <Field label="GitHub URL" value={links.github} onChange={(v) => setSection('links', { github: v })} />
        <Field label="LinkedIn URL" value={links.linkedin} onChange={(v) => setSection('links', { linkedin: v })} />
        <Field label="Résumé file path" value={links.resume} onChange={(v) => setSection('links', { resume: v })} />
      </div>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>Navigation</h3>
        <ListEditor
          items={nav.items}
          fields={[{ key: 'label', label: 'Label' }, { key: 'href', label: 'Anchor (e.g. #work)' }]}
          onChange={(items) => setSection('nav', { items })}
          addLabel="+ Add nav link"
        />
        <Field label="Résumé button label" value={nav.resumeLabel} onChange={(v) => setSection('nav', { resumeLabel: v })} />
      </div>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>Footer</h3>
        <Field label="Headline" value={footer.headline} onChange={(v) => setSection('footer', { headline: v })} />
        <Field label="Tagline" value={footer.tagline} onChange={(v) => setSection('footer', { tagline: v })} />
        <Field label="Copyright" value={footer.copyright} onChange={(v) => setSection('footer', { copyright: v })} />
      </div>
    </>
  );
}

export function HeroEditor({ content, setSection }) {
  const hero = content.hero;
  const set = (patch) => setSection('hero', patch);
  return (
    <>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>Hero</h3>
        <Field label="Kicker (status line)" value={hero.kicker} onChange={(v) => set({ kicker: v })} />
        <Field label="Title — wrap words in *asterisks* for orange accent" textarea rows={2} value={hero.title} onChange={(v) => set({ title: v })} />
        <Field label="Intro paragraph" textarea rows={4} value={hero.intro} onChange={(v) => set({ intro: v })} />
        <Field label="Primary button" value={hero.ctaPrimary} onChange={(v) => set({ ctaPrimary: v })} />
        <Field label="Secondary button" value={hero.ctaSecondary} onChange={(v) => set({ ctaSecondary: v })} />
      </div>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>Pipeline strip</h3>
        <Field label="Strip label" value={hero.pipelineLabel} onChange={(v) => set({ pipelineLabel: v })} />
        <ListEditor
          items={hero.pipeline}
          fields={[{ key: 'step', label: 'Step no.' }, { key: 'name', label: 'Name' }, { key: 'tool', label: 'Tools' }]}
          onChange={(pipeline) => set({ pipeline })}
          addLabel="+ Add pipeline step"
        />
      </div>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>Stats</h3>
        <ListEditor
          items={hero.stats}
          fields={[{ key: 'value', label: 'Value (e.g. 2+ yrs)' }, { key: 'label', label: 'Label' }]}
          onChange={(stats) => set({ stats })}
          addLabel="+ Add stat"
        />
      </div>
    </>
  );
}

export function AboutEditor({ content, setSection }) {
  const about = content.about;
  const set = (patch) => setSection('about', patch);
  return (
    <>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>About</h3>
        <Field label="Heading" textarea rows={2} value={about.heading} onChange={(v) => set({ heading: v })} />
        {(about.paragraphs || []).map((p, i) => (
          <Field key={i} label={`Paragraph ${i + 1}`} textarea rows={4} value={p}
            onChange={(v) => set({ paragraphs: about.paragraphs.map((x, j) => (j === i ? v : x)) })} />
        ))}
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.btn} onClick={() => set({ paragraphs: [...(about.paragraphs || []), ''] })}>+ Add paragraph</button>
          {(about.paragraphs || []).length > 1 && (
            <button style={S.btnDanger} onClick={() => set({ paragraphs: about.paragraphs.slice(0, -1) })}>Remove last</button>
          )}
        </div>
      </div>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>Quick facts</h3>
        <ListEditor
          items={about.facts}
          fields={[{ key: 'k', label: 'Tag (e.g. EDU)' }, { key: 'a', label: 'Main line' }, { key: 'b', label: 'Sub line' }]}
          onChange={(facts) => set({ facts })}
          addLabel="+ Add fact"
        />
      </div>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>Tech stack</h3>
        <ListEditor
          items={about.stackGroups}
          fields={[{ key: 'label', label: 'Group name' }, { key: 'items', label: 'Skills (comma-separated)', list: true }]}
          onChange={(stackGroups) => set({ stackGroups })}
          addLabel="+ Add skill group"
        />
      </div>
    </>
  );
}

export function ExperienceEditor({ content, setSection }) {
  const experience = content.experience;
  const set = (patch) => setSection('experience', patch);
  const jobs = experience.jobs || [];

  const updateJob = (i, patch) => set({ jobs: jobs.map((j, idx) => (idx === i ? { ...j, ...patch } : j)) });

  return (
    <>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>Experience</h3>
        <Field label="Section heading" value={experience.heading} onChange={(v) => set({ heading: v })} />
      </div>
      {jobs.map((job, i) => (
        <div key={i} style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ ...S.sectionTitle, margin: 0 }}>{job.company || `Job ${i + 1}`}</h3>
            <button style={S.btnDanger} onClick={() => set({ jobs: jobs.filter((_, idx) => idx !== i) })}>Remove job</button>
          </div>
          <Field label="Company" value={job.company} onChange={(v) => updateJob(i, { company: v })} />
          <Field label="Role" value={job.role} onChange={(v) => updateJob(i, { role: v })} />
          <Field label="Client line (optional)" value={job.client} onChange={(v) => updateJob(i, { client: v })} />
          <Field label="Period (e.g. JUL 2024 — PRESENT)" value={job.period} onChange={(v) => updateJob(i, { period: v })} />
          <Field label="Location" value={job.location} onChange={(v) => updateJob(i, { location: v })} />
          <Field label="Badge (optional)" value={job.badge} onChange={(v) => updateJob(i, { badge: v })} />
          <Field label="Summary (one-liner shown under the header)" textarea rows={3} value={job.summary} onChange={(v) => updateJob(i, { summary: v })} />
          <StringListField label="Stack chips" value={job.stack || []} onChange={(stack) => updateJob(i, { stack })} />
          <ListEditor
            title="Highlights"
            items={job.bullets || []}
            fields={[{ key: 'tag', label: 'Tag (e.g. MIGRATION)' }, { key: 'text', label: 'Text', textarea: true, rows: 3 }]}
            onChange={(bullets) => updateJob(i, { bullets })}
            addLabel="+ Add highlight"
          />
        </div>
      ))}
      <button
        style={S.btn}
        onClick={() => set({ jobs: [...jobs, { company: '', role: '', client: '', period: '', location: '', badge: '', summary: '', stack: [], bullets: [] }] })}
      >
        + Add job
      </button>
    </>
  );
}

export function ProjectsEditor({ content, setSection }) {
  const projects = content.projects;
  const set = (patch) => setSection('projects', patch);
  return (
    <>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>Projects</h3>
        <Field label="Section heading" value={projects.heading} onChange={(v) => set({ heading: v })} />
        <Field label="Section description" textarea rows={2} value={projects.description} onChange={(v) => set({ description: v })} />
      </div>
      <ListEditor
        items={projects.items}
        fields={[
          { key: 'kind', label: 'Category tag (e.g. DATA LAKE)' },
          { key: 'name', label: 'Project name' },
          { key: 'desc', label: 'Description', textarea: true, rows: 4 },
          { key: 'tech', label: 'Tech (comma-separated)', list: true },
          { key: 'url', label: 'Link URL' },
        ]}
        onChange={(items) => set({ items })}
        addLabel="+ Add project"
      />
    </>
  );
}

export function GuideEditor({ content, setSection }) {
  const guide = content.guide || {};
  const blog = content.blog || {};
  return (
    <>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>Guide — home section</h3>
        <div style={{ fontSize: 13, color: t.faint, lineHeight: 1.55, marginBottom: 16 }}>
          These fields control the home-page highlight only. The guide's chapters and notes live in
          code (<code>src/guide/content/*.md</code>) — add a markdown file there to add a chapter.
        </div>
        <Field label="Heading" value={guide.heading} onChange={(v) => setSection('guide', { heading: v })} />
        <Field label="Description" textarea rows={3} value={guide.description} onChange={(v) => setSection('guide', { description: v })} />
        <Field label="Open-guide button label" value={guide.ctaLabel} onChange={(v) => setSection('guide', { ctaLabel: v })} />
        <Field label="'Growing' strip suffix (after the live chapter counts)" value={guide.moreText} onChange={(v) => setSection('guide', { moreText: v })} />
      </div>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>Course notify strip</h3>
        <Field label="Heading" value={guide.notifyHeading} onChange={(v) => setSection('guide', { notifyHeading: v })} />
        <Field label="Text" textarea rows={3} value={guide.notifyText} onChange={(v) => setSection('guide', { notifyText: v })} />
      </div>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>Blog — home section copy</h3>
        <div style={{ fontSize: 13, color: t.faint, lineHeight: 1.55, marginBottom: 16 }}>
          Posts themselves are managed in the <strong>Blogs</strong> tab.
        </div>
        <Field label="Heading" value={blog.heading} onChange={(v) => setSection('blog', { heading: v })} />
        <Field label="Description" textarea rows={2} value={blog.description} onChange={(v) => setSection('blog', { description: v })} />
        <Field label="Empty-state text (shown while there are no posts)" value={blog.emptyText} onChange={(v) => setSection('blog', { emptyText: v })} />
      </div>
    </>
  );
}

export function ChatbotEditor({ content, setSection }) {
  const chatbot = content.chatbot;
  const set = (patch) => setSection('chatbot', patch);
  return (
    <>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>Ask AI</h3>
        <label style={S.label}>Status</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[{ v: true, label: '◷ Coming soon' }, { v: false, label: '● Live' }].map(({ v, label }) => (
            <button
              key={label}
              onClick={() => set({ comingSoon: v })}
              style={{
                ...S.btn,
                background: !!chatbot.comingSoon === v ? t.ink : '#fff',
                color: !!chatbot.comingSoon === v ? t.bg : t.ink,
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <Field label="Coming-soon badge text" value={chatbot.badge} onChange={(v) => set({ badge: v })} />
        <Field label="Kicker" value={chatbot.kicker} onChange={(v) => set({ kicker: v })} />
        <Field label="Heading" value={chatbot.heading} onChange={(v) => set({ heading: v })} />
        <Field label="Description" textarea rows={2} value={chatbot.description} onChange={(v) => set({ description: v })} />
        <Field label="Status text" value={chatbot.statusText} onChange={(v) => set({ statusText: v })} />
        <Field label="'Powered by' text" value={chatbot.poweredBy} onChange={(v) => set({ poweredBy: v })} />
        <Field label="Greeting message" textarea rows={3} value={chatbot.greeting} onChange={(v) => set({ greeting: v })} />
        <Field label="Input placeholder" value={chatbot.placeholder} onChange={(v) => set({ placeholder: v })} />
      </div>
      <ListEditor
        title="Suggestion chips"
        items={chatbot.suggestions}
        fields={[
          { key: 'label', label: 'Chip label' },
          { key: 'q', label: 'Full question sent to the AI' },
        ]}
        onChange={(suggestions) => set({ suggestions })}
        addLabel="+ Add suggestion"
      />
    </>
  );
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function SchedulerEditor({ content, setSection }) {
  const scheduler = content.scheduler;
  const set = (patch) => setSection('scheduler', patch);
  const days = scheduler.availableWeekdays || [];
  const toggleDay = (d) =>
    set({ availableWeekdays: days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort() });

  return (
    <>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>1:1 Scheduler</h3>
        <Field label="Heading" value={scheduler.heading} onChange={(v) => set({ heading: v })} />
        <Field label="Description" textarea rows={2} value={scheduler.description} onChange={(v) => set({ description: v })} />
        <Field label="Note under slots" value={scheduler.note} onChange={(v) => set({ note: v })} />
        <label style={S.label}>Days open for booking</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          {WEEKDAYS.map((name, d) => (
            <button
              key={d}
              onClick={() => toggleDay(d)}
              style={{
                ...S.btn,
                background: days.includes(d) ? t.ink : '#fff',
                color: days.includes(d) ? t.bg : t.ink,
              }}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <ListEditor
        title="Time slots"
        items={scheduler.slots}
        fields={[
          { key: 'time', label: 'Time (e.g. 09:00 AM)' },
          { key: 'dur', label: 'Duration (e.g. 30 MIN)' },
        ]}
        onChange={(slots) => set({ slots })}
        addLabel="+ Add slot"
      />
    </>
  );
}

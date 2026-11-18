// Course progress, stored on the server (per account, across devices).
import { api } from '../lib/api.js';

export const setModuleCompleted = (slug, completed) =>
  api(`/progress/modules/${encodeURIComponent(slug)}`, { method: 'PUT', body: { completed } });

export const recordVisit = (courseId, moduleSlug) =>
  api('/progress/visits', { method: 'POST', body: { courseId, moduleSlug } }).catch(() => {});

export function courseProgress(course, completedSlugs = []) {
  const total = course.modules?.length ?? course.modules ?? 0;
  const done = completedSlugs.length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

// "Continue" target: last visited module unless it's done, else the first
// incomplete one, else the first module.
export function resumeModule(course, progress) {
  const completed = new Set(progress?.completed || []);
  const last = course.modules.find((m) => m.slug === progress?.lastVisited);
  if (last && !completed.has(last.slug)) return last;
  return course.modules.find((m) => !completed.has(m.slug)) || last || course.modules[0];
}

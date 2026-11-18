// Course helpers. Course content itself comes from the API:
//   /api/catalog              course summaries
//   /api/courses/:id          outline (modules + lessons) and your progress
//   /api/courses/:id/modules/:slug   lesson body (signed in)
export const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

export const formatDuration = (minutes) =>
  minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

export const courseUrl = (course) => `/learn/${course.id}`;
export const moduleUrl = (course, module, lessonId) =>
  `/learn/${course.id}/${module.slug}${lessonId ? `#${lessonId}` : ''}`;

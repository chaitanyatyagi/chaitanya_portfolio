// ---------------------------------------------------------------------------
// Local draft backup. The server keeps your draft (PUT /problems/:id/draft,
// debounced), and this copy in localStorage makes typing feel instant and
// survives a flaky connection or a closed tab before the next server save.
// Every storage access is guarded (private mode / blocked storage).
// ---------------------------------------------------------------------------
const key = (problemId) => `dd-draft:${problemId}`;

export function loadDraft(problemId) {
  try {
    return localStorage.getItem(key(problemId));
  } catch {
    return null;
  }
}

export function saveDraft(problemId, code) {
  try {
    localStorage.setItem(key(problemId), code);
  } catch {
    /* storage unavailable */
  }
}

export function clearDraft(problemId) {
  try {
    localStorage.removeItem(key(problemId));
  } catch {
    /* storage unavailable */
  }
}

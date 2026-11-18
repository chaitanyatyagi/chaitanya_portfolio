import { useEffect, useRef } from 'react';
import { basicSetup } from 'codemirror';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState, Compartment, Prec } from '@codemirror/state';
import { indentWithTab } from '@codemirror/commands';
import { indentUnit, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { python } from '@codemirror/lang-python';
import { sql, PostgreSQL } from '@codemirror/lang-sql';
import { StreamLanguage } from '@codemirror/language';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { tags } from '@lezer/highlight';

// ---------------------------------------------------------------------------
// CodeMirror 6 editor. basicSetup brings line numbers, auto-indent, bracket
// matching/closing, autocomplete, search (Mod-F), multi-cursor and undo
// history; on top of that: Tab indents, Python uses 4-space indents, SQL gets
// table/column autocomplete from the problem schema, and Mod-' / Mod-Enter
// trigger Run / Submit.
// ---------------------------------------------------------------------------

// Light "Data Arcade" editor theme (docs §11.1): paper-white page, ink text,
// the same token colours as the landing-page editor and course code blocks.
const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '14px', backgroundColor: '#FBFCFF', color: '#17153B' },
  '.cm-scroller': { fontFamily: "'JetBrains Mono', ui-monospace, monospace", lineHeight: '1.75' },
  '.cm-content': { caretColor: '#3B5BFF', padding: '12px 0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#3B5BFF', borderLeftWidth: '3px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-gutters': { backgroundColor: '#FBFCFF', color: '#9A98C0', border: 'none', paddingLeft: '6px' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: '#17153B', fontWeight: '700' },
  '.cm-activeLine': { backgroundColor: '#F3FFD6' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'rgba(59,91,255,.18) !important' },
  '.cm-matchingBracket': { backgroundColor: 'rgba(200,245,66,.55)', outline: '1.5px solid #17153B' },
  '.cm-tooltip': { backgroundColor: '#FFFFFF', border: '2px solid #17153B', borderRadius: '10px', boxShadow: '3px 3px 0 #17153B' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: '#17153B', color: '#FFFFFF' },
  '.cm-panels': { backgroundColor: '#F2F5FF', color: '#17153B' },
  '.cm-panels.cm-panels-bottom': { borderTop: '2px solid #17153B' },
  '.cm-searchMatch': { backgroundColor: 'rgba(255,212,59,.55)' },
  '.cm-foldPlaceholder': { backgroundColor: '#F2F5FF', border: '1px solid #A9B2D8', color: '#4E4C75' },
}, { dark: false });

const highlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.operatorKeyword, tags.modifier], color: '#3B5BFF', fontWeight: '700' },
  { tag: [tags.string, tags.special(tags.string)], color: '#1F7A45' },
  { tag: [tags.number, tags.bool, tags.null], color: '#A04A12' },
  { tag: tags.comment, color: '#75739A', fontStyle: 'italic' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: '#C2186E' },
  { tag: [tags.definition(tags.variableName), tags.className], color: '#6A2BC2' },
  { tag: [tags.typeName, tags.standard(tags.name)], color: '#6A2BC2' },
  { tag: tags.propertyName, color: '#17153B' },
  { tag: tags.operator, color: '#4E4C75' },
]);

function languageFor(track, schema) {
  if (track === 'shell') return [StreamLanguage.define(shell), indentUnit.of('  ')];
  if (track === 'sql') {
    const tables = Object.fromEntries((schema || []).map((t) => [t.name, t.columns.map(([c]) => c)]));
    return [sql({ dialect: PostgreSQL, schema: tables, upperCaseKeywords: true }), indentUnit.of('  ')];
  }
  return [python(), indentUnit.of('    ')];
}

export default function CodeEditor({ value, track, schema, onChange, onRun, onSubmit }) {
  const host = useRef(null);
  const view = useRef(null);
  const language = useRef(new Compartment());
  // Keep latest callbacks without rebuilding the editor.
  const handlers = useRef({ onChange, onRun, onSubmit });
  handlers.current = { onChange, onRun, onSubmit };
  // The last document the editor itself reported. A `value` prop equal to it
  // is just our own edit echoing back; anything else came from outside.
  const lastValue = useRef(value);

  useEffect(() => {
    const shortcuts = Prec.highest(keymap.of([
      { key: "Mod-'", run: () => { handlers.current.onRun?.(); return true; } },
      { key: 'Mod-Enter', run: () => { handlers.current.onSubmit?.(); return true; } },
    ]));
    view.current = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          shortcuts,
          keymap.of([indentWithTab]),
          EditorState.tabSize.of(4),
          language.current.of(languageFor(track, schema)),
          theme,
          syntaxHighlighting(highlight),
          EditorView.updateListener.of((u) => {
            if (!u.docChanged) return;
            lastValue.current = u.state.doc.toString();
            handlers.current.onChange?.(lastValue.current);
          }),
        ],
      }),
    });
    return () => view.current.destroy();
    // The editor is created once; value/language changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    view.current.dispatch({ effects: language.current.reconfigure(languageFor(track, schema)) });
  }, [track, schema]);

  // External value changes (reset, load submission, copy solution) replace the
  // document. Comparing against lastValue rather than the live document keeps
  // a stale render from overwriting keystrokes typed since.
  useEffect(() => {
    const v = view.current;
    if (!v || value === lastValue.current) return;
    lastValue.current = value;
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  return <div ref={host} className="pf-editor" />;
}

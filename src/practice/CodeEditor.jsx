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

// Light "Lineage" editor theme (docs §11.1): white sheet, ink text, the same
// token colours as the landing-page demo and course code blocks.
const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '13.5px', backgroundColor: '#FFFFFF', color: '#121412' },
  '.cm-scroller': { fontFamily: "'Geist Mono', ui-monospace, monospace", lineHeight: '1.8' },
  '.cm-content': { caretColor: '#121412', padding: '12px 0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#121412', borderLeftWidth: '2px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-gutters': { backgroundColor: '#FFFFFF', color: '#A3A69F', border: 'none', paddingLeft: '6px' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: '#121412' },
  '.cm-activeLine': { backgroundColor: '#F7F8F5' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'rgba(18,122,76,.16) !important' },
  '.cm-matchingBracket': { backgroundColor: 'rgba(18,122,76,.12)', outline: '1px solid rgba(18,122,76,.45)' },
  '.cm-tooltip': { backgroundColor: '#FFFFFF', border: '1px solid #DCDDD6', borderRadius: '10px', boxShadow: '0 20px 40px -24px rgba(18,20,18,.35)' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: '#121412', color: '#FFFFFF' },
  '.cm-panels': { backgroundColor: '#F7F8F5', color: '#121412' },
  '.cm-panels.cm-panels-bottom': { borderTop: '1px solid #E4E5DF' },
  '.cm-searchMatch': { backgroundColor: 'rgba(149,96,10,.18)' },
  '.cm-foldPlaceholder': { backgroundColor: '#F7F8F5', border: '1px solid #DCDDD6', color: '#555952' },
}, { dark: false });

const highlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.operatorKeyword, tags.modifier], color: '#2F5BD3' },
  { tag: [tags.string, tags.special(tags.string)], color: '#127A4C' },
  { tag: [tags.number, tags.bool, tags.null], color: '#95600A' },
  { tag: tags.comment, color: '#8A8E86', fontStyle: 'italic' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: '#8A3FC1' },
  { tag: [tags.definition(tags.variableName), tags.className], color: '#121412', fontWeight: '500' },
  { tag: [tags.typeName, tags.standard(tags.name)], color: '#8A3FC1' },
  { tag: tags.propertyName, color: '#121412' },
  { tag: tags.operator, color: '#555952' },
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

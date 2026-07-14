import React, { useEffect, useRef } from 'react';
import { basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { autocompletion } from '@codemirror/autocomplete';
import { EditorView } from '@codemirror/view';

interface ScriptEditorProps {
  value: string;
  onChange: (value: string) => void;
  variables: string[];
  placeholder?: string;
  height?: string;
  onReady?: (actions: { insertText: (text: string) => void } | null) => void;
}

export function ScriptEditor({ value, onChange, variables, placeholder, height = '120px', onReady }: ScriptEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;

    // Define the autocomplete source for variables
    const variableCompletion = (context: any) => {
      // Only trigger if the user just typed '{{' or is inside a variable block
      const word = context.matchBefore(/\{\{?[a-zA-Z0-9_]*/);
      if (!word) return null;

      return {
        from: word.from,
        options: variables.map(v => ({
          label: `{{${v}}}`,
          type: 'variable',
          detail: 'Environment Variable'
        }))
      };
    };

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        javascript(),
        autocompletion({ override: [variableCompletion] }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          "&": {
            height: height,
            fontSize: "12.5px",
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
            backgroundColor: "transparent",
            color: "var(--color-text)",
            border: "0",
            borderRadius: "6px",
            overflow: "hidden",
          },
          "&.cm-focused": {
            outline: "none",
          },
          ".cm-scroller": {
            fontFamily: "inherit",
            lineHeight: "1.65",
          },
          ".cm-content": {
            padding: "12px 0 20px",
            caretColor: "var(--color-text-active)",
          },
          ".cm-gutters": {
            backgroundColor: "rgba(148, 163, 184, 0.07)",
            borderRight: "1px solid var(--color-border)",
            color: "var(--color-text-muted)",
            paddingTop: "4px",
          },
          ".cm-activeLine": {
            backgroundColor: "rgba(59, 130, 246, 0.055)",
          },
          ".cm-activeLineGutter": {
            backgroundColor: "rgba(59, 130, 246, 0.08)",
            color: "var(--color-text-active)",
          },
          ".cm-editor": {
            height: height,
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;
    onReady?.({
      insertText: (text: string) => {
        const selection = view.state.selection.main;
        view.dispatch({
          changes: { from: selection.from, to: selection.to, insert: text },
          selection: { anchor: selection.from + text.length },
          scrollIntoView: true,
        });
        view.focus();
      },
    });

    return () => {
      onReady?.(null);
      view.destroy();
    };
  }, []);

  // Sync value from props to editor if changed externally
  useEffect(() => {
    if (viewRef.current && value !== viewRef.current.state.doc.toString()) {
      viewRef.current.dispatch({
        changes: { from: 0, to: viewRef.current.state.doc.length, insert: value }
      });
    }
  }, [value]);

  return <div ref={editorRef} style={{ width: '100%', height }} />;
}

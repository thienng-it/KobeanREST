import React, { useEffect, useRef } from 'react';
import { basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { autocompletion } from '@codemirror/autocomplete';
import { EditorView } from '@codemirror/view';
import { DYNAMIC_VARIABLES } from '../services/variables';

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
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);

  // Keep refs up-to-date to avoid stale closures in CodeMirror extensions
  onChangeRef.current = onChange;
  valueRef.current = value;

  useEffect(() => {
    if (!editorRef.current) return;

    // Define the autocomplete source for variables
    const variableCompletion = (context: any) => {
      // Only trigger if the user just typed '{{' or is inside a variable block
      const word = context.matchBefore(/\{\{?[^{}]*/);
      if (!word) return null;

      const dynamicKeys = Object.keys(DYNAMIC_VARIABLES);
      const allVars = [...variables, ...dynamicKeys];

      return {
        from: word.from,
        options: allVars.map(v => {
          if (v.startsWith("$response")) {
            return {
              label: `{{${v}}}`,
              type: 'chain',
              detail: 'Extract from response',
              apply: (view: EditorView, completion: any, from: number, to: number) => {
                window.dispatchEvent(
                  new CustomEvent("open-chain-modal", {
                    detail: {
                      initialValue: "",
                      onSave: (newKey: string) => {
                        view.dispatch({
                          changes: { from, to, insert: `{{${newKey}}}` }
                        });
                      }
                    }
                  })
                );
              }
            };
          }
          if (dynamicKeys.includes(v)) {
            return {
              label: `{{${v}}}`,
              type: 'dynamic',
              detail: 'Dynamic generator'
            };
          }
          return {
            label: `{{${v}}}`,
            type: 'variable',
            detail: 'Environment Variable'
          };
        })
      };
    };

    const kbCompletion = (context: any) => {
      const word = context.matchBefore(/kb\.[a-zA-Z0-9_]*/);
      if (!word) return null;
      
      return {
        from: word.from,
        options: [
          { label: "kb.request", type: "property", detail: "Request object" },
          { label: "kb.response", type: "property", detail: "Response object" },
          { label: "kb.variables", type: "property", detail: "Variables map" },
          { label: "kb.environment", type: "property", detail: "Environment API" },
          { label: "kb.test", type: "function", detail: "(name: string, fn: () => void)" },
          { label: "kb.expect", type: "function", detail: "(actual: any) => ExpectAPI" }
        ]
      };
    };

    const onClick = (e: MouseEvent, view: EditorView) => {
      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
      if (pos === null) return;
      const coords = view.coordsAtPos(pos);
      if (!coords) return;
      if (e.clientX < coords.left - 4 || e.clientX > coords.right + 4 || e.clientY < coords.top - 4 || e.clientY > coords.bottom + 4) {
        return;
      }
      const line = view.state.doc.lineAt(pos);
      const lineText = line.text;
      const regex = /\{\{([^{}]+)\}\}/g;
      let match;
      while ((match = regex.exec(lineText)) !== null) {
        const start = line.from + match.index;
        const end = start + match[0].length;
        if (pos >= start && pos <= end) {
          const varName = match[1].trim();
          if (varName.startsWith("$response")) {
            const startCoords = view.coordsAtPos(start);
            const endCoords = view.coordsAtPos(end);
            if (startCoords && endCoords) {
              if (e.clientX < startCoords.left || e.clientX > endCoords.right) {
                break;
              }
            }
            window.dispatchEvent(
              new CustomEvent("open-chain-modal", {
                detail: {
                  initialValue: varName,
                  onSave: (newKey: string) => {
                    view.dispatch({
                      changes: { from: start + 2, to: end - 2, insert: newKey }
                    });
                  }
                }
              })
            );
          }
          break;
        }
      }
    };

    const eventHandlers = EditorView.domEventHandlers({
      click: onClick,
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        javascript(),
        autocompletion({ override: [variableCompletion, kbCompletion] }),
        eventHandlers,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newDoc = update.state.doc.toString();
            // Prevent feedback loops: only fire onChange if the new document differs from the prop value
            if (newDoc !== valueRef.current) {
              onChangeRef.current(newDoc);
            }
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
          },
          "&.cm-focused": {
            outline: "none",
          },
          ".cm-scroller": {
            fontFamily: "inherit",
            lineHeight: "1.65",
            overflow: "auto",
          },
          ".cm-content": {
            padding: "10px 0 20px",
            caretColor: "var(--color-text-active)",
          },
          ".cm-line": {
            padding: "0 14px 0 10px",
          },
          ".cm-gutters": {
            backgroundColor: "rgba(148, 163, 184, 0.07)",
            borderRight: "1px solid var(--color-border)",
            color: "var(--color-text-muted)",
          },
          ".cm-lineNumbers .cm-gutterElement": {
            padding: "0 8px 0 10px",
            minWidth: "24px",
            textAlign: "right",
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

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { basicSetup } from 'codemirror';
import { EditorState, Compartment } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { autocompletion } from '@codemirror/autocomplete';
import { EditorView } from '@codemirror/view';
import { VariablePopoverCard } from './VariableInput';
import type { EnvironmentVariable } from '../types';
import { DYNAMIC_VARIABLES } from '../services/variables';
import { getGraphQLSchemaCompletionSource, type GraphQLType } from '../services/graphql-schema';

interface TooltipState {
  key: string;
  value: string;
  isResolved: boolean;
  x: number;
  y: number;
  placement: "top" | "bottom";
}

interface BodyEditorProps {
  value: string;
  onChange: (value: string) => void;
  variables: EnvironmentVariable[];
  mimeType: string;
  placeholder?: string;
  height?: string;
  graphqlSchemaTypes?: GraphQLType[];
}

export function BodyEditor({ value, onChange, variables, mimeType, placeholder, height = '100%', graphqlSchemaTypes }: BodyEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);

  // Keep refs up-to-date to avoid stale closures in CodeMirror extensions
  onChangeRef.current = onChange;
  valueRef.current = value;

  const [activeTooltip, setActiveTooltip] = useState<TooltipState | null>(null);
  const isHoveringPopoverRef = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleClose = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      if (!isHoveringPopoverRef.current) {
        setActiveTooltip(null);
      }
    }, 100);
  }, []);

  const cancelCloseTimer = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const languageConf = new Compartment();
  const variablesRef = useRef(variables);

  useEffect(() => {
    variablesRef.current = variables;
  }, [variables]);

  useEffect(() => {
    if (!editorRef.current) return;

    // Define the autocomplete source for variables
    const variableCompletion = (context: any) => {
      // Only trigger if the user just typed '{{' or is inside a variable block
      const word = context.matchBefore(/\{\{?[a-zA-Z0-9_$]*/);
      if (!word) return null;

      const dynamicKeys = Object.keys(DYNAMIC_VARIABLES);
      
      const allVars = [
        "$response",
        ...variablesRef.current.map(v => v.key),
        ...dynamicKeys
      ];

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

    const onMouseMove = (e: MouseEvent, view: EditorView) => {
      if (isHoveringPopoverRef.current) return;
      
      const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
      if (pos === null) {
        scheduleClose();
        return;
      }
      
      const coords = view.coordsAtPos(pos);
      if (!coords) return;
      
      // If mouse is too far from the character bounding box, treat as not hovered
      if (e.clientX < coords.left - 8 || e.clientX > coords.right + 8 || e.clientY < coords.top - 8 || e.clientY > coords.bottom + 8) {
        scheduleClose();
        return;
      }

      const line = view.state.doc.lineAt(pos);
      const lineText = line.text;
      const regex = /\{\{([^{}]+)\}\}/g;
      let match;
      let found = false;
      while ((match = regex.exec(lineText)) !== null) {
        const start = line.from + match.index;
        const end = start + match[0].length;
        if (pos >= start && pos <= end) {
          found = true;
          const varName = match[1].trim();
          const variable = variablesRef.current.find(v => v.key === varName);
          const isResolved = !!variable || varName.startsWith("$response");
          
          if (isResolved) {
            cancelCloseTimer();
            const startCoords = view.coordsAtPos(start);
            const endCoords = view.coordsAtPos(end);
            if (startCoords && endCoords) {
              const isTopSpaceAvailable = startCoords.top > 250;
              setActiveTooltip({
                key: varName,
                value: variable ? variable.value : (varName.startsWith("$response") ? "(Extract from response)" : ""),
                isResolved: true,
                x: startCoords.left + (endCoords.right - startCoords.left) / 2,
                y: isTopSpaceAvailable ? startCoords.top - 6 : startCoords.bottom + 6,
                placement: isTopSpaceAvailable ? "top" : "bottom",
              });
            }
          }
          break;
        }
      }
      if (!found) {
        scheduleClose();
      }
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
          const variable = variablesRef.current.find(v => v.key === varName);
          const isResolved = !!variable || varName.startsWith("$response");
          if (isResolved && varName.startsWith("$response")) {
            const startCoords = view.coordsAtPos(start);
            const endCoords = view.coordsAtPos(end);
            if (startCoords && endCoords) {
              if (e.clientX < startCoords.left || e.clientX > endCoords.right) {
                break;
              }
            }
            setActiveTooltip(null);
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
      mousemove: onMouseMove,
      click: onClick,
      mouseleave: () => scheduleClose(),
    });

    let languageExtension: any = [];
    if (mimeType.includes('json') || mimeType.includes('javascript')) {
      languageExtension = javascript();
    }

    const completionSources = [variableCompletion];
    if (graphqlSchemaTypes && graphqlSchemaTypes.length > 0) {
      completionSources.push(getGraphQLSchemaCompletionSource(graphqlSchemaTypes));
    }

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        languageConf.of(languageExtension),
        autocompletion({ override: completionSources }),
        eventHandlers,
        EditorView.lineWrapping,
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
            fontSize: "13px",
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
            padding: "10px 0",
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

    return () => {
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

  // Sync MIME type dynamically
  useEffect(() => {
    if (viewRef.current) {
      let languageExtension: any = [];
      if (mimeType.includes('json') || mimeType.includes('javascript')) {
        languageExtension = javascript();
      }
      viewRef.current.dispatch({
        effects: languageConf.reconfigure(languageExtension)
      });
    }
  }, [mimeType]);

  return (
    <>
      <div ref={editorRef} style={{ width: '100%', height, minHeight: '100%' }} />
      {activeTooltip && (
        <VariablePopoverCard
          tooltipKey={activeTooltip.key}
          tooltipValue={activeTooltip.value}
          isResolved={activeTooltip.isResolved}
          x={activeTooltip.x}
          y={activeTooltip.y}
          placement={activeTooltip.placement}
          onClose={() => {
            setActiveTooltip(null);
          }}
          onMouseEnter={() => {
            isHoveringPopoverRef.current = true;
            cancelCloseTimer();
          }}
          onMouseLeave={() => {
            isHoveringPopoverRef.current = false;
            scheduleClose();
          }}
          onInputFocus={() => {
            isHoveringPopoverRef.current = true;
            cancelCloseTimer();
          }}
        />
      )}
    </>
  );
}

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { basicSetup } from 'codemirror';
import { EditorState, Compartment } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { autocompletion } from '@codemirror/autocomplete';
import { EditorView } from '@codemirror/view';
import { VariablePopoverCard } from './VariableInput';
import type { EnvironmentVariable } from '../types';

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
}

export function BodyEditor({ value, onChange, variables, mimeType, placeholder, height = '100%' }: BodyEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

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
      const word = context.matchBefore(/\{\{?[a-zA-Z0-9_]*/);
      if (!word) return null;

      return {
        from: word.from,
        options: variablesRef.current.map(v => ({
          label: `{{${v.key}}}`,
          type: 'variable',
          detail: 'Environment Variable'
        }))
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
      const regex = /\{\{([a-zA-Z0-9_]+)\}\}/g;
      let match;
      let found = false;
      while ((match = regex.exec(lineText)) !== null) {
        const start = line.from + match.index;
        const end = start + match[0].length;
        // Check if mouse is hovering over this variable
        if (pos >= start && pos <= end) {
          found = true;
          const varName = match[1];
          const variable = variablesRef.current.find(v => v.key === varName);
          if (variable) {
            cancelCloseTimer();
            // Calculate center of the variable text
            const startCoords = view.coordsAtPos(start);
            const endCoords = view.coordsAtPos(end);
            if (startCoords && endCoords) {
              const isTopSpaceAvailable = startCoords.top > 250;
              setActiveTooltip({
                key: varName,
                value: variable.value,
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

    const eventHandlers = EditorView.domEventHandlers({
      mousemove: onMouseMove,
      mouseleave: () => scheduleClose(),
    });

    let languageExtension: any = [];
    if (mimeType.includes('json') || mimeType.includes('javascript')) {
      languageExtension = javascript();
    }

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        languageConf.of(languageExtension),
        autocompletion({ override: [variableCompletion] }),
        eventHandlers,
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
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
            padding: "12px 14px",
            caretColor: "var(--color-text-active)",
          },
          ".cm-gutters": {
            backgroundColor: "rgba(148, 163, 184, 0.07)",
            borderRight: "1px solid var(--color-border)",
            color: "var(--color-text-muted)",
            paddingTop: "12px",
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

import React, { useEffect, useRef } from 'react';
import { basicSetup } from 'codemirror';
import { Compartment, EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { foldAll } from '@codemirror/language';
import { EditorView } from '@codemirror/view';

// We can define a few more common languages if they are available or use a simple map
// Since we only have @codemirror/lang-javascript installed, we'll use it for JSON
// and fall back to plain text for others, or a generic stream language.

interface ResponseViewerProps {
  value: string;
  contentType: string;
  readOnly?: boolean;
  height?: string;
  autoWrap?: boolean;
  autoCollapse?: boolean;
}

export function ResponseViewer({
  value,
  contentType,
  readOnly = true,
  height = '100%',
  autoWrap = true,
  autoCollapse = false,
}: ResponseViewerProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lineWrappingCompartment = useRef(new Compartment());

  useEffect(() => {
    if (!editorRef.current) return;

    // Determine language based on contentType
    let languageExtension: any = [];
    if (contentType.includes('json') || contentType.includes('graphql')) {
      languageExtension = javascript(); // JSON / GraphQL
    } else if (contentType.includes('javascript')) {
      languageExtension = javascript();
    } else if (contentType.includes('xml') || contentType.includes('html')) {
      // Plain text fallback
      languageExtension = []; 
    }

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        languageExtension,
        lineWrappingCompartment.current.of(autoWrap ? EditorView.lineWrapping : []),
        EditorState.readOnly.of(readOnly),
        EditorView.theme({
          "&": {
            height: height,
            fontSize: "13px",
            fontFamily: "monospace",
            backgroundColor: "var(--color-surface)",
            color: "var(--color-text)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
          },
          ".cm-gutters": {
            backgroundColor: "var(--color-surface-muted)",
            borderRight: "1px solid var(--color-border)",
            color: "var(--color-text-muted)",
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

    if (autoCollapse && value) {
      setTimeout(() => {
        if (viewRef.current) {
          try {
            foldAll(viewRef.current);
          } catch {
            // ignore
          }
        }
      }, 50);
    }

    return () => {
      view.destroy();
    };
  }, []);

  useEffect(() => {
    if (viewRef.current && value !== viewRef.current.state.doc.toString()) {
      viewRef.current.dispatch({
        changes: { from: 0, to: viewRef.current.state.doc.length, insert: value }
      });
      if (autoCollapse && value) {
        setTimeout(() => {
          if (viewRef.current) {
            try {
              foldAll(viewRef.current);
            } catch {
              // ignore
            }
          }
        }, 50);
      }
    }
  }, [value, autoCollapse]);

  useEffect(() => {
    if (viewRef.current) {
      viewRef.current.dispatch({
        effects: lineWrappingCompartment.current.reconfigure(
          autoWrap ? EditorView.lineWrapping : []
        )
      });
    }
  }, [autoWrap]);

  useEffect(() => {
    if (viewRef.current && value !== viewRef.current.state.doc.toString()) {
      viewRef.current.dispatch({
        changes: { from: 0, to: viewRef.current.state.doc.length, insert: value }
      });
    }
  }, [contentType]);

  return <div ref={editorRef} style={{ width: '100%', height: height }} />;
}

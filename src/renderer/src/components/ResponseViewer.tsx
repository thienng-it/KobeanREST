import React, { useEffect, useRef } from 'react';
import { basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { EditorView } from '@codemirror/view';

// We can define a few more common languages if they are available or use a simple map
// Since we only have @codemirror/lang-javascript installed, we'll use it for JSON
// and fall back to plain text for others, or a generic stream language.

interface ResponseViewerProps {
  value: string;
  contentType: string;
  readOnly?: boolean;
  height?: string;
}

export function ResponseViewer({ value, contentType, readOnly = true, height = '100%' }: ResponseViewerProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;

    // Determine language based on contentType
    let languageExtension: any = [];
    if (contentType.includes('json')) {
      languageExtension = javascript(); // JSON is a subset of JS
    } else if (contentType.includes('javascript')) {
      languageExtension = javascript();
    } else if (contentType.includes('xml') || contentType.includes('html')) {
      // We don't have a specific XML/HTML lang package installed, 
      // but we can use a basic stream language or just keep it as plain text.
      // For now, we'll stick to plain text or use a simple generic approach.
      languageExtension = []; 
    }

    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        languageExtension,
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

    return () => {
      view.destroy();
    };
  }, []);

  useEffect(() => {
    if (viewRef.current && value !== viewRef.current.state.doc.toString()) {
      viewRef.current.dispatch({
        changes: { from: 0, to: viewRef.current.state.doc.length, insert: value }
      });
    }
  }, [value]);

  useEffect(() => {
    // If content type changes, we should really re-initialize the editor to update the language.
    // For simplicity in this prototype, we'll just update the doc.
    // A more robust version would destroy and re-create the view.
    if (viewRef.current && value !== viewRef.current.state.doc.toString()) {
      viewRef.current.dispatch({
        changes: { from: 0, to: viewRef.current.state.doc.length, insert: value }
      });
    }
  }, [contentType]);

  return <div ref={editorRef} style={{ width: '100%', height: height }} />;
}

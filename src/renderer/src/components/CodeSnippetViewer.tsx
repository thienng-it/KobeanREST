import React, { useEffect, useRef } from 'react';
import { basicSetup } from 'codemirror';
import { EditorState, Compartment } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { go } from '@codemirror/lang-go';
import { StreamLanguage } from '@codemirror/language';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { EditorView } from '@codemirror/view';

interface CodeSnippetViewerProps {
  value: string;
  language?: string;
}

export function CodeSnippetViewer({ value, language = 'javascript' }: CodeSnippetViewerProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const languageConf = new Compartment();

  useEffect(() => {
    if (!editorRef.current) return;

    const extensions = [
      basicSetup,
      EditorState.readOnly.of(true),
      EditorView.theme({
        "&": {
          height: "100%",
          fontSize: "13px",
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
          backgroundColor: "transparent",
          color: "var(--color-text)",
          border: "0",
          borderRadius: "0",
        },
        "&.cm-focused": {
          outline: "none",
        },
        ".cm-scroller": {
          fontFamily: "inherit",
          lineHeight: "1.6",
        },
        ".cm-content": {
          padding: "16px 0",
        },
        ".cm-gutters": {
          backgroundColor: "transparent",
          borderRight: "1px solid var(--color-border-tint, rgba(255, 255, 255, 0.04))",
          color: "var(--color-text-muted)",
        },
        ".cm-line": {
          padding: "0 16px",
        }
      })
    ];

    const getLanguageExtension = (lang: string) => {
      switch (lang) {
        case 'node':
        case 'fetch':
        case 'javascript':
          return javascript();
        case 'python':
          return python();
        case 'java':
          return java();
        case 'go':
          return go();
        case 'curl':
          return StreamLanguage.define(shell);
        default:
          return [];
      }
    };

    extensions.push(languageConf.of(getLanguageExtension(language)));

    const state = EditorState.create({
      doc: value,
      extensions
    });

    const view = new EditorView({
      state,
      parent: editorRef.current
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Update doc when value changes
  useEffect(() => {
    if (viewRef.current && viewRef.current.state.doc.toString() !== value) {
      viewRef.current.dispatch({
        changes: { from: 0, to: viewRef.current.state.doc.length, insert: value }
      });
    }
  }, [value]);

  // Update language when language changes
  useEffect(() => {
    if (viewRef.current) {
      const getLanguageExtension = (lang: string) => {
        switch (lang) {
          case 'node':
          case 'fetch':
          case 'javascript':
            return javascript();
          case 'python':
            return python();
          case 'java':
            return java();
          case 'go':
            return go();
          case 'curl':
            return StreamLanguage.define(shell);
          default:
            return [];
        }
      };

      viewRef.current.dispatch({
        effects: languageConf.reconfigure(getLanguageExtension(language))
      });
    }
  }, [language]);

  return <div ref={editorRef} style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }} />;
}

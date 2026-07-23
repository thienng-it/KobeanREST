import { useState, useRef, useEffect } from "react";
import { getScripts, saveScript } from "../services/local-store";
import { diagnosticMessage, formatScriptLogValue } from "../app-utils";
import { prettifyScriptContent, type ScriptEditorMode, type RequestCodeSnippetTarget } from "../services/script-tools";
import { runKbScript, type KbScriptContext } from "../services/script-runtime";

export type ScriptOutputEntry = {
  tone: "info" | "error";
  type?: "test_pass" | "test_fail" | "log";
  message: string;
  name?: string;
  errMessage?: string;
};

export function useScripts(selectedRequestId: string | null) {
  const [preScript, setPreScript] = useState("");
  const [postScript, setPostScript] = useState("");
  // Snapshot of what's persisted, so the UI can flag unsaved edits.
  const [savedPreScript, setSavedPreScript] = useState("");
  const [savedPostScript, setSavedPostScript] = useState("");
  const [activeRequestScript, setActiveRequestScript] = useState<"pre" | "post">("pre");
  const [scriptEditorMode, setScriptEditorMode] = useState<ScriptEditorMode>("javascript");
  const [activeSnippetId, setActiveSnippetId] = useState("set-header");
  const [requestCodeTarget, setRequestCodeTarget] = useState<RequestCodeSnippetTarget>("curl");
  const [scriptOutputLog, setScriptOutputLog] = useState<ScriptOutputEntry[]>([]);
  const [requestCodeOpen, setRequestCodeOpen] = useState(false);
  const [scriptOutputExpanded, setScriptOutputExpanded] = useState(false);

  const [folderScriptsOpen, setFolderScriptsOpen] = useState(false);
  const [folderScriptsTarget, setFolderScriptsTarget] = useState<string>("");
  const [folderPreScript, setFolderPreScript] = useState("");
  const [folderPostScript, setFolderPostScript] = useState("");
  const scriptEditorActionsRef = useRef<{ insertText: (text: string) => void } | null>(null);

  useEffect(() => {
    async function loadScripts() {
      if (!selectedRequestId) {
        setPreScript("");
        setPostScript("");
        setSavedPreScript("");
        setSavedPostScript("");
        return;
      }
      try {
        const scripts = await getScripts(selectedRequestId, 'request');
        const pre = scripts.find(s => s.scriptType === 'pre')?.content ?? "";
        const post = scripts.find(s => s.scriptType === 'post')?.content ?? "";
        setPreScript(pre);
        setPostScript(post);
        setSavedPreScript(pre);
        setSavedPostScript(post);
      } catch (err) {
        console.error("Failed to load scripts", diagnosticMessage(err));
      }
    }
    void loadScripts();
  }, [selectedRequestId]);

  function insertScriptToken(token: string) {
    if (scriptEditorActionsRef.current) {
      scriptEditorActionsRef.current.insertText(token);
      return;
    }

    const currentScriptValue = activeRequestScript === "pre" ? preScript : postScript;
    const nextValue = currentScriptValue.trimEnd()
      ? `${currentScriptValue.trimEnd()}${currentScriptValue.endsWith("\n") ? "" : "\n"}${token}`
      : token;

    if (activeRequestScript === "pre") {
      setPreScript(nextValue);
    } else {
      setPostScript(nextValue);
    }
  }

  function setCurrentScriptValue(nextValue: string) {
    if (activeRequestScript === "pre") {
      setPreScript(nextValue);
    } else {
      setPostScript(nextValue);
    }
  }

  function handlePrettifyScript() {
    const currentScriptValue = activeRequestScript === "pre" ? preScript : postScript;
    try {
      const nextValue = prettifyScriptContent(currentScriptValue, scriptEditorMode);
      setCurrentScriptValue(nextValue);
      setScriptOutputLog([{ tone: "info", type: "log", message: `Prettified ${scriptEditorMode.toUpperCase()} content.` }]);
    } catch (error) {
      setScriptOutputLog([{ tone: "error", type: "log", message: `Prettify failed: ${diagnosticMessage(error)}` }]);
    }
  }

  async function handleOpenFolderScripts(folderId: string) {
    try {
      const scripts = await getScripts(folderId, 'folder');
      const pre = scripts.find(s => s.scriptType === 'pre')?.content ?? "";
      const post = scripts.find(s => s.scriptType === 'post')?.content ?? "";
      setFolderPreScript(pre);
      setFolderPostScript(post);
      setFolderScriptsTarget(folderId);
      setFolderScriptsOpen(true);
    } catch (err) {
      console.error("Failed to load folder scripts", diagnosticMessage(err));
      alert("Failed to load folder scripts: " + diagnosticMessage(err));
    }
  }

  async function handleSaveFolderScripts() {
    if (!folderScriptsTarget) return;
    try {
      await saveScript(folderScriptsTarget, "folder", "pre", folderPreScript);
      await saveScript(folderScriptsTarget, "folder", "post", folderPostScript);
      alert("Folder scripts saved successfully!");
      setFolderScriptsOpen(false);
    } catch (err) {
      console.error("Failed to save folder scripts", diagnosticMessage(err));
      alert("Failed to save folder scripts: " + diagnosticMessage(err));
    }
  }

  async function handleSaveScripts() {
    if (!selectedRequestId) return;
    try {
      await saveScript(selectedRequestId, "request", "pre", preScript);
      await saveScript(selectedRequestId, "request", "post", postScript);
      setSavedPreScript(preScript);
      setSavedPostScript(postScript);
      alert("Scripts saved successfully!");
    } catch (err) {
      console.error("Failed to save scripts", diagnosticMessage(err));
      alert("Failed to save scripts: " + diagnosticMessage(err));
    }
  }

  async function runScript(content: string, context: KbScriptContext, label: string): Promise<ScriptOutputEntry[]> {
    if (!content) return [];
    const entries: ScriptOutputEntry[] = [];
    const scriptConsole = {
      log: (...values: unknown[]) => {
        entries.push({ tone: "info", type: "log", message: values.map(formatScriptLogValue).join(" ") });
      },
      warn: (...values: unknown[]) => {
        entries.push({ tone: "info", type: "log", message: values.map(formatScriptLogValue).join(" ") });
      },
      error: (...values: unknown[]) => {
        entries.push({ tone: "error", type: "log", message: values.map(formatScriptLogValue).join(" ") });
      },
      testResult: (passed: boolean, name: string, errMessage?: string) => {
        if (passed) {
          entries.push({ tone: "info", type: "test_pass", name, message: `PASS: ${name}` });
        } else {
          entries.push({ tone: "error", type: "test_fail", name, errMessage, message: `FAIL: ${name} | ${errMessage}` });
        }
      }
    };

    try {
      await runKbScript(content, context, scriptConsole);
    } catch (err) {
      console.error("Failed to parse script:", diagnosticMessage(err));
      entries.push({ tone: "error", type: "log", message: diagnosticMessage(err) });
    }

    return entries;
  }

  const preScriptDirty = preScript !== savedPreScript;
  const postScriptDirty = postScript !== savedPostScript;
  const scriptsDirty = preScriptDirty || postScriptDirty;

  return {
    preScript, setPreScript,
    postScript, setPostScript,
    savedPreScript, savedPostScript,
    preScriptDirty, postScriptDirty, scriptsDirty,
    activeRequestScript, setActiveRequestScript,
    scriptEditorMode, setScriptEditorMode,
    activeSnippetId, setActiveSnippetId,
    requestCodeTarget, setRequestCodeTarget,
    scriptOutputLog, setScriptOutputLog,
    requestCodeOpen, setRequestCodeOpen,
    scriptOutputExpanded, setScriptOutputExpanded,
    folderScriptsOpen, setFolderScriptsOpen,
    folderScriptsTarget, setFolderScriptsTarget,
    folderPreScript, setFolderPreScript,
    folderPostScript, setFolderPostScript,
    scriptEditorActionsRef,
    insertScriptToken, setCurrentScriptValue, handlePrettifyScript,
    handleOpenFolderScripts, handleSaveFolderScripts, handleSaveScripts, runScript
  };
}

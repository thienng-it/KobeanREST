import fs from "fs";

let content = fs.readFileSync("tests/editable-ui-contract.test.mjs", "utf8");

content = content.replace(
  /const readApp = \(\) => \[[\s\S]*?\]\.map/m,
  `const readApp = () => [\n  "src/renderer/src/App.tsx",\n  "src/renderer/src/hooks/useWorkspace.ts",\n  "src/renderer/src/hooks/useScripts.ts",\n  "src/renderer/src/hooks/useAppSettings.ts",\n  "src/renderer/src/components/Sidebar.tsx",\n  "src/renderer/src/components/RequestPanel.tsx",\n  "src/renderer/src/components/Topbar.tsx",\n  "src/renderer/src/components/BottomDock.tsx",\n  "src/renderer/src/components/ContextMenu.tsx",\n  "src/renderer/src/components/ResponsePanel.tsx",\n  "src/renderer/src/components/ModalManager.tsx",\n  "src/renderer/src/hooks/useAuth.ts"\n].map`
);

fs.writeFileSync("tests/editable-ui-contract.test.mjs", content);

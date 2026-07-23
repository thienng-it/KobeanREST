import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

// Prevent default browser context menu, except for inputs where native copy/paste might be useful
document.addEventListener("contextmenu", (e) => {
  const target = e.target as HTMLElement;
  if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
    e.preventDefault();
  }
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

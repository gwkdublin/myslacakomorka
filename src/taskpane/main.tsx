import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

function mount() {
  createRoot(document.getElementById("root")!).render(<App />);
}

// Poza Office (np. zwykła przeglądarka) panel działa w trybie podglądu.
if (typeof Office !== "undefined" && typeof Office.onReady === "function") Office.onReady(() => mount());
else mount();

import { send, DEFAULT_API_URL, normalizeApiUrl } from "./lib/importClient";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const captureView = $("captureView");
const settingsView = $("settingsView");
const status = $("status");
const settingsMsg = $("settingsMsg");
const apiUrlEl = $<HTMLInputElement>("apiUrl");
const tokenEl = $<HTMLInputElement>("token");
const pageFrom = $("pageFrom");

function setStatus(el: HTMLElement, text: string, kind: "" | "ok" | "err" = "") {
  el.textContent = text;
  el.className = `status${kind ? ` ${kind}` : ""}`;
}

function showSettings(show: boolean) {
  settingsView.classList.toggle("hidden", !show);
  captureView.classList.toggle("hidden", show);
}

// --- init: load stored config + show the active tab title ---
chrome.storage.sync.get(["apiUrl", "token"]).then(({ apiUrl, token }) => {
  apiUrlEl.value = (apiUrl as string) || DEFAULT_API_URL;
  if (token) tokenEl.value = token as string;
});
chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
  if (tab?.title) pageFrom.textContent = `Capturing: ${tab.title}`;
});

// --- header cog ---
$("toggleSettings").addEventListener("click", () => showSettings(settingsView.classList.contains("hidden")));

// --- token reveal ---
$("reveal").addEventListener("click", () => {
  tokenEl.type = tokenEl.type === "password" ? "text" : "password";
});

// --- settings: save / test ---
$("save").addEventListener("click", async () => {
  const apiUrl = normalizeApiUrl(apiUrlEl.value || DEFAULT_API_URL);
  apiUrlEl.value = apiUrl;
  await chrome.storage.sync.set({ apiUrl, token: tokenEl.value.trim() });
  setStatus(settingsMsg, "Saved.", "ok");
});

$("test").addEventListener("click", async () => {
  setStatus(settingsMsg, "Testing…");
  try {
    const res = await fetch(`${normalizeApiUrl(apiUrlEl.value)}/api/jobs`, {
      headers: { Authorization: `Bearer ${tokenEl.value.trim()}` },
    });
    res.ok ? setStatus(settingsMsg, "Connection OK ✓", "ok") : setStatus(settingsMsg, `Failed (status ${res.status}).`, "err");
  } catch {
    setStatus(settingsMsg, "Couldn't reach the server.", "err");
  }
});

// --- capture ---
$<HTMLButtonElement>("capture").addEventListener("click", async () => {
  const stored = await chrome.storage.sync.get(["apiUrl", "token"]);
  const apiUrl = normalizeApiUrl((stored.apiUrl as string) || DEFAULT_API_URL);
  const token = (stored.token as string | undefined)?.trim();
  if (!token) {
    setStatus(status, "Add your API token in settings →", "err");
    showSettings(true);
    return;
  }
  const btn = $<HTMLButtonElement>("capture");
  btn.disabled = true;
  setStatus(status, "Capturing…");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) { setStatus(status, "No active tab.", "err"); btn.disabled = false; return; }
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({ url: location.href, text: document.body.innerText }),
    });
    const r = await send(apiUrl, token, result as { url: string; text: string });
    setStatus(status, r.ok ? "Saved ✓ — it'll appear on your board." : `Couldn't save (status ${r.status}).`, r.ok ? "ok" : "err");
  } catch {
    setStatus(status, "Couldn't reach the server.", "err");
  } finally {
    btn.disabled = false;
  }
});

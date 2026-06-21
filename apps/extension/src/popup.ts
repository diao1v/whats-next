import { send } from "./lib/importClient";

const statusEl = document.getElementById("status")!;
const btn = document.getElementById("capture") as HTMLButtonElement;

btn.addEventListener("click", async () => {
  const { apiUrl, token } = await chrome.storage.sync.get(["apiUrl", "token"]);
  if (!apiUrl || !token) {
    statusEl.innerHTML = `Set your API URL and token in <a href="#" id="opt">Options</a>.`;
    document.getElementById("opt")?.addEventListener("click", () => chrome.runtime.openOptionsPage());
    return;
  }
  statusEl.textContent = "Capturing…";
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) { statusEl.textContent = "No active tab."; return; }
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({ url: location.href, text: document.body.innerText }),
  });
  try {
    const r = await send(apiUrl as string, token as string, result as { url: string; text: string });
    statusEl.textContent = r.ok ? "Saved ✓ — it'll appear on your board." : `Couldn't save (status ${r.status}). Check your token.`;
  } catch {
    statusEl.textContent = "Couldn't reach the server.";
  }
});

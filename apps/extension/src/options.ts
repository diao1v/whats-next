import { DEFAULT_API_URL, normalizeApiUrl } from "./lib/importClient";

const apiUrlEl = document.getElementById("apiUrl") as HTMLInputElement;
const tokenEl = document.getElementById("token") as HTMLInputElement;
const msg = document.getElementById("msg")!;

chrome.storage.sync.get(["apiUrl", "token"]).then(({ apiUrl, token }) => {
  apiUrlEl.value = (apiUrl as string) || DEFAULT_API_URL;
  if (token) tokenEl.value = token as string;
});

document.getElementById("save")!.addEventListener("click", async () => {
  const apiUrl = normalizeApiUrl(apiUrlEl.value || DEFAULT_API_URL);
  apiUrlEl.value = apiUrl; // reflect the normalized value back
  await chrome.storage.sync.set({ apiUrl, token: tokenEl.value.trim() });
  msg.textContent = "Saved.";
});

document.getElementById("test")!.addEventListener("click", async () => {
  msg.textContent = "Testing…";
  try {
    const res = await fetch(`${normalizeApiUrl(apiUrlEl.value)}/api/jobs`, {
      headers: { Authorization: `Bearer ${tokenEl.value.trim()}` },
    });
    msg.textContent = res.ok ? "Connection OK ✓" : `Failed (status ${res.status}).`;
  } catch {
    msg.textContent = "Couldn't reach the server.";
  }
});

const apiUrlEl = document.getElementById("apiUrl") as HTMLInputElement;
const tokenEl = document.getElementById("token") as HTMLInputElement;
const msg = document.getElementById("msg")!;

chrome.storage.sync.get(["apiUrl", "token"]).then(({ apiUrl, token }) => {
  if (apiUrl) apiUrlEl.value = apiUrl as string;
  if (token) tokenEl.value = token as string;
});

document.getElementById("save")!.addEventListener("click", async () => {
  await chrome.storage.sync.set({ apiUrl: apiUrlEl.value.trim(), token: tokenEl.value.trim() });
  msg.textContent = "Saved.";
});

document.getElementById("test")!.addEventListener("click", async () => {
  msg.textContent = "Testing…";
  try {
    const res = await fetch(`${apiUrlEl.value.trim().replace(/\/$/, "")}/api/jobs`, {
      headers: { Authorization: `Bearer ${tokenEl.value.trim()}` },
    });
    msg.textContent = res.ok ? "Connection OK ✓" : `Failed (status ${res.status}).`;
  } catch {
    msg.textContent = "Couldn't reach the server.";
  }
});

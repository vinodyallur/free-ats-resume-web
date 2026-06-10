/* Web app glue: pick/drag a resume, convert in-browser, download the ATS DOCX.
 * Identical logic to the extension popup, but the pdf.js worker is loaded from a
 * relative path (no chrome.runtime in a plain website).
 */

(function () {
  const fileInput = document.getElementById("file");
  const drop = document.getElementById("drop");
  const dropText = document.getElementById("dropText");
  const convertBtn = document.getElementById("convert");
  const statusEl = document.getElementById("status");
  const aiKeyEl = document.getElementById("aiKey");
  const aiRememberEl = document.getElementById("aiRemember");

  const KEY_STORE = "ats_gemini_key";
  let selectedFile = null;

  // Restore a previously saved AI key (stored locally, never transmitted by us).
  try {
    const saved = localStorage.getItem(KEY_STORE);
    if (saved && aiKeyEl) aiKeyEl.value = saved;
  } catch (e) {
    /* localStorage may be unavailable */
  }

  if (typeof pdfjsLib !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "lib/pdf.worker.min.js";
  }

  function setStatus(msg, kind) {
    statusEl.textContent = msg || "";
    statusEl.className = "status" + (kind ? " " + kind : "");
  }

  function chooseFile(file) {
    if (!file) return;
    selectedFile = file;
    dropText.textContent = file.name;
    drop.classList.add("has-file");
    convertBtn.disabled = false;
    setStatus("");
  }

  fileInput.addEventListener("change", (e) => chooseFile(e.target.files[0]));

  ["dragenter", "dragover"].forEach((evt) =>
    drop.addEventListener(evt, (e) => {
      e.preventDefault();
      drop.classList.add("dragover");
    })
  );
  ["dragleave", "drop"].forEach((evt) =>
    drop.addEventListener(evt, (e) => {
      e.preventDefault();
      drop.classList.remove("dragover");
    })
  );
  drop.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) chooseFile(file);
  });

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  convertBtn.addEventListener("click", async () => {
    if (!selectedFile) return;
    convertBtn.disabled = true;

    const apiKey = (aiKeyEl && aiKeyEl.value.trim()) || "";
    try {
      if (aiKeyEl) {
        if (apiKey && aiRememberEl && aiRememberEl.checked) {
          localStorage.setItem(KEY_STORE, apiKey);
        } else {
          localStorage.removeItem(KEY_STORE);
        }
      }
    } catch (e) {
      /* ignore storage errors */
    }

    setStatus(
      apiKey ? "Enhancing with AI\u2026 this can take a few seconds." : "Building your ATS-friendly resume\u2026",
      "busy"
    );
    try {
      let warned = "";
      const { blob, filename } = await convertResume(selectedFile, {
        apiKey: apiKey,
        onWarn: (msg) => {
          warned = msg;
        },
      });
      triggerDownload(blob, filename);
      if (apiKey && warned) {
        setStatus("Downloaded " + filename + " (offline mode \u2014 AI was unavailable).", "ok");
      } else {
        setStatus("Done! Downloaded " + filename, "ok");
      }
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Something went wrong.", "err");
    } finally {
      convertBtn.disabled = false;
    }
  });
})();

(() => {
  document.getElementById('year').textContent = new Date().getFullYear();

  const dropZone     = document.getElementById('dropZone');
  const fileInput    = document.getElementById('fileInput');
  const fileList     = document.getElementById('fileList');
  const actionsRow   = document.getElementById('actionsRow');
  const convertBtn   = document.getElementById('convertBtn');
  const clearBtn     = document.getElementById('clearBtn');
  const qualitySlider = document.getElementById('qualitySlider');
  const qualityValue = document.getElementById('qualityValue');
  const losslessToggle = document.getElementById('losslessToggle');
  const resizeToggle   = document.getElementById('resizeToggle');
  const resizeFields   = document.getElementById('resizeFields');
  const resizeWidth    = document.getElementById('resizeWidth');
  const resizeHeight   = document.getElementById('resizeHeight');
  const maintainAR     = document.getElementById('maintainAR');
  const noUpscale      = document.getElementById('noUpscale');
  const resultsCard  = document.getElementById('resultsCard');
  const resultsList  = document.getElementById('resultsList');
  const downloadAllBtn = document.getElementById('downloadAllBtn');
  const convertMoreBtn = document.getElementById('convertMoreBtn');
  const toast        = document.getElementById('toast');

  let selectedFiles = [];
  let convertedFiles = [];
  let toastTimer;

  // ── Quality slider ────────────────────────────────────────────────────────
  qualitySlider.addEventListener('input', () => {
    qualityValue.textContent = qualitySlider.value;
  });

  losslessToggle.addEventListener('change', () => {
    qualitySlider.disabled = losslessToggle.checked;
    qualitySlider.style.opacity = losslessToggle.checked ? '.4' : '1';
  });

  resizeToggle.addEventListener('change', () => {
    resizeFields.hidden = !resizeToggle.checked;
  });

  // Disable height when only width is entered (and vice versa) to hint proportional scaling
  resizeWidth.addEventListener('input', () => {
    maintainAR.closest('label').style.opacity = (resizeWidth.value && resizeHeight.value) ? '1' : '.45';
  });
  resizeHeight.addEventListener('input', () => {
    maintainAR.closest('label').style.opacity = (resizeWidth.value && resizeHeight.value) ? '1' : '.45';
  });

  // ── Drop zone interaction ─────────────────────────────────────────────────
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') fileInput.click();
  });

  dropZone.addEventListener('dragenter', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragover',  (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', (e) => {
    if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('drag-over');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    addFiles([...e.dataTransfer.files]);
  });

  fileInput.addEventListener('change', () => {
    addFiles([...fileInput.files]);
    fileInput.value = '';
  });

  // ── File management ───────────────────────────────────────────────────────
  const ACCEPTED = new Set(['image/jpeg','image/png','image/gif','image/tiff','image/bmp','image/avif','image/heic','image/heif','image/webp']);

  function addFiles(files) {
    const valid = files.filter(f => {
      if (!ACCEPTED.has(f.type)) {
        showToast(`Skipped "${f.name}" — unsupported format.`, true);
        return false;
      }
      if (f.size > 20 * 1024 * 1024) {
        showToast(`Skipped "${f.name}" — exceeds 20 MB limit.`, true);
        return false;
      }
      return true;
    });

    if (selectedFiles.length + valid.length > 20) {
      showToast('Maximum 20 files at a time.', true);
      valid.splice(20 - selectedFiles.length);
    }

    selectedFiles = [...selectedFiles, ...valid];
    renderFileList();
  }

  function removeFile(index) {
    selectedFiles.splice(index, 1);
    renderFileList();
  }

  function renderFileList() {
    fileList.innerHTML = '';
    if (selectedFiles.length === 0) {
      fileList.hidden = true;
      actionsRow.hidden = true;
      return;
    }

    fileList.hidden = false;
    actionsRow.hidden = false;

    selectedFiles.forEach((file, i) => {
      const item = document.createElement('div');
      item.className = 'file-item';

      const thumb = document.createElement('img');
      thumb.className = 'file-item-icon';
      thumb.alt = '';
      const url = URL.createObjectURL(file);
      thumb.src = url;
      thumb.onload = () => URL.revokeObjectURL(url);

      const name = document.createElement('span');
      name.className = 'file-item-name';
      name.textContent = file.name;
      name.title = file.name;

      const size = document.createElement('span');
      size.className = 'file-item-size';
      size.textContent = formatBytes(file.size);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'file-item-remove';
      removeBtn.title = 'Remove';
      removeBtn.setAttribute('aria-label', `Remove ${file.name}`);
      removeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
      removeBtn.addEventListener('click', (e) => { e.stopPropagation(); removeFile(i); });

      item.append(thumb, name, size, removeBtn);
      fileList.appendChild(item);
    });
  }

  // ── Conversion ────────────────────────────────────────────────────────────
  clearBtn.addEventListener('click', resetUpload);

  convertBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) return;

    convertBtn.disabled = true;
    clearBtn.disabled = true;

    const progress = document.createElement('div');
    progress.className = 'progress-overlay';
    progress.innerHTML = `<div class="spinner"></div><span>Converting ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}…</span>`;
    actionsRow.replaceWith(progress);

    const formData = new FormData();
    selectedFiles.forEach(f => formData.append('images', f));
    formData.append('quality', qualitySlider.value);
    formData.append('lossless', losslessToggle.checked);

    if (resizeToggle.checked) {
      if (resizeWidth.value)  formData.append('resizeWidth',  resizeWidth.value);
      if (resizeHeight.value) formData.append('resizeHeight', resizeHeight.value);
      formData.append('maintainAR', maintainAR.checked);
      formData.append('noUpscale',  noUpscale.checked);
    }

    try {
      const res = await fetch('/convert', { method: 'POST', body: formData });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || 'Conversion failed.');

      convertedFiles = json.files;
      renderResults();
    } catch (err) {
      showToast(err.message, true);
      progress.replaceWith(actionsRow);
      convertBtn.disabled = false;
      clearBtn.disabled = false;
    }
  });

  // ── Results rendering ──────────────────────────────────────────────────────
  function renderResults() {
    document.querySelector('.upload-card').hidden = true;
    resultsCard.hidden = false;
    resultsList.innerHTML = '';

    convertedFiles.forEach((file) => {
      const item = document.createElement('div');
      item.className = 'result-item';

      const dataUrl = `data:image/webp;base64,${file.data}`;

      const thumb = document.createElement('img');
      thumb.className = 'result-item-thumb';
      thumb.src = dataUrl;
      thumb.alt = file.outputName;

      const info = document.createElement('div');
      info.className = 'result-item-info';

      const nameLine = document.createElement('div');
      nameLine.className = 'result-item-name';
      nameLine.textContent = file.outputName;
      nameLine.title = file.outputName;

      const savings = file.originalSize > 0
        ? Math.round((1 - file.convertedSize / file.originalSize) * 100)
        : 0;
      const savingsClass = savings >= 0 ? '' : ' negative';

      const meta = document.createElement('div');
      meta.className = 'result-item-meta';
      const dimStr = file.outputWidth ? ` &bull; ${file.outputWidth}&thinsp;×&thinsp;${file.outputHeight}&thinsp;px` : '';
      meta.innerHTML = `${formatBytes(file.originalSize)} → ${formatBytes(file.convertedSize)}${dimStr} &nbsp;<span class="savings-badge${savingsClass}">${savings >= 0 ? '-' : '+'}${Math.abs(savings)}%</span>`;

      info.append(nameLine, meta);

      const dlBtn = document.createElement('button');
      dlBtn.className = 'result-download-btn';
      dlBtn.title = `Download ${file.outputName}`;
      dlBtn.setAttribute('aria-label', `Download ${file.outputName}`);
      dlBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
      dlBtn.addEventListener('click', () => downloadFile(file));

      item.append(thumb, info, dlBtn);
      resultsList.appendChild(item);
    });
  }

  downloadAllBtn.addEventListener('click', () => {
    convertedFiles.forEach((file, i) => {
      setTimeout(() => downloadFile(file), i * 80);
    });
  });

  convertMoreBtn.addEventListener('click', () => {
    convertedFiles = [];
    resetUpload();
    document.querySelector('.upload-card').hidden = false;
    resultsCard.hidden = true;
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function downloadFile(file) {
    const a = document.createElement('a');
    a.href = `data:image/webp;base64,${file.data}`;
    a.download = file.outputName;
    a.click();
  }

  function resetUpload() {
    selectedFiles = [];
    renderFileList();

    const existingProgress = document.querySelector('.progress-overlay');
    if (existingProgress) {
      existingProgress.replaceWith(actionsRow);
    }

    actionsRow.hidden = true;
    convertBtn.disabled = false;
    clearBtn.disabled = false;

    // Re-attach actionsRow if it was detached
    if (!actionsRow.isConnected) {
      document.querySelector('.upload-card').appendChild(actionsRow);
    }
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function showToast(msg, isError = false) {
    clearTimeout(toastTimer);
    toast.textContent = msg;
    toast.className = 'toast show' + (isError ? ' error' : '');
    toastTimer = setTimeout(() => { toast.className = 'toast'; }, 4000);
  }
})();

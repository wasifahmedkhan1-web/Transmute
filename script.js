const CONVERSION_MODES = {
  img2pdf: {
    accept: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp'],
    extensions: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'],
    hint: 'PNG, JPG, WebP, GIF, or BMP. Files will be merged into a single multi-page PDF.',
    supportsQuality: false,
    supportsScale: false,
    category: 'documents'
  },
  png2jpg: {
    accept: ['image/png'],
    extensions: ['.png'],
    hint: 'PNG images with transparent areas will get a clean white background.',
    supportsQuality: true,
    supportsScale: true,
    category: 'images'
  },
  png2webp: {
    accept: ['image/png'],
    extensions: ['.png'],
    hint: 'Converts PNG to WebP while preserving transparency with superior compression.',
    supportsQuality: true,
    supportsScale: true,
    category: 'images'
  },
  jpg2webp: {
    accept: ['image/jpeg'],
    extensions: ['.jpg', '.jpeg'],
    hint: 'Significantly reduces JPG image sizes using the modern WebP format.',
    supportsQuality: true,
    supportsScale: true,
    category: 'images'
  },
  jpg2png: {
    accept: ['image/jpeg'],
    extensions: ['.jpg', '.jpeg'],
    hint: 'Converts JPG images to universally compatible lossless PNG format.',
    supportsQuality: false,
    supportsScale: true,
    category: 'images'
  },
  webp2png: {
    accept: ['image/webp'],
    extensions: ['.webp'],
    hint: 'Converts modern WebP images back into universally compatible PNG format.',
    supportsQuality: false,
    supportsScale: true,
    category: 'images'
  },
  webp2jpg: {
    accept: ['image/webp'],
    extensions: ['.webp'],
    hint: 'Converts WebP images into standard JPG images.',
    supportsQuality: true,
    supportsScale: true,
    category: 'images'
  },
  svg2png: {
    accept: ['image/svg+xml'],
    extensions: ['.svg'],
    hint: 'Renders scalable vector SVG graphics into crisp high-resolution PNG images.',
    supportsQuality: false,
    supportsScale: true,
    category: 'images'
  },
  word2pdf: {
    accept: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    extensions: ['.docx'],
    hint: 'Supports standard Word documents (.docx). Older .doc files are not supported.',
    supportsQuality: false,
    supportsScale: false,
    category: 'documents'
  }
};

const dom = {
  mode: document.getElementById('mode'),
  chips: document.querySelectorAll('.chip'),
  filterTabs: document.querySelectorAll('.filter-tab'),
  tuningPanel: document.getElementById('tuningPanel'),
  qualityRow: document.getElementById('qualityRow'),
  quality: document.getElementById('quality'),
  qualityVal: document.getElementById('qualityVal'),
  scaleRow: document.getElementById('scaleRow'),
  scaleSelect: document.getElementById('scaleSelect'),
  drop: document.getElementById('drop'),
  fileInput: document.getElementById('file'),
  hint: document.getElementById('hint'),
  fileSummary: document.getElementById('fileSummary'),
  fileCount: document.getElementById('fileCount'),
  totalSize: document.getElementById('totalSize'),
  clearAll: document.getElementById('clearAll'),
  fileList: document.getElementById('files'),
  convertBtn: document.getElementById('convert'),
  convertSpinner: document.getElementById('convertSpinner'),
  convertText: document.getElementById('convertText'),
  progressWrap: document.getElementById('progressWrap'),
  progressBar: document.getElementById('progressBar'),
  status: document.getElementById('status'),
  resultsActions: document.getElementById('resultsActions'),
  downloadZip: document.getElementById('downloadZip'),
  startNewBatch: document.getElementById('startNewBatch'),
  resultsList: document.getElementById('results'),
  themeToggle: document.getElementById('themeToggle'),
  backToTop: document.getElementById('backToTop'),
  previewModal: document.getElementById('previewModal'),
  modalClose: document.getElementById('modalClose'),
  modalTitle: document.getElementById('modalTitle'),
  modalImg: document.getElementById('modalImg'),
  modalMeta: document.getElementById('modalMeta'),
  modalDownload: document.getElementById('modalDownload'),
  toast: document.getElementById('toast')
};

let queue = [];
const queueUrls = new Set();
const resultUrls = new Set();
let convertedArtifacts = [];
let toastTimeout = null;
let lastFocusedElement = null;

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function getBaseName(filename) {
  return filename.replace(/\.[^/.]+$/, '');
}

function showToast(message, duration = 2400) {
  if (!dom.toast) return;
  clearTimeout(toastTimeout);
  dom.toast.textContent = message;
  dom.toast.hidden = false;
  toastTimeout = setTimeout(() => {
    dom.toast.hidden = true;
  }, duration);
}

function setStatus(text, variant = '') {
  dom.status.textContent = text;
  dom.status.className = variant ? `status ${variant}` : 'status';
}

function setProgress(percent) {
  if (percent >= 0 && percent <= 100) {
    dom.progressWrap.hidden = false;
    dom.progressBar.style.width = `${percent}%`;
  } else {
    dom.progressWrap.hidden = true;
    dom.progressBar.style.width = '0%';
  }
}

function isFileSupported(file, modeKey = dom.mode.value) {
  const mode = CONVERSION_MODES[modeKey];
  if (!mode) return false;
  const name = file.name.toLowerCase();
  const matchesExt = mode.extensions.some((ext) => name.endsWith(ext));
  const matchesMime = mode.accept.includes(file.type);
  return matchesExt || matchesMime;
}

function updateTuningVisibility() {
  const mode = CONVERSION_MODES[dom.mode.value];
  dom.qualityRow.style.display = mode.supportsQuality ? 'flex' : 'none';
  dom.scaleRow.style.display = mode.supportsScale ? 'flex' : 'none';
  dom.tuningPanel.style.display = (mode.supportsQuality || mode.supportsScale) ? 'grid' : 'none';
}

function initTheme() {
  const saved = localStorage.getItem('transmute-theme');
  if (saved === 'dark' || saved === 'light') {
    document.documentElement.setAttribute('data-theme', saved);
  } else {
    document.documentElement.setAttribute('data-theme', 'auto');
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const isDark = current === 'dark' || (current === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const next = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('transmute-theme', next);
  showToast(`Switched to ${next} theme`);
}

function handleCategoryFilter(filterName) {
  dom.filterTabs.forEach((tab) => {
    const isSelected = tab.dataset.filter === filterName;
    tab.classList.toggle('active', isSelected);
    tab.setAttribute('aria-selected', isSelected ? 'true' : 'false');
  });

  let activeChipStillVisible = false;
  let firstVisibleChip = null;

  dom.chips.forEach((chip) => {
    const chipMode = chip.dataset.mode;
    const modeConfig = CONVERSION_MODES[chipMode];
    let show = true;
    if (filterName === 'images') show = modeConfig.category === 'images';
    else if (filterName === 'documents') show = modeConfig.category === 'documents';

    chip.setAttribute('data-hidden', show ? 'false' : 'true');

    if (show) {
      if (!firstVisibleChip) firstVisibleChip = chip;
      if (chip.classList.contains('active')) activeChipStillVisible = true;
    }
  });

  if (!activeChipStillVisible && firstVisibleChip) {
    firstVisibleChip.click();
  }
}

function renderQueue() {
  dom.fileList.innerHTML = '';
  const isImg2Pdf = dom.mode.value === 'img2pdf';
  let totalBytes = 0;

  queue.forEach((item, index) => {
    totalBytes += item.file.size;
    const li = document.createElement('li');

    if (item.file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.className = 'thumb-preview';
      img.alt = item.file.name;
      img.src = item.previewUrl;
      img.title = 'Inspect preview';
      img.onclick = () => openPreviewModal(item.previewUrl, item.file.name, item.dimensions, item.file.size);
      li.appendChild(img);
    } else {
      const icon = document.createElement('div');
      icon.className = 'doc-icon';
      icon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
      li.appendChild(icon);
    }

    const info = document.createElement('div');
    info.className = 'file-info';

    const name = document.createElement('span');
    name.className = 'file-name';
    name.textContent = item.file.name;

    const metaRow = document.createElement('div');
    metaRow.className = 'file-meta-row';

    const sizeSpan = document.createElement('span');
    sizeSpan.textContent = formatBytes(item.file.size);
    metaRow.appendChild(sizeSpan);

    if (item.dimensions) {
      const dim = document.createElement('span');
      dim.className = 'dim-pill';
      dim.textContent = `${item.dimensions.width}×${item.dimensions.height}`;
      metaRow.appendChild(dim);
    }

    info.append(name, metaRow);
    li.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'file-actions';

    if (isImg2Pdf && queue.length > 1) {
      if (index > 0) {
        const upBtn = document.createElement('button');
        upBtn.type = 'button';
        upBtn.className = 'btn-icon';
        upBtn.title = 'Move up';
        upBtn.setAttribute('aria-label', `Move ${item.file.name} up`);
        upBtn.innerHTML = '↑';
        upBtn.onclick = () => {
          const temp = queue[index];
          queue[index] = queue[index - 1];
          queue[index - 1] = temp;
          renderQueue();
        };
        actions.appendChild(upBtn);
      }

      if (index < queue.length - 1) {
        const downBtn = document.createElement('button');
        downBtn.type = 'button';
        downBtn.className = 'btn-icon';
        downBtn.title = 'Move down';
        downBtn.setAttribute('aria-label', `Move ${item.file.name} down`);
        downBtn.innerHTML = '↓';
        downBtn.onclick = () => {
          const temp = queue[index];
          queue[index] = queue[index + 1];
          queue[index + 1] = temp;
          renderQueue();
        };
        actions.appendChild(downBtn);
      }
    }

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-icon btn-remove';
    removeBtn.title = `Remove ${item.file.name}`;
    removeBtn.setAttribute('aria-label', `Remove ${item.file.name}`);
    removeBtn.innerHTML = '✕';
    removeBtn.onclick = () => {
      URL.revokeObjectURL(item.previewUrl);
      queueUrls.delete(item.previewUrl);
      queue.splice(index, 1);
      renderQueue();
    };
    actions.appendChild(removeBtn);

    li.appendChild(actions);
    dom.fileList.appendChild(li);
  });

  const count = queue.length;
  dom.convertBtn.disabled = count === 0;
  dom.fileSummary.hidden = count === 0;
  dom.fileCount.textContent = `${count} ${count === 1 ? 'file' : 'files'} selected`;
  dom.totalSize.textContent = count > 0 ? `(${formatBytes(totalBytes)})` : '';
}

async function addFilesToQueue(fileList) {
  const incoming = Array.from(fileList);
  const valid = incoming.filter((f) => isFileSupported(f));

  if (valid.length < incoming.length) {
    const skipped = incoming.length - valid.length;
    setStatus(`${skipped} file(s) skipped (unsupported format for ${dom.mode.value}).`, 'err');
  }

  for (const file of valid) {
    const previewUrl = URL.createObjectURL(file);
    queueUrls.add(previewUrl);

    let dimensions = null;
    if (file.type.startsWith('image/') && file.type !== 'image/svg+xml') {
      try {
        const img = await loadImageElement(previewUrl);
        dimensions = { width: img.naturalWidth, height: img.naturalHeight };
      } catch (e) {}
    }

    queue.push({ file, previewUrl, dimensions });
  }

  renderQueue();
}

function clearQueue() {
  queueUrls.forEach((url) => URL.revokeObjectURL(url));
  queueUrls.clear();
  queue = [];
  renderQueue();
}

function resetResults() {
  resultUrls.forEach((url) => URL.revokeObjectURL(url));
  resultUrls.clear();
  convertedArtifacts = [];
  dom.resultsList.innerHTML = '';
  dom.resultsActions.hidden = true;
  setProgress(-1);
  setStatus('');
}

function handleModeChange(newModeKey) {
  dom.mode.value = newModeKey;
  const config = CONVERSION_MODES[newModeKey];
  dom.fileInput.accept = config.extensions.join(',');
  dom.hint.textContent = config.hint;
  updateTuningVisibility();

  const compatible = [];
  const incompatible = [];

  queue.forEach((item) => {
    if (isFileSupported(item.file, newModeKey)) {
      compatible.push(item);
    } else {
      incompatible.push(item);
      URL.revokeObjectURL(item.previewUrl);
      queueUrls.delete(item.previewUrl);
    }
  });

  queue = compatible;
  resetResults();

  if (incompatible.length > 0 && queue.length > 0) {
    setStatus(`Switched mode. Retained ${queue.length} compatible file(s).`, 'ok');
  }

  renderQueue();
}

function loadImageElement(source) {
  return new Promise((resolve, reject) => {
    const isBlobOrFile = typeof source !== 'string';
    const objectUrl = isBlobOrFile ? URL.createObjectURL(source) : source;
    const img = new Image();

    img.onload = () => {
      if (isBlobOrFile) URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = () => {
      if (isBlobOrFile) URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image.'));
    };

    img.src = objectUrl;
  });
}

async function loadSvgElement(file) {
  const text = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) throw new Error('Invalid SVG content.');

  if (!svg.getAttribute('xmlns')) {
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }

  let w = parseFloat(svg.getAttribute('width'));
  let h = parseFloat(svg.getAttribute('height'));

  if (!w || !h) {
    const viewBox = svg.getAttribute('viewBox');
    if (viewBox) {
      const parts = viewBox.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        w = parts[2];
        h = parts[3];
      }
    }
  }

  w = w || 1200;
  h = h || 1200;

  if (!svg.getAttribute('width')) svg.setAttribute('width', w);
  if (!svg.getAttribute('height')) svg.setAttribute('height', h);

  const serialized = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to render SVG onto canvas.'));
    };
    img.src = url;
  });
}

function renderImageToCanvas(image, fillWhiteBackground = false, scale = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext('2d');

  if (fillWhiteBackground) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function exportCanvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob && blob.type === mimeType) {
        resolve(blob);
      } else {
        reject(new Error(`${mimeType} export is not supported in this browser.`));
      }
    }, mimeType, quality);
  });
}

function openPreviewModal(url, filename, dimensions, size) {
  lastFocusedElement = document.activeElement;
  dom.modalImg.src = url;
  dom.modalTitle.textContent = filename;
  const dimStr = dimensions ? `${dimensions.width}×${dimensions.height} px &bull; ` : '';
  dom.modalMeta.innerHTML = `${dimStr}${formatBytes(size)}`;
  dom.modalDownload.href = url;
  dom.modalDownload.download = filename;
  dom.previewModal.hidden = false;
  dom.previewModal.setAttribute('aria-hidden', 'false');
  dom.modalClose.focus();
}

function closePreviewModal() {
  dom.previewModal.hidden = true;
  dom.previewModal.setAttribute('aria-hidden', 'true');
  dom.modalImg.src = '';
  if (lastFocusedElement) {
    try { lastFocusedElement.focus(); } catch (e) {}
  }
}

async function copyBlobToClipboard(blob) {
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      let pngBlob = blob;
      if (blob.type !== 'image/png') {
        const img = await loadImageElement(blob);
        const canvas = renderImageToCanvas(img, false, 1);
        pngBlob = await exportCanvasToBlob(canvas, 'image/png', 1);
      }
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': pngBlob })
      ]);
      showToast('Image copied to clipboard');
      return true;
    }
  } catch (err) {
    console.warn('Clipboard write error:', err);
  }
  showToast('Clipboard copy unavailable');
  return false;
}

function appendResultItem(blob, outputFilename, originalFile) {
  const downloadUrl = URL.createObjectURL(blob);
  resultUrls.add(downloadUrl);
  convertedArtifacts.push({ name: outputFilename, blob, url: downloadUrl });

  const li = document.createElement('li');

  const info = document.createElement('div');
  info.className = 'result-info';

  const title = document.createElement('span');
  title.className = 'result-name';
  title.textContent = outputFilename;

  const meta = document.createElement('div');
  meta.className = 'result-meta';

  if (originalFile) {
    const origSize = originalFile.size;
    const newSize = blob.size;
    const sizeDiff = origSize - newSize;
    const percent = Math.round((Math.abs(sizeDiff) / origSize) * 100);

    const sizeSummary = document.createElement('span');
    sizeSummary.textContent = `${formatBytes(origSize)} → ${formatBytes(newSize)}`;
    meta.appendChild(sizeSummary);

    if (newSize < origSize && percent > 0) {
      const tag = document.createElement('span');
      tag.className = 'savings-tag';
      tag.textContent = `-${percent}%`;
      meta.appendChild(tag);
    }
  } else {
    const sizeLabel = document.createElement('span');
    sizeLabel.textContent = formatBytes(blob.size);
    meta.appendChild(sizeLabel);
  }

  info.append(title, meta);

  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'result-buttons';

  if (blob.type.startsWith('image/')) {
    const previewBtn = document.createElement('button');
    previewBtn.type = 'button';
    previewBtn.className = 'btn-action-icon';
    previewBtn.title = 'Inspect preview';
    previewBtn.setAttribute('aria-label', `Preview ${outputFilename}`);
    previewBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    previewBtn.onclick = () => openPreviewModal(downloadUrl, outputFilename, null, blob.size);
    buttonGroup.appendChild(previewBtn);

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn-action-icon';
    copyBtn.title = 'Copy image to clipboard';
    copyBtn.setAttribute('aria-label', `Copy ${outputFilename}`);
    copyBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
    copyBtn.onclick = () => copyBlobToClipboard(blob);
    buttonGroup.appendChild(copyBtn);
  }

  const downloadLink = document.createElement('a');
  downloadLink.href = downloadUrl;
  downloadLink.download = outputFilename;
  downloadLink.className = 'btn-download';
  downloadLink.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    Download
  `;
  buttonGroup.appendChild(downloadLink);

  li.append(info, buttonGroup);
  dom.resultsList.appendChild(li);

  if (convertedArtifacts.length > 0) {
    dom.resultsActions.hidden = false;
  }
}

async function convertImagesToPdf() {
  const JsPdfClass = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
  if (!JsPdfClass) throw new Error('PDF conversion library failed to load.');

  let doc = null;

  for (let i = 0; i < queue.length; i++) {
    setStatus(`Processing image ${i + 1} of ${queue.length}...`);
    setProgress(((i + 1) / (queue.length + 1)) * 100);

    const img = await loadImageElement(queue[i].file);
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    const canvas = renderImageToCanvas(img, true, 1);
    const orientation = width > height ? 'l' : 'p';

    if (!doc) {
      doc = new JsPdfClass({
        unit: 'px',
        format: [width, height],
        orientation,
        hotfixes: ['px_scaling']
      });
    } else {
      doc.addPage([width, height], orientation);
    }

    doc.addImage(canvas, 'JPEG', 0, 0, width, height);
  }

  setStatus('Compiling PDF document...');
  const pdfBlob = doc.output('blob');
  const outputName = `${queue.length === 1 ? getBaseName(queue[0].file.name) : 'converted_images'}.pdf`;
  appendResultItem(pdfBlob, outputName, queue.length === 1 ? queue[0].file : null);
}

async function convertRasterImages(targetMime, targetExt, fillWhite) {
  const quality = parseFloat(dom.quality.value) || 0.92;
  const scale = parseFloat(dom.scaleSelect.value) || 1;

  for (let i = 0; i < queue.length; i++) {
    setStatus(`Converting file ${i + 1} of ${queue.length}...`);
    setProgress(((i + 1) / queue.length) * 100);

    const current = queue[i].file;
    const img = await loadImageElement(current);
    const canvas = renderImageToCanvas(img, fillWhite, scale);
    const blob = await exportCanvasToBlob(canvas, targetMime, quality);
    const outputName = `${getBaseName(current.name)}${targetExt}`;

    appendResultItem(blob, outputName, current);
  }
}

async function convertSvgToPng() {
  const scale = parseFloat(dom.scaleSelect.value) || 1;

  for (let i = 0; i < queue.length; i++) {
    setStatus(`Rendering SVG ${i + 1} of ${queue.length}...`);
    setProgress(((i + 1) / queue.length) * 100);

    const current = queue[i].file;
    const img = await loadSvgElement(current);
    const canvas = renderImageToCanvas(img, false, scale);
    const blob = await exportCanvasToBlob(canvas, 'image/png', 1);
    const outputName = `${getBaseName(current.name)}.png`;

    appendResultItem(blob, outputName, current);
  }
}

async function convertWordToPdf() {
  if (typeof mammoth === 'undefined' || typeof html2pdf === 'undefined') {
    throw new Error('Word to PDF dependencies are not fully loaded.');
  }

  for (let i = 0; i < queue.length; i++) {
    setStatus(`Converting Word document ${i + 1} of ${queue.length}...`);
    setProgress(((i + 1) / queue.length) * 100);

    const current = queue[i].file;
    const arrayBuffer = await current.arrayBuffer();
    const { value: parsedHtml } = await mammoth.convertToHtml({ arrayBuffer });

    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-9999px;top:0;width:740px;padding:36px;font:14px/1.6 Arial,Helvetica,sans-serif;color:#111;background:#fff;';
    container.innerHTML = `
      <style>
        table { border-collapse: collapse; width: 100%; margin: 16px 0; }
        th, td { border: 1px solid #ccc; padding: 8px 12px; font-size: 13px; text-align: left; }
        th { background: #f4f6f8; font-weight: 700; }
        h1, h2, h3 { margin: 16px 0 8px; color: #0a2d33; }
        img { max-width: 100%; height: auto; }
        p { margin: 0 0 10px; }
      </style>
      ${parsedHtml}
    `;

    document.body.appendChild(container);

    try {
      const blob = await html2pdf()
        .set({
          margin: [12, 12, 12, 12],
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        })
        .from(container)
        .outputPdf('blob');

      const outputName = `${getBaseName(current.name)}.pdf`;
      appendResultItem(blob, outputName, current);
    } finally {
      container.remove();
    }
  }
}

async function executeConversion() {
  if (queue.length === 0) return;

  resetResults();
  dom.convertBtn.disabled = true;
  dom.convertSpinner.hidden = false;
  dom.convertText.textContent = 'Processing...';
  const modeKey = dom.mode.value;

  try {
    switch (modeKey) {
      case 'img2pdf':
        await convertImagesToPdf();
        break;
      case 'png2jpg':
        await convertRasterImages('image/jpeg', '.jpg', true);
        break;
      case 'png2webp':
        await convertRasterImages('image/webp', '.webp', false);
        break;
      case 'jpg2webp':
        await convertRasterImages('image/webp', '.webp', false);
        break;
      case 'jpg2png':
        await convertRasterImages('image/png', '.png', false);
        break;
      case 'webp2png':
        await convertRasterImages('image/png', '.png', false);
        break;
      case 'webp2jpg':
        await convertRasterImages('image/jpeg', '.jpg', true);
        break;
      case 'svg2png':
        await convertSvgToPng();
        break;
      case 'word2pdf':
        await convertWordToPdf();
        break;
      default:
        throw new Error('Unsupported conversion format.');
    }

    setProgress(100);
    setStatus(`Done! Generated ${convertedArtifacts.length} file(s).`, 'ok');
    showToast('Conversion complete! Files ready to download.');
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message}`, 'err');
  } finally {
    dom.convertBtn.disabled = queue.length === 0;
    dom.convertSpinner.hidden = true;
    dom.convertText.textContent = 'Convert now';
  }
}

async function createBatchZip() {
  if (convertedArtifacts.length === 0) return;

  if (!window.JSZip) {
    showToast('ZIP library unavailable. Please download files individually.');
    return;
  }

  const zip = new window.JSZip();
  convertedArtifacts.forEach((item) => {
    zip.file(item.name, item.blob);
  });

  setStatus('Building ZIP archive...');
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const zipUrl = URL.createObjectURL(zipBlob);
  resultUrls.add(zipUrl);

  const anchor = document.createElement('a');
  anchor.href = zipUrl;
  anchor.download = 'transmute_converted_files.zip';
  anchor.click();

  setStatus('ZIP archive downloaded successfully.', 'ok');
  showToast('ZIP archive downloaded');
}

dom.chips.forEach((chip) => {
  chip.addEventListener('click', () => {
    dom.chips.forEach((c) => {
      c.classList.remove('active');
      c.setAttribute('aria-checked', 'false');
      c.tabIndex = -1;
    });

    chip.classList.add('active');
    chip.setAttribute('aria-checked', 'true');
    chip.tabIndex = 0;
    chip.focus();

    handleModeChange(chip.dataset.mode);
  });

  chip.addEventListener('keydown', (e) => {
    let targetIndex = null;
    const visibleChips = Array.from(dom.chips).filter((c) => c.getAttribute('data-hidden') !== 'true');
    const currIdx = visibleChips.indexOf(chip);

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      targetIndex = (currIdx + 1) % visibleChips.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      targetIndex = (currIdx - 1 + visibleChips.length) % visibleChips.length;
    } else if (e.key === 'Home') {
      targetIndex = 0;
    } else if (e.key === 'End') {
      targetIndex = visibleChips.length - 1;
    }

    if (targetIndex !== null && visibleChips[targetIndex]) {
      e.preventDefault();
      visibleChips[targetIndex].click();
    }
  });
});

dom.filterTabs.forEach((tab) => {
  tab.addEventListener('click', () => handleCategoryFilter(tab.dataset.filter));
});

dom.quality.addEventListener('input', () => {
  const percent = Math.round(parseFloat(dom.quality.value) * 100);
  dom.qualityVal.textContent = `${percent}%`;
});

dom.drop.addEventListener('click', () => dom.fileInput.click());

dom.drop.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    dom.fileInput.click();
  }
});

dom.fileInput.addEventListener('change', () => {
  if (dom.fileInput.files.length > 0) {
    addFilesToQueue(dom.fileInput.files);
    dom.fileInput.value = '';
  }
});

dom.drop.addEventListener('dragover', (e) => {
  e.preventDefault();
  dom.drop.classList.add('dragover');
});

dom.drop.addEventListener('dragleave', () => {
  dom.drop.classList.remove('dragover');
});

dom.drop.addEventListener('drop', (e) => {
  e.preventDefault();
  dom.drop.classList.remove('dragover');
  if (e.dataTransfer && e.dataTransfer.files.length > 0) {
    addFilesToQueue(e.dataTransfer.files);
  }
});

window.addEventListener('paste', (e) => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
    return;
  }

  const items = e.clipboardData && e.clipboardData.items;
  if (!items) return;

  const files = [];
  for (const item of items) {
    if (item.kind === 'file') {
      const f = item.getAsFile();
      if (f) files.push(f);
    }
  }

  if (files.length > 0) {
    addFilesToQueue(files);
    showToast(`Pasted ${files.length} image(s) from clipboard`);
  }
});

window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

dom.clearAll.addEventListener('click', clearQueue);
dom.convertBtn.addEventListener('click', executeConversion);
dom.downloadZip.addEventListener('click', createBatchZip);

dom.startNewBatch.addEventListener('click', () => {
  clearQueue();
  resetResults();
  dom.fileInput.value = '';
  document.getElementById('converter').scrollIntoView({ behavior: 'smooth' });
});

dom.themeToggle.addEventListener('click', toggleTheme);

dom.backToTop.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

dom.modalClose.addEventListener('click', closePreviewModal);
dom.previewModal.addEventListener('click', (e) => {
  if (e.target === dom.previewModal) closePreviewModal();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !dom.previewModal.hidden) closePreviewModal();
});

initTheme();
handleModeChange('img2pdf');

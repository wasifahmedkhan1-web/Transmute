const CONVERSION_MODES = {
  img2pdf: {
    accept: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp'],
    extensions: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'],
    hint: 'PNG, JPG, WebP, GIF, or BMP. Files will be merged into a single PDF.',
    supportsQuality: false
  },
  png2jpg: {
    accept: ['image/png'],
    extensions: ['.png'],
    hint: 'PNG images with transparent areas will get a clean white background.',
    supportsQuality: true
  },
  png2webp: {
    accept: ['image/png'],
    extensions: ['.png'],
    hint: 'Converts PNG to WebP while preserving transparency with superior compression.',
    supportsQuality: true
  },
  jpg2webp: {
    accept: ['image/jpeg'],
    extensions: ['.jpg', '.jpeg'],
    hint: 'Significantly reduces JPG image sizes using the modern WebP format.',
    supportsQuality: true
  },
  webp2png: {
    accept: ['image/webp'],
    extensions: ['.webp'],
    hint: 'Converts modern WebP images back into universally compatible PNG format.',
    supportsQuality: false
  },
  webp2jpg: {
    accept: ['image/webp'],
    extensions: ['.webp'],
    hint: 'Converts WebP images into standard JPG images.',
    supportsQuality: true
  },
  word2pdf: {
    accept: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    extensions: ['.docx'],
    hint: 'Supports standard Word documents (.docx). Older .doc files are not supported.',
    supportsQuality: false
  }
};

const dom = {
  mode: document.getElementById('mode'),
  chips: document.querySelectorAll('.chip'),
  qualityRow: document.getElementById('qualityRow'),
  quality: document.getElementById('quality'),
  qualityVal: document.getElementById('qualityVal'),
  drop: document.getElementById('drop'),
  fileInput: document.getElementById('file'),
  hint: document.getElementById('hint'),
  fileSummary: document.getElementById('fileSummary'),
  fileCount: document.getElementById('fileCount'),
  clearAll: document.getElementById('clearAll'),
  fileList: document.getElementById('files'),
  convertBtn: document.getElementById('convert'),
  progressWrap: document.getElementById('progressWrap'),
  progressBar: document.getElementById('progressBar'),
  status: document.getElementById('status'),
  resultsActions: document.getElementById('resultsActions'),
  downloadZip: document.getElementById('downloadZip'),
  resultsList: document.getElementById('results')
};

let queue = [];
let generatedUrls = new Set();
let convertedArtifacts = [];

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function getBaseName(filename) {
  return filename.replace(/\.[^/.]+$/, '');
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

function clearGeneratedUrls() {
  generatedUrls.forEach((url) => URL.revokeObjectURL(url));
  generatedUrls.clear();
}

function isFileSupported(file, modeKey = dom.mode.value) {
  const mode = CONVERSION_MODES[modeKey];
  const name = file.name.toLowerCase();
  const matchesExt = mode.extensions.some((ext) => name.endsWith(ext));
  const matchesMime = mode.accept.includes(file.type);
  return matchesExt || matchesMime;
}

function updateQualityVisibility() {
  const mode = CONVERSION_MODES[dom.mode.value];
  dom.qualityRow.style.display = mode.supportsQuality ? 'flex' : 'none';
}

function renderQueue() {
  dom.fileList.innerHTML = '';
  const isImg2Pdf = dom.mode.value === 'img2pdf';

  queue.forEach((item, index) => {
    const li = document.createElement('li');

    if (item.file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.className = 'thumb-preview';
      img.alt = item.file.name;
      img.src = item.previewUrl;
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

    const meta = document.createElement('span');
    meta.className = 'file-meta';
    meta.textContent = formatBytes(item.file.size);

    info.append(name, meta);
    li.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'file-actions';

    if (isImg2Pdf && queue.length > 1) {
      if (index > 0) {
        const upBtn = document.createElement('button');
        upBtn.type = 'button';
        upBtn.className = 'btn-icon';
        upBtn.title = 'Move up';
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
}

function addFilesToQueue(fileList) {
  const incoming = Array.from(fileList);
  const valid = incoming.filter((f) => isFileSupported(f));

  if (valid.length < incoming.length) {
    const skipped = incoming.length - valid.length;
    setStatus(`${skipped} file(s) were skipped (unsupported format for this mode).`, 'err');
  }

  valid.forEach((file) => {
    const previewUrl = URL.createObjectURL(file);
    generatedUrls.add(previewUrl);
    queue.push({ file, previewUrl });
  });

  renderQueue();
}

function clearQueue() {
  queue.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  queue = [];
  renderQueue();
}

function resetResults() {
  clearGeneratedUrls();
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
  updateQualityVisibility();

  const compatible = [];
  const incompatible = [];

  queue.forEach((item) => {
    if (isFileSupported(item.file, newModeKey)) {
      compatible.push(item);
    } else {
      incompatible.push(item);
      URL.revokeObjectURL(item.previewUrl);
    }
  });

  queue = compatible;
  resetResults();

  if (incompatible.length > 0 && queue.length > 0) {
    setStatus(`Switched mode. Retained ${queue.length} compatible file(s).`, 'ok');
  }

  renderQueue();
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to load image: ${file.name}`));
    };
    img.src = objectUrl;
  });
}

function renderImageToCanvas(image, fillWhiteBackground = false) {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext('2d');

  if (fillWhiteBackground) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(image, 0, 0);
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

function appendResultItem(blob, outputFilename, originalFile) {
  const downloadUrl = URL.createObjectURL(blob);
  generatedUrls.add(downloadUrl);
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

  const downloadLink = document.createElement('a');
  downloadLink.href = downloadUrl;
  downloadLink.download = outputFilename;
  downloadLink.className = 'btn-download';
  downloadLink.innerHTML = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    Download
  `;

  li.append(info, downloadLink);
  dom.resultsList.appendChild(li);

  if (convertedArtifacts.length > 1 && window.JSZip) {
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
    const canvas = renderImageToCanvas(img, true);
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

  for (let i = 0; i < queue.length; i++) {
    setStatus(`Converting file ${i + 1} of ${queue.length}...`);
    setProgress(((i + 1) / queue.length) * 100);

    const current = queue[i].file;
    const img = await loadImageElement(current);
    const canvas = renderImageToCanvas(img, fillWhite);
    const blob = await exportCanvasToBlob(canvas, targetMime, quality);
    const outputName = `${getBaseName(current.name)}${targetExt}`;

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
    container.style.cssText = 'width:740px;padding:36px;font:14px/1.6 Arial,Helvetica,sans-serif;color:#111;background:#fff;';
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
  }
}

async function executeConversion() {
  if (queue.length === 0) return;

  resetResults();
  dom.convertBtn.disabled = true;
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
      case 'webp2png':
        await convertRasterImages('image/png', '.png', false);
        break;
      case 'webp2jpg':
        await convertRasterImages('image/jpeg', '.jpg', true);
        break;
      case 'word2pdf':
        await convertWordToPdf();
        break;
      default:
        throw new Error('Unsupported conversion format.');
    }

    setProgress(100);
    setStatus(`Done! Generated ${convertedArtifacts.length} file(s).`, 'ok');
  } catch (err) {
    console.error(err);
    setStatus(`Error: ${err.message}`, 'err');
  } finally {
    dom.convertBtn.disabled = queue.length === 0;
  }
}

async function createBatchZip() {
  if (!window.JSZip || convertedArtifacts.length < 2) return;

  const zip = new window.JSZip();
  convertedArtifacts.forEach((item) => {
    zip.file(item.name, item.blob);
  });

  setStatus('Building ZIP archive...');
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const zipUrl = URL.createObjectURL(zipBlob);
  generatedUrls.add(zipUrl);

  const anchor = document.createElement('a');
  anchor.href = zipUrl;
  anchor.download = 'transmute_converted_files.zip';
  anchor.click();

  setStatus('ZIP archive downloaded successfully.', 'ok');
}

dom.chips.forEach((chip, index) => {
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

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      targetIndex = (index + 1) % dom.chips.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      targetIndex = (index - 1 + dom.chips.length) % dom.chips.length;
    } else if (e.key === 'Home') {
      targetIndex = 0;
    } else if (e.key === 'End') {
      targetIndex = dom.chips.length - 1;
    }

    if (targetIndex !== null) {
      e.preventDefault();
      dom.chips[targetIndex].click();
    }
  });
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

window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

dom.clearAll.addEventListener('click', clearQueue);
dom.convertBtn.addEventListener('click', executeConversion);
dom.downloadZip.addEventListener('click', createBatchZip);

handleModeChange('img2pdf');

/**
 * Whisper AI — Frontend Application Logic
 * Handles file upload, mic recording, API communication, and result display.
 */

const API_BASE = window.location.origin;

// ── DOM References ──────────────────────────────────────────────────
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const fileRemove = document.getElementById('fileRemove');
const micBtn = document.getElementById('micBtn');
const recordingIndicator = document.getElementById('recordingIndicator');
const recTimer = document.getElementById('recTimer');
const transcribeBtn = document.getElementById('transcribeBtn');

const modelSelect = document.getElementById('modelSelect');
const deviceSelect = document.getElementById('deviceSelect');
const languageSelect = document.getElementById('languageSelect');
const taskSelect = document.getElementById('taskSelect');
const targetLanguageContainer = document.getElementById('targetLanguageContainer');
const targetLanguageSelect = document.getElementById('targetLanguageSelect');
const applyConfigBtn = document.getElementById('applyConfigBtn');

const gpuName = document.getElementById('gpuName');
const vramBar = document.getElementById('vramBar');
const vramText = document.getElementById('vramText');

const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');

const processing = document.getElementById('processing');
const processingDetail = document.getElementById('processingDetail');
const emptyState = document.getElementById('emptyState');
const resultsContent = document.getElementById('resultsContent');
const resultsActions = document.getElementById('resultsActions');
const errorState = document.getElementById('errorState');
const errorText = document.getElementById('errorText');

const resultMeta = document.getElementById('resultMeta');
const resultText = document.getElementById('resultText');
const segmentsList = document.getElementById('segmentsList');
const tabText = document.getElementById('tabText');
const tabSegments = document.getElementById('tabSegments');
const textContent = document.getElementById('textContent');
const segmentsContent = document.getElementById('segmentsContent');

const copyBtn = document.getElementById('copyBtn');
const downloadTxtBtn = document.getElementById('downloadTxtBtn');
const downloadSrtBtn = document.getElementById('downloadSrtBtn');
const clearBtn = document.getElementById('clearBtn');
const toast = document.getElementById('toast');

// ── State ────────────────────────────────────────────────────────────
let selectedFile = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordingStartTime = null;
let recordingTimerInterval = null;
let lastResult = null;

// ── Initialize ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    fetchStatus();
    setInterval(fetchStatus, 10000); // Poll status every 10s

    taskSelect.addEventListener('change', (e) => {
        if (e.target.value === 'translate-other') {
            targetLanguageContainer.style.display = 'block';
        } else {
            targetLanguageContainer.style.display = 'none';
        }
    });
});

// ── Status ───────────────────────────────────────────────────────────
async function fetchStatus() {
    try {
        const res = await fetch(`${API_BASE}/api/status`);
        const data = await res.json();

        if (data.model_loaded) {
            setStatus('ready', `${data.model_name} on ${data.device}`);
        } else {
            setStatus('loading', 'No model loaded');
        }

        // GPU info
        if (data.cuda_available) {
            gpuName.textContent = data.gpu_name || 'CUDA GPU';
            const usedMB = data.gpu_memory_allocated_mb || 0;
            const totalMB = data.gpu_memory_total_mb || 1;
            const pct = Math.round((usedMB / totalMB) * 100);
            vramBar.style.width = `${pct}%`;
            vramText.textContent = `${usedMB} / ${totalMB} MB`;
        } else {
            gpuName.textContent = 'Not available';
            vramBar.style.width = '0%';
            vramText.textContent = 'CPU only';
        }

        // Sync model select
        if (data.model_name && modelSelect.value !== data.model_name) {
            modelSelect.value = data.model_name;
        }
    } catch (e) {
        setStatus('error', 'Server offline');
    }
}

function setStatus(type, text) {
    statusBadge.className = `status-badge ${type === 'ready' ? '' : type}`;
    statusText.textContent = text;
}

// ── File Upload ──────────────────────────────────────────────────────
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
        handleFile(fileInput.files[0]);
    }
});

function handleFile(file) {
    selectedFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = formatBytes(file.size);
    fileInfo.style.display = 'block';
    transcribeBtn.disabled = false;
}

fileRemove.addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    fileInfo.style.display = 'none';
    transcribeBtn.disabled = true;
});

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

// ── Microphone Recording ─────────────────────────────────────────────
micBtn.addEventListener('click', async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        stopRecording();
    } else {
        await startRecording();
    }
});

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recordedChunks = [];

        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) recordedChunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            stream.getTracks().forEach(t => t.stop());
            const blob = new Blob(recordedChunks, { type: 'audio/webm' });
            selectedFile = new File([blob], 'recording.webm', { type: 'audio/webm' });
            handleFile(selectedFile);
            clearInterval(recordingTimerInterval);
        };

        mediaRecorder.start();
        recordingStartTime = Date.now();
        micBtn.classList.add('recording');
        micBtn.querySelector('span').textContent = 'Stop Recording';
        recordingIndicator.style.display = 'flex';

        recordingTimerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
            const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
            const secs = String(elapsed % 60).padStart(2, '0');
            recTimer.textContent = `${mins}:${secs}`;
        }, 1000);

    } catch (e) {
        showToast('Microphone access denied');
    }
}

function stopRecording() {
    if (mediaRecorder) {
        mediaRecorder.stop();
        micBtn.classList.remove('recording');
        micBtn.querySelector('span').textContent = 'Start Recording';
        recordingIndicator.style.display = 'none';
    }
}

// ── Transcription ────────────────────────────────────────────────────
transcribeBtn.addEventListener('click', () => {
    if (!selectedFile) return;
    transcribe(selectedFile);
});

async function transcribe(file) {
    showProcessing('Uploading and processing audio…');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('language', languageSelect.value);
    formData.append('task', taskSelect.value);

    if (taskSelect.value === 'translate-other') {
        formData.append('target_language', targetLanguageSelect.value);
        showProcessing(`Uploading and translating to ${targetLanguageSelect.options[targetLanguageSelect.selectedIndex].text}…`);
    }

    try {
        const res = await fetch(`${API_BASE}/api/transcribe`, {
            method: 'POST',
            body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
            showError(data.error || 'Transcription failed');
            return;
        }

        lastResult = data;
        showResult(data);
        fetchStatus(); // Refresh GPU stats
    } catch (e) {
        showError('Network error. Is the server running?');
    }
}

// ── Config ───────────────────────────────────────────────────────────
applyConfigBtn.addEventListener('click', async () => {
    const model = modelSelect.value;
    const device = deviceSelect.value;

    applyConfigBtn.disabled = true;
    applyConfigBtn.innerHTML = `
        <div class="spinner" style="width:16px;height:16px;border-width:2px;"></div>
        Loading ${model}…
    `;
    setStatus('loading', `Loading ${model}…`);

    try {
        const res = await fetch(`${API_BASE}/api/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, device }),
        });

        const data = await res.json();

        if (!res.ok) {
            showToast(`Error: ${data.error}`);
            setStatus('error', 'Load failed');
        } else {
            showToast(`Model "${model}" loaded on ${data.device} (${data.load_time_seconds}s)`);
            fetchStatus();
        }
    } catch (e) {
        showToast('Failed to connect to server');
        setStatus('error', 'Server offline');
    } finally {
        applyConfigBtn.disabled = false;
        applyConfigBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            Apply Model
        `;
    }
});

// ── Result Display ───────────────────────────────────────────────────
function showProcessing(detail) {
    emptyState.style.display = 'none';
    resultsContent.style.display = 'none';
    resultsActions.style.display = 'none';
    errorState.style.display = 'none';
    processing.style.display = 'flex';
    processingDetail.textContent = detail || 'Processing…';
    transcribeBtn.disabled = true;
}

function showResult(data) {
    processing.style.display = 'none';
    emptyState.style.display = 'none';
    errorState.style.display = 'none';
    resultsContent.style.display = 'flex';
    resultsActions.style.display = 'flex';
    transcribeBtn.disabled = false;

    // Meta tags
    resultMeta.innerHTML = `
        <span class="meta-tag">🌐 ${data.language.toUpperCase()}</span>
        <span class="meta-tag">⚡ ${data.processing_time_seconds}s</span>
        <span class="meta-tag">🤖 ${data.model}</span>
        <span class="meta-tag">💻 ${data.device}</span>
        <span class="meta-tag">📝 ${data.segments.length} segments</span>
    `;

    // Full text
    resultText.textContent = data.text;

    // Segments
    segmentsList.innerHTML = data.segments.map(seg => `
        <div class="segment">
            <span class="segment-time">${formatTime(seg.start)} → ${formatTime(seg.end)}</span>
            <span class="segment-text">${escapeHtml(seg.text)}</span>
        </div>
    `).join('');
}

function showError(msg) {
    processing.style.display = 'none';
    emptyState.style.display = 'none';
    resultsContent.style.display = 'none';
    resultsActions.style.display = 'none';
    errorState.style.display = 'flex';
    errorText.textContent = msg;
    transcribeBtn.disabled = false;
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ── Tabs ─────────────────────────────────────────────────────────────
tabText.addEventListener('click', () => {
    tabText.classList.add('active');
    tabSegments.classList.remove('active');
    textContent.style.display = 'block';
    segmentsContent.style.display = 'none';
});

tabSegments.addEventListener('click', () => {
    tabSegments.classList.add('active');
    tabText.classList.remove('active');
    segmentsContent.style.display = 'block';
    textContent.style.display = 'none';
});

// ── Action Buttons ───────────────────────────────────────────────────
copyBtn.addEventListener('click', () => {
    if (!lastResult) return;
    navigator.clipboard.writeText(lastResult.text).then(() => {
        showToast('Copied to clipboard ✓');
    });
});

downloadTxtBtn.addEventListener('click', () => {
    if (!lastResult) return;
    downloadFile(lastResult.text, 'transcription.txt', 'text/plain');
    showToast('Downloaded .txt ✓');
});

downloadSrtBtn.addEventListener('click', () => {
    if (!lastResult) return;
    const srt = lastResult.segments.map((seg, i) => {
        return `${i + 1}\n${srtTime(seg.start)} --> ${srtTime(seg.end)}\n${seg.text}\n`;
    }).join('\n');
    downloadFile(srt, 'transcription.srt', 'text/plain');
    showToast('Downloaded .srt ✓');
});

function srtTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

clearBtn.addEventListener('click', () => {
    lastResult = null;
    resultsContent.style.display = 'none';
    resultsActions.style.display = 'none';
    errorState.style.display = 'none';
    emptyState.style.display = 'flex';
});

// ── Toast ────────────────────────────────────────────────────────────
function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

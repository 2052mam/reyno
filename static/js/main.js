import { SceneManager } from './sceneSetup.js';
import { buildBoardMesh } from './boardBuilder.js';

const canvas = document.getElementById('three-canvas');
const container = document.getElementById('app');
const sceneManager = new SceneManager(canvas, container);

const dropZone = document.getElementById('dropZone');
const frontInput = document.getElementById('frontInput');
const backInput = document.getElementById('backInput');
const frontStatus = document.getElementById('frontStatus');
const backStatus = document.getElementById('backStatus');
const uploadFrontBtn = document.getElementById('uploadFrontBtn');
const uploadBackBtn = document.getElementById('uploadBackBtn');
const removeBackBtn = document.getElementById('removeBackBtn');
const mirrorToggle = document.getElementById('mirrorToggle');
const mirrorCheckbox = document.getElementById('mirrorCheckbox');
const clearBtn = document.getElementById('clearBtn');
const resetViewBtn = document.getElementById('resetViewBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const flipBoardBtn = document.getElementById('flipBoardBtn');
const flipBtnText = document.getElementById('flipBtnText');

const state = {
    frontUrl: null,
    backUrl: null,
    mirrorBack: true,
    boardSize: null,
};

function showLoading(show) {
    loadingOverlay.classList.toggle('hidden', !show);
}

function showDropZone(show) {
    dropZone.classList.toggle('hidden', !show);
}

function showFlipButton(show) {
    flipBoardBtn.classList.toggle('hidden', !show);
}

function updateSideUI() {
    frontStatus.textContent = state.frontUrl ? '✅ بارگذاری شد' : '—';
    frontStatus.style.color = state.frontUrl ? '#8be9a1' : '';

    backStatus.textContent = state.backUrl ? '✅ بارگذاری شد' : '—';
    backStatus.style.color = state.backUrl ? '#8be9a1' : '';

    removeBackBtn.classList.toggle('hidden', !state.backUrl);
    mirrorToggle.classList.toggle('hidden', !state.backUrl);
}

function updateFlipButtonText() {
    flipBtnText.textContent = sceneManager.isBack ? 'نمایش روی برد' : 'نمایش پشت برد';
}

async function uploadToServer(file, side) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('side', side);

    const res = await fetch('/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'خطا در آپلود');
    return data.image_url;
}

async function handleFile(file, side) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.png')) {
        alert('فقط فایل PNG مجاز است');
        return;
    }

    showLoading(true);
    try {
        const url = await uploadToServer(file, side);
        if (side === 'front') state.frontUrl = url;
        else state.backUrl = url;

        updateSideUI();
        await rebuildBoard();
    } catch (err) {
        console.error(err);
        alert('خطا: ' + err.message);
    } finally {
        showLoading(false);
    }
}

async function rebuildBoard() {
    if (!state.frontUrl) {
        showDropZone(true);
        showFlipButton(false);
        return;
    }
    showDropZone(false);
    const { mesh, size } = await buildBoardMesh(state.frontUrl, state.backUrl, {
        mirrorBack: state.mirrorBack,
    });
    state.boardSize = size;
    sceneManager.setBoard(mesh, size); // این خودش حالت flip رو ریست می‌کنه
    updateFlipButtonText();
    showFlipButton(true);
}

async function clearAll() {
    showLoading(true);
    try {
        await fetch('/clear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        state.frontUrl = null;
        state.backUrl = null;
        state.boardSize = null;
        sceneManager.clearBoard();
        updateSideUI();
        showDropZone(true);
        showFlipButton(false);
    } finally {
        showLoading(false);
    }
}

async function removeBackOnly() {
    showLoading(true);
    try {
        await fetch('/clear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ side: 'back' }),
        });
        state.backUrl = null;
        updateSideUI();
        await rebuildBoard();
    } finally {
        showLoading(false);
    }
}

/* ---------- رویدادها ---------- */

uploadFrontBtn.addEventListener('click', () => frontInput.click());
uploadBackBtn.addEventListener('click', () => backInput.click());
dropZone.addEventListener('click', () => frontInput.click());

frontInput.addEventListener('change', (e) => handleFile(e.target.files[0], 'front'));
backInput.addEventListener('change', (e) => handleFile(e.target.files[0], 'back'));

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-active');
});
dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-active');
});
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-active');
    const file = e.dataTransfer.files[0];
    handleFile(file, 'front');
});

mirrorCheckbox.addEventListener('change', async () => {
    state.mirrorBack = mirrorCheckbox.checked;
    if (state.backUrl) {
        showLoading(true);
        await rebuildBoard();
        showLoading(false);
    }
});

removeBackBtn.addEventListener('click', removeBackOnly);
clearBtn.addEventListener('click', clearAll);

resetViewBtn.addEventListener('click', () => {
    if (state.boardSize) sceneManager.frameBoard(state.boardSize);
});

flipBoardBtn.addEventListener('click', () => {
    if (sceneManager.isAnimating) return;
    sceneManager.flipBoard();
    updateFlipButtonText();
    flipBoardBtn.classList.add('flipping');
    setTimeout(() => {
        flipBoardBtn.classList.remove('flipping');
    }, 1350);
});

/* ---------- حالت اولیه ---------- */

(async function initialLoad() {
    state.frontUrl = window.initialFrontImage || null;
    state.backUrl = window.initialBackImage || null;
    updateSideUI();

    if (state.frontUrl) {
        showLoading(true);
        showDropZone(false);
        try {
            await rebuildBoard();
        } catch (err) {
            console.error(err);
            showDropZone(true);
        } finally {
            showLoading(false);
        }
    } else {
        showDropZone(true);
        showFlipButton(false);
    }
})();
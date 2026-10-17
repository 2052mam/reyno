import { SceneManager } from './sceneSetup.js';
import { buildBoardMesh, BOARD_WIDTH, THICKNESS } from './boardBuilder.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// Sunshine DT-17N — lazy dynamic import so main 3D board never breaks if multimeter fails
let _multimeterModule = null;
async function loadMultimeterModule() {
    if (_multimeterModule) return _multimeterModule;
    try {
        _multimeterModule = await import('./sunshineDT17N.js?v=12');
        return _multimeterModule;
    } catch (e) {
        console.warn('Multimeter module failed to load, board will still work:', e);
        return null;
    }
}
function getMultimeter() {
    // compat shim — returns singleton if already created, else null
    try {
        if (_multimeterModule && _multimeterModule.getMultimeter) return _multimeterModule.getMultimeter();
    } catch {}
    return multimeterInstance;
}
const gltfLoader = new GLTFLoader();
const glbCache = new Map(); // url -> Promise<gltf>
const modelInstanceMap = new Map(); // compId -> {group, model, materials[]}

const canvas = document.getElementById('three-canvas');
const container = document.getElementById('canvasWrap') || document.getElementById('app');
const sceneManager = new SceneManager(canvas, container);

/* ---------- DOM refs ---------- */
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

const modeSwitcher = document.getElementById('modeSwitcher');
const viewModeBtn = document.getElementById('viewModeBtn');
const editModeBtn = document.getElementById('editModeBtn');
const viewFilterBar = document.getElementById('viewFilterBar'); // legacy, hidden via CSS

const editOverlay = document.getElementById('editOverlay');
const editBoardViewport = document.getElementById('editBoardViewport');
const editBoardImage = document.getElementById('editBoardImage');
const editBoardStage = document.getElementById('editBoardStage');
const edit3DWrap = document.getElementById('edit3DWrap');
const edit3DCanvas = document.getElementById('edit3DCanvas');
const edit2DBtn = document.getElementById('edit2DBtn');
const edit3DBtn = document.getElementById('edit3DBtn');
const edit3DHint = document.getElementById('edit3DHint');
const editRectLayer = document.getElementById('editRectLayer');
const editPreviewRect = document.getElementById('editPreviewRect');
const editSideBadge = document.getElementById('editSideBadge');
const editHint = document.getElementById('editHint');
const componentPalette = document.getElementById('componentPalette');
const paletteBtns = document.querySelectorAll('.palette-btn');
const editFlipBtn = document.getElementById('editFlipBtn');
const editFlipText = document.getElementById('editFlipText');
const saveEditBtn = document.getElementById('saveEditBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const editStatus = document.getElementById('editStatus');
const editSideStats = document.getElementById('editSideStats');
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
const clearAllRectsBtn = document.getElementById('clearAllRectsBtn');
const toastContainer = document.getElementById('toastContainer');

const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomResetBtn = document.getElementById('zoomResetBtn');
const zoomLevelEl = document.getElementById('zoomLevel');

const detailPanel = document.getElementById('detailPanel');
const detailType = document.getElementById('detailType');
const detailName = document.getElementById('detailName');
const detailValue = document.getElementById('detailValue');
const detailDesc = document.getElementById('detailDesc');
const saveDetailBtn = document.getElementById('saveDetailBtn');
const deleteDetailBtn = document.getElementById('deleteDetailBtn');
const closeDetailBtn = document.getElementById('closeDetailBtn');

// Sidebar (new) + Accordion + Outer nesting
const sidebar = document.getElementById('sidebar');
const sidebarFilterHint = document.getElementById('sidebarFilterHint');
const sidebarDetailSection = document.getElementById('sidebarDetailSection');
const sidebarDetailContent = document.getElementById('sidebarDetailContent');
const sidebarEmpty = document.getElementById('sidebarEmpty');
const sidebarStatsEl = document.getElementById('sidebarStats');
const sidebarEditBtn = document.getElementById('sidebarEditBtn');
const sidebarCollapseBtn = document.getElementById('sidebarCollapseBtn');
const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
const filterAccordion = document.getElementById('filterAccordion');
const outerFilterWrap = document.getElementById('outerFilterWrap');
const outerDetailWrap = document.getElementById('outerDetailWrap');
const outerFilterCount = document.getElementById('outerFilterCount');
const outerModelWrap = document.getElementById('outerModelWrap');
// Theme
const themeSelect = document.getElementById('themeSelect');
// Boards & Models (legacy sidebar hidden, kept for compat)
const boardSelect = document.getElementById('boardSelect');
const newBoardBtn = document.getElementById('newBoardBtn');
const cloneBoardBtn = document.getElementById('cloneBoardBtn');
const deleteBoardBtn = document.getElementById('deleteBoardBtn');
const modelUploadInput = document.getElementById('modelUploadInput');
const modelUploadBtn = document.getElementById('modelUploadBtn');
const modelTypeSelect = document.getElementById('modelTypeSelect');
const modelNameInput = document.getElementById('modelNameInput');
const modelDescInput = document.getElementById('modelDescInput');
const modelListEl = document.getElementById('modelList');
const editBoardSelect = document.getElementById('editBoardSelect');
const editNewBoardBtn = document.getElementById('editNewBoardBtn');
const editCloneBoardBtn = document.getElementById('editCloneBoardBtn');
const editDeleteBoardBtn = document.getElementById('editDeleteBoardBtn');
const editModelUploadInput = document.getElementById('editModelUploadInput');
const editModelUploadBtn = document.getElementById('editModelUploadBtn');
const editModelTypeSelect = document.getElementById('editModelTypeSelect');
const editModelNameInput = document.getElementById('editModelNameInput');
const editModelDescInput = document.getElementById('editModelDescInput');
const editModelListEl = document.getElementById('editModelList');
// Detail panel model & color
const detailModelSelect = document.getElementById('detailModelSelect');
const detailModelInput = document.getElementById('detailModelInput');
const detailModelUploadBtn = document.getElementById('detailModelUploadBtn');
const detailModelClearBtn = document.getElementById('detailModelClearBtn');
const detailModelHint = document.getElementById('detailModelHint');
const detailColorInput = document.getElementById('detailColor');
const detailColorClearBtn = document.getElementById('detailColorClearBtn');
const detailView3DBtn = document.getElementById('detailView3DBtn');
const detailSpecs = document.getElementById('detailSpecs');
const detailFaulty = document.getElementById('detailFaulty');
const apHorizontalBtn = document.getElementById('apHorizontalBtn');
const apVerticalBtn = document.getElementById('apVerticalBtn');
const detailModelRotY = document.getElementById('detailModelRotY');
const detailModelScale = document.getElementById('detailModelScale');
const detailModelResetBtn = document.getElementById('detailModelResetBtn');
const detailModelRotHint = document.getElementById('detailModelRotHint');
const detailModelRotX = document.getElementById('detailModelRotX');
const detailModelRotZ = document.getElementById('detailModelRotZ');
const detailModelHeight = document.getElementById('detailModelHeight');
const detailModelRotXVal = document.getElementById('detailModelRotXVal');
const detailModelRotYVal = document.getElementById('detailModelRotYVal');
const detailModelRotZVal = document.getElementById('detailModelRotZVal');
const detailModelScaleVal = document.getElementById('detailModelScaleVal');
const detailModelHeightVal = document.getElementById('detailModelHeightVal');
const editPreviewWrap = document.getElementById('editPreviewWrap');
const editPreviewCanvas = document.getElementById('editPreviewCanvas');
const focusView = document.getElementById('focusView');
const focusBackBtn = document.getElementById('focusBackBtn');
const focusTitle = document.getElementById('focusTitle');
const focusInfo = document.getElementById('focusInfo');
// Sidebar View 3D
const view3DModelBtn = document.getElementById('view3DModelBtn');
// Model Viewer
const modelViewerOverlay = document.getElementById('modelViewerOverlay');
const modelViewerCanvas = document.getElementById('modelViewerCanvas');
const modelViewerTitle = document.getElementById('modelViewerTitle');
const modelViewerSubtitle = document.getElementById('modelViewerSubtitle');
const modelViewerMeta = document.getElementById('modelViewerMeta');
const modelViewerEmpty = document.getElementById('modelViewerEmpty');
const modelViewerLoading = document.getElementById('modelViewerLoading');
const closeModelViewerBtn = document.getElementById('closeModelViewerBtn');
const modelViewerCloseBtn2 = document.getElementById('modelViewerCloseBtn2');
const modelViewerSidebarBtn = document.getElementById('modelViewerSidebarBtn');
const modelViewerUploadBtn = document.getElementById('modelViewerUploadBtn');
const modelViewerUploadInput = document.getElementById('modelViewerUploadInput');

// Legacy view detail popup (hidden, not used)
const viewDetailPopup = document.getElementById('viewDetailPopup');

/* ---------- Component definitions ---------- */
const COMPONENT_DEFS = {
    resistor:   { label: 'مقاومت',   en: 'Resistor',   color: '#ff9f43', bg: 'rgba(255,159,67,0.22)', border: '#ff9f43', icon: '▬' },
    capacitor:  { label: 'خازن',     en: 'Capacitor',  color: '#4dd0ff', bg: 'rgba(77,208,255,0.22)', border: '#4dd0ff', icon: '⬜' },
    inductor:   { label: 'سلف',      en: 'Inductor',   color: '#a55eea', bg: 'rgba(165,94,234,0.22)', border: '#a55eea', icon: '🌀' },
    diode:      { label: 'دیود',     en: 'Diode',      color: '#ff5e57', bg: 'rgba(255,94,87,0.22)', border: '#ff5e57', icon: '▶' },
    transistor: { label: 'ترانزیستور', en: 'Transistor', color: '#0be881', bg: 'rgba(11,232,129,0.22)', border: '#0be881', icon: '◈' },
};

const FLASH_GREEN = '#0be881';

/* ---------- State ---------- */
function loadGltfCached(url) {
    if (!url) return Promise.reject(new Error('no url'));
    if (glbCache.has(url)) return glbCache.get(url);
    const p = gltfLoader.loadAsync(url).catch(err=>{ glbCache.delete(url); throw err; });
    glbCache.set(url, p);
    return p;
}

const state = {
    frontUrl: null,
    backUrl: null,
    mirrorBack: true,
    boardSize: null,
    components: [],
    mode: 'view',
    editSide: 'front',
    selectedType: null,
    selectedRectId: null,
    isDrawing: false,
    drawStart: null,
    filterType: 'all',
    backupComponents: null,
    editZoom: 1,
    editPanX: 0,
    editPanY: 0,
    isPanning: false,
    panStart: null,
    editViewMode: '2d',
    sidebarCollapsed: false,
    sidebarSelectedId: null,
    models: [],
    boards: {activeBoardId: 'default', boards: []},
    theme: {overall: 'dark'},
    modelViewerCompId: null,
    cables: [], // [{jackId, componentId, pointId}]
    cableMap: {}, // jackId -> {componentId, pointId}
    draggingCable: null, // {jackId, startPos, curX, curY}
    apAdding: false,
    draggingAp: null, // {compId, pointId, startNx, startNy}
};

/* ---------- Helpers ---------- */
function uuid() {
    return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

/* ---------- Attachment Points — prop registry ---------- */
function apShortId(){ return Math.random().toString(36).slice(2,6).toUpperCase() + Math.random().toString(36).slice(2,4).toUpperCase(); }
function getDefaultAttachmentPoints(type){
    const mk = (label,nx,ny)=> ({id: apShortId().slice(0,6), label, nx, ny});
    switch(type){
        case 'transistor':
            return [mk('E',0.18,0.85), mk('B',0.50,0.85), mk('C',0.82,0.85)];
        case 'diode':
            return [mk('A',0.10,0.50), mk('K',0.90,0.50)];
        case 'resistor':
        case 'capacitor':
        case 'inductor':
        default:
            return [mk('A',0.12,0.50), mk('B',0.88,0.50)];
    }
}
function ensureAttachmentPoints(comp){
    if (!comp) return;
    if (!Array.isArray(comp.attachmentPoints) || comp.attachmentPoints.length===0){
        comp.attachmentPoints = getDefaultAttachmentPoints(comp.type);
    } else {
        // normalize
        comp.attachmentPoints = comp.attachmentPoints.map(pt=>{
            let nx = parseFloat(pt.nx ?? pt.x ?? 0.5);
            let ny = parseFloat(pt.ny ?? pt.y ?? 0.5);
            nx = Math.max(0, Math.min(1, nx)); ny = Math.max(0, Math.min(1, ny));
            let id = pt.id ? String(pt.id).slice(0,16) : apShortId().slice(0,6);
            let label = pt.label ? String(pt.label).slice(0,12) : id.slice(0,2);
            return {id, label, nx: Math.round(nx*10000)/10000, ny: Math.round(ny*10000)/10000};
        }).slice(0,8);
        if (comp.attachmentPoints.length===0) comp.attachmentPoints = getDefaultAttachmentPoints(comp.type);
    }
}
function ensureAllAttachmentPoints(){
    let dirty=false;
    state.components.forEach(c=>{
        const before = (c.attachmentPoints||[]).length;
        ensureAttachmentPoints(c);
        if ((c.attachmentPoints||[]).length !== before) dirty=true;
    });
    return dirty;
}
function findPoint(comp, pointId){
    if (!comp || !comp.attachmentPoints) return null;
    return comp.attachmentPoints.find(p=>p.id===pointId) || null;
}

function renderDetailSpecs(comp){
    if (!detailSpecs) return;
    if (!comp){ detailSpecs.innerHTML=''; return; }
    const t = comp.type;
    let html='';
    if (t==='resistor'){
        const tol = comp.tolerance || '5%';
        html = `
            <label class="detail-label">مقدار مقاومت — Value (e.g. 10kΩ, 4.7k, 100Ω)
                <input id="specValueInput" class="detail-input" type="text" value="${(comp.value||'').replace(/"/g,'&quot;')}" placeholder="مثلا: 10kΩ">
            </label>
            <label class="detail-label">تلرانس — Tolerance
                <select id="specTolSelect" class="detail-input">
                    <option value="1%" ${tol==='1%'?'selected':''}>1% (دقیق)</option>
                    <option value="5%" ${tol==='5%'?'selected':''}>5% (استاندارد)</option>
                    <option value="10%" ${tol==='10%'?'selected':''}>10%</option>
                    <option value="20%" ${tol==='20%'?'selected':''}>20%</option>
                </select>
            </label>
            <div class="hint" style="font-size:11px;color:var(--text-3)">مقدار دقیق برای تست اهم و بیزر استفاده می‌شود — اگر &gt;100Ω باشد بیزر در حالت پیوستگی بیپ نمی‌زند، باید به Ω بروید.</div>
        `;
    } else if (t==='capacitor'){
        html = `
            <label class="detail-label">ظرفیت — Capacitance (e.g. 100nF, 10µF, 1pF)
                <input id="specValueInput" class="detail-input" type="text" value="${(comp.value||'').replace(/"/g,'&quot;')}" placeholder="مثلا: 100nF">
            </label>
            <div class="hint" style="font-size:11px;color:var(--text-3)">در حالت بیزر، خازن سالم یک بیپ کوتاه لحظه‌ای می‌دهد؛ ظرفیت در حالت Cap (F) اندازه‌گیری می‌شود.</div>
        `;
    } else if (t==='inductor'){
        html = `
            <label class="detail-label">اندوکتانس — Inductance (e.g. 10µH, 100mH)
                <input id="specValueInput" class="detail-input" type="text" value="${(comp.value||'').replace(/"/g,'&quot;')}" placeholder="مثلا: 10µH">
            </label>
            <div class="hint" style="font-size:11px;color:var(--text-3)">در حالت بیزر، سلف سالم بیپ ممتد می‌دهد.</div>
        `;
    } else if (t==='diode'){
        html = `
            <label class="detail-label">مقدار دیود — Value / Forward (e.g. 0.7V)
                <input id="specValueInput" class="detail-input" type="text" value="${(comp.value||'').replace(/"/g,'&quot;')}" placeholder="مثلا: 0.7V">
            </label>
            <div class="hint" style="font-size:11px;color:var(--text-3)">دیود: در حالت دیود یک جهت 0.6-0.7V و جهت دیگر OL؛ در بیزر یک جهت بیپ و جهت دیگر سکوت.</div>
        `;
    } else if (t==='transistor'){
        const tp = comp.transistorType || 'NPN';
        html = `
            <label class="detail-label">نوع ترانزیستور — Type
                <select id="specTransistorType" class="detail-input">
                    <option value="NPN" ${tp==='NPN'?'selected':''}>NPN (پایه با پراب قرمز پیدا می‌شود)</option>
                    <option value="PNP" ${tp==='PNP'?'selected':''}>PNP (پایه با پراب مشکی پیدا می‌شود)</option>
                </select>
            </label>
            <label class="detail-label">مقدار — Value (e.g. 2N3904)
                <input id="specValueInput" class="detail-input" type="text" value="${(comp.value||'').replace(/"/g,'&quot;')}" placeholder="مثلا: 2N3904">
            </label>
            <div class="hint" style="font-size:11px;color:var(--text-3)">ترانزیستور: در حالت دیود جفت‌پایه‌ها تست می‌شود — پایه با OL در هر دو جهت شناسایی؛ E (بالاتر) و C (پایین‌تر).</div>
        `;
    } else {
        html = `
            <label class="detail-label">مقدار — Value
                <input id="specValueInput" class="detail-input" type="text" value="${(comp.value||'').replace(/"/g,'&quot;')}" placeholder="مقدار">
            </label>
        `;
    }
    detailSpecs.innerHTML = html;
    // bind spec inputs to live update
    const valIn = document.getElementById('specValueInput');
    if (valIn){
        valIn.addEventListener('input', ()=>{
            if (!state.selectedRectId) return;
            const c = state.components.find(x=>x.id===state.selectedRectId);
            if (c){ c.value = valIn.value.trim().slice(0,120); }
        });
        valIn.addEventListener('blur', ()=>{ saveDetailFromPanel(false); renderEditRects(); refresh3DMarkers(); updateFilterCounts(); });
    }
    const tolSel = document.getElementById('specTolSelect');
    if (tolSel){
        tolSel.addEventListener('change', ()=>{
            const c = state.components.find(x=>x.id===state.selectedRectId);
            if (c){ c.tolerance = tolSel.value; saveDetailFromPanel(false); }
        });
    }
    const trSel = document.getElementById('specTransistorType');
    if (trSel){
        trSel.addEventListener('change', ()=>{
            const c = state.components.find(x=>x.id===state.selectedRectId);
            if (c){ c.transistorType = trSel.value; saveDetailFromPanel(false); }
        });
    }
}


function showLoading(show) {
    loadingOverlay.classList.toggle('hidden', !show);
}
function showDropZone(show) {
    dropZone.classList.toggle('hidden', !show);
}
function showFlipButton(show) {
    const shouldShow = show && !!state.backUrl && !!state.boardSize && state.mode === 'view';
    flipBoardBtn.classList.toggle('hidden', !shouldShow);
}
function showModeSwitcher(show) {
    modeSwitcher.classList.toggle('hidden', !show);
}
function showSidebar(show) {
    // 2D phase: sidebar visible in view mode even without board so 2D multimeter can be inspected
    const shouldShow = show && state.mode === 'view' && !state.sidebarCollapsed;
    if (!sidebar) return;
    if (shouldShow && !state.sidebarCollapsed) {
        sidebar.classList.remove('hidden');
        if (sidebarToggleBtn) sidebarToggleBtn.classList.add('hidden');
    } else {
        sidebar.classList.add('hidden');
        if (sidebarToggleBtn) {
            sidebarToggleBtn.classList.toggle('hidden', !shouldShow || !state.sidebarCollapsed);
            if (!state.boardSize || state.mode !== 'view') sidebarToggleBtn.classList.add('hidden');
            else if (state.sidebarCollapsed) sidebarToggleBtn.classList.remove('hidden');
        }
    }
    if (viewFilterBar) viewFilterBar.classList.add('hidden');
    // Notify 3D engine: container size changed, keep board perfectly centered in its own pane
    if (sceneManager && typeof sceneManager.resize === 'function') {
        requestAnimationFrame(() => sceneManager.resize());
        setTimeout(() => sceneManager.resize(), 220);
        setTimeout(() => sceneManager.resize(), 460);
    }
    // Update multimeter visibility when sidebar toggles
    setTimeout(() => { try { updateMultimeterVisibility(); } catch {} }, 60);
}
function showViewFilterBar(show) {
    // Now delegates to sidebar
    showSidebar(show);
}
function updateSideUI() {
    frontStatus.textContent = state.frontUrl ? '✅ بارگذاری شد' : '—';
    frontStatus.style.color = state.frontUrl ? '#8be9a1' : '';
    backStatus.textContent = state.backUrl ? '✅ بارگذاری شد' : '—';
    backStatus.style.color = state.backUrl ? '#8be9a1' : '';
    removeBackBtn.classList.toggle('hidden', !state.backUrl);
    mirrorToggle.classList.toggle('hidden', !state.backUrl);
    showModeSwitcher(!!state.frontUrl);
    showFlipButton(!!state.backUrl && !!state.boardSize);
    showSidebar(true);
    updateFilterCounts();
    updateEditFlipVisibility();
}
function updateFlipButtonText() {
    const isBack = sceneManager.isBack;
    flipBtnText.textContent = isBack ? 'نمایش روی برد' : 'نمایش پشت برد';
    if (editFlipText) editFlipText.textContent = state.editSide === 'front' ? 'نمایش پشت برد' : 'نمایش روی برد';
    if (editSideBadge) {
        editSideBadge.textContent = state.editSide === 'front' ? 'روی برد' : 'پشت برد';
        editSideBadge.className = 'side-badge edit-side-badge ' + (state.editSide === 'front' ? 'front-badge' : 'back-badge');
    }
}
function updateEditFlipVisibility() {
    if (!editFlipBtn) return;
    const hasBack = !!state.backUrl;
    editFlipBtn.classList.toggle('hidden', !hasBack);
}
function toast(msg, type='info', icon='💡') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-icon">${icon}</span><span>${msg}</span>`;
    toastContainer.appendChild(el);
    setTimeout(() => { el.style.pointerEvents = 'none'; }, 100);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 3400);
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
        toast('فقط فایل PNG مجاز است', 'error', '⚠️');
        return;
    }
    showLoading(true);
    try {
        const url = await uploadToServer(file, side);
        const busted = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
        if (side === 'front') state.frontUrl = busted;
        else state.backUrl = busted;
        updateSideUI();
        await rebuildBoard();
        if (state.mode === 'edit') updateEditImage();
    } catch (err) {
        console.error(err);
        toast('خطا: ' + err.message, 'error', '❌');
    } finally {
        showLoading(false);
    }
}

async function rebuildBoard() {
    if (!state.frontUrl) {
        showDropZone(true);
        showFlipButton(false);
        showSidebar(true);
        // ensure 2D multimeter stays visible even with no board
        setTimeout(()=>{ try{ updateMultimeterVisibility(); }catch{} }, 150);
        return;
    }
    showDropZone(false);
    const { mesh, size } = await buildBoardMesh(state.frontUrl, state.backUrl, {
        mirrorBack: state.mirrorBack,
    });
    state.boardSize = size;
    sceneManager.setBoard(mesh, size);
    updateFlipButtonText();
    showFlipButton(true);
    showSidebar(true);
    refresh3DMarkers();
    updateFilterCounts();
    // Multimeter: 3D env now loaded, if a component already selected show it — lazy async
    setTimeout(async () => { try { await initSunshineMultimeterIfNeeded(); } catch {} try { updateMultimeterVisibility(); } catch {} }, 120);
}

async function clearAll() {
    if (!confirm('آیا از پاک‌کردن همه تصاویر و نواحی اطمینان دارید؟')) return;
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
        state.components = [];
        state.filterType = 'all';
        state.selectedType = null;
        state.selectedRectId = null;
        state.sidebarSelectedId = null;
        closeDetailPanel();
        clearSidebarDetail();
        sceneManager.clearBoard();
        await fetch('/api/components', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({components:[]}) });
        updateSideUI();
        showDropZone(true);
        showFlipButton(false);
        showSidebar(true);
        setTimeout(()=>{ try{ updateMultimeterVisibility(); }catch{} }, 100);
        refresh3DMarkers();
        if (state.mode === 'edit') exitEditMode(false);
        resetZoom();
        toast('همه داده‌ها پاک شد', 'info', '🧹');
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
        state.components = state.components.filter(c => c.side !== 'back');
        await saveComponentsToServer();
        updateSideUI();
        await rebuildBoard();
        if (state.mode === 'edit' && state.editSide === 'back') {
            state.editSide = 'front';
            updateEditImage();
            renderEditRects();
            closeDetailPanel();
        }
        clearSidebarDetail();
        toast('تصویر پشت حذف شد', 'info', '🗑');
    } finally {
        showLoading(false);
    }
}

/* ---------- Components API ---------- */
async function fetchComponentsFromServer() {
    try {
        const res = await fetch('/api/components');
        const data = await res.json();
        if (data.success && Array.isArray(data.components)) {
            state.components = data.components;
            ensureAllAttachmentPoints();
        }
    } catch(e) { console.error('fetch components failed', e); }
}
async function saveComponentsToServer() {
    try {
        const res = await fetch('/api/components', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({components: state.components})
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'save failed');
        state.components = data.components;
        updateFilterCounts();
        showSidebar(true);
        return true;
    } catch(e) {
        console.error(e);
        toast('خطا در ذخیره قطعات: ' + e.message, 'error', '❌');
        return false;
    }
}

/* ---------- Mode switching ---------- */
function updateModeUI() {
    const isEdit = state.mode === 'edit';
    viewModeBtn.classList.toggle('active', !isEdit);
    editModeBtn.classList.toggle('active', isEdit);
    editOverlay.classList.toggle('hidden', !isEdit);
    showFlipButton(!isEdit);
    showSidebar(!isEdit);
    const hint = document.getElementById('controlsHint');
    if (hint) {
        hint.style.opacity = isEdit ? '0' : '1';
        hint.style.pointerEvents = isEdit ? 'none' : 'auto';
    }
    sceneManager.setControlsEnabled(!isEdit);
    if (isEdit) resetZoom();
    else {
        closeDetailPanel();
    }
}
function enterEditMode() {
    if (!state.frontUrl) {
        toast('ابتدا تصویر روی برد را بارگذاری کنید', 'error', '⚠️');
        return;
    }
    if (state.mode === 'edit') return;
    state.backupComponents = JSON.parse(JSON.stringify(state.components));
    state.mode = 'edit';
    state.editSide = 'front';
    state.selectedType = null;
    state.selectedRectId = null;
    updateModeUI();
    updateEditImage();
    renderPalette();
    renderEditRects();
    updateEditFlipVisibility();
    updateFlipButtonText();
    closeDetailPanel();
    setEditViewMode('2d');
    toast('وارد حالت ویرایش شدید — نوع قطعه را انتخاب و مستطیل بکشید (2D/3D قابل تغییر)', 'info', '✏️');
}
async function exitEditMode(save=true) {
    if (state.mode !== 'edit') return;
    if (save) {
        if (state.selectedRectId && detailPanel && !detailPanel.classList.contains('hidden')) {
            saveDetailFromPanel();
        }
        showLoading(true);
        const ok = await saveComponentsToServer();
        showLoading(false);
        if (!ok) return;
        refresh3DMarkers();
        toast('ویرایش ذخیره شد', 'success', '✅');
    } else {
        state.components = state.backupComponents || state.components;
        renderEditRects();
        refresh3DMarkers();
        toast('تغییرات لغو شد', 'info', '↩️');
    }
    state.mode = 'view';
    state.selectedType = null;
    state.selectedRectId = null;
    state.backupComponents = null;
    closeDetailPanel();
    updateModeUI();
    updateFilterCounts();
    showSidebar(true);
}

/* ---------- Palette ---------- */
function renderPalette() {
    paletteBtns.forEach(btn => {
        const t = btn.dataset.type;
        btn.classList.toggle('active', state.selectedType === t);
    });
    if (!state.selectedType) {
        editHint.textContent = '👆 ابتدا نوع قطعه را از بالا انتخاب کنید';
        editHint.style.background = 'rgba(20,27,45,0.85)';
        editHint.style.borderColor = 'rgba(255,255,255,0.1)';
    } else {
        const def = COMPONENT_DEFS[state.selectedType];
        editHint.textContent = `✏️ حالت رسم: ${def.label} — روی برد مستطیل بکشید`;
        editHint.style.background = def.bg;
        editHint.style.borderColor = def.border;
    }
}
function selectPaletteType(type) {
    if (state.selectedType === type) {
        state.selectedType = null;
    } else {
        state.selectedType = type;
    }
    renderPalette();
    const btn = document.querySelector(`.palette-btn[data-type="${type}"]`);
    if (btn) {
        btn.animate([{transform:'scale(1)'},{transform:'scale(0.92)'},{transform:'scale(1.06)'},{transform:'scale(1)'}], {duration: 380, easing:'cubic-bezier(.16,1,.3,1)'});
    }
}

/* ---------- Zoom ---------- */
function applyZoomTransform() {
    if (!editBoardStage) return;
    editBoardStage.style.transform = `translate(${state.editPanX}px, ${state.editPanY}px) scale(${state.editZoom})`;
    editBoardStage.style.transformOrigin = 'center center';
    editBoardStage.style.transition = state.isPanning ? 'none' : 'transform .18s cubic-bezier(.16,1,.3,1)';
    if (zoomLevelEl) zoomLevelEl.textContent = Math.round(state.editZoom * 100) + '%';
    const panHint = document.getElementById('panHint');
    if (panHint) panHint.classList.toggle('hidden', state.editZoom <= 1.05);
}
function setZoom(newZoom, centerX, centerY) {
    const oldZoom = state.editZoom;
    const clamped = Math.max(1, Math.min(4, newZoom));
    if (clamped === oldZoom) return;
    if (centerX != null && centerY != null && editBoardViewport) {
        const vpRect = editBoardViewport.getBoundingClientRect();
        const cx = centerX - vpRect.left - vpRect.width/2;
        const cy = centerY - vpRect.top - vpRect.height/2;
        const ratio = clamped / oldZoom;
        state.editPanX = (state.editPanX - cx) * ratio + cx;
        state.editPanY = (state.editPanY - cy) * ratio + cy;
    }
    state.editZoom = clamped;
    clampPan();
    applyZoomTransform();
}
function clampPan() {
    // Allow panning even without zoom — previously required zoom>1.02 which blocked free movement
    const maxPan = 500 * Math.max(0.6, state.editZoom);
    state.editPanX = Math.max(-maxPan, Math.min(maxPan, state.editPanX));
    state.editPanY = Math.max(-maxPan, Math.min(maxPan, state.editPanY));
}
function resetZoom() {
    state.editZoom = 1;
    state.editPanX = 0;
    state.editPanY = 0;
    applyZoomTransform();
}
function zoomIn() { setZoom(state.editZoom * 1.25); }
function zoomOut() { setZoom(state.editZoom / 1.25); }

/* ---------- Edit image & rects ---------- */
function updateEditImage() {
    const targetUrl = state.editSide === 'front' ? state.frontUrl : state.backUrl;
    if (!targetUrl) {
        if (state.editSide === 'back') {
            state.editSide = 'front';
            updateEditImage();
            return;
        }
        editBoardImage.src = '';
        editBoardImage.style.display = 'none';
        return;
    }
    editBoardImage.style.display = 'block';
    const newSrc = targetUrl;
    if (editBoardImage.src !== newSrc && editBoardImage.getAttribute('src') !== newSrc) {
        editBoardImage.src = newSrc;
        editBoardImage.classList.toggle('mirrored', state.editSide === 'back' && state.mirrorBack);
        updateFlipButtonText();
        editBoardImage.onload = () => {
            renderEditRects();
            applyZoomTransform();
        };
        if (editBoardImage.complete && editBoardImage.naturalWidth > 0) {
            setTimeout(() => renderEditRects(), 30);
        }
    } else {
        editBoardImage.classList.toggle('mirrored', state.editSide === 'back' && state.mirrorBack);
        updateFlipButtonText();
        renderEditRects();
        if (state.editViewMode==='3d' && edit3D && state.frontUrl) {
            edit3D.setBoard(state.frontUrl, state.backUrl);
        }
    }
}

function renderEditRects() {
    editRectLayer.innerHTML = '';
    const visibleComps = state.components.filter(c => c.side === state.editSide);
    visibleComps.forEach(comp => {
        const el = createRectDOM(comp);
        editRectLayer.appendChild(el);
    });
    const rects = editRectLayer.querySelectorAll('.edit-rect');
    rects.forEach((el, i) => {
        el.style.opacity = '0';
        el.style.transform = 'scale(0.8)';
        setTimeout(() => {
            el.style.transition = 'all .4s cubic-bezier(.16,1,.3,1)';
            el.style.opacity = '1';
            el.style.transform = 'scale(1)';
        }, i * 30);
    });
    updateEditStats();
    if (state.editViewMode==='3d') refreshEdit3DMarkers();
    // If detail panel is open and selected is on this side, just refresh values without stealing focus
    if (state.selectedRectId && detailPanel && !detailPanel.classList.contains('hidden')) {
        const sel = state.components.find(c=>c.id===state.selectedRectId);
        if (sel && sel.side === state.editSide) {
            // Update inputs without focusing
            if (detailType) detailType.value = sel.type;
            if (detailName && document.activeElement !== detailName) detailName.value = sel.name || '';
            if (detailValue && document.activeElement !== detailValue) detailValue.value = sel.value || '';
            if (detailDesc && document.activeElement !== detailDesc) detailDesc.value = sel.description || '';
        } else if (sel && sel.side !== state.editSide) {
            // Selected is on other side, keep panel but don't overwrite? Keep as is
        }
    }
}

function createRectDOM(comp) {
    const def = COMPONENT_DEFS[comp.type] || COMPONENT_DEFS.resistor;
    const effectiveColor = comp.color && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(comp.color) ? comp.color : def.border;
    const effectiveBg = comp.color ? (comp.color + '22') : def.bg;
    const el = document.createElement('div');
    el.className = 'edit-rect';
    if (state.selectedRectId === comp.id) el.classList.add('selected');
    el.dataset.id = comp.id;
    el.style.left = (comp.x * 100) + '%';
    el.style.top = (comp.y * 100) + '%';
    el.style.width = (comp.w * 100) + '%';
    el.style.height = (comp.h * 100) + '%';
    el.style.borderColor = effectiveColor;
    el.style.background = effectiveBg;
    el.style.color = effectiveColor;
    el.style.boxShadow = `0 0 0 1px ${def.border}22, 0 4px 12px rgba(0,0,0,0.2)`;
    const displayLabel = comp.name && comp.name.trim() ? comp.name.trim() : def.label;
    const valuePart = comp.value ? ` ${comp.value}` : '';
    el.innerHTML = `<span class="rect-label">${escapeHtml(displayLabel + valuePart)}</span>`;
    el.title = `${def.label}${comp.name? ' — '+comp.name:''}${comp.value?' ('+comp.value+')':''}${comp.description? '\n'+comp.description:''}`;
    // attachment points dots (2D prop registry)
    ensureAttachmentPoints(comp);
    const apList = comp.attachmentPoints || [];
    const connectedSet = new Set(Object.values(state.cableMap||{}).filter(v=>v && v.componentId===comp.id).map(v=>v.pointId));
    apList.forEach(pt=>{
        const dot = document.createElement('div');
        dot.className = 'ap-dot' + (connectedSet.has(pt.id) ? ' ap-connected' : '');
        dot.dataset.pointId = pt.id;
        dot.dataset.compId = comp.id;
        dot.style.left = (pt.nx*100)+'%';
        dot.style.top = (pt.ny*100)+'%';
        dot.title = `${pt.label} — کابل را بکشید و رها کنید`;
        dot.textContent = pt.label.slice(0,2);
        // prevent rect selection when clicking dot
        dot.addEventListener('pointerdown', (e)=>{
            e.stopPropagation();
            // quick click on dot selects rect and highlights point
            selectRect(comp.id);
            // highlight dot briefly
            dot.animate([{transform:'scale(1)'},{transform:'scale(1.35)'},{transform:'scale(1)'}], {duration:280, easing:'cubic-bezier(.16,1,.3,1)'});
        });
        // double click to rename?
        dot.addEventListener('dblclick', (e)=>{
            e.stopPropagation();
            const newLabel = prompt('نام نقطه اتصال:', pt.label);
            if (newLabel && newLabel.trim()){
                pt.label = newLabel.trim().slice(0,8);
                renderEditRects();
                renderAttachmentPanel();
                saveComponentsToServer().catch(()=>{});
            }
        });
        // drag to reposition point within rect — engaging
        let apDrag = null;
        dot.addEventListener('pointerdown', (e)=>{
            e.stopPropagation();
            e.preventDefault();
            apDrag = {pt, comp, el, startX:e.clientX, startY:e.clientY, origNx:pt.nx, origNy:pt.ny, rect: el.getBoundingClientRect()};
            dot.setPointerCapture(e.pointerId);
            dot.classList.add('ap-dragging');
        });
        dot.addEventListener('pointermove', (e)=>{
            if (!apDrag) return;
            const r = apDrag.rect;
            const nx = (e.clientX - r.left) / r.width;
            const ny = (e.clientY - r.top) / r.height;
            pt.nx = Math.max(0.02, Math.min(0.98, nx));
            pt.ny = Math.max(0.02, Math.min(0.98, ny));
            pt.nx = Math.round(pt.nx*10000)/10000;
            pt.ny = Math.round(pt.ny*10000)/10000;
            dot.style.left = (pt.nx*100)+'%';
            dot.style.top = (pt.ny*100)+'%';
            // live update list and 3D
            const coordEl = document.querySelector(`#attachmentPointsList .ap-item[data-point-id="${pt.id}"] .ap-item-coord`);
            if (coordEl) coordEl.textContent = `${(pt.nx*100).toFixed(0)}%,${(pt.ny*100).toFixed(0)}%`;
            requestAnimationFrame(()=>{ updateCableOverlay(); });
        });
        const endApDrag = (e)=>{
            if (!apDrag) return;
            dot.classList.remove('ap-dragging');
            try{ dot.releasePointerCapture(e.pointerId); } catch{}
            apDrag=null;
            renderEditRects();
            renderAttachmentPanel();
            refresh3DMarkers();
            refreshEdit3DMarkers();
            updateCableOverlay();
            saveComponentsToServer().then(()=> saveCablesToServer());
            dot.animate([{transform:'scale(1.2)'},{transform:'scale(1)'}], {duration:220, easing:'cubic-bezier(.16,1,.3,1)'});
        };
        dot.addEventListener('pointerup', endApDrag);
        dot.addEventListener('pointercancel', endApDrag);
        el.appendChild(dot);
    });
    // click on rect empty area to add point when apAdding
    el.addEventListener('click', (e)=>{
        if (!state.apAdding || state.selectedRectId !== comp.id) return;
        // compute normalized click within rect
        const r = el.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width;
        const ny = (e.clientY - r.top) / r.height;
        const clampedX = Math.max(0.02, Math.min(0.98, nx));
        const clampedY = Math.max(0.02, Math.min(0.98, ny));
        const newPt = {id: apShortId().slice(0,6), label: String.fromCharCode(65 + (comp.attachmentPoints.length%26)) + (comp.attachmentPoints.length>=26 ? Math.floor(comp.attachmentPoints.length/26) : ''), nx: Math.round(clampedX*10000)/10000, ny: Math.round(clampedY*10000)/10000};
        comp.attachmentPoints.push(newPt);
        if (comp.attachmentPoints.length>8) comp.attachmentPoints = comp.attachmentPoints.slice(-8);
        renderEditRects();
        renderAttachmentPanel();
        toast(`نقطه ${newPt.label} اضافه شد — بکشید برای تست`, 'success', '📍');
    });
    el.addEventListener('pointerdown', (e) => {
        // if clicking on ap dot, already handled; else normal select
        if (e.target.closest('.ap-dot')) return;
        e.stopPropagation();
        selectRect(comp.id);
    });
    el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        flashEditRect(comp.id);
        const sideFa = comp.side==='front'?'روی برد':'پشت برد';
        toast(`${def.label}${comp.name?' — '+comp.name:''} — ${sideFa}`, 'info', '🔍');
    });
    return el;
}
function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function selectRect(id) {
    // Clear 3D double-click active unless this select was triggered from 3D dblclick (which will set it right after)
    // We keep it simple: any single-click select clears 3D active
    if (edit3DActiveId && edit3DActiveId !== id) edit3DActiveId = null;
    const prev = state.selectedRectId;
    const wasPanelHidden = detailPanel ? detailPanel.classList.contains('hidden') : true;
    if (state.selectedRectId === id) {
        state.selectedRectId = null;
        closeDetailPanel();
    } else {
        state.selectedRectId = id;
        openDetailPanel(id, wasPanelHidden);
    }
    renderEditRects();
    deleteSelectedBtn.classList.toggle('hidden', !state.selectedRectId);
    if (state.selectedRectId && prev !== id) {
        const comp = state.components.find(c => c.id === state.selectedRectId);
        if (comp) {
            const def = COMPONENT_DEFS[comp.type];
            const detail = comp.name ? ` — ${comp.name}` : '';
            toast(`انتخاب شد: ${def.label}${detail}`, 'info', '📌');
        }
    }
}

function flashEditRect(id) {
    const el = editRectLayer.querySelector(`.edit-rect[data-id="${id}"]`);
    if (!el) return;
    el.classList.remove('flash-green');
    void el.offsetWidth;
    el.classList.add('flash-green');
    setTimeout(() => el.classList.remove('flash-green'), 2700);
}

function updateEditStats() {
    const total = state.components.length;
    const frontCount = state.components.filter(c=>c.side==='front').length;
    const backCount = state.components.filter(c=>c.side==='back').length;
    editStatus.textContent = `${total} ناحیه ثبت شده`;
    editSideStats.textContent = `(${frontCount} رو • ${backCount} پشت)`;
}

/* ---------- Detail panel (edit) ---------- */
function openDetailPanel(id, shouldFocus = true) {
    const comp = state.components.find(c=>c.id===id);
    if (!comp) { closeDetailPanel(); return; }
    if (!detailPanel) return;
    const wasHidden = detailPanel.classList.contains('hidden');
    detailPanel.classList.remove('hidden');
    if (detailType) detailType.value = comp.type;
    if (detailName) detailName.value = comp.name || '';
    if (detailValue) detailValue.value = comp.value || '';
    if (detailDesc) detailDesc.value = comp.description || '';
    if (detailSpecs) renderDetailSpecs(comp);
    if (detailFaulty) detailFaulty.checked = !!comp.isFaulty;
    if (detailColorInput) detailColorInput.value = comp.color || COMPONENT_DEFS[comp.type]?.border || '#4dd0ff';
    if (detailModelSelect) {
        refreshDetailModelSelect();
        detailModelSelect.value = comp.modelId || '';
        if (detailModelHint) detailModelHint.textContent = comp.modelId ? 'متصل: '+(state.models.find(m=>m.id===comp.modelId)?.name||comp.modelId) : 'بدون مدل — نام/توضیح دستی یا انتخاب مدل';
        if (detailModelClearBtn) detailModelClearBtn.classList.toggle('hidden', !comp.modelId);
        if (detailView3DBtn) detailView3DBtn.classList.toggle('hidden', !comp.modelId && !comp.modelUrl);
    }
    if (detailModelRotY) detailModelRotY.value = comp.modelRotY || 0;
    if (detailModelRotX) detailModelRotX.value = comp.modelRotX || 0;
    if (detailModelRotZ) detailModelRotZ.value = comp.modelRotZ || 0;
    if (detailModelScale) detailModelScale.value = comp.modelScale || 1;
    if (detailModelHeight) detailModelHeight.value = comp.modelOffsetY || 0;
    if (detailModelRotXVal) detailModelRotXVal.textContent = `${Math.round(comp.modelRotX||0)}°`;
    if (detailModelRotYVal) detailModelRotYVal.textContent = `${Math.round(comp.modelRotY||0)}°`;
    if (detailModelRotZVal) detailModelRotZVal.textContent = `${Math.round(comp.modelRotZ||0)}°`;
    if (detailModelScaleVal) detailModelScaleVal.textContent = `${(comp.modelScale||1).toFixed(1)}×`;
    if (detailModelHeightVal) detailModelHeightVal.textContent = `${(comp.modelOffsetY||0).toFixed(2)}`;
    if (detailModelRotHint) detailModelRotHint.textContent = `چرخش: X${Math.round(comp.modelRotX||0)}° Y${Math.round(comp.modelRotY||0)}° Z${Math.round(comp.modelRotZ||0)}° · مقیاس: ${(comp.modelScale||1).toFixed(1)}× · ارتفاع: ${(comp.modelOffsetY||0).toFixed(2)}`;
    // Live 3D preview inside editing interface — real-time
    showEditPreview(comp);
    // show/hide tune section only if has model
    const tuneSection = document.querySelector('.detail-model-tune');
    if (tuneSection) tuneSection.classList.toggle('hidden', !comp.modelId && !comp.modelUrl);
    // Only focus when panel just opened, not on every render
    if (shouldFocus && wasHidden) {
        setTimeout(()=> { if (detailName) detailName.focus(); }, 140);
    }
    renderAttachmentPanel();
    detailPanel.animate([{opacity:0, transform:'translateY(-4px) scale(0.98)'},{opacity:1, transform:'translateY(0) scale(1)'}], {duration: 260, easing:'cubic-bezier(.16,1,.3,1)'});
}
function closeDetailPanel() {
    if (detailPanel) detailPanel.classList.add('hidden');
    if (editPreviewWrap) editPreviewWrap.classList.add('hidden');
}

function renderAttachmentPanel(){
    const listEl = document.getElementById('attachmentPointsList');
    const hintEl = document.getElementById('apStatus');
    const apHint = document.getElementById('apHint');
    if (!listEl) return;
    const comp = state.components.find(c=>c.id===state.selectedRectId);
    if (!comp){
        listEl.innerHTML = '<span class="hint">قطعه‌ای انتخاب نشده</span>';
        if (hintEl) hintEl.textContent = '';
        return;
    }
    ensureAttachmentPoints(comp);
    const pts = comp.attachmentPoints || [];
    const connMap = state.cableMap || {};
    // build list
    listEl.innerHTML = pts.map(pt=>{
        const connJack = Object.entries(connMap).find(([jid, v])=> v && v.componentId===comp.id && v.pointId===pt.id);
        const jackLabel = connJack ? connJack[0].toUpperCase() : '';
        const isConn = !!connJack;
        return `<div class="ap-item ${isConn?'ap-item-connected':''}" data-point-id="${pt.id}">
            <span class="ap-dot-mini"></span>
            <span class="ap-item-label">${pt.label}</span>
            <span class="ap-item-coord">${(pt.nx*100).toFixed(0)}%,${(pt.ny*100).toFixed(0)}%</span>
            ${isConn ? `<span class="side-badge" style="font-size:10px;padding:2px 6px;background:rgba(11,232,129,0.14);border:1px solid rgba(11,232,129,0.22);color:#0BE881">🔌 ${jackLabel}</span>` : `<span style="font-size:10px;color:var(--text-3)">آماده</span>`}
            <div class="ap-item-actions">
                <button class="ap-delete-btn" data-act="del" title="حذف">✕</button>
            </div>
        </div>`;
    }).join('');
    if (hintEl) hintEl.textContent = `${pts.length} نقطه ثبت شده — برای جابجایی نقطه، آن را روی 2D یا 3D بکشید؛ دوبار کلیک برای تغییر نام`;
    if (apHint) apHint.textContent = state.apAdding ? 'حالت افزودن فعال — روی مستطیل کلیک کنید' : 'روی مستطیل کلیک کنید تا نقطه اضافه شود';
    // bind delete
    listEl.querySelectorAll('.ap-delete-btn').forEach(btn=>{
        btn.addEventListener('click', (e)=>{
            e.stopPropagation();
            const item = btn.closest('.ap-item');
            const pid = item ? item.dataset.pointId : null;
            if (!pid) return;
            // prevent removing last point? keep at least 1
            if (pts.length<=1){ toast('حداقل یک نقطه باید بماند','error','⚠️'); return; }
            const idx = comp.attachmentPoints.findIndex(p=>p.id===pid);
            if (idx>=0){
                // also disconnect any cable on this point
                for (const [jid, v] of Object.entries(connMap)){
                    if (v && v.componentId===comp.id && v.pointId===pid){
                        delete state.cableMap[jid];
                    }
                }
                comp.attachmentPoints.splice(idx,1);
                // also clean cables array
                state.cables = Object.entries(state.cableMap).map(([jackId, v])=> ({jackId, componentId:v.componentId, pointId:v.pointId}));
                renderEditRects();
                renderAttachmentPanel();
                refresh3DMarkers();
                updateCableOverlay();
                saveComponentsToServer().then(()=> saveCablesToServer());
                toast('نقطه حذف شد','info','🗑');
            }
        });
    });
    // highlight dot hover sync
    listEl.querySelectorAll('.ap-item').forEach(item=>{
        item.addEventListener('mouseenter', ()=>{
            const pid = item.dataset.pointId;
            const dot = document.querySelector(`.edit-rect[data-id="${comp.id}"] .ap-dot[data-point-id="${pid}"]`);
            if (dot) dot.classList.add('ap-hover-target');
        });
        item.addEventListener('mouseleave', ()=>{
            const pid = item.dataset.pointId;
            const dot = document.querySelector(`.edit-rect[data-id="${comp.id}"] .ap-dot[data-point-id="${pid}"]`);
            if (dot) dot.classList.remove('ap-hover-target');
        });
    });
}

function saveDetailFromPanel(showToast = true) {
    if (!state.selectedRectId) return;
    const comp = state.components.find(c=>c.id===state.selectedRectId);
    if (!comp) return;
    const newType = detailType ? detailType.value : comp.type;
    const newName = detailName ? detailName.value.trim().slice(0,120) : '';
    const newValue = detailValue ? detailValue.value.trim().slice(0,120) : '';
    const newDesc = detailDesc ? detailDesc.value.trim().slice(0,800) : '';
    const newModelId = detailModelSelect ? (detailModelSelect.value || null) : comp.modelId;
    let newModelUrl = comp.modelUrl;
    if (newModelId) {
        const m = state.models.find(x=>x.id===newModelId);
        newModelUrl = m ? m.glbUrl : comp.modelUrl;
    } else {
        newModelUrl = null;
    }
    const newColorRaw = detailColorInput ? detailColorInput.value : comp.color;
    const newColor = newColorRaw && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(newColorRaw) ? newColorRaw : null;
    const defColor = COMPONENT_DEFS[newType]?.border;
    const finalColor = (newColor && newColor.toLowerCase() !== defColor?.toLowerCase()) ? newColor : null;
    const newRotY = detailModelRotY ? parseFloat(detailModelRotY.value) || 0 : (comp.modelRotY||0);
    const newRotX = detailModelRotX ? parseFloat(detailModelRotX.value) || 0 : (comp.modelRotX||0);
    const newRotZ = detailModelRotZ ? parseFloat(detailModelRotZ.value) || 0 : (comp.modelRotZ||0);
    const newScale = detailModelScale ? parseFloat(detailModelScale.value) || 1 : (comp.modelScale||1);
    const newHeight = detailModelHeight ? parseFloat(detailModelHeight.value) || 0 : (comp.modelOffsetY||0);
    const clampedScale = Math.max(0.3, Math.min(3, newScale));
    const clampedRotY = ((newRotY % 360)+360)%360;
    const clampedRotX = ((newRotX % 360)+360)%360;
    const clampedRotZ = ((newRotZ % 360)+360)%360;
    const clampedHeight = Math.max(-1, Math.min(2, newHeight));
    const changed = comp.type !== newType || comp.name !== newName || comp.value !== newValue || comp.description !== newDesc || comp.modelId !== newModelId || comp.modelUrl !== newModelUrl || comp.color !== finalColor || (comp.modelRotY||0)!==clampedRotY || (comp.modelRotX||0)!==clampedRotX || (comp.modelRotZ||0)!==clampedRotZ || (comp.modelScale||1)!==clampedScale || (comp.modelOffsetY||0)!==clampedHeight;
    if (!changed) return;
    const typeChanged = comp.type !== newType;
    comp.type = newType;
    comp.name = newName;
    // value now comes from spec input if present, else fallback
    const specValInput = document.getElementById('specValueInput');
    if (specValInput) {
        const sv = specValInput.value.trim().slice(0,120);
        comp.value = sv || newValue;
    } else comp.value = newValue;
    comp.description = newDesc;
    // precise specs
    const specTol = document.getElementById('specTolSelect');
    if (specTol && comp.type==='resistor') comp.tolerance = specTol.value;
    const specTr = document.getElementById('specTransistorType');
    if (specTr && comp.type==='transistor') comp.transistorType = specTr.value;
    if (detailFaulty) comp.isFaulty = !!detailFaulty.checked;
    // aa — keep attachment points, ensure at least default exists (don't auto-reset on type change to preserve user edits)
    if (!comp.attachmentPoints || comp.attachmentPoints.length===0) ensureAttachmentPoints(comp);
    comp.modelId = newModelId;
    comp.modelUrl = newModelUrl;
    comp.color = finalColor;
    comp.modelRotY = clampedRotY;
    comp.modelRotX = clampedRotX;
    comp.modelRotZ = clampedRotZ;
    comp.modelScale = clampedScale;
    comp.modelOffsetY = clampedHeight;
    if (showToast) toast('جزئیات ذخیره شد', 'success', '✅');
}
function deleteSelected() {
    if (!state.selectedRectId) return;
    edit3DActiveId = null;
    const delId = state.selectedRectId;
    state.components = state.components.filter(c => c.id !== delId);
    // aa — clean cables for deleted component
    for (const jid of Object.keys(state.cableMap)){
        const v = state.cableMap[jid];
        if (v && v.componentId===delId) delete state.cableMap[jid];
    }
    state.cables = mapToCables(state.cableMap);
    saveCablesToServer().catch(()=>{});
    state.selectedRectId = null;
    closeDetailPanel();
    deleteSelectedBtn.classList.add('hidden');
    renderEditRects();
    updateFilterCounts();
    refresh3DMarkers();
    toast('ناحیه حذف شد', 'info', '🗑');
}
function clearAllRects() {
    if (state.components.length === 0) return;
    const inEditSide = state.components.filter(c=>c.side===state.editSide).length;
    if (confirm(`آیا ${state.editSide==='front'?'روی برد':'پشت برد'} پاک شود؟ (Cancel = پاک کردن همه)`)) {
        state.components = state.components.filter(c=>c.side !== state.editSide);
        toast(`${inEditSide} ناحیه حذف شد`, 'info', '🧹');
    } else {
        if (!confirm(`آیا از حذف همه ${state.components.length} ناحیه اطمینان دارید؟`)) return;
        state.components = [];
        toast('همه نواحی پاک شد', 'info', '🧹');
    }
    state.selectedRectId = null;
    closeDetailPanel();
    deleteSelectedBtn.classList.add('hidden');
    renderEditRects();
    updateFilterCounts();
    refresh3DMarkers();
}

/* ---------- Sidebar detail (view mode) ---------- */
function setOuterExpanded(outerEl, expand) {
    if (!outerEl) return;
    const header = outerEl.querySelector('.outer-header');
    const body = outerEl.querySelector('.outer-body');
    if (expand) {
        outerEl.classList.add('expanded');
        if (header) header.setAttribute('aria-expanded', 'true');
        if (body) {
            body.style.maxHeight = body.scrollHeight + 'px';
            body.style.opacity = '1';
        }
    } else {
        outerEl.classList.remove('expanded');
        if (header) header.setAttribute('aria-expanded', 'false');
        if (body) {
            body.style.maxHeight = '0px';
            body.style.opacity = '0';
        }
    }
}
function toggleOuter(outerEl) {
    if (!outerEl) return;
    const isExpanded = outerEl.classList.contains('expanded');
    setOuterExpanded(outerEl, !isExpanded);
    setTimeout(() => {
        const body = outerEl.querySelector('.outer-body');
        if (outerEl.classList.contains('expanded') && body) body.style.maxHeight = body.scrollHeight + 'px';
    }, 340);
}

function showSidebarDetail(comp) {
    if (!sidebar || !sidebarDetailContent) return;
    const def = COMPONENT_DEFS[comp.type];
    state.sidebarSelectedId = comp.id;
    sidebarDetailContent.innerHTML = `
        <div class="sidebar-detail-header">
            <div class="sidebar-detail-icon" style="background:${def.bg}; border:1px solid ${def.border}; color:${def.border};">${def.icon}</div>
            <div>
                <div class="sidebar-detail-title" style="color:${def.border}">${escapeHtml(comp.name && comp.name.trim() ? comp.name : def.label)}</div>
                <div class="sidebar-detail-subtitle">${def.label} — ${def.en}</div>
            </div>
        </div>
        <div class="sidebar-detail-meta">
            <span style="border-color:${def.border}; color:${def.border}">${def.label}</span>
            ${comp.value ? `<span>${escapeHtml(comp.value)}</span>` : ''}
            <span class="${comp.side==='front'?'front-badge':'back-badge'} side-badge">${comp.side==='front'?'روی برد':'پشت برد'}</span>
        </div>
        ${comp.description && comp.description.trim() ? `<div class="sidebar-detail-desc">${escapeHtml(comp.description)}</div>` : `<div class="sidebar-detail-desc" style="opacity:0.6; text-align:center;">بدون توضیحات</div>`}
    `;
    if (sidebarDetailSection) sidebarDetailSection.classList.remove('hidden');
    if (sidebarEmpty) sidebarEmpty.classList.add('hidden');
    if (sidebar) {
        sidebar.classList.remove('hidden');
        state.sidebarCollapsed = false;
        if (sidebarToggleBtn) sidebarToggleBtn.classList.add('hidden');
    }
    if (outerDetailWrap && !outerDetailWrap.classList.contains('expanded')) {
        setOuterExpanded(outerDetailWrap, true);
    } else if (outerDetailWrap) {
        const body = outerDetailWrap.querySelector('.outer-body');
        if (body) body.style.maxHeight = body.scrollHeight + 'px';
    }
    if (sidebar) sidebar.animate([{transform:'translateX(6px)'},{transform:'translateX(0)'}], {duration: 260, easing:'cubic-bezier(.16,1,.3,1)'});
    if (sidebarEditBtn) sidebarEditBtn.dataset.compId = comp.id;
    // Update Sunshine multimeter for this component — async, never blocks board
    setTimeout(async () => {
        if (!multimeterInstance && document.getElementById('multimeterCanvas')) {
            try { await initSunshineMultimeterIfNeeded(); } catch {}
        }
        try { updateMultimeterVisibility(); } catch {}
        const mm = getMultimeter() || multimeterInstance;
        if (mm && comp) try { mm.setComponent(comp); } catch {}
    }, 30);
}
function clearSidebarDetail() {
    state.sidebarSelectedId = null;
    if (sidebarDetailSection) sidebarDetailSection.classList.add('hidden');
    if (sidebarDetailContent) sidebarDetailContent.innerHTML = '';
    if (sidebarEmpty) sidebarEmpty.classList.remove('hidden');
    if (sidebarEditBtn) delete sidebarEditBtn.dataset.compId;
    if (outerDetailWrap && outerDetailWrap.classList.contains('expanded')) {
        const body = outerDetailWrap.querySelector('.outer-body');
        if (body) setTimeout(() => { if (body) body.style.maxHeight = body.scrollHeight + 'px'; }, 20);
    }
    // Hide multimeter when no selection
    setTimeout(() => updateMultimeterVisibility(), 20);
}
function toggleSidebar() {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    showSidebar(true);
}

/* ---------- Sunshine DT-17N Multimeter — sidebar 3D virtual lab ---------- */
let multimeterInstance = null;
function is3DEnvLoaded() {
    // 3D environment is loaded when board mesh exists and WebGL is available
    try {
        return !!(state.boardSize && state.frontUrl && sceneManager && sceneManager.getBoardMesh());
    } catch { return !!(state.boardSize && state.frontUrl); }
}
function updateMultimeterVisibility() {
    // sync cable map to multimeter each time visibility updates
    try { syncMultimeterCables(); } catch{}
    // always force DOM visible for 2D preview even before JS module loads
    try {
      const sec0 = document.getElementById('multimeterSection');
      if (sec0) sec0.classList.remove('hidden');
      const sb0 = document.getElementById('sidebar');
      if (sb0 && state.mode==='view') { sb0.classList.remove('hidden'); if (sidebarToggleBtn) sidebarToggleBtn.classList.add('hidden'); }
    } catch {}
    const mm = getMultimeter() || multimeterInstance;
    if (!mm) {
      // try to init now if not yet
      setTimeout(()=>{ initSunshineMultimeterIfNeeded().catch(()=>{}); }, 50);
      return;
    }
    // 2D bright preview: always visible for inspection, functional when component selected
    const hasSelection = !!(state.sidebarSelectedId || state.selectedRectId);
    const shouldShow = true;
    try { mm.setVisible(shouldShow); } catch {}
    if (hasSelection) {
        const compId = state.sidebarSelectedId || state.selectedRectId;
        const comp = state.components.find(c => c.id === compId);
        if (comp) try { mm.setComponent(comp); } catch {}
    } else {
        const placeholder = { type: 'resistor', name: 'R1', value: '10kΩ', description: 'Preview — select a component to test' };
        try { mm.setComponent(placeholder); } catch {}
    }
    try {
      const sec = document.getElementById('multimeterSection');
      if (sec) sec.classList.remove('hidden');
      const sb = document.getElementById('sidebar');
      if (sb && state.mode==='view') { sb.classList.remove('hidden'); if (sidebarToggleBtn) sidebarToggleBtn.classList.add('hidden'); }
    } catch {}
}
async function initSunshineMultimeterIfNeeded() {
    const canvas = document.getElementById('multimeterCanvas');
    if (!canvas || multimeterInstance) return multimeterInstance;
    const mod = await loadMultimeterModule();
    if (!mod) return null;
    try {
        multimeterInstance = mod.initMultimeter(canvas, {
            toast: (msg, type) => toast(msg, type, type === 'success' ? '✅' : type === 'error' ? '❌' : '💡'),
            onModeChange: () => updateMultimeterVisibility()
        });
        // Expand button
        const expBtn = document.getElementById('multimeterExpandBtn');
        if (expBtn) expBtn.addEventListener('click', () => {
            const sec = document.getElementById('multimeterSection');
            if (sec) sec.classList.toggle('multimeter-expanded');
            setTimeout(() => multimeterInstance.handleResize(), 120);
        });
        // 2D jacks default to COM + VΩHz (handled inside 2D class via jackState)
        setTimeout(() => {
            try { if (multimeterInstance && multimeterInstance.syncJackVisual) multimeterInstance.syncJackVisual(); if (multimeterInstance && multimeterInstance.updateDisplay) multimeterInstance.updateDisplay(); } catch {}
        }, 200);
    } catch (e) {
        console.error('Multimeter init failed', e);
    }
}

/* ---------- Theme ---------- */
function applyTheme(name) {
    const root = document.documentElement;
    root.setAttribute('data-theme', name);
    state.theme.overall = name;
    localStorage.setItem('smdlab-theme', name);
    if (themeSelect) themeSelect.value = name;
    // persist to server
    fetch('/api/theme', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({overall:name})}).catch(()=>{});
}
async function loadTheme() {
    try {
        const res = await fetch('/api/theme');
        const data = await res.json();
        if (data.success && data.theme) state.theme = data.theme;
    } catch(e){}
    const saved = localStorage.getItem('smdlab-theme') || (state.theme && state.theme.overall) || window.initialTheme?.overall || 'dark';
    applyTheme(saved);
    // per-type colors from theme?
}

/* ---------- Models ---------- */
async function loadModels() {
    try {
        const res = await fetch('/api/models');
        const data = await res.json();
        if (data.success) state.models = data.models || [];
        else state.models = window.initialModels || [];
    } catch(e) { state.models = window.initialModels || []; }
    renderModelList();
    refreshDetailModelSelect();
}
function renderModelList() {
    const targets = [modelListEl, editModelListEl].filter(Boolean);
    if (targets.length===0) return;
    const filtered = state.models;
    targets.forEach(listEl=>{
        listEl.innerHTML = '';
        if (filtered.length===0) {
            listEl.innerHTML = '<div class="hint" style="text-align:center;padding:10px;border:1px dashed var(--border);border-radius:10px;background:var(--surface-1)">No models yet — upload a .glb in Edit</div>';
            return;
        }
        filtered.forEach(m => {
            const div = document.createElement('div');
            div.className = 'model-item';
            const typeDef = COMPONENT_DEFS[m.type] || COMPONENT_DEFS.resistor;
            div.innerHTML = `
                <span class="dot dot-${m.type}" style="width:10px;height:10px;border-radius:50%;flex-shrink:0;background:${typeDef.border};border:1px solid rgba(255,255,255,0.08)"></span>
                <div class="model-item-info">
                    <div class="model-item-name">${escapeHtml(m.name)} <span style="font-size:10px;color:var(--text-3)">[${m.type}]</span></div>
                    <div class="model-item-meta">${escapeHtml(m.boardId||'default')} · ${m.glbUrl ? 'glb' : 'no file'}${m.description ? ' · '+(m.description.slice(0,32)) : ''}</div>
                </div>
                <div class="model-item-actions">
                    <button class="btn btn-ghost btn-sm" data-act="use" title="Use for selected component">Link</button>
                    <button class="btn btn-ghost btn-sm" data-act="delete" title="Delete">🗑</button>
                </div>`;
            const useBtn = div.querySelector('[data-act="use"]');
            if (useBtn) useBtn.addEventListener('click', () => {
                if (state.selectedRectId) {
                    const comp = state.components.find(c=>c.id===state.selectedRectId);
                    if (comp) {
                        comp.modelId = m.id;
                        comp.modelUrl = m.glbUrl;
                        // also set type to model's type if mismatched? keep
                        refreshDetailModelSelect();
                        if (detailModelSelect) detailModelSelect.value = m.id;
                        saveDetailFromPanel(false);
                        renderEditRects();
                        refresh3DMarkers();
                        toast('Linked: '+m.name+' → selected rect','success','🔗');
                    }
                } else {
                    toast('Select a rectangle first, then Link','info','👆');
                }
            });
            div.querySelector('[data-act="delete"]').addEventListener('click', async () => {
                if (!confirm('Delete model '+m.name+'?')) return;
                try {
                    const res = await fetch('/api/models/'+m.id, {method:'DELETE'});
                    const data = await res.json();
                    if (data.success) { state.models = data.models; renderModelList(); refreshDetailModelSelect(); refresh3DMarkers(); toast('Model deleted','info','🗑'); }
                } catch(e){ toast('Delete failed','error','❌'); }
            });
            listEl.appendChild(div);
        });
    });
}
async function uploadModelFile(file, opts={}) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.glb') && !file.name.toLowerCase().endsWith('.gltf')) {
        toast('Only .glb/.gltf allowed','error','⚠️'); return;
    }
    const fd = new FormData();
    fd.append('file', file);
    fd.append('boardId', opts.boardId || state.boards.activeBoardId || 'default');
    // prefer edit inputs when in edit mode, fallback to sidebar legacy
    const typeVal = opts.type || (state.mode==='edit' && editModelTypeSelect ? editModelTypeSelect.value : (modelTypeSelect?modelTypeSelect.value:'resistor')) || 'resistor';
    const nameVal = opts.name || (state.mode==='edit' && editModelNameInput ? editModelNameInput.value.trim() : (modelNameInput?modelNameInput.value.trim():'')) || file.name.replace(/\.glb.*$/i,'').replace(/\.gltf.*$/i,'').slice(0,60);
    const descVal = opts.description || (state.mode==='edit' && editModelDescInput ? editModelDescInput.value.trim() : (modelDescInput?modelDescInput.value.trim():'')) || '';
    fd.append('type', typeVal);
    fd.append('name', nameVal);
    fd.append('description', descVal);
    try {
        toast('Uploading model...','info','⏳');
        const res = await fetch('/upload/model', {method:'POST', body: fd});
        const data = await res.json();
        if (!data.success) throw new Error(data.error||'upload failed');
        state.models = data.models || state.models;
        renderModelList();
        refreshDetailModelSelect();
        if (modelNameInput) modelNameInput.value='';
        if (modelDescInput) modelDescInput.value='';
        if (editModelNameInput) editModelNameInput.value='';
        if (editModelDescInput) editModelDescInput.value='';
        refresh3DMarkers();
        toast('Model uploaded: '+data.model.name+' — now link it to a rectangle','success','✅');
        return data.model;
    } catch(e){ toast('Upload failed: '+e.message,'error','❌'); }
}
function refreshDetailModelSelect() {
    if (!detailModelSelect) return;
    const cur = detailModelSelect.value;
    detailModelSelect.innerHTML = '<option value="">— Manual (no model) —</option>';
    state.models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = `${m.name} [${m.type}] (${m.boardId})`;
        opt.dataset.url = m.glbUrl;
        detailModelSelect.appendChild(opt);
    });
    if (cur) detailModelSelect.value = cur;
    // also update hint
    const selId = detailModelSelect.value;
    if (detailModelHint) {
        if (selId) {
            const m = state.models.find(x=>x.id===selId);
            detailModelHint.textContent = m ? `Linked: ${m.name} → ${m.glbUrl}` : '';
        } else detailModelHint.textContent = '';
    }
    if (detailModelClearBtn) detailModelClearBtn.classList.toggle('hidden', !detailModelSelect.value);
    if (detailView3DBtn) detailView3DBtn.classList.toggle('hidden', !detailModelSelect.value && !state.selectedRectId);
}

/* ---------- Boards ---------- */
async function loadBoards() {
    try {
        const res = await fetch('/api/boards');
        const data = await res.json();
        if (data.success) state.boards = data.boards || data;
        else state.boards = window.initialBoards || {activeBoardId:'default', boards:[]};
    } catch(e) { state.boards = window.initialBoards || {activeBoardId:'default', boards:[]}; }
    renderBoardSelect();
}
function renderBoardSelect() {
    const selects = [boardSelect, editBoardSelect].filter(Boolean);
    if (selects.length===0) return;
    const boards = state.boards.boards || [];
    selects.forEach(sel=>{
        sel.innerHTML = '';
        boards.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = `${b.name} ${b.id===state.boards.activeBoardId?'●':''}`;
            sel.appendChild(opt);
        });
        sel.value = state.boards.activeBoardId || 'default';
    });
    if (deleteBoardBtn) deleteBoardBtn.disabled = (boardSelect ? boardSelect.value==='default' : false);
    if (editDeleteBoardBtn) editDeleteBoardBtn.disabled = (editBoardSelect ? editBoardSelect.value==='default' : false);
}
async function createBoard(clone=false) {
    const name = prompt('Board name:', clone ? 'Copy of '+(state.boards.boards.find(b=>b.id===state.boards.activeBoardId)?.name||'Board') : 'New Board');
    if (!name) return;
    try {
        const res = await fetch('/api/boards', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name, cloneCurrent: clone, activate:true})});
        const data = await res.json();
        if (data.success) {
            state.boards = data.boards;
            renderBoardSelect();
            // if new board is empty, we should clear local view? The server already cleared components for new empty board. Reload.
            if (!clone) {
                state.components = [];
                state.frontUrl = null; state.backUrl=null; state.boardSize=null;
                sceneManager.clearBoard();
                updateSideUI(); refresh3DMarkers(); updateFilterCounts();
                showSidebar(false);
                toast('New board created: '+name,'success','✅');
            } else {
                // cloned: reload components from server
                await fetchComponentsFromServer();
                // front/back urls from board snapshot? For now server kept them, but frontend frontUrl still old. Reload page or fetch?
                toast('Board cloned: '+name,'success','⎘');
            }
        }
    } catch(e){ toast('Board create failed','error','❌'); }
}
async function activateBoard(boardId) {
    if (!boardId) return;
    try {
        const res = await fetch('/api/boards/'+boardId+'/activate', {method:'POST'});
        const data = await res.json();
        if (data.success) {
            state.boards = data.boards;
            renderBoardSelect();
            // load components and board images for this board
            state.components = data.components || [];
            // try to get board front/back from boards data
            const board = state.boards.boards.find(b=>b.id===boardId);
            if (board) {
                // board front/back URLs may be null or per-board; if they are stored, use them
                // For now if board has frontUrl/backUrl, we could set state.frontUrl/backUrl accordingly, but images are global files. Instead we will fetch current board images from server's get_board_urls? The server's active board snapshot is now this board, so we should reload page's initial images? Simpler: reload page to reflect new board's images.
                // Instead of reload, we can just update state and rebuild.
                // If board has frontUrl, set state.frontUrl to it, else keep null.
                // But frontUrl may be a per-board file not yet copied to main. For simplicity, we will just update components and keep images as is, and ask user to re-upload if needed.
            }
            updateSideUI();
            await rebuildBoard();
            refresh3DMarkers();
            updateFilterCounts();
            clearSidebarDetail();
            toast('Switched to board: '+ (board?board.name:boardId),'info','🔀');
        }
    } catch(e){ toast('Activate failed','error','❌'); }
}
async function deleteCurrentBoard() {
    // prefer edit selector when in edit mode, fallback to legacy
    const boardId = (state.mode==='edit' && editBoardSelect ? editBoardSelect.value : (boardSelect ? boardSelect.value : state.boards.activeBoardId));
    if (boardId==='default') { toast('Cannot delete default','error','⚠️'); return; }
    if (!confirm('Delete board '+boardId+'? This cannot be undone.')) return;
    try {
        const res = await fetch('/api/boards/'+boardId, {method:'DELETE'});
        const data = await res.json();
        if (data.success) {
            state.boards = data.boards;
            renderBoardSelect();
            // load default board components
            state.components = [];
            await fetchComponentsFromServer();
            await rebuildBoard();
            updateFilterCounts();
            toast('Board deleted','info','🗑');
        }
    } catch(e){ toast('Delete failed','error','❌'); }
}

/* ---------- 3D Model Viewer ---------- */
let modelViewer = null;
function initModelViewer() {
    if (!modelViewerCanvas) return;
    const renderer = new THREE.WebGLRenderer({canvas: modelViewerCanvas, antialias:true, alpha:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.35));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0B0F1A);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(1.5,1.2,1.8);
    const controls = new (THREE.OrbitControls || window.OrbitControls || null) ? null : null;
    // Use OrbitControls from three/addons
    // We will lazy import via dynamic
    let orbitControls = null;
    try {
        const { OrbitControls } = THREE; // fallback
    } catch(e){}
    // Instead create via import
    const loader = new GLTFLoader();
    // Lights
    const ambient = new THREE.HemisphereLight(0x8fb8ff, 0x0a0a14, 0.9);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 1.4);
    dir.position.set(2,3,2);
    scene.add(dir);
    const point = new THREE.PointLight(0x4dd0ff, 0.6, 10);
    point.position.set(-2,2,-2);
    scene.add(point);
    // OrbitControls for viewer
    let viewerControls = null;
    import('three/addons/controls/OrbitControls.js').then(mod=>{
        viewerControls = new mod.OrbitControls(camera, renderer.domElement);
        viewerControls.enableDamping = true;
        viewerControls.dampingFactor = 0.07;
        viewerControls.autoRotate = true;
        viewerControls.autoRotateSpeed = 0.8;
        modelViewer.controls = viewerControls;
    }).catch(()=>{});
    const clock = new THREE.Clock();
    let currentModel = null;
    let rafId = null;
    function onResize() {
        const wrap = document.getElementById('modelViewerWrap');
        if (!wrap) return;
        const w = wrap.clientWidth;
        const h = wrap.clientHeight || 420;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', onResize);
    // Also observe wrap
    if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(onResize);
        const wrap = document.getElementById('modelViewerWrap');
        if (wrap) ro.observe(wrap);
    }
    function animate() {
        rafId = requestAnimationFrame(animate);
        const dt = clock.getDelta();
        if (viewerControls) viewerControls.update();
        else if (modelViewer && modelViewer.controls) modelViewer.controls.update();
        // gentle spin if no controls
        if (currentModel && !viewerControls) currentModel.rotation.y += dt * 0.4;
        renderer.render(scene, camera);
    }
    animate();
    // expose
    modelViewer = {
        renderer, scene, camera, loader, currentModel: null, controls: null, wrap: document.getElementById('modelViewerWrap'),
        setModel: async (url) => {
            if (modelViewerLoading) modelViewerLoading.classList.remove('hidden');
            if (modelViewerEmpty) modelViewerEmpty.classList.add('hidden');
            // clear previous
            if (modelViewer.currentModel) {
                scene.remove(modelViewer.currentModel);
                modelViewer.currentModel = null;
                currentModel = null;
            }
            if (!url) {
                if (modelViewerLoading) modelViewerLoading.classList.add('hidden');
                if (modelViewerEmpty) modelViewerEmpty.classList.remove('hidden');
                return;
            }
            try {
                const gltf = await loader.loadAsync(url);
                const model = gltf.scene;
                // center and scale
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                model.position.sub(center);
                const size = box.getSize(new THREE.Vector3()).length();
                const scale = size > 0 ? (1.2 / size) : 1;
                model.scale.setScalar(scale);
                // add subtle shadow plane?
                scene.add(model);
                modelViewer.currentModel = model;
                currentModel = model;
                // frame camera
                camera.position.set(1.5,1.2,1.8);
                if (viewerControls) {
                    viewerControls.target.set(0,0,0);
                    viewerControls.update();
                }
                if (modelViewerLoading) modelViewerLoading.classList.add('hidden');
                if (modelViewerEmpty) modelViewerEmpty.classList.add('hidden');
                onResize();
            } catch(e) {
                console.error('load glb failed', e);
                if (modelViewerLoading) modelViewerLoading.classList.add('hidden');
                if (modelViewerEmpty) {
                    modelViewerEmpty.classList.remove('hidden');
                    modelViewerEmpty.querySelector('p').textContent = 'Failed to load model';
                }
                toast('Failed to load 3D model','error','❌');
            }
        },
        clear: () => {
            if (modelViewer.currentModel) { scene.remove(modelViewer.currentModel); modelViewer.currentModel=null; }
            if (modelViewerEmpty) modelViewerEmpty.classList.remove('hidden');
        }
    };
    // hack: assign controls later
    setTimeout(()=>{ if (viewerControls) modelViewer.controls = viewerControls; }, 500);
    onResize();
}
function openModelViewer(comp) {
    if (!comp) return;
    state.modelViewerCompId = comp.id;
    const def = COMPONENT_DEFS[comp.type] || COMPONENT_DEFS.resistor;
    if (modelViewerTitle) modelViewerTitle.textContent = comp.name ? comp.name : def.label;
    if (modelViewerSubtitle) modelViewerSubtitle.textContent = def.label + ' — ' + def.en + (comp.value ? ' · '+comp.value : '') + (comp.side==='front'?' · روی برد':' · پشت برد');
    if (modelViewerMeta) {
        const modelInfo = comp.modelId ? (state.models.find(m=>m.id===comp.modelId)?.name || comp.modelId) : (comp.modelUrl ? 'direct .glb' : 'no model');
        modelViewerMeta.textContent = `Model: ${modelInfo} ${comp.color ? ' · color '+comp.color : ''}`;
    }
    // resolve model url: prefer component's modelUrl, else linked modelId's glbUrl, else per-type default?
    let url = comp.modelUrl || null;
    if (!url && comp.modelId) {
        const m = state.models.find(x=>x.id===comp.modelId);
        if (m) url = m.glbUrl;
    }
    // also allow board-level model fallback? If no model, we can show placeholder and allow upload
    if (modelViewerOverlay) modelViewerOverlay.classList.remove('hidden');
    if (modelViewer) {
        modelViewer.setModel(url);
    } else {
        // init lazily if not yet
        setTimeout(()=> { if (modelViewer) modelViewer.setModel(url); }, 200);
    }
    // update sidebar to full details for this component (as requested)
    showSidebarDetail(comp);
    // ensure outer detail expanded
    if (outerDetailWrap && !outerDetailWrap.classList.contains('expanded')) setOuterExpanded(outerDetailWrap, true);
    // toast
    if (!url) toast('No 3D model linked — upload one in Edit or Model Library','info','🧊');
}
function closeModelViewer() {
    if (modelViewerOverlay) modelViewerOverlay.classList.add('hidden');
    state.modelViewerCompId = null;
}

/* ---------- Drawing logic ---------- */
function getNormalizedFromEvent(e) {
    const rect = editBoardImage.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < -0.08 || x > 1.08 || y < -0.08 || y > 1.08) return null;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
}
function onEditPointerDown(e) {
    if (state.mode !== 'edit') return;
    // Pan with right/middle/shift/alt/ctrl — always, even without zoom (free movement)
    if (e.button === 2 || e.button === 1 || e.altKey || e.shiftKey || e.ctrlKey) {
        state.isPanning = true;
        state.panStart = { x: e.clientX, y: e.clientY, panX: state.editPanX, panY: state.editPanY };
        try { editBoardViewport.setPointerCapture(e.pointerId); } catch {}
        e.preventDefault();
        return;
    }
    if (e.button !== 0) return;
    if (e.target.closest('.edit-rect')) return;
    if (e.target.closest('#detailPanel') || e.target.closest('#zoomControls')) return;
    if (e.target === editBoardViewport) {
        // If no component type selected, left-drag on viewport should pan (free movement), not just toast
        if (!state.selectedType) {
            state.isPanning = true;
            state.panStart = { x: e.clientX, y: e.clientY, panX: state.editPanX, panY: state.editPanY };
            try { editBoardViewport.setPointerCapture(e.pointerId); } catch {}
            e.preventDefault();
            return;
        }
        // If zoomed, also allow left-drag pan on viewport
        if (state.editZoom > 1.02) {
            state.isPanning = true;
            state.panStart = { x: e.clientX, y: e.clientY, panX: state.editPanX, panY: state.editPanY };
            try { editBoardViewport.setPointerCapture(e.pointerId); } catch {}
            e.preventDefault();
            return;
        }
    }
    if (!state.selectedType) {
        toast('ابتدا نوع قطعه را انتخاب کنید', 'error', '⚠️');
        componentPalette.animate([{transform:'translateX(0)'},{transform:'translateX(-6px)'},{transform:'translateX(6px)'},{transform:'translateX(0)'}], {duration:280});
        return;
    }
    const pos = getNormalizedFromEvent(e);
    if (!pos) {
        if (state.editZoom > 1.02) {
            state.isPanning = true;
            state.panStart = { x: e.clientX, y: e.clientY, panX: state.editPanX, panY: state.editPanY };
            try { editBoardViewport.setPointerCapture(e.pointerId); } catch {}
        }
        return;
    }
    state.isDrawing = true;
    state.drawStart = pos;
    editPreviewRect.style.left = (pos.x * 100) + '%';
    editPreviewRect.style.top = (pos.y * 100) + '%';
    editPreviewRect.style.width = '0%';
    editPreviewRect.style.height = '0%';
    const def = COMPONENT_DEFS[state.selectedType];
    editPreviewRect.style.borderColor = def.border;
    editPreviewRect.style.background = def.bg;
    editPreviewRect.style.boxShadow = `0 0 12px ${def.border}44`;
    editPreviewRect.classList.remove('hidden');
    try { editBoardStage.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
}
function onEditPointerMove(e) {
    if (state.isPanning && state.panStart) {
        const dx = e.clientX - state.panStart.x;
        const dy = e.clientY - state.panStart.y;
        state.editPanX = state.panStart.panX + dx;
        state.editPanY = state.panStart.panY + dy;
        clampPan();
        applyZoomTransform();
        return;
    }
    if (!state.isDrawing || !state.drawStart) return;
    const cur = getNormalizedFromEvent(e);
    if (!cur) return;
    const x = Math.min(state.drawStart.x, cur.x);
    const y = Math.min(state.drawStart.y, cur.y);
    const w = Math.abs(cur.x - state.drawStart.x);
    const h = Math.abs(cur.y - state.drawStart.y);
    editPreviewRect.style.left = (x*100)+'%';
    editPreviewRect.style.top = (y*100)+'%';
    editPreviewRect.style.width = (w*100)+'%';
    editPreviewRect.style.height = (h*100)+'%';
}
function onEditPointerUp(e) {
    if (state.isPanning) {
        state.isPanning = false;
        state.panStart = null;
        try { editBoardViewport.releasePointerCapture(e.pointerId); } catch {}
        return;
    }
    if (!state.isDrawing) return;
    state.isDrawing = false;
    const cur = getNormalizedFromEvent(e);
    editPreviewRect.classList.add('hidden');
    if (!cur || !state.drawStart) {
        state.drawStart = null;
        return;
    }
    const x = Math.min(state.drawStart.x, cur.x);
    const y = Math.min(state.drawStart.y, cur.y);
    const w = Math.abs(cur.x - state.drawStart.x);
    const h = Math.abs(cur.y - state.drawStart.y);
    state.drawStart = null;
    if (w < 0.002 || h < 0.002) {
        toast('ناحیه خیلی کوچک است — کمی بزرگ‌تر بکشید', 'error', '⚠️');
        return;
    }
    const clampedX = Math.max(0, Math.min(1 - w, x));
    const clampedY = Math.max(0, Math.min(1 - h, y));
    const newComp = {
        id: uuid(),
        type: state.selectedType,
        side: state.editSide,
        x: Math.round(clampedX*10000)/10000,
        y: Math.round(clampedY*10000)/10000,
        w: Math.round(w*10000)/10000,
        h: Math.round(h*10000)/10000,
        name: '',
        description: '',
        value: '',
        attachmentPoints: getDefaultAttachmentPoints(state.selectedType),
    };
    state.components.push(newComp);
    renderEditRects();
    updateFilterCounts();
    refresh3DMarkers();
    setTimeout(() => {
        const el = editRectLayer.querySelector(`.edit-rect[data-id="${newComp.id}"]`);
        if (el) {
            el.animate([{transform:'scale(0.7)', opacity:'0'}, {transform:'scale(1.08)', opacity:'1'}, {transform:'scale(1)', opacity:'1'}], {duration: 420, easing:'cubic-bezier(.16,1,.3,1)'});
            flashEditRect(newComp.id);
        }
    }, 60);
    state.selectedRectId = newComp.id;
    deleteSelectedBtn.classList.remove('hidden');
    openDetailPanel(newComp.id, true);
}
function onEditStageClick(e) {
    // No auto deselect — handled by selectRect
}
function onEditWheel(e) {
    if (state.mode !== 'edit') return;
    // Sidebar is dedicated to editing — scrolling inside it should NOT zoom board
    const target = e.target;
    if (target && target.closest) {
        if (target.closest('#editSidebar') || target.closest('#detailPanel') || target.closest('.detail-panel')) {
            return;
        }
    }
    e.preventDefault();
    const delta = -e.deltaY;
    const factor = delta > 0 ? 1.12 : 0.88;
    setZoom(state.editZoom * factor, e.clientX, e.clientY);
}

/* ---------- 3D Markers ---------- */
let markersMap = new Map();
let raycaster = new THREE.Raycaster();
let mouseNDC = new THREE.Vector2();

function resolveModelUrl(comp) {
    if (comp.modelUrl) return comp.modelUrl;
    if (comp.modelId) {
        const m = state.models.find(x=>x.id===comp.modelId);
        if (m && m.glbUrl) return m.glbUrl;
    }
    return null;
}

function placeGltfOnBoard(comp, compGroup, wWorld, hWorld, cx, cz, yOffset, effectiveColor) {
    const url = resolveModelUrl(comp);
    if (!url) return;
    loadGltfCached(url).then(gltf=>{
        if (compGroup.userData.hasModel) return;
        const src = gltf.scene;
        const model = src.clone(true);
        const box = new THREE.Box3().setFromObject(model);
        if (!isFinite(box.min.x)) return;
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        // Center model at origin so its geometric center is at (0,0,0)
        model.position.sub(center);
        // Scale to fit rectangle footprint, preserving aspect — ensure tiny components still visible
        const footprint = Math.max(size.x, size.z) || 1;
        const rawTarget = Math.max(wWorld, hWorld) * 0.88;
        const target = Math.max(rawTarget, 0.06);
        let scale = target / footprint;
        const mScale = parseFloat(comp.modelScale) || 1;
        scale *= Math.max(0.1, Math.min(6, mScale));
        // Prevent excessive height — keep model close to board (max 0.7 units tall)
        const rawHeight = size.y * scale;
        if (rawHeight > 0.75) scale = 0.75 / size.y * (mScale>1? mScale:1);
        if (rawHeight < 0.04) scale = 0.04 / size.y;
        model.scale.setScalar(scale);
        // surface/offset must be defined before userData (was TDZ bug — caused 3D parts to never render)
        const surfaceY = yOffset;
        const offsetY = parseFloat(comp.modelOffsetY) || 0;
        model.userData.baseScale = scale;
        model.userData._footprint = footprint;
        model.userData._rawTarget = rawTarget;
        model.userData._target = target;
        model.userData._origSize = size.clone();
        model.userData._origCenter = center.clone();
        model.userData._surfaceY = surfaceY;
        model.userData._cx = cx;
        model.userData._cz = cz;
        model.userData._yOffset = yOffset;
        model.userData._lastMScale = mScale;
        model.userData._lastOffsetY = offsetY;
        model.userData.compId = comp.id;
        // Apply rotations from component (user adjustable) — X/Y/Z
        const rotX = parseFloat(comp.modelRotX) || 0;
        const rotY = parseFloat(comp.modelRotY) || 0;
        const rotZ = parseFloat(comp.modelRotZ) || 0;
        model.rotation.set(THREE.MathUtils.degToRad(rotX), THREE.MathUtils.degToRad(rotY), THREE.MathUtils.degToRad(rotZ));
        model.userData.baseRotX = rotX; model.userData.baseRotY = rotY; model.userData.baseRotZ = rotZ;
        // Recompute height after scale (Y rotation does not affect Y, but X/Z do slightly — recompute anyway)
        const box2 = new THREE.Box3().setFromObject(model);
        const size2 = box2.getSize(new THREE.Vector3());
        const height = size2.y;
        // Position so bottom touches board surface (+ tiny gap + user height offset) — surfaceY/offsetY already defined above
        const yPos = surfaceY + (comp.side==='front' ? height/2 + 0.006 + offsetY : -height/2 - 0.006 - offsetY);
        model.position.set(cx, yPos, cz);
        model.userData.basePosY = yPos;
        model.userData.baseOffsetY = offsetY;
        // No extra flip for back side — boardGroup already handles orientation via its own flip
        
        // traversal: enable shadows, store original materials for flashing, apply tint if color override?
        const mats = [];
        model.traverse(o=>{
            if (o.isMesh) {
                o.castShadow = true;
                o.receiveShadow = true;
                if (o.material) {
                    // clone material to avoid shared
                    const clones = Array.isArray(o.material) ? o.material.map(m=>m.clone()) : [o.material.clone()];
                    o.material = Array.isArray(o.material) ? clones : clones[0];
                    clones.forEach(m=>{
                        mats.push(m);
                        // store base color
                        if (m.color) m.userData.baseColor = m.color.clone();
                        if (m.emissive) m.userData.baseEmissive = m.emissive.clone();
                    });
                    // if per-component color, tint slightly? Keep original but we could lerp
                    if (comp.color) {
                        clones.forEach(m=>{
                            if (m.color) {
                                // blend 25% toward chosen color
                                const tint = new THREE.Color(comp.color);
                                m.color.lerp(tint, 0.18);
                                if (m.emissive) m.emissive.copy(m.color).multiplyScalar(0.22);
                            }
                        });
                    }
                }
            }
        });
        // aa — also add attachment points ON the 3D model itself (on top surface)
        try{
            ensureAttachmentPoints(comp);
            const modelTopY = yPos; // model center y
            // compute model height in world units after scale — FIX: convert to local coords (divide by scale) because sph is child of scaled model
            const bbox = new THREE.Box3().setFromObject(model);
            const mSize = bbox.getSize(new THREE.Vector3());
            // world half-height; local needs /scale because parent scale multiplies child local offset
            const scaleNow = model.scale.x || scale || 1;
            const inv = scaleNow ? 1/scaleNow : 1;
            const topLocalY = (mSize.y/2 + 0.015) * inv;
            (comp.attachmentPoints||[]).forEach(pt=>{
                const isConn = Object.values(state.cableMap||{}).some(v=> v && v.componentId===comp.id && v.pointId===pt.id);
                const sphGeo = new THREE.SphereGeometry(0.014, 10, 10);
                const sphMat = new THREE.MeshStandardMaterial({color: isConn?0x0BE881:0xFFD54F, emissive: isConn?0x0BE881:0xFFC107, emissiveIntensity: isConn?0.9:0.7, roughness:0.3});
                const sph = new THREE.Mesh(sphGeo, sphMat);
                // local offset within model footprint: map nx/ny 0-1 to model local XZ — FIX divide by scale
                const lx = (pt.nx - 0.5) * wWorld * 0.92 * inv;
                const lz = (pt.ny - 0.5) * hWorld * 0.92 * inv;
                sph.position.set(lx, topLocalY, lz);
                sph.userData.compId = comp.id;
                sph.userData.pointId = pt.id;
                sph.userData.isAp = true;
                sph.userData.isApOnModel = true;
                model.add(sph);
                // also store in global map for highlight (use same key but with :model suffix? keep same key for board sphere, but also need model sphere highlight — we will store model sphere separately and highlight both)
                cableApMeshes.set(comp.id+':'+pt.id+':model', sph);
            });
        } catch(e){ console.warn('ap on model failed',e); }
        compGroup.add(model);
        compGroup.userData.hasModel = true;
        compGroup.userData.model = model;
        compGroup.userData.modelMats = mats;
        // store in instance map
        modelInstanceMap.set(comp.id, {model, mats});
        // update map entry to include model mats for flashing
        const entry = markersMap.get(comp.id);
        if (entry) {
            entry.model = model;
            entry.modelMats = mats;
        }
    }).catch(err=>{
        console.warn('GLB load failed for', url, err);
        toast('3D model failed to load — check .glb','error','⚠️');
    });
}


/* ---------- aa — Cable System — pull & connect with engaging animation ---------- */
let cableOverlaySvg = null;
let cableProbeTipEl = null;
let cableHintEl = null;
const CABLE_COLORS = { '10a':'#E53935', 'maua':'#EF5350', 'com':'#1A1A1A', 'vohm':'#E53935' };
const CABLE_JACKS = ['10a','maua','com','vohm'];
// ac — continuous beep + probe activation: track currently armed probe for click-to-connect, and allow point-click to detach
let activeProbeJack = null;
function setActiveProbe(jackId){
    // toggle: if same jack again, deactivate
    if (activeProbeJack === jackId) {
        activeProbeJack = null;
        document.querySelectorAll('.dmm2d-probe-handle.active-probe').forEach(el=>el.classList.remove('active-probe'));
        document.querySelectorAll('.dmm2d-probe.active').forEach(el=>el.classList.remove('active'));
        if (cableHintEl){ cableHintEl.classList.add('hidden'); }
        return;
    }
    activeProbeJack = jackId;
    document.querySelectorAll('.dmm2d-probe-handle').forEach(el=>el.classList.remove('active-probe'));
    document.querySelectorAll('.dmm2d-probe').forEach(el=>el.classList.remove('active'));
    const probe = document.querySelector(`.dmm2d-probe[data-wire="${jackId}"]`);
    if (probe){
        probe.classList.add('active');
        const h = probe.querySelector('.dmm2d-probe-handle');
        if (h) h.classList.add('active-probe');
    }
    const jack = document.querySelector(`.dmm2d-jack[data-jack="${jackId}"]`);
    if (jack) { jack.classList.add('active-probe'); setTimeout(()=>jack.classList.remove('active-probe'), 900); }
    // ensure jack is considered plugged (activated) so internal wire shows as armed
    try{
        const mm = (typeof getMultimeter==='function' ? getMultimeter() : null) || (typeof multimeterInstance!=='undefined' ? multimeterInstance : null);
        if (mm && mm.jackState){
            mm.jackState[jackId]=true;
            if (jackId!=='com'){
                Object.keys(mm.jackState).forEach(k=>{ if(k!=='com' && k!==jackId) mm.jackState[k]=false; });
            }
            try{ mm.syncJackVisual(); }catch{}
        }
    }catch{}
    if (cableHintEl){
        const name = jackId==='com' ? 'COM (black)' : jackId.toUpperCase() + ' (red)';
        cableHintEl.classList.remove('hidden');
        cableHintEl.textContent = `✋ Probe ${name} activated — click a gold point to connect, or click again to cancel`;
    }
    toast(`Probe ${jackId.toUpperCase()} activated — now click a gold point to connect 🔌`, 'info', '✋');
}
function clearActiveProbe(){
    activeProbeJack=null;
    document.querySelectorAll('.dmm2d-probe-handle.active-probe').forEach(el=>el.classList.remove('active-probe'));
    document.querySelectorAll('.dmm2d-probe.active').forEach(el=>el.classList.remove('active'));
    if (cableHintEl) cableHintEl.classList.add('hidden');
}


function initCableSystem(){
    cableOverlaySvg = document.getElementById('cableOverlay');
    cableProbeTipEl = document.getElementById('cableProbeTip');
    cableHintEl = document.getElementById('cableHint');
    if (!cableOverlaySvg) return;
    // create 4 paths
    CABLE_JACKS.forEach(jackId=>{
        let p = cableOverlaySvg.querySelector(`[data-cable="${jackId}"]`);
        if (!p){
            p = document.createElementNS('http://www.w3.org/2000/svg','path');
            p.setAttribute('data-cable', jackId);
            p.setAttribute('class','cable-path');
            p.setAttribute('fill','none');
            // use viewport coords via CSS? we will set d via pixel coords using JS transformation to svg viewBox 0 0 window.innerWidth etc. Simpler: use absolute px via <svg> with no viewBox scaling, use width/height 100% and path d in client pixels via getBoundingClientRect mapping. So we keep svg viewBox 0 0 100 100 but we will not use it; instead we set style width/height 100% and use client coords as if viewBox is screen size by updating viewBox on resize.
            cableOverlaySvg.appendChild(p);
        }
        p.style.stroke = CABLE_COLORS[jackId] || '#E53935';
        p.style.color = CABLE_COLORS[jackId] || '#E53935';
    });
    updateCableOverlay();
    // attach drag handlers to probe handles and jacks (multimeter)
    // Use event delegation: listen on document for pointerdown on those handles
    document.addEventListener('pointerdown', onProbeHandlePointerDown, {capture:true});
    window.addEventListener('pointermove', onCablePointerMove, {passive:false});
    window.addEventListener('pointerup', onCablePointerUp, {passive:false});
    window.addEventListener('resize', ()=> { requestAnimationFrame(updateCableOverlay); });
    // fix: red wires scrolling glitch — update overlay on scroll (sidebar + window) since jackPos uses getBoundingClientRect
    window.addEventListener('scroll', ()=> { if (state.cables.length || state.draggingCable) requestAnimationFrame(updateCableOverlay); }, {passive:true, capture:true});
    const sidebarEl = document.getElementById('sidebar');
    if (sidebarEl) sidebarEl.addEventListener('scroll', ()=> { if (state.cables.length || state.draggingCable) requestAnimationFrame(updateCableOverlay); }, {passive:true});
    document.addEventListener('scroll', ()=> { if (state.cables.length || state.draggingCable) requestAnimationFrame(updateCableOverlay); }, {passive:true, capture:true});
    // also need to periodically update overlay when 3D camera moves (board orbit)
    // hook into sceneManager onTick — always keep overlay synced when any cable present (fixed inset overlay needs per-frame sync for 3D projection)
    try{ sceneManager.onTick(()=>{ if (state.cables.length || state.draggingCable) updateCableOverlay(); }); } catch {}
    // bind attachment point buttons
    const addBtn = document.getElementById('addAttachmentPointBtn');
    const resetBtn = document.getElementById('resetAttachmentPointsBtn');
    if (addBtn) addBtn.addEventListener('click', ()=>{
        if (!state.selectedRectId){ toast('ابتدا یک قطعه را انتخاب کنید','error','⚠️'); return; }
        state.apAdding = !state.apAdding;
        addBtn.textContent = state.apAdding ? '✓ پایان افزودن' : '＋ افزودن نقطه';
        addBtn.classList.toggle('active', state.apAdding);
        toast(state.apAdding ? 'حالت افزودن نقطه فعال — روی مستطیل کلیک کنید' : 'حالت افزودن پایان یافت','info', state.apAdding ? '📍' : '✅');
        renderAttachmentPanel();
    });
    if (resetBtn) resetBtn.addEventListener('click', ()=>{
        if (!state.selectedRectId) return;
        const comp = state.components.find(c=>c.id===state.selectedRectId);
        if (!comp) return;
        // disconnect cables on this comp
        for (const jid of Object.keys(state.cableMap)){
            const v = state.cableMap[jid];
            if (v && v.componentId===comp.id) delete state.cableMap[jid];
        }
        state.cables = Object.entries(state.cableMap).map(([jackId,v])=> ({jackId, componentId:v.componentId, pointId:v.pointId}));
        comp.attachmentPoints = getDefaultAttachmentPoints(comp.type);
        comp.orientation = 'horizontal';
        renderEditRects();
        renderAttachmentPanel();
        refresh3DMarkers();
        refreshEdit3DMarkers();
        updateCableOverlay();
        saveComponentsToServer().then(()=> saveCablesToServer());
        toast('نقاط به حالت پیش‌فرض بازگشت','success','↺');
    });
    // orientation presets — horizontal / vertical
    if (apHorizontalBtn) apHorizontalBtn.addEventListener('click', ()=>{
        if (!state.selectedRectId) { toast('ابتدا یک قطعه انتخاب کنید','error','⚠️'); return; }
        const comp = state.components.find(c=>c.id===state.selectedRectId);
        if (!comp) return;
        // set to horizontal layout
        if (comp.type==='transistor'){
            comp.attachmentPoints = [
                {id: comp.attachmentPoints[0]?.id || apShortId().slice(0,6), label:'E', nx:0.18, ny:0.5},
                {id: comp.attachmentPoints[1]?.id || apShortId().slice(0,6), label:'B', nx:0.50, ny:0.5},
                {id: comp.attachmentPoints[2]?.id || apShortId().slice(0,6), label:'C', nx:0.82, ny:0.5},
            ];
        } else if (comp.type==='diode'){
            comp.attachmentPoints = [
                {id: comp.attachmentPoints[0]?.id || apShortId().slice(0,6), label:'A', nx:0.12, ny:0.5},
                {id: comp.attachmentPoints[1]?.id || apShortId().slice(0,6), label:'K', nx:0.88, ny:0.5},
            ];
        } else {
            comp.attachmentPoints = [
                {id: comp.attachmentPoints[0]?.id || apShortId().slice(0,6), label:'A', nx:0.12, ny:0.5},
                {id: comp.attachmentPoints[1]?.id || apShortId().slice(0,6), label:'B', nx:0.88, ny:0.5},
            ];
        }
        comp.orientation='horizontal';
        // keep cables that still point to existing ids (they do, we reused ids)
        renderEditRects();
        renderAttachmentPanel();
        refresh3DMarkers();
        refreshEdit3DMarkers();
        updateCableOverlay();
        saveComponentsToServer();
        toast('چیدمان افقی اعمال شد ↔','success','↔');
    });
    if (apVerticalBtn) apVerticalBtn.addEventListener('click', ()=>{
        if (!state.selectedRectId) { toast('ابتدا یک قطعه انتخاب کنید','error','⚠️'); return; }
        const comp = state.components.find(c=>c.id===state.selectedRectId);
        if (!comp) return;
        if (comp.type==='transistor'){
            comp.attachmentPoints = [
                {id: comp.attachmentPoints[0]?.id || apShortId().slice(0,6), label:'E', nx:0.5, ny:0.18},
                {id: comp.attachmentPoints[1]?.id || apShortId().slice(0,6), label:'B', nx:0.5, ny:0.50},
                {id: comp.attachmentPoints[2]?.id || apShortId().slice(0,6), label:'C', nx:0.5, ny:0.82},
            ];
        } else if (comp.type==='diode'){
            comp.attachmentPoints = [
                {id: comp.attachmentPoints[0]?.id || apShortId().slice(0,6), label:'A', nx:0.5, ny:0.12},
                {id: comp.attachmentPoints[1]?.id || apShortId().slice(0,6), label:'K', nx:0.5, ny:0.88},
            ];
        } else {
            comp.attachmentPoints = [
                {id: comp.attachmentPoints[0]?.id || apShortId().slice(0,6), label:'A', nx:0.5, ny:0.12},
                {id: comp.attachmentPoints[1]?.id || apShortId().slice(0,6), label:'B', nx:0.5, ny:0.88},
            ];
        }
        comp.orientation='vertical';
        renderEditRects();
        renderAttachmentPanel();
        refresh3DMarkers();
        refreshEdit3DMarkers();
        updateCableOverlay();
        saveComponentsToServer();
        toast('چیدمان عمودی اعمال شد ↕','success','↕');
    });
    // ac: clicking gold dot (2D) should detach/connect probe (view mode) or just toggle in edit mode
    document.addEventListener('click', (e)=>{
        const dot = e.target.closest('.ap-dot');
        if (!dot) return;
        // find compId: dot is inside .edit-rect which has data-id
        const rect = dot.closest('.edit-rect');
        let compId = null;
        let pointId = dot.dataset.pointId;
        if (rect) compId = rect.dataset.id;
        // fallback: ap-dot may have data-comp-id
        if (!compId) compId = dot.dataset.compId || dot.getAttribute('data-comp');
        if (!compId || !pointId){
            // try to find via parent ap-item
            const item = dot.closest('.ap-item');
            if (item) pointId = pointId || item.dataset.pointId;
        }
        if (!compId || !pointId) return;
        // In view mode, clicking dot should connect/disconnect probe (not drag)
        // In edit mode, clicking dot is for drag; but we also support detach on click if cable exists
        const isOccupied = Object.values(state.cableMap||{}).some(v=> v && v.componentId===compId && v.pointId===pointId);
        if (isOccupied || activeProbeJack){
            e.preventDefault();
            e.stopPropagation();
            handleAttachmentPointClick(compId, pointId);
        }
    }, {capture:true});
    if (detailFaulty) detailFaulty.addEventListener('change', ()=>{
        if (!state.selectedRectId) return;
        const comp = state.components.find(c=>c.id===state.selectedRectId);
        if (comp){ comp.isFaulty = !!detailFaulty.checked; saveDetailFromPanel(false); }
    });
}

function cablesToMap(arr){
    const m={};
    (arr||[]).forEach(c=>{ if(c.jackId) m[c.jackId]={componentId:c.componentId, pointId:c.pointId}; });
    return m;
}
function mapToCables(map){
    return Object.entries(map||{}).filter(([k,v])=> v && v.componentId && v.pointId).map(([jackId,v])=> ({jackId, componentId:v.componentId, pointId:v.pointId}));
}

async function loadCablesFromServer(){
    try{
        const res = await fetch('/api/cables');
        const data = await res.json();
        if (data.success && Array.isArray(data.cables)){
            state.cables = data.cables;
            state.cableMap = cablesToMap(data.cables);
            updateCableOverlay();
            updateCableTestUI();
            syncMultimeterCables();
        }
    } catch(e){ console.warn('load cables failed',e); }
}
async function saveCablesToServer(){
    try{
        const cables = mapToCables(state.cableMap);
        state.cables = cables;
        const res = await fetch('/api/cables', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({cables})});
        const data = await res.json();
        if (data.success){
            state.cables = data.cables || cables;
            state.cableMap = cablesToMap(state.cables);
        }
        updateCableTestUI();
        syncMultimeterCables();
        return true;
    } catch(e){ console.error('save cables failed',e); return false; }
}
function syncMultimeterCables(){
    const mm = (typeof getMultimeter==='function' ? getMultimeter() : null) || (typeof multimeterInstance!=='undefined' ? multimeterInstance : null);
    if (mm && mm.setCableMap) {
        try{ mm.setCableMap(state.cableMap, state.components); } catch(e){ console.warn(e); }
    }
    updateCableTestUI();
    // also trigger 3D pulse if valid connection
    const cabled = mm ? mm.getCableConnectedComponent?.() : null;
    if (cabled){
        flashMarker(cabled.id, FLASH_GREEN, 1800);
        const comp = cabled;
        // toast engaging
        // only toast once per connection change? we will handle via save
    }
}

function getJackScreenPos(jackId){
    // prefer multimeter's method
    const mm = (typeof getMultimeter==='function' ? getMultimeter() : null) || (typeof multimeterInstance!=='undefined' ? multimeterInstance : null);
    if (mm && mm.getJackScreenPos){
        const p = mm.getJackScreenPos(jackId);
        if (p) return p;
    }
    // fallback DOM
    try{
        const el = document.querySelector(`.dmm2d-jack[data-jack="${jackId}"] .dmm2d-jack-hole`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {x: r.left + r.width/2, y: r.top + r.height/2};
    } catch { return null; }
}

function findNearestAttachmentPoint(clientX, clientY){
    let best=null; let bestDist=Infinity;
    const canvasEl = document.getElementById('three-canvas');
    const canvasRect = canvasEl ? canvasEl.getBoundingClientRect() : null;
    const editImgRect = (state.mode==='edit' && state.editViewMode==='2d' && editBoardImage) ? editBoardImage.getBoundingClientRect() : null;
    // 2D edit points
    if (editImgRect && state.mode==='edit'){
        state.components.filter(c=> c.side===state.editSide).forEach(comp=>{
            const pts = comp.attachmentPoints || [];
            pts.forEach(pt=>{
                const x = editImgRect.left + (comp.x + comp.w*pt.nx)*editImgRect.width;
                const y = editImgRect.top + (comp.y + comp.h*pt.ny)*editImgRect.height;
                const d = Math.hypot(x-clientX, y-clientY);
                if (d<42 && d<bestDist){ best={comp, point:pt, x, y, mode:'2d'}; bestDist=d; }
            });
        });
    }
    // 3D points — project world pos to screen
    // FIX: when in isolated focus mode, also test focusClone spheres (so probes visible on detached model)
    if (focusState && focusState.active && focusState.focusClone) {
        try {
            const comp = focusState.comp;
            if (comp && comp.attachmentPoints) {
                const pts = comp.attachmentPoints || [];
                // focusClone contains spheres as children with userData pointId ; project their world pos directly
                focusState.focusClone.traverse(o=>{
                    if (o.userData && o.userData.isAp && o.userData.pointId) {
                        try{
                            const world = new THREE.Vector3();
                            o.getWorldPosition(world);
                            const ndc = world.clone().project(sceneManager.camera);
                            if (ndc.z < -1 || ndc.z > 1) return;
                            const sx = (ndc.x*0.5+0.5)*canvasRect.width + canvasRect.left;
                            const sy = (-ndc.y*0.5+0.5)*canvasRect.height + canvasRect.top;
                            if (sx < canvasRect.left-60 || sx > canvasRect.right+60 || sy < canvasRect.top-60 || sy > canvasRect.bottom+60) return;
                            const d = Math.hypot(sx-clientX, sy-clientY);
                            const pt = pts.find(p=>p.id===o.userData.pointId);
                            if (d<56 && d<bestDist && pt){ best={comp, point:pt, x:sx, y:sy, mode:'3d-focus', worldPos:world.clone()}; bestDist=d; }
                        }catch{}
                    }
                });
                // fallback: also compute via board coords but using focusGroup matrixWorld (centered clone)
                if (!best) {
                    // compute expected position at focus clone center (0,0.62,0) + local offsets
                    pts.forEach(pt=>{
                        // approximate focus local offset similar to model sphere placement but centered
                        // we already handled model spheres directly, so skip fallback if model exists
                    });
                }
            }
        } catch(e){}
    }
    if (state.boardSize && canvasRect && sceneManager && sceneManager.camera){
        const boardW = state.boardSize.x, boardD = state.boardSize.z;
        const halfT = THICKNESS/2;
        state.components.forEach(comp=>{
            // in focus mode, hide board points for non-focused comp to avoid clutter, but still allow focused comp's board points as fallback
            if (focusState && focusState.active && comp.id !== focusState.comp.id) {
                // still allow but require tighter distance
            }
            const pts = comp.attachmentPoints || [];
            // determine yOffset depending on side and board flip?
            const yOffset = comp.side==='front' ? halfT+0.025 : -halfT-0.025;
            pts.forEach(pt=>{
                const wx = (comp.x + comp.w*pt.nx -0.5)*boardW;
                const wz = (comp.y + comp.h*pt.ny -0.5)*boardD;
                const world = new THREE.Vector3(wx, yOffset, wz);
                try{
                    world.applyMatrix4(sceneManager.boardGroup.matrixWorld);
                    const ndc = world.clone().project(sceneManager.camera);
                    if (ndc.z < -1 || ndc.z > 1) return;
                    const sx = (ndc.x*0.5 +0.5)*canvasRect.width + canvasRect.left;
                    const sy = (-ndc.y*0.5+0.5)*canvasRect.height + canvasRect.top;
                    if (sx < canvasRect.left-60 || sx > canvasRect.right+60 || sy < canvasRect.top-60 || sy > canvasRect.bottom+60) return;
                    const d = Math.hypot(sx-clientX, sy-clientY);
                    if (d<46 && d<bestDist){ best={comp, point:pt, x:sx, y:sy, mode:'3d', worldPos:world.clone()}; bestDist=d; }
                } catch(e){}
            });
        });
    }
    return best;
}

function updateCableOverlay(){
    if (!cableOverlaySvg) return;
    // ensure svg viewBox matches viewport for pixel-perfect path coords
    const vw = window.innerWidth, vh = window.innerHeight;
    cableOverlaySvg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
    cableOverlaySvg.setAttribute('width', vw);
    cableOverlaySvg.setAttribute('height', vh);
    const dragging = state.draggingCable;
    const draggingJack = dragging ? dragging.jackId : null;
    CABLE_JACKS.forEach(jackId=>{
        const path = cableOverlaySvg.querySelector(`[data-cable="${jackId}"]`);
        if (!path) return;
        const jackPos = getJackScreenPos(jackId);
        // determine target pos: if dragging this jack, use cursor; else if connected, use point screen pos; else if plugged but not connected, use dangling near jack; else hide
        let target = null;
        let isConnected = false;
        let isDragging = draggingJack===jackId;
        if (isDragging){
            target = {x: dragging.curX, y: dragging.curY};
        } else {
            const conn = state.cableMap[jackId];
            if (conn){
                // find point screen pos
                const comp = state.components.find(c=>c.id===conn.componentId);
                const pt = comp ? (comp.attachmentPoints||[]).find(p=>p.id===conn.pointId) : null;
                if (comp && pt){
                    // compute screen pos via same logic as findNearest but directly
                    // prefer 3D projection if board exists, else 2D
                    let pos = null;
                    // FIX: if in isolated focus and cable points to focused comp, use focusClone sphere world pos directly (probes visible on detached model)
                    if (focusState && focusState.active && focusState.focusClone && comp.id===focusState.comp.id) {
                        try {
                            let sphere = null;
                            focusState.focusClone.traverse(o=>{ if(o.userData && o.userData.pointId===pt.id && o.userData.isAp) sphere=o; });
                            if (sphere) {
                                const canvasRect2 = document.getElementById('three-canvas').getBoundingClientRect();
                                const world = new THREE.Vector3();
                                sphere.getWorldPosition(world);
                                const ndc = world.clone().project(sceneManager.camera);
                                // still valid even if board hidden, as focusGroup is visible
                                const sx = (ndc.x*0.5+0.5)*canvasRect2.width + canvasRect2.left;
                                const sy = (-ndc.y*0.5+0.5)*canvasRect2.height + canvasRect2.top;
                                pos = {x:sx, y:sy};
                            }
                        } catch(e){}
                    }
                    if (!pos && state.boardSize && sceneManager && sceneManager.camera && document.getElementById('three-canvas')){
                        const canvasRect = document.getElementById('three-canvas').getBoundingClientRect();
                        const boardW = state.boardSize.x, boardD = state.boardSize.z;
                        const halfT = THICKNESS/2;
                        const yOffset = comp.side==='front' ? halfT+0.025 : -halfT-0.025;
                        const wx = (comp.x + comp.w*pt.nx -0.5)*boardW;
                        const wz = (comp.y + comp.h*pt.ny -0.5)*boardD;
                        const world = new THREE.Vector3(wx, yOffset, wz).applyMatrix4(sceneManager.boardGroup.matrixWorld);
                        const ndc = world.clone().project(sceneManager.camera);
                        const sx = (ndc.x*0.5+0.5)*canvasRect.width + canvasRect.left;
                        const sy = (-ndc.y*0.5+0.5)*canvasRect.height + canvasRect.top;
                        pos = {x:sx, y:sy};
                    } else if (!pos && state.mode==='edit' && editBoardImage){
                        const r = editBoardImage.getBoundingClientRect();
                        pos = {x: r.left + (comp.x + comp.w*pt.nx)*r.width, y: r.top + (comp.y + comp.h*pt.ny)*r.height};
                    }
                    if (pos){
                        target = pos;
                        isConnected = true;
                    }
                }
            }
        }
        // ac fix: do NOT show dangling stub when probe disconnected — user explicitly requested no hanging wires
        // Only show path when actually connected to a board point or being dragged. If jack is plugged but no board connection, hide completely.
        if (!jackPos || (!target)){
            path.classList.remove('visible','dragging','connected');
            path.setAttribute('d','');
            return;
        }
        // build engaging curved path with sag
        const dx = target.x - jackPos.x;
        const dy = target.y - jackPos.y;
        const len = Math.hypot(dx, dy);
        const sag = Math.min(80, Math.max(18, len*0.18)) + (isDragging ? Math.sin(Date.now()*0.012)*6 : 0);
        const mx = (jackPos.x + target.x)/2;
        const my = (jackPos.y + target.y)/2 + sag;
        // control points for cubic bezier for smooth engaging curve
        const c1x = jackPos.x + dx*0.25;
        const c1y = jackPos.y + dy*0.08 + sag*0.45;
        const c2x = jackPos.x + dx*0.75;
        const c2y = target.y - dy*0.12 + sag*0.45;
        const d = `M ${jackPos.x} ${jackPos.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${target.x} ${target.y}`;
        path.setAttribute('d', d);
        path.classList.add('visible');
        path.classList.toggle('dragging', !!isDragging);
        path.classList.toggle('connected', !!isConnected);
        // glow color already via stroke
    });
    // update probe tip
    if (cableProbeTipEl){
        if (dragging){
            cableProbeTipEl.classList.remove('hidden');
            cableProbeTipEl.style.left = dragging.curX + 'px';
            cableProbeTipEl.style.top = dragging.curY + 'px';
            // check hover valid
            const near = findNearestAttachmentPoint(dragging.curX, dragging.curY);
            if (near){
                cableProbeTipEl.classList.add('hover-valid');
                if (cableHintEl) { cableHintEl.classList.remove('hidden'); cableHintEl.textContent = `رها کنید روی ${near.point.label} (${near.comp.name||near.comp.type}) ✨`; }
                // highlight dot on board
                highlightAttachmentPoint(near.comp.id, near.point.id, true);
            } else {
                cableProbeTipEl.classList.remove('hover-valid');
                if (cableHintEl) { cableHintEl.classList.remove('hidden'); cableHintEl.textContent = 'بکشید و روی نقطه طلایی رها کنید ✨'; }
                clearHighlightAttachmentPoints(true);
            }
        } else {
            cableProbeTipEl.classList.add('hidden');
            cableProbeTipEl.classList.remove('hover-valid');
            if (cableHintEl) cableHintEl.classList.add('hidden');
            clearHighlightAttachmentPoints();
        }
    }
}

let _highlightClearTimer=null;
function highlightAttachmentPoint(compId, pointId, on){
    clearHighlightAttachmentPoints(false);
    // 2D dots
    document.querySelectorAll(`.edit-rect[data-id="${compId}"] .ap-dot[data-point-id="${pointId}"]`).forEach(el=> el.classList.add('ap-hover-target'));
    // 3D spheres: we store them in markersMap? For now we will add a CSS class to 3D? Instead we will make the sphere emissive via marker data — we keep a map cableApMeshes
    const key = compId+':'+pointId;
    const mesh = cableApMeshes.get(key);
    if (mesh){
        mesh.material.emissiveIntensity = 1.4;
        mesh.scale.setScalar(1.45);
    }
}
function clearHighlightAttachmentPoints(delay=false){
    if (delay){ clearTimeout(_highlightClearTimer); _highlightClearTimer=setTimeout(()=>clearHighlightAttachmentPoints(false), 320); return; }
    document.querySelectorAll('.ap-dot.ap-hover-target').forEach(el=> el.classList.remove('ap-hover-target'));
    cableApMeshes.forEach((mesh)=>{
        mesh.material.emissiveIntensity = 0.65;
        mesh.scale.setScalar(1);
    });
}
const cableApMeshes = new Map(); // key -> mesh

function onProbeHandlePointerDown(e){
    const handle = e.target.closest('.dmm2d-probe-handle');
    const jack = e.target.closest('.dmm2d-jack');
    let jackId = null;
    let isHandle = !!handle;
    if (handle){
        const probe = handle.closest('.dmm2d-probe');
        jackId = probe ? probe.dataset.wire : null;
    } else if (jack){
        jackId = jack.dataset.jack;
        // jack click: we allow activation via setActiveProbe without drag — handle via click, not drag
    } else {
        return;
    }
    if (!jackId || !CABLE_JACKS.includes(jackId)) return;
    // NEW: Clicking jack (not handle) should activate probe for click-to-connect, not drag
    if (jack && !handle) {
        e.preventDefault();
        e.stopPropagation();
        // toggle active probe for this jack (allows click-then-click-point flow)
        setActiveProbe(jackId);
        // also ensure normal jack visual updates but do not start drag
        return;
    }
    // ensure jack is plugged — auto plug if needed
    const mm = (typeof getMultimeter==='function' ? getMultimeter() : null) || (typeof multimeterInstance!=='undefined' ? multimeterInstance : null);
    if (mm && mm.jackState && !mm.jackState[jackId]){
        mm.jackState[jackId]=true;
        if (jackId!=='com'){
            Object.keys(mm.jackState).forEach(k=>{ if(k!=='com' && k!==jackId) mm.jackState[k]=false; });
        }
        try{ mm.syncJackVisual(); mm.updateDisplay(); } catch{}
    }
    // start dragging this cable
    const startPos = getJackScreenPos(jackId);
    if (!startPos) return;
    state.draggingCable = {jackId, startPos, curX: e.clientX, curY: e.clientY, startX: e.clientX, startY: e.clientY};
    e.preventDefault();
    e.stopPropagation();
    handle.classList.add('drag-active');
    if (cableHintEl) cableHintEl.classList.remove('hidden');
    updateCableOverlay();
    try{ e.target.setPointerCapture(e.pointerId); } catch{}
}

function onCablePointerMove(e){
    if (!state.draggingCable) return;
    state.draggingCable.curX = e.clientX;
    state.draggingCable.curY = e.clientY;
    // prevent scrolling / orbit
    e.preventDefault();
    requestAnimationFrame(updateCableOverlay);
}
async function onCablePointerUp(e){
    if (!state.draggingCable) return;
    const jackId = state.draggingCable.jackId;
    const curX = e.clientX ?? state.draggingCable.curX;
    const curY = e.clientY ?? state.draggingCable.curY;
    const startX = state.draggingCable.startX, startY = state.draggingCable.startY;
    const moved = Math.hypot(curX-startX, curY-startY);
    state.draggingCable = null;
    document.querySelectorAll('.dmm2d-probe-handle.drag-active').forEach(el=> el.classList.remove('drag-active'));
    // find nearest valid point
    const near = findNearestAttachmentPoint(curX, curY);
    if (near && moved>6){
        // check if point already occupied by another jack
        const occupied = Object.entries(state.cableMap).find(([jid, v])=> v && v.componentId===near.comp.id && v.pointId===near.point.id && jid!==jackId);
        if (occupied){
            toast(`نقطه ${near.point.label} قبلاً به ${occupied[0].toUpperCase()} متصل است — ابتدا آن را جدا کنید`, 'error', '⚠️');
            updateCableOverlay();
            return;
        }
        // connect — enforce single red lead: only one of 10a/maua/vohm may be active at once (real probe)
        if (['10a','maua','vohm'].includes(jackId)) {
            ['10a','maua','vohm'].forEach(rj=>{ if(rj!==jackId && state.cableMap[rj]) delete state.cableMap[rj]; });
        }
        state.cableMap[jackId] = {componentId: near.comp.id, pointId: near.point.id};
        // engaging animation: flash the 2D dot and 3D sphere
        const dot2d = document.querySelector(`.edit-rect[data-id="${near.comp.id}"] .ap-dot[data-point-id="${near.point.id}"]`);
        if (dot2d){
            dot2d.classList.add('ap-connected');
            dot2d.animate([{transform:'scale(1)'},{transform:'scale(1.5)'},{transform:'scale(1.15)'},{transform:'scale(1)'}], {duration: 420, easing:'cubic-bezier(.16,1,.3,1)'});
        }
        // pulse 3D marker
        const key = near.comp.id+':'+near.point.id;
        const mesh = cableApMeshes.get(key);
        if (mesh){
            mesh.material.emissiveIntensity = 1.6;
            mesh.scale.setScalar(1.6);
            setTimeout(()=>{ mesh.material.emissiveIntensity=0.65; mesh.scale.setScalar(1); }, 450);
        }
        // also flash the component
        flashMarker(near.comp.id, FLASH_GREEN, 1600);
        await saveCablesToServer();
        renderAttachmentPanel();
        renderEditRects();
        refresh3DMarkers(); // to update ap colors
        updateCableOverlay();
        syncMultimeterCables();
        // engaging success toast + beep
        toast(`متصل شد: ${jackId.toUpperCase()} → ${near.comp.name||near.comp.type} · ${near.point.label} ✨`, 'success', '🔌');
        // play click via multimeter
        try{ const mm=getMultimeter(); if(mm) mm.playClickSound(1200,0.06,0.08); } catch{}
        // test auto-run: if both probes now connected to same component, show test result
        const mm2 = (typeof getMultimeter==='function' ? getMultimeter() : null) || (typeof multimeterInstance!=='undefined' ? multimeterInstance : null);
        if (mm2){
            const tested = mm2.getCableConnectedComponent?.();
            if (tested){
                mm2.setComponent(tested);
                // engaging LCD flash
                const lcd = document.getElementById('dmm2dLcd') || document.querySelector('.dmm2d-lcd');
                if (lcd){
                    lcd.animate([{filter:'brightness(1)'},{filter:'brightness(1.35)'},{filter:'brightness(1)'}], {duration: 500, easing:'ease-out'});
                }
                toast(`تست فعال: ${tested.name||tested.type} — مقدار روی مولتی‌متر نمایش داده شد 🔬`, 'info', '🧪');
            }
        }
    } else if (near===null && moved>12){
        // dropped on empty — disconnect this jack if it was connected
        if (state.cableMap[jackId]){
            const prev = state.cableMap[jackId];
            delete state.cableMap[jackId];
            // ac: also unplug jack so wire doesn't hang
            try{
                const mm = (typeof getMultimeter==='function' ? getMultimeter() : null) || (typeof multimeterInstance!=='undefined' ? multimeterInstance : null);
                if (mm && mm.jackState) { mm.jackState[jackId]=false; try{ mm.syncJackVisual(); }catch{} }
            }catch{}
            await saveCablesToServer();
            renderAttachmentPanel();
            renderEditRects();
            refresh3DMarkers();
            refreshEdit3DMarkers();
            updateCableOverlay();
            syncMultimeterCables();
            clearActiveProbe();
            toast(`${jackId.toUpperCase()} disconnected — wire hidden 🔌`, 'info', '✂️');
        } else {
            // small move or no cable: treat as click activation
            if (moved < 12) {
                setActiveProbe(jackId);
            }
            updateCableOverlay();
        }
    } else if (near===null && moved <= 12){
        // click without drag on handle: activate probe for click-to-connect
        setActiveProbe(jackId);
        updateCableOverlay();
    } else {
        updateCableOverlay();
    }
}

// ac — click on gold point to connect/disconnect active probe (also supports direct detach without active)
async function handleAttachmentPointClick(compId, pointId){
    const comp = state.components.find(c=>c.id===compId);
    if (!comp) return;
    const pt = (comp.attachmentPoints||[]).find(p=>p.id===pointId);
    if (!pt) return;
    // check if any jack already occupies this point
    const occupantEntry = Object.entries(state.cableMap).find(([jid,v])=> v && v.componentId===compId && v.pointId===pointId);
    if (occupantEntry){
        const occJack = occupantEntry[0];
        // detach this probe (click again disconnects)
        delete state.cableMap[occJack];
        try{
            const mm = (typeof getMultimeter==='function' ? getMultimeter() : null) || (typeof multimeterInstance!=='undefined' ? multimeterInstance : null);
            if (mm && mm.jackState) { mm.jackState[occJack]=false; try{ mm.syncJackVisual(); }catch{} }
            if (mm) try{ mm.stopContinuousBeep?.(); }catch{}
        }catch{}
        await saveCablesToServer();
        renderAttachmentPanel();
        renderEditRects();
        refresh3DMarkers();
        refreshEdit3DMarkers();
        updateCableOverlay();
        syncMultimeterCables();
        clearActiveProbe();
        // pulse point to show disconnect
        const dot = document.querySelector(`.edit-rect[data-id="${compId}"] .ap-dot[data-point-id="${pointId}"]`);
        if (dot) dot.classList.remove('ap-connected');
        toast(`Probe ${occJack.toUpperCase()} disconnected from ${pt.label} ✂️`, 'info', '🔌');
        return true;
    }
    // not occupied: only connect if a probe is actively armed — point 4 fix
    // Clicking a point without an active probe should NOT hijack component selection / 3D view
    let targetJack = activeProbeJack;
    if (!targetJack){
        // No active probe and point not occupied → do not auto-connect; allow component click to proceed
        return false;
    }
    // ensure single red enforcement
    if (['10a','maua','vohm'].includes(targetJack)){
        ['10a','maua','vohm'].forEach(rj=>{ if(rj!==targetJack && state.cableMap[rj]) delete state.cableMap[rj]; });
    }
    // check if point already occupied by another jack (handled above) — now connect
    state.cableMap[targetJack] = {componentId: compId, pointId: pointId};
    // ensure jack visual shows plugged
    try{
        const mm = (typeof getMultimeter==='function' ? getMultimeter() : null) || (typeof multimeterInstance!=='undefined' ? multimeterInstance : null);
        if (mm && mm.jackState) { mm.jackState[targetJack]=true; if (targetJack!=='com'){ Object.keys(mm.jackState).forEach(k=>{ if(k!=='com'&&k!==targetJack) mm.jackState[k]=false; }); } try{ mm.syncJackVisual(); }catch{} }
    }catch{}
    await saveCablesToServer();
    renderAttachmentPanel();
    renderEditRects();
    refresh3DMarkers();
    refreshEdit3DMarkers();
    updateCableOverlay();
    syncMultimeterCables();
    clearActiveProbe();
    // engaging animation
    const dot2= document.querySelector(`.edit-rect[data-id="${compId}"] .ap-dot[data-point-id="${pointId}"]`);
    if (dot2){
        dot2.classList.add('ap-connected');
        dot2.animate([{transform:'scale(1)'},{transform:'scale(1.5)'},{transform:'scale(1.15)'},{transform:'scale(1)'}], {duration: 420, easing:'cubic-bezier(.16,1,.3,1)'});
    }
    toast(`Probe ${targetJack.toUpperCase()} → ${comp.name||comp.type} · ${pt.label} connected ✨`, 'success', '🔌');
    // if both probes now connected to same component, ensure multimeter shows it
    try{
        const mm2 = (typeof getMultimeter==='function' ? getMultimeter() : null) || (typeof multimeterInstance!=='undefined' ? multimeterInstance : null);
        if (mm2){
            const tested = mm2.getCableConnectedComponent?.();
            if (tested){
                mm2.setComponent(tested);
                const lcd = document.getElementById('dmm2dLcd') || document.querySelector('.dmm2d-lcd');
                if (lcd) lcd.animate([{filter:'brightness(1)'},{filter:'brightness(1.35)'},{filter:'brightness(1)'}], {duration: 500, easing:'ease-out'});
            }
        }
    }catch{}
    return true;
}

function updateCableTestUI(){
    // sidebar status + test button
    const sec = document.getElementById('multimeterSection');
    if (!sec) return;
    let box = document.getElementById('cableTestBox');
    if (!box){
        box = document.createElement('div');
        box.id='cableTestBox';
        box.style.padding='8px 12px';
        box.style.display='flex';
        box.style.flexDirection='column';
        box.style.gap='6px';
        box.style.background='var(--surface-2)';
        box.style.borderTop='1px solid var(--border)';
        // insert after multimeterInfo
        const info = document.getElementById('multimeterInfo');
        if (info && info.parentElement) info.parentElement.insertBefore(box, info.nextSibling);
        else sec.appendChild(box);
    }
    const mm = (typeof getMultimeter==='function' ? getMultimeter() : null) || (typeof multimeterInstance!=='undefined' ? multimeterInstance : null);
    const hasAny = Object.keys(state.cableMap).some(k=> state.cableMap[k]);
    const tested = mm ? mm.getCableConnectedComponent?.() : null;
    // mode-aware required jacks
    let neededDesc = 'COM + VΩHz';
    let neededJacks = ['com','vohm'];
    try{
        const dm = mm ? mm.getCurrentDialMode() : null;
        if (dm){
            if (dm.mode==='a'){ neededDesc='COM + 10A'; neededJacks=['com','10a']; }
            else if (dm.mode==='ma' || dm.mode==='ua'){ neededDesc='COM + mA µA'; neededJacks=['com','maua']; }
            else if (dm.mode==='off'){ neededDesc='— (OFF)'; neededJacks=[]; }
            else if (dm.mode==='ncv'){ neededDesc='بدون کابل (NCV)'; neededJacks=[]; }
            else neededDesc='COM + VΩHz';
        }
    } catch{}
    let statusText='';
    let statusClass='';
    if (neededJacks.length===0){
        statusText = tested ? `حالت ${neededDesc} — نیازی به کابل نیست` : `حالت ${neededDesc}`;
        statusClass = '';
    } else if (tested){
        statusText = `آماده تست (${neededDesc}): ${tested.name||tested.type} (${tested.value||''})`;
        statusClass='ok';
    } else if (hasAny){
        const hasNeeded = neededJacks.every(j=> state.cableMap[j]);
        const sameComp = state.cableMap[neededJacks[0]] && state.cableMap[neededJacks[1]] && state.cableMap[neededJacks[0]].componentId===state.cableMap[neededJacks[1]].componentId;
        if (!hasNeeded) statusText = `کابل‌های ${neededDesc} را کامل کنید — هر دو پراب را وصل کنید`;
        else if (!sameComp) statusText = `هر دو پراب ${neededDesc} باید روی یک قطعه باشند`;
        else statusText = `نقاط باید متفاوت باشند — دو نقطه جدا وصل کنید`;
        statusClass='warn';
    } else {
        statusText = `کابل ${neededDesc} را از پراب بکشید و روی نقطه طلایی رها کنید ✨`;
        statusClass='';
    }
    box.innerHTML = `
        <div class="cable-status ${statusClass}">${tested ? '●' : hasAny ? '◐' : '○'} ${statusText}</div>
        <div style="display:flex;gap:6px">
            <button id="cableTestRunBtn" class="btn btn-primary btn-sm cable-test-btn" ${tested?'':'disabled'}>🧪 اجرای تست (${neededDesc})</button>
            <button id="cableClearBtn" class="btn btn-ghost btn-sm" style="flex:0 0 auto">✕ جدا همه</button>
        </div>
        <span class="hint" style="font-size:11px">نکته: در حالت <b>${neededDesc}</b>، پراب‌ها را به دو نقطه متفاوت یک قطعه وصل کنید؛ سپس «اجرای تست» بزنید. انیمیشن کابل را بکشید ✨</span>
    `;
    const runBtn = document.getElementById('cableTestRunBtn');
    const clearBtn = document.getElementById('cableClearBtn');
    if (runBtn) runBtn.addEventListener('click', async ()=>{
        const mm3 = (typeof getMultimeter==='function' ? getMultimeter() : null) || (typeof multimeterInstance!=='undefined' ? multimeterInstance : null);
        const t = mm3 ? mm3.getCableConnectedComponent?.() : null;
        if (!t){ toast('ابتدا هر دو پراب را به یک قطعه وصل کنید','error','⚠️'); return; }
        mm3.setComponent(t);
        showSidebarDetail(t);
        flashMarker(t.id, FLASH_GREEN, 2200);
        // engaging test animation sequence
        runBtn.animate([{transform:'scale(1)'},{transform:'scale(0.96)'},{transform:'scale(1.04)'},{transform:'scale(1)'}], {duration: 320, easing:'cubic-bezier(.16,1,.3,1)'});
        const lcd = document.getElementById('dmm2dLcd');
        if (lcd){ lcd.classList.add('backlight'); setTimeout(()=> lcd.classList.remove('backlight'), 900); }
        try{ mm3.playBeep(); } catch{}
        toast(`تست انجام شد: ${t.name||t.type} — نتیجه: ${mm3.measured.text} ${mm3.measured.unit}`, 'success', '✅');
        // update 3D pulse
        const entry = markersMap.get(t.id);
        if (entry && entry.group) entry.group.animate ? null : null;
    });
    if (clearBtn) clearBtn.addEventListener('click', async ()=>{
        state.cableMap = {};
        state.cables = [];
        await saveCablesToServer();
        renderAttachmentPanel();
        renderEditRects();
        refresh3DMarkers();
        updateCableOverlay();
        syncMultimeterCables();
        toast('همه کابل‌ها جدا شدند','info','🔌');
    });
}

function refresh3DMarkers() {
    const group = sceneManager.componentGroup;
    group.clear();
    markersMap.clear();
    modelInstanceMap.clear();
    // Safety: if board was left faded/hidden (focus interrupted), restore
    try {
        if (sceneManager && sceneManager.boardGroup) {
            if (!focusState.active && !state.focusedCompId) {
                sceneManager.boardGroup.visible = true;
                const bm = sceneManager.getBoardMesh();
                if (bm) {
                    const mats = Array.isArray(bm.material) ? bm.material : [bm.material];
                    mats.forEach(m=>{ if (m.opacity < 0.9) { m.opacity = 1; m.transparent = false; m.needsUpdate = true; } });
                }
                if (sceneManager._grid) { sceneManager._grid.visible = true; sceneManager._grid.material.opacity = 0.5; }
            }
        }
    } catch {}
    if (!state.boardSize || state.components.length === 0) return;
    const boardW = state.boardSize.x;
    const boardD = state.boardSize.z;
    const halfT = THICKNESS / 2;
    state.components.forEach(comp => {
        const def = COMPONENT_DEFS[comp.type];
        const effectiveColor = comp.color && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(comp.color) ? comp.color : def.color;
        const wWorld = comp.w * boardW;
        const hWorld = comp.h * boardD;
        if (wWorld <= 0.001 || hWorld <= 0.001) return;
        const renderW = Math.max(wWorld, 0.035);
        const renderH = Math.max(hWorld, 0.035);
        const cx = (comp.x + comp.w/2 - 0.5) * boardW;
        const cz = (comp.y + comp.h/2 - 0.5) * boardD;
        const compGroup = new THREE.Group();
        compGroup.userData.compId = comp.id;
        compGroup.userData.hasModel = false;
        const yOffset = comp.side === 'front' ? halfT + 0.015 : -halfT - 0.015;
        const hasModel = !!resolveModelUrl(comp);
        // flat marker: if hasModel we still add but with very low opacity as halo/selection; else normal
        const flatOpacity = hasModel ? 0.10 : 0.48;
        const flatEmissive = hasModel ? 0.08 : 0.25;
        const geom = new THREE.PlaneGeometry(renderW, renderH);
        const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(effectiveColor),
            emissive: new THREE.Color(effectiveColor),
            emissiveIntensity: flatEmissive,
            transparent: true,
            opacity: flatOpacity,
            roughness: 0.5,
            metalness: 0.15,
            side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(cx, yOffset, cz);
        mesh.rotation.x = comp.side === 'front' ? -Math.PI / 2 : Math.PI / 2;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.userData.compId = comp.id;
        mesh.userData.compType = comp.type;
        mesh.userData.side = comp.side;
        mesh.userData.baseColor = def.color;
        compGroup.add(mesh);

        const edgeGeom = new THREE.EdgesGeometry(geom);
        const lineMat = new THREE.LineBasicMaterial({ color: effectiveColor, transparent: true, opacity: hasModel?0.35:0.9 });
        const line = new THREE.LineSegments(edgeGeom, lineMat);
        line.position.copy(mesh.position);
        line.rotation.copy(mesh.rotation);
        compGroup.add(line);

        const glowGeom = new THREE.PlaneGeometry(renderW*1.08, renderH*1.08);
        const glowMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(effectiveColor),
            transparent: true,
            opacity: hasModel?0.03:0.08,
            side: THREE.DoubleSide,
        });
        const glow = new THREE.Mesh(glowGeom, glowMat);
        glow.position.set(cx, yOffset + (comp.side==='front'?0.001:-0.001), cz);
        glow.rotation.copy(mesh.rotation);
        compGroup.add(glow);

        // aa — attachment point golden spheres (prop registry) — engaging
        ensureAttachmentPoints(comp);
        cableApMeshes.clear ? null : null; // kept globally, but per-comp we add
        // remove stale entries for this comp
        for (const k of [...cableApMeshes.keys()]){
            if (k.startsWith(comp.id+':')) cableApMeshes.delete(k);
        }
        (comp.attachmentPoints||[]).forEach(pt=>{
            const wx = (comp.x + comp.w*pt.nx -0.5)*boardW;
            const wz = (comp.y + comp.h*pt.ny -0.5)*boardD;
            const apY = yOffset + (comp.side==='front'?0.018:-0.018);
            const sphereGeo = new THREE.SphereGeometry(0.018, 12, 12);
            const isConnected = Object.values(state.cableMap||{}).some(v=> v && v.componentId===comp.id && v.pointId===pt.id);
            const sphereMat = new THREE.MeshStandardMaterial({
                color: isConnected ? 0x0BE881 : 0xFFD54F,
                emissive: isConnected ? 0x0BE881 : 0xFFC107,
                emissiveIntensity: isConnected ? 0.85 : 0.62,
                roughness: 0.32,
                metalness: 0.18,
            });
            const sphere = new THREE.Mesh(sphereGeo, sphereMat);
            sphere.position.set(wx, apY, wz);
            sphere.userData.compId = comp.id;
            sphere.userData.pointId = pt.id;
            sphere.userData.isAp = true;
            // tiny label sprite? use simple — keep sphere only for perf
            compGroup.add(sphere);
            cableApMeshes.set(comp.id+':'+pt.id, sphere);
            // also add a thin stem
            const stemGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.012, 6);
            const stemMat = new THREE.MeshStandardMaterial({color: 0x2A2A2A, roughness:0.8});
            const stem = new THREE.Mesh(stemGeo, stemMat);
            stem.position.set(wx, apY - (comp.side==='front'?0.01:-0.01), wz);
            compGroup.add(stem);
        });

        group.add(compGroup);
        markersMap.set(comp.id, { group: compGroup, mesh, line, glow, mat, glowMat, lineMat, comp, baseColor: effectiveColor, isFlashing: false, flashStart: 0, flashDuration: 0, hasModel });

        if (hasModel) {
            placeGltfOnBoard(comp, compGroup, wWorld, hWorld, cx, cz, yOffset, effectiveColor);
        }
    });
    applyFilterHighlight(state.filterType);
}

function applyFilterHighlight(filterType) {
    state.filterType = filterType;
    // Update pills (legacy) + accordion active states
    document.querySelectorAll('.filter-pill').forEach(p => {
        p.classList.toggle('active', p.dataset.type === filterType);
    });
    document.querySelectorAll('.accordion-item').forEach(item => {
        const isActive = item.dataset.type === filterType;
        item.classList.toggle('active', isActive);
        if (filterAccordion) {
            const shouldExpand = isActive;
            item.classList.toggle('expanded', shouldExpand);
            const body = item.querySelector('.accordion-body');
            if (body) {
                if (shouldExpand) {
                    body.style.maxHeight = body.scrollHeight + 'px';
                } else {
                    body.style.maxHeight = '0px';
                }
            }
            const chev = item.querySelector('.acc-chevron');
            if (chev) chev.style.transform = shouldExpand ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    });
    if (outerFilterWrap && outerFilterWrap.classList.contains('expanded')) {
        const ob = outerFilterWrap.querySelector('.outer-body');
        if (ob) setTimeout(() => { if (ob) ob.style.maxHeight = ob.scrollHeight + 'px'; }, 30);
    }
    const hint = sidebarFilterHint || document.getElementById('filterHint');
    if (filterType === 'all') {
        if (hint) hint.textContent = 'برای چشمک‌زدن انتخاب کنید';
    } else {
        const def = COMPONENT_DEFS[filterType];
        const count = state.components.filter(c=>c.type===filterType).length;
        if (hint) hint.textContent = `${count} مورد یافت شد — چشمک می‌زند ✨`;
    }
    markersMap.forEach((entry) => {
        const isMatch = filterType === 'all' || entry.comp.type === filterType;
        if (!entry.isFlashing) {
            if (isMatch) {
                entry.mat.opacity = entry.hasModel ? 0.12 : 0.52;
                entry.mat.emissiveIntensity = entry.hasModel ? 0.12 : 0.45;
                entry.glowMat.opacity = entry.hasModel ? 0.035 : 0.12;
                entry.lineMat.opacity = entry.hasModel ? 0.4 : 0.95;
                if (entry.model) entry.model.visible = true;
                if (entry.modelMats) entry.modelMats.forEach(m=>{ if(m.opacity!==undefined) m.opacity = 1; if(m.emissiveIntensity!==undefined) m.emissiveIntensity = 0.55; });
            } else {
                entry.mat.opacity = 0.08;
                entry.mat.emissiveIntensity = 0.05;
                entry.glowMat.opacity = 0.02;
                entry.lineMat.opacity = 0.25;
                if (entry.model) entry.model.visible = false;
                if (entry.modelMats) entry.modelMats.forEach(m=>{ if(m.opacity!==undefined) m.opacity = 0.12; });
            }
        } else {
            // flashing will handle, but keep model visible during flash
            if (entry.model) entry.model.visible = true;
        }
    });
    if (filterType !== 'all') {
        const matchedIds = state.components.filter(c=>c.type===filterType).map(c=>c.id);
        matchedIds.forEach(id => flashMarker(id, FLASH_GREEN, 2600));
        const frontCount = state.components.filter(c=>c.type===filterType && c.side==='front').length;
        const backCount = state.components.filter(c=>c.type===filterType && c.side==='back').length;
        const def = COMPONENT_DEFS[filterType];
        let msg = `${def.label} — ${state.components.filter(c=>c.type===filterType).length} ناحیه چشمک می‌زند`;
        if (backCount > 0 && frontCount > 0) msg += ` (${frontCount} رو، ${backCount} پشت)`;
        else if (backCount>0) msg += ` (همه پشت برد) — برای دیدن بچرخانید 🔄`;
        else if (frontCount>0) msg += ` (همه روی برد)`;
        toast(msg, 'info', '🔍');
        const hasOpposite = state.components.some(c=>c.type===filterType && ((sceneManager.isBack && c.side==='front') || (!sceneManager.isBack && c.side==='back')));
        if (hasOpposite && state.backUrl && !flipBoardBtn.classList.contains('hidden')) {
            flipBoardBtn.classList.add('attention');
            setTimeout(()=> flipBoardBtn.classList.remove('attention'), 7000);
        } else {
            flipBoardBtn.classList.remove('attention');
        }
    } else {
        flipBoardBtn.classList.remove('attention');
    }
}

function flashMarker(id, colorHex = FLASH_GREEN, duration = 2200) {
    const entry = markersMap.get(id);
    if (!entry) return;
    entry.isFlashing = true;
    entry.flashStart = performance.now();
    entry.flashDuration = duration;
    entry.flashColor = colorHex;
    if (state.mode === 'edit') flashEditRect(id);
}

function updateMarkersAnimation(dt, elapsed) {
    const now = performance.now();
    markersMap.forEach(entry => {
        const isMatch = state.filterType === 'all' || entry.comp.type === state.filterType;
        // handle model visibility on filter
        if (entry.model) {
            const vis = isMatch || entry.isFlashing;
            entry.model.visible = vis ? true : false;
            // dim flat marker when model present is already low; keep as is
        }
        if (entry.isFlashing) {
            const t = (now - entry.flashStart) / entry.flashDuration;
            if (t >= 1) {
                entry.isFlashing = false;
                entry.mat.color.set(entry.baseColor);
                entry.mat.emissive.set(entry.baseColor);
                entry.mat.opacity = isMatch ? (entry.hasModel?0.12:0.52) : 0.08;
                entry.mat.emissiveIntensity = isMatch ? (entry.hasModel?0.12:0.45) : 0.05;
                entry.glowMat.opacity = isMatch ? (entry.hasModel?0.03:0.12) : 0.02;
                entry.lineMat.opacity = isMatch ? (entry.hasModel?0.4:0.95) : 0.25;
                if (entry.modelMats) {
                    entry.modelMats.forEach(m=>{
                        if (m.userData.baseColor && m.color) m.color.copy(m.userData.baseColor);
                        if (m.userData.baseEmissive && m.emissive) m.emissive.copy(m.userData.baseEmissive);
                        if (m.opacity !== undefined) m.opacity = isMatch ? 1 : 0.15;
                        if (m.emissiveIntensity !== undefined) m.emissiveIntensity = isMatch ? 0.6 : 0.05;
                    });
                }
            } else {
                const pulses = 3;
                const phase = (t * pulses) % 1;
                const pulse = phase < 0.5 ? phase*2 : (1-phase)*2;
                const base = new THREE.Color(entry.baseColor);
                const flash = new THREE.Color(parseInt((entry.flashColor||FLASH_GREEN).replace('#',''),16));
                const lerpCol = base.clone().lerp(flash, pulse*0.85);
                entry.mat.color.copy(lerpCol);
                entry.mat.emissive.copy(lerpCol);
                entry.mat.opacity = 0.45 + pulse*0.45;
                entry.mat.emissiveIntensity = 0.35 + pulse*0.9;
                entry.glowMat.opacity = 0.12 + pulse*0.22;
                entry.lineMat.opacity = 0.9 + pulse*0.1;
                if (entry.modelMats) {
                    entry.modelMats.forEach(m=>{
                        if (m.color) m.color.copy(lerpCol);
                        if (m.emissive) m.emissive.copy(lerpCol);
                        if (m.opacity !== undefined) m.opacity = 0.7 + pulse*0.3;
                        if (m.emissiveIntensity !== undefined) m.emissiveIntensity = 0.5 + pulse*1.0;
                    });
                    if (entry.model) {
                        const s = 1 + pulse*0.08;
                        entry.model.scale.setScalar(entry.model.userData.baseScale ? entry.model.userData.baseScale * s : s);
                    }
                }
            }
        } else {
            if (isMatch && state.filterType !== 'all') {
                const breath = Math.sin(elapsed * 2.2) * 0.5 + 0.5;
                entry.mat.emissiveIntensity = entry.hasModel ? 0.12 + breath*0.08 : 0.32 + breath*0.28;
                entry.glowMat.opacity = entry.hasModel ? 0.03 + breath*0.03 : 0.08 + breath*0.08;
                if (entry.modelMats) {
                    const b = entry.hasModel ? 0.55 + breath*0.15 : 0.6;
                    entry.modelMats.forEach(m=>{ if (m.emissiveIntensity!==undefined) m.emissiveIntensity = b; });
                }
            } else if (isMatch) {
                const breath = Math.sin(elapsed * 1.2) * 0.5 + 0.5;
                entry.glowMat.opacity = entry.hasModel ? 0.02 + breath*0.015 : 0.06 + breath*0.03;
            }
        }
    });
}
sceneManager.onTick(updateMarkersAnimation);

function updateFilterCounts() {
    const counts = { all: state.components.length, resistor:0, capacitor:0, inductor:0, diode:0, transistor:0 };
    state.components.forEach(c=> { if (counts[c.type] !== undefined) counts[c.type]++; });
    Object.keys(counts).forEach(k=> {
        const el = document.getElementById('count-'+k);
        if (el) el.textContent = counts[k];
        const sideEl = document.getElementById('sidebar-count-'+k);
        if (sideEl) sideEl.textContent = counts[k];
        const accCount = document.getElementById('acc-count-'+k);
        if (accCount) accCount.textContent = counts[k];
    });
    if (sidebarStatsEl) sidebarStatsEl.textContent = `${counts.all} قطعه`;
    // Update accordion meta + lists
    if (filterAccordion) {
        const types = Object.keys(counts);
        types.forEach(t => {
            const frontN = t === 'all' ? state.components.filter(c=>c.side==='front').length : state.components.filter(c=>c.type===t && c.side==='front').length;
            const backN = t === 'all' ? state.components.filter(c=>c.side==='back').length : state.components.filter(c=>c.type===t && c.side==='back').length;
            const metaFront = document.getElementById('acc-front-'+t);
            const metaBack = document.getElementById('acc-back-'+t);
            const metaTotal = document.getElementById('acc-total-'+t);
            if (metaFront) metaFront.textContent = frontN;
            if (metaBack) metaBack.textContent = backN;
            if (metaTotal) metaTotal.textContent = counts[t];
            // list
            const listEl = document.getElementById('acc-list-'+t);
            if (listEl) {
                const items = t === 'all' ? state.components.slice(0, 8) : state.components.filter(c=>c.type===t).slice(0, 8);
                if (items.length === 0) {
                    listEl.innerHTML = t === 'all' ? '<span class="acc-list-empty">هنوز قطعه‌ای ثبت نشده — وارد ویرایش شوید</span>' : '<span class="acc-list-empty">موردی یافت نشد</span>';
                    listEl.classList.add('hidden');
                } else {
                    listEl.classList.remove('hidden');
                    listEl.innerHTML = items.map(c => {
                        const def = COMPONENT_DEFS[c.type];
                        const name = c.name && c.name.trim() ? c.name : def.label;
                        const val = c.value ? ` · ${escapeHtml(c.value)}` : '';
                        const sideBadge = c.side==='front' ? 'روی' : 'پشت';
                        return `<button class="acc-list-item" data-comp-id="${c.id}" title="${escapeHtml(name+val)} — ${sideBadge}">
                            <span class="dot dot-${c.type}" style="width:7px;height:7px;border-radius:50%;flex-shrink:0;background:${def.border}"></span>
                            <span class="acc-list-name">${escapeHtml(name)}<span class="acc-list-val">${val}</span></span>
                            <span class="acc-list-side ${c.side==='front'?'front-badge':'back-badge'} side-badge" style="font-size:10px;padding:2px 6px">${sideBadge}</span>
                        </button>`;
                    }).join('') + ( (t==='all' ? state.components.length : state.components.filter(c=>c.type===t).length) > 8 ? `<span class="acc-list-more">+${(t==='all'?state.components.length:state.components.filter(c=>c.type===t).length)-8} مورد دیگر…</span>` : '' );
                    // bind clicks
                    listEl.querySelectorAll('.acc-list-item').forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const id = btn.dataset.compId;
                            const comp = state.components.find(x=>x.id===id);
                            if (!comp) return;
                            flashMarker(id, FLASH_GREEN, 2400);
                            showSidebarDetail(comp);
                            applyFilterHighlight(comp.type);
                            toast(`${COMPONENT_DEFS[comp.type].label} — ${comp.name||''} چشمک زد ✨`, 'info', '🔍');
                        });
                    });
                }
            }
            // empty state for chevron
            const itemEl = filterAccordion.querySelector(`.accordion-item[data-type="${t}"]`);
            if (itemEl) {
                const hasItems = counts[t] > 0;
                itemEl.classList.toggle('has-items', hasItems);
                itemEl.classList.toggle('empty', !hasItems);
            }
        });
        // fix maxHeight for expanded active item after list rebuild
        const activeItem = filterAccordion.querySelector('.accordion-item.active');
        if (activeItem && activeItem.classList.contains('expanded')) {
            const body = activeItem.querySelector('.accordion-body');
            if (body) body.style.maxHeight = body.scrollHeight + 'px';
        }
        if (outerFilterCount) outerFilterCount.textContent = counts.all;
        // keep outer filter height in sync when expanded (nested accordion height changed)
        if (outerFilterWrap && outerFilterWrap.classList.contains('expanded')) {
            const ob = outerFilterWrap.querySelector('.outer-body');
            if (ob) ob.style.maxHeight = ob.scrollHeight + 'px';
        }
        if (outerDetailWrap && outerDetailWrap.classList.contains('expanded')) {
            const ob2 = outerDetailWrap.querySelector('.outer-body');
            if (ob2) ob2.style.maxHeight = ob2.scrollHeight + 'px';
        }
    }
}

/* ---------- Raycasting ---------- */
let isDraggingView = false;
let dragStartPos = null;

function getRaycastSide(intersect) {
    const geom = intersect.object.geometry;
    const faceIdx = intersect.faceIndex;
    if (faceIdx == null || !geom.groups || geom.groups.length < 3) return 'front';
    const idxOffset = faceIdx * 3;
    for (const g of geom.groups) {
        if (idxOffset >= g.start && idxOffset < g.start + g.count) {
            if (g.materialIndex === 0) return 'front';
            if (g.materialIndex === 1) return 'back';
            return 'side';
        }
    }
    return 'front';
}
function findComponentsAtUV(side, u, v) {
    const px = u;
    const py = v;
    return state.components.filter(c => {
        if (c.side !== side) return false;
        return px >= c.x && px <= c.x + c.w && py >= c.y && py <= c.y + c.h;
    });
}
let draggingAp3D = null;
function hitTestApSphere(clientX, clientY){
    const rect = canvas.getBoundingClientRect();
    mouseNDC.x = ((clientX - rect.left)/rect.width)*2-1;
    mouseNDC.y = -((clientY - rect.top)/rect.height)*2+1;
    raycaster.setFromCamera(mouseNDC, sceneManager.camera);
    // first check ap spheres
    const allSpheres = [];
    cableApMeshes.forEach(m=> allSpheres.push(m));
    // also include model spheres with :model suffix already in map
    const hits = raycaster.intersectObjects(allSpheres, false);
    if (hits.length>0){
        const obj = hits[0].object;
        if (obj.userData && obj.userData.isAp){
            return {compId: obj.userData.compId, pointId: obj.userData.pointId, object: obj, distance: hits[0].distance};
        }
    }
    return null;
}
function onCanvasPointerDown(e) {
    if (state.mode !== 'view') return;
    // ac fix: in view mode, single click on gold AP sphere should connect/disconnect probe (not drag to reposition)
    // Reposition is via double-click prompt or edit-mode drag. So we do NOT start draggingAp here in view mode;
    // Instead, just highlight and let onCanvasClick handle cable connect/disconnect.
    // Keep dragging for reposition only when Shift held (advanced)
    const apHit = hitTestApSphere(e.clientX, e.clientY);
    if (apHit){
        if (e.shiftKey){
            draggingAp3D = apHit;
            sceneManager.setControlsEnabled(false);
            e.preventDefault();
            e.stopPropagation();
            highlightAttachmentPoint(apHit.compId, apHit.pointId, true);
            return;
        }
        // otherwise, highlight briefly and allow click handler to do cable toggle
        highlightAttachmentPoint(apHit.compId, apHit.pointId, true);
        setTimeout(()=>clearHighlightAttachmentPoints(), 300);
        // do NOT return early with drag — let click propagate but prevent orbit drag
        // we still set dragStartPos to avoid orbit判定? Keep minimal.
        dragStartPos = { x: e.clientX, y: e.clientY };
        isDraggingView = false;
        return;
    }
    dragStartPos = { x: e.clientX, y: e.clientY };
    isDraggingView = false;
}
function onCanvasPointerMove(e) {
    if (draggingAp3D){
        // drag attachment point in 3D — project onto board plane to get new nx/ny
        const rect = canvas.getBoundingClientRect();
        mouseNDC.x = ((e.clientX - rect.left)/rect.width)*2-1;
        mouseNDC.y = -((e.clientY - rect.top)/rect.height)*2+1;
        raycaster.setFromCamera(mouseNDC, sceneManager.camera);
        const boardMesh = sceneManager.getBoardMesh();
        if (boardMesh){
            const hits = raycaster.intersectObject(boardMesh, false);
            if (hits.length && hits[0].uv){
                const uv = hits[0].uv;
                const u = uv.x, v = 1 - uv.y;
                const comp = state.components.find(c=>c.id===draggingAp3D.compId);
                if (comp){
                    // convert uv (board 0-1) to component local nx/ny
                    // component rect is at comp.x, comp.y with w,h
                    // uv is board-wide 0-1, not component local. Need to compute: component's board UV range is [comp.x, comp.x+comp.w] in U and [comp.y, comp.y+comp.h] in V
                    // So local nx = (u - comp.x)/comp.w, ny = (v - comp.y)/comp.h
                    let nx = (u - comp.x)/comp.w;
                    let ny = (v - comp.y)/comp.h;
                    nx = Math.max(0.02, Math.min(0.98, nx));
                    ny = Math.max(0.02, Math.min(0.98, ny));
                    const pt = comp.attachmentPoints.find(p=>p.id===draggingAp3D.pointId);
                    if (pt){
                        pt.nx = Math.round(nx*10000)/10000;
                        pt.ny = Math.round(ny*10000)/10000;
                        // live update 3D spheres positions (both board and model)
                        refresh3DMarkers();
                        updateCableOverlay();
                        // also update detail panel if open
                        if (state.sidebarSelectedId===comp.id) showSidebarDetail(comp);
                    }
                }
            }
        }
        e.preventDefault();
        return;
    }
    if (!dragStartPos) return;
    const dx = e.clientX - dragStartPos.x;
    const dy = e.clientY - dragStartPos.y;
    if (Math.hypot(dx,dy) > 6) isDraggingView = true;
}
function onCanvasClick(e) {
    if (state.mode !== 'view') return;
    // ac: gold point click has priority for cable connect/disconnect — works in both board and isolated focus
    // Check AP sphere first (includes focusClone spheres)
    const apHitClick = hitTestApSphere(e.clientX, e.clientY);
    if (apHitClick){
        // Point 4 fix: only hijack click if probe is active or point already connected (detach)
        const isOccupied = Object.values(state.cableMap||{}).some(v=> v && v.componentId===apHitClick.compId && v.pointId===apHitClick.pointId);
        if (isOccupied || activeProbeJack){
            e.preventDefault();
            e.stopPropagation();
            isDraggingView=false; dragStartPos=null; draggingAp3D=null; try{ sceneManager.setControlsEnabled(true);}catch{}
            // handle and wait; if handled, stop propagation
            const _res = handleAttachmentPointClick(apHitClick.compId, apHitClick.pointId);
            // handle is async, but we treat as handled immediately
            return;
        }
        // else not occupied and no active probe → fall through to component selection / 3D view
    }
    if (isDraggingView) { isDraggingView = false; dragStartPos=null; return; }
    if (focusState.active) { return; }
    if (!state.boardSize || state.components.length===0) {
        if (state.boardSize && state.components.length===0) toast('هنوز ناحیه‌ای ثبت نشده — وارد حالت ویرایش شوید', 'info', '✏️');
        return;
    }
    if (sceneManager.isAnimating) return;
    const rect = canvas.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    mouseNDC.set(ndcX, ndcY);
    raycaster.setFromCamera(mouseNDC, sceneManager.camera);
    const boardMesh = sceneManager.getBoardMesh();
    if (!boardMesh) return;
    const intersects = raycaster.intersectObject(boardMesh, false);
    if (intersects.length === 0) {
        return;
    }
    const hit = intersects[0];
    if (!hit.uv) return;
    const side = getRaycastSide(hit);
    if (side === 'side') { toast('کنار برد کلیک شد — روی سطح برد کلیک کنید', 'info', '👆'); return; }
    const u = hit.uv.x;
    const v = 1 - hit.uv.y;
    const matched = findComponentsAtUV(side, u, v);
    if (matched.length > 0) {
        matched.sort((a,b)=> (a.w*a.h)-(b.w*b.h));
        const primary = matched[0];
        matched.forEach(m => flashMarker(m.id, FLASH_GREEN, 2400));
        // Sidebar detail instead of center popup
        showSidebarDetail(primary);
        const def = COMPONENT_DEFS[primary.type];
        const sideFa = side==='front' ? 'روی برد' : 'پشت برد';
        const namePart = primary.name ? ` — ${primary.name}` : '';
        toast(`شناسایی شد: ${def.label}${namePart} — ${sideFa} — چشمک سبز ✨`, 'success', '✅');
        canvas.animate([{transform:'scale(1)'},{transform:'scale(0.998)'},{transform:'scale(1)'}], {duration: 220, easing:'ease-out'});
        if (matched.length>1) {
            const otherTypes = [...new Set(matched.slice(1).map(m=>COMPONENT_DEFS[m.type].label))].join('، ');
            setTimeout(()=> toast(`ناحیه هم‌پوشانی با: ${otherTypes}`, 'info', 'ℹ️'), 800);
        }
    } else {
        clearSidebarDetail();
        const sideFa = side==='front' ? 'روی برد' : 'پشت برد';
        toast(`در این نقطه (${sideFa}) قطعه‌ای ثبت نشده`, 'info', '🔍');
        clearSidebarDetail();
    }
    dragStartPos = null;
}
function onCanvasDoubleClick(e) {
    if (state.mode !== 'view') return;
    // Point 4 fix: double-click on attachment point should only edit point if in edit mode or Shift held — otherwise treat as component 3D view
    const apHit = hitTestApSphere(e.clientX, e.clientY);
    if (apHit){
        // If user double-clicks a gold point while a probe is active, treat as probe connect/disconnect, not edit
        const isOccupiedDbl = Object.values(state.cableMap||{}).some(v=> v && v.componentId===apHit.compId && v.pointId===apHit.pointId);
        if (activeProbeJack || isOccupiedDbl){
            // probe handling takes precedence
            e.preventDefault();
            e.stopPropagation();
            handleAttachmentPointClick(apHit.compId, apHit.pointId);
            return;
        }
        // Only allow point label edit in edit mode or with Shift/Alt modifier, otherwise fall through to 3D view
        if (state.mode==='edit' || e.shiftKey || e.altKey){
            const comp = state.components.find(c=>c.id===apHit.compId);
            const pt = comp?.attachmentPoints.find(p=>p.id===apHit.pointId);
            if (comp && pt){
                const newLabel = prompt(`ویرایش نقطه ${pt.label} — نام جدید (خالی = جابجایی):`, pt.label);
                if (newLabel !== null){
                    if (newLabel.trim() && newLabel.trim()!==pt.label){
                        pt.label = newLabel.trim().slice(0,8);
                        saveComponentsToServer().then(()=>{ refresh3DMarkers(); renderEditRects(); updateCableOverlay(); });
                        toast(`نام نقطه به ${pt.label} تغییر کرد`,'success','✏️');
                    } else {
                        toast('برای جابجایی نقطه، آن را بکشید (drag) — یا در حالت ویرایش 2D از پنل استفاده کنید','info','💡');
                        highlightAttachmentPoint(comp.id, pt.id, true);
                        setTimeout(()=> clearHighlightAttachmentPoints(), 1200);
                    }
                }
            }
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        // otherwise fall through to component 3D view (do not return)
    }
    if (focusState.active) { exitFocusMode(); return; }
    if (!state.boardSize || state.components.length===0) return;
    if (sceneManager.isAnimating) return;
    const rect = canvas.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    mouseNDC.set(ndcX, ndcY);
    raycaster.setFromCamera(mouseNDC, sceneManager.camera);
    const boardMesh = sceneManager.getBoardMesh();
    if (!boardMesh) return;
    const intersects = raycaster.intersectObject(boardMesh, false);
    if (intersects.length === 0) {
        if (focusState.active || state.focusedCompId) exitFocusMode();
        return;
    }
    const hit = intersects[0];
    if (!hit.uv) return;
    const side = getRaycastSide(hit);
    if (side === 'side') return;
    const u = hit.uv.x;
    const v = 1 - hit.uv.y;
    const matched = findComponentsAtUV(side, u, v);
    if (matched.length > 0) {
        matched.sort((a,b)=> (a.w*a.h)-(b.w*b.h));
        const primary = matched[0];
        // Enter dedicated isolated view from exact click position
        requestAnimationFrame(()=> enterFocusMode(primary, hit.point ? hit.point.clone() : null));
    } else {
        // Double-click empty in focus exits
        if (focusState.active || state.focusedCompId) exitFocusMode();
    }
}
// Focus mode state
state.focusedCompId = null;
state._boardOriginalOpacities = null;

function fadeBoard(fadeOut, duration=780, keepId=null) {
    const boardMesh = sceneManager.getBoardMesh();
    if (!boardMesh) return;
    const mats = Array.isArray(boardMesh.material) ? boardMesh.material : [boardMesh.material];
    const boardGroup = sceneManager.boardGroup;
    if (fadeOut) {
        if (!state._boardOriginalOpacities) {
            state._boardOriginalOpacities = mats.map(m=> ({opacity: m.opacity, transparent: m.transparent}));
            state._boardOriginalScale = boardGroup.scale.clone();
        }
        const startOps = mats.map(m=> m.opacity);
        const targetOp = 0.015;
        const startTime = performance.now();
        const startScale = boardGroup.scale.clone();
        const targetScale = new THREE.Vector3(0.86, 0.86, 0.86);
        mats.forEach(m=> m.transparent = true);
        function tick(){
            const t = Math.min((performance.now()-startTime)/duration,1);
            const eased = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
            mats.forEach((m,i)=>{
                m.opacity = startOps[i] + (targetOp - startOps[i]) * eased;
                m.needsUpdate = true;
            });
            boardGroup.scale.lerpVectors(startScale, targetScale, eased * 0.5);
            if (t<1) requestAnimationFrame(tick);
            else {
                boardGroup.visible = false;
            }
        }
        tick();
        // Hide other markers but keep focused one visible during detachment animation
        markersMap.forEach((entry, id)=>{
            if (keepId && id === keepId) {
                // keep focused component visible for detachment — will be hidden after clone flies
                entry.group.visible = true;
                if (entry.model) entry.model.visible = true;
            } else {
                // fade out other markers gently
                if (entry.group.visible) {
                    entry.group.traverse(o=>{
                        if (o.isMesh && o.material) {
                            const mats2 = Array.isArray(o.material) ? o.material : [o.material];
                            mats2.forEach(mm=>{
                                if (!mm.userData) mm.userData = {};
                                if (mm.userData.origOpacity === undefined) mm.userData.origOpacity = mm.opacity;
                                mm.transparent = true;
                            });
                        }
                    });
                    // fade opacity then hide
                    const st = performance.now();
                    const origMats = [];
                    entry.group.traverse(o=>{ if(o.isMesh && o.material) { const ms = Array.isArray(o.material)?o.material:[o.material]; ms.forEach(m=>origMats.push(m)); } });
                    const startOps2 = origMats.map(m=>m.opacity);
                    function fadeM(){
                        const t = Math.min((performance.now()-st)/ (duration*0.85),1);
                        const eased = 1 - Math.pow(1-t,3);
                        origMats.forEach((m,i)=>{ m.opacity = startOps2[i] * (1-eased*0.95); });
                        if (t<1) requestAnimationFrame(fadeM);
                        else entry.group.visible = false;
                    }
                    fadeM();
                } else {
                    entry.group.visible = false;
                }
            }
        });
        if (sceneManager._grid) {
            const g = sceneManager._grid;
            const startOp = g.material.opacity;
            const st = performance.now();
            function gtick(){
                const t = Math.min((performance.now()-st)/duration,1);
                const eased = 1 - Math.pow(1-t,3);
                g.material.opacity = startOp + (0.02 - startOp) * eased;
                if (t<1) requestAnimationFrame(gtick);
                else g.visible = false;
            }
            gtick();
        }
    } else {
        const boardGroup = sceneManager.boardGroup;
        boardGroup.visible = true;
        if (sceneManager._grid) { sceneManager._grid.visible = true; sceneManager._grid.material.opacity = 0.5; }
        // restore other markers' materials that were faded during enter
        markersMap.forEach(entry=>{
            entry.group.visible = true;
            if (entry.model) entry.model.visible = true;
            entry.group.traverse(o=>{
                if (o.isMesh && o.material) {
                    const mats = Array.isArray(o.material) ? o.material : [o.material];
                    mats.forEach(m=>{
                        if (m.userData && m.userData.origOpacity !== undefined) {
                            m.opacity = m.userData.origOpacity;
                            delete m.userData.origOpacity;
                        } else {
                            // for focused model that was faded via entry.model fade
                            if (m.transparent) { m.opacity = 1; }
                        }
                        // reset emissive
                        if (m.emissive && m.userData && m.userData.baseEmissive) m.emissive.copy(m.userData.baseEmissive);
                        m.transparent = false;
                        m.needsUpdate = true;
                    });
                }
            });
            applyFilterHighlight(state.filterType);
        });
        if (!state._boardOriginalOpacities) {
            // Fallback: board was faded but original not stored (e.g., interrupted fade) — restore fully visible
            mats.forEach(m=>{ m.opacity = 1; m.transparent = false; m.needsUpdate = true; });
            boardGroup.scale.set(1,1,1);
            boardGroup.visible = true;
            if (sceneManager._grid) { sceneManager._grid.visible = true; sceneManager._grid.material.opacity = 0.5; }
            return;
        }
        const startOps = mats.map(m=> m.opacity);
        const targetOps = state._boardOriginalOpacities.map(o=> o.opacity);
        const startTime = performance.now();
        const startScale = boardGroup.scale.clone();
        const targetScale = state._boardOriginalScale || new THREE.Vector3(1,1,1);
        function tick(){
            const t = Math.min((performance.now()-startTime)/duration,1);
            const eased = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
            mats.forEach((m,i)=>{
                m.opacity = startOps[i] + (targetOps[i] - startOps[i]) * eased;
                if (t>=1) m.transparent = state._boardOriginalOpacities[i].transparent;
                m.needsUpdate = true;
            });
            boardGroup.scale.lerpVectors(startScale, targetScale, eased);
            if (t<1) requestAnimationFrame(tick);
            else {
                state._boardOriginalOpacities = null;
                state._boardOriginalScale = null;
                boardGroup.scale.copy(targetScale);
            }
        }
        tick();
    }
}

function enlargeFocusedComponent(comp, enlarge, duration=650) {
    const entry = markersMap.get(comp.id);
    if (!entry || !entry.model) return;
    const model = entry.model;
    const baseScale = model.userData.baseScale || 1;
    const startScale = model.scale.x;
    const targetScale = enlarge ? baseScale * 2.35 : baseScale;
    const startTime = performance.now();
    if (enlarge && !model.userData.focusOriginalScale) model.userData.focusOriginalScale = baseScale;
    const basePos = model.userData.basePos || model.position.clone();
    if (enlarge && !model.userData.basePos) model.userData.basePos = basePos.clone();
    const startPos = model.position.clone();
    const targetPos = enlarge ? new THREE.Vector3(basePos.x, basePos.y + 0.42, basePos.z) : basePos;
    function tick(){
        const t = Math.min((performance.now()-startTime)/duration,1);
        const eased = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
        const s = startScale + (targetScale - startScale) * eased;
        model.scale.setScalar(s);
        model.position.lerpVectors(startPos, targetPos, eased);
        if (enlarge) model.rotation.y = (model.userData.baseRotY ? THREE.MathUtils.degToRad(model.userData.baseRotY) : model.rotation.y) + Math.sin(t * Math.PI) * 0.18;
        if (t<1) requestAnimationFrame(tick);
        else if (!enlarge) {
            model.userData.focusOriginalScale = null;
            model.userData.basePos = null;
            const rx = model.userData.baseRotX || 0, ry = model.userData.baseRotY || 0, rz = model.userData.baseRotZ || 0;
            model.rotation.set(THREE.MathUtils.degToRad(rx), THREE.MathUtils.degToRad(ry), THREE.MathUtils.degToRad(rz));
        }
    }
    tick();
    if (entry.modelMats) {
        entry.modelMats.forEach(m=>{
            if (enlarge) {
                const baseEm = m.userData.baseEmissive ? m.userData.baseEmissive.clone() : new THREE.Color(0x000000);
                m.emissive.copy(baseEm).lerp(new THREE.Color(0x4dd0ff), 0.35);
                m.emissiveIntensity = 0.9;
            } else {
                if (m.userData.baseEmissive) m.emissive.copy(m.userData.baseEmissive);
                m.emissiveIntensity = 0.55;
            }
        });
    }
}

// Dedicated isolated 3D environment — not popup, new view
let focusState = { active: false, comp: null, clickPos: null, originalCamPos: null, originalTarget: null, focusClone: null };

function enterFocusMode(comp, clickWorldPos=null) {
    if (!comp) return;
    if (focusState.active && focusState.comp && focusState.comp.id === comp.id) { exitFocusMode(); return; }
    if (focusState.active) exitFocusMode();
    // Store original camera and click position for exact return
    focusState.originalCamPos = sceneManager.camera.position.clone();
    focusState.originalTarget = sceneManager.controls.target.clone();
    focusState.clickPos = clickWorldPos ? clickWorldPos.clone() : null;
    // For board position, compute component center world pos
    const boardW = state.boardSize ? state.boardSize.x : 4;
    const boardD = state.boardSize ? state.boardSize.z : 3;
    const cx = (comp.x + comp.w/2 - 0.5) * boardW;
    const cz = (comp.y + comp.h/2 - 0.5) * boardD;
    const boardPos = new THREE.Vector3(cx, 0, cz);
    // Apply boardGroup transform to get world pos
    const worldPos = boardPos.clone().applyMatrix4(sceneManager.boardGroup.matrixWorld);
    focusState.comp = comp;
    state.focusedCompId = comp.id;
    focusState.active = true;
    // Show dedicated view UI
    if (focusView) focusView.classList.remove('hidden');
    if (focusTitle) focusTitle.textContent = comp.name || COMPONENT_DEFS[comp.type]?.label || comp.type;
    if (focusInfo) {
        const def = COMPONENT_DEFS[comp.type];
        focusInfo.innerHTML = `<b>${def.label}</b> — ${comp.value||''} <span style="opacity:0.7">${comp.side==='front'?'روی برد':'پشت برد'}</span><br><span style="font-size:11px;opacity:0.8">${comp.description||''}</span>`;
    }
    showSidebarDetail(comp);
    if (outerDetailWrap && !outerDetailWrap.classList.contains('expanded')) setOuterExpanded(outerDetailWrap, true);
    // Keep focused visible during detachment — fade others & board but not this one yet
    fadeBoard(true, 920, comp.id);
    // Create isolated clone in focusGroup — starts exactly at board position for seamless detachment
    const entry = markersMap.get(comp.id);
    let focusClone = null;
    if (entry && entry.model) {
        focusClone = entry.model.clone(true);
        // Ensure cloned materials are independent and fully opaque
        focusClone.traverse(o=>{
            if(o.isMesh){
                o.visible = true;
                if (o.material) {
                    const mats = Array.isArray(o.material) ? o.material : [o.material];
                    mats.forEach(m=>{
                        m.transparent = false;
                        m.opacity = 1;
                        m.needsUpdate = true;
                        if (m.emissive) { m.emissiveIntensity = 0.65; }
                    });
                }
            }
        });
        // Start at exact world position of original (so detachment looks like it lifts off the board)
        const origWorld = new THREE.Vector3();
        entry.model.getWorldPosition(origWorld);
        // Fallback to computed board pos if world pos is zero / invalid
        const hasWorld = origWorld.lengthSq() > 0.0001;
        const startPos = hasWorld ? origWorld.clone() : (focusState.clickPos ? focusState.clickPos.clone() : worldPos.clone());
        // Keep original board height, but ensure clone starts at same height as original
        const origScale = entry.model.scale.clone();
        focusClone.position.copy(startPos);
        focusClone.scale.copy(origScale);
        focusClone.rotation.copy(entry.model.rotation);
        // Point 2: enlarge gold points in isolated view for easy attach/detach
        try{
            focusClone.traverse(o=>{
                if(o.userData && o.userData.isAp){
                    o.scale.setScalar(1.9);
                    if(o.material){
                        const mats = Array.isArray(o.material)?o.material:[o.material];
                        mats.forEach(m=>{
                            if(m.emissiveIntensity!==undefined) m.emissiveIntensity = Math.min(1.2, (m.emissiveIntensity||0.7)*1.4);
                            m.needsUpdate=true;
                        });
                    }
                }
            });
        }catch(e){}
        sceneManager.focusGroup.add(focusClone);
        sceneManager.focusGroup.visible = true;
        focusState.focusClone = focusClone;
        // Animate clone detaching: lift + arc to center, scaling up, with emissive pulse
        const targetPos = new THREE.Vector3(0, 0.62, 0);
        const startScale = origScale.clone();
        const base = entry.model.userData.baseScale || origScale.x || 1;
        const targetScale = new THREE.Vector3().setScalar(base * 2.8);
        const startTime = performance.now();
        const duration = 1100;
        // keep original visible for first 260ms to show duplication then fade it
        setTimeout(()=>{
            if (focusState.active && entry.model) {
                entry.model.visible = false;
                // also hide its group after fade
                const mats = [];
                entry.model.traverse(o=>{ if(o.isMesh && o.material){ const ms = Array.isArray(o.material)?o.material:[o.material]; ms.forEach(m=>mats.push(m)); }});
                mats.forEach(m=>{ m.transparent = true; });
                const st = performance.now();
                const so = mats.map(m=>m.opacity);
                function fadeOrig(){
                    const t = Math.min((performance.now()-st)/260,1);
                    mats.forEach((m,i)=>{ m.opacity = so[i]*(1-t); });
                    if (t<1) requestAnimationFrame(fadeOrig);
                }
                fadeOrig();
            }
        }, 260);
        function animClone(){
            const t = Math.min((performance.now()-startTime)/duration,1);
            const eased = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
            // arc: lift in Y with bezier
            const p = new THREE.Vector3().lerpVectors(startPos, targetPos, eased);
            p.y += Math.sin(eased * Math.PI) * 0.55; // arc lift makes detachment visible
            focusClone.position.copy(p);
            focusClone.scale.lerpVectors(startScale, targetScale, eased);
            // gentle spin during flight
            focusClone.rotation.y = entry.model.rotation.y + eased * Math.PI * 0.35;
            focusClone.rotation.x = entry.model.rotation.x + Math.sin(eased*Math.PI)*0.18;
            // emissive pulse
            focusClone.traverse(o=>{
                if(o.isMesh && o.material && o.material.emissive){
                    const mats = Array.isArray(o.material)?o.material:[o.material];
                    mats.forEach(m=>{
                        if (m.emissive) m.emissiveIntensity = 0.55 + Math.sin(eased*Math.PI)*0.45;
                    });
                }
            });
            if (t<1) requestAnimationFrame(animClone);
            else {
                // keep fixed orientation (no auto-rotate per user request)
                focusClone.position.copy(targetPos);
            }
        }
        animClone();
    } else {
        // No GLB model — show placeholder box detaching from board position
        const geo = new THREE.BoxGeometry(0.7, 0.22, 0.4);
        const mat = new THREE.MeshStandardMaterial({color: comp.color || COMPONENT_DEFS[comp.type]?.color || '#4dd0ff', roughness:0.35, metalness:0.15, emissive: new THREE.Color(COMPDEF_COLOR(comp)), emissiveIntensity: 0.4});
        function COMPDEF_COLOR(c){ const d = COMPONENT_DEFS[c.type]; return d ? d.border : '#4dd0ff'; }
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        const boardW2 = state.boardSize ? state.boardSize.x : 4;
        const boardD2 = state.boardSize ? state.boardSize.z : 3;
        const bx = (comp.x + comp.w/2 - 0.5) * boardW2;
        const bz = (comp.y + comp.h/2 - 0.5) * boardD2;
        const startPos2 = new THREE.Vector3(bx, 0.22, bz);
        // if clickPos exists, start there for exact detachment point
        if (focusState.clickPos) { startPos2.copy(focusState.clickPos); startPos2.y = 0.22; }
        const targetPos2 = new THREE.Vector3(0, 0.62, 0);
        mesh.position.copy(startPos2);
        mesh.scale.setScalar(0.6);
        // ab fix — placeholder box in isolated mode must also show attachment points (probes visible)
        try{
            ensureAttachmentPoints(comp);
            if (comp.attachmentPoints) {
                const isConnMap = (pid)=> Object.values(state.cableMap||{}).some(v=> v && v.componentId===comp.id && v.pointId===pid);
                // box size approx 0.4*scale? mesh geometry is 0.4? use 0.12 world approx
                const boxH = 0.06; // approx half height of placeholder box
                (comp.attachmentPoints||[]).forEach(pt=>{
                    const sphGeo2 = new THREE.SphereGeometry(0.032, 14, 14);
                    const sphMat2 = new THREE.MeshStandardMaterial({color: isConnMap(pt.id)?0x0BE881:0xFFD54F, emissive: isConnMap(pt.id)?0x0BE881:0xFFC107, emissiveIntensity: isConnMap(pt.id)?0.95:0.75, roughness:0.25});
                    const sph2 = new THREE.Mesh(sphGeo2, sphMat2);
                    const lx2 = (pt.nx - 0.5) * 0.24; // box width ~0.24
                    const lz2 = (pt.ny - 0.5) * 0.14; // box depth
                    const ly2 = boxH + 0.02;
                    sph2.position.set(lx2, ly2, lz2);
                    sph2.userData.compId = comp.id;
                    sph2.userData.pointId = pt.id;
                    sph2.userData.isAp = true;
                    sph2.userData.isApOnModel = true;
                    mesh.add(sph2);
                    cableApMeshes.set(comp.id+':'+pt.id+':model', sph2);
                });
            }
        } catch(e){ console.warn('box ap failed',e); }
        sceneManager.focusGroup.add(mesh);
        sceneManager.focusGroup.visible = true;
        focusState.focusClone = mesh;
        const st = performance.now();
        const dur = 950;
        const sSc = mesh.scale.clone();
        const tSc = new THREE.Vector3(1,1,1);
        function animBox(){
            const t = Math.min((performance.now()-st)/dur,1);
            const eased = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
            const p = new THREE.Vector3().lerpVectors(startPos2, targetPos2, eased);
            p.y += Math.sin(eased*Math.PI)*0.5;
            mesh.position.copy(p);
            mesh.scale.lerpVectors(sSc, tSc, eased);
            mesh.rotation.y = eased * Math.PI * 0.9;
            mesh.rotation.x = Math.sin(eased*Math.PI)*0.25;
            if (t<1) requestAnimationFrame(animBox);
            else {
                // keep fixed orientation
                mesh.position.copy(targetPos2);
            }
        }
        animBox();
        // hide original marker group after lift
        setTimeout(()=>{
            const e = markersMap.get(comp.id);
            if (e && e.group) e.group.visible = false;
        }, 280);
    }
    // Camera to isolated view — look at center, not board
    const camStart = sceneManager.camera.position.clone();
    const tgtStart = sceneManager.controls.target.clone();
    const camEnd = new THREE.Vector3(1.8, 1.35, 1.9);
    const tgtEnd = new THREE.Vector3(0, 0.45, 0);
    const cStart = performance.now();
    const cDur = 960;
    function animCam(){
        const t = Math.min((performance.now()-cStart)/cDur,1);
        const eased = 1 - Math.pow(1-t,3);
        sceneManager.camera.position.lerpVectors(camStart, camEnd, eased);
        sceneManager.controls.target.lerpVectors(tgtStart, tgtEnd, eased);
        sceneManager.controls.update();
        if (t<1) requestAnimationFrame(animCam);
    }
    animCam();
    flashMarker(comp.id, FLASH_GREEN, 3400);
    toast('✨ حالت ایزوله: برد محو شد — قطعه در محیط سه‌بعدی اختصاصی', 'info', '🧊');
}
function exitFocusMode() {
    if (!focusState.active) {
        if (state.focusedCompId) {
            // fallback old path
            const comp = state.components.find(c=>c.id===state.focusedCompId);
            if (comp) enlargeFocusedComponent(comp, false, 450);
            fadeBoard(false, 600);
            setTimeout(()=>{ if(state.boardSize) sceneManager.frameBoard(state.boardSize); },400);
            state.focusedCompId = null;
        }
        return;
    }
    const comp = focusState.comp;
    const clone = focusState.focusClone;
    const origPos = focusState.clickPos ? focusState.clickPos.clone() : null;
    // If we have a clone, animate it back to exact click position
    if (clone && comp) {
        const boardW = state.boardSize ? state.boardSize.x : 4;
        const boardD = state.boardSize ? state.boardSize.z : 3;
        const cx = (comp.x + comp.w/2 - 0.5) * boardW;
        const cz = (comp.y + comp.h/2 - 0.5) * boardD;
        const boardPos = new THREE.Vector3(cx, 0, cz).applyMatrix4(sceneManager.boardGroup.matrixWorld);
        boardPos.y = 0.25;
        const targetPos = origPos ? origPos.clone() : boardPos.clone();
        targetPos.y = 0.25;
        const startPos = clone.position.clone();
        const startScale = clone.scale.clone();
        const entry = markersMap.get(comp.id);
        const baseScale = entry && entry.model ? entry.model.userData.baseScale : 1;
        const targetScale = new THREE.Vector3().setScalar(baseScale ? baseScale * 0.55 : 0.55);
        // for placeholder, different
        const isBox = clone.geometry && clone.geometry.type === 'BoxGeometry';
        const finalScale = isBox ? new THREE.Vector3(0.2,0.2,0.2) : targetScale;
        const st = performance.now();
        const dur = 760;
        function animBack(){
            const t = Math.min((performance.now()-st)/dur,1);
            const eased = 1 - Math.pow(1-t,3);
            clone.position.lerpVectors(startPos, targetPos, eased);
            clone.scale.lerpVectors(startScale, finalScale, eased);
            clone.rotation.y -= 0.015 * (1-t);
            if (t<1) requestAnimationFrame(animBack);
            else {
                sceneManager.focusGroup.remove(clone);
                if (sceneManager.focusGroup.children.length===0) sceneManager.focusGroup.visible = false;
                // restore original model visibility
                const e = markersMap.get(comp.id);
                if (e && e.model) e.model.visible = true;
            }
        }
        animBack();
    } else if (sceneManager.focusGroup) {
        sceneManager.focusGroup.clear();
        sceneManager.focusGroup.visible = false;
    }
    // Fade board back in
    fadeBoard(false, 680);
    // Restore camera to exact original position where click happened (not generic overview)
    if (focusState.originalCamPos && focusState.originalTarget) {
        const camStart = sceneManager.camera.position.clone();
        const tgtStart = sceneManager.controls.target.clone();
        const camEnd = focusState.originalCamPos.clone();
        const tgtEnd = focusState.originalTarget.clone();
        const st = performance.now();
        const dur = 820;
        function animCamBack(){
            const t = Math.min((performance.now()-st)/dur,1);
            const eased = 1 - Math.pow(1-t,3);
            sceneManager.camera.position.lerpVectors(camStart, camEnd, eased);
            sceneManager.controls.target.lerpVectors(tgtStart, tgtEnd, eased);
            sceneManager.controls.update();
            if (t<1) requestAnimationFrame(animCamBack);
        }
        animCamBack();
    } else if (state.boardSize) {
        setTimeout(()=> sceneManager.frameBoard(state.boardSize), 400);
    }
    if (focusView) focusView.classList.add('hidden');
    focusState.active = false;
    focusState.comp = null;
    focusState.focusClone = null;
    state.focusedCompId = null;
    toast('↩ بازگشت به برد — از همان نقطه کلیک', 'info', '↩');
}
function onCanvasPointerUp() {
    if (draggingAp3D){
        const comp = state.components.find(c=>c.id===draggingAp3D.compId);
        if (comp){
            saveComponentsToServer().then(()=>{ refresh3DMarkers(); updateCableOverlay(); });
            toast(`نقطه جابجا شد — ${comp.attachmentPoints.find(p=>p.id===draggingAp3D.pointId)?.label||''}`,'success','📍');
        }
        draggingAp3D=null;
        sceneManager.setControlsEnabled(true);
        clearHighlightAttachmentPoints();
        setTimeout(()=>{ dragStartPos=null; isDraggingView=false; }, 50);
        return;
    }
    setTimeout(()=> { dragStartPos=null; isDraggingView=false; }, 50);
}

/* ---------- Event bindings ---------- */
uploadFrontBtn.addEventListener('click', () => frontInput.click());
uploadBackBtn.addEventListener('click', () => backInput.click());
dropZone.addEventListener('click', () => frontInput.click());
frontInput.addEventListener('change', (e) => handleFile(e.target.files[0], 'front'));
backInput.addEventListener('change', (e) => handleFile(e.target.files[0], 'back'));
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-active'); });
dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dropZone.classList.remove('drag-active'); });
dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.classList.remove('drag-active'); const file = e.dataTransfer.files[0]; handleFile(file, 'front'); });
mirrorCheckbox.addEventListener('change', async () => {
    state.mirrorBack = mirrorCheckbox.checked;
    if (state.backUrl) {
        showLoading(true);
        await rebuildBoard();
        if (state.mode === 'edit') updateEditImage();
        showLoading(false);
    }
});
removeBackBtn.addEventListener('click', removeBackOnly);
clearBtn.addEventListener('click', clearAll);
resetViewBtn.addEventListener('click', () => { if (state.boardSize) sceneManager.frameBoard(state.boardSize); });
flipBoardBtn.addEventListener('click', () => {
    if (sceneManager.isAnimating) return;
    sceneManager.flipBoard();
    updateFlipButtonText();
    flipBoardBtn.classList.add('flipping');
    flipBoardBtn.classList.remove('attention');
    setTimeout(() => {
        flipBoardBtn.classList.remove('flipping');
        if (state.filterType !== 'all' && state.backUrl) {
            const hasOpposite = state.components.some(c=>c.type===state.filterType && ((sceneManager.isBack && c.side==='front') || (!sceneManager.isBack && c.side==='back')));
            if (hasOpposite) { flipBoardBtn.classList.add('attention'); setTimeout(()=> flipBoardBtn.classList.remove('attention'), 6000); }
        }
    }, 1350);
});
viewModeBtn.addEventListener('click', () => { if (state.mode !== 'view') exitEditMode(true); });
editModeBtn.addEventListener('click', () => { if (state.mode !== 'edit') enterEditMode(); });
document.querySelectorAll('.filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
        const type = pill.dataset.type;
        applyFilterHighlight(type);
        pill.animate([{transform:'scale(0.96)'},{transform:'scale(1.04)'},{transform:'scale(1)'}], {duration: 300, easing:'cubic-bezier(.16,1,.3,1)'});
    });
});
// Accordion filter — engaging alternative to pills
if (filterAccordion) {
    filterAccordion.querySelectorAll('.accordion-header').forEach(btn => {
        btn.addEventListener('click', () => {
            const item = btn.closest('.accordion-item');
            const type = item ? item.dataset.type : btn.dataset.type;
            if (!type) return;
            // Toggle vs select: if already active and expanded, collapse; else activate
            const isActive = state.filterType === type && item.classList.contains('expanded');
            if (isActive) {
                // collapse and reset to all
                applyFilterHighlight('all');
            } else {
                applyFilterHighlight(type);
            }
            btn.animate([{transform:'scale(0.98)'},{transform:'scale(1)'}], {duration: 220, easing:'cubic-bezier(.16,1,.3,1)'});
        });
    });
    // Flash button inside body
    filterAccordion.querySelectorAll('.acc-flash-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const item = btn.closest('.accordion-item');
            const type = item ? item.dataset.type : null;
            if (!type) return;
            applyFilterHighlight(type);
        });
    });
}
paletteBtns.forEach(btn => { btn.addEventListener('click', () => selectPaletteType(btn.dataset.type)); });
editFlipBtn.addEventListener('click', () => {
    state.editSide = state.editSide === 'front' ? 'back' : 'front';
    if (state.editSide === 'back' && !state.backUrl) { toast('تصویر پشت بارگذاری نشده', 'error', '⚠️'); state.editSide = 'front'; return; }
    state.selectedRectId = null;
    closeDetailPanel();
    deleteSelectedBtn.classList.add('hidden');
    updateEditImage();
    renderEditRects();
    if (state.editViewMode==='3d' && edit3D) {
        const front = state.frontUrl, back = state.backUrl;
        if (front) edit3D.setBoard(front, back);
        else refreshEdit3DMarkers();
    }
    editBoardStage.animate([{opacity:0.6, transform:'scale(0.96)'},{opacity:1, transform:'scale(1)'}], {duration: 380, easing:'cubic-bezier(.16,1,.3,1)'});
});
saveEditBtn.addEventListener('click', () => exitEditMode(true));
cancelEditBtn.addEventListener('click', () => {
    if (JSON.stringify(state.components) !== JSON.stringify(state.backupComponents)) {
        if (!confirm('تغییرات ذخیره نشده از بین خواهد رفت. ادامه می‌دهید؟')) return;
    }
    exitEditMode(false);
});
deleteSelectedBtn.addEventListener('click', deleteSelected);
clearAllRectsBtn.addEventListener('click', clearAllRects);

editBoardStage.addEventListener('pointerdown', onEditPointerDown);
window.addEventListener('pointermove', onEditPointerMove);
window.addEventListener('pointerup', onEditPointerUp);
editBoardStage.addEventListener('click', onEditStageClick);
editBoardStage.addEventListener('contextmenu', e=> e.preventDefault());
editBoardViewport.addEventListener('wheel', onEditWheel, {passive:false});
if (zoomInBtn) zoomInBtn.addEventListener('click', zoomIn);
if (zoomOutBtn) zoomOutBtn.addEventListener('click', zoomOut);
if (zoomResetBtn) zoomResetBtn.addEventListener('click', resetZoom);

if (closeDetailBtn) closeDetailBtn.addEventListener('click', () => {
    state.selectedRectId = null;
    closeDetailPanel();
    deleteSelectedBtn.classList.add('hidden');
    renderEditRects();
});
if (saveDetailBtn) saveDetailBtn.addEventListener('click', () => {
    saveDetailFromPanel();
    renderEditRects();
    refresh3DMarkers();
    toast('اعمال شد', 'success', '✅');
});
if (deleteDetailBtn) deleteDetailBtn.addEventListener('click', deleteSelected);
if (detailType) detailType.addEventListener('change', () => {
    saveDetailFromPanel(false);
    renderEditRects();
    refresh3DMarkers();
});
[detailName, detailValue, detailDesc].forEach(el=> {
    if (el) {
        el.addEventListener('input', () => {
            // Live update without stealing focus — just update data model silently, no render that steals focus
            // Debounced save could be added, but we save on blur to avoid jump
        });
        el.addEventListener('blur', () => { saveDetailFromPanel(false); renderEditRects(); refresh3DMarkers(); updateFilterCounts(); });
    }
});

// Outer accordion — filters & details as nested, collapsible sections
document.querySelectorAll('.outer-header').forEach(btn => {
    btn.addEventListener('click', () => {
        const item = btn.closest('.outer-item');
        if (!item) return;
        toggleOuter(item);
        btn.animate([{transform:'scale(0.98)'},{transform:'scale(1)'}], {duration: 180, easing:'cubic-bezier(.16,1,.3,1)'});
    });
});
function initOuterHeights() {
    document.querySelectorAll('.outer-item.expanded .outer-body').forEach(body => {
        body.style.maxHeight = body.scrollHeight + 'px';
        body.style.opacity = '1';
    });
    document.querySelectorAll('.outer-item:not(.expanded) .outer-body').forEach(body => {
        body.style.maxHeight = '0px';
        body.style.opacity = '0';
    });
}
requestAnimationFrame(initOuterHeights);
setTimeout(initOuterHeights, 200);
window.addEventListener('load', initOuterHeights);

// Theme events
if (themeSelect) {
    themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));
    document.querySelectorAll('.theme-preset-btn').forEach(btn=>{
        btn.addEventListener('click', ()=> applyTheme(btn.dataset.theme));
    });
}
// Board events
if (boardSelect) boardSelect.addEventListener('change', () => activateBoard(boardSelect.value));
if (newBoardBtn) newBoardBtn.addEventListener('click', ()=> createBoard(false));
if (cloneBoardBtn) cloneBoardBtn.addEventListener('click', ()=> createBoard(true));
if (deleteBoardBtn) deleteBoardBtn.addEventListener('click', deleteCurrentBoard);
// Model library events
if (modelUploadBtn && modelUploadInput) {
    modelUploadBtn.addEventListener('click', ()=> modelUploadInput.click());
    modelUploadInput.addEventListener('change', async (e)=>{
        const f = e.target.files[0];
        if (f) { await uploadModelFile(f, {type: modelTypeSelect?modelTypeSelect.value:'resistor', name: modelNameInput?modelNameInput.value.trim():''}); e.target.value=''; }
    });
}
// Edit-mode board & model library (per request: adding 3D components inside editing section)
if (editBoardSelect) editBoardSelect.addEventListener('change', ()=> activateBoard(editBoardSelect.value));
if (editNewBoardBtn) editNewBoardBtn.addEventListener('click', ()=> createBoard(false));
if (editCloneBoardBtn) editCloneBoardBtn.addEventListener('click', ()=> createBoard(true));
if (editDeleteBoardBtn) editDeleteBoardBtn.addEventListener('click', deleteCurrentBoard);
if (editModelUploadBtn && editModelUploadInput) {
    editModelUploadBtn.addEventListener('click', ()=> editModelUploadInput.click());
    editModelUploadInput.addEventListener('change', async (e)=>{
        const f = e.target.files[0];
        if (f) { await uploadModelFile(f, {type: editModelTypeSelect?editModelTypeSelect.value:'resistor', name: editModelNameInput?editModelNameInput.value.trim():''}); e.target.value=''; }
    });
}
// Detail panel model & color
if (detailModelSelect) detailModelSelect.addEventListener('change', ()=>{
    const selId = detailModelSelect.value;
    if (selId) {
        const m = state.models.find(x=>x.id===selId);
        if (m) {
            // link model to selected component
            if (state.selectedRectId) {
                const comp = state.components.find(c=>c.id===state.selectedRectId);
                if (comp) { comp.modelId = selId; comp.modelUrl = m.glbUrl; }
            }
        }
        if (detailModelHint) detailModelHint.textContent = selId ? 'Linked to '+ (state.models.find(x=>x.id===selId)?.name || selId) : '';
        if (detailModelClearBtn) detailModelClearBtn.classList.remove('hidden');
        if (detailView3DBtn) detailView3DBtn.classList.remove('hidden');
        saveDetailFromPanel(false); renderEditRects(); refresh3DMarkers();
    } else {
        if (state.selectedRectId) {
            const comp = state.components.find(c=>c.id===state.selectedRectId);
            if (comp) { comp.modelId=null; comp.modelUrl=null; }
        }
        if (detailModelHint) detailModelHint.textContent='No model linked — manual name/desc';
        if (detailModelClearBtn) detailModelClearBtn.classList.add('hidden');
        if (detailView3DBtn) detailView3DBtn.classList.add('hidden');
    }
});
if (detailModelUploadBtn && detailModelInput) {
    detailModelUploadBtn.addEventListener('click', ()=> detailModelInput.click());
    detailModelInput.addEventListener('change', async (e)=>{
        const f = e.target.files[0];
        if (!f || !state.selectedRectId) return;
        const model = await uploadModelFile(f, {type: detailType?detailType.value:'resistor'});
        if (model) {
            const comp = state.components.find(c=>c.id===state.selectedRectId);
            if (comp) { comp.modelId = model.id; comp.modelUrl = model.glbUrl; }
            refreshDetailModelSelect();
            if (detailModelSelect) detailModelSelect.value = model.id;
            if (detailModelHint) detailModelHint.textContent = 'Linked to '+model.name;
            if (detailModelClearBtn) detailModelClearBtn.classList.remove('hidden');
            if (detailView3DBtn) detailView3DBtn.classList.remove('hidden');
            saveDetailFromPanel(false); renderEditRects(); refresh3DMarkers();
        }
        e.target.value='';
    });
}
if (detailModelClearBtn) detailModelClearBtn.addEventListener('click', ()=>{
    if (detailModelSelect) detailModelSelect.value='';
    if (state.selectedRectId) {
        const comp = state.components.find(c=>c.id===state.selectedRectId);
        if (comp) { comp.modelId=null; comp.modelUrl=null; }
    }
    if (detailModelHint) detailModelHint.textContent='Model cleared — manual';
    detailModelClearBtn.classList.add('hidden');
    if (detailView3DBtn) detailView3DBtn.classList.add('hidden');
    saveDetailFromPanel(false); renderEditRects(); refresh3DMarkers();
});
if (detailColorInput) detailColorInput.addEventListener('input', ()=>{
    if (!state.selectedRectId) return;
    const comp = state.components.find(c=>c.id===state.selectedRectId);
    if (comp) { comp.color = detailColorInput.value; saveDetailFromPanel(false); renderEditRects(); refresh3DMarkers(); updateFilterCounts(); }
});
if (detailColorClearBtn) detailColorClearBtn.addEventListener('click', ()=>{
    if (!state.selectedRectId) return;
    const comp = state.components.find(c=>c.id===state.selectedRectId);
    if (comp) { comp.color=null; if (detailColorInput) detailColorInput.value='#4dd0ff'; saveDetailFromPanel(false); renderEditRects(); refresh3DMarkers(); }
});
function updateTuneHint(comp){
    if (!comp) return;
    const hx = Math.round(comp.modelRotX||0);
    const hy = Math.round(comp.modelRotY||0);
    const hz = Math.round(comp.modelRotZ||0);
    const sc = (comp.modelScale||1).toFixed(1);
    const ho = (comp.modelOffsetY||0).toFixed(2);
    if (detailModelRotXVal) detailModelRotXVal.textContent = `${hx}°`;
    if (detailModelRotYVal) detailModelRotYVal.textContent = `${hy}°`;
    if (detailModelRotZVal) detailModelRotZVal.textContent = `${hz}°`;
    if (detailModelScaleVal) detailModelScaleVal.textContent = `${sc}×`;
    if (detailModelHeightVal) detailModelHeightVal.textContent = `${ho}`;
    if (detailModelRotHint) detailModelRotHint.textContent = `چرخش: X${hx}° Y${hy}° Z${hz}° · مقیاس: ${sc}× · ارتفاع: ${ho}`;
}

// ---------- Edit 3D Live Preview (inside editing interface) ----------
let editPreview = null;
function initEditPreview(){
    if (!editPreviewCanvas || editPreview) return;
    const renderer = new THREE.WebGLRenderer({canvas: editPreviewCanvas, antialias: true, alpha: true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.35));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0B0F1A);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(1.2, 0.9, 1.6);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.7;
    // lights
    scene.add(new THREE.HemisphereLight(0x8fb8ff, 0x0a0a14, 0.9));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(2,3,2);
    dir.castShadow = true;
    scene.add(dir);
    const point = new THREE.PointLight(0x4dd0ff, 0.6, 10);
    point.position.set(-1.5,1.5,-1);
    scene.add(point);
    const grid = new THREE.GridHelper(4, 8, 0x2a3a5a, 0x1a2338);
    grid.position.y = -0.6;
    grid.material.opacity = 0.25;
    grid.material.transparent = true;
    scene.add(grid);
    const clock = new THREE.Clock();
    let currentModel = null;
    let rafId = null;
    function resize(){
        const wrap = editPreviewWrap;
        if (!wrap || wrap.classList.contains('hidden')) return;
        const w = wrap.clientWidth - 2;
        const h = 180;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);
    function animate(){
        rafId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
    editPreview = {renderer, scene, camera, controls, grid, currentModel, resize,
        setModel: async (comp)=>{
            if (currentModel) { scene.remove(currentModel); currentModel = null; editPreview.currentModel = null; }
            if (!comp) return;
            const url = resolveModelUrl(comp);
            if (!url) {
                // show placeholder box with color
                const geo = new THREE.BoxGeometry(0.6, 0.18, 0.3);
                const mat = new THREE.MeshStandardMaterial({color: comp.color || COMPONENT_DEFS[comp.type]?.color || '#4dd0ff', roughness:0.4, metalness:0.2});
                const mesh = new THREE.Mesh(geo, mat);
                mesh.castShadow = true;
                mesh.position.y = -0.2;
                // apply rot/scale/height
                const rx = THREE.MathUtils.degToRad(comp.modelRotX||0), ry = THREE.MathUtils.degToRad(comp.modelRotY||0), rz = THREE.MathUtils.degToRad(comp.modelRotZ||0);
                mesh.rotation.set(rx,ry,rz);
                mesh.scale.setScalar(comp.modelScale||1);
                mesh.position.y += (comp.modelOffsetY||0);
                scene.add(mesh);
                currentModel = mesh; editPreview.currentModel = mesh;
                resize();
                return;
            }
            try{
                const gltf = await loadGltfCached(url);
                const model = gltf.scene.clone(true);
                const box = new THREE.Box3().setFromObject(model);
                if (!isFinite(box.min.x)) return;
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                model.position.sub(center);
                const maxDim = Math.max(size.x, size.y, size.z) || 1;
                const baseScale = (1.0 / maxDim) * 0.85;
                const scale = baseScale * (comp.modelScale||1);
                model.scale.setScalar(scale);
                model.userData.previewBaseScale = baseScale;
                const rx = THREE.MathUtils.degToRad(comp.modelRotX||0), ry = THREE.MathUtils.degToRad(comp.modelRotY||0), rz = THREE.MathUtils.degToRad(comp.modelRotZ||0);
                model.rotation.set(rx,ry,rz);
                model.position.y += (comp.modelOffsetY||0) * 0.5;
                model.userData.basePosY = model.position.y;
                model.traverse(o=>{ if(o.isMesh){ o.castShadow=true; if(o.material){ o.material = Array.isArray(o.material)? o.material.map(m=>m.clone()): o.material.clone(); if(comp.color && o.material.color){ const tint=new THREE.Color(comp.color); o.material.color.lerp(tint,0.18); } } } });
                scene.add(model);
                currentModel = model; editPreview.currentModel = model;
                resize();
                // frame
                camera.position.set(1.2, 0.9, 1.6);
                controls.target.set(0,0,0);
                controls.update();
            }catch(e){ console.warn('preview load failed',e); }
        },
        updateLive: (comp)=>{
            if (!currentModel || !comp) return;
            const rx = THREE.MathUtils.degToRad(comp.modelRotX||0), ry = THREE.MathUtils.degToRad(comp.modelRotY||0), rz = THREE.MathUtils.degToRad(comp.modelRotZ||0);
            currentModel.rotation.set(rx,ry,rz);
            const baseScale = currentModel.userData.baseScale || 1;
            // for placeholder, just set
            if (currentModel.isMesh) {
                currentModel.scale.setScalar(comp.modelScale||1);
                currentModel.position.y = -0.2 + (comp.modelOffsetY||0);
            } else {
                // for gltf clone, we need to re-apply scale relative to original
                // simplest: reset and re-apply
                // we store base scale as 1/maxDim*0.85, so multiply
                const maxDim = 1; // approximate
                currentModel.scale.setScalar((comp.modelScale||1) * (currentModel.userData.previewBaseScale||1));
                currentModel.position.y = (comp.modelOffsetY||0)*0.5;
            }
        }
    };
    // store previewBaseScale for live update
    editPreview.resize();
}
function showEditPreview(comp){
    if (!editPreviewWrap) return;
    if (!comp) { editPreviewWrap.classList.add('hidden'); return; }
    const hasModel = !!(comp.modelUrl || comp.modelId) || true; // always show preview even without model (placeholder)
    if (!hasModel) { editPreviewWrap.classList.add('hidden'); return; }
    editPreviewWrap.classList.remove('hidden');
    if (!editPreview) initEditPreview();
    if (editPreview) editPreview.setModel(comp);
}
function updateEditPreviewLive(comp){
    if (!editPreview || !comp || editPreviewWrap.classList.contains('hidden')) return;
    // update preview model rotation/scale/height without reloading
    const m = editPreview.currentModel;
    if (!m) return;
    const rx = THREE.MathUtils.degToRad(comp.modelRotX||0), ry = THREE.MathUtils.degToRad(comp.modelRotY||0), rz = THREE.MathUtils.degToRad(comp.modelRotZ||0);
    m.rotation.set(rx,ry,rz);
    // scale: for preview we use simple scale
    const base = m.userData.previewBaseScale || 1;
    // if placeholder box, scale directly
    if (m.isMesh && m.geometry && m.geometry.type==='BoxGeometry') {
        m.scale.setScalar(comp.modelScale||1);
        m.position.y = -0.2 + (comp.modelOffsetY||0);
    } else {
        // for gltf, we need to preserve base scale
        const targetScale = (m.userData.previewBaseScale || 0.85) * (comp.modelScale||1);
        // Actually previewBaseScale was computed as 1/maxDim*0.85, we stored? Let's just set directly
        // Simplify: re-apply scale as previewBaseScale * modelScale
        if (m.userData.previewBaseScale) m.scale.setScalar(m.userData.previewBaseScale * (comp.modelScale||1));
        else m.scale.setScalar(comp.modelScale||1);
        m.position.y = (comp.modelOffsetY||0)*0.5;
    }
}
function updateMainBoardLive(comp){
    const entry = markersMap.get(comp.id);
    if (!entry || !entry.group) return false;
    let m = entry.group.userData.model;
    if (!m){
        entry.group.traverse(o=>{ if(o.userData && o.userData.compId===comp.id && o.userData._footprint) m=o; });
    }
    if (!m) return false;
    try{
        const rx = THREE.MathUtils.degToRad(comp.modelRotX||0), ry = THREE.MathUtils.degToRad(comp.modelRotY||0), rz = THREE.MathUtils.degToRad(comp.modelRotZ||0);
        m.rotation.set(rx,ry,rz);
        const mScale = Math.max(0.1, Math.min(6, parseFloat(comp.modelScale)||1));
        const footprint = m.userData._footprint;
        const rawTarget = m.userData._rawTarget;
        if (footprint && rawTarget){
            const target = Math.max(rawTarget, 0.06);
            let scale = target / footprint * mScale;
            const origSize = m.userData._origSize;
            if (origSize){
                const rawH = origSize.y * scale;
                if (rawH > 0.75) scale = 0.75 / origSize.y * (mScale>1? mScale:1);
                if (rawH < 0.04) scale = 0.04 / origSize.y;
            }
            m.scale.setScalar(scale);
            m.userData.baseScale = scale;
            m.userData._lastMScale = mScale;
        } else {
            m.scale.setScalar(mScale);
        }
        const offsetY = parseFloat(comp.modelOffsetY)||0;
        const surfaceY = m.userData._surfaceY != null ? m.userData._surfaceY : m.userData._yOffset || 0;
        const cx = m.userData._cx, cz = m.userData._cz;
        const box2 = new THREE.Box3().setFromObject(m);
        if (isFinite(box2.min.x)){
            const size2 = box2.getSize(new THREE.Vector3());
            const height = size2.y;
            const yPos = surfaceY + (comp.side==='front' ? height/2 + 0.006 + offsetY : -height/2 - 0.006 - offsetY);
            m.position.set(cx!=null?cx:m.position.x, yPos, cz!=null?cz:m.position.z);
            m.userData.basePosY = yPos;
            m.userData._lastOffsetY = offsetY;
        } else {
            const basePosY = m.userData.basePosY, baseOff = m.userData._lastOffsetY||0;
            if (basePosY!=null) m.position.y = basePosY - baseOff + offsetY;
        }
        return true;
    }catch(e){ console.warn('updateMainBoardLive failed',e); return false; }
}
function updateEdit3DLive(comp){
    if (!comp || !edit3D || !edit3D.compGroup) return false;
    try{
        const grp = edit3D.compGroup;
        let target=null;
        grp.traverse(o=>{ if(o.userData && o.userData.compId===comp.id && o.userData._footprint) target=o; });
        if (!target){
            for (const child of grp.children){
                if (child.userData && child.userData.compId===comp.id && child.userData.model) { target=child.userData.model; break; }
                if (child.userData && child.userData.compId===comp.id) { target=child; break; }
            }
        }
        if (!target) return false;
        if (target.userData && target.userData.model) target = target.userData.model;
        if (!target.isObject3D) return false;
        const rx = THREE.MathUtils.degToRad(comp.modelRotX||0), ry = THREE.MathUtils.degToRad(comp.modelRotY||0), rz = THREE.MathUtils.degToRad(comp.modelRotZ||0);
        target.rotation.set(rx,ry,rz);
        const mScale = Math.max(0.1, Math.min(6, parseFloat(comp.modelScale)||1));
        const footprint = target.userData._footprint;
        const rawTarget = target.userData._rawTarget;
        if (footprint && rawTarget){
            const t2 = Math.max(rawTarget, 0.06);
            let scale = t2 / footprint * mScale;
            const origSize = target.userData._origSize;
            if (origSize){
                const rawH = origSize.y * scale;
                if (rawH > 0.75) scale = 0.75 / origSize.y * (mScale>1? mScale:1);
                if (rawH < 0.04) scale = 0.04 / origSize.y;
            }
            target.scale.setScalar(scale);
            target.userData.baseScale = scale;
            target.userData._lastMScale = mScale;
        } else target.scale.setScalar(mScale);
        const offsetY = parseFloat(comp.modelOffsetY)||0;
        const surfaceY = target.userData._surfaceY != null ? target.userData._surfaceY : target.userData._yOffset||0;
        const cx = target.userData._cx, cz = target.userData._cz;
        const box2 = new THREE.Box3().setFromObject(target);
        if (isFinite(box2.min.x)){
            const size2 = box2.getSize(new THREE.Vector3());
            const height = size2.y;
            const yPos = surfaceY + (comp.side==='front' ? height/2 + 0.006 + offsetY : -height/2 - 0.006 - offsetY);
            target.position.set(cx!=null?cx:target.position.x, yPos, cz!=null?cz:target.position.z);
            target.userData.basePosY = yPos;
            target.userData._lastOffsetY = offsetY;
        } else {
            const basePosY = target.userData.basePosY, baseOff = target.userData._lastOffsetY||0;
            if (basePosY!=null) target.position.y = basePosY - baseOff + offsetY;
        }
        return true;
    }catch(e){ console.warn('updateEdit3DLive failed',e); return false; }
}

if (detailModelRotX) detailModelRotX.addEventListener('input', ()=>{
    if (!state.selectedRectId) return;
    const comp = state.components.find(c=>c.id===state.selectedRectId);
    if (comp) {
        comp.modelRotX = parseFloat(detailModelRotX.value)||0;
        updateTuneHint(comp);
        saveDetailFromPanel(false);
        const ok1 = updateMainBoardLive(comp);
        const ok2 = updateEdit3DLive(comp);
        updateEditPreviewLive(comp);
        if (!ok1) refresh3DMarkers();
        if (!ok2 && state.editViewMode==='3d') refreshEdit3DMarkers();
    }
});
if (detailModelRotY) detailModelRotY.addEventListener('input', ()=>{
    if (!state.selectedRectId) return;
    const comp = state.components.find(c=>c.id===state.selectedRectId);
    if (comp) {
        comp.modelRotY = parseFloat(detailModelRotY.value)||0;
        updateTuneHint(comp);
        saveDetailFromPanel(false);
        const ok1 = updateMainBoardLive(comp);
        const ok2 = updateEdit3DLive(comp);
        updateEditPreviewLive(comp);
        if (!ok1) refresh3DMarkers();
        if (!ok2 && state.editViewMode==='3d') refreshEdit3DMarkers();
    }
});
if (detailModelRotZ) detailModelRotZ.addEventListener('input', ()=>{
    if (!state.selectedRectId) return;
    const comp = state.components.find(c=>c.id===state.selectedRectId);
    if (comp) {
        comp.modelRotZ = parseFloat(detailModelRotZ.value)||0;
        updateTuneHint(comp);
        saveDetailFromPanel(false);
        const ok1 = updateMainBoardLive(comp);
        const ok2 = updateEdit3DLive(comp);
        updateEditPreviewLive(comp);
        if (!ok1) refresh3DMarkers();
        if (!ok2 && state.editViewMode==='3d') refreshEdit3DMarkers();
    }
});
if (detailModelScale) detailModelScale.addEventListener('input', ()=>{
    if (!state.selectedRectId) return;
    const comp = state.components.find(c=>c.id===state.selectedRectId);
    if (comp) {
        comp.modelScale = parseFloat(detailModelScale.value)||1;
        updateTuneHint(comp);
        saveDetailFromPanel(false);
        const ok1 = updateMainBoardLive(comp);
        const ok2 = updateEdit3DLive(comp);
        updateEditPreviewLive(comp);
        if (!ok1) refresh3DMarkers();
        if (!ok2 && state.editViewMode==='3d') refreshEdit3DMarkers();
    }
});
if (detailModelHeight) detailModelHeight.addEventListener('input', ()=>{
    if (!state.selectedRectId) return;
    const comp = state.components.find(c=>c.id===state.selectedRectId);
    if (comp) {
        comp.modelOffsetY = parseFloat(detailModelHeight.value)||0;
        updateTuneHint(comp);
        saveDetailFromPanel(false);
        const ok1 = updateMainBoardLive(comp);
        const ok2 = updateEdit3DLive(comp);
        updateEditPreviewLive(comp);
        if (!ok1) refresh3DMarkers();
        if (!ok2 && state.editViewMode==='3d') refreshEdit3DMarkers();
    }
});
if (detailModelResetBtn) detailModelResetBtn.addEventListener('click', ()=>{
    if (!state.selectedRectId) return;
    const comp = state.components.find(c=>c.id===state.selectedRectId);
    if (comp) {
        comp.modelRotX = 0; comp.modelRotY = 0; comp.modelRotZ = 0; comp.modelScale = 1; comp.modelOffsetY = 0;
        if (detailModelRotX) detailModelRotX.value = 0;
        if (detailModelRotY) detailModelRotY.value = 0;
        if (detailModelRotZ) detailModelRotZ.value = 0;
        if (detailModelScale) detailModelScale.value = 1;
        if (detailModelHeight) detailModelHeight.value = 0;
        updateTuneHint(comp);
        saveDetailFromPanel(false);
        updateMainBoardLive(comp);
        updateEdit3DLive(comp);
        updateEditPreviewLive(comp);
        refresh3DMarkers();
        if (state.editViewMode==='3d') refreshEdit3DMarkers();
        toast('تنظیمات مدل بازنشانی شد','info','↺');
    }
});
// ---------- Edit 3D Board Preview (accurate placement on board) ----------
let edit3D = null;
let edit3DRaycaster = new THREE.Raycaster();
let edit3DMouse = new THREE.Vector2();
let edit3DDragging = null; // {compId, offsetX, offsetZ, w, h}
let edit3DActiveId = null; // active via double-click in 3D edit
function initEdit3D(){
    if (!edit3DCanvas || edit3D) return;
    const renderer = new THREE.WebGLRenderer({canvas: edit3DCanvas, antialias: true, alpha: true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.35));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.BasicShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0B0F1A);
    scene.fog = new THREE.Fog(0x0B0F1A, 8, 22);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 3.8, 4.2);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.5;
    controls.maxDistance = 18;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.enablePan = true;
    controls.enableZoom = true;
    controls.enableRotate = true;
    controls.screenSpacePanning = true;
    controls.panSpeed = 1.15;
    controls.rotateSpeed = 0.95;
    controls.zoomSpeed = 1.08;
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    controls.target.set(0,0,0);
    // lights
    scene.add(new THREE.HemisphereLight(0x8fb8ff, 0x0a0a14, 0.85));
    const dir = new THREE.DirectionalLight(0xffffff, 1.4);
    dir.position.set(3,5,3);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024,1024);
    scene.add(dir);
    const fill = new THREE.DirectionalLight(0x6ea8ff, 0.35);
    fill.position.set(-3,2,-3);
    scene.add(fill);
    const grid = new THREE.GridHelper(20, 40, 0x2a3a5a, 0x1a2338);
    grid.position.y = -0.76;
    grid.material.opacity = 0.45;
    grid.material.transparent = true;
    scene.add(grid);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(10, 64), new THREE.ShadowMaterial({opacity:0.28}));
    floor.rotation.x = -Math.PI/2;
    floor.position.y = -0.75;
    floor.receiveShadow = true;
    scene.add(floor);
    const boardGroup = new THREE.Group();
    const compGroup = new THREE.Group();
    boardGroup.add(compGroup);
    scene.add(boardGroup);
    const clock = new THREE.Clock();
    let rafId = null;
    let boardMesh = null;
    let boardSize = null;
    function onResize(){
        if (!edit3DWrap || edit3DWrap.classList.contains('hidden')) return;
        const w = edit3DWrap.clientWidth;
        const h = edit3DWrap.clientHeight || 380;
        if (w===0 || h===0) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(onResize);
    ro.observe(edit3DWrap);
    window.addEventListener('resize', onResize);
    function animate(){
        rafId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
    edit3D = {renderer, scene, camera, controls, grid, floor, boardGroup, compGroup, boardMesh, boardSize, onResize,
        setBoard: async (frontUrl, backUrl)=>{
            try {
                const {mesh, size} = await buildBoardMesh(frontUrl, backUrl, {mirrorBack: state.mirrorBack});
                // clear previous
                boardGroup.clear();
                boardGroup.add(compGroup);
                compGroup.clear();
                boardGroup.add(mesh);
                boardMesh = mesh;
                boardSize = size;
                edit3D.boardMesh = mesh;
                edit3D.boardSize = size;
                // frame
                const maxDim = Math.max(size.x, size.z, 1);
                camera.position.set(0, maxDim*0.95, maxDim*1.25);
                controls.target.set(0,0,0);
                controls.update();
                onResize();
                refreshEdit3DMarkers();
            } catch(e){ console.warn('edit3D setBoard failed', e); }
        },
        clear: ()=>{
            boardGroup.clear();
            boardGroup.add(compGroup);
            compGroup.clear();
            boardMesh = null; boardSize=null;
            edit3D.boardMesh=null; edit3D.boardSize=null;
        }
    };
    // interaction: ONLY double-click on a 3D component makes it active — single click/empty does nothing (precision)
    const canvasEl = edit3DCanvas;
    let isDraggingView = false;
    let dragStart = null;
    // edit3DActiveId is global, shared
    function findEdit3DCompAtMouse(clientX, clientY){
        const rect = canvasEl.getBoundingClientRect();
        edit3DMouse.x = ((clientX - rect.left)/rect.width)*2-1;
        edit3DMouse.y = -((clientY - rect.top)/rect.height)*2+1;
        edit3DRaycaster.setFromCamera(edit3DMouse, camera);
        if (edit3D.boardMesh) {
            const hits = edit3DRaycaster.intersectObject(edit3D.boardMesh, false);
            if (hits.length>0 && hits[0].uv) {
                const hit = hits[0];
                const u = hit.uv.x;
                const v = 1 - hit.uv.y;
                const found = state.components.filter(c=> c.side===state.editSide && u>=c.x && u<=c.x+c.w && v>=c.y && v<=c.y+c.h);
                if (found.length>0) {
                    found.sort((a,b)=>(a.w*a.h)-(b.w*b.h));
                    return found[0];
                }
            }
        }
        const compHits = edit3DRaycaster.intersectObjects(compGroup.children, true);
        for (const h of compHits) {
            let obj = h.object;
            while(obj && !obj.userData.compId) obj = obj.parent;
            if (obj && obj.userData.compId) {
                const comp = state.components.find(c=>c.id===obj.userData.compId);
                if (comp && comp.side===state.editSide) return comp;
            }
        }
        return null;
    }
    canvasEl.addEventListener('dblclick', (e)=>{
        if (state.editViewMode !== '3d') return;
        e.preventDefault();
        const comp = findEdit3DCompAtMouse(e.clientX, e.clientY);
        if (comp) {
            selectRect(comp.id);
            edit3DActiveId = comp.id;
            if (edit3DHint) edit3DHint.textContent = `✓ ${comp.name||COMPONENT_DEFS[comp.type].label} فعال شد — اکنون می‌توانید آن را بکشید`;
            toast(`فعال شد (دوبار کلیک): ${COMPONENT_DEFS[comp.type].label} — اکنون درگ کنید`, 'success', '🎯');
            refreshEdit3DMarkers();
        } else {
            // double-click on empty does NOT shift anything — clear active
            edit3DActiveId = null;
            if (edit3DHint) edit3DHint.textContent = 'نقطه خالی — دوبار کلیک روی قطعه سه‌بعدی برای فعال‌سازی';
            refreshEdit3DMarkers();
        }
    });
    let editDraggingAp = null;
    function hitTestEditAp(clientX, clientY){
        const rect = canvasEl.getBoundingClientRect();
        edit3DMouse.x = ((clientX - rect.left)/rect.width)*2-1;
        edit3DMouse.y = -((clientY - rect.top)/rect.height)*2+1;
        edit3DRaycaster.setFromCamera(edit3DMouse, camera);
        const spheres = [];
        edit3D.compGroup.traverse(o=>{ if(o.userData && o.userData.isAp) spheres.push(o); });
        const hits = edit3DRaycaster.intersectObjects(spheres, false);
        if (hits.length) return {compId: hits[0].object.userData.compId, pointId: hits[0].object.userData.pointId, object: hits[0].object};
        return null;
    }
    canvasEl.addEventListener('pointerdown', (e)=>{
        if (state.editViewMode !== '3d') return;
        // first check if hitting an attachment point sphere for direct reposition (double-click or single drag)
        const apHitEdit = hitTestEditAp(e.clientX, e.clientY);
        if (apHitEdit){
            editDraggingAp = apHitEdit;
            controls.enabled = false;
            e.preventDefault();
            e.stopPropagation();
            highlightAttachmentPoint(apHitEdit.compId, apHitEdit.pointId, true);
            return;
        }
        dragStart = {x:e.clientX, y:e.clientY};
        isDraggingView = false;
        // Only allow drag-move if the hit is on the DOUBLE-CLICK-activated component
        if (!edit3DActiveId) {
            // No active component — never interfere, allow orbit/pan/zoom freely
            return;
        }
        const comp = findEdit3DCompAtMouse(e.clientX, e.clientY);
        if (comp && comp.id === edit3DActiveId) {
            // Start precise drag of the active component
            edit3DDragging = {compId: comp.id, w: comp.w, h: comp.h};
            controls.enabled = false;
            e.preventDefault();
        } else if (comp && comp.id !== edit3DActiveId) {
            // Click on a different component without double-click → ignore, do not activate or move
            if (edit3DHint) edit3DHint.textContent = 'برای جابجایی، ابتدا دوبار کلیک کنید';
        } else {
            // Click on empty — do nothing, do not shift others
        }
    });
    canvasEl.addEventListener('pointermove', (e)=>{
        if (editDraggingAp){
            const rect = canvasEl.getBoundingClientRect();
            edit3DMouse.x = ((e.clientX - rect.left)/rect.width)*2-1;
            edit3DMouse.y = -((e.clientY - rect.top)/rect.height)*2+1;
            edit3DRaycaster.setFromCamera(edit3DMouse, camera);
            if (edit3D.boardMesh){
                const hits = edit3DRaycaster.intersectObject(edit3D.boardMesh, false);
                if (hits.length && hits[0].uv){
                    const hit = hits[0];
                    const u = hit.uv.x, v = 1 - hit.uv.y;
                    const comp = state.components.find(c=>c.id===editDraggingAp.compId);
                    if (comp){
                        let nx = (u - comp.x)/comp.w;
                        let ny = (v - comp.y)/comp.h;
                        nx = Math.max(0.02, Math.min(0.98, nx));
                        ny = Math.max(0.02, Math.min(0.98, ny));
                        const pt = comp.attachmentPoints.find(p=>p.id===editDraggingAp.pointId);
                        if (pt){
                            pt.nx = Math.round(nx*10000)/10000;
                            pt.ny = Math.round(ny*10000)/10000;
                            refreshEdit3DMarkers();
                            requestAnimationFrame(()=> updateCableOverlay());
                            if (edit3DHint) edit3DHint.textContent = `📍 ${pt.label} → ${(pt.nx*100).toFixed(0)}%, ${(pt.ny*100).toFixed(0)}%`;
                        }
                    }
                }
            }
            return;
        }
        if (!edit3DDragging) {
            if (dragStart && Math.hypot(e.clientX-dragStart.x, e.clientY-dragStart.y)>4) isDraggingView = true;
            return;
        }
        if (isDraggingView) return;
        const rect = canvasEl.getBoundingClientRect();
        edit3DMouse.x = ((e.clientX - rect.left)/rect.width)*2-1;
        edit3DMouse.y = -((e.clientY - rect.top)/rect.height)*2+1;
        edit3DRaycaster.setFromCamera(edit3DMouse, camera);
        if (edit3D.boardMesh) {
            const hits = edit3DRaycaster.intersectObject(edit3D.boardMesh, false);
            if (hits.length>0 && hits[0].uv) {
                const hit = hits[0];
                const u = hit.uv.x;
                const v = 1 - hit.uv.y;
                const comp = state.components.find(c=>c.id===edit3DDragging.compId);
                if (comp) {
                    // keep w,h, center at hit point
                    let newX = u - comp.w/2;
                    let newY = v - comp.h/2;
                    newX = Math.max(0, Math.min(1 - comp.w, newX));
                    newY = Math.max(0, Math.min(1 - comp.h, newY));
                    comp.x = Math.round(newX*10000)/10000;
                    comp.y = Math.round(newY*10000)/10000;
                    // live update both 2D and 3D
                    renderEditRects();
                    refreshEdit3DMarkers();
                    // also update detail panel if open
                    if (state.selectedRectId===comp.id) showEditPreview(comp);
                    // update hint
                    if (edit3DHint) edit3DHint.textContent = `📍 ${comp.name||'component'} → x:${comp.x.toFixed(3)} y:${comp.y.toFixed(3)}`;
                }
            }
        }
    });
    canvasEl.addEventListener('pointerup', (e)=>{
        if (editDraggingAp){
            const comp = state.components.find(c=>c.id===editDraggingAp.compId);
            if (comp){
                saveComponentsToServer().then(()=>{ refresh3DMarkers(); refreshEdit3DMarkers(); updateCableOverlay(); renderAttachmentPanel(); });
                toast(`نقطه ${comp.attachmentPoints.find(p=>p.id===editDraggingAp.pointId)?.label} جابجا شد`,'success','📍');
            }
            editDraggingAp=null;
            controls.enabled = true;
            clearHighlightAttachmentPoints();
            setTimeout(()=>{ isDraggingView=false; dragStart=null; }, 60);
            return;
        }
        if (edit3DDragging) {
            // finished drag, save
            saveDetailFromPanel(false);
            refresh3DMarkers();
            updateFilterCounts();
            toast('موقعیت به‌روز شد (3D)', 'success', '📍');
        }
        edit3DDragging = null;
        controls.enabled = true;
        setTimeout(()=>{ isDraggingView=false; dragStart=null; }, 60);
    });
    canvasEl.addEventListener('pointerleave', ()=>{
        edit3DDragging=null;
        controls.enabled=true;
    });
    onResize();
}
function refreshEdit3DMarkers(){
    if (!edit3D || !edit3D.boardSize) return;
    const boardW = edit3D.boardSize.x;
    const boardD = edit3D.boardSize.z;
    const halfT = THICKNESS/2;
    edit3D.compGroup.clear();
    // only show components for current editSide? show all but dim opposite side
    state.components.forEach(comp=>{
        const def = COMPONENT_DEFS[comp.type];
        const effectiveColor = comp.color && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(comp.color) ? comp.color : def.color;
        const wWorld = comp.w * boardW;
        const hWorld = comp.h * boardD;
        if (wWorld <= 0.001 || hWorld <= 0.001) return;
        const renderW = Math.max(wWorld, 0.035);
        const renderH = Math.max(hWorld, 0.035);
        const cx = (comp.x + comp.w/2 - 0.5) * boardW;
        const cz = (comp.y + comp.h/2 - 0.5) * boardD;
        const yOffset = comp.side === 'front' ? halfT+0.015 : -halfT-0.015;
        const isSelected = state.selectedRectId === comp.id;
        const isCurrentSide = comp.side === state.editSide;
        const hasModel = !!resolveModelUrl(comp);
        const grp = new THREE.Group();
        grp.userData.compId = comp.id;
        // flat marker with border
        const geom = new THREE.PlaneGeometry(renderW, renderH);
        const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(effectiveColor),
            emissive: new THREE.Color(effectiveColor),
            emissiveIntensity: isSelected ? 0.55 : (isCurrentSide ? 0.28 : 0.08),
            transparent: true,
            opacity: isSelected ? 0.72 : (isCurrentSide ? 0.48 : 0.14),
            roughness: 0.5,
            side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(cx, yOffset, cz);
        mesh.rotation.x = comp.side==='front' ? -Math.PI/2 : Math.PI/2;
        mesh.userData.compId = comp.id;
        grp.add(mesh);
        const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geom), new THREE.LineBasicMaterial({color: effectiveColor, transparent:true, opacity: isSelected?1: (isCurrentSide?0.85:0.25)}));
        edge.position.copy(mesh.position);
        edge.rotation.copy(mesh.rotation);
        grp.add(edge);
        // aa — attachment points in edit 3D
        ensureAttachmentPoints(comp);
        (comp.attachmentPoints||[]).forEach(pt=>{
            const wx = (comp.x + comp.w*pt.nx -0.5)*boardW;
            const wz = (comp.y + comp.h*pt.ny -0.5)*boardD;
            const apY = yOffset + (comp.side==='front'?0.015:-0.015);
            const isConn = Object.values(state.cableMap||{}).some(v=> v && v.componentId===comp.id && v.pointId===pt.id);
            const sg = new THREE.SphereGeometry(0.020, 12, 12);
            const sm = new THREE.MeshStandardMaterial({color: isConn?0x0BE881:0xFFD54F, emissive: isConn?0x0BE881:0xFFC107, emissiveIntensity: isConn?0.95:0.68, roughness:0.30});
            const sph = new THREE.Mesh(sg, sm);
            sph.position.set(wx, apY, wz);
            sph.userData.compId=comp.id; sph.userData.pointId=pt.id; sph.userData.isAp=true;
            grp.add(sph);
        });
        // if selected, add highlight ring
        if (isSelected) {
            const ringGeo = new THREE.RingGeometry(Math.max(renderW,renderH)*0.55, Math.max(renderW,renderH)*0.62, 24);
            const ringMat = new THREE.MeshBasicMaterial({color: effectiveColor, transparent:true, opacity:0.35, side:THREE.DoubleSide});
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.set(cx, yOffset + (comp.side==='front'?0.008:-0.008), cz);
            ring.rotation.x = comp.side==='front'? -Math.PI/2 : Math.PI/2;
            grp.add(ring);
        }
        // 3D model if any
        if (hasModel) {
            // reuse placeGltfOnBoard logic but for edit3D group
            const url = resolveModelUrl(comp);
            loadGltfCached(url).then(gltf=>{
                if (grp.userData.hasModel) return;
                const src = gltf.scene.clone(true);
                const box = new THREE.Box3().setFromObject(src);
                if (!isFinite(box.min.x)) return;
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                src.position.sub(center);
                const footprint = Math.max(size.x, size.z) || 1;
                const rawTarget = Math.max(wWorld, hWorld)*0.88;
                const target = Math.max(rawTarget, 0.06);
                let scale = target / footprint;
                const mScale = parseFloat(comp.modelScale)||1;
                scale *= Math.max(0.1, Math.min(6,mScale));
                const rawH = size.y * scale;
                if (rawH>0.75) scale = 0.75/size.y*(mScale>1?mScale:1);
                if (rawH<0.04) scale = 0.04/size.y;
                src.scale.setScalar(scale);
                src.userData.compId = comp.id;
                src.userData._footprint = footprint;
                src.userData._rawTarget = rawTarget;
                src.userData._target = target;
                src.userData._origSize = size.clone();
                src.userData._origCenter = center.clone();
                src.userData._surfaceY = yOffset;
                src.userData._cx = cx;
                src.userData._cz = cz;
                src.userData._yOffset = yOffset;
                src.userData._lastMScale = mScale;
                src.userData._lastOffsetY = parseFloat(comp.modelOffsetY)||0;
                src.userData.baseScale = scale;
                const rotX = parseFloat(comp.modelRotX)||0, rotY=parseFloat(comp.modelRotY)||0, rotZ=parseFloat(comp.modelRotZ)||0;
                src.rotation.set(THREE.MathUtils.degToRad(rotX), THREE.MathUtils.degToRad(rotY), THREE.MathUtils.degToRad(rotZ));
                const box2 = new THREE.Box3().setFromObject(src);
                const h2 = box2.getSize(new THREE.Vector3()).y;
                const offY = parseFloat(comp.modelOffsetY)||0;
                const yPos = yOffset + (comp.side==='front'? h2/2+0.006+offY : -h2/2-0.006-offY);
                src.position.set(cx, yPos, cz);
                src.userData.basePosY = yPos;
                src.traverse(o=>{
                    if(o.isMesh){ o.castShadow=true; o.receiveShadow=true; if(o.material){ const mats=Array.isArray(o.material)?o.material.map(m=>m.clone()):[o.material.clone()]; o.material=Array.isArray(o.material)?mats:mats[0]; if(comp.color && o.material.color){ const t=new THREE.Color(comp.color); o.material.color.lerp(t,0.18); } } }
                });
                // ab — also add attachment points ON the 3D model top in edit 3D view
                try{
                    const wW = wWorld, hW = hWorld;
                    // FIX: convert world deltas to local (divide by scale) because sph is child of scaled src
                    const invEdit = src.scale.x ? 1/src.scale.x : 1;
                    (comp.attachmentPoints||[]).forEach(pt=>{
                        const isConn = Object.values(state.cableMap||{}).some(v=> v && v.componentId===comp.id && v.pointId===pt.id);
                        const sphGeo = new (THREE.SphereGeometry || THREE.SphereGeometry)(0.012, 10, 10);
                        // create material
                        const sphMat = new THREE.MeshStandardMaterial({color: isConn?0x0BE881:0xFFD54F, emissive: isConn?0x0BE881:0xFFC107, emissiveIntensity: isConn?0.80:0.60, roughness:0.32});
                        const sph = new THREE.Mesh(sphGeo, sphMat);
                        // compute local offsets within model footprint — FIX divide by scale
                        const lx = (pt.nx - 0.5) * wW * 0.92 * invEdit;
                        const lz = (pt.ny - 0.5) * hW * 0.92 * invEdit;
                        // top of model in local Y: after scaling, h2/2 approx; we can use 0.02 above model center — FIX local
                        const bbox = new THREE.Box3().setFromObject(src);
                        const mSize = bbox.getSize(new THREE.Vector3());
                        const topY = (mSize.y/2 + 0.012) * invEdit;
                        sph.position.set(lx, topY, lz);
                        sph.userData.compId = comp.id;
                        sph.userData.pointId = pt.id;
                        sph.userData.isAp = true;
                        sph.userData.isApOnModel = true;
                        src.add(sph);
                    });
                } catch(e){ console.warn('edit3D ap on model',e); }
                grp.add(src);
                grp.userData.hasModel=true;
            }).catch(()=>{});
        }
        // dim if not current side
        if (!isCurrentSide) {
            grp.traverse(o=>{ if(o.isMesh && o.material && o.material.opacity!==undefined){ o.material.opacity *= 0.5; }});
        }
        edit3D.compGroup.add(grp);
    });
}
function setEditViewMode(mode){
    state.editViewMode = mode;
    edit3DActiveId = null;
    if (edit2DBtn) edit2DBtn.classList.toggle('active', mode==='2d');
    if (edit3DBtn) edit3DBtn.classList.toggle('active', mode==='3d');
    const is3D = mode==='3d';
    if (editBoardStage) editBoardStage.style.display = is3D ? 'none' : 'inline-block';
    if (edit3DWrap) edit3DWrap.classList.toggle('hidden', !is3D);
    document.getElementById('zoomControls')?.classList.toggle('hidden', is3D);
    document.getElementById('panHint')?.classList.toggle('hidden', is3D);
    document.getElementById('editHint')?.classList.toggle('hidden', is3D);
    if (is3D) {
        if (!edit3D) initEdit3D();
        // load board
        const url = state.editSide==='front' ? state.frontUrl : state.backUrl;
        const front = state.frontUrl, back = state.backUrl;
        if (front) {
            if (edit3D) edit3D.setBoard(front, back);
        }
        setTimeout(()=>{ if(edit3D) edit3D.onResize(); refreshEdit3DMarkers(); }, 120);
        toast('حالت 3D — قطعات را روی برد ببین و جابجایی کن', 'info', '🧊');
    } else {
        renderEditRects();
        toast('حالت 2D — رسم دقیق', 'info', '✏️');
    }
}
if (edit2DBtn) edit2DBtn.addEventListener('click', ()=> setEditViewMode('2d'));
if (edit3DBtn) edit3DBtn.addEventListener('click', ()=> setEditViewMode('3d'));
if (detailView3DBtn) detailView3DBtn.addEventListener('click', async ()=>{
    if (!state.selectedRectId) return;
    const comp = state.components.find(c=>c.id===state.selectedRectId);
    if (comp) {
        saveDetailFromPanel(false);
        await saveComponentsToServer();
        renderEditRects(); refresh3DMarkers();
        const compId = comp.id;
        const hasModel = !!(comp.modelUrl||comp.modelId);
        toast(hasModel ? 'نمایش مدل سه‌بعدی روی برد' : 'مدلی متصل نیست — ابتدا .glb بارگذاری کنید','info', hasModel?'🧊':'⚠️');
        if (state.mode === 'edit') {
            await exitEditMode(true);
            const viewComp = state.components.find(x=>x.id===compId);
            if (viewComp) enterFocusMode(viewComp);
        } else {
            enterFocusMode(comp);
        }
    }
});
if (view3DModelBtn) view3DModelBtn.addEventListener('click', ()=>{
    const compId = view3DModelBtn.dataset.compId || state.sidebarSelectedId;
    const comp = state.components.find(c=>c.id===compId) || (state.sidebarSelectedId ? state.components.find(c=>c.id===state.sidebarSelectedId) : null);
    if (comp) {
        if (state.mode !== 'view') {
            exitEditMode(true).then(()=>{ enterFocusMode(comp); });
        } else {
            enterFocusMode(comp);
        }
    }
    else toast('قطعه‌ای انتخاب نشده','error','⚠️');
});
// Model viewer events
if (closeModelViewerBtn) closeModelViewerBtn.addEventListener('click', closeModelViewer);
if (modelViewerCloseBtn2) modelViewerCloseBtn2.addEventListener('click', closeModelViewer);
if (modelViewerSidebarBtn) modelViewerSidebarBtn.addEventListener('click', ()=>{
    const comp = state.components.find(c=>c.id===state.modelViewerCompId);
    if (comp) showSidebarDetail(comp);
});
if (modelViewerUploadBtn && modelViewerUploadInput) {
    modelViewerUploadBtn.addEventListener('click', ()=> modelViewerUploadInput.click());
    modelViewerUploadInput.addEventListener('change', async (e)=>{
        const f = e.target.files[0];
        if (!f) return;
        const model = await uploadModelFile(f, {type:'resistor'});
        if (model && state.modelViewerCompId) {
            const comp = state.components.find(c=>c.id===state.modelViewerCompId);
            if (comp) { comp.modelId=model.id; comp.modelUrl=model.glbUrl; saveComponentsToServer(); refreshDetailModelSelect(); openModelViewer(comp); }
        }
        e.target.value='';
    });
}
if (modelViewerOverlay) {
    const backdrop = modelViewerOverlay.querySelector('.model-viewer-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeModelViewer);
    // Esc to close model viewer or exit focus mode
    window.addEventListener('keydown', (e)=>{
        if (e.key==='Escape') {
            if (modelViewerOverlay && !modelViewerOverlay.classList.contains('hidden')) {
                e.preventDefault(); closeModelViewer();
                return;
            }
            if (state.focusedCompId) {
                e.preventDefault(); exitFocusMode();
            }
        }
    });
}

// Sidebar events
if (sidebarCollapseBtn) sidebarCollapseBtn.addEventListener('click', toggleSidebar);
if (sidebarToggleBtn) sidebarToggleBtn.addEventListener('click', toggleSidebar);
if (sidebarEditBtn) sidebarEditBtn.addEventListener('click', () => {
    const compId = sidebarEditBtn.dataset.compId;
    const comp = state.components.find(c=>c.id===compId);
    if (!comp) return;
    if (state.mode !== 'edit') enterEditMode();
    setTimeout(()=> {
        state.editSide = comp.side;
        updateEditImage();
        renderEditRects();
        selectRect(comp.id);
    }, 160);
});

// Canvas view
canvas.addEventListener('pointerdown', onCanvasPointerDown);
canvas.addEventListener('pointermove', onCanvasPointerMove);
canvas.addEventListener('click', onCanvasClick);
canvas.addEventListener('dblclick', onCanvasDoubleClick);
canvas.addEventListener('pointerup', onCanvasPointerUp);
if (focusBackBtn) focusBackBtn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); exitFocusMode(); });
if (focusView) focusView.addEventListener('dblclick', (e)=>{
    // double-click overlay background to return (per user request)
    if (e.target === focusView) exitFocusMode();
});


// Keyboard
window.addEventListener('keydown', (e) => {
    if (state.mode === 'edit') {
        if (e.target && (e.target.tagName==='INPUT' || e.target.tagName==='TEXTAREA' || e.target.tagName==='SELECT')) {
            if (e.key==='Escape') { e.target.blur(); }
            return;
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (state.selectedRectId && !detailPanel.contains(document.activeElement)) {
                e.preventDefault();
                deleteSelected();
            }
        }
        if (e.key === 'Escape') {
            if (state.isDrawing) { state.isDrawing=false; editPreviewRect.classList.add('hidden'); state.drawStart=null; }
            else if (state.isPanning) { state.isPanning=false; state.panStart=null; }
            else if (state.selectedRectId) {
                if (!detailPanel.classList.contains('hidden')) closeDetailPanel();
                else { state.selectedRectId=null; closeDetailPanel(); deleteSelectedBtn.classList.add('hidden'); renderEditRects(); }
            } else { exitEditMode(false); }
        }
        if (e.key === '+' || e.key === '=' ) { e.preventDefault(); zoomIn(); }
        if (e.key === '-' || e.key === '_' ) { e.preventDefault(); zoomOut(); }
        if (e.key === '0' && (e.ctrlKey||e.metaKey)) { e.preventDefault(); resetZoom(); }
        const map = ['resistor','capacitor','inductor','diode','transistor'];
        const idx = parseInt(e.key)-1;
        if (idx>=0 && idx<5 && !e.ctrlKey) selectPaletteType(map[idx]);
    } else if (state.mode === 'view') {
        if (e.key.toLowerCase() === 'e' && state.frontUrl) enterEditMode();
        if (e.key.toLowerCase() === 'f' && state.backUrl) flipBoardBtn.click();
        if (e.key === 'Escape') clearSidebarDetail();
    }
});

/* ---------- Initial load ---------- */
(async function initialLoad() {
    state.frontUrl = window.initialFrontImage || null;
    state.backUrl = window.initialBackImage || null;
    if (window.initialComponents && Array.isArray(window.initialComponents)) {
        state.components = window.initialComponents;
    } else {
        await fetchComponentsFromServer();
    }
    // aa — ensure attachment points exist for all loaded components
    ensureAllAttachmentPoints();
    if (window.initialCables && Array.isArray(window.initialCables)){
        state.cables = window.initialCables;
        state.cableMap = cablesToMap(state.cables);
    }
    // boards/models/theme
    state.models = window.initialModels || [];
    state.boards = window.initialBoards || {activeBoardId:'default', boards:[]};
    state.theme = window.initialTheme || {overall:'dark'};
    // init theme, boards, models
    await loadTheme();
    await loadBoards();
    await loadModels();
    try { initModelViewer(); } catch(e){ console.error('modelViewer init failed', e); }
    try { initCableSystem(); } catch(e){ console.error('cable system init failed', e); }
    // ensure cables from server if not in initial
    if (!state.cables.length) { try{ await loadCablesFromServer(); } catch{} } else { updateCableOverlay(); updateCableTestUI(); syncMultimeterCables(); }
    // Defer multimeter so board rebuild is never blocked — fire-and-forget
    setTimeout(() => { initSunshineMultimeterIfNeeded().catch(e=>console.warn('multimeter deferred init failed',e)); }, 400);
    updateSideUI();
    updateFilterCounts();
    if (state.frontUrl) {
        showLoading(true);
        showDropZone(false);
        try { await rebuildBoard(); } catch (err) { console.error(err); showDropZone(true); } finally { showLoading(false); }
    } else {
        showDropZone(true);
        showFlipButton(false);
        showSidebar(true);
    }
    // 2D bright: init multimeter immediately and force visible (not 400ms defer alone)
    try { await initSunshineMultimeterIfNeeded(); } catch(e){ console.warn('multimeter immediate init failed', e); }
    try { updateMultimeterVisibility(); } catch {}
    updateFlipButtonText();
    renderPalette();
    applyZoomTransform();
    clearSidebarDetail();
    // double ensure visible after all hides
    setTimeout(()=>{ try{ const s=document.getElementById('sidebar'); if(s) s.classList.remove('hidden'); const m=document.getElementById('multimeterSection'); if(m) m.classList.remove('hidden'); updateMultimeterVisibility(); }catch{} }, 600);
    // ensure detail model select populated
    refreshDetailModelSelect();
})();

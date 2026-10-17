// Sunshine DT-17N — 2D photoreal bright detailed replica (LIGHTWEIGHT OPTIMIZED, design preserved)
// Approved design at 782a892 kept 100% — only JS perf fixes to prevent crash on needle drag
export class SunshineDT17N {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.opts = opts;
    this.onModeChange = opts.onModeChange || (() => {});
    this.state = {
      dialIndex: 4,
      dialSubMode: 0,
      hold: false,
      rel: false,
      maxMin: 0,
      backlight: false,
      range: 'auto',
      hzMode: false,
      heldValue: null,
      relBase: null,
      powerOn: true,
      lowBatt: false,
    };
    this.DIAL_MODES = [
      { label: 'OFF', angleDeg: -150, mode: 'off', unit: '', select: ['off'], color: '#FF4D4D' },
      { label: 'V~', angleDeg: -120, mode: 'vac', unit: 'V', icon: 'V~', select: ['vac'], color: '#FFE082' },
      { label: 'V⎓', angleDeg: -90, mode: 'vdc', unit: 'V', icon: 'V⎓', select: ['vdc'], color: '#FFE082' },
      { label: 'mV⎓', angleDeg: -60, mode: 'mv', unit: 'mV', icon: 'mV', select: ['mv'], color: '#FFE082' },
      { label: 'Ω', angleDeg: -30, mode: 'ohm', unit: 'Ω', icon: 'Ω', select: ['ohm','diode','continuity','cap'], color: '#FFE082' },
      { label: 'Hz%', angleDeg: 0, mode: 'hz', unit: 'Hz', icon: 'Hz%', select: ['hz','duty'], color: '#81D4FA' },
      { label: 'A⎓', angleDeg: 30, mode: 'a', unit: 'A', icon: 'A', select: ['a_ac','a_dc'], color: '#FFCC80' },
      { label: 'mA⎓', angleDeg: 62, mode: 'ma', unit: 'mA', icon: 'mA', select: ['ma_ac','ma_dc'], color: '#FFCC80' },
      { label: 'µA⎓', angleDeg: 92, mode: 'ua', unit: 'µA', icon: 'µA', select: ['ua_ac','ua_dc'], color: '#FFCC80' },
      { label: '°C°F', angleDeg: 124, mode: 'temp', unit: '°C', icon: '°C', select: ['c','f'], color: '#80CBC4' },
      { label: 'NCV', angleDeg: 152, mode: 'ncv', unit: '', icon: 'NCV', select: ['ncv'], color: '#FF8A65' },
    ];
    this.JACKS = [
      { id: '10a', label: '10A', x: -0.32, color: '#E53935', desc: '10A MAX FUSED · 10sec', sub: 'MAX 10A' },
      { id: 'maua', label: 'mA µA', x: -0.11, color: '#E53935', desc: 'MAX 600mA FUSED', sub: '600mA' },
      { id: 'com', label: 'COM', x: 0.11, color: '#212121', desc: 'COMMON', sub: 'CAT III' },
      { id: 'vohm', label: 'VΩHz', x: 0.32, color: '#E53935', desc: 'MAX 1000V ⎓ 750V ~', sub: 'VΩHz' },
    ];
    this.BUTTONS = [
      { id: 'hold', label: 'HOLD', sub: '☀', color: '#2C3446' },
      { id: 'range', label: 'RANGE', color: '#2C3446' },
      { id: 'rela', label: 'REL Δ', color: '#2C3446' },
      { id: 'hz', label: 'Hz %', color: '#2C3446' },
      { id: 'select', label: 'SELECT', color: '#FF8F00', orange: true },
      { id: 'maxmin', label: 'MAX/MIN', color: '#2C3446' },
    ];
    this.currentComponent = null;
    this.measured = { value: 0, unit: '', text: '0.00', raw: 0, isOL: false, beep: false };
    this.audioCtx = null;
    this._els = {};
    this._rafVisual = null;
    this._rafMove = null;
    this._pulseTimer = null;
    this._lastSound = 0;
    this._drag = { active:false, startAng:0, startIdx:0, rect:null, latestAng:0 };
    // aa — cable system: jack → attachment point
    this.cableMap = {}; // jackId -> {componentId, pointId}
    this._cableComponents = []; // ref for lookup
    this._cableEnabled = false;
    this.init();
  }

  init() {
    try { if (this.canvas) this.canvas.style.display = 'none'; } catch {}
    const wrap = this.canvas ? this.canvas.parentElement : document.getElementById('multimeterWrap');
    if (!wrap) { console.warn('multimeter wrap not found'); return; }
    this.wrap = wrap;
    wrap.classList.add('dmm2d-wrap-host');
    let root = wrap.querySelector('.dmm2d');
    if (root) {
      this.root = root;
      // Fix 2+3: update static fallback if needed — correct radius & inject probe wires
      try{
        // update dial positions to r=120 if still at old 134 values
        const labels = root.querySelectorAll('.dmm2d-dial-label');
        if (labels.length===11) {
          const needsFix = labels[2] && (labels[2].style.getPropertyValue('--x').includes('-134') || labels[2].style.getPropertyValue('--x').includes('-120'));
          if (needsFix) {
            const coords = [[-47.50,82.27],[-82.27,47.50],[-95.00,-0.00],[-82.27,-47.50],[-47.50,-82.27],[0.00,-95.00],[47.50,-82.27],[83.88,-44.60],[94.95,3.32],[78.76,53.13],[44.60,83.88]];
            labels.forEach((el,i)=>{ if(coords[i]){ el.style.setProperty('--x', coords[i][0].toFixed(2)+'px'); el.style.setProperty('--y', coords[i][1].toFixed(2)+'px'); }});
          }
        }
        if (!root.querySelector('.dmm2d-probe-wires')) {
          const cat = root.querySelector('.dmm2d-cat');
          if (cat) cat.insertAdjacentHTML('beforebegin', '<div class="dmm2d-probe-wires"><div class="dmm2d-probe" data-wire="10a"><div class="dmm2d-wire-line"></div><div class="dmm2d-probe-handle"><span></span></div></div><div class="dmm2d-probe" data-wire="maua"><div class="dmm2d-wire-line"></div><div class="dmm2d-probe-handle"><span></span></div></div><div class="dmm2d-probe" data-wire="com"><div class="dmm2d-wire-line"></div><div class="dmm2d-probe-handle"><span></span></div></div><div class="dmm2d-probe" data-wire="vohm"><div class="dmm2d-wire-line"></div><div class="dmm2d-probe-handle"><span></span></div></div></div>');
        }
      }catch{}
    } else {
      root = document.createElement('div');
      root.className = 'dmm2d';
      root.dir = 'ltr';
      root.innerHTML = this.buildHTML();
      wrap.appendChild(root);
      this.root = root;
    }
    this.jackState = { '10a': false, 'maua': false, 'com': false, 'vohm': false }; // ac fix: start with no hanging wires — user must activate probe via jack/handle click per request
    this.cacheEls();
    this.attachEvents();
    this.syncJackVisual();
    this.updateDialVisual();
    this.updateDisplay();
    try {
      const sec = document.getElementById('multimeterSection');
      if (sec) sec.classList.remove('hidden');
      const sb = document.getElementById('sidebar');
      if (sb) { sb.classList.remove('hidden'); sb.style.display = ''; }
      if (sec) sec.style.display = '';
    } catch {}
    setTimeout(()=>{ try{ this.setComponent({type:'resistor', name:'R1', value:'10kΩ', description:'Preview'}); }catch{} }, 80);
  }

  buildHTML() {
    const dialLabels = this.DIAL_MODES.map((m, idx) => {
      const ang = m.angleDeg - 90;
      const rad = ang * Math.PI / 180;
      const r = 95;
      const x = Math.cos(rad) * r;
      const y = Math.sin(rad) * r;
      let sub = '';
      if (m.label === 'Ω') sub = '<span class="dmm2d-dial-sub">→ •))) &nbsp;-| |- &nbsp; ⊣</span>';
      else if (m.label === 'NCV') sub = '<span class="dmm2d-dial-sub">VoltAlert</span>';
      else if (m.label === 'OFF') sub = '';
      else sub = '';
      const cls = m.label === 'OFF' ? 'dmm2d-dial-label off' : 'dmm2d-dial-label';
      return `<button class="${cls}" data-idx="${idx}" style="--x:${x.toFixed(2)}px;--y:${y.toFixed(2)}px;" title="${m.label}">
        <span class="dmm2d-dial-t">${m.label}</span>${sub}
        <span class="dmm2d-dial-tick"></span>
      </button>`;
    }).join('');

    return `
    <div class="dmm2d-holster">
      <div class="dmm2d-holster-gloss"></div>
      <div class="dmm2d-body">
        <div class="dmm2d-header">
          <div class="dmm2d-brand-left">
            <span class="dmm2d-brand">SUNSHINE</span>
            <span class="dmm2d-model">DT-17N</span>
            <span class="dmm2d-badge">PRO</span>
          </div>
          <div class="dmm2d-brand-right">
            <span class="dmm2d-digital">DIGITAL</span>
            <span class="dmm2d-multimeter">MULTIMETER</span>
          </div>
        </div>
        <div class="dmm2d-lcd-block">
          <div class="dmm2d-lcd-frame">
            <div class="dmm2d-lcd" id="dmm2dLcd">
              <div class="dmm2d-lcd-top">
                <span class="dmm2d-lcd-icon" data-icon="apo">APO</span>
                <span class="dmm2d-lcd-icon" data-icon="auto">AUTO</span>
                <span class="dmm2d-lcd-icon" data-icon="rms">TRUE RMS</span>
                <span class="dmm2d-lcd-icon hl" data-icon="hold">HOLD</span>
                <span class="dmm2d-lcd-icon hl" data-icon="rel">Δ</span>
                <span class="dmm2d-lcd-icon hl" data-icon="max">MAX</span>
                <span class="dmm2d-lcd-icon hl" data-icon="min">MIN</span>
                <span class="dmm2d-lcd-icon hl" data-icon="hz">Hz</span>
                <span class="dmm2d-lcd-icon hl batt" data-icon="batt">🔋</span>
              </div>
              <div class="dmm2d-lcd-mid">
                <span class="dmm2d-lcd-value" id="dmm2dValue">----</span>
                <span class="dmm2d-lcd-unit" id="dmm2dUnit"></span>
              </div>
              <div class="dmm2d-lcd-bottom">
                <span id="dmm2dRange">AUTO RANGE</span>
                <span class="dmm2d-lcd-barcode">▮▮▮▮▮▮▮▮▯▯▯▯</span>
              </div>
              <div class="dmm2d-lcd-reflection"></div>
            </div>
          </div>
          <div class="dmm2d-lcd-hint">
            <span class="dmm2d-led" id="dmm2dLed"></span> 5999 Counts · 3/s · NCV
          </div>
        </div>
        <div class="dmm2d-buttons">
          <button class="dmm2d-btn" data-btn="hold"><span>HOLD</span><small>☀ long</small></button>
          <button class="dmm2d-btn" data-btn="range"><span>RANGE</span></button>
          <button class="dmm2d-btn" data-btn="rela"><span>REL</span><small>Δ</small></button>
          <button class="dmm2d-btn" data-btn="hz"><span>Hz %</span></button>
          <button class="dmm2d-btn orange" data-btn="select"><span>SELECT</span></button>
          <button class="dmm2d-btn" data-btn="maxmin"><span>MAX/MIN</span></button>
        </div>
        <div class="dmm2d-dial-area">
          <div class="dmm2d-dial-ring">
            <div class="dmm2d-dial-inner"></div>
            <div class="dmm2d-dial-labels">
              ${dialLabels}
            </div>
            <div class="dmm2d-knob" id="dmm2dKnob">
              <div class="dmm2d-knob-body">
                <div class="dmm2d-knob-grip"></div>
                <div class="dmm2d-knob-cap">
                  <div class="dmm2d-pointer-wrap">
                    <div class="dmm2d-pointer"></div>
                    <div class="dmm2d-pointer-tip"></div>
                  </div>
                  <div class="dmm2d-screw">
                    <span></span><span></span>
                  </div>
                </div>
              </div>
            </div>
            <div class="dmm2d-detents" id="dmm2dDetents"></div>
          </div>
          <div class="dmm2d-dial-footer">
            <span class="dmm2d-pwr">AUTO POWER OFF</span>
            <span class="dmm2d-rms-badge">TRUE RMS</span>
            <span class="dmm2d-ce">CE</span>
            <span class="dmm2d-warning-tri">⚠</span>
          </div>
        </div>
        <div class="dmm2d-jacks">
          <button class="dmm2d-jack" data-jack="10a">
            <span class="dmm2d-jack-hole"></span>
            <span class="dmm2d-jack-label">10A</span>
            <span class="dmm2d-jack-sub">10A MAX<br>FUSED</span>
          </button>
          <button class="dmm2d-jack" data-jack="maua">
            <span class="dmm2d-jack-hole"></span>
            <span class="dmm2d-jack-label">mA µA</span>
            <span class="dmm2d-jack-sub">600mA<br>FUSED</span>
          </button>
          <button class="dmm2d-jack com" data-jack="com">
            <span class="dmm2d-jack-hole"></span>
            <span class="dmm2d-jack-label">COM</span>
            <span class="dmm2d-jack-sub">COMMON</span>
          </button>
          <button class="dmm2d-jack" data-jack="vohm">
            <span class="dmm2d-jack-hole"></span>
            <span class="dmm2d-jack-label">VΩHz</span>
            <span class="dmm2d-jack-sub">1000V ⎓<br>750V ~</span>
          </button>
        </div>
        <div class="dmm2d-probe-wires">
          <div class="dmm2d-probe" data-wire="10a"><div class="dmm2d-wire-line"></div><div class="dmm2d-probe-handle"><span></span></div></div>
          <div class="dmm2d-probe" data-wire="maua"><div class="dmm2d-wire-line"></div><div class="dmm2d-probe-handle"><span></span></div></div>
          <div class="dmm2d-probe" data-wire="com"><div class="dmm2d-wire-line"></div><div class="dmm2d-probe-handle"><span></span></div></div>
          <div class="dmm2d-probe" data-wire="vohm"><div class="dmm2d-wire-line"></div><div class="dmm2d-probe-handle"><span></span></div></div>
        </div>
        <div class="dmm2d-cat">CAT III 1000V &nbsp; CAT IV 600V &nbsp; <span style="opacity:0.7">IEC 61010</span></div>
      </div>
      <div class="dmm2d-stand"></div>
    </div>
    `;
  }

  cacheEls() {
    const r = this.root;
    this._els.knob = r.querySelector('#dmm2dKnob');
    this._els.value = r.querySelector('#dmm2dValue');
    this._els.unit = r.querySelector('#dmm2dUnit');
    this._els.range = r.querySelector('#dmm2dRange');
    this._els.lcd = r.querySelector('#dmm2dLcd');
    this._els.led = r.querySelector('#dmm2dLed');
    this._els.labels = [...r.querySelectorAll('.dmm2d-dial-label')];
    this._els.infoMode = document.getElementById('multimeterModeLabel');
    this._els.outerLcdVal = document.getElementById('multimeterLcdValue');
    this._els.outerLcdUnit = document.getElementById('multimeterLcdUnit');
    this._els.probeLabel = document.getElementById('probeJackLabel');
    // ensure continuity/diode/cap icons exist — create if missing for discoverability
    const ensureIcon = (key, label) => {
      let el = r.querySelector(`[data-icon="${key}"]`);
      if (!el) {
        const top = r.querySelector('.dmm2d-lcd-top');
        if (top) {
          el = document.createElement('span');
          el.className='dmm2d-lcd-icon';
          el.dataset.icon=key;
          el.textContent=label;
          // insert before battery icon if present
          const batt = top.querySelector('[data-icon="batt"]');
          if (batt) top.insertBefore(el, batt);
          else top.appendChild(el);
        }
      }
      return el;
    };
    // pre-create so cache finds them; labels match real DT-17N LCD segments
    ensureIcon('cont','•)))');
    ensureIcon('diode','⊣');
    ensureIcon('cap','-||-');
    this._els.icons = {
      apo: r.querySelector('[data-icon="apo"]'),
      auto: r.querySelector('[data-icon="auto"]'),
      rms: r.querySelector('[data-icon="rms"]'),
      hold: r.querySelector('[data-icon="hold"]'),
      rel: r.querySelector('[data-icon="rel"]'),
      max: r.querySelector('[data-icon="max"]'),
      min: r.querySelector('[data-icon="min"]'),
      hz: r.querySelector('[data-icon="hz"]'),
      batt: r.querySelector('[data-icon="batt"]'),
      cont: r.querySelector('[data-icon="cont"]'),
      diode: r.querySelector('[data-icon="diode"]'),
      cap: r.querySelector('[data-icon="cap"]'),
    };
  }

  _scheduleVisual(){
    if (this._rafVisual) return;
    this._rafVisual = requestAnimationFrame(()=>{
      this._rafVisual=null;
      this.updateDialVisual();
      this.updateDisplay();
    });
  }

  attachEvents() {
    // Dial labels — lightweight click only, no animate API
    this._els.labels.forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        if (!isNaN(idx) && idx !== this.state.dialIndex) {
          this.state.dialIndex = idx;
          this.state.dialSubMode = 0;
          this._scheduleVisual();
          this.playClickSound(900, 0.04);
          // cheap pressed feedback via class
          btn.classList.add('pressed');
          setTimeout(()=>btn.classList.remove('pressed'), 110);
        }
      }, {passive:true});
    });

    // Knob drag — single ring pointer events with rAF, no window listeners
    const ring = this.root.querySelector('.dmm2d-dial-ring');
    const knob = this._els.knob;
    if (ring && knob) {
      const getAng = (clientX, clientY) => {
        const rect = this._drag.rect;
        if (!rect) return 0;
        const cx = rect.left + rect.width/2;
        const cy = rect.top + rect.height/2;
        const x = clientX - cx;
        const y = clientY - cy;
        return Math.atan2(y, x) * 180 / Math.PI + 90;
      };
      const onPointerDown = (e) => {
        // only left button / primary pointer
        if (e.button !== undefined && e.button !== 0) return;
        this._drag.active = true;
        this._drag.rect = ring.getBoundingClientRect();
        this._drag.startAng = getAng(e.clientX, e.clientY);
        this._drag.startIdx = this.state.dialIndex;
        this._drag.latestAng = this._drag.startAng;
        try { ring.setPointerCapture(e.pointerId); } catch {}
        // promote to GPU during drag
        knob.style.willChange = 'transform';
        e.preventDefault();
      };
      const processMove = () => {
        this._rafMove = null;
        if (!this._drag.active) return;
        let delta = this._drag.latestAng - this._drag.startAng;
        while (delta > 180) delta -= 360;
        while (delta < -180) delta += 360;
        const steps = Math.round(delta / 30);
        let idx = this._drag.startIdx + steps;
        idx = ((idx % this.DIAL_MODES.length) + this.DIAL_MODES.length) % this.DIAL_MODES.length;
        if (idx !== this.state.dialIndex) {
          this.state.dialIndex = idx;
          this.state.dialSubMode = 0;
          this._scheduleVisual();
          this.playClickSound(820, 0.03);
        }
      };
      const onPointerMove = (e) => {
        if (!this._drag.active) return;
        this._drag.latestAng = getAng(e.clientX, e.clientY);
        if (this._rafMove) return;
        this._rafMove = requestAnimationFrame(processMove);
      };
      const onPointerUp = (e) => {
        if (!this._drag.active) return;
        this._drag.active = false;
        this._drag.rect = null;
        if (this._rafMove) { cancelAnimationFrame(this._rafMove); this._rafMove=null; }
        knob.style.willChange = 'auto';
        try { ring.releasePointerCapture(e.pointerId); } catch {}
      };
      ring.addEventListener('pointerdown', onPointerDown, {passive:false});
      ring.addEventListener('pointermove', onPointerMove, {passive:true});
      ring.addEventListener('pointerup', onPointerUp, {passive:true});
      ring.addEventListener('pointercancel', onPointerUp, {passive:true});
      // fallback for browsers without pointer capture on touch
      ring.addEventListener('touchstart', (e)=>{
        if (e.touches[0]) {
          this._drag.active=true;
          this._drag.rect=ring.getBoundingClientRect();
          this._drag.startAng=getAng(e.touches[0].clientX, e.touches[0].clientY);
          this._drag.startIdx=this.state.dialIndex;
        }
      }, {passive:true});
      ring.addEventListener('touchmove', (e)=>{
        if (!this._drag.active || !e.touches[0]) return;
        this._drag.latestAng=getAng(e.touches[0].clientX, e.touches[0].clientY);
        if (this._rafMove) return;
        this._rafMove=requestAnimationFrame(processMove);
      }, {passive:true});
      ring.addEventListener('touchend', onPointerUp, {passive:true});
    }

    // Buttons — use click for most, pointerdown timer only for HOLD long-press
    this.root.querySelectorAll('.dmm2d-btn').forEach(btn => {
      const id = btn.dataset.btn;
      let pressTimer = null;
      let longFired = false;
      const clearTimer = ()=>{ if(pressTimer){ clearTimeout(pressTimer); pressTimer=null; } };
      if (id === 'hold') {
        btn.addEventListener('pointerdown', ()=>{
          longFired=false;
          pressTimer=setTimeout(()=>{
            longFired=true;
            this.state.backlight=!this.state.backlight;
            this.updateDisplay();
            this.showToast(this.state.backlight ? 'Backlight ON ☀' : 'Backlight OFF', 'info');
            if (this.state.backlight) setTimeout(()=>{ this.state.backlight=false; this.updateDisplay(); }, 12000);
            btn.classList.add('active');
            setTimeout(()=>btn.classList.remove('active'), 220);
          }, 640);
        }, {passive:true});
        btn.addEventListener('pointerup', (e)=>{
          clearTimer();
          if (longFired) { longFired=false; e.preventDefault(); return; }
          this.handleButtonPress(id);
          btn.classList.add('pressed'); setTimeout(()=>btn.classList.remove('pressed'), 120);
        }, {passive:true});
        btn.addEventListener('pointerleave', clearTimer, {passive:true});
        btn.addEventListener('pointercancel', clearTimer, {passive:true});
        // prevent click double after pointerup
        btn.addEventListener('click', (e)=>{ if(longFired) e.preventDefault(); }, {passive:false});
      } else {
        btn.addEventListener('click', (e)=>{
          e.preventDefault();
          this.handleButtonPress(id);
          btn.classList.add('pressed'); setTimeout(()=>btn.classList.remove('pressed'), 120);
        }, {passive:false});
      }
    });

    // Jacks — simple click
    this.root.querySelectorAll('.dmm2d-jack').forEach(j => {
      j.addEventListener('click', (e) => {
        e.preventDefault();
        const id = j.dataset.jack;
        this.handleJackClick(id);
        j.classList.add('pressed'); setTimeout(()=>j.classList.remove('pressed'), 110);
      }, {passive:false});
    });
  }

  handleButtonPress(id) {
    if (!this.state.powerOn && this.getCurrentDialMode().mode === 'off' && id !== 'select') return;
    const mode = this.getCurrentDialMode();
    switch (id) {
      case 'hold':
        this.state.hold = !this.state.hold;
        if (this.state.hold) this.state.heldValue = { ...this.measured };
        this.showToast(this.state.hold ? 'HOLD ●' : 'HOLD OFF', 'info');
        break;
      case 'range':
        if (mode.mode === 'off') break;
        this.state.range = this.state.range === 'auto' ? 'manual' : 'auto';
        this.showToast(this.state.range === 'auto' ? 'AUTO RANGE' : 'MANUAL', 'info');
        break;
      case 'rela':
        this.state.rel = !this.state.rel;
        this.state.relBase = this.state.rel ? this.measured.raw : null;
        this.showToast(this.state.rel ? 'REL Δ ON' : 'REL OFF', 'info');
        break;
      case 'hz':
        this.state.hzMode = !this.state.hzMode;
        this.showToast(this.state.hzMode ? 'Hz/DUTY' : 'Hz OFF', 'info');
        break;
      case 'select':
        const selects = mode.select;
        if (selects && selects.length > 1) {
          this.state.dialSubMode = (this.state.dialSubMode + 1) % selects.length;
          const cur = selects[this.state.dialSubMode];
          // descriptive hint for each submode, especially continuity beep
          let hint = cur.toUpperCase();
          if (cur==='continuity') hint='CONTINUITY •)))  — beep if <100Ω';
          else if (cur==='diode') hint='DIODE ⊣  — 0.7V forward, OL reverse';
          else if (cur==='ohm') hint='OHM Ω  — resistance';
          else if (cur==='cap') hint='CAP -||-  — capacitance in Farads';
          else if (cur==='vac') hint='V~ AC Voltage';
          else if (cur==='vdc') hint='V⎓ DC Voltage';
          this.showToast(`SELECT → ${hint}`, 'info');
          // flash continuity LED hint when entering continuity
          if (cur==='continuity') {
            try{ this.playBeep(); }catch{}
          }
        } else {
          this.state.hzMode = !this.state.hzMode;
          this.showToast(this.state.hzMode ? 'Hz/DUTY' : 'Hz OFF', 'info');
        }
        break;
      case 'maxmin':
        this.state.maxMin = (this.state.maxMin + 1) % 3;
        this.showToast(this.state.maxMin===0?'MAX/MIN OFF':this.state.maxMin===1?'MAX':'MIN', 'info');
        break;
    }
    this._scheduleVisual();
  }

  handleJackClick(id) {
    const was = !!this.jackState[id];
    if (id === 'com') {
      this.jackState.com = !this.jackState.com;
    } else {
      // only one red at a time; toggle target, clear others
      Object.keys(this.jackState).forEach(k=>{ if(k!=='com' && k!==id) this.jackState[k]=false; });
      this.jackState[id] = !this.jackState[id];
    }
    // sync cableMap: if jack was unplugged (was->false), clear its cableMap entry so LEAd/OL reflects reality
    if (was) {
      if (this.cableMap && this.cableMap[id]) {
        delete this.cableMap[id];
        // if cableMap had only this jack, _cableEnabled will update via setCableMap path? we update directly
        this._cableEnabled = Object.keys(this.cableMap).some(k=> this.cableMap[k]);
        // also need to inform outer system to clear path — emit via onCableDisconnect callback if present
        if (this.onCableChange) try{ this.onCableChange({...this.cableMap}); }catch{}
      }
    }
    // if new red selected, ensure only one red in cableMap: prune other reds to avoid dual-wire glitch
    if (!was && id!=='com') {
      const otherReds = ['10a','maua','vohm'].filter(k=>k!==id);
      let changed=false;
      otherReds.forEach(k=>{ if(this.cableMap[k]){ delete this.cableMap[k]; changed=true; }});
      if (changed) this._cableEnabled = Object.keys(this.cableMap).some(k=> this.cableMap[k]);
    }
    this.syncJackVisual();
    this.updateDisplay();
    const dialMode = this.getCurrentDialMode().mode;
    const redJack = Object.entries(this.jackState||{}).find(([k,v])=>v && k!=='com')?.[0] || 'vohm';
    let warn = false;
    if (dialMode === 'a' && redJack !== '10a') warn = true;
    else if ((dialMode === 'ma' || dialMode === 'ua') && redJack !== 'maua') warn = true;
    else if (['vac','vdc','mv','ohm','hz','temp','ncv'].includes(dialMode) && redJack && redJack !== 'vohm') warn = true;
    this.showJackWarning(warn);
    this.playClickSound(800, 0.03);
  }

  syncJackVisual() {
    this.root.querySelectorAll('.dmm2d-jack').forEach(j=>{
      const id = j.dataset.jack;
      j.classList.toggle('plugged', !!this.jackState[id]);
    });
    // probe wires follow jack state — lightweight
    try{
      this.root.querySelectorAll('.dmm2d-probe').forEach(p=>{
        const id = p.dataset.wire;
        p.classList.toggle('plugged', !!this.jackState[id]);
      });
    }catch{}
    if (this._els.probeLabel) {
      const redJack = Object.entries(this.jackState||{}).find(([k,v])=>v && k!=='com')?.[0] || 'vohm';
      const labelMap = { '10a':'10A','maua':'mA µA','vohm':'VΩHz','com':'COM' };
      this._els.probeLabel.textContent = `COM + ${labelMap[redJack]||'VΩHz'}`;
    } else {
      const redJack = Object.entries(this.jackState||{}).find(([k,v])=>v && k!=='com')?.[0] || 'vohm';
      const labelMap = { '10a':'10A','maua':'mA µA','vohm':'VΩHz','com':'COM' };
      const el = document.getElementById('probeJackLabel');
      if (el) el.textContent = `COM + ${labelMap[redJack]||'VΩHz'}`;
    }
  }

  showJackWarning(show) {
    const el = document.getElementById('multimeterJackHint');
    if (!el) return;
    if (show) { el.classList.remove('hidden'); setTimeout(()=>el.classList.add('hidden'), 2200); }
    else el.classList.add('hidden');
    if (show) {
      const hint = this.root.querySelector('.dmm2d-jacks');
      if (hint) { hint.classList.add('warn'); setTimeout(()=>hint.classList.remove('warn'), 850); }
    }
  }

  showToast(msg, type) { if (this.opts.toast) this.opts.toast(msg, type); }

  togglePower() {
    this.state.powerOn = !this.state.powerOn;
    if (!this.state.powerOn) {
      this.stopContinuousBeep();
      this.showToast('Power OFF', 'info');
    } else {
      this.showToast('Power ON', 'success');
    }
    const dot = document.getElementById('multimeterStatusDot');
    if (dot) dot.classList.toggle('off', !this.state.powerOn);
    this.updateDisplay();
  }

  playClickSound(freq=900, vol=0.04, dur=0.04){
    const now = performance.now();
    if (now - this._lastSound < 80) return;
    this._lastSound = now;
    try{
      if (!this.audioCtx) this.audioCtx = new (window.AudioContext||window.webkitAudioContext)();
      if (this.audioCtx.state==='suspended') this.audioCtx.resume().catch(()=>{});
      const o=this.audioCtx.createOscillator(), g=this.audioCtx.createGain();
      o.frequency.value=freq; o.type='square'; g.gain.value=vol;
      o.connect(g).connect(this.audioCtx.destination); o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime+dur);
      o.stop(this.audioCtx.currentTime+dur);
    }catch{}
  }
  playBeep(){ this.playClickSound(1850,0.09,0.12); setTimeout(()=>this.playClickSound(1850,0.09,0.12),170); }
  // continuous beep for continuity — persists until probes disconnect / condition false
  startContinuousBeep(){
    if (this._beepPlaying) return;
    try{
      if (!this.audioCtx) this.audioCtx = new (window.AudioContext||window.webkitAudioContext)();
      if (this.audioCtx.state==='suspended') this.audioCtx.resume().catch(()=>{});
      const o=this.audioCtx.createOscillator();
      const g=this.audioCtx.createGain();
      o.type='square';
      o.frequency.value=1850;
      g.gain.value=0.10;
      o.connect(g).connect(this.audioCtx.destination);
      o.start();
      this._beepOsc=o;
      this._beepGain=g;
      this._beepPlaying=true;
    } catch(e){}
  }
  stopContinuousBeep(){
    if (!this._beepPlaying) return;
    try{
      if (this._beepGain) {
        try{ this._beepGain.gain.linearRampToValueAtTime(0.0001, this.audioCtx.currentTime+0.04); }catch{}
      }
      if (this._beepOsc){
        try{ this._beepOsc.stop(this.audioCtx.currentTime+0.05); }catch{}
        try{ this._beepOsc.disconnect(); }catch{}
      }
      if (this._beepGain) try{ this._beepGain.disconnect(); }catch{}
    }catch{}
    this._beepPlaying=false;
    this._beepOsc=null;
    this._beepGain=null;
  }

  getCurrentDialMode(){
    const base = this.DIAL_MODES[this.state.dialIndex];
    const sub = base.select[this.state.dialSubMode] || base.select[0];
    let mode = base.mode;
    if (base.mode==='ohm'){
      if (sub==='diode') mode='diode';
      else if (sub==='continuity') mode='continuity';
      else if (sub==='cap') mode='cap';
      else mode='ohm';
    } else if (['vac','vdc','mv'].includes(base.mode) && sub && sub!==base.mode) mode=sub;
    if (this.state.hzMode && ['vac','vdc','ohm','a','ma','ua'].includes(mode)) return {...base, mode:'hz', unit:'Hz'};
    return {...base, mode, sub};
  }

  updateDialVisual(){
    const mode = this.DIAL_MODES[this.state.dialIndex];
    const angle = mode.angleDeg;
    if (this._els.knob) {
      this._els.knob.style.transform = `rotate(${angle}deg) translateZ(0)`;
    }
    this._els.labels.forEach(l=>{
      const idx = parseInt(l.dataset.idx,10);
      const sel = idx===this.state.dialIndex;
      if (l.classList.contains('selected') !== sel) l.classList.toggle('selected', sel);
      // when Ω is selected, highlight the active sub (ohm/diode/cont/cap) inside its sub text
      if (idx===4) {
        const cur = this.getCurrentDialMode();
        // store active sub as data attribute for CSS to highlight
        l.dataset.activeSub = sel ? (cur.sub||cur.mode) : '';
        // add helper tooltip for discoverability
        if (sel) {
          const hintMap = {ohm:'Ω resistance',diode:'Diode ⊣',continuity:'CONT •))) beep',cap:'CAP -||-'};
          l.title = `Ω → ${hintMap[cur.sub]||hintMap[cur.mode]||cur.mode} — press SELECT to cycle`;
        }
      }
    });
    this.updateLCDIcons();
    if (this.onModeChange) {
      // throttle onModeChange too (already via _scheduleVisual batch)
      try { this.onModeChange(mode); } catch {}
    }
    // outer mode label — cached, only update if changed
    const infoMode = this._els.infoMode || document.getElementById('multimeterModeLabel');
    if (infoMode){
      if (!this._els.infoMode) this._els.infoMode = infoMode;
      const m = this.getCurrentDialMode();
      const subTxt = m.sub && m.sub!==m.mode ? `(${m.sub})` : '';
      const txt = `${mode.label} → ${m.mode.toUpperCase()} ${subTxt}`;
      if (infoMode.textContent !== txt) {
        infoMode.textContent = txt;
        infoMode.style.background = mode.color ? `${mode.color}22` : 'rgba(77,208,255,0.16)';
        infoMode.style.borderColor = mode.color ? `${mode.color}66` : 'rgba(77,208,255,0.35)';
        infoMode.style.color = mode.label==='OFF' ? '#FF6B6B' : '#E6F0FF';
      }
    }
    if (this._els.knob) {
      this._els.knob.classList.add('pulse');
      clearTimeout(this._pulseTimer);
      this._pulseTimer = setTimeout(()=>{ try{ this._els.knob.classList.remove('pulse'); }catch{} }, 160);
    }
  }

  updateLCDIcons(){
    const flags = this.getLCDFlags();
    const set = (key, show) => {
      const el = this._els.icons[key];
      if (el) {
        el.classList.toggle('on', !!show);
        // highlight continuity/diode/cap with subtle glow when active
        if (['cont','diode','cap'].includes(key)) {
          el.classList.toggle('active-mode', !!show);
        }
      }
    };
    set('hold', flags.hold);
    set('rel', flags.rel);
    set('max', flags.max);
    set('min', flags.min);
    set('auto', flags.auto);
    set('cont', flags.cont);
    set('diode', flags.diode);
    set('cap', flags.cap);
    if (this._els.icons.apo) this._els.icons.apo.classList.toggle('on', this.state.powerOn && flags.ap);
    if (this._els.icons.rms) this._els.icons.rms.classList.toggle('on', true);
    if (this._els.icons.hz) this._els.icons.hz.classList.toggle('on', flags.hz);
    if (this._els.icons.batt) this._els.icons.batt.classList.toggle('on', flags.lowBatt);
    if (this._els.lcd) {
      this._els.lcd.classList.toggle('off', !this.state.powerOn || this.getCurrentDialMode().mode==='off');
      this._els.lcd.classList.toggle('backlight', !!this.state.backlight);
      // add continuity active class to LCD for red glow
      const m = this.getCurrentDialMode();
      this._els.lcd.classList.toggle('mode-cont', m.mode==='continuity');
      this._els.lcd.classList.toggle('mode-diode', m.mode==='diode');
      this._els.lcd.classList.toggle('mode-cap', m.mode==='cap');
    }
    // also toggle outer continuity LED
    try{
      const led = document.getElementById('multimeterContinuityLed');
      if (led) led.classList.toggle('on', flags.cont);
    }catch{}
  }

  getLCDFlags(){
    const m = this.getCurrentDialMode().mode;
    return {
      hold: this.state.hold,
      rel: this.state.rel,
      max: this.state.maxMin===1,
      min: this.state.maxMin===2,
      auto: this.state.range==='auto',
      trueRms: true,
      ap: true,
      hz: this.state.hzMode,
      lowBatt: this.state.lowBatt,
      cont: m==='continuity',
      diode: m==='diode',
      cap: m==='cap'
    };
  }

  setComponent(comp){
    this.currentComponent = comp;
    const label = document.getElementById('multimeterComponentLabel');
    if (label && comp){
      const def = {resistor:'Resistor',capacitor:'Capacitor',inductor:'Inductor',diode:'Diode',transistor:'Transistor'}[comp.type]||comp.type;
      label.textContent = `${def} ${comp.name||''} ${comp.value||''}`.trim();
    } else if (label) label.textContent='';
    this.updateDisplay();
  }

  parseValue(str){
    if (!str) return null;
    const s = str.trim().toLowerCase().replace('Ω','ohm').replace('Ω','ohm');
    const m = s.match(/^([\d.]+)\s*([pnumkkmgt]?)(.*)$/);
    if (!m) return null;
    let num = parseFloat(m[1]);
    if (isNaN(num)) return null;
    const pref=m[2];
    const mult={ 'p':1e-12,'n':1e-9,'u':1e-6,'µ':1e-6,'m':1e-3,'k':1e3,'K':1e3,'M':1e6,'G':1e9,'T':1e12 }[pref]||1;
    return num*mult;
  }

  formatValue(val, unit){
    if (val===null || !isFinite(val)) return {text:'OL', unit};
    const abs=Math.abs(val);
    let scaled=val; let prefix='';
    if (unit==='Ω'){
      if (abs>=1e6){ scaled=val/1e6; prefix='M'; }
      else if (abs>=1e3){ scaled=val/1e3; prefix='k'; }
    } else if (unit==='F'){
      if (abs>=1e-3){ scaled=val*1e3; prefix='m'; unit='F'; }
      else if (abs>=1e-6){ scaled=val*1e6; prefix='µ'; }
      else if (abs>=1e-9){ scaled=val*1e9; prefix='n'; }
      else { scaled=val*1e12; prefix='p'; }
    } else if (unit==='H'){
      if (abs>=1){ prefix=''; }
      else if (abs>=1e-3){ scaled=val*1e3; prefix='m'; }
      else { scaled=val*1e6; prefix='µ'; }
    } else if (unit==='V' || unit==='A'){
      if (abs>=1) prefix='';
      else if (abs>=1e-3){ scaled=val*1e3; prefix='m'; }
      else { scaled=val*1e6; prefix='µ'; }
    } else if (unit==='Hz'){
      if (abs>=1e6){ scaled=val/1e6; prefix='M'; }
      else if (abs>=1e3){ scaled=val/1e3; prefix='k'; }
    }
    let text;
    const absScaled=Math.abs(scaled);
    if (absScaled>=1000) text=scaled.toFixed(0);
    else if (absScaled>=100) text=scaled.toFixed(1);
    else if (absScaled>=10) text=scaled.toFixed(2);
    else text=scaled.toFixed(3);
    return {text, unit: prefix+unit};
  }

  setCableMap(map, componentsList){
    this.cableMap = map ? {...map} : {};
    this._cableComponents = Array.isArray(componentsList) ? componentsList : this._cableComponents;
    this._cableEnabled = Object.keys(this.cableMap).some(k=> this.cableMap[k]);
    // sync jack visual to match cableMap — engaging: auto-plug jacks that have cables
    try{
      const hasCom = !!this.cableMap['com'];
      const hasVohm = !!this.cableMap['vohm'];
      const has10a = !!this.cableMap['10a'];
      const hasMaua = !!this.cableMap['maua'];
      if (hasCom || hasVohm || has10a || hasMaua){
        // if any cable present, reflect plugged state
        this.jackState['com'] = hasCom;
        // for red jacks, only the one(s) in map should be considered plugged; if multiple, keep first but set all accordingly
        const redInMap = ['10a','maua','vohm'].filter(j=> this.cableMap[j]);
        if (redInMap.length){
          // set exactly those as plugged, others off
          ['10a','maua','vohm'].forEach(j=> this.jackState[j] = redInMap.includes(j));
        }
        // if no red in map, leave red jacks as-is (do not force vohm) — keep user choice; only show plugged for those in map
        // previously forced vohm true when only COM present, causing mismatch (jack shows plugged but cable missing -> OL confusion)
        // now: if no red in map, keep existing jackState for reds, but ensure at least visual hint does not fake connection
        try{ this.syncJackVisual(); } catch{}
      }
    } catch{}
    this.updateDisplay();
  }
  getCableConnectedComponent(){
    if (!this._cableEnabled || !this._cableComponents.length) return null;
    // determine required jacks for current dial mode
    const dial = this.getCurrentDialMode();
    const mode = dial.mode;
    let needed = null;
    if (mode==='a') needed = ['com','10a'];
    else if (mode==='ma' || mode==='ua') needed = ['com','maua'];
    else if (['vac','vdc','mv','ohm','continuity','diode','cap','hz','temp','ncv'].includes(mode)) needed = ['com','vohm'];
    else needed = ['com','vohm'];
    if (!needed) return this.currentComponent;
    const a = this.cableMap[needed[0]];
    const b = this.cableMap[needed[1]];
    if (!a || !b) return null; // need both connected for valid test
    if (a.componentId !== b.componentId) return null; // must be same object
    if (a.pointId === b.pointId) return null; // distinct points
    const comp = this._cableComponents.find(c=>c.id===a.componentId);
    if (!comp) return null;
    // verify points exist on that component
    const pts = comp.attachmentPoints || [];
    if (pts.length){
      const hasA = pts.some(p=>p.id===a.pointId);
      const hasB = pts.some(p=>p.id===b.pointId);
      if (!hasA || !hasB) return null;
    }
    return comp;
  }
  getJackScreenPos(jackId){
    try{
      const el = this.root ? this.root.querySelector(`.dmm2d-jack[data-jack="${jackId}"] .dmm2d-jack-hole`) : null;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width/2, y: r.top + r.height/2 };
    } catch { return null; }
  }

  getMeasurement(){
    // ab — precise per-component testing with continuity, faulty & tolerance handling
    let compForMeas = this.currentComponent;
    // resolve cabled component and point pair if cable system active
    let redPoint = null, blackPoint = null;
    let cabledComp = null;
    if (this._cableEnabled){
      const cabled = this.getCableConnectedComponent();
      if (cabled){
        cabledComp = cabled;
        compForMeas = cabled;
        // identify red/black points for polarity-sensitive tests (diode/transistor)
        try{
          const dialTmp2 = this.getCurrentDialMode();
          let needed = null;
          if (dialTmp2.mode==='a') needed=['com','10a'];
          else if (dialTmp2.mode==='ma' || dialTmp2.mode==='ua') needed=['com','maua'];
          else needed=['com','vohm'];
          const a = this.cableMap[needed[0]]; const b = this.cableMap[needed[1]];
          if (a && b && a.componentId===b.componentId){
            const pts = (cabled.attachmentPoints||[]);
            blackPoint = pts.find(p=>p.id===a.pointId) || null;
            redPoint = pts.find(p=>p.id===b.pointId) || null;
          }
        }catch{}
      } else {
        const hasAnyCable = Object.keys(this.cableMap).some(k=> this.cableMap[k]);
        if (hasAnyCable){
          const dialTmp = this.getCurrentDialMode();
          if (['ohm','continuity','diode','cap','vac','vdc','mv','hz','a','ma','ua','temp'].includes(dialTmp.mode)){
            return {text:'LEAd', unit:'', isOL:false, beep:false, raw:0};
          }
        } else {
          compForMeas = null;
        }
      }
    }
    if (!compForMeas || !this.state.powerOn){
      if (!this.state.powerOn) return {text:'', unit:'', isOL:false, beep:false, raw:0};
      return {text:'----', unit:'', isOL:false, beep:false, raw:0};
    }
    const comp=compForMeas;
    const dial=this.getCurrentDialMode();
    const mode=dial.mode;
    const type=comp.type;
    const redJack = Object.entries(this.jackState||{}).find(([k,v])=>v && k!=='com')?.[0] || 'vohm';
    const hasCom = this.jackState?.com;
    if (!hasCom) return {text:'LEAd', unit:'', isOL:false, beep:false, raw:0};
    if (mode==='off') return {text:'', unit:'', isOL:false, beep:false, raw:0};
    if (mode==='ncv') return {text:'EF', unit:'', isOL:false, beep:false, raw:0};
    let val=null; let unit=''; let isOL=false; let beep=false;
    const parsed=this.parseValue(comp.value||'');
    // FIX: tolerance may be "5%" string -> parseFloat correctly; was Number("5%")==NaN causing OL for all resistors
    let tolerance = 5;
    if (comp.tolerance!=null && comp.tolerance!=='') {
      const mt = String(comp.tolerance).match(/[\d.]+/);
      if (mt) tolerance = parseFloat(mt[0]);
      else {
        const n = Number(comp.tolerance);
        if (isFinite(n)) tolerance = n;
      }
    }
    const isFaulty = !!comp.isFaulty;
    // helper to apply tolerance jitter within spec: e.g., 10k ±5% → 9.5k-10.5k plus tiny noise
    const applyTolerance = (nominal)=>{
      if (nominal===null || !isFinite(nominal)) return nominal;
      const tol = Math.max(0, Math.min(20, tolerance))/100;
      const drift = (Math.random()*2-1) * tol * 0.9; // stay within tolerance
      const noise = (Math.random()-0.5)*0.003;
      return nominal * (1 + drift + noise);
    };
    // diode polarity helper: determine if forward direction (red->anode, black->cathode)
    const isDiodeForward = ()=>{
      if (!redPoint || !blackPoint) return true; // if not using point specifics, assume forward for single diode test
      const rL = (redPoint.label||'').toUpperCase();
      const bL = (blackPoint.label||'').toUpperCase();
      // common labeling: A/K or A/C, but fallback to positional order: smaller nx = A
      let redIsAnode=null, blackIsAnode=null;
      if (rL.includes('A')) redIsAnode=true;
      else if (rL.includes('K')||rL.includes('C')) redIsAnode=false;
      if (bL.includes('A')) blackIsAnode=true;
      else if (bL.includes('K')||bL.includes('C')) blackIsAnode=false;
      if (redIsAnode!==null && blackIsAnode!==null){
        return redIsAnode && !blackIsAnode;
      }
      // positional fallback: anode is left/top (smaller nx or ny)
      // FIX: anode is left (smallest nx). Forward = red on anode (small) & black on cathode (large) => red < black = forward (0.5V), else OL
      if (redPoint.nx!=null && blackPoint.nx!=null){
        // if red is smallest, it's forward; if red larger, it's reverse (OL)
        const redIsSmallest = redPoint.nx < blackPoint.nx;
        return redIsSmallest;
      }
      // if ambiguous (no nx), use point index ordering: first point (usually A) is anode
      const pts = comp.attachmentPoints||[];
      const idxR = pts.findIndex(p=>p.id===redPoint.id);
      const idxB = pts.findIndex(p=>p.id===blackPoint.id);
      return idxR < idxB; // arbitrary fallback
    };
    // Transistor helper: identify roles of points (E/B/C) based on labels
    const getTransistorRoles = ()=>{
      if (!redPoint || !blackPoint) return null;
      const mapLabel = (lbl)=>{
        const u=(lbl||'').toUpperCase();
        if (u.includes('B')) return 'B';
        if (u.includes('E')) return 'E';
        if (u.includes('C')) return 'C';
        return null;
      };
      let rRole = mapLabel(redPoint.label);
      let bRole = mapLabel(blackPoint.label);
      if (!rRole || !bRole){
        // fallback by position: B is middle (0.5 nx), E is 0.18, C is 0.82
        const pts = comp.attachmentPoints||[];
        // sort by nx to deduce E/B/C order
        const sorted = [...pts].sort((a,b)=> (a.nx||0)-(b.nx||0));
        // assume sorted[0]=E, sorted[1]=B, sorted[2]=C
        const roleById = {};
        if (sorted[0]) roleById[sorted[0].id]='E';
        if (sorted[1]) roleById[sorted[1].id]='B';
        if (sorted[2]) roleById[sorted[2].id]='C';
        rRole = roleById[redPoint.id] || rRole;
        bRole = roleById[blackPoint.id] || bRole;
      }
      return {rRole, bRole};
    };
    // Faulty handling: if isFaulty, many readings become OL or incorrect
    if (isFaulty){
      if (['ohm','continuity','diode','cap'].includes(mode)){
        // For faulty, show OL for most types except resistor short etc. Randomize
        const faultyKind = (comp.type==='resistor' ? 'open' : comp.type==='capacitor' ? 'leaky' : comp.type==='diode' ? 'short' : 'open');
        if (mode==='ohm' && type==='resistor'){
          // open resistor shows OL
          return {text:'OL', unit: dial.unit||'Ω', isOL:true, beep:false, raw:0};
        }
        if (mode==='cap' && type==='capacitor'){
          return {text:'OL', unit:'F', isOL:true, beep:false, raw:0};
        }
        if (mode==='diode' && (type==='diode' || type==='transistor')){
          // faulty diode shows 0V or OL both ways (stuck)
          return {text:'OL', unit:'V', isOL:true, beep:false, raw:0};
        }
        if (mode==='continuity'){
          if (type==='capacitor'){
            // Faulty capacitor in continuity = shorted → continuous beep, low resistance (user: continuous = faulty)
            // Healthy capacitor momentary handled later; faulty must beep continuously until disconnect
            return {text:'0.8', unit:'Ω', isOL:false, beep:true, raw:0.8};
          }
          // faulty continuity: no beep, OL
          return {text:'OL', unit:'Ω', isOL:true, beep:false, raw:0};
        }
      }
    }

    // Precise per-mode/type logic
    if (mode==='ohm'){
      if (type==='resistor'){
        if (parsed===null) { val=10000; unit='Ω'; }
        else { val=applyTolerance(parsed); unit='Ω'; }
        // no beep in ohm mode
        beep=false;
      } else if (type==='inductor'){
        // Inductor DC resistance is low (wire), not inductance value
        // If value is henry, convert to low ohms heuristic: e.g., 100uH ~ 2Ω
        let baseOhms = 1.5;
        if (parsed!==null){
          // if parsed is large henry (>0.001), assume low ohms else parse as ohms if value string contains 'Ω'
          const s=(comp.value||'').toString().toLowerCase();
          if (s.includes('ohm')||s.includes('Ω')||s.includes('ω')) baseOhms=applyTolerance(parsed);
          else baseOhms = 0.8 + Math.random()*1.2; // wire resistance
        }
        val=baseOhms; unit='Ω'; beep=false;
      } else if (type==='capacitor' || type==='diode' || type==='transistor'){
        isOL=true;
      } else isOL=true;
    } else if (mode==='continuity'){
      // Continuity: beep on low resistance / forward diode; silent otherwise then advise switch to relevant mode
      if (type==='resistor'){
        const nominal = parsed!==null ? parsed : 100;
        if (nominal < 100){
          val=applyTolerance(nominal); unit='Ω'; beep=true; isOL=false;
        } else {
          // high resistor shows OL in continuity (no beep), user should switch to ohms
          isOL=true; beep=false;
        }
      } else if (type==='inductor'){
        // inductor is continuous short → always beep
        val= 0.8 + Math.random()*0.6; unit='Ω'; beep=true; isOL=false;
      } else if (type==='capacitor'){
        // capacitor continuity: brief momentary beep if functional (good), then OL — NOT continuous (per final user request point 3)
        // Functional cap charges → short beep, then OL display; faulty handled earlier
        isOL=true; beep=true; unit='Ω';
        // momentary beep logic: only beep on first reading, then silent until next connection
        if (!this._capBeepDone) { beep=true; this._capBeepDone=true; setTimeout(()=>{ this._capBeepDone=false; this.updateDisplay(); }, 420); }
        else beep=false;
        if (isOL) return {text:'OL', unit:'Ω', isOL:true, beep:beep, raw:0};
      } else if (type==='diode'){
        const forward = isDiodeForward();
        if (forward){
          // forward continuity: low resistance + beep one way
          val= 22 + Math.random()*8; unit='Ω'; beep=true; isOL=false;
        } else {
          isOL=true; beep=false;
        }
      } else if (type==='transistor'){
        const roles = getTransistorRoles();
        const tType = (comp.transistorType||'NPN').toUpperCase();
        if (roles){
          const {rRole,bRole}=roles;
          const isBaseInvolved = (rRole==='B' || bRole==='B');
          const isEC = ( (rRole==='E' && bRole==='C') || (rRole==='C' && bRole==='E') );
          if (isEC){ isOL=true; beep=false; }
          else if (isBaseInvolved){
            // continuity can identify base: forward junction beeps
            const redIsBase = rRole==='B';
            const blackIsBase = bRole==='B';
            let forward=false;
            if (tType==='NPN') forward = redIsBase;
            else forward = blackIsBase;
            if (forward){ val= 18 + Math.random()*6; unit='Ω'; beep=true; isOL=false; }
            else { isOL=true; beep=false; }
          } else { isOL=true; beep=false; }
        } else {
          isOL=true; beep=false;
        }
      } else isOL=true;
      // for continuity, if OL we return OL but keep beep flag as decided
      if (isOL) {
        // beep already decided per type; for resistor high and inductor/capacitor etc handled above
        return {text:'OL', unit: dial.unit||'Ω', isOL:true, beep: beep, raw:0};
      }
    } else if (mode==='diode'){
      if (type==='diode'){
        const forward = isDiodeForward();
        if (forward){
          // forward voltage 0.60-0.72 depending on type (silicon)
          val= 0.62 + Math.random()*0.07; unit='V'; isOL=false; beep=false;
        } else {
          isOL=true; beep=false;
        }
      } else if (type==='transistor'){
        const roles = getTransistorRoles();
        const tType = (comp.transistorType||'NPN').toUpperCase();
        if (!roles){ isOL=true; }
        else {
          const {rRole,bRole}=roles;
          const isBaseInvolved = (rRole==='B' || bRole==='B');
          const isEC = ( (rRole==='E' && bRole==='C') || (rRole==='C' && bRole==='E') );
          if (isEC){ isOL=true; }
          else if (isBaseInvolved){
            const redIsBase = rRole==='B';
            const blackIsBase = bRole==='B';
            let forward = false;
            if (tType==='NPN') forward = redIsBase;
            else forward = blackIsBase;
            if (forward){
              // distinguish emitter vs collector: E higher reading than C (spec: higher reading emitter lower collector)
              let isEmitter = false;
              if (redIsBase) isEmitter = (bRole==='E');
              else isEmitter = (rRole==='E'); // Actually if black is base, the other point is E/C; but forward case for PNP is black base, so other is red point
              // Determine which non-base point is involved
              const otherRole = rRole==='B' ? bRole : rRole;
              isEmitter = (otherRole==='E');
              val = isEmitter ? (0.68 + Math.random()*0.02) : (0.62 + Math.random()*0.02);
              unit='V'; isOL=false;
            } else {
              isOL=true;
            }
          } else { isOL=true; }
        }
      } else if (type==='resistor' || type==='inductor' || type==='capacitor'){
        isOL=true;
      } else isOL=true;
    } else if (mode==='cap'){
      if (type==='capacitor'){
        if (parsed===null) val=100e-9;
        else val=applyTolerance(parsed);
        unit='F'; isOL=false; beep=false;
      } else {
        // non-capacitor in cap mode → OL, and for resistor/inductor maybe small? but spec says OL
        isOL=true;
      }
    } else if (mode==='vac' || mode==='vdc' || mode==='mv'){
      if (['resistor','capacitor','inductor'].includes(type)){ val=0.000; unit='V'; }
      else if (type==='diode'){ val=mode==='vac'?0.001:0.68; unit='V'; }
      else { val=3.3+(Math.random()-0.5)*0.04; unit='V'; }
      if (mode==='mv') unit='mV';
    } else if (mode==='a' || mode==='ma' || mode==='ua'){
      if (mode==='a' && redJack!=='10a') return {text:'LEAd', unit:'', isOL:false, beep:false, raw:0};
      if ((mode==='ma'||mode==='ua') && redJack!=='maua') return {text:'LEAd', unit:'', isOL:false, beep:false, raw:0};
      val=0.015+Math.random()*0.005;
      if (mode==='ma'){ val*=1000; unit='mA'; }
      else if (mode==='ua'){ val*=1e6; unit='µA'; }
      else unit='A';
      if (val>10 && mode==='a') isOL=true;
    } else if (mode==='hz'){ val=1000+Math.random()*500; unit='Hz'; }
    else if (mode==='temp'){
      val=24.5+(Math.random()-0.5)*0.6; unit=dial.sub==='f'?'°F':'°C';
      if (dial.sub==='f') val=val*9/5+32;
    } else if (mode==='off'){ val=null; }
    if (isOL) return {text:'OL', unit:dial.unit||'', isOL:true, beep:false, raw:0};
    if (val!==null){
      let displayVal=val;
      if (this.state.rel && this.state.relBase!==null) displayVal=val-this.state.relBase;
      // small instrument noise already included in tolerance path; add tiny for non-tolerance
      if (!['ohm','cap'].includes(mode)) displayVal+=(Math.random()-0.5)*Math.abs(displayVal)*0.004;
      // ab — diode mode must show V not mV (0.678 V not 678 mV)
      if (mode==='diode' && unit==='V'){
        const txt = displayVal.toFixed(3);
        // handle MAX/MIN for diode too
        if (this.state.maxMin===1){
          if (this._maxVal===undefined || displayVal>this._maxVal) this._maxVal=displayVal;
          return {text: this._maxVal.toFixed(3), unit:'V', isOL:false, beep, raw:displayVal};
        } else if (this.state.maxMin===2){
          if (this._minVal===undefined || displayVal<this._minVal) this._minVal=displayVal;
          return {text: this._minVal.toFixed(3), unit:'V', isOL:false, beep, raw:displayVal};
        } else { this._maxVal=displayVal; this._minVal=displayVal; }
        return {text: txt, unit:'V', isOL:false, beep, raw:displayVal};
      }
      const fmt=this.formatValue(displayVal, unit);
      if (this.state.maxMin===1){
        if (this._maxVal===undefined || Math.abs(displayVal)>Math.abs(this._maxVal)) this._maxVal=displayVal;
        const fm=this.formatValue(this._maxVal, unit);
        return {text:fm.text, unit:fm.unit, isOL:false, beep, raw:displayVal};
      } else if (this.state.maxMin===2){
        if (this._minVal===undefined || Math.abs(displayVal)<Math.abs(this._minVal)) this._minVal=displayVal;
        const fm=this.formatValue(this._minVal, unit);
        return {text:fm.text, unit:fm.unit, isOL:false, beep, raw:displayVal};
      } else { this._maxVal=displayVal; this._minVal=displayVal; }
      return {text:fmt.text, unit:fmt.unit, isOL:false, beep, raw:displayVal};
    }
    return {text:'OL', unit:'', isOL:true, beep:false, raw:0};
  }

  updateDisplay(){
    if (!this.state.powerOn){
      if (this._els.value) this._els.value.textContent='';
      if (this._els.unit) this._els.unit.textContent='';
      if (this._els.lcd) { this._els.lcd.classList.add('off'); }
      if (this._els.range) this._els.range.textContent='OFF';
      return;
    }
    if (this.getCurrentDialMode().mode==='off'){
      if (this._els.value) this._els.value.textContent='';
      if (this._els.unit) this._els.unit.textContent='';
      if (this._els.lcd) this._els.lcd.classList.add('off');
      if (this._els.range) this._els.range.textContent='OFF';
      const lcdVal=this._els.outerLcdVal || document.getElementById('multimeterLcdValue');
      const lcdUnit=this._els.outerLcdUnit || document.getElementById('multimeterLcdUnit');
      if (lcdVal) lcdVal.textContent='---';
      if (lcdUnit) lcdUnit.textContent='';
      return;
    }
    let m=this.getMeasurement();
    if (this.state.hold && this.state.heldValue) m=this.state.heldValue;
    else if (this.state.hold) this.state.heldValue=m;
    // CONTINUOUS beep handling — persists until probes disconnect / condition fails
    // For continuity mode with beep=true, start continuous tone; otherwise stop. Also handles inductor/diode/transistor continuity per spec continuously.
    // beep handling: continuous for all except HEALTHY capacitor momentary (user: healthy = momentary, faulty = continuous)
    const measComp = (this._cableEnabled && this.getCableConnectedComponent && this.getCableConnectedComponent()) ? this.getCableConnectedComponent() : this.currentComponent;
    const isCapMomentary = m.beep && measComp && measComp.type==='capacitor' && this.getCurrentDialMode().mode==='continuity' && !measComp.isFaulty;
    if (m.beep){
      if (isCapMomentary){
        // brief momentary beep only — single chirp, LED flash, no continuous oscillator
        this.stopContinuousBeep();
        this.playBeep();
        const led=document.getElementById('multimeterContinuityLed');
        const dled=this._els.led;
        if (led) { led.classList.add('on'); setTimeout(()=>led.classList.remove('on'), 220); }
        if (dled) { dled.classList.add('on'); setTimeout(()=>dled.classList.remove('on'), 220); }
        if (this._els.lcd) { this._els.lcd.classList.add('beeping'); setTimeout(()=>this._els.lcd.classList.remove('beeping'), 220); }
      } else {
        // continuous until disconnect — for resistor/inductor/diode/transistor continuity
        this.startContinuousBeep();
        const led=document.getElementById('multimeterContinuityLed');
        const dled=this._els.led;
        if (led) led.classList.add('on');
        if (dled) dled.classList.add('on');
        if (this._els.lcd) this._els.lcd.classList.add('beeping');
      }
    } else {
      this.stopContinuousBeep();
      const led=document.getElementById('multimeterContinuityLed');
      const dled=this._els.led;
      if (led) led.classList.remove('on');
      if (dled) dled.classList.remove('on');
      if (this._els.lcd) this._els.lcd.classList.remove('beeping');
    }
    this.measured=m;
    if (this._els.value) {
      this._els.value.textContent = m.text || '----';
      this._els.value.classList.toggle('hold', !!this.state.hold);
      this._els.value.classList.toggle('ol', m.text==='OL');
    }
    if (this._els.unit) this._els.unit.textContent = m.unit;
    if (this._els.range) this._els.range.textContent = this.getRangeLabel();
    this.updateLCDIcons();
    const lcdVal=this._els.outerLcdVal || document.getElementById('multimeterLcdValue');
    const lcdUnit=this._els.outerLcdUnit || document.getElementById('multimeterLcdUnit');
    if (lcdVal){ lcdVal.textContent=m.text||'---'; lcdVal.classList.toggle('hold', this.state.hold); }
    if (lcdUnit) lcdUnit.textContent=m.unit;
    if (this._els.probeLabel) {
      const redJack=Object.entries(this.jackState||{}).find(([k,v])=>v && k!=='com')?.[0]||'vohm';
      const map={'10a':'10A','maua':'mA µA','vohm':'VΩHz','com':'COM'};
      this._els.probeLabel.textContent=`COM + ${map[redJack]||'VΩHz'}`;
    }
  }

  getRangeLabel(){
    const mode=this.getCurrentDialMode();
    if (mode.mode==='off') return 'OFF';
    if (this.state.range==='auto') return 'AUTO RANGE';
    return `MANUAL ${this.state.range}`;
  }

  handleResize(){}
  updateProbeWires(){}

  setVisible(v){
    const sec=document.getElementById('multimeterSection');
    if (sec) sec.classList.toggle('hidden', !v);
  }
  isVisible(){
    const sec=document.getElementById('multimeterSection');
    return sec && !sec.classList.contains('hidden');
  }
  expand(){
    const sec=document.getElementById('multimeterSection');
    if (!sec) return;
    sec.classList.toggle('multimeter-expanded');
  }
}

let singleton=null;
export function getMultimeter(){ return singleton; }
export function initMultimeter(canvas, opts){
  if (singleton) return singleton;
  singleton = new SunshineDT17N(canvas, opts);
  return singleton;
}

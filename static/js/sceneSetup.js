import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export class SceneManager {
    constructor(canvas, container) {
        this.container = container;
        this.canvas = canvas;
        this.boardGroup = new THREE.Group();
        this.componentGroup = new THREE.Group();
        // componentGroup lives inside boardGroup so it flips with board
        this.boardGroup.add(this.componentGroup);
        this.focusGroup = new THREE.Group();
        this.focusGroup.visible = false;

        this._showingBack = false;
        this._animating = false;
        this._flipState = null;
        this._tickCallbacks = new Set();

        this._initScene();
        this._initLights();
        this._initFloor();
        this._initControls();

        window.addEventListener('resize', () => this._onResize());
        // Observe container size changes (sidebar toggle, flex resize) so canvas never bleeds behind sidebar
        if (typeof ResizeObserver !== 'undefined') {
            this._resizeObserver = new ResizeObserver(() => this._onResize());
            this._resizeObserver.observe(this.container);
        }
        // Also observe body for initial layout stabilization
        requestAnimationFrame(() => this._onResize());
        setTimeout(() => this._onResize(), 300);
        this._animate();
    }

    get isBack() {
        return this._showingBack;
    }

    get isAnimating() {
        return this._animating;
    }

    onTick(cb) {
        this._tickCallbacks.add(cb);
        return () => this._tickCallbacks.delete(cb);
    }

    _initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0d1321);
        this.scene.fog = new THREE.Fog(0x0d1321, 8, 25);

        this.camera = new THREE.PerspectiveCamera(
            42,
            this.container.clientWidth / this.container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 4.5, 5.5);

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true,
        });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        this.scene.add(this.boardGroup);
        this.scene.add(this.focusGroup);
        this._clock = new THREE.Clock();
    }

    _initLights() {
        const ambient = new THREE.HemisphereLight(0x8fb8ff, 0x0a0a14, 0.65);
        this.scene.add(ambient);

        const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
        keyLight.position.set(4, 7, 4);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(2048, 2048);
        keyLight.shadow.camera.left = -6;
        keyLight.shadow.camera.right = 6;
        keyLight.shadow.camera.top = 6;
        keyLight.shadow.camera.bottom = -6;
        keyLight.shadow.bias = -0.0015;
        this.scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0x6ea8ff, 0.4);
        fillLight.position.set(-5, 3, -4);
        this.scene.add(fillLight);

        const rimLight = new THREE.PointLight(0xe94560, 0.8, 15);
        rimLight.position.set(0, 2, -4);
        this.scene.add(rimLight);
    }

    _initFloor() {
        const grid = new THREE.GridHelper(30, 60, 0x2a3a5a, 0x1a2338);
        grid.position.y = -0.76;
        grid.material.opacity = 0.5;
        grid.material.transparent = true;
        this.scene.add(grid);
        this._grid = grid;

        const floorGeo = new THREE.CircleGeometry(12, 64);
        const floorMat = new THREE.ShadowMaterial({ opacity: 0.35 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.75;
        floor.receiveShadow = true;
        this.scene.add(floor);
        this._floor = floor;
    }

    _initControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.minDistance = 0.35;
        this.controls.maxDistance = 30;
        this.controls.maxPolarAngle = Math.PI * 0.49;
        this.controls.zoomToCursor = true;
        this.controls.enablePan = true;
        this.controls.screenSpacePanning = true;
        this.controls.panSpeed = 1.15;
        this.controls.rotateSpeed = 0.95;
        this.controls.zoomSpeed = 1.08;
        // Keep left-drag = rotate (existing) and add pan alongside it:
        // right-drag = pan, Shift/Ctrl + left-drag = pan, middle-drag = pan
        // This preserves the original rotate feature while adding easy panning
        this.controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN
        };
        this.controls.touches = {
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_PAN
        };
        this.controls.target.set(0, 0, 0);

        // Shift/Ctrl/Alt + left-drag → pan (keeps left-drag rotate as default)
        const syncPanModifier = (e) => {
            const wantsPan = !!(e.shiftKey || e.ctrlKey || e.altKey);
            this.controls.mouseButtons.LEFT = wantsPan ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
        };
        window.addEventListener('keydown', syncPanModifier);
        window.addEventListener('keyup', syncPanModifier);
        this.renderer.domElement.addEventListener('pointerdown', (e) => {
            if (e.button === 0 && (e.shiftKey || e.ctrlKey || e.altKey)) {
                this.controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
            }
        });
        this.renderer.domElement.addEventListener('pointerup', () => {
            // restore rotate unless modifier still held
            this.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
        });
        window.addEventListener('blur', () => {
            this.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
        });
    }

    setBoard(mesh, size) {
        // Preserve componentGroup, clear everything else
        const comps = this.componentGroup;
        this.boardGroup.clear();
        this.boardGroup.add(comps);
        this.boardGroup.add(mesh);
        // store reference
        this._boardMesh = mesh;
        this._boardSize = size;
        this.boardGroup.rotation.set(0, 0, 0);
        this._showingBack = false;
        this._flipState = null;
        this._animating = false;
        this.frameBoard(size);
    }

    clearBoard() {
        const comps = this.componentGroup;
        this.boardGroup.clear();
        this.boardGroup.add(comps);
        comps.clear();
        this._boardMesh = null;
        this._boardSize = null;
        this.boardGroup.rotation.set(0, 0, 0);
        this._showingBack = false;
        this._flipState = null;
        this._animating = false;
        this.camera.position.set(0, 4.5, 5.5);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    getBoardMesh() {
        return this._boardMesh || null;
    }

    getBoardSize() {
        return this._boardSize || null;
    }

    setControlsEnabled(enabled) {
        this.controls.enabled = enabled;
    }

    frameBoard(size) {
        const maxDim = Math.max(size.x, size.z, 1);
        this.camera.position.set(0, maxDim * 1.05, maxDim * 1.25);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    flipBoard(duration = 1300) {
        if (this._animating) return;
        const targetBack = !this._showingBack;
        const startAngle = this.boardGroup.rotation.z;
        const targetAngle = targetBack ? Math.PI : 0;
        this._showingBack = targetBack;
        this._animating = true;
        this._flipState = {
            startAngle,
            targetAngle,
            startTime: performance.now(),
            duration,
        };
    }

    _updateFlipAnimation() {
        if (!this._flipState) return;
        const { startAngle, targetAngle, startTime, duration } = this._flipState;
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        const eased = easeInOutCubic(t);
        this.boardGroup.rotation.z = THREE.MathUtils.lerp(startAngle, targetAngle, eased);
        if (t >= 1) {
            this.boardGroup.rotation.z = targetAngle;
            this._flipState = null;
            this._animating = false;
        }
    }

    _onResize() {
        let w = this.container.clientWidth;
        let h = this.container.clientHeight;
        if (w === 0 || h === 0) {
            // container not yet laid out (CSS still loading or hidden) — fallback to canvas parent or window
            const c = this.canvas.parentElement;
            if (c) {
                w = c.clientWidth || w;
                h = c.clientHeight || h;
            }
            if (w === 0 || h === 0) {
                w = window.innerWidth ? Math.min(window.innerWidth - 32, 1200) : 800;
                h = window.innerHeight ? Math.min(window.innerHeight - 120, 800) : 600;
                // schedule retry once layout stabilizes
                setTimeout(()=> this._onResize(), 400);
            }
        }
        if (w === 0 || h === 0) return;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    resize() {
        this._onResize();
    }

    _animate() {
        requestAnimationFrame(() => this._animate());
        const dt = this._clock.getDelta();
        const elapsed = this._clock.elapsedTime;
        this._updateFlipAnimation();
        this.controls.update();
        for (const cb of this._tickCallbacks) {
            try { cb(dt, elapsed); } catch(e) { console.error(e); }
        }
        this.renderer.render(this.scene, this.camera);
    }
}

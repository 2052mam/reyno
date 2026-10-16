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

        this._showingBack = false;
        this._animating = false;
        this._flipState = null;

        this._initScene();
        this._initLights();
        this._initFloor();
        this._initControls();

        window.addEventListener('resize', () => this._onResize());
        this._animate();
    }

    get isBack() {
        return this._showingBack;
    }

    get isAnimating() {
        return this._animating;
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

        const floorGeo = new THREE.CircleGeometry(12, 64);
        const floorMat = new THREE.ShadowMaterial({ opacity: 0.35 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.75;
        floor.receiveShadow = true;
        this.scene.add(floor);
    }

    _initControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.08;
        this.controls.minDistance = 0.4;
        this.controls.maxDistance = 30;

        // دوربین فقط بالای افق مجازه بچرخه؛ دیدن پشت برد از طریق
        // چرخوندن خود برد (flipBoard) انجام می‌شه، نه رفتن دوربین زیر برد.
        this.controls.maxPolarAngle = Math.PI * 0.49;

        // به‌جای زوم همیشگی به سمت مرکز صحنه، دقیقا به سمت نقطه‌ای که
        // ماوس زیرش هست زوم می‌کنه (مثل Google Maps). این قابلیت باعث
        // میشه بشه روی قطعات ریز گوشه‌های برد هم به‌راحتی زوم کرد، نه فقط وسط.
        this.controls.zoomToCursor = true;

        this.controls.target.set(0, 0, 0);
    }

    setBoard(mesh, size) {
        this.boardGroup.clear();
        this.boardGroup.add(mesh);
        this.boardGroup.rotation.set(0, 0, 0);
        this._showingBack = false;
        this._flipState = null;
        this._animating = false;
        this.frameBoard(size);
    }

    clearBoard() {
        this.boardGroup.clear();
        this.boardGroup.rotation.set(0, 0, 0);
        this._showingBack = false;
        this._flipState = null;
        this._animating = false;
        this.camera.position.set(0, 4.5, 5.5);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    frameBoard(size) {
        const maxDim = Math.max(size.x, size.z, 1);
        this.camera.position.set(0, maxDim * 1.05, maxDim * 1.25);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }

    /**
     * برد رو با یک انیمیشن نرم ۱۸۰ درجه دور محور Z می‌چرخونه تا
     * روی/پشت برد نمایش داده بشه. دوربین ثابت می‌مونه، فقط خود برد می‌چرخه.
     */
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
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    _animate() {
        requestAnimationFrame(() => this._animate());
        this._updateFlipAnimation();
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}
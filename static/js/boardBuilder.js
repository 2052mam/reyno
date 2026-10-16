import * as THREE from 'three';

const BOARD_WIDTH = 4;          // عرض ثابت برد در واحد سه‌بعدی
const THICKNESS = 0.12;         // ضخامت برد
const MAX_PROCESS_SIZE = 500;   // حداکثر ابعاد عکس برای تحلیل آلفا (پرفورمنس)
const ALPHA_THRESHOLD = 20;     // آستانه تشخیص شفافیت (0-255)

/**
 * عکس روی برد (و اختیاری پشت برد) رو میخونه، کانال آلفای روی برد رو تحلیل
 * میکنه و یک Mesh سه‌بعدی دقیقا هم‌شکل برد میسازه که هر دو سطح رویی و زیری
 * تکسچر واقعی خودشون رو دارن.
 *
 * @param {string} frontUrl - آدرس عکس روی برد (الزامی)
 * @param {string|null} backUrl - آدرس عکس پشت برد (اختیاری)
 * @param {{mirrorBack: boolean}} options
 */
export async function buildBoardMesh(frontUrl, backUrl = null, options = {}) {
    const mirrorBack = options.mirrorBack !== false;

    const frontTexture = await loadTexture(frontUrl);
    const backTexture = backUrl ? await loadTexture(backUrl) : null;

    const img = frontTexture.image;
    const { contour, canvasW, canvasH } = extractContour(img);

    const geometry = buildBoardGeometry(contour, canvasW, canvasH, mirrorBack);
    const materials = buildBoardMaterials(frontTexture, backTexture);

    const mesh = new THREE.Mesh(geometry, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    geometry.computeBoundingBox();
    const size = new THREE.Vector3();
    geometry.boundingBox.getSize(size);

    return { mesh, size };
}

function loadTexture(url) {
    return new Promise((resolve, reject) => {
        const loader = new THREE.TextureLoader();
        loader.load(url, (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.needsUpdate = true;
            resolve(tex);
        }, undefined, reject);
    });
}

/* -------------------- استخراج کانتور از کانال آلفا (بر اساس عکس روی برد) -------------------- */

function extractContour(img) {
    const scale = Math.min(1, MAX_PROCESS_SIZE / Math.max(img.width, img.height));
    const canvasW = Math.max(2, Math.round(img.width * scale));
    const canvasH = Math.max(2, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvasW, canvasH);

    const { data } = ctx.getImageData(0, 0, canvasW, canvasH);

    const mask = new Uint8Array(canvasW * canvasH);
    for (let i = 0; i < canvasW * canvasH; i++) {
        mask[i] = data[i * 4 + 3] > ALPHA_THRESHOLD ? 1 : 0;
    }

    const isFullyOpaque = mask.every(v => v === 1);
    let points;

    if (isFullyOpaque) {
        points = [
            { x: 0, y: 0 }, { x: canvasW, y: 0 },
            { x: canvasW, y: canvasH }, { x: 0, y: canvasH },
        ];
    } else {
        points = traceOuterContour(mask, canvasW, canvasH);
        points = simplifyPath(points, Math.max(canvasW, canvasH) * 0.004);
        if (points.length < 3) {
            points = [
                { x: 0, y: 0 }, { x: canvasW, y: 0 },
                { x: canvasW, y: canvasH }, { x: 0, y: canvasH },
            ];
        }
    }

    return { contour: points, canvasW, canvasH };
}

function traceOuterContour(mask, w, h) {
    const idx = (x, y) => y * w + x;
    const isSolid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[idx(x, y)] === 1;

    let start = null;
    outer:
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (isSolid(x, y)) { start = { x, y }; break outer; }
        }
    }
    if (!start) return [];

    const dirs = [
        { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: -1, y: 1 },
        { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
    ];

    const contour = [];
    let current = start;
    let backtrack = 4;
    const maxSteps = w * h * 4;
    let steps = 0;

    do {
        contour.push({ x: current.x, y: current.y });
        let found = false;
        for (let i = 0; i < 8; i++) {
            const dirIdx = (backtrack + i) % 8;
            const d = dirs[dirIdx];
            const nx = current.x + d.x;
            const ny = current.y + d.y;
            if (isSolid(nx, ny)) {
                current = { x: nx, y: ny };
                backtrack = (dirIdx + 5) % 8;
                found = true;
                break;
            }
        }
        if (!found) break;
        steps++;
    } while (!(current.x === start.x && current.y === start.y) && steps < maxSteps);

    return contour;
}

function simplifyPath(points, epsilon) {
    if (points.length < 3) return points;

    function perpendicularDistance(p, a, b) {
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);
        return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
    }

    function rdp(pts) {
        if (pts.length < 3) return pts;
        let maxDist = 0, index = 0;
        for (let i = 1; i < pts.length - 1; i++) {
            const d = perpendicularDistance(pts[i], pts[0], pts[pts.length - 1]);
            if (d > maxDist) { maxDist = d; index = i; }
        }
        if (maxDist > epsilon) {
            const left = rdp(pts.slice(0, index + 1));
            const right = rdp(pts.slice(index));
            return left.slice(0, -1).concat(right);
        }
        return [pts[0], pts[pts.length - 1]];
    }

    return rdp(points);
}

/* -------------------- ساخت هندسه سه‌بعدی برد (روی صفحه افقی XZ) -------------------- */

function buildBoardGeometry(contourPx, canvasW, canvasH, mirrorBack) {
    const aspect = canvasW / canvasH;
    const boardW = BOARD_WIDTH;
    const boardD = BOARD_WIDTH / aspect;
    const halfT = THICKNESS / 2;

    const pts3D = contourPx.map(p => {
        const u = p.x / canvasW;
        const v = p.y / canvasH;
        return {
            x: (u - 0.5) * boardW,
            z: (v - 0.5) * boardD,
            u, v,
        };
    });

    const n = pts3D.length;
    const positions = [];
    const uvs = [];
    const indices = [];

    const shapePoints2D = pts3D.map(p => new THREE.Vector2(p.x, p.z));
    const triangles = THREE.ShapeUtils.triangulateShape(shapePoints2D, []);

    // --- سطح بالا (روی برد - تکسچر front) ---
    const topStart = positions.length / 3;
    pts3D.forEach(p => {
        positions.push(p.x, halfT, p.z);
        uvs.push(p.u, 1 - p.v);
    });
    triangles.forEach(tri => {
        indices.push(topStart + tri[0], topStart + tri[1], topStart + tri[2]);
    });

    // --- سطح پایین (پشت برد - تکسچر back، با UV مجزا برای امکان آینه‌کردن) ---
    const bottomStart = positions.length / 3;
    pts3D.forEach(p => {
        positions.push(p.x, -halfT, p.z);
        const bu = mirrorBack ? 1 - p.u : p.u;
        uvs.push(bu, 1 - p.v);
    });
    triangles.forEach(tri => {
        indices.push(bottomStart + tri[2], bottomStart + tri[1], bottomStart + tri[0]);
    });

    // --- دیواره‌های کناری (ضخامت برد) ---
    for (let i = 0; i < n; i++) {
        const a = pts3D[i];
        const b = pts3D[(i + 1) % n];
        const base = positions.length / 3;

        positions.push(a.x, halfT, a.z);
        positions.push(a.x, -halfT, a.z);
        positions.push(b.x, halfT, b.z);
        positions.push(b.x, -halfT, b.z);

        uvs.push(0, 1, 0, 0, 1, 1, 1, 0);

        indices.push(base, base + 1, base + 2);
        indices.push(base + 2, base + 1, base + 3);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    geometry.clearGroups();
    geometry.addGroup(0, triangles.length * 3, 0);
    geometry.addGroup(triangles.length * 3, triangles.length * 3, 1);
    geometry.addGroup(triangles.length * 3 * 2, n * 6, 2);

    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    return geometry;
}

function buildBoardMaterials(frontTexture, backTexture) {
    const topMaterial = new THREE.MeshStandardMaterial({
        map: frontTexture,
        alphaTest: 0.5,
        roughness: 0.55,
        metalness: 0.15,
        side: THREE.DoubleSide,
    });

    let bottomMaterial;
    if (backTexture) {
        // عکس واقعی پشت برد موجوده → از تکسچر خودش استفاده کن
        bottomMaterial = new THREE.MeshStandardMaterial({
            map: backTexture,
            alphaTest: 0.5,
            roughness: 0.55,
            metalness: 0.15,
            side: THREE.DoubleSide,
        });
    } else {
        // عکس پشت نداریم → رنگ سبز ساده PCB (حالت قبلی)
        bottomMaterial = new THREE.MeshStandardMaterial({
            color: 0x0b3d1f,
            alphaMap: frontTexture,
            alphaTest: 0.5,
            roughness: 0.8,
            metalness: 0.1,
            side: THREE.DoubleSide,
        });
    }

    const sideMaterial = new THREE.MeshStandardMaterial({
        color: 0x0a2e17,
        roughness: 0.6,
        metalness: 0.2,
        side: THREE.DoubleSide,
    });

    return [topMaterial, bottomMaterial, sideMaterial];
}
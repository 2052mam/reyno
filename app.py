from flask import Flask, render_template, request, url_for, jsonify
import os
import json
import uuid
import re
import time
from werkzeug.utils import secure_filename
from datetime import datetime

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB for glb
app.config['VERSION'] = '18'  # af — point1 reduce multimeter size (no scroll), point2 enlarge isolated 3D probe points, point3 capacitor momentary beep, point4 fix component click vs probe attach + dial radius 95
ALLOWED_EXTENSIONS = {'png'}
ALLOWED_MODEL_EXTENSIONS = {'glb', 'gltf'}

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
MODELS_DIR = os.path.join(app.config['UPLOAD_FOLDER'], 'models')
os.makedirs(MODELS_DIR, exist_ok=True)

FRONT_FILENAME = 'board_front.png'
BACK_FILENAME = 'board_back.png'
COMPONENTS_FILENAME = 'components.json'
CABLES_FILENAME = 'cables.json'
MODELS_FILENAME = 'models.json'
BOARDS_FILENAME = 'boards.json'
THEME_FILENAME = 'theme.json'

ALLOWED_COMPONENT_TYPES = {'resistor', 'capacitor', 'inductor', 'diode', 'transistor'}
ALLOWED_SIDES = {'front', 'back'}
HEX_COLOR_RE = re.compile(r'^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$')


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def allowed_model_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_MODEL_EXTENSIONS

def get_board_urls():
    upload_dir = app.config['UPLOAD_FOLDER']
    front_path = os.path.join(upload_dir, FRONT_FILENAME)
    back_path = os.path.join(upload_dir, BACK_FILENAME)
    front_url = url_for('static', filename=f'uploads/{FRONT_FILENAME}') if os.path.exists(front_path) else None
    back_url = url_for('static', filename=f'uploads/{BACK_FILENAME}') if os.path.exists(back_path) else None
    return front_url, back_url

def components_path():
    return os.path.join(app.config['UPLOAD_FOLDER'], COMPONENTS_FILENAME)

def models_path():
    return os.path.join(app.config['UPLOAD_FOLDER'], MODELS_FILENAME)

def boards_path():
    return os.path.join(app.config['UPLOAD_FOLDER'], BOARDS_FILENAME)

def theme_path():
    return os.path.join(app.config['UPLOAD_FOLDER'], THEME_FILENAME)

def cables_path():
    return os.path.join(app.config['UPLOAD_FOLDER'], CABLES_FILENAME)

def load_cables_from_disk():
    path = cables_path()
    if not os.path.exists(path):
        return []
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, dict) and 'cables' in data:
                return data['cables']
            if isinstance(data, list):
                return data
            return []
    except Exception:
        return []

def save_cables_to_disk(cables):
    path = cables_path()
    with open(path, 'w', encoding='utf-8') as f:
        json.dump({'cables': cables}, f, ensure_ascii=False, indent=2)

def sanitize_cables(raw_list, components_lookup=None):
    if not isinstance(raw_list, list):
        return None, 'cables must be a list'
    allowed_jacks = {'10a','maua','com','vohm'}
    cleaned = []
    seen_jack = set()
    for c in raw_list:
        if not isinstance(c, dict):
            continue
        jackId = str(c.get('jackId') or c.get('jack') or '').lower().strip()
        if jackId not in allowed_jacks:
            continue
        if jackId in seen_jack:
            continue
        compId = c.get('componentId') or c.get('compId') or ''
        pointId = c.get('pointId') or c.get('point') or ''
        if not compId or not pointId:
            continue
        compId = str(compId).strip()[:64]
        pointId = str(pointId).strip()[:64]
        if components_lookup is not None:
            comp = next((x for x in components_lookup if x.get('id')==compId), None)
            if not comp:
                continue
            pts = comp.get('attachmentPoints') or []
            if not any(p.get('id')==pointId for p in pts):
                # allow if point not found but component exists? still filter loosely
                # for robustness, skip strict check if no points defined
                if pts:
                    continue
        seen_jack.add(jackId)
        cleaned.append({'jackId': jackId, 'componentId': compId, 'pointId': pointId})
    return cleaned, None

def load_components_from_disk():
    path = components_path()
    if not os.path.exists(path):
        return []
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, dict) and 'components' in data:
                return data['components']
            if isinstance(data, list):
                return data
            return []
    except Exception:
        return []

def save_components_to_disk(components):
    path = components_path()
    with open(path, 'w', encoding='utf-8') as f:
        json.dump({'components': components}, f, ensure_ascii=False, indent=2)

def load_models_from_disk():
    path = models_path()
    if not os.path.exists(path):
        return []
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, dict) and 'models' in data:
                return data['models']
            if isinstance(data, list):
                return data
            return []
    except Exception:
        return []

def save_models_to_disk(models):
    path = models_path()
    with open(path, 'w', encoding='utf-8') as f:
        json.dump({'models': models}, f, ensure_ascii=False, indent=2)

def load_boards_from_disk():
    path = boards_path()
    if not os.path.exists(path):
        return {"activeBoardId": "default", "boards": [{"id": "default", "name": "Board 1", "frontUrl": None, "backUrl": None, "createdAt": datetime.utcnow().isoformat()}]}
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            if isinstance(data, dict) and 'boards' in data:
                return data
            return {"activeBoardId": "default", "boards": []}
    except Exception:
        return {"activeBoardId": "default", "boards": []}

def save_boards_to_disk(data):
    path = boards_path()
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def load_theme_from_disk():
    path = theme_path()
    if not os.path.exists(path):
        return {"overall": "dark", "accent": "#4DD0FF"}
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {"overall": "dark"}

def sanitize_color(val):
    if not val or not isinstance(val, str):
        return None
    v = val.strip()
    if HEX_COLOR_RE.match(v):
        return v.lower() if len(v)==7 else v.lower()  # keep as is
    return None

def sanitize_components(raw_list):
    """Validate and normalize component list. Returns (cleaned, errors)."""
    if not isinstance(raw_list, list):
        return None, 'components must be a list'
    cleaned = []
    for idx, c in enumerate(raw_list):
        if not isinstance(c, dict):
            continue
        ctype = str(c.get('type', '')).lower().strip()
        side = str(c.get('side', '')).lower().strip()
        if ctype not in ALLOWED_COMPONENT_TYPES:
            continue
        if side not in ALLOWED_SIDES:
            continue
        try:
            x = float(c.get('x', 0))
            y = float(c.get('y', 0))
            w = float(c.get('w', 0))
            h = float(c.get('h', 0))
        except Exception:
            continue
        if w <= 0.001 or h <= 0.001:
            continue
        if w > 1: w = 1
        if h > 1: h = 1
        x = max(0, min(1 - w, x))
        y = max(0, min(1 - h, y))
        cid = c.get('id')
        if not cid or not isinstance(cid, str):
            cid = str(uuid.uuid4())
        raw_name = c.get('name', '')
        raw_desc = c.get('description', '')
        if not raw_desc and c.get('desc'):
            raw_desc = c.get('desc')
        name = str(raw_name).strip()[:120] if raw_name else ''
        description = str(raw_desc).strip()[:800] if raw_desc else ''
        raw_value = c.get('value', '')
        value = str(raw_value).strip()[:120] if raw_value else ''
        # extended fields: model linkage & per-component theme
        modelId = c.get('modelId')
        if modelId and not isinstance(modelId, str):
            modelId = str(modelId)
        modelId = modelId.strip()[:64] if modelId else None
        modelUrl = c.get('modelUrl')
        if modelUrl and isinstance(modelUrl, str):
            modelUrl = modelUrl.strip()[:500]
            # basic sanity: must look like url or /static/ path
            if not (modelUrl.startswith('/static/') or modelUrl.startswith('http') or modelUrl.startswith('blob:')):
                # allow relative static path
                if not modelUrl.startswith('static/'):
                    modelUrl = None
        else:
            modelUrl = None
        color = sanitize_color(c.get('color') or c.get('themeColor') or '')
        # allow boardId for multi-board
        boardId = c.get('boardId')
        if boardId and isinstance(boardId, str):
            boardId = boardId.strip()[:64] or "default"
        else:
            boardId = "default"
        # modelScale optional
        try:
            modelScale = float(c.get('modelScale', 1.0))
            if modelScale < 0.1: modelScale = 0.1
            if modelScale > 10: modelScale = 10
        except:
            modelScale = 1.0
        try:
            modelRotY = float(c.get('modelRotY', c.get('modelRot', 0)) or 0)
            modelRotY = modelRotY % 360
        except:
            modelRotY = 0
        try:
            modelRotX = float(c.get('modelRotX', 0) or 0)
            modelRotX = modelRotX % 360
        except:
            modelRotX = 0
        try:
            modelRotZ = float(c.get('modelRotZ', 0) or 0)
            modelRotZ = modelRotZ % 360
        except:
            modelRotZ = 0
        try:
            modelOffsetY = float(c.get('modelOffsetY', c.get('modelHeight', 0)) or 0)
            # clamp to reasonable range
            if modelOffsetY < -1: modelOffsetY = -1
            if modelOffsetY > 2: modelOffsetY = 2
        except:
            modelOffsetY = 0
        # --- attachmentPoints: prop cable attachment registry ---
        raw_pts = c.get('attachmentPoints') or c.get('ap') or []
        pts_clean = []
        if isinstance(raw_pts, list):
            for p in raw_pts:
                if not isinstance(p, dict):
                    continue
                pid = str(p.get('id') or uuid.uuid4().hex[:8]).strip()[:16]
                label = str(p.get('label') or p.get('name') or '').strip()[:12] or pid[:2].upper()
                try:
                    nx = float(p.get('nx', p.get('x', 0.5)))
                    ny = float(p.get('ny', p.get('y', 0.5)))
                except:
                    continue
                nx = max(0, min(1, nx))
                ny = max(0, min(1, ny))
                pts_clean.append({'id': pid, 'label': label, 'nx': round(nx, 4), 'ny': round(ny, 4)})
                if len(pts_clean) >= 8:
                    break
        # auto-generate defaults if none provided — pre-determine attachment points for props
        if not pts_clean:
            def _mk(lbl, nx, ny):
                return {'id': uuid.uuid4().hex[:6], 'label': lbl, 'nx': nx, 'ny': ny}
            if ctype == 'transistor':
                pts_clean = [_mk('E',0.18,0.85), _mk('B',0.50,0.85), _mk('C',0.82,0.85)]
            elif ctype == 'diode':
                pts_clean = [_mk('A',0.10,0.50), _mk('K',0.90,0.50)]
            else:
                pts_clean = [_mk('A',0.12,0.50), _mk('B',0.88,0.50)]
        # precise specs for refined testing
        tolerance = str(c.get('tolerance') or c.get('tol') or '').strip()[:16]
        if ctype=='resistor' and not tolerance:
            tolerance = '5%'
        transistorType = str(c.get('transistorType') or c.get('polarity') or '').strip().upper()[:8]
        if ctype=='transistor':
            if transistorType not in ('NPN','PNP'):
                transistorType = 'NPN'
        else:
            transistorType = None
        health_raw = c.get('health') or c.get('faulty') or c.get('isFaulty')
        isFaulty = False
        if isinstance(health_raw, bool):
            isFaulty = health_raw
        elif isinstance(health_raw, str):
            isFaulty = health_raw.lower() in ('faulty','bad','fail','true','1')
        if c.get('isFaulty') is True:
            isFaulty = True
        orientation = str(c.get('orientation') or '').strip().lower()[:12]
        if orientation not in ('horizontal','vertical'):
            orientation = 'horizontal' if ctype!='transistor' else 'horizontal'
        cleaned.append({
            'id': cid,
            'type': ctype,
            'side': side,
            'x': round(x, 5),
            'y': round(y, 5),
            'w': round(w, 5),
            'h': round(h, 5),
            'name': name,
            'description': description,
            'value': value,
            'modelId': modelId,
            'modelUrl': modelUrl,
            'color': color,
            'boardId': boardId,
            'modelScale': round(modelScale, 3),
            'modelRotY': round(modelRotY, 1),
            'modelRotX': round(modelRotX, 1),
            'modelRotZ': round(modelRotZ, 1),
            'modelOffsetY': round(modelOffsetY, 3),
            'attachmentPoints': pts_clean,
            'tolerance': tolerance if ctype=='resistor' else None,
            'transistorType': transistorType,
            'isFaulty': isFaulty,
            'orientation': orientation,
        })
    return cleaned, None


@app.route('/')
def index():
    front_url, back_url = get_board_urls()
    components = load_components_from_disk()
    cables = load_cables_from_disk()
    models = load_models_from_disk()
    boards = load_boards_from_disk()
    theme = load_theme_from_disk()
    return render_template('index.html', front_image=front_url, back_image=back_url, components=components, cables=cables, models=models, boards=boards, theme=theme)


@app.route('/upload', methods=['POST'])
def upload_file():
    side = request.form.get('side', 'front')
    if side not in ('front', 'back'):
        return jsonify({'error': 'نوع تصویر نامعتبر است'}), 400
    if 'file' not in request.files:
        return jsonify({'error': 'فایلی ارسال نشده'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'فایلی انتخاب نشده'}), 400
    if not allowed_file(file.filename):
        return jsonify({'error': 'فرمت فایل باید PNG باشد'}), 400
    filename = FRONT_FILENAME if side == 'front' else BACK_FILENAME
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    image_url = url_for('static', filename=f'uploads/{filename}')
    # also save snapshot to boards if active board exists
    try:
        boards = load_boards_from_disk()
        active = boards.get('activeBoardId','default')
        for b in boards.get('boards',[]):
            if b['id']==active:
                if side=='front':
                    b['frontUrl']=image_url
                else:
                    b['backUrl']=image_url
        save_boards_to_disk(boards)
    except Exception:
        pass
    return jsonify({'success': True, 'image_url': image_url, 'side': side})


@app.route('/clear', methods=['POST'])
def clear_board():
    data = request.get_json(silent=True) or {}
    side = data.get('side')
    upload_dir = app.config['UPLOAD_FOLDER']
    if side == 'front':
        targets = [FRONT_FILENAME]
    elif side == 'back':
        targets = [BACK_FILENAME]
    else:
        targets = [FRONT_FILENAME, BACK_FILENAME]
    for fname in targets:
        fpath = os.path.join(upload_dir, fname)
        if os.path.exists(fpath):
            os.remove(fpath)
    if side == 'front' or side is None:
        if side == 'back':
            comps = load_components_from_disk()
            filtered = [c for c in comps if c.get('side') != 'back']
            save_components_to_disk(filtered)
        elif side is None:
            cpath = components_path()
            if os.path.exists(cpath):
                os.remove(cpath)
        if side == 'front':
            comps = load_components_from_disk()
            filtered = [c for c in comps if c.get('side') != 'front']
            save_components_to_disk(filtered)
    # also clear board snapshot
    try:
        boards = load_boards_from_disk()
        active = boards.get('activeBoardId','default')
        for b in boards.get('boards',[]):
            if b['id']==active:
                if side=='front' or side is None:
                    b['frontUrl']=None
                if side=='back' or side is None:
                    b['backUrl']=None
        save_boards_to_disk(boards)
    except Exception:
        pass
    return jsonify({'success': True})


# ------- Component APIs -------
@app.route('/api/components', methods=['GET'])
def get_components():
    comps = load_components_from_disk()
    return jsonify({'success': True, 'components': comps})


@app.route('/api/components', methods=['POST'])
def save_components():
    data = request.get_json(silent=True)
    if not data or 'components' not in data:
        return jsonify({'error': 'components field required'}), 400
    raw = data['components']
    cleaned, err = sanitize_components(raw)
    if err:
        return jsonify({'error': err}), 400
    save_components_to_disk(cleaned)
    # also sync to active board's components snapshot
    try:
        boards = load_boards_from_disk()
        active = boards.get('activeBoardId','default')
        for b in boards.get('boards',[]):
            if b['id']==active:
                b['components']=cleaned
        save_boards_to_disk(boards)
    except Exception:
        pass
    # prune dangling cables (component or point no longer exists)
    try:
        cables = load_cables_from_disk()
        cmap = {c['id']: c for c in cleaned}
        kept = []
        for cab in cables:
            comp = cmap.get(cab.get('componentId'))
            if not comp:
                continue
            pts = comp.get('attachmentPoints') or []
            if pts and not any(p.get('id')==cab.get('pointId') for p in pts):
                continue
            kept.append(cab)
        if len(kept) != len(cables):
            save_cables_to_disk(kept)
    except Exception:
        pass
    return jsonify({'success': True, 'components': cleaned})


@app.route('/api/components/<comp_id>', methods=['DELETE'])
def delete_component(comp_id):
    comps = load_components_from_disk()
    filtered = [c for c in comps if c.get('id') != comp_id]
    if len(filtered) == len(comps):
        return jsonify({'error': 'not found'}), 404
    save_components_to_disk(filtered)
    # also clean up cables attached to this component
    cables = load_cables_from_disk()
    cables2 = [c for c in cables if c.get('componentId') != comp_id]
    if len(cables2) != len(cables):
        save_cables_to_disk(cables2)
    return jsonify({'success': True, 'components': filtered})

# ------- Cables (prop connections) -------
@app.route('/api/cables', methods=['GET'])
def get_cables():
    cables = load_cables_from_disk()
    return jsonify({'success': True, 'cables': cables})

@app.route('/api/cables', methods=['POST'])
def save_cables():
    data = request.get_json(silent=True)
    if not data or 'cables' not in data:
        return jsonify({'error': 'cables field required'}), 400
    comps = load_components_from_disk()
    cleaned, err = sanitize_cables(data['cables'], comps)
    if err:
        return jsonify({'error': err}), 400
    save_cables_to_disk(cleaned)
    return jsonify({'success': True, 'cables': cleaned})

@app.route('/api/cables/<jack_id>', methods=['DELETE'])
def delete_cable(jack_id):
    jack_id = str(jack_id).lower().strip()
    cables = load_cables_from_disk()
    filtered = [c for c in cables if c.get('jackId') != jack_id]
    if len(filtered) == len(cables):
        return jsonify({'error': 'not found'}), 404
    save_cables_to_disk(filtered)
    return jsonify({'success': True, 'cables': filtered})

# ------- Model Registry -------
@app.route('/api/models', methods=['GET'])
def get_models():
    models = load_models_from_disk()
    return jsonify({'success': True, 'models': models})

@app.route('/api/models', methods=['POST'])
def save_models():
    data = request.get_json(silent=True)
    if not data or 'models' not in data:
        return jsonify({'error': 'models field required'}), 400
    raw = data['models']
    if not isinstance(raw, list):
        return jsonify({'error': 'models must be list'}), 400
    cleaned = []
    for m in raw:
        if not isinstance(m, dict):
            continue
        mid = m.get('id') or str(uuid.uuid4())
        name = str(m.get('name','')).strip()[:120] or 'Unnamed'
        mtype = str(m.get('type','')).lower().strip()
        if mtype not in ALLOWED_COMPONENT_TYPES:
            mtype = 'resistor'
        glbUrl = m.get('glbUrl') or m.get('modelUrl') or ''
        if glbUrl:
            glbUrl = str(glbUrl).strip()[:500]
        description = str(m.get('description','')).strip()[:800]
        boardId = str(m.get('boardId','default')).strip()[:64] or 'default'
        data_field = m.get('data') if isinstance(m.get('data'), dict) else {}
        cleaned.append({
            'id': str(mid),
            'name': name,
            'type': mtype,
            'glbUrl': glbUrl,
            'description': description,
            'boardId': boardId,
            'data': data_field,
            'createdAt': m.get('createdAt') or datetime.utcnow().isoformat()
        })
    save_models_to_disk(cleaned)
    return jsonify({'success': True, 'models': cleaned})

@app.route('/upload/model', methods=['POST'])
def upload_model():
    if 'file' not in request.files:
        return jsonify({'error': 'فایلی ارسال نشده'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'فایلی انتخاب نشده'}), 400
    if not allowed_model_file(file.filename):
        return jsonify({'error': 'فرمت باید .glb یا .gltf باشد'}), 400
    # secure and uuid filename
    ext = file.filename.rsplit('.',1)[1].lower()
    fname = f"{uuid.uuid4().hex}.{ext}"
    # also handle boardId and metadata
    boardId = request.form.get('boardId','default').strip()[:64] or 'default'
    name = request.form.get('name','').strip()[:120] or secure_filename(file.filename).rsplit('.',1)[0][:60] or 'Model'
    mtype = request.form.get('type','resistor').lower().strip()
    if mtype not in ALLOWED_COMPONENT_TYPES:
        mtype = 'resistor'
    description = request.form.get('description','').strip()[:800]
    fpath = os.path.join(MODELS_DIR, fname)
    file.save(fpath)
    glbUrl = url_for('static', filename=f'uploads/models/{fname}')
    models = load_models_from_disk()
    entry = {
        'id': uuid.uuid4().hex[:12],
        'name': name,
        'type': mtype,
        'glbUrl': glbUrl,
        'filename': fname,
        'description': description,
        'boardId': boardId,
        'data': {},
        'createdAt': datetime.utcnow().isoformat()
    }
    models.append(entry)
    save_models_to_disk(models)
    return jsonify({'success': True, 'model': entry, 'models': models})

@app.route('/api/models/<model_id>', methods=['DELETE'])
def delete_model(model_id):
    models = load_models_from_disk()
    filtered = [m for m in models if m.get('id') != model_id]
    if len(filtered)==len(models):
        return jsonify({'error':'not found'}),404
    # also remove file if exists
    for m in models:
        if m.get('id')==model_id:
            fname = m.get('filename')
            if fname:
                fpath = os.path.join(MODELS_DIR, fname)
                if os.path.exists(fpath):
                    try: os.remove(fpath)
                    except: pass
    save_models_to_disk(filtered)
    # also unlink components referencing this model
    comps = load_components_from_disk()
    changed=False
    for c in comps:
        if c.get('modelId')==model_id:
            c['modelId']=None
            c['modelUrl']=None
            changed=True
    if changed:
        save_components_to_disk(comps)
    return jsonify({'success': True, 'models': filtered})

# ------- Boards -------
@app.route('/api/boards', methods=['GET'])
def get_boards():
    boards = load_boards_from_disk()
    # ensure front/back urls are current for active
    return jsonify({'success': True, 'boards': boards})

@app.route('/api/boards', methods=['POST'])
def create_board():
    data = request.get_json(silent=True) or {}
    name = str(data.get('name','')).strip()[:80] or f"Board {uuid.uuid4().hex[:4]}"
    boardId = str(data.get('id') or uuid.uuid4().hex[:8])
    boards = load_boards_from_disk()
    # save current board snapshot to previous active before creating new?
    # For now just add new board
    new_board = {
        'id': boardId,
        'name': name,
        'frontUrl': None,
        'backUrl': None,
        'components': [],
        'createdAt': datetime.utcnow().isoformat()
    }
    # if request wants to clone current
    if data.get('cloneCurrent'):
        frontUrl, backUrl = get_board_urls()
        comps = load_components_from_disk()
        new_board['frontUrl']=frontUrl
        new_board['backUrl']=backUrl
        new_board['components']=comps
    boards['boards'].append(new_board)
    # optionally activate new board
    if data.get('activate'):
        boards['activeBoardId']=boardId
        # need to set current files to this board's snapshot? if new board is empty, clear
        if not data.get('cloneCurrent'):
            # clear current board files for new empty board
            for fname in [FRONT_FILENAME, BACK_FILENAME]:
                fpath = os.path.join(app.config['UPLOAD_FOLDER'], fname)
                if os.path.exists(fpath):
                    try: os.remove(fpath)
                    except: pass
            save_components_to_disk([])
    save_boards_to_disk(boards)
    return jsonify({'success': True, 'boards': boards})

@app.route('/api/boards/<board_id>/activate', methods=['POST'])
def activate_board(board_id):
    boards = load_boards_from_disk()
    found = next((b for b in boards['boards'] if b['id']==board_id), None)
    if not found:
        return jsonify({'error':'board not found'}),404
    # save current board state to previous active board snapshot
    active_id = boards.get('activeBoardId')
    if active_id != board_id:
        # snapshot current
        for b in boards['boards']:
            if b['id']==active_id:
                frontUrl, backUrl = get_board_urls()
                comps = load_components_from_disk()
                b['frontUrl']=frontUrl
                b['backUrl']=backUrl
                b['components']=comps
        # now restore target board's snapshot to disk
        # For simplicity, we will not copy files physically, but Frontend will load from board's stored URLs if they are per-board files.
        # Instead we store components and front/back URLs as snapshot; when activating, we write components and try to restore images if they are per-board files.
        # For per-board image files (board_<id>_front.png), we would copy. For now we just set components.
        save_components_to_disk(found.get('components',[]))
        # If board has stored frontUrl that points to a per-board file, we need to copy that file to main location.
        # Check for per-board files existence
        # Try to handle board-specific image files if they exist as static/uploads/board_<id>_front.png
        for side in ['front','back']:
            key = f"{side}Url"
            url = found.get(key)
            # if url is like /static/uploads/board_<id>_front.png, we could copy
            # For now, if url exists as file, copy to main
            if url and url.startswith('/static/uploads/'):
                fname = url.split('/')[-1]
                src = os.path.join(app.config['UPLOAD_FOLDER'], fname)
                dst = os.path.join(app.config['UPLOAD_FOLDER'], FRONT_FILENAME if side=='front' else BACK_FILENAME)
                if os.path.exists(src) and src != dst:
                    try:
                        import shutil
                        shutil.copy(src, dst)
                    except: pass
        boards['activeBoardId']=board_id
        save_boards_to_disk(boards)
    return jsonify({'success': True, 'boards': boards, 'components': load_components_from_disk()})

@app.route('/api/boards/<board_id>', methods=['DELETE'])
def delete_board(board_id):
    boards = load_boards_from_disk()
    if board_id == 'default':
        return jsonify({'error':'cannot delete default'}),400
    filtered = [b for b in boards['boards'] if b['id']!=board_id]
    if len(filtered)==len(boards['boards']):
        return jsonify({'error':'not found'}),404
    boards['boards']=filtered
    if boards.get('activeBoardId')==board_id:
        boards['activeBoardId']='default'
        # restore default
        default = next((b for b in boards['boards'] if b['id']=='default'), None)
        if default:
            save_components_to_disk(default.get('components',[]))
    save_boards_to_disk(boards)
    return jsonify({'success': True, 'boards': boards})

# ------- Theme -------
@app.route('/api/theme', methods=['GET'])
def get_theme():
    theme = load_theme_from_disk()
    return jsonify({'success': True, 'theme': theme})

@app.route('/api/theme', methods=['POST'])
def save_theme():
    data = request.get_json(silent=True) or {}
    theme = load_theme_from_disk()
    # allow overall, accent, per-type colors?
    if 'overall' in data:
        theme['overall']=str(data['overall']).strip()[:32]
    if 'accent' in data:
        col = sanitize_color(data['accent'])
        if col: theme['accent']=col
    # per-type colors
    for t in ALLOWED_COMPONENT_TYPES:
        key = f"color_{t}"
        if key in data:
            col = sanitize_color(data[key])
            if col: theme[key]=col
            elif data[key] is None and key in theme:
                del theme[key]
    # also allow custom CSS variables dict
    if 'vars' in data and isinstance(data['vars'], dict):
        theme['vars']= {k:str(v)[:64] for k,v in data['vars'].items()}
    with open(theme_path(),'w',encoding='utf-8') as f:
        json.dump(theme,f,ensure_ascii=False,indent=2)
    return jsonify({'success': True, 'theme': theme})

@app.after_request
def _no_cache_js(response):
    # Never cache versioned JS/CSS aggressively; browser will revalidate but ?v=VERSION busts stale cache on other machines (304 is Not Modified, not an error)
    ctype = response.headers.get('Content-Type','')
    path = getattr(response, 'direct_passthrough', None)
    # Flask static files: add no-cache for js/css when ?v present
    try:
        from flask import request as freq
        if freq.path.endswith(('.js','.css')) and 'v=' in freq.query_string.decode():
            response.headers['Cache-Control'] = 'no-cache, must-revalidate'
    except: pass
    return response

@app.route('/health')
def health():
    return jsonify({'ok': True, 'version': app.config.get('VERSION','10')})

if __name__ == '__main__':
    # host 0.0.0.0 so other computers on LAN can reach; debug for reload
    app.run(host='0.0.0.0', port=5000, debug=True)

from flask import Flask, render_template, request, url_for, jsonify
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max
ALLOWED_EXTENSIONS = {'png'}

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

FRONT_FILENAME = 'board_front.png'
BACK_FILENAME = 'board_back.png'


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def get_board_urls():
    upload_dir = app.config['UPLOAD_FOLDER']
    front_path = os.path.join(upload_dir, FRONT_FILENAME)
    back_path = os.path.join(upload_dir, BACK_FILENAME)

    front_url = url_for('static', filename=f'uploads/{FRONT_FILENAME}') if os.path.exists(front_path) else None
    back_url = url_for('static', filename=f'uploads/{BACK_FILENAME}') if os.path.exists(back_path) else None
    return front_url, back_url


@app.route('/')
def index():
    front_url, back_url = get_board_urls()
    return render_template('index.html', front_image=front_url, back_image=back_url)


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

    return jsonify({'success': True})


if __name__ == '__main__':
    app.run(debug=True)
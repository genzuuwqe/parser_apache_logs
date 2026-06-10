from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from flask_apscheduler import APScheduler
from cfg import Config
from db_models import db, User, ApacheLog
from parser import process_logs
from sqlalchemy import func
from datetime import datetime, timedelta
import os

base_dir = os.path.dirname(os.path.abspath(__file__))
front_dir = os.path.join(base_dir, '..', 'front')

app = Flask(__name__,
    template_folder=os.path.join(front_dir, 'templates'),
    static_folder=os.path.join(front_dir, 'static')
)
app.config.from_object(Config)
app.config['SCHEDULER_API_ENABLED'] = True

db.init_app(app)
jwt = JWTManager(app)

scheduler = APScheduler()
scheduler.init_app(app)

@app.route('/css/<path:path>')
def send_css(path):
    return send_from_directory(os.path.join(front_dir, 'static', 'css'), path)

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    if User.query.filter_by(username=data['username']).first():
        return jsonify({"msg": "Пользователь уже существует"}), 400
    new_user = User(username=data['username'], password_hash=generate_password_hash(data['password']))
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"msg": "Пользователь создан"}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(username=data['username']).first()
    if user and check_password_hash(user.password_hash, data['password']):
        access_token = create_access_token(identity=user.username, expires_delta=timedelta(hours=1))
        return jsonify(access_token=access_token), 200
    return jsonify({"msg": "Неверные учетные данные"}), 401

@app.route('/api/logs', methods=['GET'])
@jwt_required()
def get_logs():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    ip_filter = request.args.get('ip')
    group_by = request.args.get('group_by')
    
    query = ApacheLog.query
    
    if start_date:
        try: query = query.filter(ApacheLog.timestamp >= datetime.strptime(start_date, '%Y-%m-%d'))
        except ValueError: pass
    if end_date:
        try: query = query.filter(ApacheLog.timestamp <= datetime.strptime(end_date, '%Y-%m-%d'))
        except ValueError: pass
    if ip_filter:
        query = query.filter(ApacheLog.ip_address == ip_filter)
        
    if group_by == 'ip':
        results = query.with_entities(ApacheLog.ip_address, func.count(ApacheLog.id).label('count')).group_by(ApacheLog.ip_address).all()
        return jsonify([{'ip': r[0], 'count': r[1]} for r in results])
    elif group_by == 'date':
        results = query.with_entities(func.date(ApacheLog.timestamp).label('day'), func.count(ApacheLog.id).label('count')).group_by(func.date(ApacheLog.timestamp)).all()
        return jsonify([{'date': str(r[0]), 'count': r[1]} for r in results])
    else:
        logs = query.order_by(ApacheLog.timestamp.desc()).all()
        return jsonify([{
            'id': l.id, 
            'ip': l.ip_address, 
            'url': l.url, 
            'status': l.status_code, 
            'time': l.timestamp.isoformat(),
            'method': l.method
        } for l in logs])

@app.route('/api/parse', methods=['POST'])
@jwt_required()
def trigger_parse():
    try:
        count = process_logs(app.config['LOG_DIR'], app.config['LOG_PATTERN'])
        return jsonify({"msg": f"Обработано записей: {count}"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@scheduler.task('interval', id='do_parse', seconds=app.config['CRON_INTERVAL'], misfire_grace_time=900)
def scheduled_parse():
    with app.app_context():
        print("Запуск фонового парсинга (cron)...")
        try:
            count = process_logs(app.config['LOG_DIR'], app.config['LOG_PATTERN'])
            print(f"Фоновый парсинг завершен. Обработано записей: {count}")
        except Exception as e:
            print(f"Ошибка фонового парсинга: {e}")

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    
    if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or not app.debug:
        scheduler.start()
        print("Планировщик cron активирован.")
        
    app.run(debug=True)
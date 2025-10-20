from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
import time, uuid

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

commands = []
SHARED_TOKEN = "ABC12345"

@app.route('/')
def home():
    return "✅ MT5–MT4 Bridge Online"

@app.route('/api/trade', methods=['POST'])
def receive_trade():
    token = request.headers.get('X-API-KEY', '')
    if token != SHARED_TOKEN:
        return jsonify({"error": "unauthorized"}), 401
    data = request.get_json(force=True, silent=True)
    if not data:
        return jsonify({"error": "bad json"}), 400
    cmd = {"id": str(uuid.uuid4()), "timestamp": time.time(), "command": data}
    commands.append(cmd)
    socketio.emit('trade', cmd)
    return jsonify({"status": "ok", "id": cmd["id"]})

@app.route('/api/commands', methods=['GET'])
def get_commands():
    token = request.headers.get('X-API-KEY', '')
    if token != SHARED_TOKEN:
        return jsonify({"error": "unauthorized"}), 401
    since = float(request.args.get('since', '0'))
    result = [c for c in commands if c['timestamp'] > since]
    return jsonify({"commands": result, "server_time": time.time()})

@app.route('/api/ack', methods=['POST'])
def ack_command():
    token = request.headers.get('X-API-KEY', '')
    if token != SHARED_TOKEN:
        return jsonify({"error": "unauthorized"}), 401
    payload = request.get_json(force=True)
    cid = payload.get('id')
    global commands
    commands = [c for c in commands if c['id'] != cid]
    return jsonify({"status": "acked", "id": cid})

if __name__ == '__main__':
    try:
        import eventlet
        import eventlet.wsgi
        socketio.run(app, host='0.0.0.0', port=10000)
    except Exception:
        socketio.run(app, host='0.0.0.0', port=10000, allow_unsafe_werkzeug=True)

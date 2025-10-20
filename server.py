from flask import Flask, request, jsonify
from flask_cors import CORS
import time

app = Flask(__name__)
CORS(app)

# Simple in-memory store for the latest trade
# Structure: { 'symbol':..., 'type': 'BUY'/'SELL', 'lots': float, 'price': float, 'timestamp': float }
latest_trade = None
SHARED_TOKEN = "ABC12345"

@app.route("/")
def index():
    return "MT5 ⇄ MT4 Bridge Active ✅"

@app.route("/api/send_trade", methods=["POST"])
def send_trade():
    global latest_trade
    token = request.headers.get('X-API-KEY','')
    if token != SHARED_TOKEN:
        return jsonify({'error':'unauthorized'}), 401
    data = request.get_json(force=True, silent=True)
    if not data:
        return jsonify({'error':'bad json'}), 400
    # normalize fields
    trade = {
        'symbol': data.get('symbol'),
        'type': data.get('type'),
        'lots': float(data.get('lots', 0)),
        'price': float(data.get('price', 0)),
        'timestamp': time.time()
    }
    latest_trade = trade
    print("📩 New trade:", trade)
    return jsonify({'status':'ok','received':trade})

@app.route("/api/last_trade", methods=["GET"])
def last_trade():
    if latest_trade is None:
        return jsonify({}), 200
    return jsonify(latest_trade), 200

if __name__ == '__main__':
    # for Render use eventlet if available; fallback to werkzeug
    try:
        import eventlet
        import eventlet.wsgi
        app.run(host='0.0.0.0', port=10000)
    except Exception:
        app.run(host='0.0.0.0', port=10000)

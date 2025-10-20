# ============================================================
#  MT5 → MT4 Trade Copier Bridge Server
#  Flask + CORS | Render-ready | Token-secured
# ============================================================
from flask import Flask, request, jsonify
from flask_cors import CORS
import time

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# --- Security token (same as in MT5 & MT4 EAs) ---
TOKEN = "ABC12345"

# --- In-memory storage for the last trade ---
last_trade = None
last_time = None


@app.route('/')
def home():
    return jsonify({"status": "running", "message": "MT5↔MT4 bridge active"}), 200


@app.route('/api/send_trade', methods=['POST'])
def send_trade():
    """Receive trade signal from MT5 EA"""
    global last_trade, last_time

    # --- Authorization ---
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer ") or auth_header.split(" ")[1] != TOKEN:
        return jsonify({"error": "Unauthorized"}), 401

    # --- Parse incoming trade ---
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON received"}), 400

    # Example data: {"symbol":"XAUUSD","type":"buy","lots":0.01,"price":2374.51}
    last_trade = data
    last_time = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime())

    print(f"[{last_time}] ✅ Trade received: {last_trade}")
    return jsonify({"status": "stored", "trade": last_trade}), 200


@app.route('/api/last_trade', methods=['GET'])
def get_last_trade():
    """MT4 EA polls here to fetch the latest trade"""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer ") or auth_header.split(" ")[1] != TOKEN:
        return jsonify({"error": "Unauthorized"}), 401

    if not last_trade:
        return jsonify({"status": "no trades"}), 200

    return jsonify(last_trade), 200


if __name__ == '__main__':
    # Use Flask's built-in dev server for local testing
    # On Render, gunicorn will be used automatically
    app.run(host='0.0.0.0', port=10000, debug=False)

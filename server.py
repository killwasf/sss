from flask import Flask, request, jsonify
from flask_cors import CORS
import time

app = Flask(__name__)
CORS(app)

LATEST_TRADE = None
TOKEN = "ABC12345"

@app.route("/")
def home():
    return jsonify({"status": "MT5→MT4 Bridge running", "time": time.ctime(),LATEST_TRADE })

@app.route("/send_trade", methods=["POST"])
def send_trade():
    global LATEST_TRADE
    data = request.json

    if not data or data.get("token") != TOKEN:
        return jsonify({"error": "Invalid token"}), 403

    LATEST_TRADE = data
    print(f"✅ Received trade: {LATEST_TRADE}")
    return jsonify({"status": "received", "time": time.ctime()})

@app.route("/get_trade", methods=["GET"])
def get_trade():
    global LATEST_TRADE
    if LATEST_TRADE:
        trade = LATEST_TRADE
        LATEST_TRADE = None
        return jsonify(trade)
    return jsonify({"status": "no_trade"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)

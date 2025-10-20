from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

latest_trade = {
    "symbol": "",
    "type": "",
    "lots": 0.0,
    "price": 0.0,
    "status": "no_trade"
}

@app.route('/')
def index():
    return "✅ Flask MT5 MT4 Bridge Running"

# -------------------------------
# MT5 → SERVER
# -------------------------------
@app.route('/send_trade', methods=['POST'])
def receive_trade():
    global latest_trade
    data = request.get_json(force=True)

    symbol = data.get("symbol", "")
    order_type = data.get("type", "")
    lots = float(data.get("lots", 0))
    price = float(data.get("price", 0))

    latest_trade = {
        "symbol": symbol,
        "type": order_type,
        "lots": lots,
        "price": price,
        "status": "new_trade"
    }

    # 🟢 PRINT SIGNAL HERE
    print("📩 RECEIVED TRADE SIGNAL FROM MT5:")
    print(f"   → Symbol: {symbol}")
    print(f"   → Type:   {order_type}")
    print(f"   → Lots:   {lots}")
    print(f"   → Price:  {price}")
    print("--------------------------------------------------")

    return jsonify({"status": "received", "data": latest_trade}), 200

# -------------------------------
# MT4 → SERVER
# -------------------------------
@app.route('/get_trade', methods=['GET'])
def send_trade():
    global latest_trade

    if latest_trade["status"] == "no_trade":
        return jsonify({"status": "no_trade"}), 200

    # Send and reset to avoid duplicate signals
    trade_to_send = latest_trade.copy()
    latest_trade["status"] = "no_trade"

    print("📤 SENT TRADE TO MT4:", trade_to_send)
    print("--------------------------------------------------")

    return jsonify(trade_to_send), 200

# -------------------------------
# START SERVER
# -------------------------------
if __name__ == '__main__':
    print("🚀 Starting Flask bridge server on port 5000...")
    print("🔗 Endpoint for MT5 → POST /send_trade")
    print("🔗 Endpoint for MT4 → GET  /get_trade")
    print("==================================================")
    app.run(host='0.0.0.0', port=5000)

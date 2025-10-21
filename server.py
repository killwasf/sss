from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

# ===== CONFIGURATION =====
MT4_URL = "http://127.0.0.1:5001/receive_trade"  # MT4 EA local listener endpoint
SERVER_TOKEN = "ABC12345"

# store last trade for reference
last_trade = None


@app.route("/send_trade", methods=["POST"])
def receive_trade():
    global last_trade

    try:
        data = request.get_json(force=True)
    except Exception as e:
        return jsonify({"error": f"Invalid or empty JSON: {str(e)}"}), 400

    # Validate data
    if not data or "token" not in data or data["token"] != SERVER_TOKEN:
        return jsonify({"error": "Unauthorized or missing token"}), 401

    symbol = data.get("symbol")
    ttype = data.get("type")
    lots = data.get("lots")
    price = data.get("price")

    last_trade = data

    print(f"\n📩 Received Trade from MT5:")
    print(f"   Symbol: {symbol}")
    print(f"   Type:   {ttype}")
    print(f"   Lots:   {lots}")
    print(f"   Price:  {price}")

    # === Forward to MT4 ===
    try:
        mt4_payload = {
            "symbol": symbol,
            "type": ttype,
            "lots": lots,
            "price": price,
            "token": SERVER_TOKEN
        }
        mt4_resp = requests.post(MT4_URL, json=mt4_payload, timeout=5)
        print(f"📤 Forwarded to MT4 ({MT4_URL}) → {mt4_resp.status_code}")
    except Exception as e:
        print(f"⚠️ Error sending to MT4: {e}")
        return jsonify({"message": "Trade received, but failed to send to MT4", "status": "partial"}), 200

    return jsonify({
        "message": "Trade received successfully",
        "received": data,
        "status": "ok"
    }), 200


@app.route("/last_trade", methods=["GET"])
def get_last_trade():
    if last_trade:
        return jsonify(last_trade)
    else:
        return jsonify({"message": "No trades received yet"}), 404


if __name__ == "__main__":
    print("🚀 Flask server running on port 5000")
    app.run(host="0.0.0.0", port=5000)

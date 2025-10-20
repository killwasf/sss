from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route("/", methods=["GET"])
def home():
    return "MT5 ↔ MT4 Trade Bridge Server Active ✅", 200

@app.route("/send_trade", methods=["POST"])
def send_trade():
    try:
        data = request.get_json(force=True, silent=True)
        if not data:
            return jsonify({"error": "Invalid or empty JSON"}), 400

        token = data.get("token")
        symbol = data.get("symbol")
        trade_type = data.get("type")
        lots = data.get("lots")
        price = data.get("price")

        print("📩 Trade Received:")
        print(f"  Token: {token}")
        print(f"  Symbol: {symbol}")
        print(f"  Type: {trade_type}")
        print(f"  Lots: {lots}")
        print(f"  Price: {price}")

        # ✅ Send OK response for MT5 confirmation
        return jsonify({
            "status": "ok",
            "message": "Trade received successfully",
            "received": data
        }), 200

    except Exception as e:
        print("❌ Error parsing request:", e)
        return jsonify({"error": str(e)}), 400

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)

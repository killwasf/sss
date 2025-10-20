from flask import Flask, request, jsonify
import json

app = Flask(__name__)

latest_trade = {}

@app.route('/send_trade', methods=['POST'])
def receive_trade():
    try:
        # Try to decode JSON regardless of headers
        raw_data = request.data.decode('utf-8')
        print("📩 Raw data from MT5:", raw_data)

        # Parse JSON safely
        data = json.loads(raw_data)

        # Validate keys
        required = {"token", "symbol", "type", "lots", "price"}
        if not required.issubset(data):
            print("⚠️ Missing required fields:", data)
            return jsonify({"error": "Missing required fields"}), 400

        # Save latest trade
        global latest_trade
        latest_trade = data

        print("✅ Trade received:", latest_trade)
        return jsonify({"status": "received", "data": latest_trade}), 200

    except Exception as e:
        print("❌ Error parsing JSON:", str(e))
        return jsonify({"error": str(e)}), 400


@app.route('/get_trade', methods=['GET'])
def send_trade():
    token = request.args.get('token')
    if token == latest_trade.get("token"):
        print("📤 MT4 fetching trade:", latest_trade)
        return jsonify(latest_trade)
    else:
        print("⚠️ Invalid token or no trade yet.")
        return jsonify({"status": "no_trade"}), 404


if __name__ == '__main__':
    print("🚀 Starting Flask bridge server on port 5000...")
    print("🔗 Endpoint for MT5 → POST /send_trade")
    print("🔗 Endpoint for MT4 → GET  /get_trade")
    app.run(host='0.0.0.0', port=5000)

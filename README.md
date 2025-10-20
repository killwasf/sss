# MT5 → MT4 Bridge (Deploy Guide)

This repo runs a lightweight Flask + SocketIO bridge to copy trades from MT5 (sender) to MT4 (receiver).

## Deploy to Render.com (recommended – free, always-on)

1. Create a Render account (https://render.com) and connect your GitHub.
2. Create a **New Web Service** and select this repository.
3. Set:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python server.py`
   - **Port**: `10000`
   - **Plan**: Free
4. Deploy and note the public URL Render gives you (e.g. `https://mtbridge.onrender.com`).

## MT5 (sender) configuration

- Add this URL to MT5 Tools → Options → Expert Advisors → Allow WebRequest for listed URLs:
  - `https://<your-render-url>`
- Use your MT5 EA to `POST` trade JSON to `https://<your-render-url>/api/trade` with header `X-API-KEY: ABC12345`.

## MT4 (receiver) configuration

- Add this URL to MT4 Tools → Options → Expert Advisors → Allow WebRequest for listed URLs:
  - `https://<your-render-url>`
- Poll `GET https://<your-render-url>/api/commands?since=<timestamp>` with header `X-API-KEY: ABC12345`.
- After executing a command, `POST` `{"id":"<command-id>"}` to `https://<your-render-url>/api/ack` with the same header.

## Notes

- This configuration does **not** persist commands to disk or DB — commands are kept in-memory until acknowledged (no long-term storage).
- If you need persistent storage, you can add a simple SQLite or Redis option.

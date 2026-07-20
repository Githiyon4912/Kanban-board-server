# Deploy on Render

Use a **Web Service** (persistent Node process) so Socket.io works with your Netlify frontend.

## 1. Create the service

1. [Render Dashboard](https://dashboard.render.com) → **New** → **Web Service**
2. Connect the repo that contains the `backend/` folder  
   - If the repo root is the Kanban project, set **Root Directory** to `backend`
3. Settings:

| Setting | Value |
|---------|--------|
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance | Free is fine for demos |

## 2. Environment variables

In Render → **Environment**:

```env
NODE_ENV=production
MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=a_long_random_secret
CLIENT_URL=http://localhost:5173,https://kanbanbordpor.netlify.app
```

`CLIENT_URL` must include your Netlify origin (no trailing slash).

## 3. After deploy

Copy your Render URL, e.g. `https://kanban-board-xxxx.onrender.com`

Open: `https://YOUR-RENDER-URL/api/health`  
You should see `{ "ok": true, ... }`.

## 4. Netlify frontend env

In Netlify → Site settings → Environment variables:

```env
VITE_API_URL=https://YOUR-RENDER-URL/api
VITE_SOCKET_URL=https://YOUR-RENDER-URL
```

Redeploy the Netlify site after saving.

## 5. Checklist

- [ ] `CLIENT_URL` includes `https://kanbanbordpor.netlify.app`
- [ ] `NODE_ENV=production` (cookies: `Secure` + `SameSite=None`)
- [ ] MongoDB Atlas Network Access allows Render (or `0.0.0.0/0` for demos)
- [ ] Netlify `VITE_*` points at the Render URL
- [ ] Test signup from the Netlify site
- [ ] Test live drag with two browser windows (Socket.io)

## Notes

- Free Render services sleep after idle; first request can be slow.
- Do **not** use Vercel serverless for this backend if you need realtime — use Render as above.

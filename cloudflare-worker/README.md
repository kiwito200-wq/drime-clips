# Drime PDF Thumbnail Worker

Worker Cloudflare pour générer des miniatures de PDF.

## Déploiement

### 1. Installer les dépendances

```bash
cd cloudflare-worker
npm install
```

### 2. Se connecter à Cloudflare

```bash
npx wrangler login
```

### 3. Déployer

```bash
npm run deploy
```

### 4. Configurer l'URL dans Vercel

Après le déploiement, tu obtiendras une URL comme :
`https://drime-pdf-thumbnail.<ton-account>.workers.dev`

Ajoute cette variable d'environnement dans Vercel :
```
THUMBNAIL_WORKER_URL=https://drime-pdf-thumbnail.<ton-account>.workers.dev
```

## Utilisation

### POST /generate

```bash
curl -X POST https://drime-pdf-thumbnail.xxx.workers.dev/generate \
  -H "Content-Type: application/json" \
  -d '{"pdfUrl": "https://example.com/document.pdf", "width": 150}'
```

Retourne une image PNG.

### GET /health

```bash
curl https://drime-pdf-thumbnail.xxx.workers.dev/health
```

Retourne `{"status": "ok", "version": "1.0.0"}`

## Développement local

```bash
npm run dev
```

Le worker sera disponible sur `http://localhost:8787`

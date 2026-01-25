# 🔒 Guide de Sécurité - Drime Sign

Ce document décrit les mesures de sécurité implémentées et les configurations requises pour un déploiement sécurisé.

## 📋 Variables d'environnement requises

### 🔴 CRITIQUES (obligatoires en production)

| Variable | Description | Comment générer |
|----------|-------------|-----------------|
| `JWT_SECRET` | Secret pour les sessions JWT (min 32 chars) | `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | Clé de chiffrement AES-256 (64 chars hex) | `openssl rand -hex 32` |
| `THUMBNAIL_WORKER_API_KEY` | API key pour le worker Cloudflare | `openssl rand -hex 16` |

### 🟠 Stockage R2

| Variable | Description |
|----------|-------------|
| `R2_ACCOUNT_ID` | ID du compte Cloudflare |
| `R2_ACCESS_KEY_ID` | Access key R2 |
| `R2_SECRET_ACCESS_KEY` | Secret key R2 |
| `R2_BUCKET_NAME` | Nom du bucket (défaut: drimesign) |

### 🟡 Services externes

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | API key Resend pour les emails |
| `TWILIO_ACCOUNT_SID` | SID du compte Twilio |
| `TWILIO_AUTH_TOKEN` | Token Twilio |
| `TWILIO_VERIFY_SERVICE_SID` | SID du service Verify |

## 🛡️ Mesures de sécurité implémentées

### 1. Authentification
- ✅ JWT avec secret obligatoire en production
- ✅ Sessions avec expiration (30 jours)
- ✅ Middleware d'authentification centralisé
- ✅ Protection contre les sessions expirées

### 2. Rate Limiting
- ✅ OTP: 3 requêtes/minute (protection SMS bombing)
- ✅ Auth: 10 requêtes/minute (protection brute force)
- ✅ API: 100 requêtes/minute (protection DDoS)

### 3. Protection des données
- ✅ Tokens sensibles chiffrés en base (AES-256-GCM)
- ✅ URLs R2 présignées avec expiration (1h PDFs, 24h thumbnails)
- ✅ Validation stricte des fichiers PDF (magic number, taille)
- ✅ Logs sanitisés (données sensibles masquées)

### 4. Protection XSS/CSRF
- ✅ Échappement HTML dans tous les emails
- ✅ Content Security Policy strict
- ✅ Protection CSRF avec double-submit cookie
- ✅ Headers de sécurité (X-Frame-Options, X-XSS-Protection, etc.)

### 5. 2FA et vérification
- ✅ Twilio Verify pour OTP SMS
- ✅ Code de test unique en dev (123456)
- ✅ Validation JWT pour verify-2fa
- ✅ Tokens de signature avec expiration

### 6. Worker Cloudflare
- ✅ Authentification par API key
- ✅ Validation des sources PDF (R2 uniquement)
- ✅ CORS configuré

## 🚀 Déploiement

### Checklist avant production

1. **Variables d'environnement**
   - [ ] `JWT_SECRET` défini (≥32 chars)
   - [ ] `ENCRYPTION_KEY` défini (64 chars hex)
   - [ ] `THUMBNAIL_WORKER_API_KEY` défini
   - [ ] Twilio configuré (pas de mode dev)

2. **Cloudflare Worker**
   ```bash
   cd cloudflare-worker
   wrangler secret put THUMBNAIL_API_KEY
   wrangler deploy
   ```

3. **Migration base de données**
   ```bash
   npx prisma migrate deploy
   ```

4. **Vérification**
   - [ ] Tester les routes protégées sans auth → 401
   - [ ] Tester le rate limiting → 429 après N requêtes
   - [ ] Vérifier les headers CSP dans le navigateur
   - [ ] Tester la 2FA avec de vrais SMS

## 🔍 Audit de sécurité

### Vulnérabilités corrigées

| # | Sévérité | Description | Statut |
|---|----------|-------------|--------|
| 1 | 🔴 CRITIQUE | DEV MODE bypass auth | ✅ Corrigé |
| 2 | 🔴 CRITIQUE | Accès PDF sans auth | ✅ Corrigé |
| 3 | 🔴 CRITIQUE | JWT secret fallback | ✅ Corrigé |
| 4 | 🔴 CRITIQUE | Worker sans auth | ✅ Corrigé |
| 5 | 🔴 CRITIQUE | OTP bypass dev | ✅ Corrigé |
| 6 | 🔴 CRITIQUE | verify-2fa sans validation | ✅ Corrigé |
| 7 | 🟠 ÉLEVÉ | XSS dans emails | ✅ Corrigé |
| 8 | 🟠 ÉLEVÉ | Tokens sans expiration | ✅ Corrigé |
| 9 | 🟠 ÉLEVÉ | Pas de rate limiting | ✅ Corrigé |
| 10 | 🟠 ÉLEVÉ | URLs R2 publiques | ✅ Corrigé |
| 11 | 🟠 ÉLEVÉ | Middleware inactif | ✅ Corrigé |
| 12 | 🟡 MOYEN | Validation PDF faible | ✅ Corrigé |
| 13 | 🟡 MOYEN | Pas de CSP | ✅ Corrigé |
| 14 | 🟡 MOYEN | Logs non sanitisés | ✅ Corrigé |
| 15 | 🟡 MOYEN | Pas de CSRF | ✅ Corrigé |
| 16 | 🟡 MOYEN | Tokens non chiffrés | ✅ Corrigé |

## 📞 Contact sécurité

Pour signaler une vulnérabilité: security@drime.cloud

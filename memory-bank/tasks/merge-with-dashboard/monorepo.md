✅ PLAN D’ACTION PROGRESSIF POUR MIGRATION MONOREPO
Objectif :
👉 Structurer proprement un monorepo avec 2 frontends (Vite), 1 backend (FastAPI), en commençant par duplications, puis en factorisant intelligemment au fil du temps.

🧩 PHASE 1 — Préparation
🔹 Étape 1 : Créer un nouveau repo monorepo/ (local ou distant)
bash
Copy
Edit
mkdir monorepo
cd monorepo
git init
Ou crée un repo sur GitHub/GitLab/Forgejo/etc. et clone-le ici.

🔹 Étape 2 : Créer la structure de base du monorepo
bash
Copy
Edit
mkdir -p apps/chercheur-frontend
mkdir -p apps/therapiste-frontend
mkdir -p apps/backend-api
mkdir -p packages/shared-ui
mkdir -p packages/shared-utils
🔹 Étape 3 : Configurer pnpm-workspace.yaml à la racine
yaml
Copy
Edit
packages:
  - "apps/*"
  - "packages/*"
Et installe pnpm si ce n’est pas fait :

bash
Copy
Edit
npm install -g pnpm
🔹 Étape 4 : Ajouter un package.json racine
json
Copy
Edit
{
  "name": "monorepo",
  "private": true,
  "workspaces": ["apps/*", "packages/*"]
}
🔹 Étape 5 : Copier les projets existants
Copie le CRA chercheur dans apps/chercheur-frontend/

Copie le Vite thérapiste dans apps/therapiste-frontend/

Copie ton FastAPI dans apps/backend-api/

Garde le code en double pour l’instant. Ne touche à rien de "shared".

⚙️ PHASE 2 — Lancement local
🔹 Étape 6 : Tester les frontends en local
Dans chaque app frontend :

Adapter le vite.config.ts pour définir un port différent :

ts
Copy
Edit
export default defineConfig({
  server: {
    port: 5173 // ou 5174 pour l’autre app
  }
})
Lancer :

bash
Copy
Edit
pnpm install
pnpm dev --filter chercheur-frontend
pnpm dev --filter therapiste-frontend
🔹 Étape 7 : Lancer le backend
Dans apps/backend-api/ :

bash
Copy
Edit
uvicorn app.main:app --reload --port 8000
✅ Vérifie que les deux frontends communiquent bien avec le backend (CORS, etc.).

📦 PHASE 3 — Factorisation progressive
🔹 Étape 8 : Commencer à extraire du code partagé au fil du temps
Quand tu rencontres :

des composants communs (Button, Card, Table)

des hooks (useForm, useDebounce)

des helpers (formatDate, capitalize, slugify)

👉 Tu les déplaces dans :

packages/shared-ui/

packages/shared-utils/

Exemple : packages/shared-ui/src/Button.tsx
tsx
Copy
Edit
export const Button = ({ children, ...props }) => (
  <button className="btn" {...props}>{children}</button>
)
Et tu l’utilises comme :

tsx
Copy
Edit
import { Button } from '@shared-ui/Button'
Configure les alias dans vite.config.ts :

ts
Copy
Edit
resolve: {
  alias: {
    '@shared-ui': path.resolve(__dirname, '../../packages/shared-ui/src'),
  }
}
🐳 PHASE 4 — Docker + Déploiement Coolify
🔹 Étape 9 : Créer un Dockerfile pour chaque app
Frontend (Vite) – Exemple apps/chercheur-frontend/Dockerfile :

Dockerfile
Copy
Edit
FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN pnpm install && pnpm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
Backend (FastAPI) :

Dockerfile
Copy
Edit
FROM python:3.11
WORKDIR /app
COPY . .
RUN pip install -r requirements.txt
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
🔹 Étape 10 : Déployer sur Coolify
Ajoute chaque app dans Coolify comme un service Dockerfile (ou Git-based).

Gère les domaines ou ports individuellement.

Ajoute des variables si besoin (API URL, etc.).

🔄 PHASE 5 — Améliorations continues
🟢 Chaque semaine/mois :
Factorise un peu plus.

Ajoute des tests (packages/shared-tests/ ?).

Ajoute une CI (GitHub Actions, GitLab CI, etc.)

Si besoin, ajoute un reverse proxy pour /chercheur et /therapiste.

🧠 Résumé du plan
Étape	Action
1	Créer monorepo + structure
2	Copier les apps sans casser le code
3	Lancer chaque app séparément
4	Garder les duplications pour l’instant
5	Extraire du code partagé progressivement
6	Dockeriser + préparer Coolify
7	Améliorer au fil du temps

Souhaites-tu que je te :

Génére un starter monorepo complet en .zip ?

Fournisse un docker-compose.yml pour tout lancer d’un coup ?

Crée des templates Dockerfile + Coolify YAML ?

Fasse un script pour la migration CRA → Vite ?

Tu peux me dire ce que tu préfères comme point de départ.








You said:
Continue


ChatGPT said:
Parfait 👇 Je vais continuer le plan d’action en te donnant les fichiers pratiques et des exemples concrets pour démarrer proprement.

🧰 PHASE 6 — Fichiers de démarrage utiles
1. 🔧 package.json (racine)
json
Copy
Edit
{
  "name": "monorepo",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev:chercheur": "pnpm --filter chercheur-frontend dev",
    "dev:therapiste": "pnpm --filter therapiste-frontend dev",
    "build:chercheur": "pnpm --filter chercheur-frontend build",
    "build:therapiste": "pnpm --filter therapiste-frontend build"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
2. 🔧 pnpm-workspace.yaml
yaml
Copy
Edit
packages:
  - "apps/*"
  - "packages/*"
3. 🔧 tsconfig.base.json (à la racine)
json
Copy
Edit
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Node",
    "lib": ["DOM", "DOM.Iterable", "ESNext"],
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "@shared-ui/*": ["packages/shared-ui/src/*"],
      "@shared-utils/*": ["packages/shared-utils/src/*"]
    }
  }
}
4. 🔧 Exemple vite.config.ts (chercheur-frontend)
ts
Copy
Edit
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  },
  resolve: {
    alias: {
      '@shared-ui': path.resolve(__dirname, '../../packages/shared-ui/src'),
      '@shared-utils': path.resolve(__dirname, '../../packages/shared-utils/src')
    }
  }
})
Même logique pour therapiste-frontend avec un port différent.

5. 📦 Exemple de shared-ui
packages/shared-ui/package.json
json
Copy
Edit
{
  "name": "@shared-ui",
  "version": "0.0.1",
  "main": "src/index.ts",
  "types": "src/index.ts"
}
packages/shared-ui/src/index.ts
ts
Copy
Edit
export * from './Button'
packages/shared-ui/src/Button.tsx
tsx
Copy
Edit
import React from 'react'

export const Button = ({ children, ...props }) => (
  <button className="px-4 py-2 rounded bg-blue-500 text-white" {...props}>
    {children}
  </button>
)
6. 🐳 Exemple Dockerfile (chercheur-frontend)
Dockerfile
Copy
Edit
# build phase
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN pnpm install && pnpm build

# serve phase
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
7. 🐳 Exemple Dockerfile (FastAPI)
Dockerfile
Copy
Edit
FROM python:3.11-slim
WORKDIR /app
COPY . .
RUN pip install --no-cache-dir -r requirements.txt
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
8. 🐳 (optionnel) docker-compose.yml
yaml
Copy
Edit
version: '3.8'

services:
  chercheur:
    build: ./apps/chercheur-frontend
    ports:
      - "5173:80"

  therapiste:
    build: ./apps/therapiste-frontend
    ports:
      - "5174:80"

  backend:
    build: ./apps/backend-api
    ports:
      - "8000:8000"
9. 🧠 Tips pour Coolify
Coolify détecte automatiquement les Dockerfile.

Si tu pousses ton monorepo sur GitHub ou GitLab :

Crée une app par dossier apps/* dans Coolify.

Utilise les scripts de build/déploiement qu’il génère automatiquement.

Tu peux aussi définir les env vars pour chaque app (ex: API_URL) via leur dashboard.
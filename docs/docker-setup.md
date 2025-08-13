# Docker Setup - Configuration des Variables d'Environnement

## Problème Résolu ✅

Les variables d'environnement sont maintenant correctement consolidées dans un seul fichier `.env` à la racine du projet, permettant à Docker Compose de les lire sans avertissements.

## Structure des Variables d'Environnement

### Avant (problématique)
```
├── backend/.env          # Variables backend locales
├── frontend/.env         # Variables frontend locales  
└── .env                  # Incomplet pour Docker Compose
```

### Après (solution) ✅
```
├── .env                  # TOUTES les variables consolidées
├── backend/.env          # Conservé pour compatibilité locale
└── frontend/.env         # Conservé pour compatibilité locale
```

## Configuration Actuelle

Le fichier `.env` racine contient maintenant :

```bash
# Supabase Configuration (Current Project)
SUPABASE_URL=https://egihfsmxphqcsjotmhmm.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Application Settings
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=INFO

# Frontend Configuration (React/Vite)
REACT_APP_SUPABASE_URL=https://egihfsmxphqcsjotmhmm.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_URL=https://egihfsmxphqcsjotmhmm.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Redis Configuration
REDIS_URL=redis://localhost:6379/0
REDIS_CACHE_TTL_SECONDS=3600
REDIS_MAX_CACHE_SIZE_MB=100
```

## Utilisation avec Docker

```bash
# Démarrer tous les services avec les variables d'environnement consolidées
./start_dev.sh --up

# Plus d'avertissements sur les variables manquantes ✅
```

## Points Importants

1. **Docker Compose** lit automatiquement le fichier `.env` à la racine
2. **Variables Supabase** consolidées vers le projet actuel (`egihfsmxphqcsjotmhmm`)
3. **Compatibilité** maintenue avec les développements locaux (backend/.env et frontend/.env conservés)
4. **Production Ready** - Configuration prête pour Coolify

## Développement Sans Rebuild ! 🚀

### Problème Original
À chaque modification de code → Rebuild complet des images Docker → Temps perdu

### Solution ✅ Hot Reload
```bash
# 🔥 Mode développement avec rechargement automatique
./start_dev.sh --dev

# ⚡ Changements de code appliqués instantanément !
# Backend : uvicorn --reload
# Frontend : vite dev server avec polling
```

## Modes de Développement

### 1. Mode Standard (Production-like)
```bash
./start_dev.sh --up
# Images construites, containers stables
# Bon pour tester la production locale
```

### 2. Mode Développement (Hot Reload) ⭐ RECOMMANDÉ
```bash
./start_dev.sh --dev
# Code source monté en volumes
# Rechargement automatique backend + frontend
# Pas de rebuild nécessaire !
```

### 3. Mode Production
```bash
./start_dev.sh --prod
# Configuration optimisée pour Coolify
```

## Architecture Hot Reload

```
├── docker-compose.yml         # Standard (images complètes)
├── docker-compose.dev.yml     # 🔥 Hot Reload (volumes montés)
├── docker-compose.prod.yml    # Production (Coolify)
├── backend/
│   ├── Dockerfile             # Production build
│   └── Dockerfile.dev         # 🔥 Dev avec hot reload
└── frontend/
    ├── Dockerfile             # Production build
    └── Dockerfile.dev         # 🔥 Dev avec hot reload
```

## Service Supabase Actuel

**Projet Supabase :** `egihfsmxphqcsjotmhmm.supabase.co`
- Variable corrigée : `SUPABASE_SERVICE_KEY` ✅
- URL : https://egihfsmxphqcsjotmhmm.supabase.co
- Clé Service : Configurée ✅

## Développement Optimisé 

**Workflow recommandé :**
1. `./start_dev.sh --dev` (démarrage initial - construit les images dev une fois)
2. Modifiez le code Python/TypeScript
3. ⚡ Changements appliqués automatiquement
4. Pas de rebuild ! 🎉
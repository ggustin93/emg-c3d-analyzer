│ 🔍 RECHERCHE EXHAUSTIVE ET PLAN DE CORRECTION COMPLET                                                                        │ │
│ │                                                                                                                              │ │
│ │ 📊 RÉSULTAT DE LA RECHERCHE EXHAUSTIVE                                                                                       │ │
│ │                                                                                                                              │ │
│ │ 1️⃣ Variables API Backend (Conflit VITE_API_URL vs VITE_BACKEND_URL                                                          │ │
│ │                                                                                                                              │ │
│ │ Fichiers utilisant VITE_API_URL (7 fichiers):                                                                                │ │
│ │ 1. frontend/src/services/therapistService.ts:12                                                                              │ │
│ │ 2. frontend/src/services/clinicalNotesService.ts:20                                                                          │ │
│ │ 3. frontend/src/AppContent.tsx:263,339,422,460                                                                               │ │
│ │ 4. frontend/src/components/c3d/FileUpload.tsx:6                                                                              │ │
│ │ 5. frontend/src/vite-env.d.ts:7 (déclaration TypeScript)                                                                     │ │
│ │ 6. docker/.env.example:35                                                                                                    │ │
│ │                                                                                                                              │ │
│ │ Fichiers utilisant VITE_BACKEND_URL (5 fichiers):                                                                            │ │
│ │ 1. frontend/src/services/mvcService.ts:34                                                                                    │ │
│ │ 2. frontend/src/hooks/useLiveAnalytics.ts:53                                                                                 │ │
│ │ 3. frontend/src/hooks/useBackendDefaults.ts:24                                                                               │ │
│ │ 4. frontend/src/tests/clinicalNotesIntegration.test.ts:124                                                                   │ │
│ │ 5. frontend/src/hooks/__tests__/useBackendDefaults.test.ts:14                                                                │ │
│ │ 6. frontend/.env:2 (définition actuelle)                                                                                     │ │
│ │ 7. frontend/.env.example:7                                                                                                   │ │
│ │ 8. frontend/src/vite-env.d.ts:8 (déclaration TypeScript)                                                                     │ │
│ │                                                                                                                              │ │
│ │ 2️⃣ Redondance Supabase Key                                                                                                  │ │
│ │                                                                                                                              │ │
│ │ PROBLÈME IDENTIFIÉ:                                                                                                          │ │
│ │ - .env:6 : SUPABASE_ANON_KEY=eyJhbGc... (backend)                                                                            │ │
│ │ - .env:7 : SUPABASE_KEY=eyJhbGc... (même valeur exacte!)                                                                     │ │
│ │ - .env:22 : VITE_SUPABASE_ANON_KEY=eyJhbGc... (frontend)                                                                     │ │
│ │ - .env:20 : REACT_APP_SUPABASE_ANON_KEY=... (vestige Create React App)                                                       │ │
│ │                                                                                                                              │ │
│ │ Utilisation actuelle:                                                                                                        │ │
│ │ - Backend: SUPABASE_ANON_KEY (6 fichiers Python)                                                                             │ │
│ │ - Frontend: VITE_SUPABASE_ANON_KEY (4 fichiers TypeScript)                                                                   │ │
│ │                                                                                                                              │ │
│ │ ---                                                                                                                          │ │
│ │ 🛠️ PLAN DE CORRECTION DÉTAILL                                                                                               │ │
│ │                                                                                                                              │ │
│ │ PHASE 1: Créer Configuration Centralisée (Single Source of Truth)                                                            │ │
│ │                                                                                                                              │ │
│ │ 1. Créer frontend/src/config/apiConfig.ts                                                                                    │ │
│ │ // Single Source of Truth pour la configuration API                                                                          │ │
│ │ export const API_CONFIG = {                                                                                                  │ │
│ │   baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:8080',                                                          │ │
│ │   timeout: 30000,                                                                                                            │ │
│ │   retries: 3                                                                                                                 │ │
│ │ } as const;                                                                                                                  │ │
│ │                                                                                                                              │ │
│ │ export const validateApiConfig = (): void => {                                                                               │ │
│ │   if (!API_CONFIG.baseUrl) {                                                                                                 │ │
│ │     throw new Error('VITE_API_URL is required');                                                                             │ │
│ │   }                                                                                                                          │ │
│ │ };                                                                                                                           │ │
│ │                                                                                                                              │ │
│ │ PHASE 2: Standardiser les Variables d'Environnement                                                                          │ │
│ │                                                                                                                              │ │
│ │ 2. Mettre à jour .env (root)                                                                                                 │ │
│ │ # Backend Configuration                                                                                                      │ │
│ │ VITE_API_URL=http://localhost:8080  # Remplacer VITE_BACKEND_URL                                                             │ │
│ │                                                                                                                              │ │
│ │ # Supabase Configuration                                                                                                     │ │
│ │ SUPABASE_URL=https://egihfsmxphqcsjotmhmm.supabase.co                                                                        │ │
│ │ SUPABASE_ANON_KEY=eyJhbGc...  # Backend + Frontend                                                                           │ │
│ │ # SUPPRIMER: SUPABASE_KEY (redondant)                                                                                        │ │
│ │ # SUPPRIMER: REACT_APP_SUPABASE_ANON_KEY (vestige)                                                                           │ │
│ │ VITE_SUPABASE_URL=https://egihfsmxphqcsjotmhmm.supabase.co                                                                   │ │
│ │ VITE_SUPABASE_ANON_KEY=eyJhbGc...                                                                                            │ │
│ │                                                                                                                              │ │
│ │ 3. Créer .env.production                                                                                                     │ │
│ │ VITE_API_URL=https://emg-c3d-analyzer-backend.onrender.com                                                                   │ │
│ │                                                                                                                              │ │
│ │ PHASE 3: Remplacements Bulk (Find & Replace)                                                                                 │ │
│ │                                                                                                                              │ │
│ │ 🔄 Remplacements Frontend (12 fichiers)                                                                                      │ │
│ │                                                                                                                              │ │
│ │ Étape 1: Remplacer les imports directs par la configuration centralisée                                                      │ │
│ │                                                                                                                              │ │
│ │ | Fichier                                             | Ligne           | Remplacer                                          │ │
│ │           | Par                                                                              |                               │ │
│ │ |-----------------------------------------------------|-----------------|--------------------------------------------------- │ │
│ │ ----------|----------------------------------------------------------------------------------|                               │ │
│ │ | frontend/src/services/therapistService.ts           | 12              | import.meta.env.VITE_API_URL ||                    │ │
│ │ 'http://localhost:8080'     | Import: import { API_CONFIG } from '@/config/apiConfig'Usage: API_CONFIG.baseUrl |             │ │
│ │ | frontend/src/services/clinicalNotesService.ts       | 20              | (import.meta.env.VITE_API_URL ||                   │ │
│ │ 'http://localhost:8080')   | API_CONFIG.baseUrl                                                               |              │ │
│ │ | frontend/src/services/mvcService.ts                 | 34              | import.meta.env.VITE_BACKEND_URL ||                │ │
│ │ 'http://localhost:8080' | API_CONFIG.baseUrl                                                               |                 │ │
│ │ | frontend/src/AppContent.tsx                         | 263,339,422,460 | import.meta.env.VITE_API_URL ||                    │ │
│ │ 'http://localhost:8080'     | API_CONFIG.baseUrl                                                               |             │ │
│ │ | frontend/src/components/c3d/FileUpload.tsx          | 6               | import.meta.env.VITE_API_URL ||                    │ │
│ │ 'http://localhost:8080'     | API_CONFIG.baseUrl                                                               |             │ │
│ │ | frontend/src/hooks/useLiveAnalytics.ts              | 53              | import.meta.env.VITE_BACKEND_URL ||                │ │
│ │ 'http://localhost:8080' | API_CONFIG.baseUrl                                                               |                 │ │
│ │ | frontend/src/hooks/useBackendDefaults.ts            | 24              | import.meta.env.VITE_BACKEND_URL ||                │ │
│ │ 'http://localhost:8080' | API_CONFIG.baseUrl                                                               |                 │ │
│ │ | frontend/src/tests/clinicalNotesIntegration.test.ts | 124             | import.meta.env.VITE_BACKEND_URL ||                │ │
│ │ 'http://localhost:8080' | API_CONFIG.baseUrl                                                               |                 │ │
│ │                                                                                                                              │ │
│ │ Étape 2: Nettoyer vite-env.d.ts                                                                                              │ │
│ │ // Supprimer VITE_BACKEND_URL, garder seulement:                                                                             │ │
│ │ readonly VITE_API_URL?: string;                                                                                              │ │
│ │ // Supprimer SUPABASE_KEY                                                                                                    │ │
│ │                                                                                                                              │ │
│ │ Étape 3: Commandes Find & Replace pour VS Code                                                                               │ │
│ │                                                                                                                              │ │
│ │ # 1. VITE_API_URL pattern                                                                                                    │ │
│ │ Find: import\.meta\.env\.VITE_API_URL \|\| 'http://localhost:8080'                                                           │ │
│ │ Replace: API_CONFIG.baseUrl                                                                                                  │ │
│ │                                                                                                                              │ │
│ │ # 2. VITE_BACKEND_URL pattern                                                                                                │ │
│ │ Find: import\.meta\.env\.VITE_BACKEND_URL \|\| 'http://localhost:8080'                                                       │ │
│ │ Replace: API_CONFIG.baseUrl                                                                                                  │ │
│ │                                                                                                                              │ │
│ │ # 3. Clean up redundant Supabase keys                                                                                        │ │
│ │ Find: SUPABASE_KEY=                                                                                                          │ │
│ │ Replace: # REMOVED - Use SUPABASE_ANON_KEY                                                                                   │ │
│ │                                                                                                                              │ │
│ │ # 4. Clean up React App legacy                                                                                               │ │
│ │ Find: REACT_APP_SUPABASE_ANON_KEY                                                                                            │ │
│ │ Replace: # REMOVED - Use VITE_SUPABASE_ANON_KEY                                                                              │ │
│ │                                                                                                                              │ │
│ │ PHASE 4: Nettoyage des Variables Redondantes                                                                                 │ │
│ │                                                                                                                              │ │
│ │ Supprimer ces lignes de .env:                                                                                                │ │
│ │ - Ligne 7: SUPABASE_KEY=... (redondant avec SUPABASE_ANON_KEY)                                                               │ │
│ │ - Ligne 20: REACT_APP_SUPABASE_ANON_KEY=... (vestige Create React App)                                                       │ │
│ │                                                                                                                              │ │
│ │ PHASE 5: Configuration Vercel                                                                                                │ │
│ │                                                                                                                              │ │
│ │ Variables à configurer dans Vercel Dashboard:                                                                                │ │
│ │ VITE_API_URL=https://emg-c3d-analyzer-backend.onrender.com                                                                   │ │
│ │ VITE_SUPABASE_URL=https://egihfsmxphqcsjotmhmm.supabase.co                                                                   │ │
│ │ VITE_SUPABASE_ANON_KEY=[your-anon-key]                                                                                       │ │
│ │                                                                                                                              │ │
│ │ PHASE 6: Validation                                                                                                          │ │
│ │                                                                                                                              │ │
│ │ Tests à effectuer:                                                                                                           │ │
│ │ 1. Build local: npm run build                                                                                                │ │
│ │ 2. Test unitaires: npm test                                                                                                  │ │
│ │ 3. Vérifier tous les appels API                                                                                              │ │
│ │ 4. Déployer sur Vercel et tester                                                                                             │ │
│ │                                                                                                                              │ │
│ │ ---                                                                                                                          │ │
│ │ ✅ BÉNÉFICES                                                                                                                  │ │
│ │                                                                                                                              │ │
│ │ - KISS: Une seule variable par fonction                                                                                      │ │
│ │ - DRY: Pas de duplication (SUPABASE_KEY supprimé)                                                                            │ │
│ │ - SSoT: Configuration centralisée dans apiConfig.ts                                                                          │ │
│ │ - YAGNI: Suppression des variables legacy (REACT_APP_*)                                                                      │ │
│ │ - Maintenabilité: Un seul endroit pour changer l'URL backend                                                                 │ │
│ │                                                                                                                              │ │
│ │ 📋 CHECKLIST D'EXÉCUTION                                                                                                     │ │
│ │                                                                                                                              │ │
│ │ - Créer frontend/src/config/apiConfig.ts                                                                                     │ │
│ │ - Mettre à jour .env (renommer VITE_BACKEND_URL → VITE_API_URL)                                                              │ │
│ │ - Supprimer variables redondantes (SUPABASE_KEY, REACT_APP_*)                                                                │ │
│ │ - Find & Replace dans les 12 fichiers frontend                                                                               │ │
│ │ - Nettoyer vite-env.d.ts                                                                                                     │ │
│ │ - Configurer Vercel Dashboard                                                                                                │ │
│ │ - Tester localement                                                                                                          │ │
│ │ - Déployer et valider en production        
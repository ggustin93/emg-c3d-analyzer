# Database Schema Improvement Proposal

## Problème actuel
- Table `therapy_sessions` trop rigide avec colonnes NOT NULL techniques
- Impossible de créer session sans données EMG complètes
- Viole le principe KISS par complexité artificielle

## Solution KISS recommandée

### Phase 1 : Session de base (créée immédiatement par webhook)
```sql
-- Table simplifiée pour métadonnées de session uniquement
CREATE TABLE therapy_sessions (
    id UUID PRIMARY KEY,
    file_path TEXT NOT NULL,
    file_hash TEXT UNIQUE NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    patient_id TEXT,
    processing_status TEXT NOT NULL DEFAULT 'pending',
    original_filename TEXT NOT NULL,
    game_metadata JSONB DEFAULT '{}',
    analytics_cache JSONB DEFAULT '{}',
    cache_hits INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Phase 2 : Données techniques (ajoutées après traitement C3D)
```sql  
-- Table séparée pour données techniques EMG (nullable par design)
CREATE TABLE c3d_technical_data (
    session_id UUID REFERENCES therapy_sessions(id) ON DELETE CASCADE,
    original_sampling_rate REAL,
    original_duration_seconds REAL,
    original_sample_count INTEGER,
    channel_count INTEGER,
    channel_names TEXT[],
    sampling_rate REAL,
    duration_seconds REAL,
    frame_count INTEGER,
    extracted_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (session_id)
);
```

## Avantages KISS
1. **Séparation des responsabilités** : Session metadata vs données techniques
2. **Création progressive** : Webhook crée session → Traitement ajoute données techniques
3. **Pas de valeurs par défaut artificielles** 
4. **Schema plus lisible et maintenable**
5. **Possibilité de sessions sans C3D (futurs cas d'usage)**

## Migration
1. Créer nouvelle table `c3d_technical_data` 
2. Migrer colonnes techniques de `therapy_sessions` vers `c3d_technical_data`
3. Supprimer colonnes techniques de `therapy_sessions`
4. Adapter metadata_service pour utiliser les 2 tables

## Impact sur le code
- `metadata_service.py` : Création en 2 étapes (session puis données techniques)
- `cache_service.py` : Inchangé (utilise analytics_cache dans therapy_sessions)
- `webhook_service.py` : Plus simple (pas besoin de valeurs par défaut)

Cette approche respecte vraiment le principe KISS en simplifiant chaque table pour une responsabilité unique.
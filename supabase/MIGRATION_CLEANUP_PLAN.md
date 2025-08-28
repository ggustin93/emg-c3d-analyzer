# Migration Cleanup & Supabase CLI Strategy

## 🎯 Objectif
Nettoyer les anciennes migrations et appliquer le nouveau schéma clean avec Supabase CLI.

## 📁 Ancien State (à archiver)
```
supabase/migrations/ - 10 fichiers de migrations anciennes
├── 001_create_c3d_metadata.sql
├── 002_create_analysis_cache.sql  
├── 009_enhanced_mvp_schema_with_scoring_fields.sql
├── 010_replace_processing_parameters_simplified.sql
├── 020_database_schema_separation_kiss_corrected.sql
├── 021_cleanup_therapy_sessions_table.sql
├── 022_remove_emg_signals_storage.sql
├── add_performance_enhancements.sql
├── add_therapist_patient_scoring_config.sql
├── create_researcher_profiles_table.sql
├── create_session_settings_table.sql
└── setup-supabase-storage.sql
```

## 🆕 Nouveau State (clean)
```
supabase/
├── migrations/
│   └── 20250827000000_clean_schema_v2.sql  # Notre nouveau schéma
├── 100_clean_schema_from_scratch.sql       # Source master
├── seed.sql                               # Données de test
└── config.toml                           # Configuration Supabase
```

## 🔧 Plan d'exécution avec Supabase CLI

### Étape 1: Archive des anciennes migrations
```bash
# Créer dossier d'archive
mkdir -p supabase/migrations/archive/

# Déplacer toutes les anciennes migrations
mv supabase/migrations/*.sql supabase/migrations/archive/

# Garder uniquement config.toml et le dossier migrations vide
```

### Étape 2: Créer nouvelle migration avec Supabase CLI
```bash
# Se connecter à Supabase (si pas encore fait)
supabase login

# Générer une nouvelle migration basée sur notre schéma clean
supabase db diff --schema public --schema private > supabase/migrations/20250827000000_clean_schema_v2.sql

# OU créer manuellement la migration
cp 100_clean_schema_from_scratch.sql supabase/migrations/20250827000000_clean_schema_v2.sql
```

### Étape 3: Reset et application du nouveau schéma
```bash
# Reset de la DB locale (destructif!)
supabase db reset

# Appliquer les nouvelles migrations
supabase db push

# Vérifier le schéma appliqué
supabase db diff
```

### Étape 4: Déploiement en production
```bash
# Générer le SQL pour production
supabase db diff --linked

# Appliquer sur la DB cloud
supabase db push --linked
```

## 🔍 Validation post-migration

### Tests à exécuter:
1. **Schema validation**: Vérifier toutes les tables créées
2. **RLS policies**: Tester les politiques de sécurité  
3. **Constraints**: Valider les contraintes et index
4. **Seed data**: Insérer données de test
5. **Backend integration**: Tester therapy_session_processor.py

### Commandes de validation:
```sql
-- Compter les tables créées
SELECT schemaname, count(*) 
FROM pg_tables 
WHERE schemaname IN ('public', 'private') 
GROUP BY schemaname;

-- Vérifier les policies RLS
SELECT schemaname, tablename, policyname, cmd 
FROM pg_policies 
WHERE schemaname IN ('public', 'private');

-- Tester l'insertion d'un user_profile
INSERT INTO public.user_profiles (id, role, first_name, last_name) 
VALUES (gen_random_uuid(), 'therapist', 'Test', 'User');
```

## ⚠️ Points d'attention

1. **Destructif**: `supabase db reset` détruit toutes les données
2. **Backup**: Faire un backup avant reset si données importantes
3. **Redis**: S'assurer que Redis est configuré pour le cache service
4. **Config**: Mettre à jour les variables d'environnement Redis
5. **Tests**: Relancer la suite de tests complète après migration

## 🚀 Avantages du nouveau schéma

- ✅ **Performance**: Redis cache (~100x plus rapide que DB)
- ✅ **Sécurité**: RLS policies granulaires + séparation public/private  
- ✅ **Simplicité**: UUID patient_id + unified user_profiles
- ✅ **RGPD**: Séparation PII dans private schema
- ✅ **Maintenance**: Architecture plus simple et extensible
- ✅ **MVP**: Suppression des champs médicaux complexes
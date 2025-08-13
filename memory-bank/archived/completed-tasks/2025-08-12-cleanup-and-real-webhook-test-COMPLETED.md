# Nettoyage des Fichiers et Test Webhook Réel - Plan d'Exécution

**Date**: 2025-08-12  
**Objectif**: Nettoyer les fichiers non utilisés et tester le webhook avec un vrai fichier C3D via Supabase MCP

## Phase 1: Identification des Fichiers Non Utilisés

### 1.1 Analyse du Codebase
- [ ] Scanner les fichiers dans `/backend/services/` pour identifier les services obsolètes
- [ ] Vérifier les migrations non appliquées ou redondantes
- [ ] Identifier les fichiers de test orphelins ou dupliqués
- [ ] Analyser les imports et références pour détecter le code mort

### 1.2 Fichiers Suspects Identifiés
- `backend/services/mvp_processor.py` - Possiblement remplacé par enhanced_webhook_service.py
- `backend/services/stats_first_processor.py` - Service alternatif non utilisé
- `backend/services/stats_first_webhook_service.py` - Service webhook alternatif  
- `migrations/006_create_statistics_schema.sql` - Migration ancienne version
- `migrations/007_create_backward_compatibility_views.sql` - Vues de compatibilité
- `migrations/008_simplify_to_mvp_schema.sql` - Migration intermédiaire

## Phase 2: Nettoyage des Fichiers Obsolètes

### 2.1 Services Redondants
- [ ] Analyser `mvp_processor.py` vs `enhanced_webhook_service.py`
- [ ] Vérifier si `stats_first_*` services sont référencés quelque part
- [ ] Supprimer les services non utilisés après validation

### 2.2 Migrations Anciennes
- [ ] Garder seulement Migration 009 (version finale enhanced)
- [ ] Archiver les migrations intermédiaires dans `/memory-bank/archived/`
- [ ] Mettre à jour la documentation de migration

### 2.3 Tests Orphelins
- [ ] Nettoyer `test_stats_first_processor.py` (erreur d'import)
- [ ] Consolider les tests webhook en évitant la duplication

## Phase 3: Test Webhook avec Supabase MCP

### 3.1 Configuration Supabase MCP
- [ ] Utiliser `mcp__supabase__list_projects` pour identifier le projet
- [ ] Vérifier les buckets storage avec les outils MCP
- [ ] Configurer l'accès au bucket `c3d-examples`

### 3.2 Upload et Test de Fichier C3D Réel
- [ ] Utiliser Supabase MCP pour uploader un vrai fichier C3D
- [ ] Déclencher le webhook automatiquement
- [ ] Suivre le processing en temps réel via logs

### 3.3 Validation Pipeline Complet
- [ ] Vérifier que `processing_parameters` est correctement peuplé
- [ ] Valider que `performance_scoring_service` calcule les scores
- [ ] Tester la récupération des résultats via API

## Phase 4: Validation et Documentation

### 4.1 Tests de Régression
- [ ] S'assurer que le nettoyage n'a pas cassé de fonctionnalité
- [ ] Vérifier que tous les tests existants passent toujours
- [ ] Tester le workflow frontend → backend après nettoyage

### 4.2 Documentation des Changements
- [ ] Documenter les fichiers supprimés et pourquoi
- [ ] Mettre à jour `/docs/` si nécessaire
- [ ] Archiver les informations importantes dans memory-bank

## Stratégie d'Exécution

### Ordre des Opérations
1. **Identification d'abord**: Scanner et lister sans supprimer
2. **Validation croisée**: Vérifier les dépendances avant suppression
3. **Nettoyage prudent**: Supprimer par étapes avec commit entre chaque
4. **Test immédiat**: Tester après chaque suppression importante
5. **Rollback ready**: Maintenir la possibilité de revenir en arrière

### Critères de Sécurité
- ✅ Ne supprimer que les fichiers avec 0 référence dans le codebase
- ✅ Archiver dans memory-bank avant suppression définitive
- ✅ Tester le build après chaque suppression
- ✅ Maintenir un commit par type de nettoyage pour traçabilité

### Points de Validation
- **Backend**: `python -m pytest tests/webhook/ -v`
- **Frontend**: `npm test -- --run`  
- **Build**: `npm run build`
- **Webhook réel**: Test avec fichier C3D via Supabase MCP

## Résultat Attendu

🎯 **Codebase nettoyé** avec seulement les fichiers essentiels et utilisés
🧪 **Pipeline webhook testé** avec de vraies données C3D via Supabase MCP  
📊 **Performance validée** avec processing complet end-to-end
🚀 **Production ready** avec codebase optimisé et validé

## Approbation Requise

Ce plan va supprimer des fichiers du codebase. Veuillez approuver avec "ACT" pour procéder au nettoyage et aux tests.
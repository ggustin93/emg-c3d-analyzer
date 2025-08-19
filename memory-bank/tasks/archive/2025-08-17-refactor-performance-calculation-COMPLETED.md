# Plan de Refactoring du Calcul de Performance

**Date**: 2025-08-17
**Auteur**: Gemini 2.5 Pro (Expert Software Engineer)
**Statut**: PENDING

## Objectif

Corriger l'erreur de calcul dans le composant `OverallPerformanceCard` en refactorisant l'architecture frontend pour suivre les meilleures pratiques : Single Source of Truth (SSoT), Don't Repeat Yourself (DRY), et Single Responsibility Principle (SRP).

## Problème Actuel

1.  **Logique Dupliquée** : Le composant recalcule un score total alors qu'il en reçoit déjà un via ses props, créant des incohérences.
2.  **Violation SRP** : Le composant UI contient une logique métier complexe qui devrait être externalisée.
3.  **Absence de SSoT** : La logique de calcul est dispersée, rendant le code difficile à maintenir, à tester et à déboguer.

## Architecture Cible

-   **Backend (`performance_scoring_service.py`)**: Reste la source de vérité canonique pour le stockage et les rapports officiels.
-   **Frontend (`performanceUtils.ts`)**: Devient le moteur de feedback immédiat pour une UX réactive (calcul prédictif/simulé).

---

## Plan d'Action Détaillé

### Phase 1 : Centraliser la Logique Métier dans un Service Dédié

-   [x] **Tâche 1.1 : Créer le Fichier de Service**
    -   Créer un nouveau fichier : `frontend/src/lib/performanceUtils.ts`. Ce fichier hébergera toute la logique de calcul de performance pour le frontend.

-   [x] **Tâche 1.2 : Implémenter la Fonction de Calcul**
    -   Développer une fonction pure `calculateOverallPerformance` dans `performanceUtils.ts`.
    -   **Inputs**: `scores: { compliance, symmetry, effort, game }`, `weights: ScoringWeights`.
    -   **Outputs**: Un objet structuré : `{ totalScore: number, contributions: { compliance: number, ... }, strongestDriver: string }`.
    -   La logique doit être conforme à `memory-bank/metricsDefinitions.md`.
    -   Gérer les cas où les scores ou les poids sont `undefined` ou `null`.

### Phase 2 : Refactoriser le Hook pour Utiliser le Service

-   [x] **Tâche 2.1 : Localiser le Hook**
    -   Identifier le hook responsable, `frontend/src/hooks/usePerformanceMetrics.ts`.

-   [x] **Tâche 2.2 : Intégrer le Service de Calcul**
    -   Modifier `usePerformanceMetrics.ts` pour importer et appeler `calculateOverallPerformance`.
    -   Le hook sera responsable de collecter les données brutes (depuis les résultats d'analyse, le store Zustand, etc.) et de les passer au nouveau service.
    -   Le hook retournera l'objet de performance complet et structuré.

### Phase 3 : Simplifier le Composant UI

-   [x] **Tâche 3.1 : Transformer `OverallPerformanceCard.tsx` en Composant de Présentation**
    -   Supprimer toute la logique de calcul interne du composant (la `IIFE` calculant `contributions`, `total`, `top`).
    -   Modifier l'interface `OverallPerformanceCardProps` pour accepter directement l'objet retourné par le hook : `performanceData: { totalScore, contributions, ... }`.

-   [x] **Tâche 3.2 : Mettre à Jour le Composant Parent**
    -   Ajuster `frontend/src/components/tabs/shared/performance-card.tsx`.
    -   Il devra passer la nouvelle prop `performanceData` de `usePerformanceMetrics` à `OverallPerformanceCard`.

### Phase 4 : Validation

-   [x] **Tâche 4.1 : Test Visuel et de Cohérence**
    -   Vérifier que le score global affiché est correct.
    -   Valider que les détails dans la section dépliable (formule, contributions individuelles, total) sont cohérents et correspondent au calcul centralisé.

-   [x] **Tâche 4.2 : Test de Réactivité**
    -   Naviguer vers `Settings -> Performance`.
    -   Modifier les poids et confirmer que le score sur la page de performance se met à jour instantanément et correctement.

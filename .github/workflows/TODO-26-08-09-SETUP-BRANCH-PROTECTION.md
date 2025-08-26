# TODO: Configurer la Protection de Branche via la CLI GitHub

**Date**: 2025-08-26

**Objectif**: Mettre en place une règle de protection pour la branche `main` de manière programmée pour garantir la stabilité et la qualité du code.

---

### **1. Prérequis**

Avant d'exécuter la commande, assurez-vous d'avoir :

1.  **Installé la GitHub CLI (`gh`)**. Si ce n'est pas le cas, suivez les instructions sur [cli.github.com](https://cli.github.com/).
2.  **Authentifié la CLI**. Lancez `gh auth login` et suivez les étapes. Vous devez avoir des droits d'administration sur le dépôt `ggustin93/emg-c3d-analyzer` pour que cela fonctionne.

---

### **2. Commande de Création de la Règle**

Copiez-collez et exécutez la commande suivante **depuis la racine de votre dépôt local**.

Elle est formatée sur plusieurs lignes pour la lisibilité, mais elle fonctionnera telle quelle dans votre terminal.

```bash
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  /repos/ggustin93/emg-c3d-analyzer/branches/main/protection \
  -f required_status_checks[strict]=true \
  -f required_status_checks[checks][0][context]="backend-test" \
  -f required_status_checks[checks][1][context]="frontend-test" \
  -f required_status_checks[checks][2][context]="integration-test" \
  -f required_status_checks[checks][3][context]="quality-checks" \
  -f 'enforce_admins=true' \
  -f 'required_pull_request_reviews=null' \
  -f 'restrictions=null'
```

---

### **3. Explication des Paramètres**

Voici ce que chaque partie de la commande signifie :

*   `gh api ... /repos/.../protection` : Cible le point de terminaison de l'API pour la protection de la branche `main` de votre dépôt.
*   `--method PUT` : Indique que nous voulons créer ou remplacer complètement la règle existante.
*   `required_status_checks[strict]=true` : Coche la case "Require branches to be up to date before merging". La PR doit être synchronisée avec `main` avant de pouvoir être fusionnée.
*   `required_status_checks[checks][...][context]="..."` : C'est ici que nous listons les noms **exacts** des jobs de notre CI qui doivent réussir.
*   `enforce_admins=true` : Applique cette règle aux administrateurs du dépôt (vous y compris). C'est une sécurité cruciale.
*   `required_pull_request_reviews=null` : Nous ne configurons pas d'exigence de revue de code pour l'instant, bien que ce soit une bonne pratique à ajouter plus tard.
*   `restrictions=null` : Nous n'empêchons pas des équipes ou des personnes spécifiques de pousser sur la branche (ce sera géré par l'exigence de PR).

---

### **4. Vérification**

Après avoir exécuté la commande, vous pouvez vérifier que la règle est bien en place de deux manières :

1.  **Via l'interface web** : Allez dans `Settings > Branches` sur votre dépôt GitHub. Vous devriez voir la règle pour `main` avec toutes les options cochées.
2.  **Via la CLI** (pour tout faire en ligne de commande) :
    ```bash
    gh api /repos/ggustin93/emg-c3d-analyzer/branches/main/protection
    ```
    Cette commande vous retournera un JSON décrivant la configuration de protection active.

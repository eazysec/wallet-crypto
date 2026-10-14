# Roadmap — Plan d'action correctif et pistes d'évolution

> Document de planification. **Aucune correction n'est implémentée ici.** Il
> ordonne les actions par impact (sécurité des fonds → intégrité des
> transactions → fiabilité → maintenabilité), précise les dépendances entre
> actions, l'effort estimé et les critères de validation.
>
> **Effort** (ordre de grandeur, indicatif) : S ≈ ½–1 j · M ≈ 2–4 j · L ≈ 1–2
> sem. À confirmer selon l'équipe et la décision sur le format de distribution
> (cf. PRD Q3).

## 1. Principes de priorisation

1. Ce qui protège **directement les clés privées et les fonds** passe avant tout.
2. Ce qui garantit que **l'utilisateur signe bien ce qu'il croit** vient ensuite.
3. Puis la **maîtrise de la chaîne de dépendances** (raison d'être du projet).
4. Enfin la **fiabilité** (tests) et la **maintenabilité**.

⚠️ **Prérequis transverse** : plusieurs corrections (P0-1) **changent le format
du fichier wallet**. Décider dès le départ d'un **format versionné** et d'une
**stratégie de migration** pour ne pas casser les wallets existants.

---

## 2. Phase P0 — Correctifs de sécurité bloquants

> Objectif : rendre le chiffrement réellement sûr et empêcher l'exposition
> directe des secrets. **À faire avant tout usage avec de vrais fonds.**

### P0-1 — Dérivation de clé + chiffrement authentifié
- **Traite** : [F-01](findings.md#f-01) (Critique), [F-02](findings.md#f-02) (Élevée).
- **Actions** : remplacer `SHA-256(mdp)` par **PBKDF2-HMAC-SHA-256 ≥ 600 000
  itérations** (ou scrypt/Argon2id) avec **sel aléatoire 16 o** ; passer en
  **AES-256-GCM** ; définir un **format de fichier versionné**
  (`{v, kdf, salt, iter, iv, ct, tag}`).
- **Dépendances** : WebCrypto fournit PBKDF2 + AES-GCM nativement (pas de
  dépendance ajoutée). Coordonner avec P2 (bundle) si l'on préfère Argon2.
- **Effort** : M.
- **Validation** : tests round-trip chiffrer/déchiffrer ; vecteurs KDF connus ;
  mauvais mot de passe → échec d'**authentification** explicite (pas un
  `JSON.parse` fortuit) ; ancien format encore lisible via chemin de migration.

### P0-2 — Rendre le chiffrement obligatoire / bannir l'export en clair
- **Traite** : [F-04](findings.md#f-04) (Élevée).
- **Actions** : supprimer le chemin d'export en clair par défaut ; imposer un mot
  de passe (avec jauge d'entropie) ; si export clair conservé, exiger
  confirmation explicite + avertissement bloquant.
- **Dépendances** : s'appuie sur P0-1.
- **Effort** : S.
- **Validation** : impossible d'obtenir un fichier wallet non chiffré sans action
  délibérée et avertie.

### P0-3 — Saisie masquée des secrets + nettoyage DOM honnête
- **Traite** : [F-05](findings.md#f-05) (Moyenne), [F-03](findings.md#f-03) (Élevée).
- **Actions** : remplacer les `prompt()` par des champs `type="password"`
  dédiés ; vider les champs DOM (`#seedphrase`, `#walletfulljs`…) après usage ;
  **retirer les commentaires/prétentions d'« effacement mémoire »** et
  documenter la réalité JS.
- **Effort** : S–M.
- **Validation** : aucun secret affiché en clair par défaut ; champs vidés après
  opération ; documentation corrigée.

---

## 3. Phase P1 — Intégrité du workflow air-gap

### P1-1 — Vérification lisible AVANT signature (offline)
- **Traite** : [F-06](findings.md#f-06) (Élevée).
- **Actions** : porter le décodeur `decode()` (aujourd'hui dans
  `2.3…send/script.js`) et l'affichage récapitulatif dans la page **2.2
  (signature)** ; exiger une **confirmation explicite** du type, montant,
  destinataire et frais **avant** de signer.
- **Dépendances** : favorisé par P3-1 (module partagé pour éviter la duplication
  du décodeur).
- **Effort** : M.
- **Validation** : impossible de signer sans avoir vu et confirmé le
  récapitulatif lisible ; parité du décodage entre 2.2 et 2.3.

### P1-2 — Blocage des opérations sensibles si en ligne
- **Traite** : [F-07](findings.md#f-07) (Moyenne).
- **Actions** : désactiver génération et signature quand `navigator.onLine` ;
  message explicite + dérogation volontaire tracée ; ne pas présenter cela comme
  une garantie d'isolation (indicatif).
- **Effort** : S.
- **Validation** : boutons sensibles inactifs en ligne sans dérogation
  consciente.

### P1-3 — `tfPartialPayment` maîtrisé
- **Traite** : [F-12](findings.md#f-12) (Moyenne).
- **Actions** : ne pas activer par défaut ; si conservé, ajouter `DeliverMin` et
  l'afficher dans les récapitulatifs (préparation **et** vérification).
- **Effort** : S.
- **Validation** : montant minimum garanti visible ; cohérence montant
  affiché / livré.

---

## 4. Phase P2 — Maîtrise de la chaîne de dépendances

### P2-1 — Rapatriement local de toutes les dépendances + CSP
- **Traite** : [F-08](findings.md#f-08) (Élevée), [F-10](findings.md#f-10) (Moyenne),
  [F-11](findings.md#f-11) (Faible).
- **Actions** : héberger localement bundle + jQuery + Bootstrap (stable, figé)
  pour les **4 pages** ; ajouter une **CSP** stricte (offline : aucune origine
  réseau ; online : liste blanche) ; conserver le SRI.
- **Effort** : M.
- **Validation** : aucune requête vers un CDN tiers ; CSP active ; pages online
  fonctionnelles avec liste blanche minimale.

### P2-2 — Reconstruction auditable du bundle crypto
- **Traite** : [F-09](findings.md#f-09) (Moyenne / à confirmer).
- **Actions** : reconstruire `SecureWalletBundle` depuis des sources **épinglées
  et auditables** (xrpl.js, stellar-sdk, bip39, @noble…) via un script de build
  versionné ; publier le hash attendu ; à défaut, auditer/désobfusquer le blob
  existant avant usage réel.
- **Dépendances** : facilite P0-1 (choix Argon2), P3-1.
- **Effort** : L.
- **Validation** : build reproductible ; hash documenté ; inventaire des libs et
  versions ; bundle online/offline identiques et vérifiés.

---

## 5. Phase P3 — Fiabilité et maintenabilité

### P3-1 — Mutualisation du code + outillage
- **Traite** : dette (TRD §6), facilite P1-1.
- **Actions** : extraire les classes `XRPL`/`XLM` et le décodeur dans un module
  partagé ré-inliné à la construction ; introduire `package.json`, lockfile,
  linter, CI.
- **Effort** : M–L.
- **Validation** : une seule source par classe ; build qui régénère les pages ;
  CI verte.

### P3-2 — Suite de tests sur les chemins critiques
- **Traite** : [F-13](findings.md#f-13) (Moyenne).
- **Actions** : vecteurs **BIP39** et **SEP-0005** (dérivation Stellar « maison »
  à valider) ; round-trip chiffrement (P0-1) ; encodage/décodage devises
  (`cur40`) ; calcul des frais multisign ; décodage de chaque type de
  transaction.
- **Dépendances** : P3-1 (outillage).
- **Effort** : M.
- **Validation** : couverture des fonctions critiques ; tests exécutés en CI.

### P3-3 — Robustesse des entrées + cohérence documentaire
- **Traite** : [F-14](findings.md#f-14) (Faible), [F-15](findings.md#f-15) (Faible),
  [F-16](findings.md#f-16) (Faible).
- **Actions** : gardes sur `match`/entrées malformées ; unifier l'API de prix ;
  corriger `README`/`STRUCTURE.md` ; `lang` correct ; option nœud auto-hébergé /
  mode sans télémétrie.
- **Effort** : S–M.
- **Validation** : pas d'exception sur entrées limites ; documentation alignée
  sur le code.

---

## 6. Ordonnancement et dépendances

```
P0-1 ──┬─▶ P0-2
       └─▶ P0-3
P0-1 ─────▶ P3-2 (round-trip chiffrement)
P2-2 ─────▶ (facilite) P0-1 choix Argon2, P3-1
P3-1 ─────▶ P1-1 (décodeur partagé), P3-2
P1-1, P1-2, P1-3 : indépendants entre eux (après P0)
P2-1 : indépendant (peut démarrer en parallèle de P0)
```

**Chemin critique recommandé** : **P0 → P1 → P2 → P3**. P2-1 (rapatriement +
CSP) peut avancer **en parallèle** de P0. P2-2 (reconstruction du bundle) est le
chantier le plus lourd et conditionne la confiance de fond ; le lancer tôt.

---

## 7. Pistes d'évolution produit et technique

> Classées : **Indispensable** (sécurité/intégrité), **Forte valeur**,
> **Ultérieur**. Chaque piste indique besoin, bénéfice, changements, risques,
> priorité, prérequis.

### Indispensables (au-delà des correctifs P0–P1)
- **E-1 — Contrôle de correspondance prepared ↔ signed**
  *Besoin* : garantir que la transaction signée est bien celle préparée.
  *Bénéfice* : détecte une altération entre étapes. *Changements* : empreinte de
  la transaction préparée, re-vérifiée à l'envoi. *Risque* : faible.
  *Priorité* : haute. *Prérequis* : P1-1.
- **E-2 — Avertissement « destinataire inconnu » / liste blanche**
  (PRD FP-4). *Bénéfice* : réduit le risque d'adresse malveillante collée.
  *Priorité* : haute. *Prérequis* : aucun.

### Forte valeur ajoutée
- **E-3 — Distribution packagée et signée** (PWA ou Electron)
  *Besoin* : intégrité de l'application elle-même, meilleur contrôle mémoire,
  CSP forte. *Bénéfice* : réduit F-03/F-07/F-10 à la racine ; mise à jour
  vérifiable. *Risque* : change le modèle de distribution (PRD Q3) ; effort L.
  *Prérequis* : P2.
- **E-4 — Internationalisation** (PRD FP-7) + accessibilité. *Priorité* :
  moyenne.
- **E-5 — Historique local chiffré des transactions** (PRD FP-5). *Risque* :
  nouvelles données sensibles → chiffrer, opt-in. *Priorité* : moyenne.

### À envisager ultérieurement
- **E-6 — Support de réseaux additionnels** (PRD FP-6) — seulement après
  consolidation XRPL/XLM et mutualisation (P3-1).
- **E-7 — Nœuds auto-hébergés par défaut / mode sans télémétrie** (F-16).
- **E-8 — Support hardware wallet** (clé matérielle) comme alternative au
  fichier wallet, pour éliminer le secret du navigateur.

---

## 8. Définition de « terminé » pour la phase corrective

Une correction est considérée validée lorsque :
1. le constat lié n'est plus reproductible sur le code ;
2. un test automatisé couvre le comportement attendu (quand applicable) ;
3. la documentation reflète le nouveau comportement ;
4. aucune régression n'est introduite sur les 3 autres pages (vérification
   inter-étapes, le format de fichier restant interopérable).

> Rappel : cette feuille de route est un **plan à valider**. L'implémentation
> fera l'objet d'une phase ultérieure distincte de l'audit.

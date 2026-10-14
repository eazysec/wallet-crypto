# Plan de refonte de l'interface

> Branche : `feat/refonte-ui`. Les commits sont faits par le propriétaire du
> dépôt, au format [Conventional Commits](https://www.conventionalcommits.org/)
> (type en anglais, description en français). Les points de commit proposés
> sont signalés dans chaque lot.

## 1. Principes

- **Tests de caractérisation avant toute modification.** Ils sont écrits et
  verts sur le code actuel, puis commités séparément.
- **Tester des comportements, pas l'écran.** Chaque page a un *pilote* : le seul
  code qui connaît le DOM. Les tests expriment l'intention (« restaurer avec ces
  mots sur XRPL ») et vérifient un résultat (« l'adresse vaut … »). Après la
  refonte, on réécrit les pilotes ; les assertions ne changent pas.
- **Invariants et changements voulus.**
  - Invariants, identiques avant et après : adresses dérivées des mots, JSON
    préparé pour chacun des 7 types, transaction signée à l'octet près
    (signatures déterministes), décodage avant envoi.
  - Changements voulus, qui ne sont pas des régressions : disparition des
    `prompt()`, de l'export en clair, nouveaux noms de fichiers. Ils deviennent
    de nouvelles spécifications, écrites en TDD.
- **Réseau simulé.** Les tests rejouent des réponses enregistrées. Un petit lot
  facultatif contre le vrai testnet se lance à la main.
- **TDD pour le comportement** (fonctions et parcours). Le CSS est validé sur la
  page de référence `commun/specimen.html`, puis figé par captures d'écran.
- **Simplicité.** Outillage minimal : Playwright (développement seulement) et
  `node --test`, intégré à Node.
- **Aucune injection possible.** Le code n'écrit que du texte (`textContent`) :
  ni `innerHTML`, ni `.html()`, ni `eval`, ni script, gestionnaire ou style
  écrits dans le HTML. Les champs secrets désactivent correcteur orthographique,
  autocomplétion et majuscules automatiques. Vérifié par
  `tests/unitaire/injection.test.js` ; les anciens fichiers y sont des
  exceptions temporaires, retirées à la migration de chaque page.

## 2. Historique cible sur `main`

1. `test(e2e): tests de caractérisation des 4 pages, XRPL et Stellar`
2. `refactor: renomme les pages selon la convention`
3. `feat(ui): refonte de l'interface`

Les commits intermédiaires de la branche peuvent être fusionnés en un seul au
moment du merge, à l'exception des deux premiers.

## 3. Lots

### Lot 0 · Outillage minimal
- `package.json`, lockfile, `.gitignore`.
- Playwright, Chromium seulement, en dépendance de développement.
- `node --test` pour les tests unitaires.
- Test de faisabilité : Playwright doit tourner dans le bac à sable Flatpak de
  VSCode, sinon via `flatpak-spawn --host`.

### Lot 1 · Tests de caractérisation (XRPL et Stellar)
- Page 1 : restauration depuis des mots connus (vecteur officiel SEP-0005 pour
  Stellar), aller-retour chiffrer/déchiffrer du fichier wallet.
- Page 2 : les 7 types de transaction préparés sur réseau simulé, comparés à
  des fichiers de référence.
- Page 3 : signature d'une transaction connue avec une clé connue.
- Page 4 : décodage, envoi simulé (succès et refus).
- Cycle complet de 1 à 4 pour chaque chaîne.
- Un bug de l'existant révélé par un test est signalé, pas corrigé en silence.
- **Point de commit 1.**

### Lot 2 · Renommages
- `git mv` uniquement, selon la convention :
  `hors-ligne/1-creer-wallet.html`, `en-ligne/2-preparer.html`,
  `hors-ligne/3-signer.html`, `en-ligne/4-envoyer.html`.
- Mise à jour des liens, du README et des pilotes.
- **Point de commit 2.**

### Lot 3 · Fondations
- `commun/commun.css` : variables, gabarit, composants. Police Atkinson
  Hyperlegible embarquée localement (licence OFL).
- `commun/*.js` : fonctions pures en TDD, en scripts classiques (les modules ES
  ne se chargent pas en `file://`) : découpage d'adresse, format de montant,
  empreinte, nom de fichier, robustesse du mot de passe, délai de validité,
  traduction des refus du réseau, lecture de la chaîne et du réseau depuis le
  contenu d'un fichier.
- Bundle crypto en copie locale partagée par les 4 pages (fin des CDN, F-08).
- `commun/specimen.html` : chaque composant dans ses états, dans les deux
  zones. **Validation par le propriétaire avant de toucher aux pages.**

### Lots 4 à 7 · Une page par lot, dans l'ordre 4, 2, 3, 1
Pour chaque page : spécification e2e du nouveau comportement (rouge),
implémentation (vert), invariants du lot 1 toujours verts, retrait de
Bootstrap et jQuery.
- **Lot 4 · Envoyer** : gabarit, bordereau, refus traduits. Le décodeur est
  extrait dans `commun/` pour servir à la page 3.
- **Lot 5 · Préparer** : menu des opérations, panneau du compte, sélecteur de
  réseau, formulaires, export (nouveau nom, liste des signataires, délai),
  historique local des destinataires (E-2), suppression confirmée au clavier.
  Puis comparaison automatique en page 4 (E-1).
- **Lot 6 · Signer** : vérification avant signature (F-06), champs secrets
  masqués (F-05), clé reconnue, refus des types inconnus, blocage si réseau
  détecté (F-07), appui maintenu.
- **Lot 7 · Créer** : grille de mots, vérification de la copie, mot de passe
  obligatoire (F-04), fichier d'adresse publique, blocage si réseau détecté.

### Lot 8 · Finitions
- Content-Security-Policy, testée aussi en `file://` (F-10).
- Passe d'accessibilité : clavier, contrastes.
- README et STRUCTURE.md alignés sur le code (F-15).
- Cycle complet sur les deux chaînes.
- **Point de commit 3.**

## 4. Décisions de conception validées

- **Zones** : zone publique (en ligne, étapes 2 et 4) = page claire, bande
  sombre ; zone privée (hors ligne, étapes 1 et 3) = page sombre, bande claire.
  Libellés « En ligne · Zone publique » et « Hors ligne · Zone privée ».
- **Couleurs** : une couleur, un sens, toujours doublée d'un mot. Bleu = agir ;
  jaune = attention ; rouge = danger, irréversible ou bloquant ; vert = réussi ;
  violet = testnet. Les chaînes n'ont pas de couleur.
- **Sobriété** : aucun ornement. Une seule famille de polices.
- **Gabarit** : rail à gauche (menu des opérations en ligne, progression hors
  ligne), action au centre (≤ 640 px), contexte à droite, tiroirs `<dialog>`
  pour l'aide, les réglages et les détails techniques. Ce qui doit être vérifié
  n'est jamais caché dans un panneau.
- **Réseau** : un seul `<select>` dans la bande, modifiable seulement à
  l'étape 2 ; lu dans le fichier aux étapes 3 et 4 ; aussi dans le titre de
  l'onglet.
- **Fichiers produits** :
  `<chaine>-<reseau>_<date>_<operation>_<empreinte6>.a-signer.json`, puis
  `.signee.json` ; wallet `<chaine>_<4 premiers>-<4 derniers>.xrplwallet`.
  Le nom sert aux humains : l'application lit tout dans le contenu.
- **Sécurité dans l'interface** : vérification avant signature, types inconnus
  refusés sans dérogation, export en clair supprimé, pas de bouton Copier sur
  les secrets, liste des signataires embarquée dans le fichier de l'étape 2.
- **Empreinte** : la même aux étapes 2, 3 et 4, y compris quand un signataire
  XRPL signe et que les frais doublent : elle se calcule sans les champs de
  signature et sur les frais de base (frais ÷ (1 + nombre de signataires)).
- **CSS** : `commun/commun.css` lié par les 4 pages, aucun `style=""`.

## 5. Hors périmètre de cette branche

- Chiffrement fort du fichier wallet (P0-1 : KDF et AES-GCM).
- Reconstruction auditable du bundle crypto (P2-2).

- **Durée de validité des transactions** : 15 minutes pour XRPL et Stellar
  (au lieu d'environ 12 minutes et 4 minutes). Le protocole ne l'impose pas :
  `LastLedgerSequence` (XRPL, environ 225 blocs, affiché « environ ») et
  `timeBounds.maxTime` (Stellar) sont fixés par l'étape 2. Changement fait au
  lot 5, avec un test.

## 6. Décisions ouvertes

- Nom du produit.

## 7. Maquettes de référence

Pages privées sur claude.ai, accessibles au propriétaire :
- Bordereau sobre et code couleur : https://claude.ai/artifact/1xbmzbJqaYe4ygyLT9PcGq
- Page 1, création du wallet : https://claude.ai/artifact/KxRaUg8DVarbCrLWTpqCKG
- Page 2, préparation : https://claude.ai/artifact/DBkrwqnGvncTFhrM3WqfKq
- Page 3, signature : https://claude.ai/artifact/L8iTdVHVBeXrtbXsRog3gA
- Gabarit des pages 2, 3 et 4 : https://claude.ai/artifact/Co3rtDYJ97qojCepsiLLno

# Données de test

Les mots utilisés ici sont publics. Ils ne doivent jamais servir à détenir de
vrais fonds.

- `vecteurs.js` : mots de test et adresses attendues.
  - Stellar : vecteurs officiels SEP-0005, référence indépendante du code.
  - XRPL : valeurs relevées sur la version actuelle (caractérisation).
- `wallets/` : fichiers wallet chiffrés (mot de passe `mot-de-passe-de-test`)
  produits par la version actuelle de la page 1.
- `transactions/` : transactions à signer, au format produit par l'étape 2.
- `attendus.js` : transactions signées attendues (signatures déterministes).
- `preparations/` : transactions préparées par la page 2 pour chaque type et
  chaque chaîne, et montants affichés pour le compte.
- `comptes.js` : état des comptes sur le réseau simulé.

Ces données ont été produites le 2026-10-14 sur le commit `702ccff`, avant la
refonte :
- `wallets/` et `transactions/` par `tests/outils/generer-donnees.js` ;
- `preparations/` en lançant les tests avec `ENREGISTRER=1`, qui crée les
  références absentes.

**Ne pas les régénérer après la refonte.** Elles servent justement à vérifier
que le comportement est resté le même. Si un changement de comportement est
voulu (par exemple la correction d'un bug), on modifie la référence concernée à
la main, dans le même commit que la correction, en l'expliquant.

## Modifications volontaires des références

- **Lot 5 (page 2)**, références de `preparations/`, régénérées puis comparées
  champ par champ aux précédentes :
  - durée de validité portée à 15 minutes : `LastLedgerSequence` +25 registres
    pour XRPL (225 au lieu de 200), heure limite +660 secondes pour Stellar
    (900 au lieu de 240). Aucun autre champ ne change ;
  - correction de T-02 : la réserve XRPL compte les objets du compte
    (`xrpl-compte.json` : réserve 1,4 au lieu de 1, disponible 1 739,9) ;
  - affichage : le solde Stellar est affiché sans zéros inutiles
    (`xlm-compte.json` : 1741.3 au lieu de 1741.3000000).

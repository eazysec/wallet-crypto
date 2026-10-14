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
- `cdn/` : copies exactes des bibliothèques que les pages en ligne chargent
  depuis des CDN (Bootstrap 5.2.0-beta1, jQuery 3.6.0, SecureWalletBundle
  2.5.4). Leurs empreintes correspondent aux attributs `integrity` des pages.
  Les tests les servent localement : aucune requête ne sort vers internet.

Ces données ont été produites le 2026-10-14 sur le commit `702ccff`, avant la
refonte :
- `wallets/` et `transactions/` par `tests/outils/generer-donnees.js` ;
- `preparations/` en lançant les tests avec `ENREGISTRER=1`, qui crée les
  références absentes.

**Ne pas les régénérer après la refonte.** Elles servent justement à vérifier
que le comportement est resté le même. Si un changement de comportement est
voulu (par exemple la correction d'un bug), on modifie la référence concernée à
la main, dans le même commit que la correction, en l'expliquant.

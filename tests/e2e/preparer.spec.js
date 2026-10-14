// @ts-check
// Page 2 · invariants : chaque type de transaction préparée doit rester identique après la refonte.
// Les références (tests/donnees/preparations/) ont été relevées sur la version actuelle.
const { test, expect } = require('@playwright/test');
const { PilotePreparer } = require('./pilotes/preparer');
const { nouvelEtat } = require('./reseau');
const { reference } = require('./outils');
const { ADRESSES: A } = require('../donnees/vecteurs');
const C = require('../donnees/comptes');

// Seuls les services de prix peuvent être bloqués : toute autre requête externe est une anomalie.
const PRIX = /coingecko|bitget/;

function etatPour(chaine, comptes) {
  return chaine === 'XRPL' ? nouvelEtat({ xrplComptes: comptes }) : nouvelEtat({ xlmComptes: comptes });
}

const XRPL = { chaine: 'XRPL', source: A.xrplAbandon12, dest: A.xrplAbandon24, emetteur: A.xrplEmetteur, comptes: C.xrpl };
const XLM = { chaine: 'XLM', source: A.xlmSep5test1, dest: A.xlmSep5test3, emetteur: A.xlmEmetteur, comptes: C.xlm };

const CAS = [];
for (const [prefixe, c] of [['xrpl', XRPL], ['xlm', XLM]]) {
  CAS.push(
    [`${prefixe}-paiement-natif`, c, c.comptes.standard, (p) => p.envoyer({ vers: c.dest, tag: '104557', montant: '10' })],
    [`${prefixe}-paiement-jeton`, c, c.comptes.standard, (p) => p.envoyer({ actif: 'USD', vers: c.dest, montant: '25' })],
    [`${prefixe}-jeton-ajout`, c, c.comptes.standard, (p) => p.autoriserJeton({ code: 'USD', emetteur: c.emetteur, plafond: '10000' })],
    [`${prefixe}-jeton-retrait`, c, c.comptes.standard, (p) => p.retirerJeton({ emetteur: c.emetteur })],
    [`${prefixe}-suppression-compte`, c, c.comptes.sansJeton, (p) => p.supprimerCompte({ vers: c.dest, tag: '104557' })],
    [`${prefixe}-signataire-ajout`, c, c.comptes.standard, (p) => p.ajouterSignataire(c.dest)],
    [`${prefixe}-signataire-retrait`, c, c.comptes.avecSignataire, (p) => p.retirerSignataire()],
    [`${prefixe}-cle-principale-desactivation`, c, c.comptes.avecSignataire, (p) => p.desactiverClePrincipale()],
    [`${prefixe}-cle-principale-activation`, c, c.comptes.principaleDesactivee, (p) => p.activerClePrincipale()],
  );
}
CAS.push(['xlm-creation-compte', XLM, C.xlm.standard, (p) => p.envoyer({ vers: A.xlmInconnu, montant: '10' })]);

test.describe('Page 2 · préparer', () => {
  for (const [id, c, comptes, faire] of CAS) {
    test(id, async ({ page }) => {
      const etat = etatPour(c.chaine, comptes);
      const p = new PilotePreparer(page, etat);
      await p.ouvrir(c.chaine);
      await p.verifierCompte(c.source);
      const preparee = await faire(p);
      expect(preparee).toEqual(reference(`preparations/${id}.json`, preparee));
      expect(etat.bloquees.filter((u) => !PRIX.test(u))).toEqual([]);
    });
  }
});

test.describe('Page 2 · compte', () => {
  for (const c of [XRPL, XLM]) {
    test(`${c.chaine} · montants affichés`, async ({ page }) => {
      const p = new PilotePreparer(page, etatPour(c.chaine, c.comptes.standard));
      await p.ouvrir(c.chaine);
      const montants = await p.verifierCompte(c.source);
      expect(montants).toEqual(reference(`preparations/${c.chaine.toLowerCase()}-compte.json`, montants));
    });
  }
});

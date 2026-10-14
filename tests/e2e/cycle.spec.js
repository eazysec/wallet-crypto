// @ts-check
// Cycle complet : préparer en ligne, signer hors ligne, envoyer en ligne.
// Le poste hors ligne est un contexte de navigateur séparé, sans réseau.
const { test, expect } = require('@playwright/test');
const { PilotePreparer } = require('./pilotes/preparer');
const { PiloteSigner } = require('./pilotes/signer');
const { PiloteEnvoyer } = require('./pilotes/envoyer');
const { nouvelEtat } = require('./reseau');
const { MOTS, ADRESSES: A } = require('../donnees/vecteurs');
const C = require('../donnees/comptes');

const CHAINES = [
  { chaine: 'XRPL', mots: MOTS.abandon12, source: A.xrplAbandon12, dest: A.xrplAbandon24, devise: 'XRP',
    etat: () => nouvelEtat({ xrplComptes: C.xrpl.standard }), envoyee: (e) => e.xrpl.soumises, attendue: (s) => s.tx_blob },
  { chaine: 'XLM', mots: MOTS.sep5test1, source: A.xlmSep5test1, dest: A.xlmSep5test3, devise: 'XLM',
    etat: () => nouvelEtat({ xlmComptes: C.xlm.standard }), envoyee: (e) => e.xlm.soumises, attendue: (s) => s.XDR },
];

for (const c of CHAINES) {
  test(`${c.chaine} · préparer, signer hors ligne, envoyer`, async ({ browser }) => {
    const etat = c.etat();
    const posteEnLigne = await browser.newContext();
    const posteHorsLigne = await browser.newContext();

    const preparer = new PilotePreparer(await posteEnLigne.newPage(), etat);
    await preparer.ouvrir(c.chaine);
    await preparer.verifierCompte(c.source);
    const aSigner = await preparer.envoyer({ vers: c.dest, tag: '104557', montant: '10' });

    const signer = new PiloteSigner(await posteHorsLigne.newPage());
    await signer.ouvrir();
    await signer.chargerTransaction(JSON.stringify(aSigner), c.chaine);
    await signer.signerAvecMots(c.mots);
    const signee = await signer.lire();

    const envoyer = new PiloteEnvoyer(await posteEnLigne.newPage(), etat);
    await envoyer.ouvrir();
    await envoyer.chargerTransactionSignee(signee, c.chaine);
    expect(await envoyer.lireRecapitulatif()).toMatchObject({ de: c.source, vers: c.dest, tag: '104557', montant: '10', devise: c.devise });
    expect((await envoyer.envoyer()).reussi).toBe(true);
    expect(c.envoyee(etat)).toEqual([c.attendue(signee)]);

    await posteEnLigne.close();
    await posteHorsLigne.close();
  });
}

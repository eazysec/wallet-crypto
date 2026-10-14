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

test.describe('Page 2 · nouvelle interface', () => {
  const ouvrirXrpl = async (page, comptes = C.xrpl.standard, reseau = 'test') => {
    const etat = nouvelEtat({ xrplComptes: comptes });
    const p = new PilotePreparer(page, etat);
    await p.ouvrir('XRPL', reseau);
    await p.verifierCompte(A.xrplAbandon12);
    return { p, etat };
  };

  test('le réseau se choisit dans la bande, le testnet est signalé', async ({ page }) => {
    const p = new PilotePreparer(page, nouvelEtat({ xrplComptes: C.xrpl.standard }));
    await p.ouvrir('XRPL', 'main');
    expect(await p.bandeauTestnet()).toBe(false);
    await p.choisirReseau('XRPL', 'test');
    expect(await p.bandeauTestnet()).toBe(true);
  });

  test('le fichier exporté suit la convention et contient chaîne, réseau et comptes autorisés', async ({ page }) => {
    const { p } = await ouvrirXrpl(page, C.xrpl.avecSignataire);
    await p.envoyer({ vers: A.xrplAbandon24, tag: '104557', montant: '10' });
    const { nom, enveloppe } = p.dernierExport;
    expect(nom).toMatch(/^xrpl-test_\d{4}-\d{2}-\d{2}_paiement-10-xrp_[0-9a-f]{6}\.a-signer\.json$/);
    expect(enveloppe).toMatchObject({ format: 'securedwallet/transaction-v1', chaine: 'XRPL', reseau: 'test', etape: 'a-signer' });
    expect(enveloppe.autorises).toEqual([A.xrplAbandon12, A.xrplAbandon24]);
  });

  test('validité de 15 minutes : 225 registres XRPL, 900 secondes Stellar', async ({ page }) => {
    const { p } = await ouvrirXrpl(page);
    expect((await p.envoyer({ vers: A.xrplAbandon24, montant: '10' })).LastLedgerSequence).toBe(90000000 + 225);

    const etat = nouvelEtat({ xlmComptes: C.xlm.standard });
    const q = new PilotePreparer(await page.context().newPage(), etat);
    await q.ouvrir('XLM');
    await q.verifierCompte(A.xlmSep5test1);
    const tx = await q.envoyer({ vers: A.xlmSep5test3, montant: '10' });
    const maxTime = await q.page.evaluate((t) => Number(SecureWalletBundle.StellarSdk.TransactionBuilder.fromXDR(t.XDR, t.Network).timeBounds.maxTime), tx);
    expect(maxTime).toBe(Date.parse('2026-01-01T00:00:00Z') / 1000 + 900);
  });

  test('destinataire jamais utilisé : signalé avant le premier export, plus ensuite', async ({ page }) => {
    const { p } = await ouvrirXrpl(page);
    expect(await p.avertissementDestinataire(A.xrplAbandon24)).toBe(true);
    await p.envoyer({ vers: A.xrplAbandon24, montant: '10' });
    expect(await p.avertissementDestinataire(A.xrplAbandon24)).toBe(false);
  });

  // Correction de T-02 : l'ancienne version ignorait les objets du compte dans la réserve.
  test('la réserve compte les objets du compte', async ({ page }) => {
    const p = new PilotePreparer(page, nouvelEtat({ xrplComptes: C.xrpl.standard }));
    await p.ouvrir('XRPL');
    expect(await p.verifierCompte(A.xrplAbandon12)).toMatchObject({ reserve: '1.4', disponible: '1739.9' });
  });

  test('« Max » laisse de quoi payer les frais', async ({ page }) => {
    const { p } = await ouvrirXrpl(page);
    expect(await p.montantMax()).toBe('1739.899988');
  });

  // Correction de T-03 : l'ancienne version n'affichait jamais les erreurs de préparation.
  test('une erreur de préparation est affichée, et la page reste utilisable', async ({ page }) => {
    const { p, etat } = await ouvrirXrpl(page);
    etat.xrpl.pannes.ledger = 'Nœud indisponible';
    expect(await p.essayerEnvoyer({ vers: A.xrplAbandon24, montant: '10' })).toContain('La préparation a échoué');
    delete etat.xrpl.pannes.ledger;
    expect((await p.envoyer({ vers: A.xrplAbandon24, montant: '10' })).TransactionType).toBe('Payment');
  });

  // Correction de T-05 côté page 2 : les messages du réseau étaient insérés en HTML.
  test('un message d\'erreur du réseau s\'affiche comme du texte, sans être exécuté', async ({ page }) => {
    const etat = nouvelEtat({ xrplComptes: C.xrpl.standard });
    etat.xrpl.pannes.account_info = '<img src=x onerror=top.p=1>';
    const p = new PilotePreparer(page, etat);
    await p.ouvrir('XRPL');
    expect(await p.erreurCompte(A.xrplAbandon12)).toContain('<img src=x onerror=top.p=1>');
    expect(await page.evaluate(() => window.p)).toBeUndefined();
  });

  test('suppression du compte : inactive tant que la confirmation n\'est pas tapée', async ({ page }) => {
    const { p } = await ouvrirXrpl(page, C.xrpl.sansJeton);
    expect(await p.suppressionPossible(A.xrplAbandon24, '')).toBe(false);
    expect(await p.suppressionPossible(A.xrplAbandon24, 'AAAA')).toBe(false);
    expect(await p.suppressionPossible(A.xrplAbandon12, A.xrplAbandon12.slice(-4))).toBe(false);
    expect(await p.suppressionPossible(A.xrplAbandon24, A.xrplAbandon12.slice(-4))).toBe(true);
  });

  test('l\'adresse du compte se charge depuis le fichier d\'adresse publique', async ({ page }) => {
    const p = new PilotePreparer(page, nouvelEtat({ xrplComptes: C.xrpl.standard }));
    await p.ouvrir('XRPL');
    await p.chargerFichierAdresse(`${A.xrplAbandon12}\n`);
    expect(await p.adresseSaisie()).toBe(A.xrplAbandon12);
  });
});

// T-06 : l'ancienne page retirait tous les zéros finaux d'un montant de jeton XRPL (10 → 1).
test('XRPL · un paiement de 10 USD prépare bien 10 USD', async ({ page }) => {
  const p = new PilotePreparer(page, nouvelEtat({ xrplComptes: C.xrpl.standard }));
  await p.ouvrir('XRPL');
  await p.verifierCompte(A.xrplAbandon12);
  expect((await p.envoyer({ actif: 'USD', vers: A.xrplAbandon24, montant: '10' })).Amount.value).toBe('10');
});

test('Page 2 · à l\'ouverture, Testnet est sélectionné : Mainnet demande un choix explicite', async ({ page }) => {
  const { brancherReseau } = require('./reseau');
  const { urlPage } = require('./outils');
  await brancherReseau(page, nouvelEtat());
  await page.goto(urlPage('en-ligne/2-preparer.html'));
  expect(await page.inputValue('#reseau')).toBe('XRPL:test');
  await expect(page.locator('#bandeau-testnet')).toBeVisible();
});

for (const [chaine, absente] of [['XRPL', A.xrplEmetteur], ['XLM', A.xlmInconnu]]) {
  test(`Page 2 · ${chaine} · compte pas encore créé : ce n'est pas une erreur, la suite est expliquée`, async ({ page }) => {
    const p = new PilotePreparer(page, nouvelEtat());
    await p.ouvrir(chaine, 'test');
    const test_ = await p.compteAbsent(absente);
    expect(test_.erreurAffichee).toBe(false);
    expect(test_.texte).toContain("n'existe pas encore sur");
    expect(test_.texte).toContain('Testnet');
    expect(test_.texte).toContain('autre réseau');
    expect(test_.fontaine).toMatch(/^https:\/\//);

    await p.choisirReseau(chaine, 'main');
    const main = await p.compteAbsent(absente);
    expect(main.texte).toContain('Mainnet');
    expect(main.fontaine).toBeNull();
  });
}

// Pilote de la page 4 (vérifier puis envoyer une transaction signée), interface ACTUELLE.
// Seul ce fichier connaît l'écran : après la refonte, on le réécrit et les tests restent identiques.
const { expect } = require('@playwright/test');
const { urlPage, brancherDialogues } = require('../outils');
const { brancherReseau } = require('../reseau');

const CHEMIN = 'ONLINE_transaction/2.3.ONLINE_transaction-send/2.3.ONLINE_transaction-send.html';

class PiloteEnvoyer {
  constructor(page, etat) {
    this.page = page;
    this.etat = etat;
    this.dialogues = brancherDialogues(page);
  }

  async ouvrir() {
    await brancherReseau(this.page, this.etat);
    await this.page.goto(urlPage(CHEMIN));
  }

  /**
   * Charge une transaction signée (objet) pour la chaîne 'XRPL' ou 'XLM' et le réseau 'main' ou 'test'.
   * L'interface actuelle lit la chaîne et le réseau dans le nom du fichier (constat F-14).
   */
  async chargerTransactionSignee(signee, chaine, reseau = 'test') {
    await this.page.setInputFiles('#trxSignedInputFile', {
      name: `#123_Send_10-${chaine}-${reseau}.signed.json`,
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(signee, null, 3)),
    });
    await expect(this.page.locator('#r_checkTrx')).toBeVisible();
  }

  /** Récapitulatif affiché avant l'envoi, normalisé. */
  async lireRecapitulatif() {
    const texte = await this.page.innerText('#d_checkTrx');
    const champs = {};
    for (const ligne of texte.split('\n')) {
      const m = ligne.match(/^\s*(De|Vers|Tag|Montant|Frais|Compte|Issuer|Currency|Max|Reliquat vers|Signataire)\s*:\s*(.+?)\s*$/);
      if (m) champs[m[1]] = m[2];
    }
    const [montant, devise] = (champs.Montant || '').split(' ');
    return {
      de: champs.De,
      vers: champs.Vers,
      tag: champs.Tag,
      montant,
      devise,
      frais: (champs.Frais || '').split(' ')[0],
      multisignature: texte.includes('signée par un compte signataire'),
    };
  }

  /** Envoie et renvoie { reussi, detail } tel qu'affiché. */
  async envoyer() {
    await this.page.click('#sendTrxBtn');
    await expect(this.page.locator('#d_trxOK:visible, #d_trxKO:visible')).toHaveCount(1, { timeout: 15000 });
    if (await this.page.locator('#d_trxKO').isVisible()) return { reussi: false, detail: await this.page.innerText('#trxFail') };
    return { reussi: true, detail: await this.page.innerText('#d_trxOK') };
  }
}

module.exports = { PiloteEnvoyer };

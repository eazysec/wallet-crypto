// Pilote de la page 3 (signer une transaction), interface ACTUELLE.
// Seul ce fichier connaît l'écran : après la refonte, on le réécrit et les tests restent identiques.
const fs = require('node:fs');
const { expect } = require('@playwright/test');
const { urlPage, brancherDialogues, telechargement } = require('../outils');

const CHEMIN = 'OFFLINE_wallet/2.2.OFFLINE_transaction-sign.html';

// L'interface actuelle déduit la chaîne du nom de fichier (constat F-14) :
// on reproduit les noms produits par l'étape 2.
const NOMS = {
  XRPL: '#123_Send_10_XRP-XRPL-test.tosign.json',
  XLM: '#123_Send_10_XLM-XLM-test.tosign.json',
};

class PiloteSigner {
  constructor(page) {
    this.page = page;
    this.dialogues = brancherDialogues(page);
  }

  async ouvrir() {
    await this.page.context().setOffline(true);
    await this.page.goto(urlPage(CHEMIN));
    await this.page.getByRole('button', { name: "J'ai compris - Démarrer !" }).click();
  }

  /** Charge une transaction à signer (chemin de fichier ou contenu JSON) pour la chaîne 'XRPL' ou 'XLM'. */
  async chargerTransaction(source, chaine) {
    await this.page.setInputFiles('#trxInputFile', {
      name: NOMS[chaine],
      mimeType: 'application/json',
      buffer: fs.existsSync(source) ? fs.readFileSync(source) : Buffer.from(source),
    });
    await expect(this.page.locator('#trxToSign')).not.toHaveValue('');
  }

  async signerAvecMots(mots) {
    this.dialogues.reponses.push(mots);
    await this.page.getByRole('button', { name: /Entrer la seed-phrase/ }).click();
    await this.attendreSignature();
  }

  async signerAvecFichier(chemin, motDePasse) {
    this.dialogues.reponses.push(motDePasse);
    await this.page.setInputFiles('#PKInputFile', chemin);
    await this.attendreSignature();
  }

  /** Transaction signée affichée, en objet. */
  async lire() {
    return JSON.parse(await this.page.inputValue('#trxSigned'));
  }

  /** Enregistre le fichier signé. */
  async enregistrer() {
    return telechargement(this.page, () => this.page.locator('#dwnldButton').click());
  }

  async attendreSignature() {
    await expect(this.page.locator('#d_trxtoSign')).toBeVisible();
  }
}

module.exports = { PiloteSigner };

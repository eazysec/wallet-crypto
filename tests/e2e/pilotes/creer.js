// Pilote de la page 1 (créer ou restaurer un wallet), interface ACTUELLE.
// Seul ce fichier connaît l'écran : après la refonte, on le réécrit et les tests restent identiques.
const { expect } = require('@playwright/test');
const { urlPage, brancherDialogues, telechargement } = require('../outils');

const CHEMIN = 'OFFLINE_wallet/1.OFFLINE_wallet-generation.html';

class PiloteCreer {
  constructor(page) {
    this.page = page;
    this.dialogues = brancherDialogues(page);
  }

  /** Ouvre la page sur un poste hors ligne, chaîne 'XRPL' ou 'XLM'. */
  async ouvrir(chaine) {
    await this.page.context().setOffline(true);
    await this.page.goto(urlPage(CHEMIN));
    await this.page.selectOption('#blockchain-select', chaine);
    await this.page.getByRole('button', { name: "J'ai compris - Démarrer !" }).click();
  }

  async restaurerDepuisMots(mots) {
    await this.page.getByRole('button', { name: 'Récupérer un wallet existant' }).click();
    this.dialogues.reponses.push(mots);
    await this.page.getByRole('button', { name: 'Récupérer avec une seed-phrase' }).click();
    await this.attendreWallet();
  }

  /** Restaure depuis un fichier wallet. Renvoie false si aucun wallet n'apparaît. */
  async restaurerDepuisFichier(chemin, motDePasse) {
    await this.page.getByRole('button', { name: 'Récupérer un wallet existant' }).click();
    if (motDePasse !== undefined) this.dialogues.reponses.push(motDePasse);
    await this.page.setInputFiles('#PKInputFile', chemin);
    try {
      await this.attendreWallet(3000);
      return true;
    } catch {
      return false;
    }
  }

  /** Crée un wallet. format : 12, 24 ou 'Numérique' (numéros secrets Xaman, XRPL seulement). */
  async creer(format) {
    await this.page.getByRole('button', { name: 'Générer un nouveau wallet' }).click();
    await this.page.selectOption('#wordsSelect', String(format));
    await this.page.getByRole('button', { name: 'Générer mon wallet' }).click();
    await this.attendreWallet();
  }

  /** Mots (ou numéros secrets) et adresse publique affichés. */
  async lire() {
    return {
      mots: await this.page.inputValue('#seedphrase'),
      adresse: await this.page.inputValue('#publicaddr'),
    };
  }

  /** Enregistre le fichier wallet chiffré avec ce mot de passe. */
  async enregistrerFichier(motDePasse) {
    this.dialogues.reponses.push(motDePasse);
    return telechargement(this.page, () => this.page.getByRole('button', { name: /Télécharger le wallet/ }).click());
  }

  /** Liste de mots BIP39 anglaise embarquée dans la page. */
  async listeBip39() {
    return this.page.evaluate(() => SecureWalletBundle.bip39.wordlists.EN);
  }

  async attendreWallet(delai) {
    await expect(this.page.locator('#d_walletGen')).toBeVisible({ timeout: delai });
    await expect(this.page.locator('#publicaddr')).not.toHaveValue('', { timeout: delai });
  }
}

module.exports = { PiloteCreer };

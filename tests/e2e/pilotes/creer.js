// Pilote de la page 1 (créer ou restaurer un wallet), nouvelle interface.
// Seul ce fichier connaît l'écran : les tests expriment l'intention.
const path = require('node:path');
const { expect } = require('@playwright/test');
const { urlPage, telechargement } = require('../outils');

const CHEMIN = 'hors-ligne/1-creer-wallet.html';

class PiloteCreer {
  constructor(page) {
    this.page = page;
    this.mots = '';
  }

  /** Ouvre la page, chaîne 'XRPL' ou 'XLM'. Par défaut le poste est hors ligne. */
  async ouvrir(chaine, { enLigne = false } = {}) {
    await this.page.context().setOffline(!enLigne);
    await this.page.goto(urlPage(CHEMIN));
    await this.page.selectOption('#reseau', chaine);
  }

  // ---------- Créer ----------

  /** Choisit le format puis affiche les mots. format : 12, 24, 'Numérique' (Xaman) ou une longueur libre. */
  async afficherMots(format) {
    await this.page.click('#aller-creer');
    await expect(this.page.locator('#vue-preparer')).toBeVisible();
    if (format === 'Numérique') await this.page.click('#format [data-valeur="xaman"]');
    else if (format === 12 || format === 24) await this.page.click(`#format [data-valeur="${format}"]`);
    else {
      await this.page.locator('#vue-preparer details summary').click();
      await this.page.fill('#longueur-libre', String(format));
    }
    await this.page.click('#afficher-mots');
    await expect(this.page.locator('#vue-mots')).toBeVisible();
    this.mots = (await this.page.locator('#grille-mots .mots__mot').allTextContents()).join(' ');
  }

  /** Positions demandées à la vérification de la copie (à partir de 1). */
  async positionsDemandees() {
    const positions = await this.page.locator('#verifications-copie input').evaluateAll((cases) => cases.map((c) => Number(c.dataset.position) + 1));
    return positions;
  }

  async allerVerification() {
    await this.page.click('#mots-ecrits');
    await expect(this.page.locator('#vue-verifier')).toBeVisible();
  }

  /** Recopie les mots demandés ; reponses : valeurs à saisir, sinon les bons mots. */
  async recopier(reponses) {
    const liste = this.mots.split(' ');
    const positions = await this.positionsDemandees();
    const cases = this.page.locator('#verifications-copie input');
    for (let i = 0; i < positions.length; i += 1) {
      await cases.nth(i).fill(reponses ? reponses[i] : liste[positions[i] - 1]);
    }
  }

  async copieAcceptee() {
    return this.page.locator('#copie-verifiee').isEnabled();
  }

  /** Crée un wallet jusqu'à l'écran du fichier chiffré. */
  async creer(format) {
    await this.afficherMots(format);
    await this.allerVerification();
    await this.recopier();
    await this.page.click('#copie-verifiee');
    await expect(this.page.locator('#vue-fichier')).toBeVisible();
  }

  // ---------- Restaurer ----------

  async allerRestaurer() {
    await this.page.click('#aller-restaurer');
    await expect(this.page.locator('#vue-restaurer')).toBeVisible();
  }

  /** Saisit les mots (ou numéros Xaman), une case par mot, sans valider. */
  async saisirMots(mots) {
    const liste = mots.trim().split(/\s+/);
    if (/^[0-9]{6}$/.test(liste[0])) {
      await this.page.click('#methode [data-valeur="xaman"]');
    } else if (liste.length === 12 || liste.length === 24) {
      await this.page.click(`#nombre-mots [data-valeur="${liste.length}"]`);
    } else {
      await this.page.click('#nombre-mots [data-valeur="autre"]');
      await this.page.fill('#nombre-libre', String(liste.length));
    }
    for (let i = 0; i < liste.length; i += 1) await this.page.fill(`#saisie-${i + 1}`, liste[i]);
  }

  /** Colle toute la phrase dans la première case. */
  async collerMots(mots) {
    await this.page.locator('#saisie-1').evaluate((saisie, texte) => {
      const donnees = new DataTransfer();
      donnees.setData('text', texte);
      saisie.dispatchEvent(new ClipboardEvent('paste', { clipboardData: donnees, bubbles: true, cancelable: true }));
    }, mots);
  }

  async restaurationPossible() {
    return this.page.locator('#restaurer').isEnabled();
  }

  async erreurRestauration() {
    await expect(this.page.locator('#erreur-restauration')).toBeVisible();
    return this.page.innerText('#erreur-restauration');
  }

  async restaurerDepuisMots(mots) {
    await this.allerRestaurer();
    await this.saisirMots(mots);
    await this.page.click('#restaurer');
    await expect(this.page.locator('#vue-fichier')).toBeVisible();
  }

  /**
   * Restaure depuis un fichier wallet. Renvoie true si le wallet est retrouvé, false si la
   * page signale une erreur.
   */
  async restaurerDepuisFichier(chemin, motDePasse) {
    await this.allerRestaurer();
    await this.page.click('#methode [data-valeur="fichier"]');
    await this.page.setInputFiles('#fichier-wallet', chemin);
    await expect(this.page.locator('#wallet-nom')).toHaveText(path.basename(chemin));
    if (motDePasse !== undefined) await this.page.fill('#mot-de-passe-wallet', motDePasse);
    await this.page.click('#restaurer');
    const fichier = this.page.locator('#vue-fichier');
    const erreur = this.page.locator('#erreur-restauration');
    await expect.poll(async () => (await fichier.isVisible()) || (await erreur.isVisible()), { timeout: 20000 }).toBe(true);
    return fichier.isVisible();
  }

  // ---------- Fichier chiffré et fin ----------

  /** Mots (ou numéros) affichés à la création, et adresse publique obtenue. */
  async lire() {
    return { mots: this.mots, adresse: await this.page.locator('#contexte-adresse').textContent() };
  }

  async saisirMotDePasse(motDePasse, confirmation = motDePasse) {
    await this.page.fill('#mot-de-passe', motDePasse);
    await this.page.fill('#mot-de-passe-2', confirmation);
  }

  async jauge() {
    return { niveau: await this.page.getAttribute('#jauge', 'data-niveau'), texte: await this.page.innerText('#jauge-texte') };
  }

  async enregistrementPossible() {
    return this.page.locator('#enregistrer-wallet').isEnabled();
  }

  /** Enregistre le fichier wallet chiffré avec ce mot de passe : { nom, contenu }. */
  async enregistrerFichier(motDePasse) {
    await this.saisirMotDePasse(motDePasse);
    const fichier = await telechargement(this.page, () => this.page.click('#enregistrer-wallet'));
    await expect(this.page.locator('#vue-termine')).toBeVisible();
    return fichier;
  }

  async continuerSansFichier() {
    await this.page.click('#sans-fichier');
    await expect(this.page.locator('#vue-termine')).toBeVisible();
  }

  async bilan() {
    return this.page.locator('#bilan li').allTextContents();
  }

  async adresseFinale() {
    return this.page.locator('#adresse-publique').textContent();
  }

  async enregistrerAdressePublique() {
    return telechargement(this.page, () => this.page.click('#enregistrer-adresse'));
  }

  async terminer() {
    await this.page.click('#terminer');
    await expect(this.page.locator('#vue-choisir')).toBeVisible();
  }

  /** Liste de mots BIP39 anglaise embarquée dans la page. */
  async listeBip39() {
    return this.page.evaluate(() => SecureWalletBundle.bip39.wordlists.EN);
  }
}

module.exports = { PiloteCreer };

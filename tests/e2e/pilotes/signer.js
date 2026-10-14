// Pilote de la page 3 (signer une transaction), nouvelle interface.
// Seul ce fichier connaît l'écran : les tests expriment l'intention.
const fs = require('node:fs');
const path = require('node:path');
const { expect } = require('@playwright/test');
const { urlPage, telechargement } = require('../outils');

const CHEMIN = 'hors-ligne/3-signer.html';

class PiloteSigner {
  constructor(page) {
    this.page = page;
  }

  /** Par défaut le poste est hors ligne ; enLigne: true simule un poste connecté. */
  async ouvrir({ enLigne = false } = {}) {
    await this.page.context().setOffline(!enLigne);
    await this.page.goto(urlPage(CHEMIN));
  }

  /** Dépose un fichier (chemin existant ou contenu), sans attendre le résultat. */
  async deposer(source, nom) {
    const estChemin = fs.existsSync(source);
    await this.page.setInputFiles('#fichier', {
      name: nom || (estChemin ? path.basename(source) : 'transaction.a-signer.json'),
      mimeType: 'application/json',
      buffer: Buffer.from(estChemin ? fs.readFileSync(source, 'utf8') : source),
    });
  }

  /** Charge une transaction à signer. La chaîne est lue dans le contenu, pas dans le nom. */
  async chargerTransaction(source) {
    await this.deposer(source);
    await expect(this.page.locator('#vue-verifier')).toBeVisible();
  }

  /** Charge un fichier enregistré par l'étape 2 ({ nom, contenu }), tel quel. */
  async chargerFichier(fichier) {
    await this.deposer(fichier.contenu, fichier.nom);
    await expect(this.page.locator('#vue-verifier')).toBeVisible();
  }

  async erreurChargement() {
    await expect(this.page.locator('#erreur-chargement')).toBeVisible();
    return this.page.innerText('#erreur-chargement');
  }

  async contenuRefuse() {
    return this.page.locator('#contenu-refuse-texte').textContent();
  }

  async enVerification() {
    return this.page.locator('#vue-verifier').isVisible();
  }

  /** Bordereau affiché avant toute clé. */
  async lireBordereau() {
    const bordereau = this.page.locator('#bordereau');
    const texte = async (champ, selecteur = 'dd') => {
      const cible = bordereau.locator(`[data-champ="${champ}"] ${selecteur}`).first();
      return (await cible.count()) ? (await cible.textContent()).trim() : undefined;
    };
    return {
      de: await texte('de'),
      vers: await texte('vers'),
      tag: await texte('tag'),
      montant: await texte('montant', 'dd span:first-child'),
      devise: await texte('montant', '.montant__devise'),
    };
  }

  async empreinte() {
    return (await this.page.locator('#empreinte').textContent()).replace(/\s/g, '');
  }

  async reseauAffiche() {
    return this.page.innerText('#reseau-lu');
  }

  async bordereauReseau() {
    return (await this.page.locator('#bordereau .bordereau__reseau').textContent()).trim();
  }

  async bandeauTestnet() {
    return this.page.locator('#bandeau-testnet').isVisible();
  }

  async alarmeReseau() {
    return this.page.locator('#alarme').isVisible();
  }

  async accepterPosteConnecte() {
    await this.page.check('#derogation');
  }

  async choisirCle() {
    if (await this.page.locator('#vue-cle').isVisible()) return;
    await this.page.click('#choisir-cle');
    await expect(this.page.locator('#vue-cle')).toBeVisible();
  }

  /** Saisit les mots et demande l'ouverture de la clé. */
  async ouvrirAvecMots(mots) {
    await this.choisirCle();
    await this.page.click('#methode [data-valeur="mots"]');
    await this.page.fill('#mots', mots);
    await this.page.click('#ouvrir-mots');
  }

  async ouvrirAvecFichier(chemin, motDePasse) {
    await this.choisirCle();
    await this.page.click('#methode [data-valeur="fichier"]');
    await this.page.setInputFiles('#fichier-wallet', chemin);
    await expect(this.page.locator('#wallet-nom')).toHaveText(path.basename(chemin));
    await this.page.fill('#mot-de-passe', motDePasse);
    await this.page.click('#ouvrir-fichier');
  }

  async cleReconnue() {
    await expect(this.page.locator('#cle-reconnue')).toBeVisible();
    return this.page.innerText('#cle-reconnue');
  }

  async erreurCle() {
    await expect(this.page.locator('#erreur-cle')).toBeVisible();
    return this.page.innerText('#erreur-cle');
  }

  async ouvertureBloquee() {
    return this.page.locator('#ouvrir-mots').isDisabled();
  }

  /** Valeurs restées dans les champs secrets. */
  async champsSecrets() {
    return { motDePasse: await this.page.inputValue('#mot-de-passe'), mots: await this.page.inputValue('#mots') };
  }

  async allerSignature() {
    await this.page.click('#vers-signature');
    await expect(this.page.locator('#vue-signer')).toBeVisible();
  }

  async noteFrais() {
    const note = this.page.locator('#note-frais');
    return (await note.isVisible()) ? note.innerText() : null;
  }

  async signaturePossible() {
    return this.page.locator('#bouton-signer').isEnabled();
  }

  /** Appui maintenu sur le bouton de signature, jusqu'à l'écran d'enregistrement. */
  async maintenirSigner() {
    await this.page.locator('#bouton-signer').hover();
    await this.page.mouse.down();
    await expect(this.page.locator('#vue-enregistrer')).toBeVisible();
    await this.page.mouse.up();
  }

  async signerAvecMots(mots) {
    await this.ouvrirAvecMots(mots);
    await this.cleReconnue();
    await this.allerSignature();
    await this.maintenirSigner();
  }

  async signerAvecFichier(chemin, motDePasse) {
    await this.ouvrirAvecFichier(chemin, motDePasse);
    await this.cleReconnue();
    await this.allerSignature();
    await this.maintenirSigner();
  }

  /** Transaction signée, en objet. */
  async lire() {
    return JSON.parse(await this.page.locator('#technique-contenu').textContent());
  }

  async nomPropose() {
    return this.page.innerText('#nom-signee');
  }

  async empreinteSignee() {
    return (await this.page.locator('#empreinte-signee').textContent()).replace(/\s/g, '');
  }

  /** Enregistre le fichier signé : { nom, contenu }. */
  async enregistrer() {
    return telechargement(this.page, () => this.page.click('#enregistrer'));
  }

  async terminer() {
    await this.page.click('#terminer');
    await expect(this.page.locator('#vue-charger')).toBeVisible();
  }
}

module.exports = { PiloteSigner };

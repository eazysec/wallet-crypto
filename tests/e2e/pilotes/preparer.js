// Pilote de la page 2 (préparer une transaction), NOUVELLE interface.
// Seul ce fichier connaît l'écran : les tests expriment l'intention et restent ceux du lot 1.
// Chaque opération renvoie la transaction contenue dans le fichier réellement exporté.
const { expect } = require('@playwright/test');
const { urlPage, brancherDialogues, telechargement } = require('../outils');
const { brancherReseau } = require('../reseau');

const CHEMIN = 'en-ligne/2-preparer.html';
// Heure figée : Stellar inscrit l'heure limite dans la transaction.
const HEURE = new Date('2026-01-01T00:00:00Z');

/** « 1 739,9 XRP » affiché → « 1739.9 ». */
function nombre(texte) {
  return (texte || '').replace(/\s*[A-Z]{3,}$/, '').replace(/[\s ]/g, '').replace(',', '.');
}

class PilotePreparer {
  constructor(page, etat) {
    this.page = page;
    this.etat = etat;
    this.dialogues = brancherDialogues(page);
    this.dernierExport = null;
  }

  /** chaine : 'XRPL' ou 'XLM' ; reseau : 'main' ou 'test'. */
  async ouvrir(chaine, reseau = 'test') {
    await this.page.clock.setFixedTime(HEURE);
    await brancherReseau(this.page, this.etat);
    await this.page.goto(urlPage(CHEMIN));
    await this.choisirReseau(chaine, reseau);
  }

  async choisirReseau(chaine, reseau) {
    await this.page.selectOption('#reseau', `${chaine}:${reseau}`);
  }

  async bandeauTestnet() {
    return this.page.locator('#bandeau-testnet').isVisible();
  }

  /** Vérifie le compte et renvoie les montants affichés. */
  async verifierCompte(adresse) {
    this.compte = adresse;
    await this.page.fill('#compte-adresse', adresse);
    await this.page.click('#verifier-compte');
    await expect(this.page.locator('#contexte-compte')).toBeVisible();
    return {
      solde: nombre(await this.page.textContent('#compte-solde')),
      reserve: nombre(await this.page.textContent('#compte-reserve')),
      disponible: nombre(await this.page.textContent('#compte-disponible')),
    };
  }

  async erreurCompte(adresse) {
    await this.page.fill('#compte-adresse', adresse);
    await this.page.click('#verifier-compte');
    await expect(this.page.locator('#erreur-compte')).toBeVisible();
    return this.page.textContent('#erreur-compte');
  }

  /** Vérifie un compte absent du réseau ; renvoie le message et le lien vers la fontaine (ou null). */
  async compteAbsent(adresse) {
    await this.page.fill('#compte-adresse', adresse);
    await this.page.click('#verifier-compte');
    await expect(this.page.locator('#compte-absent')).toBeVisible();
    const fontaine = this.page.locator('#compte-absent-fontaine');
    return {
      texte: await this.page.innerText('#compte-absent'),
      erreurAffichee: await this.page.locator('#erreur-compte').isVisible(),
      fontaine: (await fontaine.isVisible()) ? await fontaine.getAttribute('href') : null,
    };
  }

  async chargerFichierAdresse(contenu) {
    await this.page.setInputFiles('#fichier-adresse', { name: 'compte.adresse-publique.txt', mimeType: 'text/plain', buffer: Buffer.from(contenu) });
  }

  async adresseSaisie() {
    await expect(this.page.locator('#compte-adresse')).not.toHaveValue('');
    return this.page.inputValue('#compte-adresse');
  }

  async ouvrirOperation(operation) {
    await this.page.click(`[data-operation="${operation}"]`);
    await expect(this.page.locator(`#vue-${operation}`)).toBeVisible();
  }

  async remplirEnvoi({ actif, vers, tag, montant }) {
    await this.ouvrirOperation('envoyer');
    if (actif) await this.page.locator(`#envoi-actifs button[data-valeur="${actif}"]`).click();
    await this.page.fill('#envoi-vers', vers);
    await this.page.fill('#envoi-tag', tag || '');
    await this.page.fill('#envoi-montant', montant);
  }

  async envoyer(details) {
    await this.remplirEnvoi(details);
    await this.page.click('#envoi-preparer');
    return this.exporter();
  }

  /** Tente un envoi qui doit échouer ; renvoie le message affiché. */
  async essayerEnvoyer(details) {
    await this.remplirEnvoi(details);
    await this.page.click('#envoi-preparer');
    await expect(this.page.locator('#envoi-erreur')).toBeVisible();
    return this.page.textContent('#envoi-erreur');
  }

  async avertissementDestinataire(adresse) {
    await this.ouvrirOperation('envoyer');
    await this.page.fill('#envoi-vers', adresse);
    return this.page.locator('#envoi-premiere-fois').isVisible();
  }

  async montantMax() {
    await this.ouvrirOperation('envoyer');
    await this.page.click('#envoi-max');
    return this.page.inputValue('#envoi-montant');
  }

  async autoriserJeton({ code, emetteur, plafond }) {
    await this.ouvrirOperation('jeton-ajout');
    await this.page.fill('#ajout-code', code);
    await this.page.fill('#ajout-emetteur', emetteur);
    await this.page.fill('#ajout-plafond', plafond);
    await this.page.click('#ajout-preparer');
    return this.exporter();
  }

  async retirerJeton({ emetteur }) {
    await this.ouvrirOperation('jeton-retrait');
    await this.page.locator(`#retrait-jetons button[data-emetteur="${emetteur}"]`).click();
    await this.page.click('#retrait-preparer');
    return this.exporter();
  }

  async remplirSuppression(vers, confirmation) {
    await this.ouvrirOperation('suppression');
    await this.page.fill('#suppression-vers', vers);
    await this.page.fill('#suppression-confirmation', confirmation);
  }

  async suppressionPossible(vers, confirmation) {
    await this.remplirSuppression(vers, confirmation);
    return this.page.locator('#suppression-preparer').isEnabled();
  }

  async supprimerCompte({ vers, tag }) {
    await this.remplirSuppression(vers, this.compte.slice(-4));
    if (tag) await this.page.fill('#suppression-tag', tag);
    await this.page.click('#suppression-preparer');
    return this.exporter();
  }

  async ajouterSignataire(adresse) {
    await this.ouvrirOperation('signataires');
    await this.page.fill('#signataire-adresse', adresse);
    await this.page.click('#signataire-ajouter');
    return this.exporter();
  }

  async retirerSignataire() {
    await this.ouvrirOperation('signataires');
    await this.page.click('#signataire-retirer');
    return this.exporter();
  }

  async desactiverClePrincipale() {
    await this.ouvrirOperation('signataires');
    await this.page.click('#cle-desactiver');
    return this.exporter();
  }

  async activerClePrincipale() {
    await this.ouvrirOperation('signataires');
    await this.page.click('#cle-reactiver');
    return this.exporter();
  }

  /** Exporte la transaction vérifiée ; renvoie la transaction contenue dans le fichier. */
  async exporter() {
    await expect(this.page.locator('#vue-verifier')).toBeVisible();
    const fichier = await telechargement(this.page, () => this.page.click('#exporter'));
    const enveloppe = JSON.parse(fichier.contenu);
    this.dernierExport = { nom: fichier.nom, contenu: fichier.contenu, enveloppe };
    await expect(this.page.locator('#vue-exporte')).toBeVisible();
    return enveloppe.transaction;
  }
}

module.exports = { PilotePreparer };

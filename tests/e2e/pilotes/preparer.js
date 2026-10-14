// Pilote de la page 2 (préparer une transaction), interface ACTUELLE.
// Seul ce fichier connaît l'écran : après la refonte, on le réécrit et les tests restent identiques.
const { expect } = require('@playwright/test');
const { urlPage, brancherDialogues } = require('../outils');
const { brancherReseau } = require('../reseau');

const CHEMIN = 'ONLINE_transaction/2.1.ONLINE_transaction-prepare/2.1.ONLINE_transaction-prepare.html';
// Heure figée : Stellar inscrit l'heure limite dans la transaction.
const HEURE = new Date('2026-01-01T00:00:00Z');

class PilotePreparer {
  constructor(page, etat) {
    this.page = page;
    this.etat = etat;
    this.dialogues = brancherDialogues(page);
  }

  /** chaine : 'XRPL' ou 'XLM' ; reseau : 'main' ou 'test'. */
  async ouvrir(chaine, reseau = 'test') {
    await this.page.clock.setFixedTime(HEURE);
    await brancherReseau(this.page, this.etat);
    await this.page.goto(urlPage(CHEMIN));
    await this.page.check(`input[name="network"][value="${reseau}"]`);
    await this.page.selectOption('#blockchain-select', chaine);
  }

  /** Vérifie le compte et renvoie les montants affichés. */
  async verifierCompte(adresse) {
    await this.page.fill('#accountAddr', adresse);
    await this.page.click('#checkAddrBtn');
    await expect(this.page.locator('#d_accountValid')).toBeVisible();
    return {
      solde: await this.page.textContent('#s_balance'),
      reserve: await this.page.textContent('#s_reserves'),
      disponible: await this.page.textContent('#s_available'),
    };
  }

  async envoyer({ actif, vers, tag, montant }) {
    await this.page.getByRole('tab', { name: 'Envoyer des fonds' }).click();
    if (actif) {
      await expect(this.page.locator(`#sendSelectCur option[value="${actif}"]`)).toHaveCount(1);
      await this.page.selectOption('#sendSelectCur', actif);
    }
    await this.page.fill('#destAddr', vers);
    if (tag) await this.page.fill('#destTag', tag);
    await this.page.fill('#amount', montant);
    await this.page.click('#prepareTrxBtn');
    return this.lirePreparation();
  }

  async autoriserJeton({ code, emetteur, plafond }) {
    await this.page.getByRole('tab', { name: /Ajouter\/Révoquer trustline/ }).click();
    await this.page.fill('#asset_issuer', emetteur);
    await this.page.fill('#asset_currency', code);
    await this.page.fill('#asset_max', plafond);
    await this.page.click('#prepareTrustBtn');
    return this.lirePreparation();
  }

  async retirerJeton({ emetteur }) {
    await this.page.getByRole('tab', { name: /Ajouter\/Révoquer trustline/ }).click();
    await this.page.check('#trustFreezeCB');
    await expect(this.page.locator(`#trustlist select option[value="${emetteur}"]`)).toHaveCount(1);
    await this.page.selectOption('#trustlist select', emetteur);
    await this.page.click('#prepareTrustBtn');
    return this.lirePreparation();
  }

  async supprimerCompte({ vers, tag }) {
    await this.page.getByRole('tab', { name: 'Supprimer un compte' }).click();
    await expect(this.page.locator('#deleteAccountBtn')).toBeEnabled();
    await this.page.fill('#destRelAddr', vers);
    if (tag) await this.page.fill('#destRelTag', tag);
    await this.page.click('#deleteAccountBtn');
    return this.lirePreparation();
  }

  async ajouterSignataire(adresse) {
    await this.ouvrirSignataires();
    await this.page.fill('#signer_addr', adresse);
    await this.page.click('#b_signers_set');
    return this.lirePreparation();
  }

  async retirerSignataire() {
    await this.ouvrirSignataires();
    await expect(this.page.locator('#b_signers_del')).toBeVisible();
    await this.page.click('#b_signers_del');
    return this.lirePreparation();
  }

  async desactiverClePrincipale() {
    await this.ouvrirSignataires();
    await expect(this.page.locator('#b_signers_master_off')).toBeVisible();
    await this.page.click('#b_signers_master_off');
    return this.lirePreparation();
  }

  async activerClePrincipale() {
    await this.ouvrirSignataires();
    await expect(this.page.locator('#b_signers_master_on')).toBeVisible();
    await this.page.click('#b_signers_master_on');
    return this.lirePreparation();
  }

  async ouvrirSignataires() {
    await this.page.getByRole('tab', { name: 'Gérer un signataire' }).click();
    await expect(this.page.locator('#signer_masterActive')).not.toHaveText('');
  }

  /** Transaction préparée (contenu du fichier .tosign.json), en objet. */
  async lirePreparation() {
    await expect(this.page.locator('#trxResultModal')).toBeVisible();
    return JSON.parse(await this.page.inputValue('#trxResult'));
  }
}

module.exports = { PilotePreparer };

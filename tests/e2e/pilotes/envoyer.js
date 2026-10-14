// Pilote de la page 4 (vérifier puis envoyer une transaction signée), NOUVELLE interface.
// Seul ce fichier connaît l'écran : les tests expriment l'intention et restent ceux du lot 1.
const { expect } = require('@playwright/test');
const { urlPage, brancherDialogues } = require('../outils');
const { brancherReseau } = require('../reseau');

const CHEMIN = 'en-ligne/4-envoyer.html';

/** « 1 250,5 » affiché → « 1250.5 », pour comparer aux valeurs de référence. */
function nombre(texte) {
  return (texte || '').replace(/[\s ]/g, '').replace(',', '.');
}

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

  /** Dépose un fichier, quel que soit son contenu. */
  async chargerContenu(contenu, nom) {
    await this.page.setInputFiles('#fichier', { name: nom, mimeType: 'application/json', buffer: Buffer.from(contenu) });
  }

  /**
   * Charge une transaction signée (objet) et, si la page le demande, choisit le réseau.
   * chaine : 'XRPL' ou 'XLM' ; reseau : 'main' ou 'test'.
   */
  async chargerTransactionSignee(signee, chaine, reseau = 'test') {
    await this.chargerContenu(JSON.stringify(signee, null, 3), `transaction-${chaine.toLowerCase()}.signee.json`);
    await expect(this.page.locator('#vue-verifier')).toBeVisible();
    if (await this.demandeReseau()) await this.choisirReseau(reseau);
    await this.attendrePret();
  }

  async demandeReseau() {
    await expect(this.page.locator('#vue-verifier[data-etat]')).toHaveCount(1);
    return (await this.page.getAttribute('#vue-verifier', 'data-etat')) === 'reseau-a-choisir';
  }

  async choisirReseau(reseau) {
    await this.page.locator(`#choix-reseau [data-valeur="${reseau}"]`).click();
    await this.attendrePret();
  }

  /** Charge le fichier enregistré par l'étape 3 ({ nom, contenu }), tel quel. */
  async chargerFichierSigne(fichier) {
    await this.chargerContenu(fichier.contenu, fichier.nom);
    await expect(this.page.locator('#vue-verifier')).toBeVisible();
    await this.attendrePret();
  }
  async attendrePret() {
    await expect(this.page.locator('#vue-verifier[data-etat="pret"]')).toHaveCount(1);
  }

  async reseauAffiche() {
    return this.page.textContent('#reseau-lu');
  }

  async bandeauTestnet() {
    return this.page.locator('#bandeau-testnet').isVisible();
  }

  async erreurChargement() {
    await expect(this.page.locator('#erreur-chargement')).toBeVisible();
    return this.page.textContent('#erreur-chargement');
  }

  async delaiAffiche() {
    await expect(this.page.locator('#delai')).toBeVisible();
    return this.page.textContent('#delai');
  }

  /** Ligne indiquant si la transaction a été préparée sur ce poste (E-1). */
  async correspondance() {
    await expect(this.page.locator('#correspondance')).toBeVisible();
    return this.page.textContent('#correspondance');
  }

  async messageVerification() {
    return this.page.textContent('#message-verification');
  }

  async envoiPossible() {
    if ((await this.page.getAttribute('#vue-verifier', 'data-etat')) !== 'reseau-a-choisir') await this.attendrePret();
    return this.page.locator('#bouton-envoyer').isEnabled();
  }

  /** Récapitulatif affiché avant l'envoi, normalisé. */
  async lireRecapitulatif() {
    const bordereau = this.page.locator('#bordereau');
    const texte = async (champ, selecteur = 'dd') => {
      const cible = bordereau.locator(`[data-champ="${champ}"] ${selecteur}`).first();
      return (await cible.count()) ? (await cible.textContent()).trim() : undefined;
    };
    const tag = await texte('tag');
    return {
      de: await texte('de'),
      vers: await texte('vers'),
      tag: tag === 'Aucun' ? undefined : tag,
      montant: nombre(await texte('montant', 'dd span:first-child')),
      devise: await texte('montant', '.montant__devise'),
      frais: nombre(await texte('frais', 'dd span:first-child')),
      multisignature: (await bordereau.locator('[data-multisignature]').count()) > 0,
    };
  }

  /** Envoie et renvoie { reussi, detail } tel qu'affiché. Si l'envoi est bloqué, ne clique pas. */
  async envoyer() {
    if (!(await this.envoiPossible())) return { reussi: false, detail: await this.messageVerification() };
    await this.page.click('#bouton-envoyer');
    await expect(this.page.locator('#vue-resultat')).toBeVisible({ timeout: 15000 });
    return {
      reussi: (await this.page.getAttribute('#vue-resultat', 'data-reussi')) === 'oui',
      detail: await this.page.innerText('#vue-resultat'),
    };
  }
}

module.exports = { PiloteEnvoyer };

// Outils partagés par les pilotes.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const RACINE = path.join(__dirname, '../..');
const DONNEES = path.join(__dirname, '../donnees');

/** URL file:// d'une page du dépôt. */
function urlPage(cheminRelatif) {
  return pathToFileURL(path.join(RACINE, cheminRelatif)).href;
}

/** Chemin d'un fichier de données de test. */
function donnee(cheminRelatif) {
  return path.join(DONNEES, cheminRelatif);
}

/**
 * Répond aux prompt() dans l'ordre des réponses fournies et mémorise les alert().
 * Les pages actuelles demandent les secrets par prompt() : seuls les pilotes le savent.
 */
function brancherDialogues(page) {
  const etat = { reponses: [], alertes: [] };
  page.on('dialog', async (dialogue) => {
    if (dialogue.type() === 'prompt') {
      await dialogue.accept(etat.reponses.length ? etat.reponses.shift() : '');
    } else {
      etat.alertes.push(dialogue.message());
      await dialogue.accept();
    }
  });
  return etat;
}

/** Déclenche un téléchargement et renvoie son nom et son contenu texte. */
async function telechargement(page, declencheur) {
  const [fichier] = await Promise.all([page.waitForEvent('download'), declencheur()]);
  return { nom: fichier.suggestedFilename(), contenu: fs.readFileSync(await fichier.path(), 'utf8') };
}

/**
 * Valeur de référence enregistrée dans tests/donnees/<chemin>.
 * Avec ENREGISTRER=1, un fichier absent est créé à partir de la valeur obtenue (version actuelle).
 * Sans ENREGISTRER, un fichier absent fait échouer le test.
 */
function reference(cheminRelatif, valeurObtenue) {
  const chemin = donnee(cheminRelatif);
  if (!fs.existsSync(chemin)) {
    if (process.env.ENREGISTRER !== '1') throw new Error(`Référence absente : ${cheminRelatif} (lancer avec ENREGISTRER=1 sur la version de référence)`);
    fs.mkdirSync(path.dirname(chemin), { recursive: true });
    fs.writeFileSync(chemin, JSON.stringify(valeurObtenue, null, 3) + '\n');
  }
  return JSON.parse(fs.readFileSync(chemin, 'utf8'));
}

module.exports = { urlPage, donnee, brancherDialogues, telechargement, reference };

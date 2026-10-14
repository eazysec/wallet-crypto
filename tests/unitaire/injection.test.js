// Aucune injection possible : le code de l'application n'utilise aucune fonction qui
// interprète du texte comme du HTML ou du code, et le HTML ne contient ni script,
// ni gestionnaire d'événement, ni style écrits en ligne.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '../..');
const DOSSIERS = ['commun', 'en-ligne', 'hors-ligne'];

// Bibliothèque tierce minifiée, suivie à part (constat F-09).
const TIERS = ['commun/securewalletbundle-2.5.4.js'];

const INTERDITS_JS = [
  [/\.(inner|outer)HTML\s*=/, 'innerHTML ou outerHTML'],
  [/insertAdjacentHTML/, 'insertAdjacentHTML'],
  [/document\.write/, 'document.write'],
  [/\beval\s*\(/, 'eval'],
  [/new\s+Function\s*\(/, 'new Function'],
  [/set(Timeout|Interval)\s*\(\s*['"`]/, 'setTimeout ou setInterval avec du texte'],
  [/\.html\s*\(/, '.html() de jQuery'],
  [/\bjQuery\b|(^|[^\w.])\$\(/m, 'jQuery'],
  [/\.setAttribute\s*\(\s*['"]on/i, "gestionnaire d'événement posé par setAttribute"],
];

const INTERDITS_HTML = [
  [/<script(?![^>]*\bsrc=)[^>]*>/i, 'script écrit dans la page'],
  [/\son[a-z]+\s*=/i, "gestionnaire d'événement écrit dans le HTML (onclick=…)"],
  [/\sstyle\s*=/i, 'attribut style'],
  [/javascript:/i, 'lien javascript:'],
];

function fichiersAnalyses() {
  const liste = [];
  for (const dossier of DOSSIERS) {
    const chemin = path.join(RACINE, dossier);
    if (!fs.existsSync(chemin)) continue;
    for (const nom of fs.readdirSync(chemin)) {
      const relatif = `${dossier}/${nom}`;
      if (!/\.(js|html)$/.test(nom) || TIERS.includes(relatif)) continue;
      liste.push(relatif);
    }
  }
  return liste;
}

test('le code analysé n\'est pas vide', () => {
  assert.ok(fichiersAnalyses().length > 0);
});

for (const relatif of fichiersAnalyses()) {
  test(`aucune injection possible : ${relatif}`, () => {
    const contenu = fs.readFileSync(path.join(RACINE, relatif), 'utf8')
      // Les commentaires peuvent citer les noms interdits.
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/<!--[\s\S]*?-->/g, '');
    const interdits = relatif.endsWith('.js') ? INTERDITS_JS : INTERDITS_HTML;
    const trouves = interdits.filter(([motif]) => motif.test(contenu)).map(([, nom]) => nom);
    assert.deepEqual(trouves, [], `${relatif} utilise : ${trouves.join(', ')}`);
  });
}

// Un champ secret (type="password" ou data-secret) ne doit jamais partir vers un correcteur
// orthographique en ligne, ni être mémorisé ou modifié par le navigateur.
for (const relatif of fichiersAnalyses().filter((f) => f.endsWith('.html'))) {
  test(`champs secrets protégés : ${relatif}`, () => {
    const contenu = fs.readFileSync(path.join(RACINE, relatif), 'utf8');
    const secrets = (contenu.match(/<input\b[^>]*>/gi) || []).filter((balise) => /type="password"|\sdata-secret\b/.test(balise));
    for (const balise of secrets) {
      assert.match(balise, /\sspellcheck="false"/, `spellcheck="false" manquant : ${balise}`);
      assert.match(balise, /\sautocapitalize="off"/, `autocapitalize="off" manquant : ${balise}`);
      assert.match(balise, /\sautocomplete="(off|new-password|current-password)"/, `autocomplete manquant : ${balise}`);
    }
  });
}

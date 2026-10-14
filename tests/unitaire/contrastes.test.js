// Contrastes des couleurs de commun/commun.css, selon les seuils WCAG 2.2 niveau AA :
// 4,5:1 pour le texte, 3:1 pour les bordures de champs et les composants d'interface.
// Les couleurs sont lues dans le CSS : toute modification de couleur est contrôlée.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CSS = fs.readFileSync(path.join(__dirname, '../../commun/commun.css'), 'utf8');

function variables(selecteur) {
  const debut = CSS.indexOf(`${selecteur} {`);
  assert.ok(debut >= 0, `bloc ${selecteur} introuvable`);
  const bloc = CSS.slice(debut, CSS.indexOf('}', debut));
  return Object.fromEntries([...bloc.matchAll(/--([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));
}

function luminance(hex) {
  const canaux = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * canaux[0] + 0.7152 * canaux[1] + 0.0722 * canaux[2];
}

function contraste(a, b) {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (clair + 0.05) / (sombre + 0.05);
}

const COMMUNES = variables(':root');
const ZONES = { publique: variables('.zone-publique'), privee: variables('.zone-privee') };

// [texte ou composant, fond, seuil, usage]
const PAIRES = [
  ['encre', 'fond', 4.5, 'texte courant'],
  ['encre', 'fond-2', 4.5, 'texte des panneaux latéraux'],
  ['encre', 'survol', 4.5, 'entrée de menu active'],
  ['doux', 'fond', 4.5, 'texte secondaire'],
  ['doux', 'fond-2', 4.5, 'texte secondaire des panneaux'],
  ['action', 'fond', 4.5, 'liens'],
  ['action-encre', 'action', 4.5, 'texte des boutons principaux'],
  ['danger', 'fond', 4.5, 'erreurs'],
  ['danger', 'fond-2', 4.5, 'mention « Irréversible » du menu'],
  ['danger', 'danger-fond', 4.5, 'messages de danger'],
  ['attention-encre', 'attention-fond', 4.5, "messages d'attention"],
  ['reussite', 'fond', 4.5, 'titres de réussite'],
  ['reussite', 'fond-2', 4.5, '« Vérifié » dans les panneaux'],
  ['bande-encre', 'bande', 4.5, 'bande de zone'],
  ['danger-plein-encre', 'danger-plein', 4.5, 'boutons destructifs'],
  ['champ-bordure', 'fond', 3, 'bordure des champs'],
  ['champ-bordure', 'champ', 3, 'bordure des champs, côté intérieur'],
  ['action', 'fond', 3, 'contour de focus'],
];

for (const [nomZone, zone] of Object.entries(ZONES)) {
  for (const [texte, fond, seuil, usage] of PAIRES) {
    test(`zone ${nomZone} · ${usage} (${texte} sur ${fond}) ≥ ${seuil}:1`, () => {
      const ratio = contraste(zone[texte], zone[fond]);
      assert.ok(ratio >= seuil, `${ratio.toFixed(2)}:1 seulement`);
    });
  }
}

for (const [texte, fond] of [['alarme-encre', 'alarme'], ['testnet-encre', 'testnet'], ['pastille-publique-encre', 'pastille-publique'], ['pastille-privee-encre', 'pastille-privee']]) {
  test(`${texte} sur ${fond} ≥ 4.5:1`, () => {
    const ratio = contraste(COMMUNES[texte], COMMUNES[fond]);
    assert.ok(ratio >= 4.5, `${ratio.toFixed(2)}:1 seulement`);
  });
}

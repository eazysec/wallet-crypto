const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('../../commun/historique');

function stockage() {
  const valeurs = new Map();
  return {
    getItem: (cle) => (valeurs.has(cle) ? valeurs.get(cle) : null),
    setItem: (cle, valeur) => valeurs.set(cle, String(valeur)),
    removeItem: (cle) => valeurs.delete(cle),
  };
}

const PREPARATION = { empreinte: 'e1c6dd', chaine: 'XRPL', reseau: 'test', operation: 'paiement', date: new Date('2026-10-14T10:35:00Z') };

test('une préparation notée est retrouvée par son empreinte', () => {
  const h = H.creerHistorique(stockage());
  h.noterPreparation(PREPARATION);
  const trouvee = h.trouverPreparation('e1c6dd');
  assert.equal(trouvee.operation, 'paiement');
  assert.equal(trouvee.date.toISOString(), '2026-10-14T10:35:00.000Z');
  assert.equal(h.trouverPreparation('autre'), null);
});

test('destinataire : inconnu, puis connu une fois noté, pour cette chaîne et ce réseau seulement', () => {
  const h = H.creerHistorique(stockage());
  assert.equal(h.destinataireConnu('XRPL', 'test', 'rKt4'), false);
  h.noterDestinataire('XRPL', 'test', 'rKt4');
  assert.equal(h.destinataireConnu('XRPL', 'test', 'rKt4'), true);
  assert.equal(h.destinataireConnu('XRPL', 'main', 'rKt4'), false);
});

test('historique désactivé : rien n\'est noté, et aucun destinataire n\'est signalé', () => {
  const h = H.creerHistorique(stockage());
  h.activer(false);
  assert.equal(h.actif(), false);
  h.noterPreparation(PREPARATION);
  h.noterDestinataire('XRPL', 'test', 'rKt4');
  assert.equal(h.trouverPreparation('e1c6dd'), null);
  assert.equal(h.destinataireConnu('XRPL', 'test', 'rKt4'), null);
});

test('effacer vide l\'historique', () => {
  const h = H.creerHistorique(stockage());
  h.noterPreparation(PREPARATION);
  h.noterDestinataire('XRPL', 'test', 'rKt4');
  h.effacer();
  assert.equal(h.trouverPreparation('e1c6dd'), null);
  assert.equal(h.destinataireConnu('XRPL', 'test', 'rKt4'), false);
});

test('données abîmées ou modifiées dans le stockage : ignorées sans erreur', () => {
  const s = stockage();
  s.setItem('securedwallet.preparations', '{pas du json');
  s.setItem('securedwallet.destinataires', '{"pas":"une liste"}');
  const h = H.creerHistorique(s);
  assert.equal(h.trouverPreparation('e1c6dd'), null);
  assert.equal(h.destinataireConnu('XRPL', 'test', 'rKt4'), false);
  h.noterPreparation(PREPARATION);
  assert.ok(h.trouverPreparation('e1c6dd'));
});

test('stockage indisponible : l\'historique fonctionne en mémoire', () => {
  const h = H.creerHistorique(null);
  h.noterPreparation(PREPARATION);
  assert.ok(h.trouverPreparation('e1c6dd'));
});

test('au plus 50 préparations sont gardées, les plus récentes', () => {
  const h = H.creerHistorique(stockage());
  for (let i = 0; i < 60; i++) h.noterPreparation({ ...PREPARATION, empreinte: `e${i}` });
  assert.ok(h.trouverPreparation('e59'));
  assert.equal(h.trouverPreparation('e5'), null);
});

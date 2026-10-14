const { test } = require('node:test');
const assert = require('node:assert/strict');
const { suggererMot } = require('../../commun/cles');

const LISTE = ['abandon', 'ability', 'able', 'frost', 'front', 'frown', 'galaxy', 'velvet'];

test('suggererMot : les 4 premières lettres suffisent à désigner un mot BIP39', () => {
  assert.equal(suggererMot('galax', LISTE), 'galaxy');
  assert.equal(suggererMot('velvett', LISTE), 'velvet');
});

test('suggererMot : faute de frappe proche, une seule correction possible', () => {
  assert.equal(suggererMot('frots', LISTE), 'frost');
  assert.equal(suggererMot('glaaxy', LISTE), 'galaxy');
});

test('suggererMot : rien si aucun mot proche ou si plusieurs le sont autant', () => {
  assert.equal(suggererMot('zzzzzz', LISTE), null);
  assert.equal(suggererMot('frn', LISTE), null); // front ou frown, à 2 fautes chacun
  assert.equal(suggererMot('fron', LISTE), 'front'); // « frown » commence par « frow »
  assert.equal(suggererMot('', LISTE), null);
});

test('suggererMot : insensible à la casse et aux espaces', () => {
  assert.equal(suggererMot('  FROTS ', LISTE), 'frost');
});

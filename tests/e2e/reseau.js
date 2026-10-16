// Réseau simulé pour les pages en ligne : nœud XRPL et serveur Horizon factices.
// Aucune requête ne sort vers internet.

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};

/**
 * État du réseau simulé.
 * xrpl.registre : numéro du dernier registre validé ; xrpl.resultat : code renvoyé pour une transaction.
 * xrpl.pannes : { commande: message } pour simuler une erreur du nœud sur une commande.
 * xlm.refus : code de refus renvoyé par Horizon (par exemple 'tx_too_late'), sinon succès.
 */
function nouvelEtat({ xrplComptes = {}, xlmComptes = {}, registre = 90000000, resultat = 'tesSUCCESS', refus = null } = {}) {
  return {
    bloquees: [],
    xrpl: { comptes: xrplComptes, registre, resultat, pannes: {}, requetes: [], soumises: [] },
    xlm: { comptes: xlmComptes, refus, soumises: [] },
  };
}

async function brancherReseau(page, etat) {
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('file:')) return route.continue();
    if (url.startsWith('https://horizon')) return repondreHorizon(route, etat.xlm);
    etat.bloquees.push(url);
    return route.abort();
  });
  await page.routeWebSocket(/^wss:\/\//, (ws) => {
    ws.onMessage((message) => {
      const requete = JSON.parse(String(message));
      etat.xrpl.requetes.push(requete);
      ws.send(JSON.stringify(repondreXrpl(requete, etat.xrpl)));
    });
  });
}

// ---------- XRPL ----------

function repondreXrpl(req, x) {
  const ok = (result) => ({ id: req.id, status: 'success', type: 'response', result });
  const ko = (error, message) => ({ id: req.id, status: 'error', type: 'response', error, error_message: message, request: req });
  const compte = x.comptes[req.account];
  if (x.pannes[req.command]) return ko('internal', x.pannes[req.command]);
  switch (req.command) {
    case 'server_info':
      return ok({ info: {
        build_version: '2.3.0', complete_ledgers: `1-${x.registre}`, load_factor: 1, network_id: 1, server_state: 'full',
        validated_ledger: { age: 1, base_fee_xrp: 0.00001, hash: 'A'.repeat(64), reserve_base_xrp: 1, reserve_inc_xrp: 0.2, seq: x.registre },
      } });
    case 'server_state':
      return ok({ state: {
        build_version: '2.3.0', load_base: 256, load_factor: 256, server_state: 'full',
        validated_ledger: { base_fee: 10, close_time: 0, hash: 'A'.repeat(64), reserve_base: 1000000, reserve_inc: 200000, seq: x.registre },
      } });
    case 'ledger':
      return ok({ ledger_index: x.registre, ledger_hash: 'B'.repeat(64), validated: true, ledger: { ledger_index: String(x.registre), closed: true } });
    case 'account_info': {
      if (!compte) return ko('actNotFound', 'Account not found.');
      const resultat = {
        account_data: {
          Account: req.account, Balance: compte.solde, Flags: compte.desactiverPrincipale ? 0x00100000 : 0,
          LedgerEntryType: 'AccountRoot', OwnerCount: compte.objets || 0, PreviousTxnID: 'C'.repeat(64),
          PreviousTxnLgrSeq: 1, Sequence: compte.sequence, index: 'D'.repeat(64),
          ...(compte.transferRate ? { TransferRate: compte.transferRate } : {}),
        },
        account_flags: { disableMasterKey: !!compte.desactiverPrincipale, requireDestinationTag: false },
        ledger_index: x.registre,
        validated: true,
      };
      if (req.signer_lists) {
        resultat.signer_lists = (compte.signataires || []).length === 0 ? [] : [{
          LedgerEntryType: 'SignerList', SignerQuorum: 1, Flags: 0, OwnerNode: '0', SignerListID: 0,
          SignerEntries: compte.signataires.map((a) => ({ SignerEntry: { Account: a, SignerWeight: 1 } })),
          PreviousTxnID: 'E'.repeat(64), PreviousTxnLgrSeq: 1, index: 'F'.repeat(64),
        }];
      }
      return ok(resultat);
    }
    case 'account_lines':
      if (!compte) return ko('actNotFound', 'Account not found.');
      return ok({ account: req.account, ledger_index: x.registre, validated: true, lines: (compte.jetons || []).map((j) => ({
        account: j.emetteur, balance: j.solde, currency: j.code, limit: '10000', limit_peer: '0',
        no_ripple: true, no_ripple_peer: false, quality_in: 0, quality_out: 0,
      })) });
    case 'account_objects':
      return ok({ account: req.account, account_objects: [], ledger_index: x.registre, validated: true });
    case 'submit':
      x.soumises.push(req.tx_blob);
      return ok({
        accepted: true, applied: true, broadcast: true, kept: true, queued: false,
        engine_result: 'tesSUCCESS', engine_result_code: 0,
        engine_result_message: 'The transaction was applied. Only final in a validated ledger.',
        tx_blob: req.tx_blob, tx_json: {},
      });
    case 'tx':
      return ok({ hash: req.transaction, ledger_index: x.registre, validated: true, meta: { TransactionIndex: 0, TransactionResult: x.resultat, AffectedNodes: [] } });
    case 'ping':
      return ok({});
    default:
      return ko('unknownCmd', `Commande non simulée : ${req.command}`);
  }
}

// ---------- Stellar (Horizon) ----------

function json(route, status, corps) {
  return route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(corps) });
}

const INTROUVABLE = { type: 'https://stellar.org/horizon-errors/not_found', title: 'Resource Missing', status: 404, detail: 'Introuvable sur le réseau simulé.' };
const FRAIS = { max: '100', min: '100', mode: '100', p10: '100', p20: '100', p30: '100', p40: '100', p50: '100', p60: '100', p70: '100', p80: '100', p90: '100', p95: '100', p99: '100' };

function compteHorizon(id, c) {
  return {
    id, account_id: id, sequence: c.sequence, subentry_count: (c.jetons || []).length + (c.signataires || []).length,
    balances: [
      ...(c.jetons || []).map((j) => ({
        asset_type: 'credit_alphanum4', asset_code: j.code, asset_issuer: j.emetteur, balance: j.solde,
        limit: '10000.0000000', buying_liabilities: '0.0000000', selling_liabilities: '0.0000000', is_authorized: true,
      })),
      { asset_type: 'native', balance: c.solde, buying_liabilities: '0.0000000', selling_liabilities: '0.0000000' },
    ],
    signers: [
      ...(c.signataires || []).map((k) => ({ key: k, weight: 1, type: 'ed25519_public_key' })),
      { key: id, weight: c.poidsPrincipal === undefined ? 1 : c.poidsPrincipal, type: 'ed25519_public_key' },
    ],
    thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 },
    flags: { auth_required: false, auth_revocable: false, auth_immutable: false, auth_clawback_enabled: false },
    num_sponsoring: 0, num_sponsored: 0, paging_token: id, last_modified_ledger: 100, sequence_ledger: 100, sequence_time: '0',
    data: {}, _links: { self: { href: '' } },
  };
}

function repondreHorizon(route, x) {
  const req = route.request();
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
  const chemin = new URL(req.url()).pathname;
  const compte = chemin.match(/^\/accounts\/(G[A-Z2-7]{55})$/);
  if (compte) {
    const c = x.comptes[compte[1]];
    return c ? json(route, 200, compteHorizon(compte[1], c)) : json(route, 404, INTROUVABLE);
  }
  if (chemin === '/fee_stats') {
    return json(route, 200, { last_ledger: '100', last_ledger_base_fee: '100', ledger_capacity_usage: '0.10', fee_charged: FRAIS, max_fee: FRAIS });
  }
  if (chemin === '/transactions' && req.method() === 'POST') {
    const xdr = new URLSearchParams(req.postData() || '').get('tx');
    x.soumises.push(xdr);
    if (x.refus) {
      return json(route, 400, {
        type: 'https://stellar.org/horizon-errors/transaction_failed', title: 'Transaction Failed', status: 400,
        detail: 'Refus simulé.', extras: { envelope_xdr: xdr, result_codes: { transaction: x.refus } },
      });
    }
    return json(route, 200, {
      id: 'a'.repeat(64), hash: 'a'.repeat(64), ledger: 100, successful: true, paging_token: '1',
      envelope_xdr: xdr, result_xdr: 'AAAAAAAAAGQAAAAAAAAAAQAAAAAAAAABAAAAAAAAAAA=',
    });
  }
  return json(route, 404, INTROUVABLE);
}

module.exports = { nouvelEtat, brancherReseau };

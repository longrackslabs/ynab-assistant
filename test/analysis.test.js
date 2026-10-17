import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMoney, displayMoney, digitSwap} from '../src/money.js';
import {findSubsets} from '../src/search.js';
import {analyzeReconciliation} from '../src/analyze.js';
import {compareStatement} from '../src/statement.js';
import {previewClearStatus, verifyFreshPreview} from '../src/preview.js';

const tx = (id, amount, extra = {}) => ({id, amount, date: '2026-10-05', cleared: 'uncleared', payee_name: 'Example Shop', ...extra});
const snap = (rows, extra = {}) => ({account: {id: 'test-account', type: 'checking', cleared_balance: 100000, uncleared_balance: rows.filter(t => t.cleared === 'uncleared' && !t.deleted).reduce((s,t) => s+t.amount, 0)}, transactions: rows, history_complete: true, ...extra});
const limits = {max_candidates: 20, max_states: 100000, max_operations: 1000000, max_milliseconds: 5000};

test('money uses exact signed milliunits and rejects malformed or unsafe amounts', () => {
  for (const [text, n] of [['0',0], ['-0.001',-1], ['+123.45',123450], ['936.90',936900]]) { assert.equal(parseMoney(text), n); assert.equal(parseMoney(displayMoney(n)), n); }
  for (const bad of ['1,000.00', '$3', 'NaN', '1.0001', '1e3', ' 3', '9007199254740992']) assert.throws(() => parseMoney(bad));
  assert.equal(digitSwap(-237000,-273000), true);
  assert.equal(digitSwap(1000,10000), true);
  assert.equal(digitSwap(-237000,273000), false);
});
test('bounded signed search agrees with exhaustive small searches', () => {
  let seed = 123456;
  const rand = n => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed % n; };
  for (let trial=0; trial<100; trial++) {
    const amounts = Array.from({length: 7}, () => rand(25)-12), target = rand(45)+1;
    const expected=[];
    for (let mask=1; mask<128; mask++) if (amounts.reduce((s,a,i)=>s+((mask&(1<<i))?a:0),0)===target) expected.push(BigInt(mask));
    const actual = findSubsets(amounts,target,limits);
    assert.equal(actual.complete,true);
    if (expected.length<=20) assert.deepEqual(new Set(actual.masks),new Set(expected));
    else { assert.equal(actual.truncated,true); for (const mask of actual.masks) assert.ok(expected.includes(mask)); }
  }
});
test('ambiguity, refunds and resource limits remain explicit', () => {
  const result = analyzeReconciliation({snapshot:snap([tx('a',-10000),tx('b',-20000),tx('c',-30000),tx('refund',5000)]),bank_balance:'70'});
  assert.equal(result.candidates.length,2); assert.equal(result.unique_within_complete_search,false); assert.equal(result.can_auto_clear,false);
  const limited = findSubsets(Array.from({length:100},(_,i)=>i+1),1234,{...limits,max_operations:1});
  assert.equal(limited.complete,false); assert.equal(limited.reason,'operation_limit');
});
test('card debt convention and signed credit balances', () => {
  const snapshot=snap([tx('a',-25000)],{account:{id:'test-account',type:'creditCard',cleared_balance:-100000,uncleared_balance:-25000}});
  assert.equal(analyzeReconciliation({snapshot,bank_balance:'125'}).difference,-25000);
  assert.equal(analyzeReconciliation({snapshot,bank_balance:'25',bank_balance_convention:'signed'}).difference,125000);
});
test('incomplete history, inconsistent totals and already balanced never claim a unique clear', () => {
  const snapshot=snap([tx('a',-10000)],{history_complete:false});
  assert.equal(analyzeReconciliation({snapshot,bank_balance:'90'}).unique_within_complete_search,false);
  snapshot.history_complete=true; snapshot.account.uncleared_balance=-20000;
  assert.equal(analyzeReconciliation({snapshot,bank_balance:'90'}).input_complete,false);
  const balanced=analyzeReconciliation({snapshot,bank_balance:'100'});
  assert.equal(balanced.already_balanced,true); assert.deepEqual(balanced.candidates,[]);
});
test('duplicate and cross-account snapshots are rejected', () => {
  for (const rows of [[tx('a',1),tx('a',2)],[tx('a',1,{account_id:'other'})]]) assert.throws(()=>analyzeReconciliation({snapshot:snap(rows),bank_balance:'100'}));
});
test('transposition is a specific digit swap; divisibility by nine is only a clue', () => {
  const snapshot=snap([tx('payment',237000,{cleared:'cleared'})]);
  const result=analyzeReconciliation({snapshot,bank_balance:'136'});
  assert.equal(result.difference_divisible_by_nine_minor_units,true);
  assert.equal(result.transposition_candidates[0].possible_correct_amount,273000);
  assert.equal(analyzeReconciliation({snapshot:snap([tx('other',100000,{cleared:'cleared'})]),bank_balance:'136'}).transposition_candidates.length,0);
});
const statement = (rows, entries, extra={}) => ({snapshot:snap(rows,{as_of:'2026-10-31'}),bank_entries:entries,start_date:'2026-10-01',end_date:'2026-10-31',...extra});
const bank = (id,amount,extra={}) => ({id,amount,date:'2026-10-06',payee:'Example Shop',...extra});
test('statement matching respects amount, merchant, nearby date and pending status', () => {
  const result=compareStatement(statement([tx('a',-10000),tx('refund',5000)], [bank('posted',-10000),bank('refund-bank',5000),bank('pending',-2000,{posted:false})],{opening_balance:100000,closing_balance:95000}));
  assert.equal(result.matches.length,2); assert.equal(result.statement_arithmetic.matches,true);
  assert.deepEqual(result.excluded_bank_entry_ids,['pending']);
  assert.equal(compareStatement(statement([tx('a',-10000)],[bank('b',-10000,{payee:'Unrelated Merchant'})])).matches.length,0);
});
test('duplicate amounts and merchants are not greedily paired', () => {
  const result=compareStatement(statement([tx('a',-10000),tx('b',-10000)], [bank('x',-10000),bank('y',-10000)]));
  assert.equal(result.matches.length,0); assert.equal(result.unmatched_bank_entries.length,2);
  assert.equal(result.unmatched_bank_entries[0].candidate_transaction_ids.length,2);
});
test('statement dates, multiplicity and opening balance arithmetic are validated', () => {
  assert.throws(()=>compareStatement(statement([], [bank('a',1),bank('a',1)])));
  assert.throws(()=>compareStatement(statement([], [],{start_date:'2026-11-01'})));
  assert.throws(()=>compareStatement(statement([], [bank('a',1,{date:'2026-02-30'})])));
  const result=compareStatement(statement([tx('old',-1000,{date:'2026-09-01'})],[bank('late',-1000,{date:'2026-11-01'}),bank('x',-2000)],{opening_balance:10000,closing_balance:9000}));
  assert.equal(result.statement_arithmetic.matches,false); assert.equal(result.matches.length,0);
  assert.deepEqual(result.excluded_bank_entry_ids,['late']);
});
test('clear preview calculates balances without applying anything', () => {
  const snapshot=snap([tx('a',-10000),tx('b',2000)]);
  const plan=previewClearStatus({snapshot,transaction_ids:['a'],desired_status:'cleared'});
  assert.equal(plan.resulting_cleared_balance,90000); assert.equal(plan.resulting_uncleared_balance,2000);
  assert.equal(plan.applied,false); assert.equal(verifyFreshPreview(plan,structuredClone(snapshot)),true);
  const edited=structuredClone(snapshot); edited.transactions[0].amount=-9000;
  assert.throws(()=>verifyFreshPreview(plan,edited),/Stale/);
  edited.transactions[0].amount=-10000; edited.account.cleared_balance++;
  assert.throws(()=>verifyFreshPreview(plan,edited),/Stale/);
  assert.equal(snapshot.transactions[0].cleared,'uncleared');
});
test('preview rejects reconciled, deleted, missing, duplicate and extra edit fields', () => {
  const snapshot=snap([tx('a',1,{cleared:'reconciled'}),tx('b',2,{deleted:true}),tx('c',3)]);
  for (const ids of [['a'],['b'],['missing'],['c','c']]) assert.throws(()=>previewClearStatus({snapshot,transaction_ids:ids,desired_status:'cleared'}));
  assert.throws(()=>previewClearStatus({snapshot,transaction_ids:['c'],desired_status:'cleared',amount:999}));
  assert.throws(()=>previewClearStatus({snapshot,transaction_ids:['c'],desired_status:'reconciled'}));
});

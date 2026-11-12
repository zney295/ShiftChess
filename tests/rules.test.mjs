import assert from 'node:assert/strict';
import test from 'node:test';
import { Chess } from 'chess.js';
import { Match, shiftedPosition } from '../src/rules.ts';

test('periodic SHIFT announces fixed squares one round in advance', () => {
  const match = new Match('periodic', 'swap', () => 0);
  for (const [from, to] of [['e2','e4'],['d7','d5'],['e4','d5'],['g8','f6']]) {
    match.play(from,to);
    match.settle();
  }
  const announced = match.pending;
  assert.equal(announced.at, 6);
  assert.deepEqual(announced.pairs, [['a8','b8']]);
  match.play('g1','f3');
  match.settle();
  assert.equal(match.pending, announced);
  match.play('b8','c6');
  assert.equal(match.settle().applied,true);
  assert.equal(match.chess.get('b8').type,'r');
  assert.equal(match.chess.get('c6').type,'n');
  assert.equal(match.chess.get('a8'),undefined);
  assert.equal(match.chess.fen().split(' ')[2],'KQk');
  assert.equal(match.chess.turn(),'w');
});

test('rejects a SHIFT that exposes a king or moves a pawn', () => {
  const chess = new Chess('k3r3/8/8/8/8/8/4N3/4K3 w - - 0 1');
  const shift = (a,b) => ({effect:'slide',pairs:[[a,b]],at:6});
  assert.equal(shiftedPosition(chess,shift('e2','d2')),null);
  assert.equal(shiftedPosition(new Chess(),shift('e2','e4')),null);
  assert.equal(chess.get('e2').type,'n');
});

test('double SHIFT only accepts disjoint pairs and keeps the move clock', () => {
  const chess = new Chess('k7/8/8/2n2b2/8/8/2N2B2/K7 w - - 17 12');
  const make = pairs => ({effect:'double',pairs,at:24});
  assert.equal(shiftedPosition(chess,make([['c2','f2'],['f2','f5']])),null);
  const fen=shiftedPosition(chess,make([['c2','f2'],['c5','f5']]));
  assert.ok(fen);
  assert.equal(new Chess(fen).get('f5').type,'n');
  assert.equal(fen.split(' ').slice(-2).join(' '),'17 12');
});

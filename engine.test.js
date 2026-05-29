#!/usr/bin/env node
/* Logic checks for the quiz engine (plan verification step 3).
   Run: node engine.test.js   (exits non-zero on failure) */
const assert = require('assert');
const E = require('./engine.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}

// Deterministic RNG (mulberry32) so tests are reproducible.
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('shuffle keeps all elements (no loss/dup)', () => {
  const src = [1, 2, 3, 4, 5, 6, 7, 8];
  const out = E.shuffle(src, rng(7));
  assert.strictEqual(out.length, src.length);
  assert.deepStrictEqual(out.slice().sort((a, b) => a - b), src);
  assert.deepStrictEqual(src, [1, 2, 3, 4, 5, 6, 7, 8], 'original must not mutate');
});

test('prepareChoices: correct answer tracked by value after shuffle (mc)', () => {
  const q = { type: 'mc', choices: ['Alpha', 'Bravo', 'Charlie', 'Delta'], answer: 2 };
  for (let s = 0; s < 200; s++) {
    const p = E.prepareChoices(q, rng(s));
    assert.strictEqual(p.choices[p.correctIndex], 'Charlie',
      'correctIndex must always point at the right text');
    assert.strictEqual(p.choices.length, 4);
  }
});

test('prepareChoices: anchorLast option stays pinned last', () => {
  const q = { type: 'mc', anchorLast: true,
    choices: ['Judgment', 'Vision', 'Reaction time', 'All of the above'], answer: 3 };
  for (let s = 0; s < 100; s++) {
    const p = E.prepareChoices(q, rng(s));
    assert.strictEqual(p.choices[3], 'All of the above', 'anchor must stay last');
    assert.strictEqual(p.correctIndex, 3, 'correct (the anchor) must be index 3');
  }
});

test('prepareChoices: anchorLast with a non-anchor correct answer', () => {
  const q = { type: 'mc', anchorLast: true,
    choices: ['Get sleep', 'Don\'t drink', 'Stop every 2h', 'All of the above'], answer: 0 };
  for (let s = 0; s < 100; s++) {
    const p = E.prepareChoices(q, rng(s));
    assert.strictEqual(p.choices[3], 'All of the above');
    assert.strictEqual(p.choices[p.correctIndex], 'Get sleep');
    assert.ok(p.correctIndex >= 0 && p.correctIndex <= 2, 'correct must be among shuffled non-anchors');
  }
});

test('prepareChoices: True/False never shuffles', () => {
  const q = { type: 'tf', choices: ['True', 'False'], answer: 1 };
  const p = E.prepareChoices(q, rng(3));
  assert.deepStrictEqual(p.choices, ['True', 'False']);
  assert.strictEqual(p.correctIndex, 1);
});

const bank = [
  { id: 1, topic: 'A', type: 'mc', choices: ['a', 'b', 'c', 'd'], answer: 0 },
  { id: 2, topic: 'A', type: 'tf', choices: ['True', 'False'], answer: 0 },
  { id: 3, topic: 'B', type: 'mc', choices: ['a', 'b', 'c', 'd'], answer: 1 },
  { id: 4, topic: 'B', type: 'mc', choices: ['a', 'b', 'c', 'd'], answer: 2 },
  { id: 5, topic: 'B', type: 'mc', choices: ['a', 'b', 'c', 'd'], answer: 3 }
];

test('buildQuiz: caps length to requested', () => {
  const quiz = E.buildQuiz(bank, { length: 3 }, rng(1));
  assert.strictEqual(quiz.length, 3);
});

test('buildQuiz: topic filter + caps to availability (no repeats)', () => {
  const quiz = E.buildQuiz(bank, { topic: 'B', length: 50 }, rng(1));
  assert.strictEqual(quiz.length, 3, 'topic B has only 3 questions');
  const ids = quiz.map(i => i.q.id);
  assert.strictEqual(new Set(ids).size, 3, 'no repeats');
  ids.forEach(id => assert.ok([3, 4, 5].includes(id)));
});

test('grade: counts correct, computes pass at 80%', () => {
  const quiz = [
    { q: bank[0], correctIndex: 1 },
    { q: bank[1], correctIndex: 0 },
    { q: bank[2], correctIndex: 2 },
    { q: bank[3], correctIndex: 3 },
    { q: bank[4], correctIndex: 0 }
  ];
  const all = E.grade(quiz, [1, 0, 2, 3, 0], 0.8);
  assert.strictEqual(all.correct, 5);
  assert.strictEqual(all.percent, 100);
  assert.ok(all.passed);

  const four = E.grade(quiz, [1, 0, 2, 3, 9], 0.8); // 4/5 = 80%
  assert.strictEqual(four.correct, 4);
  assert.strictEqual(four.percent, 80);
  assert.ok(four.passed, '80% should pass');
  assert.strictEqual(four.missed.length, 1);
  assert.strictEqual(four.missed[0].id, 5);

  const three = E.grade(quiz, [1, 0, 2, 9, 9], 0.8); // 3/5 = 60%
  assert.strictEqual(three.percent, 60);
  assert.ok(!three.passed, '60% should fail');
});

test('grade: unanswered (null) counts as missed', () => {
  const quiz = [{ q: bank[0], correctIndex: 1 }, { q: bank[2], correctIndex: 2 }];
  const r = E.grade(quiz, [null, 2], 0.8);
  assert.strictEqual(r.correct, 1);
  assert.strictEqual(r.missed.length, 1);
});

// Integration: build from the real bank and confirm every prepared item's key is sound.
test('real bank: every prepared question has a valid, correct key', () => {
  const data = JSON.parse(require('fs').readFileSync(__dirname + '/questions.json', 'utf8'));
  const quiz = E.buildQuiz(data.questions, { length: data.questions.length }, rng(42));
  assert.strictEqual(quiz.length, data.questions.length);
  quiz.forEach(item => {
    assert.ok(item.correctIndex >= 0 && item.correctIndex < item.choices.length,
      'Q#' + item.q.id + ' correctIndex out of range');
    assert.strictEqual(item.choices[item.correctIndex], item.q.choices[item.q.answer],
      'Q#' + item.q.id + ' key text mismatch after shuffle');
  });
});

console.log(`\n${passed} checks passed${process.exitCode ? ' (with failures)' : ''}.`);

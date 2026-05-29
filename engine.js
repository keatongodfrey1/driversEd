/* Pure quiz logic — no DOM. Shared by the browser app (app.js) and the
   Node test (engine.test.js). Works in both via the UMD-style wrapper below. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.QuizEngine = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Fisher-Yates shuffle on a copy. rng() should return [0,1); defaults to Math.random.
  function shuffle(arr, rng) {
    rng = rng || Math.random;
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Build the displayed choices for a question, tracking the correct answer by VALUE
  // (not index) so shuffling can never desync the key.
  // - True/False questions are never shuffled.
  // - Questions flagged anchorLast keep their final choice ("All/None/Any of the
  //   above") pinned last; only the other choices shuffle.
  function prepareChoices(q, rng) {
    const correctText = q.choices[q.answer];
    let display;
    if (q.type === 'tf') {
      display = q.choices.slice();
    } else if (q.anchorLast) {
      const anchor = q.choices[q.choices.length - 1];
      const pool = q.choices.slice(0, q.choices.length - 1);
      display = shuffle(pool, rng).concat([anchor]);
    } else {
      display = shuffle(q.choices, rng);
    }
    return { choices: display, correctIndex: display.indexOf(correctText) };
  }

  // Assemble a quiz: filter by topic (optional), shuffle question order, cap to the
  // requested length (capped to what's available), and prepare each question's choices.
  function buildQuiz(questions, opts, rng) {
    opts = opts || {};
    const pool = opts.topic ? questions.filter(q => q.topic === opts.topic) : questions.slice();
    const order = shuffle(pool, rng);
    const length = Math.min(opts.length || order.length, order.length);
    return order.slice(0, length).map(q => {
      const prepared = prepareChoices(q, rng);
      return { q: q, choices: prepared.choices, correctIndex: prepared.correctIndex };
    });
  }

  // Score a finished quiz. answers[i] is the chosen display-index (or null/undefined).
  function grade(quizItems, answers, threshold) {
    threshold = (typeof threshold === 'number') ? threshold : 0.8;
    let correct = 0;
    const missed = [];
    quizItems.forEach((item, i) => {
      if (answers[i] === item.correctIndex) correct++;
      else missed.push(item.q);
    });
    const total = quizItems.length;
    const ratio = total ? correct / total : 0;
    return {
      correct: correct,
      total: total,
      ratio: ratio,
      percent: Math.round(ratio * 100),
      passed: ratio >= threshold,
      missed: missed
    };
  }

  return { shuffle: shuffle, prepareChoices: prepareChoices, buildQuiz: buildQuiz, grade: grade };
});

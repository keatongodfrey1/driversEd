/* Browser controller for the Utah Drivers Ed practice app.
   Pure quiz logic lives in engine.js (window.QuizEngine). */
(function () {
  'use strict';
  var E = window.QuizEngine;

  var DATA = null;          // loaded questions.json
  var quiz = [];            // current quiz items: { q, choices, correctIndex }
  var answers = [];         // chosen display-index per item (null if unanswered)
  var idx = 0;              // current question index
  var correctCount = 0;
  var mode = 'full';        // 'full' | 'topic'
  var currentTopic = null;

  // --- tiny DOM helpers ---
  function $(id) { return document.getElementById(id); }
  function show(id) { $(id).classList.remove('hidden'); }
  function hide(id) { $(id).classList.add('hidden'); }
  function screen(name) {
    ['home', 'quiz', 'results'].forEach(function (s) {
      $(s).classList.toggle('hidden', s !== name);
    });
    window.scrollTo(0, 0);
  }

  // --- localStorage, fully guarded (private mode / disabled storage) ---
  var STORE_KEY = 'utah-drivers-ed-best';
  function loadBest() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveBest(obj) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); }
    catch (e) { /* ignore — app still works without persistence */ }
  }

  // --- load the question bank ---
  fetch('questions.json')
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (data) {
      DATA = data;
      initHome();
    })
    .catch(function (err) {
      $('home').querySelector('.card').innerHTML =
        '<h2>Could not load questions</h2><p class="muted">' +
        'Please open this page through a web server (or its hosted URL), not as a file. ' +
        'Details: ' + String(err.message) + '</p>';
    });

  function initHome() {
    // populate topic dropdown with counts
    var counts = {};
    DATA.questions.forEach(function (q) { counts[q.topic] = (counts[q.topic] || 0) + 1; });
    var sel = $('topic-select');
    sel.innerHTML = '';
    DATA.topics.forEach(function (t) {
      if (!counts[t]) return;
      var o = document.createElement('option');
      o.value = t;
      o.textContent = t + ' (' + counts[t] + ')';
      sel.appendChild(o);
    });

    $('bank-info').textContent =
      DATA.questions.length + ' questions in the bank · source: ' + (DATA.source || 'Utah Driver Handbook');

    // best-score banner
    var best = loadBest();
    if (best.full && best.full.percent != null) {
      $('best-banner').textContent =
        'Your best full-test score: ' + best.full.percent + '% (' +
        best.full.correct + '/' + best.full.total + ')';
      show('best-banner');
    }

    $('start-full').onclick = function () { startQuiz('full', null); };
    $('start-topic').onclick = function () { startQuiz('topic', sel.value); };
    screen('home');
  }

  function startQuiz(m, topic) {
    mode = m;
    currentTopic = topic;
    var length = (m === 'full') ? (DATA.fullTestLength || 50) : 25;
    quiz = E.buildQuiz(DATA.questions, { topic: topic, length: length });
    beginRun();
  }

  // Re-quiz only the missed questions (fresh shuffle of those items).
  function startRetry(missedQuestions) {
    mode = 'retry';
    currentTopic = null;
    quiz = E.buildQuiz(missedQuestions, { length: missedQuestions.length });
    beginRun();
  }

  function beginRun() {
    answers = quiz.map(function () { return null; });
    idx = 0;
    correctCount = 0;
    screen('quiz');
    renderQuestion();
  }

  function renderQuestion() {
    var item = quiz[idx];
    var q = item.q;

    $('progress').textContent = 'Question ' + (idx + 1) + ' of ' + quiz.length;
    $('progress-fill').style.width = Math.round((idx) / quiz.length * 100) + '%';
    $('score-so-far').textContent = correctCount + ' correct';
    $('topic-tag').textContent = q.topic;
    $('question-text').textContent = q.question;

    // sign image
    if (q.type === 'sign' && q.image) {
      $('sign-img').src = q.image;
      $('sign-img').alt = 'Traffic sign to identify';
      show('sign-wrap');
    } else {
      hide('sign-wrap');
    }

    // choices
    var box = $('choices');
    box.innerHTML = '';
    item.choices.forEach(function (text, i) {
      var b = document.createElement('button');
      b.className = 'choice';
      b.type = 'button';
      b.innerHTML = '<span class="mark" aria-hidden="true"></span><span class="label"></span>';
      b.querySelector('.label').textContent = text;
      b.onclick = function () { selectAnswer(i); };
      box.appendChild(b);
    });

    // reset feedback / next
    var fb = $('feedback');
    fb.className = 'feedback hidden';
    hide('next-btn');
    $('next-btn').textContent = (idx === quiz.length - 1) ? 'See results' : 'Next';
  }

  function selectAnswer(choiceIdx) {
    if (answers[idx] !== null) return; // already answered — no re-answering
    var item = quiz[idx];
    answers[idx] = choiceIdx;
    var isCorrect = (choiceIdx === item.correctIndex);
    if (isCorrect) correctCount++;

    var buttons = $('choices').querySelectorAll('.choice');
    buttons.forEach(function (b, i) {
      b.disabled = true;
      if (i === item.correctIndex) b.classList.add('correct');
      else if (i === choiceIdx) b.classList.add('wrong');
    });

    var fb = $('feedback');
    fb.className = 'feedback ' + (isCorrect ? 'is-correct' : 'is-wrong');
    $('feedback-line').textContent = isCorrect ? '✓ Correct' : '✗ Not quite';
    $('explanation').textContent = item.q.explanation;
    $('source-line').textContent = item.q.source ? ('Handbook reference: ' + item.q.source) : '';

    $('score-so-far').textContent = correctCount + ' correct';
    show('next-btn');
    $('next-btn').focus();
  }

  $('next-btn').onclick = function () {
    if (idx < quiz.length - 1) { idx++; renderQuestion(); }
    else finish();
  };

  $('quit-btn').onclick = function () {
    if (confirm('Quit this practice test? Your progress will be lost.')) initHome();
  };

  function finish() {
    var result = E.grade(quiz, answers, DATA.passThreshold || 0.8);
    $('progress-fill').style.width = '100%';

    var headline = $('result-headline');
    headline.textContent = result.passed ? 'You passed! 🎉' : 'Keep practicing';
    headline.className = result.passed ? 'pass' : 'fail';

    $('result-score').textContent = result.percent + '%';
    $('result-sub').textContent =
      result.correct + ' of ' + result.total + ' correct · ' +
      'passing is ' + Math.round((DATA.passThreshold || 0.8) * 100) + '%';

    // save best score for full tests
    if (mode === 'full') {
      var best = loadBest();
      if (!best.full || result.percent > best.full.percent) {
        best.full = { percent: result.percent, correct: result.correct, total: result.total };
        saveBest(best);
      }
    }

    // missed review + retry
    var missedWrap = $('missed-wrap');
    var list = $('missed-list');
    list.innerHTML = '';
    if (result.missed.length) {
      result.missed.forEach(function (q) {
        var li = document.createElement('li');
        var correctText = q.choices[q.answer];
        li.innerHTML = '<span class="q"></span><br>' +
          '<span class="a">Answer: </span><span class="acorrect"></span><br>' +
          '<span class="ex"></span>';
        li.querySelector('.q').textContent = q.question;
        li.querySelector('.acorrect').textContent = correctText;
        li.querySelector('.ex').textContent = q.explanation;
        list.appendChild(li);
      });
      show('missed-wrap');
      var retry = $('retry-missed');
      retry.classList.remove('hidden');
      retry.onclick = function () { startRetry(result.missed); };
    } else {
      hide('missed-wrap');
      hide('retry-missed');
    }

    $('again-btn').onclick = function () { startQuiz('full', null); };
    $('home-btn').onclick = function () { initHome(); };
    screen('results');
  }
})();

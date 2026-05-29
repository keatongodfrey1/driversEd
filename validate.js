#!/usr/bin/env node
/* Validates questions.json against the schema rules in the plan.
   Run: node validate.js   (exits non-zero on any error) */
const fs = require('fs');
const path = require('path');

const root = __dirname;
const raw = fs.readFileSync(path.join(root, 'questions.json'), 'utf8');

let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error('FAIL: questions.json is not valid JSON ->', e.message);
  process.exit(1);
}

const errors = [];
const warnings = [];
const topics = new Set(data.topics || []);
const ids = new Set();
const seenText = new Map();
const usedSigns = new Set();
let signImagesOk = 0;

if (!Array.isArray(data.questions) || data.questions.length === 0) {
  errors.push('questions array missing or empty');
}

(data.questions || []).forEach((q, i) => {
  const where = `Q#${q && q.id != null ? q.id : '(index ' + i + ')'}`;

  if (q.id == null || typeof q.id !== 'number') errors.push(`${where}: missing/!number id`);
  else if (ids.has(q.id)) errors.push(`${where}: duplicate id`);
  else ids.add(q.id);

  if (!['mc', 'tf', 'sign'].includes(q.type)) errors.push(`${where}: bad type "${q.type}"`);

  if (!q.topic || !topics.has(q.topic)) errors.push(`${where}: topic "${q.topic}" not in topics[]`);

  if (typeof q.question !== 'string' || q.question.trim().length < 5)
    errors.push(`${where}: question text too short/missing`);

  // duplicate detection (normalized). Sign questions are keyed on image+text,
  // since many legitimately share prompts like "What does this sign mean?".
  if (typeof q.question === 'string') {
    const norm = (q.type === 'sign' ? (q.image || '') + '|' : '') +
      q.question.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seenText.has(norm)) errors.push(`${where}: duplicate question (also ${seenText.get(norm)})`);
    else seenText.set(norm, where);
  }

  if (!Array.isArray(q.choices)) {
    errors.push(`${where}: choices missing`);
  } else {
    if (q.type === 'tf') {
      if (q.choices.length !== 2 || q.choices[0] !== 'True' || q.choices[1] !== 'False')
        errors.push(`${where}: tf must have choices ["True","False"]`);
    } else if (q.choices.length < 2 || q.choices.length > 4) {
      errors.push(`${where}: ${q.choices.length} choices (must be 2-4)`);
    }
    if (new Set(q.choices.map(c => String(c).toLowerCase().trim())).size !== q.choices.length)
      errors.push(`${where}: duplicate choice text`);
    if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= q.choices.length)
      errors.push(`${where}: answer index ${q.answer} out of range`);
  }

  if (typeof q.explanation !== 'string' || q.explanation.trim().length < 5)
    errors.push(`${where}: explanation too short/missing`);

  if (typeof q.source !== 'string' || !q.source.trim())
    errors.push(`${where}: source tag missing`);

  if (q.type === 'sign') {
    if (!q.image) {
      errors.push(`${where}: sign question missing image`);
    } else {
      usedSigns.add(q.image);
      const p = path.join(root, q.image);
      if (!fs.existsSync(p)) errors.push(`${where}: image file not found -> ${q.image}`);
      else signImagesOk++;
    }
  }

  // anchorLast sanity: if flagged, the anchored choice should be the last one
  if (q.anchorLast && Array.isArray(q.choices)) {
    const last = String(q.choices[q.choices.length - 1]).toLowerCase();
    if (!/(all|none|any) of the above/.test(last))
      warnings.push(`${where}: anchorLast set but last choice isn't an "of the above" option`);
  }
});

// topic coverage report
const byTopic = {};
(data.questions || []).forEach(q => { byTopic[q.topic] = (byTopic[q.topic] || 0) + 1; });

console.log(`questions: ${(data.questions || []).length}`);
console.log(`unique ids: ${ids.size}`);
console.log(`sign images resolved: ${signImagesOk}/${usedSigns.size}`);
console.log('per-topic counts:');
Object.keys(byTopic).sort().forEach(t => console.log(`  ${byTopic[t].toString().padStart(3)}  ${t}`));
const empty = [...topics].filter(t => !byTopic[t]);
if (empty.length) warnings.push('topics with zero questions: ' + empty.join(', '));
if ((data.questions || []).length < data.fullTestLength)
  errors.push(`bank (${data.questions.length}) smaller than fullTestLength (${data.fullTestLength})`);

if (warnings.length) {
  console.log('\nWARNINGS:');
  warnings.forEach(w => console.log('  - ' + w));
}
if (errors.length) {
  console.log('\nERRORS:');
  errors.forEach(e => console.log('  - ' + e));
  console.log(`\nFAIL: ${errors.length} error(s).`);
  process.exit(1);
}
console.log('\nPASS: questions.json is valid.');

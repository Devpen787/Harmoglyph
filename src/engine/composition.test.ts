import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COMPOSITION_PRESETS,
  cloneComposition,
  deriveGeometry,
  midiToHz,
  noteAsSynthStep,
  projectToSpreadsheet,
  canProjectToSpreadsheet,
  totalBeats,
  validateComposition,
} from './composition.ts';
import { evaluateSheet } from './spreadsheetVm.ts';

test('all five contrasting scores are structurally valid', () => {
  for (const score of COMPOSITION_PRESETS) {
    assert.deepEqual(validateComposition(score), [], score.title);
    assert.ok(deriveGeometry(score).length === score.notes.length);
  }
});

test('12-TET pitch-to-frequency mapping is exact to floating precision', () => {
  assert.ok(Math.abs(midiToHz(69) - 440) < 1e-9);
  assert.ok(Math.abs(midiToHz(60) - 261.6255653005986) < 1e-8);
  assert.ok(Math.abs(midiToHz(72) / midiToHz(60) - 2) < 1e-12);
});

test('the geometry has deterministic pitch, onset, length, energy and harmonics', () => {
  const score = cloneComposition(COMPOSITION_PRESETS.find((p) => p.id === 'glass-garden')!);
  const first = deriveGeometry(score)[0];
  assert.equal(first.startAngle, -Math.PI / 2);
  assert.ok(Math.abs(first.sweepAngle - Math.PI / 8) < 1e-12);
  assert.equal(first.harmonicHz.length, 5);
  assert.ok(Math.abs(first.harmonicHz[4] - first.hz * 5) < 1e-10);
  assert.deepEqual(deriveGeometry(score), deriveGeometry(score));

  score.notes[0].midi += 12;
  const higher = deriveGeometry(score)[0];
  assert.ok(Math.abs(higher.hz / first.hz - 2) < 1e-12);
  assert.ok(higher.radius > first.radius);
  assert.equal(higher.startAngle, first.startAngle);

  score.notes[0].durationBeats += 0.5;
  assert.ok(deriveGeometry(score)[0].sweepAngle > first.sweepAngle);
  score.notes[0].velocity = 0.1;
  assert.ok(deriveGeometry(score)[0].strokeWidth < first.strokeWidth);
});

test('monophonic score projects into the real spreadsheet evaluation engine', () => {
  const score = COMPOSITION_PRESETS.find((p) => p.id === 'glass-garden')!;
  assert.equal(totalBeats(score), 16);
  assert.equal(canProjectToSpreadsheet(score), true);
  const { grid, rowCount } = projectToSpreadsheet(score);
  assert.equal(rowCount, 32);
  const evaluated = evaluateSheet(grid, rowCount);
  assert.equal(evaluated.errorCount, 0);
  assert.equal(evaluated.steps.filter((step) => step.gate > 0).length, score.notes.length);
  assert.ok(Math.abs(evaluated.steps[0].freqHz - midiToHz(60)) < 0.001);
  assert.ok(Math.abs(evaluated.steps[2].freqHz - midiToHz(64)) < 0.001);
});

test('polyphony is retained in the art and sound but rejected for lossy grid projection', () => {
  const poly = COMPOSITION_PRESETS.find((p) => p.id === 'leap-dialogue')!;
  assert.equal(poly.tracks.length, 2);
  assert.equal(deriveGeometry(poly).length, 12);
  assert.equal(canProjectToSpreadsheet(poly), false);
  assert.throws(() => projectToSpreadsheet(poly), /Overlapping voices/);
  const simultaneous = poly.notes.filter((note) => note.startBeat === 0);
  assert.equal(simultaneous.length, 2);
  assert.notEqual(noteAsSynthStep(simultaneous[0], poly.bpm).freqHz, noteAsSynthStep(simultaneous[1], poly.bpm).freqHz);
});

test('distinct track timbres cannot be silently collapsed even when they do not overlap', () => {
  const poly = cloneComposition(COMPOSITION_PRESETS.find((p) => p.id === 'leap-dialogue')!);
  poly.notes = poly.notes.filter((note) => note.trackId === 'lead' || note.startBeat === 0);
  const counter = poly.notes.find((note) => note.trackId === 'counter')!;
  counter.startBeat = 8;
  assert.equal(canProjectToSpreadsheet(poly), false);
});

test('invalid MIDI, duration, overlap, velocity and timing are not silently accepted', () => {
  const score = cloneComposition(COMPOSITION_PRESETS.find((p) => p.id === 'glass-garden')!);
  score.notes[0].midi = 200;
  score.notes[1].durationBeats = -1;
  score.notes[2].velocity = 1.7;
  score.notes[3].startBeat = 0.3;
  assert.ok(validateComposition(score).length >= 4);
  assert.equal(canProjectToSpreadsheet(score), false);
});

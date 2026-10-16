import { CHOICES, ReviewState } from './review-state.js';

const $ = id => document.getElementById(id);
const LABELS = { before: 'Before selected', after: 'After selected', neither: 'Both need work', tie: 'Both look good' };
let state, storageKey, fullView = false, imageReady = false, renderToken = 0, gesture = null, ignoreClickUntil = 0;
let images = new Map(), storageAvailable = true;

function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify(state.serialize())); storageAvailable = true; }
  catch { storageAvailable = false; }
  $('save-status').textContent = storageAvailable ? 'Saved on this device' : 'Autosave unavailable · use Export JSON';
}

function updateChoice() {
  const draft = state.draft;
  for (const [id, value] of [['before-card', 'before'], ['after-card', 'after'], ['neither', 'neither'], ['tie', 'tie']]) {
    $(id).setAttribute('aria-pressed', String(draft.choice === value));
  }
  $('next').disabled = !draft.choice || !imageReady;
  $('next-label').textContent = draft.choice ? (state.count === state.cases.length - 1 && !state.answers[state.current.id] ? 'Finish review' : 'Next comparison') : 'Choose a version to continue';
  $('decision-status').textContent = draft.choice ? `${LABELS[draft.choice]}. Add a comment or continue.` : 'Tap an image or swipe to make your choice.';
  $('comment-count').textContent = `${draft.comment.length} / 2000`;
}

function choose(choice) {
  if (!imageReady) return;
  state.updateDraft({ choice });
  persist();
  updateChoice();
}

function sheet(url) {
  if (images.has(url)) return images.get(url);
  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => { images.delete(url); reject(new Error('Comparison image could not load.')); };
    image.src = url;
  });
  images.set(url, promise);
  // Keep the current fighter and the next fighter without retaining all decoded sheets.
  while (images.size > 2) images.delete(images.keys().next().value);
  return promise;
}

async function drawComparison() {
  const token = ++renderToken;
  const item = state.current;
  imageReady = false;
  $('image-error').hidden = true;
  $('comparison-stage').classList.add('busy');
  for (const id of ['before-card', 'after-card', 'neither', 'tie']) $(id).disabled = true;
  updateChoice();
  try {
    const image = await sheet(item.sheet);
    if (token !== renderToken) return;
    const d = state.dataset;
    for (const [canvasId, cell] of [['before-image', item.pairIndex * 2], ['after-image', item.pairIndex * 2 + 1]]) {
      const canvas = $(canvasId);
      const view = fullView ? { x: 0, y: 30, width: 360, height: 390 } : { x: 60, y: 45, width: 240, height: 255 };
      canvas.width = view.width; canvas.height = view.height;
      const context = canvas.getContext('2d');
      context.imageSmoothingEnabled = false;
      context.drawImage(image, cell % d.columns * d.cellWidth + view.x,
        Math.floor(cell / d.columns) * d.cellHeight + view.y, view.width, view.height, 0, 0, canvas.width, canvas.height);
    }
    imageReady = true;
    for (const id of ['before-card', 'after-card', 'neither', 'tie']) $(id).disabled = false;
    $('comparison-stage').classList.remove('busy');
    updateChoice();
    const next = state.cases.find((candidate, index) => index > state.index && candidate.fighter !== item.fighter);
    if (next) sheet(next.sheet).catch(() => {});
  } catch {
    if (token !== renderToken) return;
    $('image-error').hidden = false;
    $('decision-status').textContent = 'Load the comparison before making a choice.';
  }
}

function render() {
  persist();
  $('loading').hidden = true;
  $('review').hidden = state.screen !== 'review';
  $('complete').hidden = state.screen !== 'complete';
  $('export-top').disabled = false;
  if (state.screen === 'complete') return renderComplete();
  const item = state.current;
  $('progress').max = state.cases.length;
  $('progress').value = state.count;
  $('progress-label').replaceChildren();
  const strong = document.createElement('strong'); strong.textContent = state.count;
  $('progress-label').append(strong, ` / ${state.cases.length}`);
  $('comparison-index').textContent = `COMPARISON ${String(state.index + 1).padStart(3, '0')}`;
  $('comparison-title').textContent = `Fighter ${item.fighter} · Hat ${item.hat}`;
  $('fighter-select').value = item.fighter;
  $('comment').value = state.draft.comment;
  $('previous').disabled = state.index === 0;
  $('shift-label').textContent = `+${state.dataset.shiftX} px right`;
  drawComparison();
}

function renderComplete() {
  $('json-preview').value = JSON.stringify(state.export(), null, 2);
  $('summary').replaceChildren();
  for (const [choice, name] of [['before', 'Before'], ['after', 'After'], ['neither', 'Both need work'], ['tie', 'Both good']]) {
    const div = document.createElement('div'); div.className = 'summary-item';
    const count = document.createElement('strong'); count.textContent = Object.values(state.answers).filter(answer => answer.choice === choice).length;
    const label = document.createElement('span'); label.textContent = name;
    div.append(count, label); $('summary').append(div);
  }
  $('complete-status').textContent = `${state.count} comparisons reviewed. Every choice includes its fighter, hat, and comment.`;
}

function download() {
  const json = JSON.stringify(state.export(), null, 2);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url;
  link.download = `anm-hat-review${state.count < state.cases.length ? '-partial' : ''}.json`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function next() {
  if (!imageReady || !CHOICES.includes(state.draft.choice)) return;
  state.commit();
  render();
  $('comment').blur();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function clearGesture() {
  gesture = null;
  $('comparison-stage').style.removeProperty('--drag');
  $('comparison-stage').style.removeProperty('--rotation');
  $('comparison-stage').classList.remove('dragging');
  $('swipe-indicator').classList.remove('visible');
}

for (const [id, choice] of [['before-card', 'before'], ['after-card', 'after'], ['neither', 'neither'], ['tie', 'tie']]) {
  $(id).addEventListener('click', event => { if (event.detail === 0 || performance.now() >= ignoreClickUntil) choose(choice); });
}
$('comment').addEventListener('input', event => { state.updateDraft({ comment: event.target.value }); persist(); updateChoice(); });
$('next').addEventListener('click', next);
$('previous').addEventListener('click', () => { state.previous(); render(); });
$('view-toggle').addEventListener('click', () => {
  fullView = !fullView; $('view-toggle').setAttribute('aria-pressed', String(fullView));
  $('view-toggle').textContent = fullView ? 'Head detail ⤢' : 'Full fighter ⤢'; drawComparison();
});
$('retry-image').addEventListener('click', drawComparison);
$('jump-toggle').addEventListener('click', () => {
  $('jump-panel').hidden = !$('jump-panel').hidden;
  $('jump-toggle').setAttribute('aria-expanded', String(!$('jump-panel').hidden));
});
$('jump').addEventListener('click', () => {
  state.jump($('fighter-select').value); $('jump-panel').hidden = true;
  $('jump-toggle').setAttribute('aria-expanded', 'false'); render();
});
$('export-top').addEventListener('click', download);
$('download-complete').addEventListener('click', download);
$('copy-json').addEventListener('click', async () => {
  const text = JSON.stringify(state.export(), null, 2);
  try { await navigator.clipboard.writeText(text); $('complete-status').textContent = 'JSON copied to clipboard.'; }
  catch { $('json-preview').focus(); $('json-preview').select(); $('complete-status').textContent = 'Select and copy the JSON below, or download the file.'; }
});
$('edit-review').addEventListener('click', () => { state.screen = 'review'; state.editMode = true; state.index = 0; render(); });
$('reset').addEventListener('click', () => {
  if (!window.confirm('Start over? Download your current review first if you want to keep it.')) return;
  state = new ReviewState(state.dataset); render();
});
$('reload').addEventListener('click', () => window.location.reload());

const stage = $('comparison-stage');
stage.addEventListener('pointerdown', event => {
  if (!imageReady || !event.isPrimary || event.button > 0) return;
  gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dy: 0, horizontal: false };
});
stage.addEventListener('pointermove', event => {
  if (!gesture || event.pointerId !== gesture.id) return;
  gesture.dx = event.clientX - gesture.x; gesture.dy = event.clientY - gesture.y;
  if (!gesture.horizontal && Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4) {
    gesture.horizontal = true; stage.setPointerCapture(event.pointerId); stage.classList.add('dragging');
  }
  if (!gesture.horizontal) return;
  event.preventDefault();
  const drag = Math.max(-45, Math.min(45, gesture.dx * .3));
  stage.style.setProperty('--drag', `${drag}px`); stage.style.setProperty('--rotation', `${drag / 35}deg`);
  $('swipe-indicator').textContent = gesture.dx < 0 ? '← Before' : 'After →';
  $('swipe-indicator').classList.toggle('visible', Math.abs(gesture.dx) > 30);
}, { passive: false });
stage.addEventListener('pointerup', event => {
  if (!gesture || gesture.id !== event.pointerId) return;
  const { dx, dy, horizontal } = gesture;
  if (horizontal) ignoreClickUntil = performance.now() + 350;
  if (horizontal && Math.abs(dx) >= 55 && Math.abs(dx) > Math.abs(dy) * 1.4) choose(dx < 0 ? 'before' : 'after');
  clearGesture();
});
stage.addEventListener('pointercancel', clearGesture);
document.addEventListener('keydown', event => {
  if (!state || state.screen !== 'review' || event.ctrlKey || event.altKey || event.metaKey
    || ['TEXTAREA', 'INPUT', 'SELECT', 'BUTTON', 'A'].includes(document.activeElement?.tagName)) return;
  if (event.key === 'ArrowLeft') { event.preventDefault(); choose('before'); }
  if (event.key === 'ArrowRight') { event.preventDefault(); choose('after'); }
  if (event.key === 'Enter') { event.preventDefault(); next(); }
});

try {
  const response = await fetch('./dataset.json');
  if (!response.ok) throw new Error(`Dataset request returned ${response.status}.`);
  const dataset = await response.json();
  storageKey = `anm-hat-review:${dataset.id}`;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(storageKey)); } catch { /* Start fresh if a stored session is unreadable. */ }
  state = new ReviewState(dataset, saved);
  for (const fighter of dataset.fighters) {
    const option = document.createElement('option'); option.value = fighter; option.textContent = `Fighter ${fighter}`;
    $('fighter-select').append(option);
  }
  render();
} catch (error) {
  $('loading').hidden = true; $('fatal').hidden = false;
  $('fatal-message').textContent = error.message;
}

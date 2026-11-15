// Modals, Guided Tour overlay, and Toast notifications.
import { GLOSSARY } from '../core/constants.js';

export function showToast(msg) {
  const el = document.getElementById('statusToast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(showToast.t);
  showToast.t = setTimeout(() => el.classList.add('hidden'), 4500);
}

export function openGlossary(key) {
  const g = GLOSSARY[key];
  if (!g) return;
  const titleEl = document.getElementById('glossaryTitle');
  const bodyEl = document.getElementById('glossaryBody');
  const modalEl = document.getElementById('glossaryModal');
  if (titleEl) titleEl.textContent = g.title;
  if (bodyEl) bodyEl.textContent = g.text;
  if (modalEl) modalEl.classList.remove('hidden');
}

export function createTour(steps, onFinish) {
  let tourIdx = 0;
  const overlay = document.getElementById('tourOverlay');
  const stepLabel = document.getElementById('tourStepLabel');
  const titleEl = document.getElementById('tourTitle');
  const bodyEl = document.getElementById('tourBody');
  const prevBtn = document.getElementById('tourPrevBtn');
  const nextBtn = document.getElementById('tourNextBtn');
  const actionBtn = document.getElementById('tourActionBtn');
  const closeBtn = document.getElementById('tourCloseBtn');

  function render() {
    const step = steps[tourIdx];
    if (stepLabel) stepLabel.textContent = `Step ${tourIdx + 1} of ${steps.length}`;
    if (titleEl) titleEl.textContent = step.title;
    if (bodyEl) bodyEl.textContent = step.body;
    if (prevBtn) prevBtn.disabled = tourIdx === 0;
    if (nextBtn) nextBtn.textContent = tourIdx === steps.length - 1 ? 'Finish' : 'Next →';
  }

  function start() {
    tourIdx = 0;
    if (overlay) overlay.classList.remove('hidden');
    render();
  }

  prevBtn?.addEventListener('click', () => {
    if (tourIdx > 0) {
      tourIdx--;
      render();
    }
  });

  nextBtn?.addEventListener('click', () => {
    if (tourIdx < steps.length - 1) {
      tourIdx++;
      render();
    } else {
      overlay?.classList.add('hidden');
      onFinish?.();
    }
  });

  actionBtn?.addEventListener('click', () => {
    steps[tourIdx]?.action?.();
  });

  closeBtn?.addEventListener('click', () => {
    overlay?.classList.add('hidden');
  });

  return { start, render };
}

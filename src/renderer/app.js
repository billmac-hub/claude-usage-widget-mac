// src/renderer/app.js
import { formatCountdown, formatResetClock } from '../shared/countdown.js';

const PIN_ICON =
  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.5 2.5 21 9l-3.2.8-3 3 .4 4.7-2.4 1L9 14.7l-5.5 5.5-1.2-1.2L7.8 13.5 4 9.7l1-2.4 4.7.4 3-3L13.5 2.5h1Z"/></svg>';
const CHEVRON_DOWN =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
const CHEVRON_UP =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>';

const cardsEl = document.getElementById('cards');
const widgetEl = document.getElementById('widget');
const pinBtn = document.getElementById('pin-btn');
const refreshBtn = document.getElementById('refresh-btn');

const state = { metrics: [], fetchedAt: null, error: null, expanded: false, pinned: true };
let lastSentHeight = 0;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function gaugeClass(percent) {
  if (percent >= 85) return 'fill-critical';
  if (percent >= 60) return 'fill-caution';
  return 'fill-calm';
}

function pctStyle(percent) {
  return percent >= 85 ? ' style="color:var(--w-critical)"' : '';
}

function miniLabel(m) {
  if (m.id === 'weekly') return '주간';
  if (m.id === 'model') return escapeHtml(m.label.split(' · ')[1] ?? '모델');
  return '크레딧';
}

function resetLine(m) {
  if (m.kind === 'credit') {
    return `$${m.used.toFixed(2)} <b>/</b> $${m.limit.toFixed(0)} · 월 한도`;
  }
  const countdown = formatCountdown(m.resetsAt);
  const clock = formatResetClock(m.resetsAt);
  if (!countdown) return '';
  return `리셋까지 <b>${countdown}</b>${clock ? ` · ${clock}` : ''}`;
}

function fullCard(m) {
  const fill = m.kind === 'credit' ? 'fill-clay' : gaugeClass(m.percent);
  const style = m.kind === 'credit' ? '' : pctStyle(m.percent);
  return `
    <div class="row">
      <div class="row-top">
        <div class="pct"${style}>${m.percent}<small>%</small></div>
        <div class="tag">${escapeHtml(m.label)}</div>
      </div>
      <div class="bar"><span class="${fill}" style="width:${Math.min(100, m.percent)}%"></span></div>
      <div class="reset">${resetLine(m)}</div>
    </div>`;
}

function miniCard(m) {
  const fill = m.kind === 'credit' ? 'fill-clay' : gaugeClass(m.percent);
  const style = m.kind === 'credit' ? '' : pctStyle(m.percent);
  return `
    <div class="mini">
      <span class="m-label">${miniLabel(m)}</span>
      <span class="m-val"${style}>${m.percent}%</span>
      <div class="bar"><span class="${fill}" style="width:${Math.min(100, m.percent)}%"></span></div>
    </div>`;
}

function statusText(error, fetchedAt) {
  switch (error) {
    case 'no_token':
    case 'auth':
      return 'Claude Code에 로그인해 주세요';
    case 'network':
      return fetchedAt ? `${formatResetClock(fetchedAt)} 기준` : '연결할 수 없음';
    case 'format':
      return '일시적으로 불러올 수 없음';
    default:
      return fetchedAt ? `${formatResetClock(fetchedAt)} 갱신 · 2분마다` : '';
  }
}

function footerHtml(error, fetchedAt) {
  return `<div class="w-foot"><i class="dot${error ? ' warn' : ''}"></i> ${statusText(error, fetchedAt)}</div>`;
}

function renderCollapsed(metrics, error, fetchedAt) {
  const primary = metrics.find((m) => m.id === 'session') ?? metrics[0];
  const rest = metrics.filter((m) => m !== primary);
  return `
    ${fullCard(primary)}
    <div class="minis">${rest.map(miniCard).join('')}</div>
    ${error ? footerHtml(error, fetchedAt) : ''}
    <div class="w-expander" data-action="toggle-expand" role="button" tabindex="0" aria-label="자세히 펼치기">${CHEVRON_DOWN}</div>`;
}

function renderExpanded(metrics, error, fetchedAt) {
  return `
    ${metrics.map(fullCard).join('')}
    ${footerHtml(error, fetchedAt)}
    <div class="w-expander" data-action="toggle-expand" role="button" tabindex="0" aria-label="접기">${CHEVRON_UP}</div>`;
}

function renderMessage(text) {
  return `<div class="row"><div class="reset" style="font-size:12.5px">${escapeHtml(text)}</div></div>`;
}

function render() {
  const { metrics, error, expanded, fetchedAt } = state;

  if (metrics.length === 0) {
    cardsEl.innerHTML = renderMessage(error ? statusText(error, fetchedAt) : '불러오는 중…');
  } else {
    cardsEl.innerHTML = expanded ? renderExpanded(metrics, error, fetchedAt) : renderCollapsed(metrics, error, fetchedAt);
  }
  cardsEl.classList.toggle('stale', Boolean(error) && metrics.length > 0);

  syncHeight();
}

function syncHeight() {
  const height = Math.ceil(widgetEl.getBoundingClientRect().height);
  if (height > 0 && height !== lastSentHeight) {
    lastSentHeight = height;
    window.api.win.setHeight(height);
  }
}

cardsEl.addEventListener('click', (e) => {
  if (e.target.closest('[data-action="toggle-expand"]')) {
    state.expanded = !state.expanded;
    window.api.win.setExpanded(state.expanded);
    render();
  }
});

pinBtn.innerHTML = PIN_ICON;
pinBtn.addEventListener('click', async () => {
  state.pinned = await window.api.win.togglePin();
  pinBtn.classList.toggle('pinned', state.pinned);
});

refreshBtn.addEventListener('click', () => window.api.usage.refresh());

window.api.usage.onData((payload) => {
  state.metrics = payload.metrics ?? [];
  state.fetchedAt = payload.fetchedAt ?? null;
  state.error = payload.error ?? null;
  render();
});

setInterval(() => {
  if (state.metrics.length > 0) render(); // 카운트다운만 다시 계산해 매초 갱신
}, 1000);

(async () => {
  const settings = await window.api.settings.load();
  state.expanded = settings.expanded;
  state.pinned = settings.pinned;
  pinBtn.classList.toggle('pinned', state.pinned);
  render();
})();

// src/main/notifier.js
// 85%/95% 경계를 아래→위로 "새로" 넘는 순간만 알림 대상으로 반환하는 순수 트래커.
// 실제 Notification 발송(IO)은 main.js가 담당 — 여기는 상태 판단만 한다.
const THRESHOLDS = [95, 85]; // 높은 경계부터: 한 틱에 지표 하나당 알림 1개만 내보내기 위해

export function createAlertTracker() {
  let state = {}; // metricId -> { resetsAt, crossed: Set<number> }

  function check(metrics) {
    const toNotify = [];
    const next = {};

    for (const m of metrics) {
      if (m.kind !== 'limit') continue; // 크레딧 잔액은 한도 임박 알림 대상이 아님

      const prev = state[m.id];
      const resetsAt = m.resetsAt ?? null;
      // 리셋 창이 바뀌면(주간/세션 갱신) 새 창으로 취급 — 이전 경계 기록 무효화
      const prevCrossed = prev && prev.resetsAt === resetsAt ? prev.crossed : new Set();

      const newCrossed = new Set(THRESHOLDS.filter((t) => m.percent >= t));
      const justCrossed = THRESHOLDS.filter((t) => newCrossed.has(t) && !prevCrossed.has(t));

      if (justCrossed.length > 0) {
        // THRESHOLDS가 내림차순이므로 justCrossed[0]이 이번 틱에 새로 넘은 것 중 가장 높은 경계
        toNotify.push({ id: m.id, label: m.label, percent: m.percent, threshold: justCrossed[0], resetsAt });
      }

      next[m.id] = { resetsAt, crossed: newCrossed };
    }

    state = next;
    return toNotify;
  }

  return { check };
}

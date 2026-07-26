// src/shared/countdown.js
const MS_PER_DAY = 86_400_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_MINUTE = 60_000;

export function formatCountdown(resetsAt, now = Date.now()) {
  if (!resetsAt) return '';
  const target = new Date(resetsAt).getTime();
  if (Number.isNaN(target)) return '';

  const diff = target - now;
  if (diff <= 0) return '곧 리셋';

  const days = Math.floor(diff / MS_PER_DAY);
  const hours = Math.floor((diff % MS_PER_DAY) / MS_PER_HOUR);
  const minutes = Math.floor((diff % MS_PER_HOUR) / MS_PER_MINUTE);

  if (days >= 1) return `${days}일 ${hours}시간`;
  if (hours >= 1) return `${hours}시간 ${minutes}분`;
  return `${Math.max(1, minutes)}분`;
}

export function formatResetClock(resetsAt, now = Date.now()) {
  if (!resetsAt) return '';
  const target = new Date(resetsAt);
  if (Number.isNaN(target.getTime())) return '';

  const nowDate = new Date(now);
  const sameDay =
    target.getFullYear() === nowDate.getFullYear() &&
    target.getMonth() === nowDate.getMonth() &&
    target.getDate() === nowDate.getDate();

  const hh = String(target.getHours()).padStart(2, '0');
  const mm = String(target.getMinutes()).padStart(2, '0');
  if (sameDay) return `${hh}:${mm}`;
  return `${target.getMonth() + 1}/${target.getDate()} ${hh}:${mm}`;
}

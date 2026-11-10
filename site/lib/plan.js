const WEEKEND_MIN = 12 * 60; // a "marathon weekend": two days of six hours

/** Binge plan for series `s` ({ e: episodes, m: minutes per episode }) at `perNight` episodes per evening. */
export function bingePlan(s, perNight, start = new Date()) {
  if (!(s.e > 0) || !(s.m > 0) || !(perNight > 0)) return { totalMin: null, hours: null, evenings: null, finish: null, weekends: null };
  const totalMin = s.e * s.m;
  const evenings = Math.ceil(s.e / perNight);
  const finish = new Date(start.getFullYear(), start.getMonth(), start.getDate() + evenings - 1);
  return { totalMin, hours: Math.round(totalMin / 60), evenings, finish, weekends: Math.ceil(totalMin / WEEKEND_MIN) };
}

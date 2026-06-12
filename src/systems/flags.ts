/** 스토리 플래그 (입국 심사 완료 등) — localStorage 저장 */
const KEY = 'linguatrip-flags-v1';

function load(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    // 손상 시 빈 상태로
  }
  return {};
}

export const flags = {
  get(name: string): boolean {
    return !!load()[name];
  },
  set(name: string): void {
    const f = load();
    f[name] = true;
    try {
      localStorage.setItem(KEY, JSON.stringify(f));
    } catch {
      // 저장 불가 환경 무시
    }
  },
};

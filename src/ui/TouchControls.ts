/** 모바일용 가상 패드 상태. WorldScene이 매 프레임 읽는다. */
export const virtualPad = {
  up: false,
  down: false,
  left: false,
  right: false,
  /** 조사 버튼이 눌렸음 (씬에서 소비 후 false로) */
  actionQueued: false,
};

export function setupTouchControls(): void {
  const bind = (id: string, key: 'up' | 'down' | 'left' | 'right') => {
    const el = document.getElementById(id);
    if (!el) return;
    const press = (e: Event) => {
      e.preventDefault();
      virtualPad[key] = true;
    };
    const release = (e: Event) => {
      e.preventDefault();
      virtualPad[key] = false;
    };
    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointerleave', release);
    el.addEventListener('pointercancel', release);
  };
  bind('dpad-up', 'up');
  bind('dpad-down', 'down');
  bind('dpad-left', 'left');
  bind('dpad-right', 'right');

  const actionBtn = document.getElementById('action-btn');
  actionBtn?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    virtualPad.actionQueued = true;
  });
}

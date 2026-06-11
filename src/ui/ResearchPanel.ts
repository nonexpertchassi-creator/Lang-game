import type { ResearchSystem } from '../systems/ResearchSystem';

/** 연구 트리 패널: 연구 목록을 보여주고 다음 연구를 선택한다 */
export class ResearchPanel {
  private root: HTMLElement;

  constructor(private rs: ResearchSystem) {
    this.root = document.getElementById('panel-root')!;
  }

  open(): void {
    const overlay = document.createElement('div');
    overlay.className = 'panel-overlay';
    overlay.innerHTML = `
      <div class="panel">
        <div class="panel-head">
          <h2>🔬 연구 — 일본어</h2>
          <button class="panel-close">✕</button>
        </div>
        <div class="panel-body"></div>
      </div>
    `;
    const body = overlay.querySelector('.panel-body')!;

    for (const def of this.rs.defs) {
      const done = this.rs.isCompleted(def.id);
      const available = this.rs.isAvailable(def.id);
      const isActive = this.rs.activeId === def.id;
      const { current, cost } = this.rs.progress(def.id);

      const card = document.createElement('div');
      card.className = 'research-card';
      if (done) card.classList.add('done');
      else if (isActive) card.classList.add('active-card');
      else if (!available) card.classList.add('locked');

      const reqNames = def.requires
        .filter((r) => !this.rs.isCompleted(r))
        .map((r) => this.rs.get(r)?.name ?? r);

      card.innerHTML = `
        <div class="row">
          <span class="name">${def.name}</span>
          <span class="cost">${done ? '완료' : `${current}/${cost} RP`}</span>
        </div>
        <div class="desc">${def.desc}</div>
        ${reqNames.length ? `<div class="req">🔒 선행 연구: ${reqNames.join(', ')}</div>` : ''}
        ${!done && current > 0 ? `<div class="mini-bar"><div style="width:${(current / cost) * 100}%"></div></div>` : ''}
      `;

      if (available && !isActive) {
        const btn = document.createElement('button');
        btn.className = 'select-btn';
        btn.textContent = '이 연구 시작';
        btn.addEventListener('click', () => {
          this.rs.setActive(def.id);
          overlay.remove();
        });
        card.appendChild(btn);
      }
      if (isActive) {
        const tagEl = document.createElement('div');
        tagEl.className = 'req';
        tagEl.textContent = '▶ 진행 중 — 문제를 풀어 RP를 모으세요';
        card.appendChild(tagEl);
      }
      body.appendChild(card);
    }

    overlay.querySelector('.panel-close')!.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    this.root.appendChild(overlay);
  }
}

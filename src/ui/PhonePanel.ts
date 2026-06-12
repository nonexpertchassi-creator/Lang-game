import type { ResearchSystem } from '../systems/ResearchSystem';

interface CityDef {
  icon: string;
  name: string;
  lv: number;
  desc: string;
  /** 해금에 필요한 완료 연구 수 */
  reqResearch: number;
  /** 실제 플레이 가능 여부 (맵이 만들어졌는가) */
  playable: boolean;
}

// 도시 = 난이도. 관광지일수록 외국어가 통해서 쉽고, 시골일수록 일본어가 필수다.
const JAPAN_CITIES: CityDef[] = [
  { icon: '🗼', name: '도쿄', lv: 0, desc: '외국인 친화 · 영어/한국어 안내 많음', reqResearch: 0, playable: true },
  { icon: '🏯', name: '오사카', lv: 1, desc: '현지인의 거리 · 일본어가 필요하다', reqResearch: 4, playable: false },
  { icon: '🌾', name: '요나고', lv: 2, desc: '한적한 시골 · 일본어 없이는 생존 불가', reqResearch: 7, playable: false },
];

/** 📱 스마트폰: 여행 앱으로 도시(난이도)를 선택한다 */
export class PhonePanel {
  private root: HTMLElement;

  constructor(
    private rs: ResearchSystem,
    private onReplayImmigration: () => void,
  ) {
    this.root = document.getElementById('panel-root')!;
  }

  open(): void {
    const overlay = document.createElement('div');
    overlay.className = 'panel-overlay';
    overlay.innerHTML = `
      <div class="panel phone">
        <div class="panel-head">
          <h2>✈️ 여행 — 일본</h2>
          <button class="panel-close">✕</button>
        </div>
        <div class="panel-body"></div>
      </div>
    `;
    const body = overlay.querySelector('.panel-body') as HTMLElement;
    const done = this.rs.completedCount;

    for (const city of JAPAN_CITIES) {
      const unlocked = done >= city.reqResearch;
      const card = document.createElement('div');
      card.className = `research-card city-card${unlocked ? '' : ' locked'}`;
      card.innerHTML = `
        <div class="row">
          <span class="name">${city.icon} ${city.name} <span class="city-lv">Lv${city.lv}</span></span>
        </div>
        <div class="desc">${city.desc}</div>
      `;

      if (!unlocked) {
        card.insertAdjacentHTML(
          'beforeend',
          `<div class="req">🔒 연구 ${city.reqResearch}개 완료 시 해금 (현재 ${done}개)</div>`,
        );
      } else if (!city.playable) {
        card.insertAdjacentHTML('beforeend', `<div class="req">🚧 다음 업데이트에서 오픈!</div>`);
      } else {
        const btn = document.createElement('button');
        btn.className = 'select-btn';
        btn.textContent = '🛂 입국 심사 다시 해보기';
        btn.addEventListener('click', () => {
          overlay.remove();
          this.onReplayImmigration();
        });
        card.appendChild(btn);
      }
      body.appendChild(card);
    }

    body.insertAdjacentHTML(
      'beforeend',
      `<p class="save-note" style="margin-top:8px">연구를 완료할수록 더 깊은(어려운) 도시로 떠날 수 있다.</p>`,
    );

    overlay.querySelector('.panel-close')!.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    this.root.appendChild(overlay);
  }
}

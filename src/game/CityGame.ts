import type { ScenarioDef } from '../data/types';
import { flags } from '../systems/flags';
import { inventory } from '../systems/inventory';
import type { ResearchSystem } from '../systems/ResearchSystem';
import { speakJa } from '../systems/speech';
import type { ScenarioPanel } from '../ui/ScenarioPanel';

interface LocationAction {
  label: string;
  /** false면 버튼을 숨긴다 */
  visible?: () => boolean;
  run: () => void;
}

interface LocationDef {
  icon: string;
  name: string;
  desc: string;
  /** 배너 배경 (CSS gradient) */
  bg: string;
  actions: () => LocationAction[];
}

/**
 * 장소 기반 여행 게임 화면 (탑뷰 대체).
 * 도시 → 장소 → 행동(이동/상황극/간판 읽기) 구조.
 */
export class CityGame {
  private screenEl: HTMLElement;
  private currentId = 'airport';
  private locations: Record<string, LocationDef>;

  constructor(
    private rs: ResearchSystem,
    private scenarios: Record<string, ScenarioDef>,
    private scenarioPanel: ScenarioPanel,
  ) {
    this.screenEl = document.getElementById('screen-root')!;
    this.locations = this.buildTokyo();
    // 연구 완료 → 간판이 읽히게 되므로 화면 갱신
    rs.on('completed', () => this.render());
  }

  start(): void {
    const last = inventory.lastLoc;
    this.goto(last && this.locations[last] ? last : 'airport');
  }

  goto(id: string): void {
    this.currentId = id;
    inventory.setLastLoc(id);
    this.render();
  }

  // ---------- 행동 헬퍼 ----------

  private play(id: string, onSuccess?: () => void): void {
    this.scenarioPanel.play(this.scenarios[id], () => {
      onSuccess?.();
      this.render();
    });
  }

  /** 행동 결과 메시지를 화면 하단에 표시 */
  private say(html: string): void {
    const el = this.screenEl.querySelector('.location-feedback');
    if (el) el.innerHTML = html;
  }

  /** 간판/안내문: 문자 연구를 완료해야 읽을 수 있다 */
  private sign(label: string, tag: string, jp: string, phonetic: string, meaning: string): LocationAction {
    return {
      label,
      run: () => {
        if (this.rs.isTagUnlocked(tag)) {
          speakJa(jp);
          this.say(`🪧 <b>${jp}</b> — ${phonetic} · ${meaning}`);
        } else {
          const need = this.rs.researchForTag(tag);
          this.say(`🪧 <b>???</b> — 무슨 글자인지 읽을 수 없다…${need ? ` <span style="color:var(--accent)">(🔬 「${need.name}」 연구 필요)</span>` : ''}`);
        }
      },
    };
  }

  // ---------- 도쿄 (Lv0) ----------

  private buildTokyo(): Record<string, LocationDef> {
    return {
      airport: {
        icon: '🛬',
        name: '나리타 공항 로비',
        desc: '도쿄의 관문. 안내판엔 영어가 병기되어 있어 그럭저럭 다닐 만하다.',
        bg: 'linear-gradient(160deg,#8ec5e8,#dfeefb)',
        actions: () => [
          {
            label: '🚆 전철을 타고 시내로 간다',
            run: () => {
              if (!inventory.has('IC카드')) {
                this.say('🚧 개찰구 앞에서 막혔다. 표나 카드가 필요한 것 같다…<br>💡 공항 <b>편의점</b>에서 IC카드를 판다고 들었다.');
                return;
              }
              this.play('station-gate', () => this.goto('street'));
            },
          },
          {
            label: '🚕 택시를 탄다 (¥3,000)',
            run: () => {
              if (inventory.yen < 3000) {
                this.say('💸 지갑을 보니… 택시비가 부족하다.');
                return;
              }
              this.play('taxi-ride', () => {
                inventory.spend(3000);
                this.goto('street');
              });
            },
          },
          {
            label: '🚶 시내까지 걸어간다',
            run: () => this.say('🗺 지도를 보니 시내까지 <b>60km</b>… 무리다. 무리.'),
          },
          { label: '🏪 공항 편의점에 들른다', run: () => this.goto('konbini') },
          {
            label: '🛂 입국 심사 다시 해보기',
            run: () => this.play('tokyo-immigration'),
          },
        ],
      },

      konbini: {
        icon: '🏪',
        name: '공항 편의점',
        desc: '없는 게 없는 일본 편의점. 카운터의 점원이 힐끔 이쪽을 본다.',
        bg: 'linear-gradient(160deg,#7ed0a0,#e8f7ee)',
        actions: () => [
          {
            label: '💳 IC카드를 산다 (¥2,000)',
            visible: () => !inventory.has('IC카드'),
            run: () => {
              if (inventory.yen < 2000) {
                this.say('💸 2,000엔이 없다… 여행 시작부터 파산인가.');
                return;
              }
              this.play('konbini-ic', () => {
                inventory.spend(2000);
                inventory.add('IC카드');
              });
            },
          },
          {
            label: '💳 IC카드 잔액을 본다',
            visible: () => inventory.has('IC카드'),
            run: () => this.say('💳 IC카드가 가방에 잘 있다. 이제 전철은 문제없다.'),
          },
          this.sign('🪧 가게 간판을 읽어본다', 'katakana', 'コンビニ', '콘비니', '편의점'),
          { label: '↩️ 공항 로비로 돌아간다', run: () => this.goto('airport') },
        ],
      },

      street: {
        icon: '🏙',
        name: '도쿄 시내 거리',
        desc: '네온 간판과 인파. 호텔과 라멘 가게가 보인다. 드디어 진짜 도쿄다!',
        bg: 'linear-gradient(160deg,#f2a65a,#fbe3c8)',
        actions: () => [
          {
            label: '🏨 호텔에 체크인한다',
            visible: () => !flags.get('tokyo-hotel'),
            run: () => this.play('hotel-checkin', () => flags.set('tokyo-hotel')),
          },
          {
            label: '🏨 호텔에서 쉰다',
            visible: () => flags.get('tokyo-hotel'),
            run: () => this.say('🛏 방에서 한숨 돌렸다. 다시 나갈 힘이 난다!'),
          },
          { label: '🍜 라멘 가게에 들어간다', run: () => this.goto('ramen') },
          this.sign('🪧 역 표지판을 읽어본다', 'kanji', '駅', '에키', '역'),
          {
            label: '🚆 전철로 공항에 돌아간다',
            run: () => {
              if (!inventory.has('IC카드')) {
                this.say('💳 IC카드가 없으면 전철을 탈 수 없다…');
                return;
              }
              this.goto('airport');
            },
          },
        ],
      },

      ramen: {
        icon: '🍜',
        name: '라멘 가게',
        desc: '문을 열자 진한 국물 냄새. 카운터 너머로 활기찬 목소리가 들린다.',
        bg: 'linear-gradient(160deg,#e8836f,#fbd9c8)',
        actions: () => [
          {
            label: '🍜 자리에 앉아 주문한다 (¥900)',
            run: () => {
              if (inventory.yen < 900) {
                this.say('💸 라멘 한 그릇 값도 없다니… 눈물이 난다.');
                return;
              }
              this.play('ramen-order', () => inventory.spend(900));
            },
          },
          this.sign('🪧 가게 간판을 읽어본다', 'food', 'らーめん', '라-멘', '라멘'),
          this.sign('🪧 벽의 메뉴판을 본다', 'hiragana', 'すし・みず・おちゃ', '스시·미즈·오챠', '초밥·물·차'),
          { label: '↩️ 거리로 나간다', run: () => this.goto('street') },
        ],
      },
    };
  }

  // ---------- 렌더링 ----------

  private render(): void {
    const loc = this.locations[this.currentId];
    const bag = inventory.items.length ? inventory.items.join(', ') : '비어 있음';

    this.screenEl.innerHTML = `
      <div class="location">
        <div class="location-banner" style="background:${loc.bg}"><span>${loc.icon}</span></div>
        <h1 class="location-name">${loc.name} <span class="city-lv">도쿄 Lv0</span></h1>
        <p class="location-desc">${loc.desc}</p>
        <div class="status-bar">💴 ¥${inventory.yen.toLocaleString()} &nbsp;·&nbsp; 🎒 ${bag}</div>
        <div class="action-list"></div>
        <div class="location-feedback"></div>
      </div>
    `;

    const list = this.screenEl.querySelector('.action-list')!;
    for (const action of loc.actions()) {
      if (action.visible && !action.visible()) continue;
      const btn = document.createElement('button');
      btn.className = 'action-btn-row';
      btn.textContent = action.label;
      btn.addEventListener('click', () => action.run());
      list.appendChild(btn);
    }
  }
}

import type { ScenarioDef } from '../data/types';
import { flags } from '../systems/flags';
import { inventory } from '../systems/inventory';
import type { ResearchSystem } from '../systems/ResearchSystem';
import { speakJa } from '../systems/speech';
import { trip } from '../systems/trip';
import type { ScenarioPanel } from '../ui/ScenarioPanel';

interface LocationAction {
  label: string;
  /** false면 버튼을 숨긴다 */
  visible?: () => boolean;
  run: () => void;
}

interface LocationDef {
  city: CityId;
  icon: string;
  name: string;
  desc: string;
  /** 배너 배경 (CSS gradient) */
  bg: string;
  actions: () => LocationAction[];
}

export type CityId = 'tokyo' | 'osaka' | 'yonago';

interface CityMeta {
  name: string;
  lv: number;
  entry: string;
  /** 첫 방문 시 재생할 도착 시나리오 */
  arrival?: string;
  /** 스탬프 획득에 필요한 시나리오 id */
  stampScenarios: string[];
}

export const CITIES: Record<CityId, CityMeta> = {
  tokyo: {
    name: '도쿄', lv: 0, entry: 'airport',
    stampScenarios: ['hotel-checkin', 'ramen-order', 'asakusa-photo'],
  },
  osaka: {
    name: '오사카', lv: 1, entry: 'osaka-station', arrival: 'shinkansen-osaka',
    stampScenarios: ['takoyaki', 'drugstore', 'osaka-castle'],
  },
  yonago: {
    name: '요나고', lv: 2, entry: 'yonago-station', arrival: 'local-train-yonago',
    stampScenarios: ['yonago-bus', 'ryokan-checkin', 'matsuri'],
  },
};

/**
 * 장소 기반 여행 게임 화면.
 * 도시(난이도) → 장소 → 행동(이동/상황극/간판 읽기) 구조.
 * 도시별 핵심 상황극을 모두 완료하면 스탬프, 스탬프 3개면 일본 마스터 엔딩.
 */
export class CityGame {
  private screenEl: HTMLElement;
  private currentId = 'airport';
  private locations: Record<string, LocationDef>;
  /** 📱 열기 (집 화면에서 사용) — main에서 연결 */
  onOpenPhone?: () => void;

  constructor(
    private rs: ResearchSystem,
    private scenarios: Record<string, ScenarioDef>,
    private scenarioPanel: ScenarioPanel,
  ) {
    this.screenEl = document.getElementById('screen-root')!;
    this.locations = this.buildJapan();
    // 연구 완료 → 간판이 읽히게 되므로 화면 갱신
    rs.on('completed', () => this.render());
  }

  start(): void {
    const last = inventory.lastLoc;
    if (trip.current && last && this.locations[last]) {
      this.goto(last);
    } else if (flags.get('tokyo-arrived') && !trip.current) {
      this.goto('home');
    } else {
      this.goto(last && this.locations[last] ? last : 'airport');
    }
  }

  /** 박수를 정하고 여행 시작 (도쿄) */
  startTrip(city: CityId, nights: number): void {
    trip.start(city, nights);
    this.travelTo(city);
  }

  goto(id: string): void {
    this.currentId = id;
    inventory.setLastLoc(id);
    this.render();
  }

  /** 📱 여행 앱에서 도시 이동. 첫 방문이면 도착 시나리오부터. */
  travelTo(city: CityId): void {
    const meta = CITIES[city];
    const visitedFlag = `visited-${city}`;
    if (meta.arrival && !flags.get(visitedFlag)) {
      this.play(meta.arrival, () => {
        flags.set(visitedFlag);
        this.goto(meta.entry);
      });
    } else {
      this.goto(meta.entry);
    }
  }

  /** 도시별 완료한 핵심 상황극 수 */
  stampProgress(city: CityId): { done: number; total: number } {
    const list = CITIES[city].stampScenarios;
    return { done: list.filter((s) => flags.get(`done-${s}`)).length, total: list.length };
  }

  hasStamp(city: CityId): boolean {
    const p = this.stampProgress(city);
    return p.done === p.total;
  }

  // ---------- 행동 헬퍼 ----------

  private play(id: string, onSuccess?: () => void): void {
    this.scenarioPanel.play(this.scenarios[id], () => {
      const firstClear = !flags.get(`done-${id}`);
      flags.set(`done-${id}`);
      onSuccess?.();
      this.render();
      if (firstClear) this.checkEnding();
    });
  }

  /** 스탬프 3개 → 일본 마스터 엔딩 (1회) */
  private checkEnding(): void {
    if (flags.get('japan-master')) return;
    if (!(['tokyo', 'osaka', 'yonago'] as CityId[]).every((c) => this.hasStamp(c))) return;
    flags.set('japan-master');
    this.showEnding();
  }

  private showEnding(): void {
    const overlay = document.createElement('div');
    overlay.className = 'panel-overlay';
    overlay.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h2>🎌 일본 마스터</h2></div>
        <div class="panel-body">
          <div class="quiz-complete">
            <div class="big">🎆 ENDING 🎆</div>
            <div class="ending-story">
              아무것도 못 읽던 공항에서 시작해,<br>
              도쿄의 호텔에서, 오사카의 노점에서, 요나고의 축제에서 —<br>
              당신은 <b>일본어로 살아남았다.</b>
            </div>
            <div class="ending-stamps">
              <span>🗼 도쿄</span><span>🏯 오사카</span><span>🌾 요나고</span>
            </div>
            <div class="ending-stats">
              🔬 완료한 연구 ${this.rs.completedCount} / ${this.rs.defs.length}
              &nbsp;·&nbsp; 💴 남은 여비 ¥${inventory.yen.toLocaleString()}
            </div>
            <div class="sub" style="margin-top:14px">
              여권에 스탬프 세 개가 나란히 찍혔다.<br>
              다음 여행지는 어디로…? 🇺🇸 🇪🇺 <small>(준비 중)</small>
            </div>
            <button class="quiz-next">여행은 계속된다</button>
          </div>
        </div>
      </div>
    `;
    overlay.querySelector('.quiz-next')!.addEventListener('click', () => overlay.remove());
    document.getElementById('panel-root')!.appendChild(overlay);
  }

  /** 행동 결과 메시지를 화면 하단에 표시 */
  private say(html: string): void {
    const el = this.screenEl.querySelector('.location-feedback');
    if (el) el.innerHTML = html;
  }

  /** 유료 상황극: 성공 시 지불. 잔액 부족이면 진입 불가 */
  private paidScenario(id: string, cost: number, broke: string, onSuccess?: () => void): void {
    if (inventory.yen < cost) {
      this.say(broke);
      return;
    }
    this.play(id, () => {
      inventory.spend(cost);
      onSuccess?.();
      this.render();
    });
  }

  /**
   * 활동 상황극: 여행 중엔 하루 슬롯을 소비한다 (2개 = 밤).
   * 인프라(체크인·이동·구매)는 슬롯을 쓰지 않으므로 play/paidScenario를 그대로 쓴다.
   */
  private activity(id: string, cost = 0, broke = ''): void {
    if (trip.current && trip.isEvening) {
      this.say(trip.isLastDay ? '🌙 날이 저물었다… 이제 공항으로 가자!' : '🌙 날이 저물었다… 호텔로 돌아가서 자자.');
      return;
    }
    const after = (): void => {
      if (trip.current) trip.recordActivity(this.scenarios[id].title);
      this.render();
    };
    if (cost > 0) this.paidScenario(id, cost, broke, after);
    else this.play(id, after);
  }

  /** ✈️ 출국 — 여행 종료, 도시 엔딩 리포트 */
  private depart(): void {
    const final = trip.end();
    if (!final) return;
    flags.set(`ended-${final.city}`);

    const unique = [...new Set(final.log)];
    const slots = final.nights * 2;
    const ratio = unique.length / slots;
    const grade = ratio >= 1 ? 'S' : ratio >= 0.75 ? 'A' : ratio >= 0.5 ? 'B' : 'C';
    const logHtml = unique.length
      ? unique.map((t) => `<li>${t}</li>`).join('')
      : '<li>…호텔 밖을 거의 나가지 않았다. 그것도 여행이지.</li>';

    const overlay = document.createElement('div');
    overlay.className = 'panel-overlay';
    overlay.innerHTML = `
      <div class="panel">
        <div class="panel-head"><h2>✈️ 귀국 — 도쿄 여행 끝</h2></div>
        <div class="panel-body">
          <div class="quiz-complete">
            <div class="big">🗼 도쿄 ${final.nights}박 ${final.nights + 1}일</div>
            <div class="ending-story">
              창밖으로 도쿄가 멀어진다.<br>
              아무것도 못 알아듣던 첫날의 내가, 조금은 다른 사람이 되어 돌아간다.
            </div>
            <div class="trip-report">
              <div class="trip-grade">여행 등급 <b>${grade}</b></div>
              <ul class="trip-log">${logHtml}</ul>
              <div class="ending-stats">
                🔬 연구 ${this.rs.completedCount}/${this.rs.defs.length}
                · 💴 남은 여비 ¥${inventory.yen.toLocaleString()}
              </div>
            </div>
            <div class="sub" style="margin-top:12px">
              더 길게 머물수록, 더 많이 배울수록 여행은 풍성해진다.<br>
              다음 여행은… 🏯 오사카? 아니면 도쿄 한 번 더?
            </div>
            <button class="quiz-next">집으로</button>
          </div>
        </div>
      </div>
    `;
    overlay.querySelector('.quiz-next')!.addEventListener('click', () => {
      overlay.remove();
      this.goto('home');
    });
    document.getElementById('panel-root')!.appendChild(overlay);
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

  // ---------- 일본 (도쿄 Lv0 / 오사카 Lv1 / 요나고 Lv2) ----------

  private buildJapan(): Record<string, LocationDef> {
    return {
      // ===== 도쿄 Lv0 =====
      airport: {
        city: 'tokyo', icon: '🛬', name: '나리타 공항 로비',
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
            run: () => this.paidScenario('taxi-ride', 3000, '💸 지갑을 보니… 택시비가 부족하다.', () => this.goto('street')),
          },
          {
            label: '🚶 시내까지 걸어간다',
            run: () => this.say('🗺 지도를 보니 시내까지 <b>60km</b>… 무리다. 무리.'),
          },
          { label: '🏪 공항 편의점에 들른다', run: () => this.goto('konbini') },
          {
            label: '✈️ 출국한다 — 여행을 마친다',
            visible: () => !!trip.current,
            run: () => {
              if (!trip.isLastDay && !trip.isEvening) {
                this.say(`🤔 아직 ${trip.current!.day}일차다 (일정: ${trip.totalDays}일). 정말 떠나려면 한 번 더 누르자… <b>아니면 도쿄를 더 즐기자!</b>`);
                const btn = this.screenEl.querySelector('.location-feedback');
                btn?.addEventListener('click', () => this.depart(), { once: true });
                return;
              }
              this.depart();
            },
          },
          { label: '🛂 입국 심사 다시 해보기', run: () => this.play('tokyo-immigration') },
        ],
      },

      home: {
        city: 'tokyo', icon: '🏠', name: '집 (한국)',
        desc: '여행에서 돌아온 내 방. 책상 위 일본어 노트가 눈에 들어온다. 다음엔 어디로 떠날까?',
        bg: 'linear-gradient(160deg,#6e8cc8,#dde7f8)',
        actions: () => [
          { label: '✈️ 휴대폰을 열어 다음 여행을 계획한다', run: () => this.onOpenPhone?.() },
          { label: '📓 일본어 노트를 펼친다 (연구·문제는 언제든 가능)', run: () => this.say('🔬 상단의 연구/문제 풀기 버튼으로 언제든 공부할 수 있다. 다음 여행이 쉬워진다!') },
        ],
      },

      konbini: {
        city: 'tokyo', icon: '🏪', name: '공항 편의점',
        desc: '없는 게 없는 일본 편의점. 카운터의 점원이 힐끔 이쪽을 본다.',
        bg: 'linear-gradient(160deg,#7ed0a0,#e8f7ee)',
        actions: () => [
          {
            label: '💳 IC카드를 산다 (¥2,000)',
            visible: () => !inventory.has('IC카드'),
            run: () => this.paidScenario('konbini-ic', 2000, '💸 2,000엔이 없다… 여행 시작부터 파산인가.', () => inventory.add('IC카드')),
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
        city: 'tokyo', icon: '🏙', name: '도쿄 시내 거리',
        desc: '네온 간판과 인파. 호텔, 라멘 가게, 그리고 아사쿠사행 표지판이 보인다.',
        bg: 'linear-gradient(160deg,#f2a65a,#fbe3c8)',
        actions: () => [
          {
            label: '🏨 호텔에 체크인한다',
            visible: () => !flags.get('done-hotel-checkin'),
            run: () => this.play('hotel-checkin'),
          },
          {
            label: '🛏 호텔에서 잔다 (다음 날로)',
            visible: () => flags.get('done-hotel-checkin') && !!trip.current && !trip.isLastDay,
            run: () => {
              trip.sleep();
              this.say(`☀️ <b>${trip.current!.day}일차 아침!</b> ${trip.isLastDay ? '오늘은 귀국일이다. 공항으로 가기 전에 마지막으로 뭘 할까?' : '오늘은 도쿄에서 뭘 해볼까?'}`);
              this.render();
            },
          },
          {
            label: '🏨 호텔에서 쉰다',
            visible: () => flags.get('done-hotel-checkin') && (!trip.current || trip.isLastDay),
            run: () => this.say('🛏 방에서 한숨 돌렸다.' + (trip.isLastDay ? ' 오늘은 귀국일 — 비행기 시간을 잊지 말자!' : '')),
          },
          { label: '🍜 라멘 가게에 들어간다', run: () => this.goto('ramen') },
          { label: '⛩ 아사쿠사에 가본다', run: () => this.goto('asakusa') },
          { label: '☕ 카페에 들어간다 (¥500)', run: () => this.activity('cafe-order', 500, '💸 커피 한 잔 값이 없다…') },
          { label: '🎤 가라오케에 간다 (¥1,500)', run: () => this.activity('karaoke', 1500, '💸 가라오케 갈 돈이 없다… 길에서 흥얼거린다.') },
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
        city: 'tokyo', icon: '🍜', name: '라멘 가게',
        desc: '문을 열자 진한 국물 냄새. 카운터 너머로 활기찬 목소리가 들린다.',
        bg: 'linear-gradient(160deg,#e8836f,#fbd9c8)',
        actions: () => [
          {
            label: '🍜 자리에 앉아 주문한다 (¥900)',
            run: () => this.activity('ramen-order', 900, '💸 라멘 한 그릇 값도 없다니… 눈물이 난다.'),
          },
          this.sign('🪧 가게 간판을 읽어본다', 'food', 'らーめん', '라-멘', '라멘'),
          this.sign('🪧 벽의 메뉴판을 본다', 'hiragana', 'すし・みず・おちゃ', '스시·미즈·오챠', '초밥·물·차'),
          { label: '↩️ 거리로 나간다', run: () => this.goto('street') },
        ],
      },

      asakusa: {
        city: 'tokyo', icon: '⛩', name: '아사쿠사 센소지',
        desc: '거대한 붉은 등불, 향 연기, 관광객의 물결. 도쿄에서 가장 오래된 절이다.',
        bg: 'linear-gradient(160deg,#d96459,#f7ddc8)',
        actions: () => [
          { label: '📷 사진을 부탁받았다…?', run: () => this.activity('asakusa-photo') },
          this.sign('🪧 입구 안내문을 읽어본다', 'kanji', '入口', '이리구치', '입구'),
          { label: '🙏 향 연기를 머리에 쐰다', run: () => this.say('💨 향 연기를 쐬면 머리가 좋아진다는 속설이 있다. 연구가 잘 될지도…?') },
          { label: '↩️ 거리로 돌아간다', run: () => this.goto('street') },
        ],
      },

      // ===== 오사카 Lv1 =====
      'osaka-station': {
        city: 'osaka', icon: '🚉', name: '신오사카역',
        desc: '쉴 새 없이 오가는 사람들. 안내판에서 영어가 줄었다. 말소리가 어딘가 다르다…?',
        bg: 'linear-gradient(160deg,#a08ce0,#e6ddf6)',
        actions: () => [
          { label: '🌆 도톤보리로 나간다', run: () => this.goto('dotonbori') },
          this.sign('🪧 출구 표지판을 읽어본다', 'kanji', '出口', '데구치', '출구'),
          { label: '📱 (도쿄로 돌아가려면 휴대폰 여행 앱을 쓰자)', run: () => this.say('📱 상단의 휴대폰 버튼으로 도시를 이동할 수 있다.') },
        ],
      },

      dotonbori: {
        city: 'osaka', icon: '🌆', name: '도톤보리',
        desc: '거대한 게 간판, 글리코 러너, 타코야키 냄새. 오사카의 심장. 여긴 영어 힌트가 없다.',
        bg: 'linear-gradient(160deg,#e0608a,#f9d8e4)',
        actions: () => [
          {
            label: '🐙 타코야키를 사 먹는다 (¥600)',
            run: () => this.paidScenario('takoyaki', 600, '💸 타코야키 살 돈이 없다… 냄새만 맡는다.'),
          },
          {
            label: '💊 드럭스토어에서 심부름 약을 산다 (¥1,500)',
            run: () => this.paidScenario('drugstore', 1500, '💸 약 살 돈이 부족하다. 가족에게 면목이 없다…'),
          },
          {
            label: '🏯 오사카성을 찾아간다 (입장료 ¥600)',
            run: () => this.paidScenario('osaka-castle', 600, '💸 입장료가 없다… 해자 밖에서 천수각만 올려다본다.'),
          },
          this.sign('🪧 포장마차 천막의 글자를 읽어본다', 'hiragana', 'たこやき', '타코야키', '타코야키(문어빵)'),
          { label: '↩️ 신오사카역으로 돌아간다', run: () => this.goto('osaka-station') },
        ],
      },

      // ===== 요나고 Lv2 =====
      'yonago-station': {
        city: 'yonago', icon: '🌾', name: '요나고역 앞',
        desc: '한적한 시골 역. 들리는 건 매미 소리뿐. 영어는… 어디에도 없다.',
        bg: 'linear-gradient(160deg,#88b86e,#eef5dc)',
        actions: () => [
          {
            label: '🚌 온천행 버스를 탄다 (¥200)',
            run: () => this.paidScenario('yonago-bus', 200, '💸 버스비 200엔이 없다. 걸어가기엔 너무 멀다…', () => this.goto('ryokan')),
          },
          this.sign('🪧 역 이름판을 읽어본다', 'hiragana', 'よなご', '요나고', '요나고 (지명)'),
          { label: '🦀 거대한 게 동상을 구경한다', run: () => this.say('🦀 요나고 근처 사카이미나토는 게로 유명하다고 한다. 동상이 위풍당당하다.') },
        ],
      },

      ryokan: {
        city: 'yonago', icon: '♨️', name: '온천 료칸',
        desc: '나무 향이 나는 오래된 료칸. 주인 할머니의 환대가 기다린다.',
        bg: 'linear-gradient(160deg,#c98f5e,#f5e6d3)',
        actions: () => [
          {
            label: '🙇 체크인한다',
            visible: () => !flags.get('done-ryokan-checkin'),
            run: () => this.play('ryokan-checkin'),
          },
          {
            label: '♨️ 온천에 몸을 담근다',
            visible: () => flags.get('done-ryokan-checkin'),
            run: () => this.say('♨️ 후우… 여행의 피로가 녹아내린다. (밤 10시까지라고 하셨다)'),
          },
          {
            label: '🏮 저녁, 마을 축제에 나가본다',
            visible: () => flags.get('done-ryokan-checkin'),
            run: () => this.goto('village'),
          },
          this.sign('🪧 현관의 안내문을 읽어본다', 'kanji', '入口', '이리구치', '입구'),
          { label: '↩️ 역 앞으로 돌아간다', run: () => this.goto('yonago-station') },
        ],
      },

      village: {
        city: 'yonago', icon: '🏮', name: '마을 축제 (마츠리)',
        desc: '등불이 줄지어 빛나고, 북소리가 울린다. 유카타 차림의 사람들. 오늘 밤이 최종 시험이다.',
        bg: 'linear-gradient(160deg,#4a3f78,#8d7fc0)',
        actions: () => [
          {
            label: '🎆 축제 속으로 들어간다 — 최종 시험',
            visible: () => !flags.get('done-matsuri'),
            run: () => this.play('matsuri'),
          },
          {
            label: '🎆 불꽃놀이를 다시 본다',
            visible: () => flags.get('done-matsuri'),
            run: () => this.say('🎆 그날 밤의 불꽃은 잊을 수 없다. 일본어로 살아낸 첫날 밤이었다.'),
          },
          { label: '↩️ 료칸으로 돌아간다', run: () => this.goto('ryokan') },
        ],
      },
    };
  }

  // ---------- 렌더링 ----------

  private render(): void {
    const loc = this.locations[this.currentId];
    const meta = CITIES[loc.city];
    const isHome = this.currentId === 'home';
    const bag = inventory.items.length ? inventory.items.join(', ') : '비어 있음';
    const badge = isHome ? '🇰🇷 휴식' : `${meta.name} Lv${meta.lv}`;

    const t = trip.current;
    const tripBar =
      t && !isHome && loc.city === t.city
        ? ` · 🗓 ${t.day}/${trip.totalDays}일차 ${trip.isEvening ? '🌙 밤' : '☀️ 낮'}${trip.isLastDay ? ' <b>(귀국일!)</b>' : ''}`
        : '';

    this.screenEl.innerHTML = `
      <div class="location">
        <div class="location-banner" style="background:${loc.bg}"><span>${loc.icon}</span></div>
        <h1 class="location-name">${loc.name} <span class="city-lv">${badge}</span></h1>
        <p class="location-desc">${loc.desc}</p>
        <div class="status-bar">💴 ¥${inventory.yen.toLocaleString()} · 🎒 ${bag}${tripBar}</div>
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

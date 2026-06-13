import type { ProblemBank, ProblemItem } from '../data/types';
import type { ResearchSystem } from '../systems/ResearchSystem';
import { speakJa, ttsAvailable } from '../systems/speech';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 문제 풀이 패널: 정답마다 활성 연구에 RP가 쌓인다 (문제 풀이 = 연구의 "턴") */
export class QuizPanel {
  private root: HTMLElement;

  constructor(
    private rs: ResearchSystem,
    private bank: ProblemBank,
  ) {
    this.root = document.getElementById('panel-root')!;
  }

  open(): void {
    const researchId = this.rs.activeId;
    if (!researchId) return;
    const def = this.rs.get(researchId)!;
    const items = this.bank[researchId];
    if (!items || items.length < 4) return;

    const overlay = document.createElement('div');
    overlay.className = 'panel-overlay';
    overlay.innerHTML = `
      <div class="panel">
        <div class="panel-head">
          <h2>✏️ ${def.name} 연구</h2>
          <button class="panel-close">✕</button>
        </div>
        <div class="panel-body"></div>
      </div>
    `;
    const body = overlay.querySelector('.panel-body') as HTMLElement;
    overlay.querySelector('.panel-close')!.addEventListener('click', () => overlay.remove());
    this.root.appendChild(overlay);

    let queue = shuffle(items);

    const nextProblem = (): void => {
      if (queue.length === 0) queue = shuffle(items);
      this.renderProblem(body, queue.pop()!, items, researchId, overlay, nextProblem);
    };
    nextProblem();
  }

  private renderProblem(
    body: HTMLElement,
    item: ProblemItem,
    pool: ProblemItem[],
    researchId: string,
    overlay: HTMLElement,
    onNext: () => void,
  ): void {
    const { current, cost } = this.rs.progress(researchId);
    body.innerHTML = `<div class="quiz-progress">연구 진행: ${current} / ${cost} RP</div>`;

    const feedbackEl = document.createElement('div');
    feedbackEl.className = 'quiz-feedback';

    /** 채점 공통 처리: 피드백 → RP 적립 → 완료/다음 */
    const finish = (correct: boolean): void => {
      feedbackEl.innerHTML = correct
        ? `⭕ <b>${item.target}</b> — ${item.reading} · ${item.meaning} <span style="color:var(--green)">+${item.rp} RP</span>`
        : `❌ 정답: <b>${item.target}</b> — ${item.reading} · ${item.meaning}`;
      speakJa(item.target);

      const completedId = correct ? this.rs.addRP(item.rp) : null;
      if (completedId) {
        const doneDef = this.rs.get(completedId)!;
        setTimeout(() => {
          body.innerHTML = `
            <div class="quiz-complete">
              <div class="big">🎉 연구 완료!</div>
              <div class="sub">「${doneDef.name}」 — 이제 월드에서 관련 글자가 읽힙니다.<br>마을을 돌아다니며 확인해 보세요!</div>
              <button class="quiz-next">월드로 돌아가기</button>
            </div>
          `;
          body.querySelector('.quiz-next')!.addEventListener('click', () => overlay.remove());
        }, 900);
        return;
      }
      const nextBtn = document.createElement('button');
      nextBtn.className = 'quiz-next';
      nextBtn.textContent = '다음 문제 →';
      nextBtn.addEventListener('click', onNext);
      body.appendChild(nextBtn);
    };

    if (item.blocks && item.blocks.length >= 2) {
      this.renderArrange(body, item, feedbackEl, finish);
    } else {
      // 세 방향으로 같은 단어를 복습 — 소리가 문제면 보기는 일본어 글자여야 한다
      const modes = [
        (): void => this.renderProduce(body, item, pool, finish),
        (): void => this.renderRead(body, item, pool, finish),
      ];
      if (ttsAvailable()) modes.push((): void => this.renderListen(body, item, pool, finish));
      modes[Math.floor(Math.random() * modes.length)]();
    }
    body.appendChild(feedbackEl);
  }

  /** 작문: 한글 뜻을 보고 일본어를 고른다 (보기 발음 들으며 비교) */
  private renderProduce(
    body: HTMLElement,
    item: ProblemItem,
    pool: ProblemItem[],
    finish: (correct: boolean) => void,
  ): void {
    body.insertAdjacentHTML(
      'beforeend',
      `<div class="quiz-question">「${item.meaning}」<br><small style="font-size:13px;color:#8a7f72">일본어로 고르세요 · 보기를 누르면 발음이 들려요</small></div>
       <div class="quiz-choices"></div>`,
    );
    this.fillChoices(body, item, pool, { choiceField: 'target', playOnSelect: true }, finish);
  }

  /** 읽기: 일본어 글자를 보고 무슨 뜻인지 고른다 (발음 없음 — 읽을 줄 알아야 풀림) */
  private renderRead(
    body: HTMLElement,
    item: ProblemItem,
    pool: ProblemItem[],
    finish: (correct: boolean) => void,
  ): void {
    body.insertAdjacentHTML(
      'beforeend',
      `<div class="quiz-question">${item.target}<br><small style="font-size:13px;color:#8a7f72">이 일본어를 읽어보세요 — 무슨 뜻일까요?</small></div>
       <div class="quiz-choices"></div>`,
    );
    this.fillChoices(body, item, pool, { choiceField: 'meaning', playOnSelect: false }, finish);
  }

  /** 듣기: 소리를 듣고 일본어 글자를 고른다 (보기는 글자 — 글자를 알아야 풀림) */
  private renderListen(
    body: HTMLElement,
    item: ProblemItem,
    pool: ProblemItem[],
    finish: (correct: boolean) => void,
  ): void {
    body.insertAdjacentHTML(
      'beforeend',
      `<div class="quiz-question">🔊 <button class="quiz-speak">다시 듣기</button><br><small style="font-size:13px;color:#8a7f72">들리는 소리를 일본어 글자에서 고르세요</small></div>
       <div class="quiz-choices"></div>`,
    );
    speakJa(item.target);
    body.querySelector('.quiz-speak')!.addEventListener('click', () => speakJa(item.target));
    // 보기 발음은 끄기 — 들으면 귀로만 매칭해 찍을 수 있으므로 글자 인식을 강제한다
    this.fillChoices(body, item, pool, { choiceField: 'target', playOnSelect: false }, finish);
  }

  private fillChoices(
    body: HTMLElement,
    item: ProblemItem,
    pool: ProblemItem[],
    opts: { choiceField: 'target' | 'meaning'; playOnSelect: boolean },
    finish: (correct: boolean) => void,
  ): void {
    const label = (p: ProblemItem): string => (opts.choiceField === 'meaning' ? p.meaning : p.target);
    // 표시 텍스트가 겹치면 "같은 보기 2개 중 하나만 정답"이 되므로 중복 라벨 제외
    const seen = new Set([label(item)]);
    const distractors: ProblemItem[] = [];
    for (const p of shuffle(pool)) {
      if (p.target === item.target || seen.has(label(p))) continue;
      seen.add(label(p));
      distractors.push(p);
      if (distractors.length === 3) break;
    }
    const choices = shuffle([item, ...distractors]);
    const choicesEl = body.querySelector('.quiz-choices')!;
    let answered = false;
    let selected: ProblemItem | null = null;

    // 고르기 ≠ 채점: 보기를 눌러 들어보고 비교한 뒤, 제출 버튼으로 확정한다 (찍기 방지)
    const submitBtn = document.createElement('button');
    submitBtn.className = 'quiz-next';
    submitBtn.textContent = '정답 제출';
    submitBtn.disabled = true;

    for (const choice of choices) {
      const btn = document.createElement('button');
      btn.className = 'quiz-choice';
      btn.textContent = label(choice);
      btn.addEventListener('click', () => {
        if (answered) return;
        selected = choice;
        choicesEl.querySelectorAll('.quiz-choice').forEach((el) => el.classList.remove('selected'));
        btn.classList.add('selected');
        submitBtn.disabled = false;
        // 작문 모드에서만 보기 발음 재생 — 듣고 비교하며 일본어를 익힌다
        if (opts.playOnSelect) speakJa(choice.target);
      });
      choicesEl.appendChild(btn);
    }

    submitBtn.addEventListener('click', () => {
      if (answered || !selected) return;
      answered = true;
      submitBtn.remove();
      const correct = selected.target === item.target;
      const correctLabel = label(item);
      choicesEl.querySelectorAll('.quiz-choice').forEach((el) => {
        if (el.classList.contains('selected')) el.classList.add(correct ? 'correct' : 'wrong');
        if (!correct && el.textContent === correctLabel) el.classList.add('correct');
      });
      finish(correct);
    });
    body.appendChild(submitBtn);
  }

  /** 조립 모드: 단어 블록을 순서대로 배열해 문장 완성 */
  private renderArrange(
    body: HTMLElement,
    item: ProblemItem,
    _feedbackEl: HTMLElement,
    finish: (correct: boolean) => void,
  ): void {
    body.insertAdjacentHTML(
      'beforeend',
      `<div class="quiz-question">「${item.meaning}」<br><small style="font-size:13px;color:#8a7f72">단어 블록을 순서대로 눌러 문장을 만드세요</small></div>
       <div class="arrange-answer"></div>
       <div class="arrange-pool"></div>
       <button class="quiz-next arrange-check" disabled>확인</button>`,
    );
    const answerEl = body.querySelector('.arrange-answer') as HTMLElement;
    const poolEl = body.querySelector('.arrange-pool') as HTMLElement;
    const checkBtn = body.querySelector('.arrange-check') as HTMLButtonElement;

    const blocks = item.blocks!;
    // 처음부터 정답 순서로 나오지 않게 섞는다
    let order = shuffle(blocks.map((_, i) => i));
    for (let tries = 0; tries < 10 && order.every((v, i) => v === i); tries++) {
      order = shuffle(blocks.map((_, i) => i));
    }

    const placed: number[] = [];
    let answered = false;

    const redraw = (): void => {
      answerEl.innerHTML = placed.length ? '' : '<span class="arrange-hint">여기에 문장이 만들어집니다</span>';
      for (const bi of placed) {
        const b = document.createElement('button');
        b.className = 'arrange-block placed';
        b.textContent = blocks[bi];
        b.addEventListener('click', () => {
          if (answered) return;
          placed.splice(placed.indexOf(bi), 1);
          redraw();
        });
        answerEl.appendChild(b);
      }
      poolEl.innerHTML = '';
      for (const bi of order) {
        if (placed.includes(bi)) continue;
        const b = document.createElement('button');
        b.className = 'arrange-block';
        b.textContent = blocks[bi];
        b.addEventListener('click', () => {
          if (answered) return;
          placed.push(bi);
          redraw();
        });
        poolEl.appendChild(b);
      }
      checkBtn.disabled = placed.length !== blocks.length;
    };
    redraw();

    checkBtn.addEventListener('click', () => {
      if (answered || placed.length !== blocks.length) return;
      answered = true;
      checkBtn.remove();
      const correct = placed.every((bi, i) => blocks[bi] === blocks[i]);
      answerEl.classList.add(correct ? 'arrange-correct' : 'arrange-wrong');
      finish(correct);
    });
  }
}

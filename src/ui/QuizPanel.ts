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
    const distractors = shuffle(pool.filter((p) => p.target !== item.target)).slice(0, 3);
    const choices = shuffle([item, ...distractors]);

    // 듣기 모드: 일본어를 듣고 뜻을 고른다 (TTS 가능할 때 절반 확률)
    const listenMode = ttsAvailable() && Math.random() < 0.5;

    body.innerHTML = `
      <div class="quiz-progress">연구 진행: ${current} / ${cost} RP</div>
      <div class="quiz-question">
        ${
          listenMode
            ? `🔊 <button class="quiz-speak">다시 듣기</button><br><small style="font-size:13px;color:#8a7f72">들리는 일본어는 무슨 뜻일까요?</small>`
            : `「${item.meaning}」<br><small style="font-size:13px;color:#8a7f72">일본어로 고르세요</small>`
        }
      </div>
      <div class="quiz-choices"></div>
      <div class="quiz-feedback"></div>
    `;
    const choicesEl = body.querySelector('.quiz-choices')!;
    const feedbackEl = body.querySelector('.quiz-feedback') as HTMLElement;

    if (listenMode) {
      speakJa(item.target);
      body.querySelector('.quiz-speak')!.addEventListener('click', () => speakJa(item.target));
    }

    let answered = false;
    for (const choice of choices) {
      const btn = document.createElement('button');
      btn.className = 'quiz-choice';
      btn.textContent = listenMode ? choice.meaning : choice.target;
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;

        const correct = choice.target === item.target;
        const correctLabel = listenMode ? item.meaning : item.target;
        btn.classList.add(correct ? 'correct' : 'wrong');
        if (!correct) {
          choicesEl.querySelectorAll('.quiz-choice').forEach((el) => {
            if (el.textContent === correctLabel) el.classList.add('correct');
          });
        }
        feedbackEl.innerHTML = correct
          ? `⭕ <b>${item.target}</b> — ${item.reading} · ${item.meaning} <span style="color:var(--green)">+${item.rp} RP</span>`
          : `❌ 정답: <b>${item.target}</b> — ${item.reading} · ${item.meaning}`;
        if (!listenMode) speakJa(item.target); // 보기 모드에서도 정답 발음을 들려준다

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
      });
      choicesEl.appendChild(btn);
    }
  }
}

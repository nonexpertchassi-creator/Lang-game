import Phaser from 'phaser';
import type { ResearchSystem } from '../systems/ResearchSystem';
import { speakJa, ttsAvailable } from '../systems/speech';
import { virtualPad } from '../ui/TouchControls';

const TILE = 16;

// 타일 인덱스: G잔디 P길 T나무 W물 R지붕 B벽
const TILE_INDEX: Record<string, number> = { G: 0, P: 1, T: 2, W: 3, R: 4, B: 5 };
const BLOCKED_TILES = new Set(['T', 'W', 'R', 'B']);

// 일본 마을 맵 (24 x 16)
const MAP = [
  'TTTTTTTTTTTTTTTTTTTTTTTT',
  'TGGGGGGGGGGGGGGGGGGGGGGT',
  'TGRRRGGGRRRGGGRRRGGRRRGT',
  'TGBBBGGGBBBGGGBBBGGBBBGT',
  'TGGGGGGGGGGGGGGGGGGGGGGT',
  'TGPPPPPPPPPPPPPPPPPPPPGT',
  'TGPGGGGGGGGGGGGGGGGGGPGT',
  'TGPGGGGGGGGGGGGGGGGGGPGT',
  'TGPGGGGGGGGGGGGGGGGGGPGT',
  'TGPPPPPPPPPPPPPPPPPPPPGT',
  'TGGGGGGGGGGGGGGGGGGGGGGT',
  'TGWWWWGGGGGGGGGGTTTGGGGT',
  'TGWWWWGGGGGGGGGGTTTGGGGT',
  'TGGGGGGGGGGGGGGGGGGGGGGT',
  'TGGGGGGGGGGGGGGGGGGGGGGT',
  'TTTTTTTTTTTTTTTTTTTTTTTT',
];

interface WorldText {
  x: number;
  y: number;
  kind: 'sign' | 'npc';
  speaker: string;
  /** 일본어 원문 */
  text: string;
  /** 한글 음차 — 소리는 처음부터 들린다 */
  phonetic: string;
  meaning: string;
  /** 뜻을 알게 되는 연구 태그 (NPC 대사용 — 간판은 scriptTag로 전체 해금) */
  meaningTag?: string;
  /** 글자를 읽게 되는 연구 태그 (간판은 이것으로 전체 해금) */
  scriptTag?: string;
  /** 간판 픽토그램 — 글자를 몰라도 그림으로 추측 가능 */
  pictogram?: string;
  /** 픽토그램으로 추측한 내용 */
  guess?: string;
  /** 한국어 유사 단어 노트 — 연구 없이도 알아듣는 첫 경험 */
  cognateNote?: string;
  /** NPC 스프라이트 키 */
  sprite?: string;
}

// 마을에 배치된 일본어 — 간판은 "읽기", 대사는 "듣기→뜻→읽기" 단계로 해금된다
const WORLD_TEXTS: WorldText[] = [
  { x: 3,  y: 4,  kind: 'sign', speaker: '간판',   text: 'すし',     phonetic: '스시',     meaning: '초밥',            scriptTag: 'hiragana', pictogram: '🍣', guess: '초밥집인 것 같다' },
  { x: 9,  y: 4,  kind: 'sign', speaker: '간판',   text: 'らーめん', phonetic: '라-멘',    meaning: '라멘 가게',        scriptTag: 'food',     pictogram: '🍜', guess: '라멘 가게인 것 같다' },
  { x: 15, y: 4,  kind: 'sign', speaker: '간판',   text: 'コンビニ', phonetic: '콘비니',   meaning: '편의점',          scriptTag: 'katakana', pictogram: '🏪', guess: '편의점인 것 같다' },
  { x: 20, y: 4,  kind: 'sign', speaker: '표지판', text: '駅',       phonetic: '에키',     meaning: '역',              scriptTag: 'kanji',    pictogram: '🚉', guess: '기차역 표지판인 것 같다' },
  { x: 7,  y: 11, kind: 'sign', speaker: '자판기', text: '500円',    phonetic: '고햐쿠엔', meaning: '500엔 (음료수 가격)', scriptTag: 'numbers',  pictogram: '🥤', guess: '음료수 자판기다. 가격이 적혀 있다' },
  {
    x: 12, y: 7, kind: 'npc', speaker: '마을 사람', sprite: 'npc',
    text: 'こんにちは！', phonetic: '곤니치와!',
    meaning: '안녕하세요! (낮 인사)', meaningTag: 'greetings', scriptTag: 'hiragana',
  },
  {
    x: 10, y: 10, kind: 'npc', speaker: '바쁜 마을 사람', sprite: 'npc2',
    text: 'あした、やくそくが あります。', phonetic: '아시타, 야쿠소쿠가 아리마스.',
    meaning: '내일 약속이 있어요.', meaningTag: 'greetings', scriptTag: 'hiragana',
    cognateNote: "💡 '야쿠소쿠'…? 한국어 '약속'이랑 비슷하게 들린다!",
  },
];

export class WorldScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private playerTile = { x: 12, y: 6 };
  private facing = { x: 0, y: 1 };
  private moving = false;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private actionKeys!: Phaser.Input.Keyboard.Key[];
  private signLabels = new Map<WorldText, Phaser.GameObjects.Text>();
  private blockedCoords = new Set<string>();
  private dialogEl!: HTMLElement;
  private dialogOpen = false;

  constructor(private rs: ResearchSystem) {
    super('world');
  }

  create(): void {
    this.createTextures();
    this.createMap();
    this.createWorldTexts();

    this.player = this.add.sprite(
      this.playerTile.x * TILE + TILE / 2,
      this.playerTile.y * TILE + TILE / 2,
      'player',
    );
    this.player.setDepth(10);

    const cam = this.cameras.main;
    cam.setZoom(2);
    cam.setBounds(0, 0, MAP[0].length * TILE, MAP.length * TILE);
    cam.centerOn((MAP[0].length * TILE) / 2, (MAP.length * TILE) / 2);

    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wasd = {
      up: kb.addKey('W'),
      down: kb.addKey('S'),
      left: kb.addKey('A'),
      right: kb.addKey('D'),
    };
    this.actionKeys = [kb.addKey('SPACE'), kb.addKey('E'), kb.addKey('ENTER')];

    this.dialogEl = document.getElementById('dialog')!;
    this.dialogEl.addEventListener('click', () => this.closeDialog());

    // 연구 완료 → 간판이 읽히게 됨 (핵심 쾌감 포인트)
    this.rs.on('completed', () => this.refreshSignLabels(true));
  }

  update(): void {
    // DOM 패널(연구/퀴즈)이 열려 있으면 월드 입력 정지
    if (document.querySelector('.panel-overlay')) return;

    const actionPressed =
      this.actionKeys.some((k) => Phaser.Input.Keyboard.JustDown(k)) || virtualPad.actionQueued;
    virtualPad.actionQueued = false;

    if (this.dialogOpen) {
      if (actionPressed) this.closeDialog();
      return;
    }
    if (actionPressed) {
      this.tryInteract();
      return;
    }
    if (this.moving) return;

    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown || this.wasd.left.isDown || virtualPad.left) dx = -1;
    else if (this.cursors.right.isDown || this.wasd.right.isDown || virtualPad.right) dx = 1;
    else if (this.cursors.up.isDown || this.wasd.up.isDown || virtualPad.up) dy = -1;
    else if (this.cursors.down.isDown || this.wasd.down.isDown || virtualPad.down) dy = 1;
    if (dx === 0 && dy === 0) return;

    this.facing = { x: dx, y: dy };
    if (dx !== 0) this.player.setFlipX(dx < 0);

    const nx = this.playerTile.x + dx;
    const ny = this.playerTile.y + dy;
    if (this.isBlocked(nx, ny)) return;

    this.moving = true;
    this.playerTile = { x: nx, y: ny };
    this.tweens.add({
      targets: this.player,
      x: nx * TILE + TILE / 2,
      y: ny * TILE + TILE / 2,
      duration: 150,
      onComplete: () => {
        this.moving = false;
      },
    });
  }

  // ---------- 상호작용 ----------

  private tryInteract(): void {
    const tx = this.playerTile.x + this.facing.x;
    const ty = this.playerTile.y + this.facing.y;
    const target = WORLD_TEXTS.find((w) => w.x === tx && w.y === ty);
    if (!target) return;
    if (target.kind === 'npc') this.talkToNpc(target);
    else this.readSign(target);
  }

  /** NPC 대사: 소리는 처음부터 들린다 → 뜻 해금 → 글자 해금 */
  private talkToNpc(t: WorldText): void {
    const meaningKnown = t.meaningTag ? this.rs.isTagUnlocked(t.meaningTag) : true;
    const scriptKnown = t.scriptTag ? this.rs.isTagUnlocked(t.scriptTag) : false;

    speakJa(t.text);

    const main = scriptKnown ? t.text : `“${t.phonetic}”`;
    let sub: string;
    let hint: string | null = null;
    if (meaningKnown) {
      sub = scriptKnown ? `${t.phonetic} — ${t.meaning}` : t.meaning;
    } else {
      sub = '(무슨 뜻인지 모르겠다…)';
      const needed = t.meaningTag ? this.rs.researchForTag(t.meaningTag) : undefined;
      if (needed) hint = `🔬 「${needed.name}」 연구를 완료하면 뜻을 알 수 있다`;
    }
    const cognate = !meaningKnown && t.cognateNote ? t.cognateNote : null;
    this.showDialog(t.speaker, main, sub, hint, t.text, cognate);
  }

  /** 간판: 글자를 알기 전엔 픽토그램으로만 추측 가능 */
  private readSign(t: WorldText): void {
    const known = t.scriptTag ? this.rs.isTagUnlocked(t.scriptTag) : true;
    if (known) {
      this.showDialog(t.speaker, t.text, `${t.phonetic} — ${t.meaning}`, null, t.text, null);
    } else {
      const needed = t.scriptTag ? this.rs.researchForTag(t.scriptTag) : undefined;
      this.showDialog(
        t.speaker,
        `${t.pictogram ?? ''} ???`,
        `글자는 읽을 수 없다…${t.guess ? ` 그림을 보니 ${t.guess}.` : ''}`,
        needed ? `🔬 「${needed.name}」 연구를 완료하면 읽을 수 있다` : null,
        null,
        null,
      );
    }
  }

  private showDialog(
    speaker: string,
    text: string,
    sub: string,
    lockedHint: string | null,
    speakText: string | null,
    cognateNote: string | null,
  ): void {
    this.dialogEl.innerHTML = `
      <div class="speaker">${speaker}</div>
      <div class="text">${text}${speakText && ttsAvailable() ? ' <button class="dialog-speak">🔊</button>' : ''}</div>
      <div class="sub">${sub}</div>
      ${cognateNote ? `<div class="cognate">${cognateNote}</div>` : ''}
      ${lockedHint ? `<div class="locked-hint">${lockedHint}</div>` : ''}
      <div class="close-hint">스페이스/탭으로 닫기</div>
    `;
    const speakBtn = this.dialogEl.querySelector('.dialog-speak');
    if (speakBtn && speakText) {
      speakBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        speakJa(speakText);
      });
    }
    this.dialogEl.classList.remove('hidden');
    this.dialogOpen = true;
  }

  private closeDialog(): void {
    this.dialogEl.classList.add('hidden');
    this.dialogOpen = false;
  }

  // ---------- 월드 구성 ----------

  private isBlocked(x: number, y: number): boolean {
    if (y < 0 || y >= MAP.length || x < 0 || x >= MAP[0].length) return true;
    if (BLOCKED_TILES.has(MAP[y][x])) return true;
    return this.blockedCoords.has(`${x},${y}`);
  }

  private createMap(): void {
    const data = MAP.map((row) => [...row].map((ch) => TILE_INDEX[ch]));
    const map = this.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage('tiles');
    map.createLayer(0, tileset!, 0, 0);
  }

  private createWorldTexts(): void {
    for (const w of WORLD_TEXTS) {
      const px = w.x * TILE + TILE / 2;
      const py = w.y * TILE + TILE / 2;
      this.add.sprite(px, py, w.kind === 'npc' ? (w.sprite ?? 'npc') : 'sign').setDepth(5);
      this.blockedCoords.add(`${w.x},${w.y}`);

      const label = this.add
        .text(px, py - TILE / 2 - 1, '', {
          fontSize: '8px',
          fontFamily: 'sans-serif',
          color: '#ffffff',
          stroke: '#2b2233',
          strokeThickness: 3,
          resolution: 6,
        })
        .setOrigin(0.5, 1)
        .setDepth(20);

      if (w.kind === 'npc') {
        // 말을 걸 수 있다는 표시 — 대사는 소리로 들리므로 ??? 표기는 쓰지 않는다
        label.setText('💬').setFontSize(7);
      } else {
        this.signLabels.set(w, label);
      }
    }
    this.refreshSignLabels(false);
  }

  private refreshSignLabels(celebrate: boolean): void {
    for (const [w, label] of this.signLabels) {
      const unlocked = w.scriptTag ? this.rs.isTagUnlocked(w.scriptTag) : true;
      const next = unlocked ? w.text : `${w.pictogram ?? ''}???`;
      const changed = label.text !== next && label.text !== '';
      label.setText(next);
      label.setColor(unlocked ? '#fff8d8' : '#9aa0b0');

      if (celebrate && changed && unlocked) {
        // 방금 읽을 수 있게 된 간판: 반짝이는 연출
        this.tweens.add({
          targets: label,
          scale: { from: 1.8, to: 1 },
          duration: 500,
          ease: 'Back.easeOut',
        });
      }
    }
  }

  // ---------- 도트 텍스처 (외부 에셋 없이 코드로 생성) ----------

  private createTextures(): void {
    this.makeTilesetTexture();
    this.makeCharacterTexture('player', '#3a6ea8', '#2b2233', '#f2c9a0');
    this.makeCharacterTexture('npc', '#b04a4a', '#5a3a22', '#f2c9a0');
    this.makeCharacterTexture('npc2', '#3f9e54', '#2b2233', '#f2c9a0');
    this.makeSignTexture();
  }

  private px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 1, 1);
  }

  private makeTilesetTexture(): void {
    const tex = this.textures.createCanvas('tiles', TILE * 6, TILE)!;
    const ctx = tex.getContext();

    const fill = (i: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(i * TILE, 0, TILE, TILE);
    };
    const speckle = (i: number, color: string, count: number, seedMul: number) => {
      for (let n = 0; n < count; n++) {
        const sx = (n * seedMul + 3) % TILE;
        const sy = (n * 7 + seedMul) % TILE;
        this.px(ctx, i * TILE + sx, sy, color);
      }
    };

    // 0: 잔디
    fill(0, '#5d9c4f');
    speckle(0, '#4f8a43', 10, 5);
    speckle(0, '#6fae5e', 6, 11);
    // 1: 길
    fill(1, '#cdb98c');
    speckle(1, '#b8a275', 9, 4);
    // 2: 나무 (잔디 위 수풀)
    fill(2, '#5d9c4f');
    ctx.fillStyle = '#2f6b35';
    ctx.fillRect(2 * TILE + 2, 1, 12, 12);
    ctx.fillStyle = '#3d8044';
    ctx.fillRect(2 * TILE + 4, 3, 8, 7);
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(2 * TILE + 7, 12, 2, 4);
    // 3: 물
    fill(3, '#4a7fc1');
    speckle(3, '#6f9fd8', 8, 6);
    // 4: 지붕
    fill(4, '#b8503c');
    ctx.fillStyle = '#a03e2e';
    for (let y = 2; y < TILE; y += 4) ctx.fillRect(4 * TILE, y, TILE, 1);
    // 5: 벽
    fill(5, '#e8dcc0');
    ctx.fillStyle = '#5a4a3a';
    ctx.fillRect(5 * TILE + 2, 4, 4, 4); // 창문
    ctx.fillRect(5 * TILE + 10, 4, 4, 4);
    ctx.fillRect(5 * TILE + 6, 9, 4, 7); // 문

    tex.refresh();
  }

  private makeCharacterTexture(key: string, shirt: string, hair: string, skin: string): void {
    const tex = this.textures.createCanvas(key, TILE, TILE)!;
    const ctx = tex.getContext();
    // 머리
    ctx.fillStyle = hair;
    ctx.fillRect(4, 1, 8, 4);
    // 얼굴
    ctx.fillStyle = skin;
    ctx.fillRect(4, 4, 8, 5);
    ctx.fillStyle = '#2b2233';
    ctx.fillRect(6, 6, 1, 1); // 눈
    ctx.fillRect(9, 6, 1, 1);
    // 몸통
    ctx.fillStyle = shirt;
    ctx.fillRect(4, 9, 8, 4);
    ctx.fillStyle = skin;
    ctx.fillRect(2, 9, 2, 3); // 팔
    ctx.fillRect(12, 9, 2, 3);
    // 다리
    ctx.fillStyle = '#3b3450';
    ctx.fillRect(5, 13, 2, 3);
    ctx.fillRect(9, 13, 2, 3);
    tex.refresh();
  }

  private makeSignTexture(): void {
    const tex = this.textures.createCanvas('sign', TILE, TILE)!;
    const ctx = tex.getContext();
    ctx.fillStyle = '#6b4a2a';
    ctx.fillRect(7, 8, 2, 8); // 기둥
    ctx.fillStyle = '#9c7347';
    ctx.fillRect(2, 2, 12, 7); // 판
    ctx.fillStyle = '#7d5a36';
    ctx.fillRect(3, 3, 10, 5);
    tex.refresh();
  }
}

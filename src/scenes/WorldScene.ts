import Phaser from 'phaser';
import type { ResearchSystem } from '../systems/ResearchSystem';
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
  /** 이 태그의 연구를 완료해야 읽을 수 있다 */
  tag: string;
  text: string;
  reading: string;
  meaning: string;
  speaker: string;
  kind: 'sign' | 'npc';
}

// 마을에 배치된 일본어 텍스트들 — 연구 완료 시 ???가 진짜 글자로 바뀐다
const WORLD_TEXTS: WorldText[] = [
  { x: 3,  y: 4,  tag: 'hiragana', text: 'すし',      reading: '스시 (sushi)',          meaning: '초밥집 간판이다.',          speaker: '간판', kind: 'sign' },
  { x: 9,  y: 4,  tag: 'food',     text: 'らーめん',  reading: '라-멘 (raamen)',        meaning: '라멘 가게 간판이다.',        speaker: '간판', kind: 'sign' },
  { x: 15, y: 4,  tag: 'katakana', text: 'コンビニ',  reading: '콘비니 (konbini)',      meaning: '편의점 간판이다.',          speaker: '간판', kind: 'sign' },
  { x: 20, y: 4,  tag: 'kanji',    text: '駅',        reading: '에키 (eki)',            meaning: '역 표지판이다.',            speaker: '표지판', kind: 'sign' },
  { x: 7,  y: 11, tag: 'numbers',  text: '500円',     reading: '고햐쿠엔 (gohyaku-en)', meaning: '음료수 자판기. 500엔이다.', speaker: '자판기', kind: 'sign' },
  { x: 12, y: 7,  tag: 'greetings', text: 'こんにちは！', reading: '곤니치와! (konnichiwa)', meaning: '"안녕하세요!" 라고 인사했다.', speaker: '마을 사람', kind: 'npc' },
];

export class WorldScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite;
  private playerTile = { x: 12, y: 6 };
  private facing = { x: 0, y: 1 };
  private moving = false;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private actionKeys!: Phaser.Input.Keyboard.Key[];
  private labels = new Map<WorldText, Phaser.GameObjects.Text>();
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
    this.rs.on('completed', () => this.refreshWorldTexts(true));
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

    const unlocked = this.rs.isTagUnlocked(target.tag);
    if (unlocked) {
      this.showDialog(
        target.speaker,
        target.text,
        `${target.reading} — ${target.meaning}`,
        null,
      );
    } else {
      const needed = this.rs.researchForTag(target.tag);
      this.showDialog(
        target.speaker,
        '???',
        target.kind === 'npc' ? '뭐라고 말하는데 알아들을 수 없다…' : '무슨 글자인지 읽을 수 없다…',
        needed ? `🔬 「${needed.name}」 연구를 완료하면 알 수 있다` : null,
      );
    }
  }

  private showDialog(speaker: string, text: string, sub: string, lockedHint: string | null): void {
    this.dialogEl.innerHTML = `
      <div class="speaker">${speaker}</div>
      <div class="text">${text}</div>
      <div class="sub">${sub}</div>
      ${lockedHint ? `<div class="locked-hint">${lockedHint}</div>` : ''}
      <div class="close-hint">스페이스/탭으로 닫기</div>
    `;
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
      this.add.sprite(px, py, w.kind === 'npc' ? 'npc' : 'sign').setDepth(5);
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
      this.labels.set(w, label);
    }
    this.refreshWorldTexts(false);
  }

  private refreshWorldTexts(celebrate: boolean): void {
    for (const [w, label] of this.labels) {
      const unlocked = this.rs.isTagUnlocked(w.tag);
      const next = unlocked ? w.text : '???';
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

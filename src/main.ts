import Phaser from 'phaser';
import './style.css';
import { WorldScene } from './scenes/WorldScene';
import { ResearchSystem } from './systems/ResearchSystem';
import { Hud } from './ui/Hud';
import { ResearchPanel } from './ui/ResearchPanel';
import { QuizPanel } from './ui/QuizPanel';
import { setupTouchControls } from './ui/TouchControls';
import researchJson from './data/ja/research.json';
import problemsJson from './data/ja/problems.json';
import type { ProblemBank, ResearchDef } from './data/types';

const researchDefs = researchJson as ResearchDef[];
const problemBank = problemsJson as ProblemBank;

const rs = new ResearchSystem(researchDefs);
const researchPanel = new ResearchPanel(rs);
const quizPanel = new QuizPanel(rs, problemBank);
new Hud(
  rs,
  () => researchPanel.open(),
  () => quizPanel.open(),
);
setupTouchControls();

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 768,
  height: 512,
  pixelArt: true,
  backgroundColor: '#1a1422',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [new WorldScene(rs)],
});

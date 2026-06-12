import Phaser from 'phaser';
import './style.css';
import { WorldScene } from './scenes/WorldScene';
import { ResearchSystem } from './systems/ResearchSystem';
import { Hud } from './ui/Hud';
import { ResearchPanel } from './ui/ResearchPanel';
import { QuizPanel } from './ui/QuizPanel';
import { SavePanel } from './ui/SavePanel';
import { ScenarioPanel } from './ui/ScenarioPanel';
import { PhonePanel } from './ui/PhonePanel';
import { flags } from './systems/flags';
import scenariosJson from './data/ja/scenarios.json';
import type { ScenarioDef } from './data/types';
import { setupTouchControls } from './ui/TouchControls';
import researchJson from './data/ja/research.json';
import problemsJson from './data/ja/problems.json';
import type { ProblemBank, ResearchDef } from './data/types';

const researchDefs = researchJson as ResearchDef[];
const problemBank = problemsJson as ProblemBank;

const scenarios = scenariosJson as Record<string, ScenarioDef>;

const rs = new ResearchSystem(researchDefs);
const researchPanel = new ResearchPanel(rs);
const quizPanel = new QuizPanel(rs, problemBank);
const savePanel = new SavePanel(rs);
const scenarioPanel = new ScenarioPanel();

const playImmigration = (): void => {
  scenarioPanel.play(scenarios['tokyo-immigration'], () => flags.set('tokyo-arrived'));
};
const phonePanel = new PhonePanel(rs, playImmigration);

new Hud(
  rs,
  () => researchPanel.open(),
  () => quizPanel.open(),
  () => savePanel.open(),
  () => phonePanel.open(),
);
setupTouchControls();

// 첫 방문: 도쿄 입국 심사부터 시작한다
if (!flags.get('tokyo-arrived')) {
  setTimeout(playImmigration, 500);
}

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

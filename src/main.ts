import './style.css';
import { CityGame } from './game/CityGame';
import problemsJson from './data/ja/problems.json';
import researchJson from './data/ja/research.json';
import scenariosJson from './data/ja/scenarios.json';
import type { ProblemBank, ResearchDef, ScenarioDef } from './data/types';
import { flags } from './systems/flags';
import { ResearchSystem } from './systems/ResearchSystem';
import { Hud } from './ui/Hud';
import { PhonePanel } from './ui/PhonePanel';
import { QuizPanel } from './ui/QuizPanel';
import { ResearchPanel } from './ui/ResearchPanel';
import { SavePanel } from './ui/SavePanel';
import { ScenarioPanel } from './ui/ScenarioPanel';

const researchDefs = researchJson as ResearchDef[];
const problemBank = problemsJson as ProblemBank;
const scenarios = scenariosJson as Record<string, ScenarioDef>;

const rs = new ResearchSystem(researchDefs);
const researchPanel = new ResearchPanel(rs);
const quizPanel = new QuizPanel(rs, problemBank);
const savePanel = new SavePanel(rs);
const scenarioPanel = new ScenarioPanel();
const city = new CityGame(rs, scenarios, scenarioPanel);

const playImmigration = (): void => {
  scenarioPanel.play(scenarios['tokyo-immigration'], () => {
    flags.set('tokyo-arrived');
    city.goto('airport');
  });
};
const phonePanel = new PhonePanel(rs, city, playImmigration);

new Hud(
  rs,
  () => researchPanel.open(),
  () => quizPanel.open(),
  () => savePanel.open(),
  () => phonePanel.open(),
);

city.start();

// 첫 방문: 도쿄 입국 심사부터 시작한다
if (!flags.get('tokyo-arrived')) {
  setTimeout(playImmigration, 400);
}

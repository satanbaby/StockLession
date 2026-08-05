/**
 * MDX 課文可以直接使用的元件。
 *
 * 透過 <Content components={MDX_COMPONENTS} /> 注入，所以課文檔案完全不用寫 import ——
 * 二十幾課每篇開頭都貼六行 import 是純粹的雜訊，而且新增元件要逐檔補。
 */

import BearTalk from './bears/BearTalk.astro';
import BearAvatar from './bears/BearAvatar.astro';
import BearScene from './bears/BearScene.astro';
import PriceChart from './charts/PriceChart.astro';
import IndicatorLab from './charts/IndicatorLab.astro';
import CandleAnatomy from './charts/CandleAnatomy.astro';
import CandlePattern from './charts/CandlePattern.astro';
import MacdAnatomy from './charts/MacdAnatomy.astro';
import KdAnatomy from './charts/KdAnatomy.astro';
import KdElevator from './charts/KdElevator.astro';
import ChartFrame from './charts/ChartFrame.astro';
import ParamSweep from './charts/ParamSweep.astro';
import Callout from './learn/Callout.astro';
import FormulaBlock from './learn/FormulaBlock.astro';
import Quiz from './learn/Quiz.astro';
import PatternDrill from './learn/PatternDrill.astro';
import RiskCalculator from './learn/RiskCalculator.astro';
import KeyTakeaways from './learn/KeyTakeaways.astro';

export const MDX_COMPONENTS = {
  BearTalk,
  BearAvatar,
  BearScene,
  PriceChart,
  IndicatorLab,
  CandleAnatomy,
  CandlePattern,
  MacdAnatomy,
  KdAnatomy,
  KdElevator,
  ChartFrame,
  ParamSweep,
  Callout,
  FormulaBlock,
  Quiz,
  PatternDrill,
  RiskCalculator,
  KeyTakeaways,
};

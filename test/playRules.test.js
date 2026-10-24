import test from 'node:test';
import assert from 'node:assert/strict';
import { BOARD } from '../src/scenes/gameLayout.js';
import {
  advanceDropStages,
  drawDropStage,
  getMergeScore,
  hasOpenSpawnPosition,
  isBallBeyondUpperLimit,
  isSpawnBlocked,
  OVERFLOW_GRACE_MS,
  updateOverflowTime,
  updateOverflowTimers,
} from '../src/game/playRules.js';

test('落下段階は1〜5から同じ幅で選ぶ', () => {
  // 抽選の境界値を使い、5段階すべてが選ばれる範囲を確認する。
  const samples = [0, 0.1999, 0.2, 0.4, 0.6, 0.8, 0.9999];
  const stages = samples.map((sample) => drawDropStage(() => sample));

  assert.deepEqual(stages, [1, 1, 2, 3, 4, 5, 5]);
});

test('表示していた次の段階が次回の落下段階になる', () => {
  // 現在を消費し、次を繰り上げてから新しい次を一度だけ抽選する。
  assert.deepEqual(advanceDropStages(2, 5, () => 0.2), {
    droppedStage: 2,
    currentStage: 5,
    nextStage: 2,
  });
});

test('合体の得点は1、3、6から最後の66まで増える', () => {
  // 最終段階同士の消滅も含め、全11段階の配点を確認する。
  const scores = Array.from({ length: 11 }, (_, index) => getMergeScore(index + 1));

  assert.deepEqual(scores, [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 66]);
});

test('上端から戻るとゲームオーバーまでの計時をやり直す', () => {
  // はみ出しが続く間だけ時間を加算し、解消後の再はみ出しは0から数える。
  let elapsed = updateOverflowTime(0, true, 900);
  elapsed = updateOverflowTime(elapsed, false, 500);
  elapsed = updateOverflowTime(elapsed, true, 1000);

  assert.equal(elapsed, 1000);
  assert.ok(elapsed < OVERFLOW_GRACE_MS);
  assert.equal(updateOverflowTime(elapsed, true, 1000), OVERFLOW_GRACE_MS);
});

test('玉の縦の直径の3分の2が上端より外に出た位置を境界とする', () => {
  // 大きさの違う玉について、境界の直前と境界上を比べる。
  for (const radius of [13.5, 37, 106.5]) {
    const centerAtLimit = BOARD.top - radius / 3;

    assert.equal(isBallBeyondUpperLimit(centerAtLimit + 0.01, radius, BOARD.top), false);
    assert.equal(isBallBeyondUpperLimit(centerAtLimit, radius, BOARD.top), true);
  }
});

test('一瞬だけ大きくはみ出した玉は、戻った後に再計時する', () => {
  // 同じ玉が線の内側へ戻れば、以前の経過時間を持ち越さない。
  const body = {};
  const timers = new Map();
  const outside = [{ body, centerY: 145, radius: 37 }];
  const inside = [{ body, centerY: 155, radius: 37 }];

  assert.equal(updateOverflowTimers(timers, outside, BOARD.top, 1000), false);
  assert.equal(updateOverflowTimers(timers, inside, BOARD.top, 1000), false);
  assert.equal(timers.has(body), false);
  assert.equal(updateOverflowTimers(timers, outside, BOARD.top, 1000), false);
  assert.equal(updateOverflowTimers(timers, outside, BOARD.top, 1000), true);
});

test('別の玉へはみ出しが移っても、時間を合算しない', () => {
  // 2個の玉が順に飛び出しても、それぞれが2秒続くまで終了しない。
  const first = {};
  const second = {};
  const timers = new Map();

  assert.equal(updateOverflowTimers(timers, [
    { body: first, centerY: 145, radius: 37 },
    { body: second, centerY: 155, radius: 37 },
  ], BOARD.top, 1000), false);
  assert.equal(updateOverflowTimers(timers, [
    { body: first, centerY: 155, radius: 37 },
    { body: second, centerY: 145, radius: 37 },
  ], BOARD.top, 1000), false);
  assert.equal(timers.has(first), false);
  assert.equal(timers.get(second), 1000);
});

test('合体で消えた玉の計時を破棄する', () => {
  // 消えた玉の時間を新しい玉が引き継がないことを確認する。
  const removed = {};
  const merged = {};
  const timers = new Map();

  updateOverflowTimers(timers, [{ body: removed, centerY: 145, radius: 37 }], BOARD.top, 1000);
  assert.equal(updateOverflowTimers(timers, [
    { body: merged, centerY: 145, radius: 37 },
  ], BOARD.top, 1000), false);
  assert.equal(timers.has(removed), false);
  assert.equal(timers.get(merged), 1000);
});

test('選んだ位置だけが塞がれていても、空き位置を見つけられる', () => {
  // 大きな円の横には置けるが、中心には重なって置けない状態を使う。
  const balls = [{ x: 195, y: 266.5, stage: 11 }];

  assert.equal(isSpawnBlocked(195, BOARD.spawnY, 5, balls), true);
  assert.equal(isSpawnBlocked(45, BOARD.spawnY, 5, balls), false);
  assert.equal(hasOpenSpawnPosition(BOARD.spawnY, 5, balls, BOARD.left, BOARD.right), true);
});

test('左右の空き位置が全て塞がれた状態を検出する', () => {
  // 2個の大きな円で、落下できる横幅全体が埋まる状態を使う。
  const balls = [
    { x: 100, y: 266.5, stage: 11 },
    { x: 290, y: 266.5, stage: 11 },
  ];

  assert.equal(hasOpenSpawnPosition(BOARD.spawnY, 5, balls, BOARD.left, BOARD.right), false);
  assert.equal(hasOpenSpawnPosition(BOARD.spawnY, 5, [], BOARD.left, BOARD.right), true);
});

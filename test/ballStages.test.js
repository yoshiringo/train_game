import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STAGES,
  getMergedStage,
  getStageConfig,
  selectMergePairs,
} from '../src/game/ballStages.js';

test('11段階の半径と最終段階の結果を管理する', () => {
  // 合体で半径が大きくなり、最終段階の次は生成されないことを確認する。
  assert.equal(STAGES.length, 11);
  assert.equal(new Set(STAGES.map(({ color }) => color)).size, 11);
  assert.ok(STAGES.every(({ radius }, index) => index === 0 || radius > STAGES[index - 1].radius));
  assert.equal(getStageConfig(1).radius, 13.5);
  assert.equal(getStageConfig(11).radius, 106.5);

  for (let stage = 1; stage < 11; stage++) {
    assert.equal(getMergedStage(stage), stage + 1);
  }

  assert.equal(getMergedStage(11), null);
});

test('各段階の円の面積比を参考値に近づける', () => {
  // 円の面積は半径の二乗に比例するので、最小段階を基準に比較する。
  const referenceAreas = [1191, 2077, 4046, 5554, 8857, 14085, 18743, 28080, 35166, 52640, 74018];
  const firstRadius = getStageConfig(1).radius;

  for (let index = 0; index < referenceAreas.length; index++) {
    const referenceRatio = referenceAreas[index] / referenceAreas[0];
    const actualRatio = (getStageConfig(index + 1).radius / firstRadius) ** 2;

    assert.ok(Math.abs(actualRatio / referenceRatio - 1) < 0.025);
  }
});

test('3個が同時に接触しても、同じ円を二度使わない', () => {
  // 同じ円を含む複数の接触から、合体に使える一組だけを選ぶ。
  const bodies = [{}, {}, {}];
  const ballsByBody = new Map(bodies.map((body) => [body, { stage: 1 }]));
  const reservedBodies = new Set();
  const pairs = [
    { bodyA: bodies[0], bodyB: bodies[1] },
    { bodyA: bodies[1], bodyB: bodies[2] },
    { bodyA: bodies[0], bodyB: bodies[1] },
  ];

  assert.deepEqual(selectMergePairs(pairs, ballsByBody, reservedBodies), [[bodies[0], bodies[1]]]);
  assert.equal(selectMergePairs(pairs, ballsByBody, reservedBodies).length, 0);
  assert.equal(reservedBodies.size, 2);
});

test('異なる段階を残し、新しい円との連続合体を選べる', () => {
  // 第1段階の合体後にできた第2段階だけが、既存の第2段階と合体する。
  const first = {};
  const second = {};
  const existingSecondStage = {};
  const mergedSecondStage = {};
  const ballsByBody = new Map([
    [first, { stage: 1 }],
    [second, { stage: 1 }],
    [existingSecondStage, { stage: 2 }],
  ]);
  const reservedBodies = new Set();

  assert.deepEqual(selectMergePairs([
    { bodyA: first, bodyB: existingSecondStage },
    { bodyA: first, bodyB: second },
  ], ballsByBody, reservedBodies), [[first, second]]);

  // 物理更新後に合体元を除き、次の段階の円を追加した状態を再現する。
  ballsByBody.delete(first);
  ballsByBody.delete(second);
  ballsByBody.set(mergedSecondStage, { stage: getMergedStage(1) });
  reservedBodies.clear();

  assert.deepEqual(selectMergePairs([
    { bodyA: mergedSecondStage, bodyB: existingSecondStage },
  ], ballsByBody, reservedBodies), [[mergedSecondStage, existingSecondStage]]);
});

test('最終段階同士も一組だけ選び、次の円を作らない', () => {
  // 第11段階の接触を処理対象にし、結果を消滅として扱う。
  const first = {};
  const second = {};
  const ballsByBody = new Map([
    [first, { stage: 11 }],
    [second, { stage: 11 }],
  ]);

  assert.equal(selectMergePairs([
    { bodyA: first, bodyB: second },
  ], ballsByBody, new Set()).length, 1);
  assert.equal(getMergedStage(11), null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { getStageConfig } from '../src/game/ballStages.js';
import { BOARD, GAME_HEIGHT, GAME_WIDTH } from '../src/scenes/gameLayout.js';

test('盤面がスマホの横幅を使い、3段階の円が並ぶ', () => {
  // パイナップル・もも・りんごの直径合計を盤面の幅と比べる。
  const boardWidth = BOARD.right - BOARD.left;
  const totalDiameter = 2 * (
    getStageConfig(9).radius + getStageConfig(8).radius + getStageConfig(6).radius
  );

  assert.equal(GAME_WIDTH, 390);
  assert.equal(boardWidth, 374);
  assert.ok(boardWidth / GAME_WIDTH > 0.95);
  assert.ok(totalDiameter <= boardWidth);
  assert.ok(boardWidth - totalDiameter <= 10);
});

test('盤面の高さと最大の円の直径が参考の比率に近い', () => {
  // 最大の玉の直径に対して、盤面の高さを記事の比率内に収める。
  const boardHeight = BOARD.bottom - BOARD.top;
  const largestDiameter = getStageConfig(11).radius * 2;

  assert.equal(boardHeight, 453);
  assert.equal(GAME_HEIGHT, 700);
  assert.ok(boardHeight / largestDiameter >= 660 / 320);
  assert.ok(boardHeight / largestDiameter <= 700 / 320);
  assert.ok(BOARD.spawnY - getStageConfig(5).radius > BOARD.top);
  assert.ok(BOARD.bottom < GAME_HEIGHT);
});

import { getStageConfig } from './ballStages.js';

export const MAX_DROP_STAGE = 5;
export const OVERFLOW_GRACE_MS = 2000;

const SPAWN_CLEARANCE = 1;

export function drawDropStage(random = Math.random) {
  return Math.floor(random() * MAX_DROP_STAGE) + 1;
}

export function advanceDropStages(currentStage, nextStage, random = Math.random) {
  return {
    droppedStage: currentStage,
    currentStage: nextStage,
    nextStage: drawDropStage(random),
  };
}

export function getMergeScore(stage) {
  return (stage * (stage + 1)) / 2;
}

export function updateOverflowTime(elapsedMs, hasOverflow, deltaMs) {
  return hasOverflow ? elapsedMs + deltaMs : 0;
}

export function isBallBeyondUpperLimit(centerY, radius, boardTop) {
  // 直径の3分の2が上端の線より外に出た位置を境界とする。
  return centerY <= boardTop - radius / 3;
}

export function updateOverflowTimers(timers, balls, boardTop, deltaMs) {
  const activeBodies = new Set();
  let hasTimedOutBall = false;

  // 玉ごとに飛び出した時間を数え、線の内側へ戻った玉は計時を消す。
  for (const { body, centerY, radius } of balls) {
    activeBodies.add(body);

    if (!isBallBeyondUpperLimit(centerY, radius, boardTop)) {
      timers.delete(body);
      continue;
    }

    const elapsedMs = updateOverflowTime(timers.get(body) ?? 0, true, deltaMs);
    timers.set(body, elapsedMs);

    if (elapsedMs >= OVERFLOW_GRACE_MS) {
      hasTimedOutBall = true;
    }
  }

  // 合体などで盤面から消えた玉の計時を残さない。
  for (const body of timers.keys()) {
    if (!activeBodies.has(body)) {
      timers.delete(body);
    }
  }

  return hasTimedOutBall;
}

export function isSpawnBlocked(x, spawnY, stage, balls) {
  const spawnRadius = getStageConfig(stage).radius;

  // 落下予定の円と盤面の円の中心距離から、配置時の重なりを判定する。
  return balls.some(({ x: ballX, y: ballY, stage: ballStage }) => {
    const totalRadius = spawnRadius + getStageConfig(ballStage).radius + SPAWN_CLEARANCE;
    const distanceSquared = (ballX - x) ** 2 + (ballY - spawnY) ** 2;

    return distanceSquared < totalRadius ** 2;
  });
}

export function hasOpenSpawnPosition(spawnY, stage, balls, boardLeft, boardRight) {
  const spawnRadius = getStageConfig(stage).radius;
  const minimumX = boardLeft + spawnRadius;
  const maximumX = boardRight - spawnRadius;
  const blockedIntervals = [];

  // 各円が落下位置を塞ぐ横幅を求め、左から順に空き間を探す。
  for (const { x, y, stage: ballStage } of balls) {
    const totalRadius = spawnRadius + getStageConfig(ballStage).radius + SPAWN_CLEARANCE;
    const verticalDistance = Math.abs(y - spawnY);

    if (verticalDistance >= totalRadius) {
      continue;
    }

    const halfWidth = Math.sqrt(totalRadius ** 2 - verticalDistance ** 2);
    blockedIntervals.push([x - halfWidth, x + halfWidth]);
  }

  blockedIntervals.sort((first, second) => first[0] - second[0]);

  let blockedUntil = minimumX;

  for (const [start, end] of blockedIntervals) {
    if (start > blockedUntil) {
      return true;
    }

    blockedUntil = Math.max(blockedUntil, end);
  }

  return blockedUntil < maximumX;
}

export const STAGES = [
  { radius: 22, color: 0xffd166 },
  { radius: 27, color: 0x8bd17c },
  { radius: 32, color: 0x7ad7e8 },
  { radius: 37, color: 0x9fa8ff },
  { radius: 42, color: 0xd9a6f5 },
  { radius: 47, color: 0xffa8ce },
  { radius: 52, color: 0xffb37a },
  { radius: 58, color: 0xc5de7a },
  { radius: 64, color: 0x76c9b7 },
  { radius: 71, color: 0xe6c17b },
  { radius: 79, color: 0xff8c94 },
];

export function getStageConfig(stage) {
  return STAGES[stage - 1];
}

export function getMergedStage(stage) {
  return stage < STAGES.length ? stage + 1 : null;
}

export function selectMergePairs(pairs, ballsByBody, reservedBodies) {
  const selectedPairs = [];

  // 同時接触では円を一度だけ選び、同じ段階の組だけを合体候補にする。
  for (const { bodyA, bodyB } of pairs) {
    const ballA = ballsByBody.get(bodyA);
    const ballB = ballsByBody.get(bodyB);

    if (!ballA || !ballB || ballA.stage !== ballB.stage
      || reservedBodies.has(bodyA) || reservedBodies.has(bodyB)) {
      continue;
    }

    reservedBodies.add(bodyA);
    reservedBodies.add(bodyB);
    selectedPairs.push([bodyA, bodyB]);
  }

  return selectedPairs;
}

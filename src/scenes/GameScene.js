import Phaser from 'phaser';
import { getMergedStage, getStageConfig, selectMergePairs } from '../game/ballStages.js';
import { BOARD } from './gameLayout.js';
import {
  advanceDropStages,
  drawDropStage,
  getMergeScore,
  hasOpenSpawnPosition,
  isSpawnBlocked,
  updateOverflowTimers,
} from '../game/playRules.js';

const BALL_PHYSICS = {
  bounce: 0.1,
  friction: 0.12,
  airResistance: 0,
  staticFriction: 0.6,
};

const BOARD_CENTER_X = (BOARD.left + BOARD.right) / 2;
const NEXT_PREVIEW_X = 320;
const NEXT_PREVIEW_Y = 104;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    // プレイごとに得点と現在・次の段階を初期化する。
    this.score = 0;
    this.currentStage = drawDropStage();
    this.nextStage = drawDropStage();
    this.overflowTimes = new Map();
    this.isGameOver = false;
    this.nextBallTimer = null;

    // プレイ領域を描き、同じ境界に固定壁と床を配置する。
    this.createBoard();

    this.add.text(BOARD_CENTER_X, 28, '電車ゲーム', {
      fontFamily: 'sans-serif',
      fontSize: '28px',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.scoreText = this.add.text(24, 100, 'スコア 0', {
      fontFamily: 'sans-serif',
      fontSize: '23px',
      color: '#ffffff',
    }).setOrigin(0, 0.5);
    this.add.text(NEXT_PREVIEW_X, 58, 'つぎ', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#bfd5e3',
    }).setOrigin(0.5);
    this.nextBallPreview = this.createNextBallPreview(this.nextStage);

    this.add.text(BOARD_CENTER_X, 145, '指で左右に動かして、離して落とす', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#bfd5e3',
    }).setOrigin(0.5);

    // 抽選した現在の円と落下ガイドを中央に表示する。
    this.guide = this.add.graphics().setDepth(1);
    this.previewBall = this.createBallVisual(BOARD_CENTER_X, BOARD.spawnY, this.currentStage)
      .setDepth(3);
    this.statusText = this.add.text(BOARD_CENTER_X, 650, 'プレイ領域をタッチ', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.aimX = BOARD_CENTER_X;
    this.activePointerId = null;
    this.activeDropBody = null;
    this.ballsByBody = new Map();
    this.reservedMergeBodies = new Set();
    this.pendingMergePairs = [];
    this.isReady = true;
    this.drawGuide();

    // 一つの指で落下位置を決め、衝突した後だけ次の円を用意する。
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('pointerupoutside', this.handlePointerUpOutside, this);
    this.matter.world.on('collisionstart', this.handleCollisionStart, this);
  }

  createBoard() {
    const wallHeight = BOARD.bottom - BOARD.top + BOARD.wallThickness;
    const wallY = (BOARD.top + BOARD.bottom) / 2;
    const floorY = BOARD.bottom + BOARD.wallThickness / 2;

    // 上部を開いた箱として描き、円の動く範囲を分かりやすくする。
    const board = this.add.graphics();
    board.fillStyle(0x263b54);
    board.fillRect(BOARD.left, BOARD.top, BOARD.right - BOARD.left, BOARD.bottom - BOARD.top);
    board.lineStyle(4, 0x73a7c5);
    board.lineBetween(BOARD.left, BOARD.top, BOARD.left, BOARD.bottom);
    board.lineBetween(BOARD.right, BOARD.top, BOARD.right, BOARD.bottom);
    board.lineBetween(BOARD.left, BOARD.bottom, BOARD.right, BOARD.bottom);
    board.lineStyle(2, 0xffa36e, 0.8);
    board.lineBetween(BOARD.left, BOARD.top, BOARD.right, BOARD.top);

    // 見た目の壁と床の外側に静的な物理ボディを重ねる。
    this.leftWallBody = this.matter.add.rectangle(
      BOARD.left - BOARD.wallThickness / 2,
      wallY,
      BOARD.wallThickness,
      wallHeight,
      { isStatic: true },
    );
    this.rightWallBody = this.matter.add.rectangle(
      BOARD.right + BOARD.wallThickness / 2,
      wallY,
      BOARD.wallThickness,
      wallHeight,
      { isStatic: true },
    );
    this.floorBody = this.matter.add.rectangle(
      BOARD_CENTER_X,
      floorY,
      BOARD.right - BOARD.left + BOARD.wallThickness * 2,
      BOARD.wallThickness,
      { isStatic: true },
    );

    // 静的ボディ作成後に床の摩擦を消し、円の横移動を減速させない。
    this.floorBody.friction = 0;
  }

  update(_time, delta) {
    // 玉ごとに上端から大きくはみ出した時間を数え、2秒続いたら終了する。
    if (this.isGameOver) {
      return;
    }

    const balls = Array.from(this.ballsByBody, ([body, { stage }]) => ({
      body,
      centerY: body.position.y,
      radius: getStageConfig(stage).radius,
    }));

    if (updateOverflowTimers(this.overflowTimes, balls, BOARD.top, delta)) {
      this.endGame('上までいっぱいです');
    }
  }

  handlePointerDown(pointer) {
    // 次の円が待機中で、プレイ領域に触れた時だけ操作を開始する。
    const isInsideBoard = pointer.x >= BOARD.left && pointer.x <= BOARD.right
      && pointer.y >= BOARD.top && pointer.y <= BOARD.bottom;

    if (!this.isReady || this.activePointerId !== null || !isInsideBoard) {
      return;
    }

    this.activePointerId = pointer.id;
    this.updateAim(pointer.x);
    this.statusText.setText('指を離すと落下');
  }

  handlePointerMove(pointer) {
    // 操作を始めた指だけを追跡し、別の指やマウスの移動は無視する。
    if (pointer.id !== this.activePointerId || !pointer.isDown) {
      return;
    }

    this.updateAim(pointer.x);
  }

  handlePointerUp(pointer) {
    // 操作していた指の終了だけを受け付け、OSによる取り消しは落下させない。
    if (pointer.id !== this.activePointerId) {
      return;
    }

    if (pointer.wasCanceled) {
      this.cancelAim();
      return;
    }

    // 通常の指離しでは最後の位置を反映して円を落とす。
    this.updateAim(pointer.x);
    this.activePointerId = null;
    this.dropBall();
  }

  handlePointerUpOutside(pointer) {
    // 画面外で指を離した時は操作を取り消す。
    if (pointer.id !== this.activePointerId) {
      return;
    }

    this.cancelAim();
  }

  cancelAim() {
    // 待機中の円を残したまま、次のタッチを受け付ける状態へ戻す。
    this.activePointerId = null;
    this.statusText.setText('プレイ領域をタッチ');
  }

  updateAim(pointerX) {
    // 円の半径を考慮して位置を制限し、待機中の円とガイドを合わせる。
    const radius = getStageConfig(this.currentStage).radius;
    this.aimX = Phaser.Math.Clamp(
      pointerX,
      BOARD.left + radius,
      BOARD.right - radius,
    );
    this.previewBall.x = this.aimX;
    this.drawGuide();
  }

  drawGuide() {
    // 円の中心から床までの線を、待機中だけ表示する。
    const radius = getStageConfig(this.currentStage).radius;
    this.guide.clear();
    this.guide.lineStyle(2, 0xffffff, 0.35);
    this.guide.lineBetween(
      this.aimX,
      BOARD.spawnY + radius,
      this.aimX,
      BOARD.bottom,
    );
  }

  getBoardBalls() {
    // 画面に依存しない配置判定へ、盤面の円の位置と段階だけを渡す。
    return Array.from(this.ballsByBody, ([body, { stage }]) => ({
      x: body.position.x,
      y: body.position.y,
      stage,
    }));
  }

  canPlaceCurrentBallAnywhere() {
    // 現在の段階を置ける場所が残っているか、盤面全体を調べる。
    return hasOpenSpawnPosition(
      BOARD.spawnY,
      this.currentStage,
      this.getBoardBalls(),
      BOARD.left,
      BOARD.right,
    );
  }

  dropBall() {
    // 選んだ位置が塞がれている時は、別の位置を選べる状態を保つ。
    if (isSpawnBlocked(this.aimX, BOARD.spawnY, this.currentStage, this.getBoardBalls())) {
      if (!this.canPlaceCurrentBallAnywhere()) {
        this.endGame('置ける場所がありません');
      } else {
        this.statusText.setText('別の位置を選んでね');
      }

      return;
    }

    // 待機中の表示を消し、円を落下させる。
    this.isReady = false;
    this.guide.clear();
    this.statusText.setText('次の円を準備中');

    const upcomingStages = advanceDropStages(this.currentStage, this.nextStage);
    const body = this.createBall(this.aimX, BOARD.spawnY, upcomingStages.droppedStage);
    this.activeDropBody = body;

    // 表示していた次の段階を繰り上げ、新しい次の円を抽選する。
    this.currentStage = upcomingStages.currentStage;
    this.nextStage = upcomingStages.nextStage;
    this.previewBall.destroy();
    this.previewBall = this.createBallVisual(this.aimX, BOARD.spawnY, this.currentStage)
      .setDepth(3)
      .setVisible(false);
    this.aimX = Phaser.Math.Clamp(
      this.aimX,
      BOARD.left + getStageConfig(this.currentStage).radius,
      BOARD.right - getStageConfig(this.currentStage).radius,
    );
    this.previewBall.x = this.aimX;
    this.nextBallPreview.destroy();
    this.nextBallPreview = this.createNextBallPreview(this.nextStage);
  }

  createNextBallPreview(stage) {
    // 小さい段階でも番号が読める大きさを保ち、次の円を見出し内へ収める。
    const radius = getStageConfig(stage).radius;
    const scale = Math.max(0.7, 15 / radius);

    return this.createBallVisual(NEXT_PREVIEW_X, NEXT_PREVIEW_Y, stage).setScale(scale);
  }

  createBallVisual(x, y, stage) {
    // 仮色と段階番号を一つの表示にまとめ、物理ボディと同じ中心で動かす。
    const { radius, color } = getStageConfig(stage);
    const circle = this.add.circle(0, 0, radius, color).setStrokeStyle(2, 0xffffff);
    const label = this.add.text(0, 0, String(stage), {
      fontFamily: 'sans-serif',
      fontSize: `${Math.min(32, radius)}px`,
      color: '#ffffff',
      stroke: '#162438',
      strokeThickness: Math.min(4, radius / 5),
    }).setOrigin(0.5);

    return this.add.container(x, y, [circle, label]).setSize(radius * 2, radius * 2);
  }

  createBall(x, y, stage) {
    const radius = getStageConfig(stage).radius;
    const ball = this.createBallVisual(x, y, stage).setDepth(2);

    // 床に接する辺が左右対称になる24角形を使い、着地時の片寄りを防ぐ。
    this.matter.add.gameObject(ball, {
      shape: { type: 'polygon', sides: BOARD.ballBodySides, radius },
    });

    // 円同士の摩擦は残し、空気抵抗による横方向の減速をなくす。
    ball.setBounce(BALL_PHYSICS.bounce);
    ball.setFriction(
      BALL_PHYSICS.friction,
      BALL_PHYSICS.airResistance,
      BALL_PHYSICS.staticFriction,
    );
    this.ballsByBody.set(ball.body, { stage, ball });

    return ball.body;
  }

  handleCollisionStart(event) {
    // 壁に当たった円だけ横移動と回転を止め、跳ね返りを防ぐ。
    this.stopBallsAtWalls(event.pairs);

    // 合体で円が消える前に、今落とした円の初回接触を判定する。
    if (this.activeDropBody) {
      const touchedFloorOrBall = event.pairs.some(({ bodyA, bodyB }) => {
        const otherBody = bodyA === this.activeDropBody
          ? bodyB
          : bodyB === this.activeDropBody ? bodyA : null;

        return otherBody === this.floorBody || this.ballsByBody.has(otherBody);
      });

      if (touchedFloorOrBall) {
        this.activeDropBody = null;
        this.nextBallTimer = this.time.delayedCall(
          BOARD.nextBallDelay,
          this.showNextBall,
          [],
          this,
        );
      }
    }

    // 同じ円を複数の組に使わず、物理更新後にまとめて合体させる。
    const mergePairs = selectMergePairs(
      event.pairs,
      this.ballsByBody,
      this.reservedMergeBodies,
    );
    this.pendingMergePairs.push(...mergePairs);

    if (mergePairs.length > 0 && this.pendingMergePairs.length === mergePairs.length) {
      this.events.once(Phaser.Scenes.Events.POST_UPDATE, this.resolvePendingMerges, this);
    }
  }

  stopBallsAtWalls(pairs) {
    // 円と左右どちらかの壁の接触だけを処理し、縦方向の落下速度は保つ。
    for (const { bodyA, bodyB } of pairs) {
      let ballBody;

      if (bodyA === this.leftWallBody || bodyA === this.rightWallBody) {
        ballBody = bodyB;
      } else if (bodyB === this.leftWallBody || bodyB === this.rightWallBody) {
        ballBody = bodyA;
      }

      if (!this.ballsByBody.has(ballBody)) {
        continue;
      }

      ballBody.gameObject.setVelocityX(0).setAngularVelocity(0);
    }
  }

  resolvePendingMerges() {
    if (this.isGameOver) {
      this.pendingMergePairs = [];
      this.reservedMergeBodies.clear();
      return;
    }

    // 物理更新が終わってから元の2個を除き、次の段階を中間位置に作る。
    for (const [bodyA, bodyB] of this.pendingMergePairs) {
      const ballA = this.ballsByBody.get(bodyA);
      const ballB = this.ballsByBody.get(bodyB);

      if (!ballA || !ballB) {
        continue;
      }

      const nextStage = getMergedStage(ballA.stage);
      const x = (bodyA.position.x + bodyB.position.x) / 2;
      const y = (bodyA.position.y + bodyB.position.y) / 2;
      this.removeBall(bodyA);
      this.removeBall(bodyB);

      // 最終段階同士が消える場合も、その合体分の得点を加える。
      this.score += getMergeScore(ballA.stage);
      this.scoreText.setText(`スコア ${this.score}`);

      if (nextStage !== null) {
        const { radius } = getStageConfig(nextStage);
        this.createBall(
          Phaser.Math.Clamp(x, BOARD.left + radius, BOARD.right - radius),
          Phaser.Math.Clamp(y, BOARD.top + radius, BOARD.bottom - radius),
          nextStage,
        );
      }
    }

    this.pendingMergePairs = [];
    this.reservedMergeBodies.clear();
  }

  removeBall(body) {
    // 合体元の表示と物理ボディを両方除き、衝突対象から外す。
    const { ball } = this.ballsByBody.get(body);
    this.ballsByBody.delete(body);
    this.overflowTimes.delete(body);
    this.matter.world.remove(body);
    ball.destroy();
  }

  showNextBall() {
    // 次の円を操作可能にする前に、置ける位置が残っているか確認する。
    this.nextBallTimer = null;

    if (this.isGameOver) {
      return;
    }

    if (!this.canPlaceCurrentBallAnywhere()) {
      this.endGame('置ける場所がありません');
      return;
    }

    // 落下中の操作を終え、現在の円とガイドを表示する。
    this.previewBall.setVisible(true);
    this.drawGuide();
    const blockedAtCurrentAim = isSpawnBlocked(
      this.aimX,
      BOARD.spawnY,
      this.currentStage,
      this.getBoardBalls(),
    );
    this.statusText.setText(blockedAtCurrentAim ? '別の位置を選んでね' : 'プレイ領域をタッチ');
    this.isReady = true;
  }

  endGame(reason) {
    // 終了時は落下操作と物理演算を止め、最終得点を固定する。
    if (this.isGameOver) {
      return;
    }

    this.isGameOver = true;
    this.isReady = false;
    this.activePointerId = null;
    this.previewBall.setVisible(false);
    this.guide.clear();
    this.statusText.setText('ゲーム終了');
    this.nextBallTimer?.remove();
    this.nextBallTimer = null;
    this.matter.world.pause();

    // 終了理由と得点を表示し、ボタンから新しいプレイを始められるようにする。
    this.add.rectangle(BOARD_CENTER_X, 430, 300, 230, 0x162438, 0.95)
      .setStrokeStyle(3, 0x73a7c5)
      .setDepth(10);
    this.add.text(BOARD_CENTER_X, 364, 'ゲームオーバー', {
      fontFamily: 'sans-serif',
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(11);
    this.add.text(BOARD_CENTER_X, 402, reason, {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#bfd5e3',
    }).setOrigin(0.5).setDepth(11);
    this.add.text(BOARD_CENTER_X, 439, `スコア ${this.score}`, {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(11);
    this.add.rectangle(BOARD_CENTER_X, 500, 180, 52, 0x73a7c5)
      .setDepth(11)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.scene.restart());
    this.add.text(BOARD_CENTER_X, 500, 'もう一度', {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      color: '#162438',
    }).setOrigin(0.5).setDepth(12);
  }
}

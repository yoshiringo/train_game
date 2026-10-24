import Phaser from 'phaser';

const BOARD = {
  left: 24,
  right: 366,
  top: 185,
  bottom: 755,
  wallThickness: 16,
  ballRadius: 22,
  ballBodySides: 24,
  spawnY: 215,
  nextBallDelay: 250,
};

const BALL_PHYSICS = {
  bounce: 0.1,
  friction: 0.12,
  airResistance: 0,
  staticFriction: 0.6,
};

const BOARD_CENTER_X = (BOARD.left + BOARD.right) / 2;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    // プレイ領域を描き、同じ境界に固定壁と床を配置する。
    this.createBoard();

    this.add.text(BOARD_CENTER_X, 86, '電車ゲーム', {
      fontFamily: 'sans-serif',
      fontSize: '36px',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.add.text(BOARD_CENTER_X, 130, '指で左右に動かして、離して落とす', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#bfd5e3',
    }).setOrigin(0.5);

    // 待機中の円と落下ガイドを用意し、最初の円を中央に表示する。
    this.guide = this.add.graphics().setDepth(1);
    this.previewBall = this.add.circle(BOARD_CENTER_X, BOARD.spawnY, BOARD.ballRadius, 0xffd166)
      .setStrokeStyle(2, 0xffffff)
      .setDepth(3);
    this.statusText = this.add.text(BOARD_CENTER_X, 787, 'プレイ領域をタッチ', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.aimX = BOARD_CENTER_X;
    this.activePointerId = null;
    this.activeDropBody = null;
    this.ballBodies = new Set();
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
    this.aimX = Phaser.Math.Clamp(
      pointerX,
      BOARD.left + BOARD.ballRadius,
      BOARD.right - BOARD.ballRadius,
    );
    this.previewBall.x = this.aimX;
    this.drawGuide();
  }

  drawGuide() {
    // 円の中心から床までの線を、待機中だけ表示する。
    this.guide.clear();
    this.guide.lineStyle(2, 0xffffff, 0.35);
    this.guide.lineBetween(
      this.aimX,
      BOARD.spawnY + BOARD.ballRadius,
      this.aimX,
      BOARD.bottom,
    );
  }

  isSpawnBlocked() {
    // 新しい円の中心と落下済みの円の中心が、直径より近ければ配置できない。
    const minimumDistanceSquared = (BOARD.ballRadius * 2) ** 2;

    for (const body of this.ballBodies) {
      const horizontalDistance = body.position.x - this.aimX;
      const verticalDistance = body.position.y - BOARD.spawnY;
      const distanceSquared = horizontalDistance ** 2 + verticalDistance ** 2;

      if (distanceSquared < minimumDistanceSquared) {
        return true;
      }
    }

    return false;
  }

  dropBall() {
    // 重なる位置を選んだ時は、仮の終了画面で再開を案内する。
    if (this.isSpawnBlocked()) {
      this.showTemporaryGameOver();
      return;
    }

    // 待機中の表示を消し、円を落下させる。
    this.isReady = false;
    this.previewBall.setVisible(false);
    this.guide.clear();
    this.statusText.setText('次の円を準備中');

    const ball = this.add.circle(this.aimX, BOARD.spawnY, BOARD.ballRadius, 0xffd166)
      .setStrokeStyle(2, 0xffffff)
      .setDepth(2);

    // 床に接する辺が左右対称になる24角形を使い、着地時の片寄りを防ぐ。
    this.matter.add.gameObject(ball, {
      shape: { type: 'polygon', sides: BOARD.ballBodySides, radius: BOARD.ballRadius },
    });

    // 円同士の摩擦は残し、空気抵抗による横方向の減速をなくす。
    ball.setBounce(BALL_PHYSICS.bounce);
    ball.setFriction(
      BALL_PHYSICS.friction,
      BALL_PHYSICS.airResistance,
      BALL_PHYSICS.staticFriction,
    );
    this.activeDropBody = ball.body;
    this.ballBodies.add(ball.body);
  }

  handleCollisionStart(event) {
    // 壁に当たった円だけ横移動と回転を止め、跳ね返りを防ぐ。
    this.stopBallsAtWalls(event.pairs);

    // 今落とした円が床か別の円に初めて触れた時だけ、次の円を予約する。
    if (!this.activeDropBody) {
      return;
    }

    const touchedFloorOrBall = event.pairs.some(({ bodyA, bodyB }) => {
      const otherBody = bodyA === this.activeDropBody
        ? bodyB
        : bodyB === this.activeDropBody ? bodyA : null;

      return otherBody === this.floorBody || this.ballBodies.has(otherBody);
    });

    if (!touchedFloorOrBall) {
      return;
    }

    this.activeDropBody = null;
    this.time.delayedCall(BOARD.nextBallDelay, this.showNextBall, [], this);
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

      if (!this.ballBodies.has(ballBody)) {
        continue;
      }

      ballBody.gameObject.setVelocityX(0).setAngularVelocity(0);
    }
  }

  showNextBall() {
    // 落下中の操作を終え、同じ位置に次の円とガイドを表示する。
    this.previewBall.setVisible(true);
    this.drawGuide();
    this.statusText.setText('プレイ領域をタッチ');
    this.isReady = true;
  }

  showTemporaryGameOver() {
    // 円が重なる位置では操作を止め、リトライできる仮の表示を出す。
    this.isReady = false;
    this.previewBall.setVisible(false);
    this.guide.clear();
    this.statusText.setText('ゲーム終了');

    this.add.rectangle(BOARD_CENTER_X, 430, 280, 180, 0x162438, 0.95)
      .setStrokeStyle(3, 0x73a7c5)
      .setDepth(10);
    this.add.text(BOARD_CENTER_X, 390, '円を置けません', {
      fontFamily: 'sans-serif',
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(11);
    this.add.rectangle(BOARD_CENTER_X, 455, 180, 52, 0x73a7c5)
      .setDepth(11)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.scene.restart());
    this.add.text(BOARD_CENTER_X, 455, 'もう一度', {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      color: '#162438',
    }).setOrigin(0.5).setDepth(12);
  }
}

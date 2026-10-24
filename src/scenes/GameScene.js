import Phaser from 'phaser';

const BOARD = {
  left: 24,
  right: 366,
  top: 185,
  bottom: 755,
  wallThickness: 16,
  ballRadius: 22,
  spawnY: 215,
  nextBallDelay: 600,
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
    this.isReady = true;
    this.drawGuide();

    // 一つの指だけで位置を調整し、画面内で離した時に円を落とす。
    this.input.on('pointerdown', this.handlePointerDown, this);
    this.input.on('pointermove', this.handlePointerMove, this);
    this.input.on('pointerup', this.handlePointerUp, this);
    this.input.on('pointerupoutside', this.handlePointerUpOutside, this);
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
    this.matter.add.rectangle(
      BOARD.left - BOARD.wallThickness / 2,
      wallY,
      BOARD.wallThickness,
      wallHeight,
      { isStatic: true },
    );
    this.matter.add.rectangle(
      BOARD.right + BOARD.wallThickness / 2,
      wallY,
      BOARD.wallThickness,
      wallHeight,
      { isStatic: true },
    );
    this.matter.add.rectangle(
      BOARD_CENTER_X,
      floorY,
      BOARD.right - BOARD.left + BOARD.wallThickness * 2,
      BOARD.wallThickness,
      { isStatic: true },
    );
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
    // 操作を始めた指を画面内で離した時、その位置から円を落とす。
    if (pointer.id !== this.activePointerId) {
      return;
    }

    this.updateAim(pointer.x);
    this.activePointerId = null;
    this.dropBall();
  }

  handlePointerUpOutside(pointer) {
    // 画面外で指を離した場合は誤落下を防ぎ、待機状態へ戻す。
    if (pointer.id !== this.activePointerId) {
      return;
    }

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

  dropBall() {
    // 表示用の円に丸いMatterボディを付け、重力で落下させる。
    this.isReady = false;
    this.previewBall.setVisible(false);
    this.guide.clear();
    this.statusText.setText('次の円を準備中');

    const ball = this.add.circle(this.aimX, BOARD.spawnY, BOARD.ballRadius, 0xffd166)
      .setStrokeStyle(2, 0xffffff)
      .setDepth(2);
    this.matter.add.gameObject(ball, {
      shape: { type: 'circle', radius: BOARD.ballRadius },
    });

    // 仮の待ち時間の後、同じ位置に次の円を待機させる。
    this.time.delayedCall(BOARD.nextBallDelay, () => {
      this.previewBall.setVisible(true);
      this.drawGuide();
      this.statusText.setText('プレイ領域をタッチ');
      this.isReady = true;
    });
  }
}

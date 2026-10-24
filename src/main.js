import Phaser from 'phaser';
import './style.css';

const GAME_WIDTH = 390;
const GAME_HEIGHT = 844;

class StartScene extends Phaser.Scene {
  constructor() {
    super('StartScene');
  }

  create() {
    // 仮のプレイ領域を描き、スマートフォンでの表示範囲を確認できるようにする。
    this.add.rectangle(GAME_WIDTH / 2, 470, 342, 570, 0x263b54)
      .setStrokeStyle(3, 0x73a7c5);

    this.add.text(GAME_WIDTH / 2, 88, '電車ゲーム', {
      fontFamily: 'sans-serif',
      fontSize: '36px',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 132, '開発準備中', {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      color: '#bfd5e3',
    }).setOrigin(0.5);

    // タッチした位置と入力結果を表示し、実機で操作が届くか確認する。
    this.touchMarker = this.add.circle(0, 0, 18, 0xffd166).setVisible(false);
    this.touchStatus = this.add.text(GAME_WIDTH / 2, 770, '画面をタッチしてください', {
      fontFamily: 'sans-serif',
      fontSize: '18px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // 押した位置を表示し、押したまま動かした場合も追従させる。
    this.input.on('pointerdown', (pointer) => this.showTouch(pointer));
    this.input.on('pointermove', (pointer) => {
      if (pointer.isDown) {
        this.showTouch(pointer);
      }
    });
  }

  showTouch(pointer) {
    // 入力位置を示す仮マーカーを更新する。
    this.touchMarker.setPosition(pointer.x, pointer.y).setVisible(true);
    this.touchStatus.setText('タッチを確認しました');
  }
}

// ゲームの表示領域と、後続の試作で使うMatter物理演算を設定する。
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#162438',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'matter',
    matter: {
      debug: false,
    },
  },
  scene: StartScene,
});

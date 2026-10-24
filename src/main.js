import Phaser from 'phaser';
import GameScene from './scenes/GameScene.js';
import './style.css';

// 縦画面の表示サイズと、落下に使うMatter物理演算を設定する。
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 390,
  height: 844,
  backgroundColor: '#162438',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'matter',
    matter: {
      debug: false,
      enableSleeping: false,
      gravity: { y: 1.1 },
    },
  },
  scene: GameScene,
});

# 開発・確認コマンド

プロジェクトのフォルダ `C:\dev\train_game` で、PowerShellから実行します。

## 依存関係のインストール
初回セットアップ時に実行
npm install

## 開発サーバーの起動
PCのブラウザで `http://localhost:5173/` を開く。終了するときは `Ctrl+C` を押下
npm run dev

## iPhoneから動作確認
PCとiPhoneを同じWi-Fiに接続し、次のコマンドでサーバーを起動します。PCのIPv4アドレスを使い、iPhoneのSafariで `http://<PCのIPv4アドレス>:5173/` を開きます。
npm run dev -- --host 0.0.0.0

PCのIPv4アドレスは、別のPowerShellで次を実行して確認
ipconfig

## 本番ビルド
公開用ファイルを `dist/` に生成します。ビルド後も開発サーバーを起動する場合は、別のPowerShellを開いて実行します。
npm run build

## 合体ルールのテスト
段階の進化、同時接触、連続合体の判定を確認します。
npm test

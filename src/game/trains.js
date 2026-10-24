import yamanoteImage from '../assets/trains/山手線.png';
import keihinTohokuImage from '../assets/trains/京浜東北線.png';
import saikyoImage from '../assets/trains/埼京線.png';
import uenoTokyoImage from '../assets/trains/上野東京ライン.png';
import sotetsuImage from '../assets/trains/相鉄線.png';
import naritaExpressImage from '../assets/trains/成田エクスプレス.png';
import genbiShinkansenImage from '../assets/trains/現美新幹線.png';
import komachiImage from '../assets/trains/こまち.png';
import hayabusaImage from '../assets/trains/はやぶさ.png';
import kagayakiImage from '../assets/trains/かがやき.png';
import rinkaiImage from '../assets/trains/りんかい線.png';

// 電車の識別子と画像を段階から独立させ、並び替え時は順序だけを変更できるようにする。
export const TRAINS = {
  yamanote: { name: '山手線', imageUrl: yamanoteImage },
  keihinTohoku: { name: '京浜東北線', imageUrl: keihinTohokuImage },
  saikyo: { name: '埼京線', imageUrl: saikyoImage },
  uenoTokyo: { name: '上野東京ライン', imageUrl: uenoTokyoImage },
  sotetsu: { name: '相鉄線', imageUrl: sotetsuImage },
  naritaExpress: { name: '成田エクスプレス', imageUrl: naritaExpressImage },
  genbiShinkansen: { name: '現美新幹線', imageUrl: genbiShinkansenImage },
  komachi: { name: 'こまち', imageUrl: komachiImage },
  hayabusa: { name: 'はやぶさ', imageUrl: hayabusaImage },
  kagayaki: { name: 'かがやき', imageUrl: kagayakiImage },
  rinkai: { name: 'りんかい線', imageUrl: rinkaiImage },
};

export const DEFAULT_TRAIN_ORDER = [
  'yamanote',
  'keihinTohoku',
  'saikyo',
  'uenoTokyo',
  'sotetsu',
  'naritaExpress',
  'genbiShinkansen',
  'komachi',
  'hayabusa',
  'kagayaki',
  'rinkai',
];

export function getTrainIdForStage(stage, order = DEFAULT_TRAIN_ORDER) {
  return order[stage - 1];
}

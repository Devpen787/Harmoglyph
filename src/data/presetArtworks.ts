import birthdayArt from '../assets/images/art_happy_birthday_1794853913141.jpg';
import classicalArt from '../assets/images/art_fur_elise_1794853913123.jpg';
import spookyArt from '../assets/images/art_spooky_arpeggio_1794853913916.jpg';
import spiralArt from '../assets/images/art_harmonic_spiral_1794853913734.jpg';
import { SheetPreset } from '../types/chimera';

export const PRESET_ARTWORK_URLS: Record<SheetPreset['artworkKey'], string> = {
  birthday: birthdayArt,
  classical: classicalArt,
  spooky: spookyArt,
  spiral: spiralArt,
};

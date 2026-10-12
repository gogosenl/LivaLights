import { useEffect } from 'react';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';

const MUSIC = require('../assets/audio/garden-ambience.wav');
const TAP = require('../assets/audio/tap.mp3');
const PLACE = require('../assets/audio/lantern-place.wav');
const REMOVE = require('../assets/audio/lantern-remove.wav');
const LINE_COMPLETE = require('../assets/audio/line-complete.wav');
const HINT = require('../assets/audio/hint.mp3');
const SUCCESS = require('../assets/audio/success.mp3');
const UNLOCK = require('../assets/audio/layer-unlock.mp3');

export function useGameAudio(settings) {
  const music = useAudioPlayer(MUSIC);
  const tap = useAudioPlayer(TAP);
  const place = useAudioPlayer(PLACE);
  const remove = useAudioPlayer(REMOVE);
  const lineComplete = useAudioPlayer(LINE_COMPLETE);
  const hint = useAudioPlayer(HINT);
  const success = useAudioPlayer(SUCCESS);
  const unlock = useAudioPlayer(UNLOCK);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
  }, []);

  useEffect(() => {
    music.loop = true;
    music.volume = 0.1;
    if (settings?.music) music.play(); else music.pause();
  }, [music, settings?.music]);

  const replay = (player, volume = 0.55) => {
    if (!settings?.sound) return;
    player.volume = volume;
    player.seekTo(0);
    player.play();
  };

  return {
    tap: () => replay(tap, 0.26),
    place: () => replay(place, 0.34),
    remove: () => replay(remove, 0.24),
    line: () => replay(lineComplete, 0.3),
    hint: () => replay(hint, 0.34),
    success: () => replay(success, 0.46),
    unlock: () => replay(unlock, 0.44)
  };
}

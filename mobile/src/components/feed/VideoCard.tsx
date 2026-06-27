import { useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import CardOverlay from './CardOverlay';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface VideoCardProps {
  videoUri: string;
  overlayText: string;
  isActive: boolean;
  onHelpedTap: () => void;
  helped: boolean;
}

export default function VideoCard({ videoUri, overlayText, isActive, onHelpedTap, helped }: VideoCardProps) {
  const player = useVideoPlayer(videoUri, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

  return (
    <View style={styles.container}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
      />
      <CardOverlay
        text={overlayText}
        onHelpedTap={onHelpedTap}
        helped={helped}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#1C1C1E',
  },
  video: {
    ...StyleSheet.absoluteFill,
  },
});

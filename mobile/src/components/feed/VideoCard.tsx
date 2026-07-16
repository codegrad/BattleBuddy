import { useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import CardOverlay from './CardOverlay';


interface VideoCardProps {
  videoUri: string;
  overlayText: string;
  isActive: boolean;
  onHelpedTap: () => void;
  helped: boolean;
  onTalkTap?: () => void;
}

export default function VideoCard({ videoUri, overlayText, isActive, onHelpedTap, helped, onTalkTap }: VideoCardProps) {
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
        onTalkTap={onTalkTap}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Fill whatever page the pager gives us — a hardcoded screen height
  // overflows the One Conversation content pane and clips the action rail.
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: '#1C1C1E',
  },
  video: {
    ...StyleSheet.absoluteFill,
  },
});

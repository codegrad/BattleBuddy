import { View, Image, StyleSheet } from 'react-native';
import CardOverlay from './CardOverlay';


interface ImageTextCardProps {
  imageUri: string;
  overlayText: string;
  onHelpedTap: () => void;
  helped: boolean;
  onTalkTap?: () => void;
}

export default function ImageTextCard({ imageUri, overlayText, onHelpedTap, helped, onTalkTap }: ImageTextCardProps) {
  return (
    <View style={styles.container}>
      <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
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
  image: {
    ...StyleSheet.absoluteFill,
  },
});

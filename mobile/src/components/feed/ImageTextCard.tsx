import { View, Image, StyleSheet, Dimensions } from 'react-native';
import CardOverlay from './CardOverlay';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ImageTextCardProps {
  imageUri: string;
  overlayText: string;
  onHelpedTap: () => void;
  helped: boolean;
}

export default function ImageTextCard({ imageUri, overlayText, onHelpedTap, helped }: ImageTextCardProps) {
  return (
    <View style={styles.container}>
      <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
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
  image: {
    ...StyleSheet.absoluteFill,
  },
});

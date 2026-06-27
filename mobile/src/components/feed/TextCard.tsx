import { View, Text, StyleSheet, Dimensions } from 'react-native';
import CardOverlay from './CardOverlay';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface TextCardProps {
  text: string;
  onHelpedTap: () => void;
  helped: boolean;
}

export default function TextCard({ text, onHelpedTap, helped }: TextCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        <Text style={styles.mainText}>{text}</Text>
      </View>
      <CardOverlay
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
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  mainText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 40,
    letterSpacing: 0.3,
  },
});

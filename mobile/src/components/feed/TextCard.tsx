import { View, Text, StyleSheet } from 'react-native';
import CardOverlay from './CardOverlay';


interface TextCardProps {
  text: string;
  onHelpedTap: () => void;
  helped: boolean;
  onTalkTap?: () => void;
}

export default function TextCard({ text, onHelpedTap, helped, onTalkTap }: TextCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        <Text style={styles.mainText}>{text}</Text>
      </View>
      <CardOverlay
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

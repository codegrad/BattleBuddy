import { useState, useCallback, useRef } from 'react';
import { View, FlatList, StyleSheet, Dimensions, type ViewToken } from 'react-native';
import VideoCard from './VideoCard';
import ImageTextCard from './ImageTextCard';
import TextCard from './TextCard';
import ChatCard from './ChatCard';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface FeedCard {
  id: string;
  type: 'video' | 'image_text' | 'text' | 'chat';
  mediaUri?: string;
  overlayText?: string;
}

interface FeedPagerProps {
  cards: FeedCard[];
  onOpenChat: () => void;
  onCardVisible: (index: number) => void;
  cardEngagements: Record<string, { helped: boolean }>;
  onHelpedTap: (cardId: string) => void;
}

export default function FeedPager({
  cards,
  onOpenChat,
  onCardVisible,
  cardEngagements,
  onHelpedTap,
}: FeedPagerProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        const index = viewableItems[0].index;
        setActiveIndex(index);
        onCardVisible(index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const renderItem = useCallback(
    ({ item, index }: { item: FeedCard; index: number }) => {
      const helped = cardEngagements[item.id]?.helped ?? false;
      const isActive = index === activeIndex;

      return (
        <View style={styles.page}>
          {item.type === 'video' && item.mediaUri && (
            <VideoCard
              videoUri={item.mediaUri}
              overlayText={item.overlayText ?? ''}
              isActive={isActive}
              onHelpedTap={() => onHelpedTap(item.id)}
              helped={helped}
            />
          )}
          {item.type === 'image_text' && item.mediaUri && (
            <ImageTextCard
              imageUri={item.mediaUri}
              overlayText={item.overlayText ?? ''}
              onHelpedTap={() => onHelpedTap(item.id)}
              helped={helped}
            />
          )}
          {item.type === 'text' && (
            <TextCard
              text={item.overlayText ?? ''}
              onHelpedTap={() => onHelpedTap(item.id)}
              helped={helped}
            />
          )}
          {item.type === 'chat' && (
            <ChatCard onOpenChat={onOpenChat} />
          )}
        </View>
      );
    },
    [activeIndex, cardEngagements, onHelpedTap, onOpenChat],
  );

  return (
    <FlatList
      data={cards}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      pagingEnabled
      showsVerticalScrollIndicator={false}
      snapToInterval={SCREEN_HEIGHT}
      decelerationRate="fast"
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      getItemLayout={(_, index) => ({
        length: SCREEN_HEIGHT,
        offset: SCREEN_HEIGHT * index,
        index,
      })}
    />
  );
}

const styles = StyleSheet.create({
  page: {
    height: SCREEN_HEIGHT,
    width: SCREEN_WIDTH,
  },
});

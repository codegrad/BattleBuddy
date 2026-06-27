import { useCallback } from 'react';
import HomeScreen from '../../src/components/home/HomeScreen';
import { useUIStore } from '../../src/stores/uiStore';

export default function AppIndex() {
  const openDrawer = useUIStore((s) => s.openDrawer);
  const handleOpenDrawer = useCallback(() => openDrawer(), [openDrawer]);

  return <HomeScreen onOpenDrawer={handleOpenDrawer} />;
}

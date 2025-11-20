import { useState, useEffect } from 'react';
import { Layout } from 'react-grid-layout';

const DEFAULT_LAYOUT: Layout[] = [
  { i: 'ai-insights', x: 0, y: 0, w: 12, h: 3, minW: 4, minH: 2 },
  { i: 'node-details', x: 0, y: 3, w: 6, h: 4, minW: 3, minH: 3 },
  { i: 'cost-chart', x: 6, y: 3, w: 6, h: 4, minW: 3, minH: 3 },
  { i: 'storage-chart', x: 0, y: 7, w: 6, h: 4, minW: 3, minH: 3 },
  { i: 'pod-health', x: 6, y: 7, w: 6, h: 4, minW: 3, minH: 3 },
  { i: 'cluster-events', x: 0, y: 11, w: 12, h: 4, minW: 4, minH: 3 },
];

const STORAGE_KEY = 'dashboard-layout';

export const useDashboardLayout = () => {
  const [layout, setLayout] = useState<Layout[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_LAYOUT;
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [tempLayout, setTempLayout] = useState<Layout[]>(layout);

  useEffect(() => {
    if (!isEditMode) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    }
  }, [layout, isEditMode]);

  const handleLayoutChange = (newLayout: Layout[]) => {
    if (isEditMode) {
      setTempLayout(newLayout);
    }
  };

  const handleEditModeChange = (editMode: boolean) => {
    if (editMode) {
      setTempLayout(layout);
    } else {
      setLayout(tempLayout);
    }
    setIsEditMode(editMode);
  };

  const handleResetLayout = () => {
    setLayout(DEFAULT_LAYOUT);
    setTempLayout(DEFAULT_LAYOUT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_LAYOUT));
  };

  return {
    layout: isEditMode ? tempLayout : layout,
    isEditMode,
    handleLayoutChange,
    handleEditModeChange,
    handleResetLayout,
  };
};

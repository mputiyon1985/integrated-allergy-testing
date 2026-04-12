'use client';

import { ResponsiveGridLayout, useContainerWidth, noCompactor } from 'react-grid-layout';
import type { Layout, ResponsiveLayouts } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

export interface GridTile {
  id: string;
  content: React.ReactNode;
}

interface Props {
  tiles: GridTile[];
  layouts: ResponsiveLayouts;
  editMode: boolean;
  onLayoutChange: (layout: Layout, allLayouts: ResponsiveLayouts) => void;
}

export default function DashboardGrid({ tiles, layouts, editMode, onLayoutChange }: Props) {
  const { width, containerRef } = useContainerWidth();

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      {width > 0 && (
        <ResponsiveGridLayout
          width={width}
          layouts={layouts}
          onLayoutChange={onLayoutChange}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={30}
          compactor={noCompactor}
          dragConfig={{ enabled: editMode }}
          resizeConfig={{ enabled: editMode }}
          margin={[16, 16]}
          containerPadding={[0, 0]}
        >
          {tiles.map(tile => (
            <div key={tile.id} style={{ height: '100%', overflow: 'hidden' }}>
              {editMode && (
                <div style={{
                  position: 'absolute', top: 6, right: 8, zIndex: 10,
                  color: '#94a3b8', fontSize: 16, cursor: 'grab', userSelect: 'none',
                  background: 'rgba(255,255,255,0.8)', borderRadius: 4, padding: '1px 4px',
                }} title="Drag to move">⠿</div>
              )}
              {tile.content}
            </div>
          ))}
        </ResponsiveGridLayout>
      )}
    </div>
  );
}

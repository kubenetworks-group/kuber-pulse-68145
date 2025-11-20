import { ReactNode, useState, useEffect, useRef } from 'react';
import GridLayout, { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Button } from './ui/button';
import { Edit3, Save, RotateCcw, GripVertical, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from './ui/alert';

interface DashboardGridProps {
  layout: Layout[];
  onLayoutChange: (layout: Layout[]) => void;
  children: ReactNode;
  isEditMode: boolean;
  onEditModeChange: (isEdit: boolean) => void;
  onResetLayout: () => void;
}

export const DashboardGrid = ({
  layout,
  onLayoutChange,
  children,
  isEditMode,
  onEditModeChange,
  onResetLayout,
}: DashboardGridProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const handleLayoutChange = (newLayout: Layout[]) => {
    if (isEditMode) {
      onLayoutChange(newLayout);
    }
  };

  const handleSave = () => {
    onEditModeChange(false);
    toast.success('Layout salvo com sucesso!', {
      description: 'Suas preferências foram armazenadas',
    });
  };

  const handleReset = () => {
    onResetLayout();
    toast.success('Layout resetado!', {
      description: 'Voltamos ao layout padrão',
    });
  };

  const handleCancel = () => {
    onEditModeChange(false);
    toast.info('Edição cancelada', {
      description: 'Suas mudanças não foram salvas',
    });
  };

  return (
    <div className="relative">
      {/* Edit Mode Controls */}
      <div className="flex items-center gap-2 mb-4 animate-fade-in flex-wrap">
        {!isEditMode ? (
          <Button
            onClick={() => onEditModeChange(true)}
            variant="outline"
            size="sm"
            className="gap-2 hover:scale-105 transition-transform"
          >
            <Edit3 className="w-4 h-4" />
            <span className="hidden sm:inline">Personalizar Dashboard</span>
            <span className="sm:hidden">Editar</span>
          </Button>
        ) : (
          <>
            <Button
              onClick={handleSave}
              variant="default"
              size="sm"
              className="gap-2 hover:scale-105 transition-transform"
            >
              <Save className="w-4 h-4" />
              Salvar
            </Button>
            <Button
              onClick={handleCancel}
              variant="outline"
              size="sm"
              className="hover:scale-105 transition-transform"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleReset}
              variant="outline"
              size="sm"
              className="gap-2 ml-auto hover:scale-105 transition-transform"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Resetar Padrão</span>
              <span className="sm:hidden">Resetar</span>
            </Button>
          </>
        )}
      </div>

      {/* Edit Mode Indicator */}
      {isEditMode && (
        <Alert className="mb-4 bg-primary/5 border-primary/20 animate-fade-in">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm text-primary flex items-center gap-2">
            <GripVertical className="w-4 h-4 hidden sm:inline" />
            <span className="hidden sm:inline">
              Arraste os cards para reorganizar e redimensione pelas bordas
            </span>
            <span className="sm:hidden">
              Arraste para reorganizar
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Grid Layout - Responsive */}
      <div ref={containerRef} className="w-full">
        <GridLayout
          className="layout"
          layout={layout}
          cols={12}
          rowHeight={80}
          width={containerWidth}
          containerPadding={[8, 8]}
          margin={[16, 16]}
          isDraggable={isEditMode}
          isResizable={isEditMode}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".drag-handle"
          compactType="vertical"
        >
          {children}
        </GridLayout>
      </div>

      <style>{`
        .react-grid-layout {
          position: relative;
          transition: height 0.3s ease;
        }
        
        .react-grid-item {
          transition: all 0.3s ease;
          border-radius: 0.5rem;
        }
        
        .react-grid-item.cssTransforms {
          transition-property: transform, opacity;
        }
        
        .react-grid-item.react-draggable-dragging {
          transition: none;
          z-index: 100;
          opacity: 0.9;
          transform: scale(1.02);
          filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.2));
        }
        
        .react-grid-item.react-grid-placeholder {
          background: hsl(var(--primary) / 0.1);
          border: 2px dashed hsl(var(--primary) / 0.4);
          opacity: 0.6;
          transition-duration: 100ms;
          z-index: 2;
          border-radius: 0.5rem;
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 0.6;
          }
          50% {
            opacity: 0.3;
          }
        }
        
        .react-grid-item > .react-resizable-handle {
          position: absolute;
          width: 24px;
          height: 24px;
          cursor: nwse-resize;
        }
        
        .react-grid-item > .react-resizable-handle::after {
          content: "";
          position: absolute;
          right: 4px;
          bottom: 4px;
          width: 10px;
          height: 10px;
          border-right: 3px solid hsl(var(--primary));
          border-bottom: 3px solid hsl(var(--primary));
          opacity: ${isEditMode ? '0.5' : '0'};
          transition: opacity 0.2s ease, transform 0.2s ease;
        }
        
        .react-grid-item:hover > .react-resizable-handle::after {
          opacity: ${isEditMode ? '1' : '0'};
          transform: scale(1.1);
        }
        
        .drag-handle {
          cursor: ${isEditMode ? 'grab' : 'default'};
          transition: all 0.2s ease;
          user-select: none;
        }
        
        .drag-handle:active {
          cursor: ${isEditMode ? 'grabbing' : 'default'};
        }
        
        .drag-handle:hover {
          background-color: ${isEditMode ? 'hsl(var(--primary) / 0.1)' : 'transparent'};
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .react-grid-item {
            position: static !important;
            transform: none !important;
            width: 100% !important;
            margin-bottom: 1rem;
          }
          
          .react-grid-layout {
            position: static;
            height: auto !important;
          }
        }
      `}</style>
    </div>
  );
};

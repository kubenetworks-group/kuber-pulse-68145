import { ReactNode } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DraggableCardProps {
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
  isEditMode?: boolean;
  noWrapper?: boolean; // For components that already have their own Card
}

export const DraggableCard = ({ title, icon, children, isEditMode, noWrapper }: DraggableCardProps) => {
  // If the child component already has its own Card wrapper, just add drag handle
  if (noWrapper) {
    return (
      <div className="h-full relative transition-all duration-300">
        {isEditMode && (
          <div 
            className={cn(
              "drag-handle absolute top-3 left-3 z-10",
              "p-2 bg-primary/10 rounded-lg cursor-grab active:cursor-grabbing",
              "hover:bg-primary/20 transition-all duration-200",
              "shadow-sm hover:shadow-md hover:scale-110"
            )}
          >
            <GripVertical className="w-4 h-4 text-primary" />
          </div>
        )}
        <div className={cn(
          "h-full",
          isEditMode && "pl-12" // Add padding when edit mode is active to prevent overlap
        )}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <Card className={cn(
      "h-full flex flex-col overflow-hidden",
      "transition-all duration-300",
      isEditMode 
        ? "border-primary/30 shadow-lg shadow-primary/10 hover:shadow-xl hover:shadow-primary/20" 
        : "hover:shadow-lg"
    )}>
      <CardHeader className={cn(
        "flex flex-row items-center gap-2 pb-3",
        isEditMode && "drag-handle bg-primary/5 hover:bg-primary/10 cursor-grab active:cursor-grabbing"
      )}>
        {isEditMode && (
          <GripVertical className="w-5 h-5 text-primary/50 flex-shrink-0 animate-pulse" />
        )}
        {icon && <div className="flex-shrink-0">{icon}</div>}
        {title && <CardTitle className="text-lg font-semibold flex-1">{title}</CardTitle>}
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        {children}
      </CardContent>
    </Card>
  );
};

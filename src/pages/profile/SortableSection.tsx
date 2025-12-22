import { useSortable } from '@dnd-kit/sortable';
import { GripVertical } from 'lucide-react';
import './SortableSection.css';

interface SortableSectionProps {
  id: string;
  children: React.ReactNode;
  isEditMode: boolean;
  title: string;
}

const getSectionTitle = (id: string): string => {
  switch (id) {
    case 'content':
      return 'About Me, Game Details & Personal Details';
    case 'doodles':
      return 'Doodles Album';
    case 'charts':
      return 'High Score Charts';
    case 'medals':
      return 'Tournament Medals';
    default:
      return 'Section';
  }
};

export const SortableSection = ({ id, children, isEditMode, title }: SortableSectionProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isEditMode });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0) scale(1)` : undefined,
    transition,
    opacity: isDragging ? 0.8 : 1,
  };

  const sectionTitle = title || getSectionTitle(id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-section ${isDragging ? 'dragging' : ''}`}
    >
      {isEditMode && !isDragging && (
        <div className="sortable-handle" {...attributes} {...listeners}>
          <GripVertical className="sortable-handle-icon" size={24} />
        </div>
      )}
      {isDragging ? (
        <div className="sortable-section-minified">
          <h3 className="sortable-section-title">{sectionTitle}</h3>
        </div>
      ) : (
        children
      )}
    </div>
  );
};


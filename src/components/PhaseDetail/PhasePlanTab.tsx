import { MarkdownRenderer } from '../PhaseViewer/MarkdownRenderer';
import type { Phase } from '../../types';

interface PhasePlanTabProps {
  phase: Phase;
}

export function PhasePlanTab({ phase }: PhasePlanTabProps) {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <MarkdownRenderer content={phase.content} />
    </div>
  );
}

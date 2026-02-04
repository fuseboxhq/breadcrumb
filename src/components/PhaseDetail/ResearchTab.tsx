import { useState } from 'react';
import clsx from 'clsx';
import { ChevronRight, FileText } from 'lucide-react';
import type { ResearchDoc } from '../../types';
import { MarkdownRenderer } from '../PhaseViewer/MarkdownRenderer';
import { Spinner } from '../ui/Spinner';
import { EmptyState } from '../ui/EmptyState';

interface ResearchTabProps {
  docs: ResearchDoc[];
  isLoading: boolean;
}

export function ResearchTab({ docs, isLoading }: ResearchTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-5 w-5" />}
        title="No research documents"
        description="Run /bc:research <task-id> to create research for a task"
        className="py-16"
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-6 space-y-2">
      <p className="text-2xs text-text-tertiary mb-3">Research documents for this project</p>
      {docs.map((doc) => {
        const isExpanded = expandedId === doc.id;
        return (
          <div key={doc.id} className="border border-border rounded-lg overflow-hidden bg-surface-raised">
            <button
              onClick={() => setExpandedId(isExpanded ? null : doc.id)}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-surface-hover transition-colors group"
            >
              <ChevronRight className={clsx(
                'h-3.5 w-3.5 text-text-tertiary transition-transform',
                isExpanded && 'rotate-90',
              )} />
              <FileText className="h-3.5 w-3.5 text-text-tertiary" />
              <span className="text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors">
                {doc.filename}
              </span>
            </button>
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-border">
                <div className="pt-4">
                  <MarkdownRenderer content={doc.content} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

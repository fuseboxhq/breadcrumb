import { useState } from 'react';
import type { ResearchDoc } from '../../types';
import { MarkdownRenderer } from '../PhaseViewer/MarkdownRenderer';
import { Spinner } from '../ui/Spinner';

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
      <div className="max-w-4xl mx-auto p-8 text-center text-gray-500">
        <p className="text-lg mb-2">No research documents</p>
        <p className="text-sm">
          Run <code className="bg-gray-800 px-1.5 py-0.5 rounded">/bc:research &lt;task-id&gt;</code> to create research for a task.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-2">
      <p className="text-xs text-gray-500 mb-4">Research documents for this project</p>
      {docs.map((doc) => {
        const isExpanded = expandedId === doc.id;
        return (
          <div key={doc.id} className="border border-gray-800 rounded-lg overflow-hidden">
            <button
              onClick={() => setExpandedId(isExpanded ? null : doc.id)}
              className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-900/50 transition-colors"
            >
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-sm font-medium text-gray-200">{doc.filename}</span>
            </button>
            {isExpanded && (
              <div className="px-4 pb-4 border-t border-gray-800">
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

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { remarkAsciiBlocks } from '../../lib/remarkAsciiBlocks';
import { CodeBlock } from './CodeBlock';
import type { Components } from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const components: Components = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const text = String(children);
      const hasNewlines = text.includes('\n');
      const isInline = !match && !className && !hasNewlines;

      if (isInline) {
        return (
          <code className="px-1.5 py-0.5 bg-gray-800 text-gray-200 rounded text-sm font-mono" {...props}>
            {children}
          </code>
        );
      }

      return (
        <CodeBlock language={match?.[1]}>
          {text.replace(/\n$/, '')}
        </CodeBlock>
      );
    },
    pre({ children }) {
      return <div className="my-4">{children}</div>;
    },
    h1({ children }) {
      return <h1 className="text-3xl font-bold text-gray-100 mt-8 mb-4 first:mt-0">{children}</h1>;
    },
    h2({ children }) {
      return <h2 className="text-2xl font-semibold text-gray-100 mt-8 mb-3 pb-2 border-b border-gray-700">{children}</h2>;
    },
    h3({ children }) {
      return <h3 className="text-xl font-semibold text-gray-200 mt-6 mb-2">{children}</h3>;
    },
    h4({ children }) {
      return <h4 className="text-lg font-medium text-gray-200 mt-4 mb-2">{children}</h4>;
    },
    p({ children }) {
      return <p className="text-gray-300 leading-7 mb-4">{children}</p>;
    },
    ul({ children }) {
      return <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>;
    },
    ol({ children }) {
      return <ol className="list-decimal pl-6 mb-4 space-y-1">{children}</ol>;
    },
    li({ children }) {
      return <li className="text-gray-300 leading-7">{children}</li>;
    },
    blockquote({ children }) {
      return (
        <blockquote className="border-l-4 border-gray-600 pl-4 my-4 italic text-gray-400">
          {children}
        </blockquote>
      );
    },
    table({ children }) {
      return (
        <div className="overflow-x-auto my-4">
          <table className="min-w-full divide-y divide-gray-700 border border-gray-700 rounded-lg">
            {children}
          </table>
        </div>
      );
    },
    thead({ children }) {
      return <thead className="bg-gray-800">{children}</thead>;
    },
    th({ children }) {
      return (
        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
          {children}
        </th>
      );
    },
    td({ children }) {
      return <td className="px-4 py-3 text-sm text-gray-300 border-t border-gray-800">{children}</td>;
    },
    a({ href, children }) {
      return (
        <a href={href} className="text-blue-400 hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    },
    hr() {
      return <hr className="my-8 border-gray-700" />;
    },
    input({ type, checked, ...props }) {
      if (type === 'checkbox') {
        return (
          <input
            type="checkbox"
            checked={checked}
            disabled
            className="mr-2 accent-blue-500"
            {...props}
          />
        );
      }
      return <input type={type} {...props} />;
    },
  };

  return (
    <div className="prose prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkAsciiBlocks]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

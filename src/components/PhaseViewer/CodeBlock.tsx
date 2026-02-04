import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeBlockProps {
  language?: string;
  children: string;
}

export function CodeBlock({ language, children }: CodeBlockProps) {
  return (
    <SyntaxHighlighter
      language={language || 'text'}
      style={oneDark}
      customStyle={{
        margin: 0,
        borderRadius: '0.5rem',
        fontSize: '0.875rem',
      }}
      showLineNumbers={children.split('\n').length > 3}
    >
      {children}
    </SyntaxHighlighter>
  );
}

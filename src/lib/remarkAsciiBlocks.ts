import { visit } from 'unist-util-visit';
import type { Root, Paragraph, Text, Code } from 'mdast';

const BOX_DRAWING_CHARS = /[┌┐└┘─│├┤┬┴┼╔╗╚╝═║╭╮╯╰]/;
const TREE_BRANCH_PATTERN = /[├└│]──|[├└]─/;

function containsAsciiArt(text: string): boolean {
  const lines = text.split('\n');
  if (lines.length < 2) return false;

  let asciiLineCount = 0;
  for (const line of lines) {
    if (BOX_DRAWING_CHARS.test(line) || TREE_BRANCH_PATTERN.test(line)) {
      asciiLineCount++;
    }
  }
  return asciiLineCount >= 2;
}

function extractTextFromParagraph(node: Paragraph): string {
  let text = '';
  for (const child of node.children) {
    if (child.type === 'text') {
      text += (child as Text).value;
    } else if (child.type === 'break') {
      text += '\n';
    }
  }
  return text;
}

export function remarkAsciiBlocks() {
  return (tree: Root) => {
    visit(tree, 'paragraph', (node: Paragraph, index, parent) => {
      if (typeof index !== 'number' || !parent) return;

      const text = extractTextFromParagraph(node);
      if (containsAsciiArt(text)) {
        const codeNode: Code = { type: 'code', lang: 'text', meta: null, value: text };
        parent.children[index] = codeNode;
      }
    });
  };
}

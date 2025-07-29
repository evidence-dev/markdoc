import { parse, SyntaxError } from './grammar/tag';
import Variable from './ast/variable';
import Function from './ast/function';

import type Token from 'markdown-it/lib/token';

enum STATES {
  normal,
  string,
  escape,
}

export const OPEN = '{%';
export const CLOSE = '%}';

export const IDENTIFIER_REGEX = /^[a-zA-Z0-9_-]+$/;

export function isIdentifier(s: any): s is string {
  return typeof s === 'string' && IDENTIFIER_REGEX.test(s);
}

export function isPromise(a: any): a is Promise<any> {
  return a && typeof a === 'object' && typeof a.then === 'function';
}

export interface InterpolationResult {
  result: string;
  undefinedVariables: string[];
}

export function interpolateString(value: string, variables?: Record<string, any>): InterpolationResult {
  const undefinedVariables: string[] = [];
  
  if (!variables || Object.keys(variables).length === 0) {
    return { result: value, undefinedVariables: [] };
  }
  
  // Handle escaped interpolation by replacing backslashes before processing
  const unescapedValue = value.replace(/\\\{\{/g, '{{ESCAPED_OPEN}}');

  const pattern = /\{\{\s*\$([a-zA-Z_\u0080-\uFFFF][a-zA-Z0-9_\u0080-\uFFFF-]*(\.[a-zA-Z_\u0080-\uFFFF][a-zA-Z0-9_\u0080-\uFFFF-]*|\[[0-9]+\])*)\s*\}\}/g;
  
  const result = unescapedValue.replace(pattern, (match, path) => {
    // Skip if this is our escaped placeholder
    if (path === 'ESCAPED_OPEN') {
      return match;
    }
    
    // Parse the path to handle both dot notation and array access
    const pathParts: string[] = [];
    let currentPart = '';
    let inBrackets = false;
    let bracketContent = '';
    
    for (let i = 0; i < path.length; i++) {
      const char = path[i];
      
      if (char === '[' && !inBrackets) {
        if (currentPart) {
          pathParts.push(currentPart);
          currentPart = '';
        }
        inBrackets = true;
        bracketContent = '';
      } else if (char === ']' && inBrackets) {
        pathParts.push(`[${bracketContent}]`);
        inBrackets = false;
        bracketContent = '';
      } else if (char === '.' && !inBrackets) {
        if (currentPart) {
          pathParts.push(currentPart);
          currentPart = '';
        }
      } else if (inBrackets) {
        bracketContent += char;
      } else {
        currentPart += char;
      }
    }
    
    if (currentPart) {
      pathParts.push(currentPart);
    }
    
    let variableValue = variables;
    
    for (const part of pathParts) {
      if (variableValue && typeof variableValue === 'object') {
        if (part.startsWith('[') && part.endsWith(']')) {
          // Array access
          const index = parseInt(part.slice(1, -1), 10);
          if (Array.isArray(variableValue) && index >= 0 && index < variableValue.length) {
            variableValue = variableValue[index];
          } else {
            undefinedVariables.push(path);
            return match;
          }
        } else if (part in variableValue) {
          // Object property access
          variableValue = variableValue[part];
        } else {
          undefinedVariables.push(path);
          return match;
        }
      } else {
        undefinedVariables.push(path);
        return match;
      }
    }
    
    if (variableValue === null || variableValue === undefined) return '';
    if (typeof variableValue === 'object' && typeof variableValue.toString === 'function' && variableValue.toString !== Object.prototype.toString) {
      return variableValue.toString();
    }
    return String(variableValue);
  }).replace(/{{ESCAPED_OPEN}}/g, '\\{{');
  
  return { result, undefinedVariables };
}

export function interpolateValue(value: any, variables?: Record<string, any>): any {
  if (typeof value === 'string') {
    return interpolateString(value, variables).result;
  }
  if (Array.isArray(value)) {
    return value.map(item => interpolateValue(item, variables));
  }
  if (value && typeof value === 'object') {
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = interpolateValue(val, variables);
    }
    return result;
  }
  return value;
}

export function findTagEnd(content: string, start = 0) {
  let state = STATES.normal;
  for (let pos = start; pos < content.length; pos++) {
    const char = content[pos];

    switch (state) {
      case STATES.string:
        switch (char) {
          case '"':
            state = STATES.normal;
            break;
          case '\\':
            state = STATES.escape;
            break;
        }
        break;
      case STATES.escape:
        state = STATES.string;
        break;
      case STATES.normal:
        if (char === '"') state = STATES.string;
        else if (content.startsWith(CLOSE, pos)) return pos;
    }
  }

  return null;
}

function parseTag(content: string, line: number, contentStart: number) {
  try {
    return parse(content, { Variable, Function });
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    const {
      message,
      location: { start, end },
    } = error as SyntaxError;
    const location = {
      start: { line, character: start.offset + contentStart },
      end: { line: line + 1, character: end.offset + contentStart },
    };

    return { type: 'error', meta: { error: { message, location } } };
  }
}

export function parseTags(content: string, firstLine = 0): Token[] {
  let line = firstLine + 1;
  const output = [];
  let start = 0;

  for (let pos = 0; pos < content.length; pos++) {
    if (content[pos] === '\n') {
      line++;
      continue;
    }

    if (!content.startsWith(OPEN, pos)) continue;

    const end = findTagEnd(content, pos);

    if (end == null) {
      // If we cannot find the closing tag, we skip over it
      pos = pos + OPEN.length;
      continue;
    }

    const text = content.slice(pos, end + CLOSE.length);
    const inner = content.slice(pos + OPEN.length, end);
    const lineStart = content.lastIndexOf('\n', pos);
    const lineEnd = content.indexOf('\n', end);
    const lineContent = content.slice(lineStart, lineEnd);
    const tag = parseTag(inner.trim(), line, pos - lineStart);

    // Throw away excess whitespace introduced by block-level tags
    const precedingTextEnd = lineContent.trim() === text ? lineStart : pos;
    const precedingText = content.slice(start, precedingTextEnd);

    output.push({
      type: 'text',
      start,
      end: pos - 1,
      content: precedingText,
    });

    output.push({
      map: [line, line + 1],
      position: {
        start: pos - lineStart,
        end: pos - lineStart + text.length,
      },
      start: pos,
      end: pos + text.length - 1,
      info: text,
      ...tag,
    });

    start = end + CLOSE.length;
    pos = start - 1;
  }

  output.push({
    type: 'text',
    start,
    end: content.length - 1,
    content: content.slice(start),
  });

  return output;
}

import type { Log, Run, Result, Region, Artifact, ToolComponent, Message, Location } from '@types/sarif';

export interface ParsedLog {
  version: string;
  tool: {
    name: string;
    version?: string;
    informationUri?: string;
  };
  rules: Map<string, {
    id: string;
    name?: string;
    shortDescription?: string;
    fullDescription?: string;
    helpUri?: string;
    defaultLevel: ResultLevel;
  }>;
  artifacts: Map<number, Artifact>;
  results: ParsedResult[];
}

export interface ParsedResult {
  index: number;
  ruleId: string;
  ruleName?: string;
  ruleShortDescription: string;
  ruleFullDescription?: string;
  level: ResultLevel;
  severity?: string;
  kind?: string;
  message: string;
  markdown?: string;
  locations: ParsedLocation[];
  codeFlows?: ParsedCodeFlow[];
  stackFrames?: ParsedStackFrame[];
  occurenceCount?: number;
  fix?: ParsedFix;
  properties?: {
    [key: string]: string;
  };
  categories?: {
    category?: string;
    cwe?: string;
    cloudProvider?: string;
    description?: string;
    fileName?: string;
    fileName?: string;
    line?: string;
  };
}

export interface SummaryData {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  trace: number;
  total: number;
  scannedFiles: number;
}

export interface ParsedLocation {
  filePath?: string;
  uriBaseId?: string;
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  contextSnippet?: { text?: string; byteOffset?: number; charOffset?: number };
  message?: string;
  markdown?: string;
}

export interface ParsedCodeFlow {
  threadFlowMessages?: string[];
  locations: { filePath?: string; line: number }[];
}

export interface ParsedStackFrame {
  location?: { filePath?: string; line?: number };
  module?: string;
  image?: string;
  message?: string;
}

export interface ParsedFix {
  description: string;
  artifactChanges: { filePath: string }[];
}

export type ResultLevel = 'error' | 'warning' | 'note' | 'none';

export const RESULT_LEVEL_ORDER: Record<ResultLevel, number> = {
  error: 0,
  warning: 1,
  note: 2,
  none: 3,
};

export const RESULT_LEVEL_COLORS: Record<string, string> = {
  error: '#ff0000',
  warning: '#ff9900',
  note: '#3399ff',
  none: '#888888',
};

export const RESULT_LEVEL_ICONS: Record<string, string> = {
  error: '✖',
  warning: '▲',
  note: '●',
  none: '○',
};

export const RESULT_TERMINAL_COLORS: Record<ResultLevel, { color: string; bg?: string }> = {
  error: { color: 'bold #ff1a1a' },
  warning: { color: '#ffa500' },
  note: { color: '#1e90ff' },
  none: { color: '#888888' },
};

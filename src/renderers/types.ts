export interface SarifOptions {
  level?: string;
  ruleId?: string;
  file?: string;
  filePath?: string;
  search?: string;
  sortBy?: 'severity' | 'file' | 'rule';
  noColor?: boolean;
}

export interface HtmlOptions {
  output?: string;
  darkMode?: boolean;
}

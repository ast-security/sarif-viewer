import type { Log, Run, Result, Location, Region } from '@types/sarif';
import type { ParsedLog, ParsedResult, ParsedLocation, ParsedCodeFlow, ParsedStackFrame, ParsedFix, ResultLevel } from './types.js';
import { RESULT_LEVEL_ORDER } from './types.js';

function resolveUri(uri: string | undefined): string | undefined {
  if (!uri) return undefined;
  if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('file://')) {
    return uri;
  }
  return uri;
}

function getMessageText(message: Log['runs'][0]['results'][0]['message']): string | undefined {
  if (!message) return undefined;
  if (message.text) return message.text;
  if (message.markdown) return message.markdown;
  return undefined;
}

function getMarkdown(message: Log['runs'][0]['results'][0]['message']): string | undefined {
  if (!message) return undefined;
  return message.markdown;
}

function getRuleNameFromRun(
  result: Result,
  run: ReturnType<typeof getRunInfo>
): string | undefined {
  if (result.rule?.id) {
    const rule = run.rules.get(result.rule.id);
    if (rule) return rule.name ?? rule.id;
  }
  return undefined;
}

function parseLocation(location: Partial<Location>): ParsedLocation {
  const parsed: ParsedLocation = {
    line: 1,
    column: undefined,
    endLine: undefined,
    endColumn: undefined,
  };

  if (location.message?.text) parsed.message = location.message.text;
  if (location.message?.markdown) parsed.markdown = location.message.markdown;

  if (location.physicalLocation) {
    const { physicalLocation } = location;

    if (physicalLocation.artifactLocation) {
      const al = physicalLocation.artifactLocation;
      if (al.uri) {
        parsed.filePath = resolveUri(al.uri);
      }
    }

    if (physicalLocation.region) {
      const region = physicalLocation.region as Partial<Region>;
      if (region.startLine !== undefined) parsed.line = region.startLine;
      if (region.startColumn !== undefined) parsed.column = region.startColumn;
      if (region.endLine !== undefined) parsed.endLine = region.endLine;
      if (region.endColumn !== undefined) parsed.endColumn = region.endColumn;
      if (region.snippet?.text) {
        parsed.contextSnippet = {
          text: region.snippet.text,
          byteOffset: region.byteOffset,
          charOffset: region.charOffset,
        };
      }
    }
  }

  return parsed;
}

function isResultLevel(value: string | undefined): value is ResultLevel {
  return value === 'error' || value === 'warning' || value === 'note' || value === 'none';
}

interface RunInfo {
  rules: Map<string, { id: string; name?: string; shortDescription?: string; fullDescription?: string }>;
  toolName: string;
  toolVersion?: string;
}

function getRunInfo(log: Log): RunInfo {
  const run = (log.runs ?? [])[0] ?? {};
  const tool = run.tool ?? {};
  const driver = tool.driver ?? tool;

  // Collect all rule descriptors
  const rules = new Map<string, { id: string; name?: string; shortDescription?: string; fullDescription?: string }>();
  const allDescriptors = [
    ...(driver.ruleDescriptors ?? []),
    ...(driver.extensions?.flatMap((e) => e.ruleDescriptors ?? []).flat() ?? []),
    ...(run.extensions?.flatMap((e) => e.ruleDescriptors ?? []).flat() ?? []),
  ];

  for (const rule of allDescriptors) {
    if (!rule.id) continue;
    rules.set(rule.id, {
      id: rule.id,
      name: rule.name,
      shortDescription: rule.shortDescription?.text ?? rule.shortDescription?.markdown,
      fullDescription: rule.fullDescription?.text ?? rule.fullDescription?.markdown,
    });
  }

  // Also from policies
  const policyDescriptors = run.policies?.flatMap((p) => p.ruleDescriptors ?? []).flat() ?? [];
  for (const rule of policyDescriptors) {
    if (!rule.id) continue;
    if (!rules.has(rule.id)) {
      rules.set(rule.id, {
        id: rule.id,
        name: rule.name,
        shortDescription: rule.shortDescription?.text ?? rule.shortDescription?.markdown,
        fullDescription: rule.fullDescription?.text ?? rule.fullDescription?.markdown,
      });
    }
  }

  return {
    rules,
    toolName: driver.name ?? 'Unknown Tool',
    toolVersion: driver.version ?? undefined,
  };
}

function getResultProperties(result: Result, rule: { id: string; name?: string; shortDescription?: string; fullDescription?: string } | undefined): { [key: string]: string } | undefined {
  const properties: { [key: string]: string } = {};

  // Merge message.properties (always higher priority)
  const msgProps = (result.message as any)?.properties;
  if (msgProps && typeof msgProps === 'object') {
    for (const [k, v] of Object.entries(msgProps)) {
      if (typeof v === 'string') {
        properties[k] = v;
      }
    }
  }

  // Merge rule.properties if not overridden by message
  if (rule) {
    const ruleProps = (rule as any)?.properties;
    if (ruleProps && typeof ruleProps === 'object') {
      for (const [k, v] of Object.entries(ruleProps)) {
        if (typeof v === 'string' && !properties[k]) {
          properties[k] = v;
        }
      }
    }
  }

  return Object.keys(properties).length > 0 ? properties : undefined;
}

export function parseSarif(log: Log): ParsedLog {
  const runInfo = getRunInfo(log);
  const run = (log.runs ?? [])[0] ?? {};
  const results: ParsedResult[] = [];

  const runResults = run.results ?? [];

  for (let i = 0; i < runResults.length; i++) {
    const result = runResults[i];
    let ruleId = '';
    if (result.rule?.id) {
      ruleId = result.rule.id;
    } else if (result.ruleId) {
      ruleId = result.ruleId;
    } else if (result.rule?.index !== undefined) {
      const allRules = [
        ...(runInfo.rules.values()),
        ...((run.tool?.driver?.extensions ?? []).flatMap((e) => e.ruleDescriptors ?? [])),
      ];
      const idx = result.rule.index;
      const rule = allRules[idx as number];
      if (rule) ruleId = rule.id;
    }

    const rule = runInfo.rules.get(ruleId);
    const defaultLevel = isResultLevel(rule?.shortDescription ? 'warning' : 'warning') ? 'warning' : 'warning';

    const level = isResultLevel(result.level) ? result.level : (rule ? 'warning' : 'warning');

    const ruleShortDescription = rule?.shortDescription ?? 'No description available';
    const ruleFullDescription = rule?.fullDescription;
    const ruleName = rule?.name;

    // Collect locations
    const locations: ParsedLocation[] = [];

    if (result.locations?.length) {
      for (const loc of result.locations) {
        locations.push(parseLocation(loc));
      }
    }

    // Get stack frames
    const stackFrames: ParsedStackFrame[] = [];
    result.stacks?.forEach((stack) => {
      stack.threadFlow?.locations?.forEach((tfl) => {
        const loc = tfl.location as Partial<Location>;
        const lo: ParsedStackFrame = {};
        if (tfl.message?.text) lo.message = tfl.message.text;
        if (loc.physicalLocation?.artifactLocation?.uri) {
          lo.location = { filePath: resolveUri(loc.physicalLocation.artifactLocation.uri) };
          if (loc.physicalLocation.region?.startLine) {
            lo.location.line = loc.physicalLocation.region.startLine;
          }
        }
        if (loc.logicalLocations?.length) {
          const lastLoc = loc.logicalLocations[loc.logicalLocations.length - 1];
          lo.module = lastLoc.fullyQualifiedName ?? lastLoc.name;
        }
        stackFrames.push(lo);
      });
    });

    // Fix
    let fix: ParsedFix | undefined;
    if (result.fixes?.length) {
      const f = result.fixes[0];
      fix = {
        description: f.description?.text ?? f.description?.markdown ?? 'Fix available',
        artifactChanges: (f.artifactChanges ?? []).map((ac) => ({
          filePath: ac.artifactLocation.uri ?? '',
        })),
      };
    }

    // Extract custom properties from result message and rule
    const properties: { [key: string]: string } | undefined = getResultProperties(result, rule);
    let severity = properties?.severity || properties?.SEVERITY || '';
    
    // If severity not in properties, try deriving from riskScore
    if (!severity && properties && properties.riskScore) {
      const score = parseFloat(properties.riskScore);
      if (!isNaN(score)) {
        if (score >= 7.0) severity = 'CRITICAL';
        else if (score >= 4.0) severity = 'HIGH';
        else if (score >= 2.0) severity = 'MEDIUM';
        else severity = 'LOW';
      }
    }
    
    const cwe = properties?.cwe || properties?.CWE || '';
    const cloudProvider = properties?.cloudProvider || properties?.cloud_provider || '';
    const category = properties?.category || properties?.CATEGORY || '';
    const fileName = properties?.fileName || properties?.file || '';

    results.push({
      index: i,
      ruleId,
      ruleName,
      ruleShortDescription,
      ruleFullDescription,
      level,
      severity: severity.toUpperCase() || 'UNKNOWN',
      kind: result.kind,
      message: getMessageText(result.message) ?? '',
      markdown: getMarkdown(result.message),
      locations: locations.length ? locations : [{ line: 1 }],
      stackFrames,
      occurenceCount: result.occurrenceCount,
      fix,
      properties,
      categories: {
        category,
        cwe,
        cloudProvider,
        fileName,
      },
    });
  }

  return {
    version: log.version ?? '2.1.0',
    tool: {
      name: runInfo.toolName,
      version: runInfo.toolVersion,
    },
    rules: runInfo.rules,
    artifacts: new Map(),
    results,
  };
}

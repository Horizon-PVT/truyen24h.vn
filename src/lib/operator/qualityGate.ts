export type OperatorDraftType = 'story' | 'chapter' | 'blog';

export type QualityGateInput = {
  type: OperatorDraftType;
  title?: string;
  slug?: string;
  content?: string;
  summary?: string;
  source?: string;
  aiAssisted?: boolean;
  targetParentId?: string | null;
  metaTitle?: string;
  metaDescription?: string;
};

export type QualityReport = {
  passed: boolean;
  score: number;
  warnings: string[];
  blockers: string[];
};

const PLACEHOLDER_PATTERNS = [/TODO/i, /lorem ipsum/i, /\bundefined\b/i];

export function runBasicQualityGate(input: QualityGateInput): QualityReport {
  const warnings: string[] = [];
  const blockers: string[] = [];
  const title = (input.title || '').trim();
  const content = (input.content || '').trim();

  if (!title) blockers.push('Missing title');
  if (!content) blockers.push('Missing content');
  if (content && content.length < minimumContentLength(input.type)) {
    blockers.push(`Content is too short for ${input.type}`);
  }
  if (input.aiAssisted !== true) blockers.push('aiAssisted must be true');
  if (!input.source) blockers.push('Missing source/provenance');
  if (input.type === 'chapter' && !input.targetParentId) {
    blockers.push('Chapter draft must include targetParentId');
  }
  if (input.type === 'blog') {
    if (!input.metaTitle && !title) warnings.push('Blog draft is missing meta title');
    if (!input.metaDescription && !input.summary) warnings.push('Blog draft is missing meta description');
  }

  const combined = `${title}\n${input.slug || ''}\n${content}\n${input.summary || ''}`;
  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(combined)) blockers.push(`Placeholder detected: ${pattern.source}`);
  }

  const score = Math.max(0, 100 - blockers.length * 30 - warnings.length * 8);
  return {
    passed: blockers.length === 0,
    score,
    warnings,
    blockers,
  };
}

function minimumContentLength(type: OperatorDraftType): number {
  if (type === 'story') return 80;
  if (type === 'blog') return 300;
  return 500;
}

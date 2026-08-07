function selectedText(item, scope) {
  if (scope === 'title') return item.title;
  if (scope === 'summary') return item.summary;
  return `${item.title}\n${item.summary}`;
}

export function matchItem(item, config) {
  if (config.categories && !config.categories.has(item.category)) {
    return { matched: false, reason: 'category' };
  }

  const text = selectedText(item, config.matchScope);
  const normalized = text.toLowerCase();
  const blocked = config.blockedKeywords.find((keyword) =>
    normalized.includes(keyword.toLowerCase())
  );
  if (blocked) return { matched: false, reason: `blocked:${blocked}` };

  const reasons = [];

  if (config.pushCategory) {
    const hit = config.pushCategory === 'all' || config.pushCategory.has(item.category);
    if (hit) reasons.push(`category-push:${item.category}`);
  }

  const keyword = config.keywords.filter((candidate) =>
    normalized.includes(candidate.toLowerCase())
  );
  if (keyword.length) reasons.push(`keyword:${keyword.join(' ')}`);

  const group = config.keywordGroups.filter((candidates) =>
    candidates.every((candidate) => normalized.includes(candidate.toLowerCase()))
  );
  if (group.length) reasons.push(`group:${group.map((g) => g.join('+')).join(',')}`);

  const regex = config.regexPatterns.filter((pattern) => pattern.test(text));
  if (regex.length) reasons.push(`regex:${regex.map((r) => r.source).join(',')}`);

  if (reasons.length) return { matched: true, reason: reasons.join('|') };
  return { matched: false, reason: 'no-match' };
}

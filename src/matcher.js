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

  if (config.pushCategory) {
    if (config.pushCategory === 'all' || config.pushCategory === item.category) {
      return { matched: true, reason: `category-push:${item.category}` };
    }
    return { matched: false, reason: 'category-mismatch' };
  }

  const keyword = config.keywords.find((candidate) =>
    normalized.includes(candidate.toLowerCase())
  );
  if (keyword) return { matched: true, reason: `keyword:${keyword}` };

  const group = config.keywordGroups.find((candidates) =>
    candidates.every((candidate) => normalized.includes(candidate.toLowerCase()))
  );
  if (group) return { matched: true, reason: `group:${group.join('+')}` };

  const regex = config.regexPatterns.find((pattern) => pattern.test(text));
  if (regex) return { matched: true, reason: `regex:${regex.source}` };

  return { matched: false, reason: 'no-match' };
}

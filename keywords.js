const stop = new Set('그리고 그러나 하지만 그래서 또는 대한 위한 있는 없는 하는 되는 내가 나는 우리 이것 그것 오늘 메모 사실 업무 통해 함께 조금 정말'.split(' '));
export function keywords(text) {
  const counts = new Map();
  for (let word of text.toLowerCase().match(/[가-힣a-z][가-힣a-z0-9-]{1,}/g) || []) {
    word = word.replace(/(에서는|으로는|에서|으로|은|는|이|가|을|를|와|과|의|도)$/, '');
    if (word.length < 2 || stop.has(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([word])=>word);
}

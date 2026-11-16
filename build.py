"""Build the static knowledge network using only the Python standard library."""
from collections import Counter, defaultdict
from datetime import datetime
from itertools import combinations
from pathlib import Path
import json
import math
import re
import shutil
import time

ROOT = Path(__file__).resolve().parent
STOP = set('그리고 그러나 하지만 그래서 또는 대한 위한 있는 없는 하는 되는 내가 나는 우리 이것 그것 오늘 메모 사실 업무 통해 함께 조금 정말'.split())


def keywords(text):
    counts = Counter()
    for word in re.findall(r'[가-힣a-z][가-힣a-z0-9-]{1,}', text.lower()):
        word = re.sub(r'(에서는|으로는|에서|으로|은|는|이|가|을|를|와|과|의|도)$', '', word)
        if len(word) >= 2 and word not in STOP:
            counts[word] += 1
    return [word for word, _ in counts.most_common(5)]


def prepare_note(data):
    if not isinstance(data, dict):
        raise ValueError('메모 형식이 올바르지 않습니다.')
    def require(condition, message='메모 형식이 올바르지 않습니다.'):
        if not condition:
            raise ValueError(message)
    require(isinstance(data.get('id'), str) and re.fullmatch(r'[a-zA-Z0-9-]+', data['id']))
    require(isinstance(data.get('title'), str) and bool(data['title'].strip()) and len(data['title']) <= 120)
    require(isinstance(data.get('text'), str) and len(data['text']) <= 20000)
    require(data['text'].strip() or data.get('image') or data.get('document'))
    try:
        created = datetime.fromisoformat(data['createdAt'].replace('Z', '+00:00'))
        require(created.tzinfo is not None)
    except (ValueError, KeyError, AttributeError, TypeError) as exc:
        raise ValueError('메모 날짜 형식이 올바르지 않습니다.') from exc
    image = data.get('image') or ''
    require(isinstance(image, str) and (not image or (len(image) <= 7_000_000 and re.fullmatch(r'data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+', image))), '지원하지 않는 이미지입니다.')
    if 'keywords' in data:
        tags = data['keywords']
        require(isinstance(tags, list) and len(tags) <= 5 and all(isinstance(k, str) and k.strip() and len(k) <= 60 for k in tags), '키워드는 최대 5개입니다.')
        tags = list(dict.fromkeys(k.strip() for k in tags))
    else:
        tags = keywords(data['title'] + ' ' + data['text'])
    result = dict(id=data['id'], title=data['title'].strip(), text=data['text'], image=image, createdAt=data['createdAt'], keywords=tags)
    if 'flows' in data:
        flows = data['flows']
        require(isinstance(flows, list) and len(flows) <= 4, '순서도 형식이 올바르지 않습니다.')
        for flow in flows:
            require(isinstance(flow, dict) and isinstance(flow.get('title'), str) and isinstance(flow.get('steps'), list) and len(flow['steps']) <= 50, '순서도 형식이 올바르지 않습니다.')
            for step in flow['steps']:
                require(isinstance(step, dict) and isinstance(step.get('label'), str) and isinstance(step.get('actors'), list) and all(isinstance(a, str) for a in step['actors']) and ('optional' not in step or isinstance(step['optional'], bool)), '순서도 형식이 올바르지 않습니다.')
        result['flows'] = flows
    if 'document' in data:
        doc = data['document']
        require(isinstance(doc, dict) and isinstance(doc.get('title'), str) and doc['title'].strip() and isinstance(doc.get('path'), str) and re.fullmatch(r'documents/[a-zA-Z0-9_-]+\.pdf', doc['path']), 'PDF 문서 형식이 올바르지 않습니다.')
        result['document'] = doc
    return result


def build_graph(notes):
    """Compute connections, force layout and importance once, during publication."""
    nodes = [dict(id=n['id'], x=500 + math.cos(i * 2.39996) * math.sqrt(i + 1) * 24, y=325 + math.sin(i * 2.39996) * math.sqrt(i + 1) * 24) for i, n in enumerate(notes)]
    index = defaultdict(list)
    for i, note in enumerate(notes):
        for keyword in dict.fromkeys(note['keywords']):
            index[keyword].append(i)
    pairs = {}
    neighbors = [set() for _ in notes]
    for keyword, ids in index.items():
        for a, b in combinations(ids, 2):
            pairs.setdefault((a, b), []).append(keyword)
            neighbors[a].add(b)
            neighbors[b].add(a)
    for _ in range(140):
        forces = [[(500 - n['x']) * .009, (325 - n['y']) * .009] for n in nodes]
        for i, j in combinations(range(len(nodes)), 2):
            dx, dy = nodes[i]['x'] - nodes[j]['x'], nodes[i]['y'] - nodes[j]['y']
            d2 = max(dx * dx + dy * dy, 100)
            f = 1100 / d2 / math.sqrt(d2)
            forces[i][0] += dx * f
            forces[i][1] += dy * f
            forces[j][0] -= dx * f
            forces[j][1] -= dy * f
        for a, b in pairs:
            dx, dy = nodes[b]['x'] - nodes[a]['x'], nodes[b]['y'] - nodes[a]['y']
            distance = max(1, math.hypot(dx, dy))
            f = (distance - 105) * .012 / distance
            forces[a][0] += dx * f
            forces[a][1] += dy * f
            forces[b][0] -= dx * f
            forces[b][1] -= dy * f
        for node, (fx, fy) in zip(nodes, forces):
            node['x'] += max(-8, min(8, fx))
            node['y'] += max(-8, min(8, fy))
    if len(nodes) > 1:
        xmin, xmax = min(n['x'] for n in nodes), max(n['x'] for n in nodes)
        ymin, ymax = min(n['y'] for n in nodes), max(n['y'] for n in nodes)
        width, height = xmax - xmin, ymax - ymin
        scale = min(800 / max(width, 1), 470 / max(height, 1), 2)
        for node in nodes:
            node['x'] = 500 + (node['x'] - xmin - width / 2) * scale
            node['y'] = 310 + (node['y'] - ymin - height / 2) * scale
    max_degree = max(2, max((len(n) for n in neighbors), default=0))
    for node, connected in zip(nodes, neighbors):
        degree = len(connected)
        t = 0 if degree <= 1 else (degree - 1) / (max_degree - 1)
        color = [math.floor(a + (b - a) * t + .5) for a, b in zip((170, 170, 170), (255, 204, 0))]
        node.update(x=round(node['x'], 4), y=round(node['y'], 4), degree=degree, radius=12, fill='#' + ''.join(f'{c:02x}' for c in color))
    return dict(nodes=nodes, links=[dict(source=nodes[a]['id'], target=nodes[b]['id'], shared=shared) for (a, b), shared in pairs.items()])


def build(root=ROOT):
    root = Path(root)
    start = time.perf_counter()
    notes, ids = [], set()
    for file in sorted((root / 'notes').glob('*.json')):
        try:
            note = prepare_note(json.loads(file.read_text(encoding='utf-8')))
            if note['id'] in ids:
                raise ValueError('중복 메모 ID')
            if doc := note.get('document'):
                with (root / 'public' / doc['path']).open('rb') as pdf:
                    if pdf.read(5) != b'%PDF-':
                        raise ValueError('올바른 PDF 파일이 아닙니다.')
            ids.add(note['id'])
            notes.append(note)
        except (ValueError, OSError) as exc:
            raise ValueError(f'{file.name}: {exc}') from exc
    notes.sort(key=lambda n: datetime.fromisoformat(n['createdAt'].replace('Z', '+00:00')))
    graph = build_graph(notes)
    dist = root / 'dist'
    # dist contains only generated files; source notes and PDF files are never changed.
    if dist.exists():
        shutil.rmtree(dist)
    shutil.copytree(root / 'public', dist)
    for name, data in (('notes.json', notes), ('graph.json', graph)):
        (dist / name).write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf-8')
    (dist / '.nojekyll').touch()
    print(f'Built {len(notes)} notes, {len(graph["links"])} connections in {time.perf_counter() - start:.3f}s → dist/')
    return notes, graph


if __name__ == '__main__':
    build()

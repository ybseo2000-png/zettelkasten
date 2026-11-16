from copy import deepcopy
from pathlib import Path
import hashlib
import json
import math
import tempfile
import unittest

from build import ROOT, build, build_graph, keywords, prepare_note

NOTE = dict(id='test-note', title='검색 연결', text='검색 기술 검색 기술의 연결', createdAt='2026-10-29T00:00:00Z')


class NoteTests(unittest.TestCase):
    def test_keywords(self):
        self.assertEqual(keywords(''), [])
        self.assertEqual(keywords('지식 그래프 지식의 연결 메모는 지식 그래프')[0], '지식')
        self.assertLessEqual(len(keywords('국토 환경 계획 개발 검색 관광 호텔 경제 자료 연구')), 5)
        self.assertIn('검색', prepare_note(NOTE)['keywords'])

    def test_preserves_explicit_keywords_and_fields(self):
        data = {**NOTE, 'keywords': ['계획', '평가', '계획']}
        self.assertEqual(prepare_note(data)['keywords'], ['계획', '평가'])
        self.assertEqual(prepare_note(data)['text'], NOTE['text'])
        self.assertEqual(prepare_note({**NOTE, 'keywords': []})['keywords'], [])

    def test_keyword_limit(self):
        for tags in (list('abcdef'), [42], None, ['']):
            with self.subTest(tags=tags), self.assertRaises(ValueError):
                prepare_note({**NOTE, 'keywords': tags})

    def test_bad_note_fields(self):
        for change in ({'title': ''}, {'title': 'x'*121}, {'text': ''}, {'text': 42}, {'createdAt': 'bad'}, {'id': '../escape'}, {'image': 'data:image/svg+xml;base64,AAAA'}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                prepare_note({**NOTE, **change})

    def test_document_and_flow(self):
        doc = {'path': 'documents/guide.pdf', 'title': '자료'}
        self.assertEqual(prepare_note({**NOTE, 'text': '', 'document': doc})['document'], doc)
        for path in ('https://example.com/a.pdf', 'documents/../file.pdf', 'documents/file.svg'):
            with self.subTest(path=path), self.assertRaises(ValueError):
                prepare_note({**NOTE, 'document': {**doc, 'path': path}})
        flow = [{'title': '절차', 'steps': [{'label': '검토', 'actors': ['기관'], 'optional': True}]}]
        self.assertEqual(prepare_note({**NOTE, 'flows': flow})['flows'], flow)
        with self.assertRaises(ValueError):
            prepare_note({**NOTE, 'flows': [{'title': 'bad', 'steps': [None]}]})


class GraphTests(unittest.TestCase):
    def setUp(self):
        self.notes = [dict(id='hub', keywords=['a', 'b', 'c']), dict(id='mid', keywords=['a', 'b']), dict(id='leaf', keywords=['c']), dict(id='peer', keywords=['a']), dict(id='isolated', keywords=[])]

    def test_degree_color_and_equal_size(self):
        graph = build_graph(self.notes)
        nodes = {node['id']: node for node in graph['nodes']}
        self.assertEqual(nodes['hub']['degree'], 3)
        self.assertEqual(nodes['hub']['fill'], '#ffcc00')
        self.assertEqual(nodes['leaf']['fill'], '#aaaaaa')
        self.assertEqual(nodes['isolated']['fill'], '#aaaaaa')
        self.assertNotEqual(nodes['mid']['fill'], nodes['hub']['fill'])
        self.assertEqual({n['radius'] for n in nodes.values()}, {12})
        self.assertEqual(next(link['shared'] for link in graph['links'] if link['source'] == 'hub' and link['target'] == 'mid'), ['a', 'b'])

    def test_deterministic_and_does_not_change_notes(self):
        before = deepcopy(self.notes)
        graph = build_graph(self.notes)
        self.assertEqual(graph, build_graph(self.notes))
        self.assertEqual(self.notes, before)
        self.assertTrue(all(math.isfinite(n['x']) and math.isfinite(n['y']) for n in graph['nodes']))

    def test_empty_single_and_pair(self):
        self.assertEqual(build_graph([]), {'nodes': [], 'links': []})
        single = build_graph([dict(id='a', keywords=[])])
        self.assertEqual(single['nodes'][0]['degree'], 0)
        self.assertEqual(single['nodes'][0]['fill'], '#aaaaaa')
        pair = build_graph([dict(id='a', keywords=['x', 'x']), dict(id='b', keywords=['x'])])
        self.assertEqual(len(pair['links']), 1)
        self.assertTrue(all(n['degree'] == 1 and n['fill'] == '#aaaaaa' for n in pair['nodes']))


class BuildTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / 'notes').mkdir()
        (self.root / 'public').mkdir()
        (self.root / 'public/index.html').write_text('<title>테스트</title>', encoding='utf-8')
        self.write_note('note.json', NOTE)

    def tearDown(self):
        self.temp.cleanup()

    def write_note(self, name, note):
        (self.root / 'notes' / name).write_text(json.dumps(note, ensure_ascii=False), encoding='utf-8')

    def test_build_repeatability_and_no_stale_assets(self):
        build(self.root)
        first = (self.root / 'dist/graph.json').read_bytes()
        (self.root / 'dist/old.js').touch()
        build(self.root)
        self.assertEqual(first, (self.root / 'dist/graph.json').read_bytes())
        self.assertFalse((self.root / 'dist/old.js').exists())
        self.assertEqual(json.loads((self.root / 'dist/notes.json').read_text())[0]['title'], NOTE['title'])
        self.assertTrue((self.root / 'dist/.nojekyll').exists())

    def test_pdf_file_required_and_copied(self):
        self.write_note('note.json', {**NOTE, 'document': {'title': '문서', 'path': 'documents/guide.pdf'}})
        with self.assertRaises(ValueError):
            build(self.root)
        docs = self.root / 'public/documents'
        docs.mkdir()
        (docs / 'guide.pdf').write_bytes(b'not a pdf')
        with self.assertRaises(ValueError):
            build(self.root)
        data = b'%PDF-1.4\nexample fixture'
        (docs / 'guide.pdf').write_bytes(data)
        build(self.root)
        self.assertEqual((self.root / 'dist/documents/guide.pdf').read_bytes(), data)

    def test_duplicates_and_malformed_json(self):
        self.write_note('duplicate.json', NOTE)
        with self.assertRaisesRegex(ValueError, '중복'):
            build(self.root)
        (self.root / 'notes/duplicate.json').write_text('{invalid')
        with self.assertRaisesRegex(ValueError, 'duplicate.json'):
            build(self.root)

    def test_repository_notes_and_pdf_preserved(self):
        source = {p.name: p.read_bytes() for p in (ROOT / 'notes').glob('*.json')}
        notes, graph = build(ROOT)
        self.assertEqual(len(notes), len(source))
        self.assertTrue(all(len(n['keywords']) <= 5 for n in notes))
        self.assertEqual({n['id'] for n in notes}, {n['id'] for n in graph['nodes']})
        self.assertEqual(source, {p.name: p.read_bytes() for p in (ROOT / 'notes').glob('*.json')})
        for note in notes:
            if doc := note.get('document'):
                def digest(path):
                    return hashlib.sha256(path.read_bytes()).hexdigest()
                self.assertEqual(digest(ROOT / 'public' / doc['path']), digest(ROOT / 'dist' / doc['path']))


if __name__ == '__main__':
    unittest.main()

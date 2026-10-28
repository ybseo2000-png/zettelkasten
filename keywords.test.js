import {test} from 'node:test';
import assert from 'node:assert/strict';
import {keywords} from './keywords.js';
test('반복 키워드와 한국어 조사를 처리한다',()=>{const result=keywords('지식 그래프 지식의 연결 메모는 지식 그래프');assert.equal(result[0],'지식');assert.ok(result.includes('그래프'));assert.ok(!result.includes('메모'));});
test('공통 단어로 메모를 연결할 수 있다',()=>{const a=keywords('데이터 검색 데이터 연결');const b=keywords('검색 기능과 성능');assert.ok(a.some(k=>b.includes(k)));});
test('빈 텍스트는 키워드가 없다',()=>assert.deepEqual(keywords(''),[]));

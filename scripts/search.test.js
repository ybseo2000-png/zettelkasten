import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matchesNote} from '../public/search.js';
const note={title:'요청서 작성',text:'평가결과에는 정성적·정량적 근거를 제시한다. 국토의 지속가능한 발전',keywords:['자체평가'],flows:[{title:'검토 절차',steps:[{label:'계획안 보완',actors:['국토교통부']}]}]};
test('제목에 없는 본문 일부와 여러 검색어를 찾는다',()=>{assert.ok(matchesNote(note,'정량적'));assert.ok(matchesNote(note,'평가 근거'));assert.ok(matchesNote(note,'근거 요청서'));assert.ok(!matchesNote(note,'평가 항공기'));});
test('띄어쓰기, 대소문자, 공백을 처리한다',()=>{assert.ok(matchesNote(note,'지속 가능한발전'));assert.ok(matchesNote(note,'   근거   평가   '));assert.ok(matchesNote(note,'   '));assert.ok(matchesNote({...note,text:'PDF 기반'},'pdf'));});
test('키워드와 순서도 단계 및 수행주체도 검색한다',()=>{assert.ok(matchesNote(note,'자체'));assert.ok(matchesNote(note,'계획안보완'));assert.ok(matchesNote(note,'국토 교통부'));});

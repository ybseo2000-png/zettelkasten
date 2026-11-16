"""Optional real-browser validation: run a preview first; requires Playwright and Chromium."""
from playwright.sync_api import sync_playwright
import json
import os

BASE = os.environ.get("SITE_URL", "http://127.0.0.1:3000").rstrip("/")
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce')
 errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
 page.goto(BASE);page.wait_for_selector('.node');expected=len(page.request.get(BASE+'/notes.json').json());assert page.locator('.node').count()==expected
 assert page.locator('#count').inner_text()==f'{expected}개의 메모'
 page.evaluate("window.firstNode=document.querySelector('.node')")
 result=page.evaluate('''() => {const graph=document.querySelector('#graph');let mutations=0;const observer=new MutationObserver(records=>mutations+=records.length);observer.observe(graph,{childList:true,subtree:true});const start=performance.now();for(let i=0;i<20;i++)graph.dispatchEvent(new WheelEvent('wheel',{deltaY:-1,bubbles:true,cancelable:true}));const ms=performance.now()-start;return new Promise(resolve=>requestAnimationFrame(()=>{observer.disconnect();resolve({wheel20Ms:ms,childMutations:mutations,nodeRetained:window.firstNode===document.querySelector('.node')});}));}''')
 assert result['childMutations']==0 and result['nodeRetained']
 print('PERFORMANCE',json.dumps(result))
 page.reload();page.wait_for_selector('.node')
 search=page.locator('#search')
 search.fill('지속 가능한 발전');assert page.locator('#graph .node:visible').count()>=2
 search.fill('예약 취소');assert page.locator('#graph .node:visible').count()==1
 page.locator('#graph .node:visible').click();assert page.locator('#detail').is_visible();assert '예약 취소' in page.locator('#detailBody').inner_text();page.locator('#detail .close').click()
 page.locator('#listView').click();assert page.locator('#cards .card').count()==1
 search.fill('');assert page.locator('#cards .card').count()==expected
 page.locator('#cards .card',has_text='국토계획평가 절차').click();assert page.locator('.flow-step').count()==15;page.locator('#detail .close').click()
 page.locator('#cards .card',has_text='국토계획평가 안내서').click();assert page.locator('.pdf-frame').get_attribute('src').endswith('land-assessment-guide-2021.pdf#view=FitH')
 response=page.request.get(BASE+'/documents/land-assessment-guide-2021.pdf');assert response.status==200;assert response.headers['content-type']=='application/pdf';assert response.body().startswith(b'%PDF-')
 page.locator('#detail .close').click();page.locator('#graphView').click();search.fill('NORESULT987');assert page.locator('#graph .node:visible').count()==0;assert page.locator('#empty').is_visible();search.fill('')
 for width in [375,768]:
  page.set_viewport_size({'width':width,'height':900});assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');assert page.locator('#graph').is_visible()
 page.set_viewport_size({'width':1440,'height':1000});page.emulate_media(reduced_motion='no-preference');page.reload();page.wait_for_selector('.node');page.wait_for_timeout(1800)
 initial=page.locator('#graph > g').get_attribute('transform');assert 'scale(1)' in initial
 data=page.request.get(BASE+'/graph.json').json()
 assert page.locator('.node').first.get_attribute('transform')==f"translate({data['nodes'][0]['x']} {data['nodes'][0]['y']})"
 assert not errors,errors
 print('PASS: desktop/mobile, full-text and spacing search, stable zoom, list, memo dialog, flowchart, PDF, empty search and animation')
 browser.close()

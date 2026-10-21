import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
const [configFile,runRoot]=process.argv.slice(2)
const config=JSON.parse(await fs.readFile(configFile,'utf8'))
const bundle=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const run=path.resolve(runRoot),out=path.join(run,'results'),priv=path.join(run,'private')
const {chromium}=await import(pathToFileURL(config.playwrightModule).href)
const host=JSON.parse(await fs.readFile(path.join(priv,'host.json'),'utf8'))
const browser=await chromium.launch({executablePath:config.browser,headless:true})
const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'})
await context.route('**/*',route=>['127.0.0.1','localhost','[::1]'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort())
const page=await context.newPage()
page.setDefaultTimeout(15000)
const errors=[],result={plugin:'dsh-plugin-wallpaper-engine',version:'1.3.3',browser:browser.version(),cases:{},errors}
page.on('pageerror',e=>errors.push(String(e)))
const current=()=>page.evaluate(async()=>await(await fetch('/wallpaper-engine/settings')).json())
const tab=async name=>{await page.locator('.we-tabs').getByRole('tab',{name,exact:true}).click();await page.waitForTimeout(200)}
const shot=async name=>page.screenshot({path:path.join(out,name+'.png'),mask:[page.locator('.we-picker__uploads-path')]})
async function settle(){
  for(let i=0;i<12;i++){
    await page.waitForTimeout(350)
    for(const name of ['知道了','保持我的设置','继续','稍后配置']){
      const b=page.getByRole('button',{name,exact:true}).first()
      if(await b.isVisible()){await b.click();await page.waitForTimeout(600);break}
    }
  }
}
async function openSettings(){
  const b=page.getByRole('button',{name:'设置',exact:true})
  if(await b.isVisible())await b.click()
  await page.getByText('壁纸引擎',{exact:true}).first().click()
  await page.locator('.we-picker').waitFor()
}
let restoreFault
try{
  await page.goto(host.url,{waitUntil:'domcontentloaded'})
  await settle();await openSettings();await tab('壁纸库')
  await page.locator('.we-picker__file').setInputFiles(path.join(bundle,'fixtures/readability.png'))
  await page.waitForFunction(()=>document.body.innerText.includes('已上传 1 个'),null,{timeout:60000})
  await page.getByRole('button',{name:'选择壁纸',exact:true}).click()
  await page.locator('.we-picker__card[data-we-id]').filter({hasText:'readability'}).first().click()
  await page.getByRole('button',{name:'返回',exact:true}).click()
  await tab('播放')
  const s=page.getByRole('slider',{name:'水平',exact:true})
  await s.scrollIntoViewIfNeeded()
  const nums=()=>s.locator('..').locator('input[type=number]').count()
  const sb=await nums();await shot('slider-before')
  await s.focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(400)
  const sa=await nums();await shot('slider-after')
  await tab('外观');await tab('播放')
  const sr=await nums()
  assert.deepEqual([sb,sa,sr],[1,0,1])
  result.cases.slider={beforeInputs:sb,afterInputs:sa,afterRemountInputs:sr,expectedKnownDefectReproduced:true}

  await tab('外观')
  const old=(await current()).settings
  let failures=0
  const fail=async route=>{
    if(route.request().method()==='PUT'){failures++;await route.fulfill({status:500,contentType:'application/json',body:'{"error":"REVIEW_INJECTED_STORAGE_FAILURE"}'})}
    else await route.continue()
  }
  await page.route('**/wallpaper-engine/settings',fail)
  let g=page.getByRole('slider',{name:'玻璃透明度',exact:true})
  await g.scrollIntoViewIfNeeded();await g.focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(700)
  const ui=await g.inputValue(),hostValue=(await current()).settings.glassAlpha
  const visibleErrors=await page.locator('.we-picker__error').allTextContents()
  await shot('failed-put')
  await page.reload({waitUntil:'domcontentloaded'});await settle();await openSettings();await tab('外观')
  const reloaded=await page.getByRole('slider',{name:'玻璃透明度',exact:true}).inputValue()
  await page.unroute('**/wallpaper-engine/settings',fail)
  g=page.getByRole('slider',{name:'玻璃透明度',exact:true})
  await g.scrollIntoViewIfNeeded();await g.focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(700)
  const control={ui:Number(await g.inputValue()),host:(await current()).settings.glassAlpha}
  assert.notEqual(Number(ui),hostValue);assert.equal(hostValue,old.glassAlpha)
  assert.equal(Number(reloaded),old.glassAlpha);assert.equal(control.ui,control.host)
  assert.equal(visibleErrors.length,0);assert.ok(failures>=1)
  result.cases.http500={before:old.glassAlpha,uiDuring:Number(ui),hostDuring:hostValue,failedPuts:failures,visibleErrors,afterReload:Number(reloaded),successControl:control}

  const file=path.join(run,'data/config.json'),backup=path.join(priv,'config-before-fault.json')
  assert.ok(file.startsWith(run+path.sep))
  await fs.rename(file,backup);await fs.mkdir(file)
  restoreFault=async()=>{await fs.rmdir(file);await fs.rename(backup,file);restoreFault=null}
  const responsePromise=page.waitForResponse(r=>new URL(r.url()).pathname==='/wallpaper-engine/settings'&&r.request().method()==='PUT')
  await g.focus();await page.keyboard.press('ArrowRight')
  const res=await responsePromise,body=await res.json()
  const back=await current()
  const faultErrors=await page.locator('.we-picker__error').allTextContents()
  await shot('disk-write-false-success')
  assert.equal(res.status(),200);assert.equal(body.ok,true);assert.equal(back.settings,null)
  result.cases.realFileFault={status:res.status(),ok:body.ok,readbackSettings:back.settings,visibleErrors:faultErrors}
  await restoreFault()

  await tab('壁纸库')
  await page.locator('.we-picker__file').setInputFiles(path.join(bundle,'fixtures/large-image.png'))
  await page.waitForTimeout(800)
  await page.getByRole('button',{name:'选择壁纸',exact:true}).click()
  const img=page.locator('.we-picker__card img[alt="large-image"]').first()
  await img.waitFor()
  await page.waitForFunction(()=>[...document.querySelectorAll('.we-picker__card img')].some(e=>e.alt==='large-image'&&e.naturalWidth===8000))
  const geometry=await img.evaluate(e=>({width:e.naturalWidth,height:e.naturalHeight,displayWidth:e.getBoundingClientRect().width,src:e.getAttribute('src')}))
  const response=await page.request.get(new URL(geometry.src,page.url()).href)
  const bytes=(await response.body()).length
  assert.equal(geometry.width,8000);assert.equal(geometry.height,5334)
  assert.equal(bytes,(await fs.stat(path.join(bundle,'fixtures/large-image.png'))).size)
  const headers=response.headers()
  result.cases.preview={width:geometry.width,height:geometry.height,displayWidth:geometry.displayWidth,bytes,status:response.status(),cacheControl:headers['cache-control']||null,etag:headers.etag||null,lastModified:headers['last-modified']||null}
  await shot('large-preview')
  await page.getByRole('button',{name:'返回',exact:true}).click()
  await tab('外观')
  await shot('appearance-light')
  const firstTab=page.locator('.we-tabs').getByRole('tab',{name:'壁纸库',exact:true})
  await firstTab.focus();await page.keyboard.press('ArrowRight')
  result.cases.tabKeyboard={focused:await page.evaluate(()=>document.activeElement?.textContent),selected:await page.locator('.we-tabs [aria-selected=true]').innerText()}
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250)
  result.cases.narrowPanel=await page.locator('.we-picker').evaluate(e=>({width:e.getBoundingClientRect().width,scrollWidth:e.scrollWidth}))
  await shot('appearance-390')
  await page.setViewportSize({width:1440,height:1000})
  await page.getByText('通用设置',{exact:true}).click()
  await page.getByRole('button',{name:'深色',exact:true}).click()
  await page.getByText('壁纸引擎',{exact:true}).first().click()
  await tab('外观');await shot('appearance-dark')
  await page.getByText('通用设置',{exact:true}).click()
  await page.getByRole('button',{name:'跟随系统',exact:true}).click()
  result.completed=true
}catch(error){
  await shot('failure')
  await fs.writeFile(path.join(priv,'failure-page.txt'),await page.locator('body').innerText())
  throw error
}finally{
  if(restoreFault)await restoreFault()
  await fs.writeFile(path.join(out,'public-result.json'),JSON.stringify(result,null,2),{flag:'wx'})
  await context.close();await browser.close()
}
console.log(JSON.stringify(result,null,2))

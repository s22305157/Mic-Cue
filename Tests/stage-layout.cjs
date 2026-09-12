// Run against the local Vite preview with an installed Playwright module:
// node Tests/stage-layout.cjs [path-to-playwright]
const { chromium } = require(process.argv[2] || 'playwright')
const assert = require('node:assert/strict')

;(async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
    await context.addInitScript(() => {
      localStorage.setItem('mic-cue-pwa-state-v1', JSON.stringify({
        version: 1, selectedScriptId: 'test',
        settings: { voiceURI: '', rate: 1, pitch: 1, fontScale: 1, stageLockOnEntry: false, autoAdvance: false, rescuePhrases: [] },
        scripts: [{ id: 'test', title: '手機直橫向版面驗證', updatedAt: new Date().toISOString(),
          lines: Array.from({ length: 12 }, (_, i) => ({ id: String(i), text: `第 ${i + 1} 句：` + '測試長台詞捲動及控制按鈕。'.repeat(25), isMarker: i === 0, markerLabel: '測試標記' })) }]
      }))
    })
    const page = await context.newPage()
    await page.goto('http://127.0.0.1:5173/')
    await page.locator('[data-action="enter-stage"]').click()
    for (const [width, height] of [[390, 844], [375, 667], [320, 568], [844, 390]]) {
      await page.setViewportSize({ width, height })
      const layout = await page.evaluate(() => {
        const cue = document.querySelector('.cue-current')
        const controls = document.querySelector('.stage-controls')
        const rect = controls.getBoundingClientRect()
        return { width: innerWidth, height: innerHeight, scale: visualViewport.scale, documentWidth: document.documentElement.scrollWidth,
          controlsBottom: rect.bottom, controlHeight: rect.height, cueScrolls: cue.scrollHeight > cue.clientHeight,
          fonts: [getComputedStyle(document.querySelector('.cue-current p')).fontSize, getComputedStyle(document.querySelector('.cue-next p')).fontSize] }
      })
      console.log(JSON.stringify(layout))
      assert.ok(layout.documentWidth <= width, 'page must not overflow horizontally')
      assert.equal(layout.scale, 1, 'viewport must retain original scale')
      assert.equal(layout.fonts[0], layout.fonts[1], 'current and next cue use the same size')
      assert.ok(layout.cueScrolls, 'long cue must scroll inside its card')
      // The short landscape viewport may need vertical scrolling; controls must stay reachable.
      await page.locator('.stage-controls').scrollIntoViewIfNeeded()
      const stopBounds = await page.locator('[data-action="stop"]').boundingBox()
      assert.ok(stopBounds && stopBounds.y >= 0 && stopBounds.y + stopBounds.height <= height + 1, 'stop must be reachable within the viewport after scrolling')
    }
    await page.setViewportSize({ width: 390, height: 844 })
    for (let i = 0; i < 5; i++) await page.locator('[data-action="next"]').tap()
    assert.match(await page.locator('.cue-current > span').innerText(), /6 \/ 12/)
    assert.equal(await page.evaluate(() => visualViewport.scale), 1)
    await page.locator('.cue-current').evaluate(element => { element.scrollTop = 100 })
    assert.ok(await page.locator('.cue-current').evaluate(element => element.scrollTop > 0))
    const cdp = await context.newCDPSession(page)
    for (const selector of ['.cue-current', '.stage-controls']) {
      const bounds = await page.locator(selector).boundingBox()
      await cdp.send('Input.synthesizePinchGesture', { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, scaleFactor: 1.5, gestureSourceType: 'touch' })
      assert.equal(await page.evaluate(() => visualViewport.scale), 1, `${selector} pinch must not zoom the page`)
    }
    const stop = await page.locator('[data-action="stop"]').boundingBox()
    await page.touchscreen.tap(stop.x + stop.width / 2, stop.y + stop.height / 2)
    await page.touchscreen.tap(stop.x + stop.width / 2, stop.y + stop.height / 2)
    assert.equal(await page.evaluate(() => visualViewport.scale), 1, 'double tap must not zoom the page')
    console.log('PASS: four viewport sizes, matching cue fonts, reachable stop, rapid taps, pinch prevention and cue scrolling')
  } finally {
    await browser.close()
  }
})().catch(error => { console.error(error); process.exitCode = 1 })

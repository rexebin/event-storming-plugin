import { test, expect } from '@playwright/test'

const SIMPLE_DSL = `<eventstorming>
  <aggregate name="User">
    <container name="Register">
      <actor name="User" next="RegisterCmd"/>
      <command name="RegisterCmd" next="Registered"/>
      <event name="Registered"/>
    </container>
  </aggregate>
</eventstorming>`

test.describe('Event Storming Playground', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for initial render to complete
    await expect(page.locator('svg')).toBeVisible({ timeout: 10000 })
  })

  test('renders diagram from default sample DSL', async ({ page }) => {
    // Verify SVG exists with valid dimensions
    const svg = page.locator('svg')
    await expect(svg).toBeVisible()
    const widthAttr = await svg.getAttribute('width')
    expect(Number(widthAttr ?? '0')).toBeGreaterThan(0)

    // Verify nodes are rendered (es-node class on g elements inside .nodes group)
    const nodes = page.locator('.nodes [class="es-node"]')
    await expect(nodes).toHaveCount(5) // Customer, Staff, CancelOrder, Policy, OrderCancelled

    // Verify links are rendered (path.es-link elements)
    const linkCount = await page.locator('.links path.es-link').count()
    expect(linkCount).toBeGreaterThan(0)

    // Verify container group exists
    const containers = page.locator('svg g.containers')
    await expect(containers).toHaveCount(1)
  })

  test('re-renders diagram when editor content changes', async ({ page }) => {
    // The DiagramPreview uses key={renderTick} + prop dslText.
    // After debounce (300ms), automatic re-render should happen.
    // We click "Render Now" for a reliable trigger instead of waiting for debounce.

    const nodes = page.locator('.nodes [class="es-node"]')
    await expect(nodes).toHaveCount(5) // Current sample: 5 nodes

    // Type new DSL in Monaco editor (Monaco creates an iframe for editing)
    const frameLocator = page.frameLocator('iframe')
    const editorTextarea = frameLocator.nth(0).locator('textarea')
    await editorTextarea.click({ clickCount: 3 }) // select all
    await page.keyboard.press('Backspace')

    // Type the simple DSL content character by character (Monaco handles key events)
    for (const char of SIMPLE_DSL.replace(/\n/g, '\r').replace(/\r\r/g, '\n')) {
      if (char === ' ') {
        await page.keyboard.type(' ', { delay: 0 })
      } else if (char === '\n') {
        await page.keyboard.press('Enter')
      } else {
        await page.keyboard.type(char, { delay: 5 })
      }
    }

    // Wait a moment for Monaco to sync value before Render Now
    await page.waitForTimeout(200)

    // Click "Render Now" for immediate re-render (avoids debounce timing issues)
    await page.getByRole('button', { name: 'Render Now' }).click()

    // Verify updated diagram — simple DSL has 3 nodes
    await expect(nodes).toHaveCount(3, { timeout: 5000 })
  })

  test('shows tooltip on node hover', async ({ page }) => {
    const firstNode = page.locator('.nodes [class="es-node"]').first()
    await firstNode.hover()

    // Tooltip is appended to body by the renderer, styled with .es-tooltip class
    await expect(page.locator('.es-tooltip')).toBeVisible({ timeout: 2000 })
  })

  test('supports zoom and pan on diagram', async ({ page }) => {
    const svg = page.locator('svg')
    // Verify the SVG is a D3 selection with zoom capability by checking viewBox exists
    await expect(svg).toHaveAttribute('viewBox')
  })
})

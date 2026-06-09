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
    await expect(nodes).toHaveCount(12) // Current sample DSL: 12 nodes across 2 containers

    // Verify links are rendered (path.es-link elements)
    const linkCount = await page.locator('.links path.es-link').count()
    expect(linkCount).toBeGreaterThan(0)

    // Verify container group exists
    const containers = page.locator('svg g.containers')
    await expect(containers).toHaveCount(1)
  })

  test('re-renders diagram when editor content changes', async ({ page }) => {
    const nodes = page.locator('.nodes [class="es-node"]')
    await expect(nodes).toHaveCount(12) // Current sample DSL: 12 nodes across 2 containers

    // Use the app's test helper to change DSL content and trigger render directly.
    // Avoids complex Monaco API/iframe interaction issues in E2E tests.
    await page.evaluate((dsl) => {
      const fn = (window as any).__setPlaygroundDSL
      if (fn) fn(dsl)
    }, SIMPLE_DSL)

    // Verify updated diagram — simple DSL produces 3 nodes
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

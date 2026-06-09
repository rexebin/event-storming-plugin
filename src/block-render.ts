import { parseDSL } from './parser/';
import { renderEventStorming } from './render/index.js';
import * as d3 from 'd3';

export interface RenderedBlockInstance {
  container: HTMLElement;
  destroy: () => void;
}

export function mountRenderedBlock(targetElement: HTMLElement, dslText: string): RenderedBlockInstance {
  const container = document.createElement('div');
  container.className = 'event-storming-container';

  const header = document.createElement('div');
  header.className = 'es-header';

  const badge = document.createElement('span');
  badge.className = 'es-badge';
  badge.textContent = 'Event Storming';

  const titleSpan = document.createElement('span');
  titleSpan.className = 'es-title';
  // Use safe default since model may not be available on error
  titleSpan.textContent = 'Event Storming';

  header.appendChild(badge);
  header.appendChild(titleSpan);
  container.appendChild(header);

  const toggle = document.createElement('button');
  toggle.className = 'es-toggle';
  toggle.setAttribute('aria-label', 'Toggle diagram');
  toggle.addEventListener('click', () => {
    container.classList.toggle('collapsed');
  });
  container.appendChild(toggle);

  const canvasWrapper = document.createElement('div');
  canvasWrapper.className = 'es-canvas-wrapper';
  container.appendChild(canvasWrapper);

  const legend = document.createElement('div');
  legend.className = 'es-legend';
  legend.innerHTML = `
    <div class="es-legend-item">
      <span class="es-legend-swatch" style="background:#FFA500"></span> Domain Event
    </div>
    <div class="es-legend-item">
      <span class="es-legend-swatch" style="background:#91D49C"></span> Command
    </div>
    <div class="es-legend-item">
      <span class="es-legend-swatch" style="background:#5BAA62"></span> Query / Read Model
    </div>
    <div class="es-legend-item">
      <span class="es-legend-swatch" style="background:#FEE254"></span> Aggregate / View
    </div>
    <div class="es-legend-item">
      <span class="es-legend-swatch" style="background:#D4D3D3"></span> Actor
    </div>
    <div class="es-legend-item">
      <span class="es-legend-swatch" style="background:#859EBF"></span> Policy
    </div>
    <div class="es-legend-item">
      <span class="es-legend-swatch" style="background:#FB8597"></span> External System
    </div>
    <div class="es-legend-item">
      <span class="es-legend-swatch" style="background:#8DCFF9"></span> Error
    </div>
  `;
  container.appendChild(legend);

  targetElement.setAttribute('data-es-rendered', 'true');
  targetElement.parentElement?.insertBefore(container, targetElement);
  targetElement.style.display = 'none';

  let d3Destroy: () => void;

  try {
    const model = parseDSL(dslText);
    titleSpan.textContent = model.title || 'Event Storming';

    const d3Container = d3.select(canvasWrapper);
    const instance = renderEventStorming(d3Container as any, dslText);
    d3Destroy = instance.destroy;
  } catch (e: any) {
    // Show inline error overlay instead of blank area
    const errorMsg = String(e.message ?? e);
    const truncated = errorMsg.length > 200 ? errorMsg.slice(0, 200) + '...' : errorMsg;

    const errorEl = document.createElement('div');
    errorEl.className = 'es-error-display';
    errorEl.textContent = truncated;

    canvasWrapper.appendChild(errorEl);
    d3Destroy = () => {
      // Error overlay is part of container — just remove the container itself.
      // Nothing extra to clean up, but keep the signature compatible.
    };
  }

  return {
    container,
    destroy: () => {
      d3Destroy();
      container.remove();
      targetElement.style.display = '';
      targetElement.removeAttribute('data-es-rendered');
    },
  };
}

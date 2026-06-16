/**
 * Minimal self-contained Toolbar + Button UI for the weave demo.
 */

let stylesInjected = false;
function injectStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .toolbar { position:fixed; top:12px; left:12px; display:flex; gap:6px; align-items:center; z-index:1000; }
    .toolbar-button { padding:6px 14px; background:#333; color:#e0e0e0; border:1px solid #444; border-radius:6px; cursor:pointer; font-size:12px; font-family:sans-serif; white-space:nowrap; transition:background-color 0.1s; }
    .toolbar-button:hover { background:#404040; }
    .toolbar-slider { display:flex; align-items:center; gap:6px; padding:4px 10px; background:#333; border:1px solid #444; border-radius:6px; font-size:12px; font-family:sans-serif; color:#e0e0e0; white-space:nowrap; }
    .toolbar-slider input[type=range] { width:100px; accent-color:#888; }
    .toolbar-slider .slider-value { min-width:20px; text-align:right; }
  `;
  document.head.appendChild(style);
}

export class Toolbar {
  readonly domElement: HTMLDivElement;

  constructor() {
    injectStyles();
    this.domElement = document.createElement('div');
    this.domElement.className = 'toolbar';
  }

  add(child: Button | Slider): void {
    this.domElement.appendChild(child.domElement);
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.domElement);
  }
}

export class Button {
  readonly domElement: HTMLButtonElement;

  constructor(label: string, onClick: () => void) {
    injectStyles();
    this.domElement = document.createElement('button');
    this.domElement.className = 'toolbar-button';
    this.domElement.textContent = label;
    this.domElement.addEventListener('click', onClick);
  }

  setLabel(label: string): void {
    this.domElement.textContent = label;
  }
}

export class Slider {
  readonly domElement: HTMLDivElement;
  private input: HTMLInputElement;
  private valueSpan: HTMLSpanElement;

  constructor(
    label: string,
    min: number,
    max: number,
    value: number,
    step: number,
    onChange: (value: number) => void,
  ) {
    injectStyles();
    this.domElement = document.createElement('div');
    this.domElement.className = 'toolbar-slider';

    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;
    this.domElement.appendChild(labelSpan);

    this.input = document.createElement('input');
    this.input.type = 'range';
    this.input.min = String(min);
    this.input.max = String(max);
    this.input.value = String(value);
    this.input.step = String(step);
    this.domElement.appendChild(this.input);

    this.valueSpan = document.createElement('span');
    this.valueSpan.className = 'slider-value';
    this.valueSpan.textContent = String(value);
    this.domElement.appendChild(this.valueSpan);

    this.input.addEventListener('input', () => {
      const v = Number(this.input.value);
      this.valueSpan.textContent = String(v);
      onChange(v);
    });
  }

  get value(): number {
    return Number(this.input.value);
  }
}

import styles, { stylesheet } from './style.module.css';

const STYLE_CURRENT = {
  stroke: '#0f08',
  fill: '#0f02',
};
const STYLE_SELECTION = {
  stroke: '#bbf8',
  fill: '#bbf2',
};
const STYLE_SELECTED = {
  stroke: '#ff08',
  fill: '#ff02',
};
const STYLE_TO_DESELECT = {
  stroke: '#88d8',
  fill: '#88d2',
};
const STYLE_TO_SELECT = {
  stroke: '#bb08',
  fill: '#bb02',
};
const mask = VM.getHostElement(false);
mask.addStyle(stylesheet);
mask.root.className = styles.root;
mask.root.addEventListener('mousedown', handleMouseDown);
mask.root.addEventListener('mouseup', handleMouseUp);
mask.root.addEventListener('mousemove', handleMouseMove);
mask.root.addEventListener('click', handleClick);

GM_registerMenuCommand('Toggle sniffer', toggle);

let context;

function toggle() {
  if (context) close();
  else start();
}

function start() {
  if (context) return;
  const items = Array.from(document.querySelectorAll('a[href]'))
    .filter((a) => {
      const href = a.getAttribute('href');
      return href && !/^(?:#|javascript:)/.test(href);
    })
    .map((el) => ({ el }));
  context = {
    items,
    index: -1,
    active: null,
  };
  update();
  mask.show();
  document.addEventListener('scroll', update);
  document.addEventListener('resize', update);
  GM_registerMenuCommand('Copy URLs', handleCopy);
}

function close() {
  if (!context) return;
  mask.root.innerHTML = '';
  mask.hide();
  context = null;
  document.removeEventListener('scroll', update);
  document.removeEventListener('resize', update);
  GM_unregisterMenuCommand('Copy URLs');
}

function update() {
  context.items.forEach((item) => {
    const rect = item.el.getBoundingClientRect();
    item.pos = {
      x: rect.left,
      y: rect.top,
      w: rect.width,
      h: rect.height,
    };
  });
  render();
}

function render() {
  renderActive();
  renderSelected();
}

function updateStyle(el, style) {
  el.style.borderColor = style.stroke;
  el.style.background = style.fill;
}

function updatePosition(el, pos, padding = 2) {
  Object.assign(el.style, {
    width: `${pos.w + padding * 2}px`,
    height: `${pos.h + padding * 2}px`,
    transform: `translate(${pos.x - padding}px,${pos.y - padding}px)`,
  });
}

function renderActive() {
  const activeItem = !context.dragging && context.items[context.index];
  if (!activeItem) {
    if (context.active) {
      context.active.remove();
      context.active = null;
    }
  } else {
    if (!context.active) {
      context.active = <mask.id />;
      updateStyle(context.active, STYLE_CURRENT);
      mask.root.append(context.active);
    }
    updatePosition(context.active, activeItem.pos);
  }
}

function renderSelected() {
  context.items.forEach((item) => {
    if (item.rect) updatePosition(item.rect, item.pos);
  });
}

function setItemRect(item, style) {
  if (style) {
    if (!item.rect) {
      item.rect = <mask.id />;
      mask.root.append(item.rect);
    }
    updateStyle(item.rect, style);
    updatePosition(item.rect, item.pos);
  } else if (item.rect) {
    item.rect.remove();
    item.rect = null;
  }
}

function handleClick() {
  const activeItem = context.items[context.index];
  if (activeItem) {
    activeItem.selected = !activeItem.selected;
    setItemRect(activeItem, activeItem.selected && STYLE_SELECTED);
  }
}

function handleMouseDown(e) {
  if (context.dragging) return;
  const x = e.clientX;
  const y = e.clientY;
  context.dragging = {
    x,
    y,
  };
}

function handleMouseMove(e) {
  const x = e.clientX;
  const y = e.clientY;
  if (context.dragging) {
    if (!context.dragging.rect) {
      const rect = <mask.id />;
      updateStyle(rect, STYLE_SELECTION);
      mask.root.append(rect);
      context.dragging.rect = rect;
    }
    context.index = -1;
    let x0 = context.dragging.x;
    let y0 = context.dragging.y;
    const w = Math.abs(x - x0);
    const h = Math.abs(y - y0);
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    updatePosition(
      context.dragging.rect,
      {
        x: x0,
        y: y0,
        w,
        h,
      },
      0
    );
    context.items.forEach((item) => {
      item.inSelection =
        item.pos.x >= x0 &&
        item.pos.x + item.pos.w <= x0 + w &&
        item.pos.y >= y0 &&
        item.pos.y + item.pos.h <= y0 + h;
      const state = (item.inSelection ? 2 : 0) + (item.selected ? 1 : 0);
      setItemRect(
        item,
        {
          1: STYLE_SELECTED,
          2: STYLE_TO_SELECT,
          3: STYLE_TO_DESELECT,
        }[state]
      );
    });
  } else {
    context.index = context.items.findIndex(
      ({ pos }) =>
        x >= pos.x && x <= pos.x + pos.w && y >= pos.y && y <= pos.y + pos.h
    );
  }
  render();
}

function handleMouseUp() {
  if (!context.dragging) return;
  if (context.dragging.rect) {
    context.dragging.rect.remove();
    context.items.forEach((item) => {
      if (item.inSelection) {
        item.inSelection = false;
        item.selected = !item.selected;
        setItemRect(item, item.selected && STYLE_SELECTED);
      }
    });
  }
  context.dragging = null;
}

function handleCopy() {
  const urls = context.items
    .filter((item) => item.selected)
    .map((item) => item.el.href);
  GM_setClipboard(urls.join('\r\n'));
  VM.showToast('URLs copied', {
    shadow: false,
    className: styles.toast,
  });
}

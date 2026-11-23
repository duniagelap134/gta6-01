// Keyboard + mouse input. Keys are tracked by code (KeyW, ArrowUp, ...).
// `pressed` holds codes tapped since the last frame so actions like
// "press E to enter a car" fire exactly once per tap.
export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(),
    // Snapshot taken at the start of each frame: keys tapped while the
    // previous frame was still rendering land here instead of being lost.
    framePressed: new Set(),
    frameClicked: false,
    mouse: { x: 0, y: 0, down: false, clicked: false },
  };
  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) input.pressed.add(event.code);
    input.keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => input.keys.delete(event.code));
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouse.down = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouse.x = event.clientX - rect.left;
    input.mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      input.mouse.down = true;
      input.mouse.clicked = true;
    }
  });
  window.addEventListener('mouseup', () => {
    input.mouse.down = false;
  });
  return input;
}

export function isDown(input, ...codes) {
  return codes.some((code) => input.keys.has(code));
}

export function wasPressed(input, ...codes) {
  return codes.some((code) => input.framePressed.has(code));
}

// Move this frame's taps into the snapshot the update reads, and keep
// anything tapped mid-frame for the next one. Call once per frame,
// before any update or click handling.
export function beginFrameInput(input) {
  input.framePressed = new Set(input.pressed);
  input.pressed.clear();
  input.frameClicked = input.mouse.clicked;
  input.mouse.clicked = false;
}

export function endFrameInput(input) {
  input.mouse.clicked = false;
}

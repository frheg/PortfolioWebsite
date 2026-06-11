const movement = {
  forward: false,
  backward: false,
  yawLeft: false,
  yawRight: false,
  pitchUp: false,
  pitchDown: false,
  boost: false,
}

const listeners = new Set()

function emit() {
  listeners.forEach((listener) => listener())
}

const look = {
  dx: 0,
  dy: 0,
}

export function setExploreMove(direction, active) {
  if (direction in movement && movement[direction] !== active) {
    movement[direction] = active
    emit()
  }
}

export function getExploreMovement() {
  return movement
}

export function getExploreInputSnapshot() {
  return { ...movement }
}

export function getExploreBoostSnapshot() {
  return movement.boost && movement.forward && !movement.backward
}

export function subscribeExploreInput(listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function addExploreLook(dx, dy) {
  look.dx += dx
  look.dy += dy
}

export function consumeExploreLook() {
  const delta = { dx: look.dx, dy: look.dy }
  look.dx = 0
  look.dy = 0
  return delta
}

export function resetExploreInput() {
  let changed = false

  Object.keys(movement).forEach((key) => {
    if (movement[key]) {
      movement[key] = false
      changed = true
    }
  })

  look.dx = 0
  look.dy = 0

  if (changed) emit()
}

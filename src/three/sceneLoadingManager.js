// Shared THREE.LoadingManager for the background scene's initial texture
// loads (skybox + solar system). Only ever reached via BackgroundCanvas's
// lazy import chain — keep it that way (see sceneLoadingState.js for why).
import * as THREE from 'three'
// Ready = textures loaded. No terrain wait: first stop is deep space, Bergen preloads in background (useScrollCamera).
import { setSceneLoadProgress, setSceneLoadReady, setSceneLoadStatus } from '../utils/sceneLoadingState'

export const sceneLoadingManager = new THREE.LoadingManager()

sceneLoadingManager.onStart = () => setSceneLoadStatus('Bygger galaksen')

sceneLoadingManager.onProgress = (_url, itemsLoaded, itemsTotal) => {
  setSceneLoadProgress(itemsTotal > 0 ? itemsLoaded / itemsTotal : 0)
}

sceneLoadingManager.onLoad = () => {
  setSceneLoadProgress(1)
  setSceneLoadReady()
}

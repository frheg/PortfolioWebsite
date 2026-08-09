// Shared THREE.LoadingManager for the background scene's initial texture
// loads (skybox + solar system). Only ever reached via BackgroundCanvas's
// lazy import chain — keep it that way (see sceneLoadingState.js for why).
import * as THREE from 'three'
import { setSceneLoadProgress, setSceneLoadReady } from '../utils/sceneLoadingState'

export const sceneLoadingManager = new THREE.LoadingManager()

sceneLoadingManager.onProgress = (_url, itemsLoaded, itemsTotal) => {
  setSceneLoadProgress(itemsTotal > 0 ? itemsLoaded / itemsTotal : 0)
}

sceneLoadingManager.onLoad = () => {
  setSceneLoadReady()
}

import * as THREE from 'three';

/**
 * Recursively dispose all geometries, materials, and textures
 * found in a Three.js object graph.
 */
export function disposeObject3D(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    child.geometry?.dispose();

    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];

    for (const mat of materials) {
      if (!(mat instanceof THREE.Material)) continue;

      // Dispose every texture property on the material
      for (const value of Object.values(mat)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      mat.dispose();
    }
  });
}

/**
 * Traverse and dispose all GPU resources in a scene graph,
 * including geometries, materials, textures, and light shadow maps.
 * More comprehensive than disposeObject3D — handles lights too.
 */
export function disposeSceneGraph(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose();

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];

      for (const mat of materials) {
        if (!(mat instanceof THREE.Material)) continue;
        for (const value of Object.values(mat)) {
          if (value instanceof THREE.Texture) value.dispose();
        }
        mat.dispose();
      }
    }

    // Dispose light shadow map render targets
    if (child instanceof THREE.Light) {
      const light = child as THREE.Light & {
        shadow?: { map?: THREE.WebGLRenderTarget | null };
      };
      if (light.shadow?.map) {
        light.shadow.map.dispose();
      }
    }
  });
}

/**
 * Dispose a WebGLRenderer and optionally remove its canvas from the DOM.
 */
export function disposeRenderer(
  renderer: THREE.WebGLRenderer | null,
  container?: HTMLElement | null,
): void {
  if (!renderer) return;
  renderer.dispose();
  const canvas = renderer.domElement;
  if (container?.contains(canvas)) {
    container.removeChild(canvas);
  }
}

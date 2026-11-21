
import * as THREE from "three";

export function createSceneManager(container) {
    if (!container) {
        throw new Error("Simulation container is required");
    }

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1018);

    const camera = new THREE.PerspectiveCamera(
        50,
        container.clientWidth / container.clientHeight || 1,
        0.1,
        10000
    );

    camera.position.set(1800, 1400, 1800);

    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance"
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(
        Math.max(container.clientWidth, 1),
        Math.max(container.clientHeight, 1)
    );

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    const sunlight = new THREE.DirectionalLight(0xffffff, 2.5);
    sunlight.position.set(1200, 1800, 1000);
    sunlight.castShadow = true;
    scene.add(sunlight);

    let updateCallback = () => {};
    let animationFrameId;
    let disposed = false;

    function animate() {
        if (disposed) return;

        animationFrameId = requestAnimationFrame(animate);

        updateCallback();
        renderer.render(scene, camera);
    }

    animate();

    const resizeObserver = new ResizeObserver(() => {
        const width = container.clientWidth;
        const height = container.clientHeight;

        if (!width || !height) return;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        renderer.setSize(width, height);
    });

    resizeObserver.observe(container);

    function setUpdateCallback(callback) {
        updateCallback =
            typeof callback === "function" ? callback : () => {};
    }

    function dispose() {
        if (disposed) return;

        disposed = true;
        cancelAnimationFrame(animationFrameId);
        resizeObserver.disconnect();

        renderer.dispose();

        if (renderer.domElement.parentElement === container) {
            container.removeChild(renderer.domElement);
        }
    }

    return {
        scene,
        camera,
        renderer,
        setUpdateCallback,
        dispose
    };
}

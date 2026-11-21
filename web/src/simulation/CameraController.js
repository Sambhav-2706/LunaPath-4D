
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export function createCameraController(camera, renderer) {
    const controls = new OrbitControls(
        camera,
        renderer.domElement
    );

    controls.enableDamping = true;
    controls.dampingFactor = 0.06;

    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.enablePan = true;

    controls.minDistance = 15;
    controls.maxDistance = 300;
    controls.maxPolarAngle = Math.PI / 2.05;

    const followOffset = new THREE.Vector3(65, 48, 65);
    let followTarget = null;

    function setFollowTarget(object) {
        followTarget = object;

        const targetPosition = object.position.clone();

        controls.target.copy(targetPosition);

        camera.position.copy(
            targetPosition.clone().add(followOffset)
        );

        controls.update();
    }

    function update() {
        if (followTarget) {
            const targetPosition = followTarget.position;

            const movement = new THREE.Vector3()
                .subVectors(targetPosition, controls.target);

            camera.position.add(movement);
            controls.target.copy(targetPosition);
        }

        controls.update();
    }

    function dispose() {
        controls.dispose();
    }

    return {
        controls,
        setFollowTarget,
        update,
        dispose
    };
}

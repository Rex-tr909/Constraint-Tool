import * as BABYLON from './node_modules/@babylonjs/core/Legacy/legacy.js';
import HavokPhysics from "./node_modules/@babylonjs/havok/lib/esm/HavokPhysics_es.js";

const canvas = document.getElementById("appCanvas");
let scene = null;
let havokInstance = null;
let staticObjectPhysicsBody = null;
let dynamicObjectPhysicsBody = null;

InitScene();

async function InitScene() {
    const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, disableWebGL2Support: false });
    scene = new BABYLON.Scene(engine);

    const loadedHavok = await HavokPhysics();
    havokInstance = new BABYLON.HavokPlugin(true, loadedHavok);
    scene.enablePhysics(new BABYLON.Vector3(0, -100, 0), havokInstance);
    scene.getPhysicsEngine().setSubTimeStep(5);

    const camera = new BABYLON.ArcRotateCamera("Camera", 5, 1, 40, BABYLON.Vector3.Zero(), scene);
    camera.attachControl(canvas, true);
    const hemisphericLight = new BABYLON.HemisphericLight("Hemispheric Light", new BABYLON.Vector3(1, 1, 0), scene);
    hemisphericLight.intensity = 0.7;

    CreateConstraintTool();
    InitKeyboardControls();
    InitClickForces();

    engine.runRenderLoop(() => {
        if (scene && scene.activeCamera) {
            scene.render();
        }
    });

    window.addEventListener("resize", () => {
        engine.resize();
    });
}

function AddDynamicPhysics(mesh, mass, bounce, friction) {
    const physicsShape = new BABYLON.PhysicsShapeMesh(mesh, scene);
    const physicsBody = new BABYLON.PhysicsBody(mesh, BABYLON.PhysicsMotionType.DYNAMIC, false, scene);
    physicsShape.material = { mass: mass, restitution: bounce, friction: friction };
    physicsBody.shape = physicsShape;

    return physicsBody;
}

function AddStaticPhysics(mesh) {
    const physicsShape = new BABYLON.PhysicsShapeMesh(mesh, scene);
    const physicsBody = new BABYLON.PhysicsBody(mesh, BABYLON.PhysicsMotionType.STATIC, false, scene);
    physicsShape.material = { restitution: 0, friction: 0 };
    physicsBody.shape = physicsShape;
    FilterMeshCollision(mesh);

    return physicsBody;
}

function FilterMeshCollision(mesh) {
    mesh.physicsBody.shape.filterMembershipMask = 1;
    mesh.physicsBody.shape.filterCollideMask = 2;
}

function InitClickForces() {
    scene.onPointerPick = (event, pickInfo) => {
        dynamicObjectPhysicsBody.applyImpulse(
            scene.activeCamera.getDirection(BABYLON.Vector3.Forward()).scale(5000000),
            pickInfo.pickedPoint
        );
    }
}

function InitKeyboardControls() {
    scene.onKeyboardObservable.add(e => {
        if (e.type == BABYLON.KeyboardEventTypes.KEYDOWN && (e.event.key == " "))
            SpaceAction();
    });
}

function SpaceAction() {
    dynamicObjectPhysicsBody.setLinearVelocity(BABYLON.Vector3.Zero());
    dynamicObjectPhysicsBody.setAngularVelocity(BABYLON.Vector3.Zero());
}

function CreateConstraintTool() {
    const debugColours = [];
    debugColours[0] = new BABYLON.Color4(1, 0, 1, 1);
    debugColours[1] = new BABYLON.Color4(1, 0, 0, 1);
    debugColours[2] = new BABYLON.Color4(0, 1, 0, 1);
    debugColours[3] = new BABYLON.Color4(1, 1, 0, 1);
    debugColours[4] = new BABYLON.Color4(0, 1, 1, 1);
    debugColours[5] = new BABYLON.Color4(0, 0, 1, 1);

    const staticObjectMesh = BABYLON.MeshBuilder.CreateBox("Static Mesh", { height: 1, width: 4, depth: 8, faceColors: debugColours });
    staticObjectMesh.position = new BABYLON.Vector3(0, 0, 0);
    staticObjectPhysicsBody = AddStaticPhysics(staticObjectMesh);

    const dynamicObjectMesh = BABYLON.MeshBuilder.CreateBox("Moving Mesh", { height: 1, width: 4, depth: 8, faceColors: debugColours });
    dynamicObjectMesh.position = new BABYLON.Vector3(0, 0, 0);
    dynamicObjectPhysicsBody = AddDynamicPhysics(dynamicObjectMesh, 0.1, 0.1, 0);

    ConstraintCreationAndDebug();
}

function ConstraintCreationAndDebug() {
    const debugHTML = document.getElementById("debug");

    const title = document.createElement("p");
    title.innerText = "JOINT EDIT";
    const debugSection = document.createElement("div");
    debugSection.append(title);
    debugHTML.append(debugSection);

    CreateDebugItems();
}

let jointValues = [];
let jointCode = "N/A";

function CreateDebugItems() {
    jointValues = [];

    for (let i = 0; i < 32; i++) {
        let index = i;
        jointValues[index] = 0;
        ValueSlider(jointValues, index, () => CreateJoint(jointValues));
    }

    const debugSection = document.createElement("div");
    const debugHTML = document.getElementById("debug");
    debugHTML.append(debugSection);
}

function ValueSlider(jointValues, index, createJointFunction) {
    // Skip over values that aren't required for majority of use cases
    if (index > 5 && index < 9) return;
    if (index > 14 && index < 18) return;
    if (index == 18 || index == 19) return;
    if (index > 25) return;

    const subTitle = document.createElement("p");

    if (index == 0) subTitle.innerText = "PIVOT A (moving body)";
    if (index == 3) subTitle.innerText = "AXIS A";
    if (index == 6) subTitle.innerText = "PERP AXIS A (LIMIT)";

    if (index == 9) subTitle.innerText = "PIVOT B (static body)";
    if (index == 12) subTitle.innerText = "AXIS B";
    if (index == 15) subTitle.innerText = "PERP AXIS B (LIMIT)";

    if (index == 18) subTitle.innerText = "MIN DISTANCE (LIMIT)";
    if (index == 19) subTitle.innerText = "MAX DISTANCE (LIMIT)";
    if (index == 20) subTitle.innerText = "ANGULAR (CONSTRAINT) (x min, x max, y min, y max, z min, z max)";
    if (index == 26) subTitle.innerText = "LINEAR (CONSTRAINT) (x min, x max, y min, y max, z min, z max)";

    const feedback = document.createElement("span");
    feedback.innerText = jointValues[index];

    // Pivot Settings
    const slider = document.createElement("input");
    slider.setAttribute("type", "range");
    slider.setAttribute("value", "0");
    slider.setAttribute("min", "-10");
    slider.setAttribute("max", "10");
    slider.setAttribute("step", "0.5");
    slider.setAttribute("style", "width: 170px");
    slider.oninput = () => { jointValues[index] = slider.value; feedback.innerText = jointValues[index]; createJointFunction() };
    slider.onclick = (e) => { if (e.ctrlKey) { jointValues[index] = slider.value = 0; feedback.innerText = jointValues[index]; createJointFunction() } };

    // Axis Settings
    if (index > 2 && index < 6 || index > 11 && index < 15) {
        slider.setAttribute("min", "0");
        slider.setAttribute("max", "1");
        slider.setAttribute("step", "0.1");
    }

    const slightlyLessThanPi = 3;

    // Angular Constraint Settings
    if (index > 19) {
        slider.setAttribute("min", -slightlyLessThanPi);
        slider.setAttribute("max", slightlyLessThanPi);
        slider.setAttribute("step", slightlyLessThanPi / 8);
    }

    const debugSection = document.createElement("div");
    debugSection.append(subTitle);
    debugSection.append(slider);
    debugSection.append(feedback);
    const debugHTML = document.getElementById("debug");
    debugHTML.append(debugSection);
}

let dynamicJoint;
let pivotStaticObject;
let firstCreation = true;

function CreateJoint(v) {
    if (dynamicJoint != null) {
        havokInstance.disposeConstraint(dynamicJoint);
    }

    const c = new BABYLON.Color3(1, 0.5, 0);

    if (firstCreation) {
        pivotStaticObject = BABYLON.MeshBuilder.CreateBox("Pivot Static", { size: 0.5, faceColors: [c, c, c, c, c, c] });
        pivotStaticObject.position = new BABYLON.Vector3(0, 0, 0);
        pivotStaticObject.renderingGroupId = 1;
    }

    dynamicJoint = new BABYLON.Physics6DoFConstraint(
        {
            pivotA: new BABYLON.Vector3(v[0], v[1], v[2]),
            axisA: new BABYLON.Vector3(v[3], v[4], v[5]),
            pivotB: new BABYLON.Vector3(v[9], v[10], v[11]),
            axisB: new BABYLON.Vector3(v[12], v[13], v[14]),
        },
        [
            {
                axis: BABYLON.PhysicsConstraintAxis.LINEAR_DISTANCE,
                minLimit: v[18],
                maxLimit: v[19],
            },
            {
                axis: BABYLON.PhysicsConstraintAxis.ANGULAR_X,
                minLimit: v[20],
                maxLimit: v[21],
            },
            {
                axis: BABYLON.PhysicsConstraintAxis.ANGULAR_Y,
                minLimit: v[22],
                maxLimit: v[23],
            },
            {
                axis: BABYLON.PhysicsConstraintAxis.ANGULAR_Z,
                minLimit: v[24],
                maxLimit: v[25],
            }
        ],
        scene
    );

    dynamicObjectPhysicsBody.addConstraint(staticObjectPhysicsBody, dynamicJoint);
    pivotStaticObject.position = new BABYLON.Vector3(v[9], v[10], v[11]);

    firstCreation = false;

    jointCode = `const customJoint = new BABYLON.Physics6DoFConstraint(
        {
            pivotA: new BABYLON.Vector3(${v[0]}, ${v[1]}, ${v[2]}),
            axisA: new BABYLON.Vector3(${v[3]}, ${v[4]}, ${v[5]}),
            pivotB: new BABYLON.Vector3(${v[9]}, ${v[10]}, ${v[11]}),
            axisB: new BABYLON.Vector3(${v[12]}, ${v[13]}, ${v[14]}),
        },
        [
            {
                axis: BABYLON.PhysicsConstraintAxis.LINEAR_DISTANCE,
                minLimit: ${v[18]},
                maxLimit: ${v[19]},
            },
            {
                axis: BABYLON.PhysicsConstraintAxis.ANGULAR_X,
                minLimit: ${v[20]},
                maxLimit: ${v[21]},
            },
            {
                axis: BABYLON.PhysicsConstraintAxis.ANGULAR_Y,
                minLimit: ${v[22]},
                maxLimit: ${v[23]},
            },
            {
                axis: BABYLON.PhysicsConstraintAxis.ANGULAR_Z,
                minLimit: ${v[24]},
                maxLimit: ${v[25]},
            }
        ],
        scene
    );`

    const codeCopy = document.getElementById("codeCopy");
    codeCopy.innerText = jointCode;
}
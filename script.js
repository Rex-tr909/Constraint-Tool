import * as BABYLON from './node_modules/@babylonjs/core/Legacy/legacy.js';
import HavokPhysics from "./node_modules/@babylonjs/havok/lib/esm/HavokPhysics_es.js";

const canvas = document.getElementById("appCanvas");
let scene = null;
let havokInstance = null;
let staticObjectPhysicsBody = null;
let dynamicObjectPhysicsBody = null;

InitScene();

async function InitScene() {
    const engine = new BABYLON.WebGPUEngine(canvas);
    await engine.initAsync();
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
    debugColours[0] = new BABYLON.Color3(1, 0, 1);
    debugColours[1] = new BABYLON.Color3(1, 0, 0);
    debugColours[2] = new BABYLON.Color3(0, 1, 0);
    debugColours[3] = new BABYLON.Color3(1, 1, 0);
    debugColours[4] = new BABYLON.Color3(0, 1, 1);
    debugColours[5] = new BABYLON.Color3(0, 0, 1);

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
    CreateExamplesList();
}

let jointValues = [0, 0, -4,
    1, 0, 0,
    0, 0, 0,
    1, 0, 0,
    -3, 3, 0, 0, 0, 0];

let jointCode = "N/A";

function CreateDebugItems() {
    for (let i = 0; i < 18; i++) {
        let index = i;
        ValueSlider(jointValues, index, () => CreateJoint(jointValues));
    }

    const debugSection = document.createElement("div");
    const debugHTML = document.getElementById("debug");
    debugHTML.append(debugSection);
}

function ValueSlider(jointValues, index, createJointFunction) {
    const subTitle = document.createElement("p");

    if (index == 0) subTitle.innerText = "PIVOT A (moving body)";
    if (index == 3) subTitle.innerText = "AXIS A";
    if (index == 6) subTitle.innerText = "PIVOT B (static body)";
    if (index == 9) subTitle.innerText = "AXIS B";
    if (index == 12) subTitle.innerText = "ANGULAR (CONSTRAINT) (x min, x max, y min, y max, z min, z max)";

    const feedback = document.createElement("span");
    feedback.innerText = jointValues[index];

    // Pivot Settings
    const slider = document.createElement("input");
    slider.setAttribute("type", "range");
    slider.setAttribute("min", "-10");
    slider.setAttribute("max", "10");
    slider.setAttribute("step", "0.5");
    slider.setAttribute("style", "width: 170px");
    slider.oninput = () => { jointValues[index] = slider.value; feedback.innerText = jointValues[index]; createJointFunction() };
    slider.onclick = (e) => { if (e.ctrlKey) { jointValues[index] = slider.value = 0; feedback.innerText = jointValues[index]; createJointFunction() } };

    // Axis Settings
    if (index > 2 && index < 6 || index > 8 && index < 12) {
        slider.setAttribute("min", "0");
        slider.setAttribute("max", "1");
        slider.setAttribute("step", "0.1");
    }

    const slightlyLessThanPi = 3;

    // Angular Constraint Settings
    if (index > 11) {
        slider.setAttribute("min", -slightlyLessThanPi);
        slider.setAttribute("max", slightlyLessThanPi);
        slider.setAttribute("step", slightlyLessThanPi / 8);
    }

    createJointFunction();

    slider.setAttribute("value", jointValues[index]);
    slider.setAttribute("id", "slider" + index);
    feedback.setAttribute("id", "feedback" + index);

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

    if (firstCreation) {
        const c = new BABYLON.Color3(1, 0.5, 0);
        pivotStaticObject = BABYLON.MeshBuilder.CreateBox("Pivot Static", { size: 0.5, faceColors: [c, c, c, c, c, c] });
        pivotStaticObject.position = new BABYLON.Vector3(0, 0, 0);
        pivotStaticObject.renderingGroupId = 1;
    }

    dynamicJoint = new BABYLON.Physics6DoFConstraint(
        {
            pivotA: new BABYLON.Vector3(v[0], v[1], v[2]),
            axisA: new BABYLON.Vector3(v[3], v[4], v[5]),
            pivotB: new BABYLON.Vector3(v[6], v[7], v[8]),
            axisB: new BABYLON.Vector3(v[9], v[10], v[11]),
        },
        [
            {
                axis: BABYLON.PhysicsConstraintAxis.LINEAR_DISTANCE,
                minLimit: 0,
                maxLimit: 0,
            },
            {
                axis: BABYLON.PhysicsConstraintAxis.ANGULAR_X,
                minLimit: v[12],
                maxLimit: v[13],
            },
            {
                axis: BABYLON.PhysicsConstraintAxis.ANGULAR_Y,
                minLimit: v[14],
                maxLimit: v[15],
            },
            {
                axis: BABYLON.PhysicsConstraintAxis.ANGULAR_Z,
                minLimit: v[16],
                maxLimit: v[17],
            }
        ],
        scene
    );

    dynamicObjectPhysicsBody.addConstraint(staticObjectPhysicsBody, dynamicJoint);
    pivotStaticObject.position = new BABYLON.Vector3(v[6], v[7], v[8]);

    firstCreation = false;

    jointCode = `const customJoint = new BABYLON.Physics6DoFConstraint(
        {
            pivotA: new BABYLON.Vector3(${v[0]}, ${v[1]}, ${v[2]}),
            axisA: new BABYLON.Vector3(${v[3]}, ${v[4]}, ${v[5]}),
            pivotB: new BABYLON.Vector3(${v[6]}, ${v[7]}, ${v[8]}),
            axisB: new BABYLON.Vector3(${v[9]}, ${v[10]}, ${v[11]}),
        },
        [
            {
                axis: BABYLON.PhysicsConstraintAxis.LINEAR_DISTANCE,
                minLimit: 0,
                maxLimit: 0,
            },
            {
                axis: BABYLON.PhysicsConstraintAxis.ANGULAR_X,
                minLimit: ${v[12]},
                maxLimit: ${v[13]},
            },
            {
                axis: BABYLON.PhysicsConstraintAxis.ANGULAR_Y,
                minLimit: ${v[14]},
                maxLimit: ${v[15]},
            },
            {
                axis: BABYLON.PhysicsConstraintAxis.ANGULAR_Z,
                minLimit: ${v[16]},
                maxLimit: ${v[17]},
            }
        ],
        scene
    );`

    const codeCopy = document.getElementById("codeCopy");
    codeCopy.innerText = jointCode;
}

function CreateExamplesList() {
    const subTitle = document.createElement("p");
    subTitle.innerText = "EXAMPLES (warning: overwrites above values)";

    const examplesList = document.createElement("select");
    examplesList.setAttribute("id", "examplesList");
    examplesList.setAttribute("style", "width: 100%");

    examplesDictionary.forEach(example => {
        const newExample = document.createElement("option");
        newExample.setAttribute("value", example.title);
        newExample.innerText = example.title;
        examplesList.appendChild(newExample);
    });

    examplesList.onchange = () => {
        const selectedTitle = examplesList.value;
        const selectedExample = examplesDictionary.find(e => e.title == selectedTitle);
        const newjointValues = selectedExample.values;

        for (let i = 0; i < jointValues.length; i++) {
            const slider = document.getElementById("slider" + i);
            slider.value = newjointValues[i];

            const feedback = document.getElementById("feedback" + i);
            feedback.innerText = newjointValues[i];

            jointValues[i] = newjointValues[i];
        }

        CreateJoint(newjointValues);
    }

    const debugHTML = document.getElementById("debug");
    debugHTML.append(subTitle);
    debugHTML.append(examplesList);
}

const examplesDictionary = [
    {
        title: "Default",
        values:
            [0, 0, -4,
                1, 0, 0,
                0, 0, 0,
                1, 0, 0,
                -3, 3, 0, 0, 0, 0]
    },
    {
        title: "Trapdoor",
        values:
            [0, 0, -4.5,
                1, 0, 0,
                0, 0, 4.5,
                1, 0, 0,
                -3, 0, 0, 0, 0, 0]
    },
    {
        title: "Door",
        values:
            [0, 0, -4.5,
                0, 1, 0,
                0, 0, 4.5,
                0, 1, 0,
                0, 2.625, 0, 0, 0, 0]
    }, 
    {
        title: "Fish Tail",
        values:
            [0, 0, 2.5,
                0, 1, 0,
                0, 0, -2.5,
                1, 0, 0,
                0, 0, -0.375, 0.375, 0, 0]
    }, 
    {
        title: "Boxing Bag",
        values:
            [0, 0, 10,
                0, 1, 0,
                0, -1, 0,
                1, 0, 0,
                0.75, 2.625, -1.125, 1.125, 0, 0]
    }, 
    {
        title: "Propeller",
        values:
            [0, 0, 4,
                0, 1, 0,
                0, 0, -4,
                0, 1, 0,
                0, 0, 0, 0, null, null]
    },    
    {
        title: "Loose Trapdoor",
        values:
            [0, 0, -5,
                1, 0, 0,
                0, 0, 5,
                1, 0, 0,
                -2.625, 0, 0, 0, -0.375, 0.375]
    }, 
    {
        title: "Orbit",
        values:
            [0, 0, 10,
                0, 1, 0,
                0, 0, 0,
                0, 1, 0,
                null, null, -0.375, 0.375, 0, 0]
    },     
    {
        title: "Drill",
        values:
            [0, 0, -0.5,
                0.5, 0.2, 1,
                0, 0, 8,
                0, 0, 1,
                null, null, -0, 0, 0, 0]
    },      
    {
        title: "Elbow",
        values:
            [0, 0, -5.5,
                0.8, 1, 0,
                0, 0, 5.5,
                1, 0, 0,
                0, 2.625, 0, 0, 0, 0.75]
    },      
    {
        title: "Turret",
        values:
            [0, 3.5, -1,
                0, 1, 0.5,
                0, 0, 2,
                0, 1, 0.9,
                -0.75, 0.75, 0, 0, -0.375, 0.375]
    }
]
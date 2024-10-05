import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let video = null;
let app = null;
let custom_marker_id = null;
const custom_marker_file = 'markers/heart.patt';



// webcam connection using WebRTC
window.onload = function () {
	document.getElementById('start_button').addEventListener('click', start);
}

let containers = {};

const models = {
	47: { file: 'Zainetto_Sara.glb', scale: 9}
};

const loader = new GLTFLoader();
let objects = {};
const getModel = async (id) => {
	const obj = objects[id];
	if (obj == 'loading')
		return null;

	if (obj) return obj; // loaded

	const m = models[id];
	if (!m) {
		return null;
	}

	const path = 'models/' + m.file;
	console.log('loading model id %s from %s', id, path);
	objects[id] = 'loading';
	return new Promise((resolve, reject) => {
		loader.load(path, model => {
			console.log('xxxqualcosa');
			model.scene.scale.set(m.scale, m.scale, m.scale);
			objects[id] = model;
			resolve(model);
		});
	})
}

const get_container = async (id) => {
	let c = containers[id];
	if (c) {
		c.lastdetectiontime = performance.now();
		c.first_detection = false;
		return c;
	}

	let model = await getModel(id);
	if (!model) {
		return null;
	}

	const container = new THREE.Object3D();
	container.matrixAutoUpdate = false;
	container.add(model.scene);

	const light = new THREE.AmbientLight(0xffffff, 2);
	container.add(light);
	// const axesHelper = new THREE.AxesHelper(1);
	// container.add(axesHelper);
	let k = { container: container, lastdetectiontime: performance.now(), first_detection: true };
	containers[id] = k;
	return k;
};

// fix the marker matrix to compensate Y-up models
function fixMatrix(three_mat, m) {
	three_mat.set(
		m[0], m[8], -m[4], m[12],
		m[1], m[9], -m[5], m[13],
		m[2], m[10], -m[6], m[14],
		m[3], m[11], -m[7], m[15]
	);
}

function start_processing() {
	// canvas & video
	const canvas = document.getElementById("mycanvas");
	// canvas.width = video.videoWidth;
	// canvas.height = video.videoHeight;

	if (app.clientHeight > app.clientWidth) {
		canvas.style.width = '100%';
		canvas.style.height = `min(100%, 100vw * ${video.videoHeight} / ${video.videoWidth})`;
	}
	else {
		canvas.style.height = '100%';
		canvas.style.width = `min(100%, 100vh * ${video.videoWidth} / ${video.videoHeight})`;
	}

	video.width = video.height = 0;

	// canvas.style.aspectRatio = video.style.aspectRatio;

	// three.js
	const renderer = new THREE.WebGLRenderer({ canvas: canvas });
	const scene = new THREE.Scene();
	const camera = new THREE.Camera();
	scene.add(camera);

	// background
	const bgtexture = new THREE.VideoTexture(video);
	bgtexture.colorSpace = THREE.SRGBColorSpace;
	scene.background = bgtexture;

	// container + object

	// jsartoolkit
	let arLoaded = false;
	let lastdetectiontime = 0;
	const arController = new ARController(video, 'camera_para.dat');

	arController.onload = () => {
		camera.projectionMatrix.fromArray(arController.getCameraMatrix());
		arController.setPatternDetectionMode(artoolkit.AR_MATRIX_CODE_DETECTION);
		// arController.setMatrixCodeType(artoolkit.AR_MATRIX_CODE_3x3);


		// console.log( '*** Start loading  custom pattern %s',custom_marker_file);
		// arController.loadMarker(custom_marker_file, function(marker) {
		// 	custom_marker_id = marker;
		// 	console.log( '*** Loaded custom pattern %s: id is %s',custom_marker_file,marker);
		// });

		arController.addEventListener('getMarker', ev => {
			if (ev.data.marker.idMatrix != -1) {
				console.log("Marker Index: %s, Matrix id: %s", ev.data.index, ev.data.marker?.idMatrix);
				get_container(ev.data.marker.idMatrix).then(c => {
					if (!c) return;
					fixMatrix(c.container.matrix, ev.data.matrixGL_RH);
					if (c.first_detection)
						scene.add(c.container);

				})
			}
		});
		arLoaded = true;
	}

	// render loop
	function renderloop() {
		requestAnimationFrame(renderloop);
		if (arLoaded)
			arController.process(video);

		const width = canvas.clientWidth;
		const height = canvas.clientHeight;
		const needResize = canvas.width !== width || canvas.height !== height;

		if (needResize) {
			renderer.setSize(width, height, false);
			camera.aspect = canvas.clientWith / canvas.clientHeight;
			camera.updateProjectionMatrix();
		}

		const now = performance.now();
		let ixs = Object.keys(containers);
		for (let i = 0; i < ixs.length; i++) {
			const k = ixs[i];
			let c = containers[k];
			if (now - c.lastdetectiontime < 100)
				c.container.visible = true;
			else
				c.container.visible = false;
		}
		// if(performance.now()-lastdetectiontime < 100)
		renderer.render(scene, camera);
	}
	renderloop();
}

export function start() {
	const wel = document.getElementById('welcome');
	wel.classList.add('hidden');
	wel.classList.remove('cover_all');

	app = document.getElementById('app');
	app.classList.add('cover_all');
	app.classList.remove('hidden');

	video = document.getElementById("myvideo");
	video.onloadedmetadata = start_processing;
	const constraints = { audio: false, video: { facingMode: 'environment' } };

	navigator.mediaDevices.getUserMedia(constraints)
		.then((stream) => video.srcObject = stream)
		.catch((err) => {
			alert(err.name + ": " + err.message);
			// video.src = "marker.webm";
		});
}

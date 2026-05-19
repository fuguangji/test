import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js';

const canvas = document.getElementById("webgl");

/* ---------------- Scene ---------------- */

const scene = new THREE.Scene();

scene.fog = new THREE.FogExp2(0x050816, 0.035);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

camera.position.set(0, 8, 30);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

/* ---------------- Light ---------------- */

const ambient = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambient);

const point = new THREE.PointLight(0x88ccff, 20);
point.position.set(0, 20, 20);

scene.add(point);

/* ---------------- Audio ---------------- */

let analyser;
let dataArray;
let audioContext;
let source;

/* ---------------- FFT Settings ---------------- */

const FFT_SIZE = 512;
const BALL_COUNT = FFT_SIZE / 2;

/* ---------------- Balls ---------------- */

const geometry = new THREE.SphereGeometry(0.3, 16, 16);

const material = new THREE.MeshPhysicalMaterial({
  color: 0xaaccff,
  transparent: true,
  opacity: 0.7,
  roughness: 0.2,
  metalness: 0.1,
  transmission: 0.5
});

const mesh = new THREE.InstancedMesh(
  geometry,
  material,
  BALL_COUNT
);

scene.add(mesh);

const dummy = new THREE.Object3D();

/* ---------------- Motion State ---------------- */

const currentScale = [];
const targetScale = [];

const currentZ = [];
const velocityZ = [];

for (let i = 0; i < BALL_COUNT; i++) {

  currentScale[i] = 1;
  targetScale[i] = 1;

  currentZ[i] = 0;
  velocityZ[i] = 0;
}

/* ---------------- Upload Audio ---------------- */

const input = document.getElementById("fileInput");

input.addEventListener("change", async (e) => {

  const file = e.target.files[0];

  if (!file) return;

  if (audioContext) {
    audioContext.close();
  }

  audioContext = new AudioContext();

  const arrayBuffer = await file.arrayBuffer();

  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  const audio = new Audio();

  audio.src = URL.createObjectURL(file);

  audio.loop = true;

  await audio.play();

  const track = audioContext.createMediaElementSource(audio);

  analyser = audioContext.createAnalyser();

  analyser.fftSize = FFT_SIZE;

  dataArray = new Uint8Array(analyser.frequencyBinCount);

  track.connect(analyser);

  analyser.connect(audioContext.destination);
});

/* ---------------- Mapping ---------------- */

function getFrequency(bin) {

  if (!analyser) return 0;

  return (bin * audioContext.sampleRate) / analyser.fftSize;
}

function mapZ(freq) {

  const minFreq = 20;
  const maxFreq = 20000;

  const normalized =
    (Math.log2(freq + 1) - Math.log2(minFreq)) /
    (Math.log2(maxFreq) - Math.log2(minFreq));

  return normalized * 25;
}

/* ---------------- Animation ---------------- */

function animate() {

  requestAnimationFrame(animate);

  if (analyser) {

    analyser.getByteFrequencyData(dataArray);

    for (let i = 0; i < BALL_COUNT; i++) {

      const energy = dataArray[i] / 255;

      const freq = getFrequency(i);

      const zTarget = mapZ(freq);

      /* Spring Motion */

      velocityZ[i] += (zTarget - currentZ[i]) * 0.02;

      velocityZ[i] *= 0.9;

      currentZ[i] += velocityZ[i];

      /* Scale */

      targetScale[i] = 0.5 + energy * 4.0;

      currentScale[i] += (
        targetScale[i] - currentScale[i]
      ) * 0.08;

      /* Layout */

      const x = (i - BALL_COUNT / 2) * 0.25;

      const y = Math.sin(i * 0.15) * 2;

      dummy.position.set(
        x,
        y,
        currentZ[i]
      );

      dummy.scale.setScalar(currentScale[i]);

      dummy.updateMatrix();

      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  }

  renderer.render(scene, camera);
}

animate();

/* ---------------- Resize ---------------- */

window.addEventListener("resize", () => {

  camera.aspect =
    window.innerWidth / window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );
});

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { INFO_POINTS, CAMERA_PRESETS } from '../data/infoPointsData';
import { InfoPoint, ViewMode, CameraPreset } from '../types';
import { soundManager } from '../utils/audioEngine';

interface Arena3DProps {
  onSelectInfoPoint: (point: InfoPoint) => void;
  activeInfoPoint: InfoPoint | null;
  selectedPreset: CameraPreset | null;
  onClearPreset: () => void;
  viewMode: ViewMode;
  isJamSimulating: boolean;
  onToggleJamSim: () => void;
  joystickVector: { x: number; y: number };
  touchLookVector: { x: number; y: number };
  isJumpRequested: boolean;
  isSprintActive: boolean;
  onInteractNearest: () => void;
  setNearestPoint: (point: InfoPoint | null) => void;
  playerPos: { x: number; z: number; rotationY: number };
  setPlayerPos: React.Dispatch<React.SetStateAction<{ x: number; z: number; rotationY: number }>>;
  setIsNearTouchTable?: (near: boolean) => void;
  setIsNearKingsPortal?: (near: boolean) => void;
  onOpenKingsLeague?: () => void;
}

export interface KingsPortalData {
  group: THREE.Group;
  crown: THREE.Mesh;
  vortex: THREE.Mesh;
  light: THREE.PointLight;
  holoCube: THREE.Mesh;
}

export const Arena3D: React.FC<Arena3DProps> = ({
  onSelectInfoPoint,
  activeInfoPoint,
  selectedPreset,
  onClearPreset,
  viewMode,
  isJamSimulating,
  onToggleJamSim,
  joystickVector,
  touchLookVector,
  isJumpRequested,
  isSprintActive,
  onInteractNearest,
  setNearestPoint,
  playerPos,
  setPlayerPos,
  setIsNearTouchTable,
  setIsNearKingsPortal,
  onOpenKingsLeague,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const onInteractNearestRef = useRef(onInteractNearest);
  onInteractNearestRef.current = onInteractNearest;

  const onOpenKingsLeagueRef = useRef(onOpenKingsLeague);
  onOpenKingsLeagueRef.current = onOpenKingsLeague;

  const isJamSimulatingRef = useRef(isJamSimulating);
  isJamSimulatingRef.current = isJamSimulating;

  const onToggleJamSimRef = useRef(onToggleJamSim);
  onToggleJamSimRef.current = onToggleJamSim;

  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;

  const isNearTouchTableRef = useRef(false);
  const touchTableRefs = useRef<TouchTableData | null>(null);

  const isNearKingsPortalRef = useRef(false);
  const kingsPortalRefs = useRef<KingsPortalData | null>(null);

  // Update touch table screen whenever isJamSimulating changes
  useEffect(() => {
    isJamSimulatingRef.current = isJamSimulating;
    if (touchTableRefs.current) {
      updateTouchTableScreen(touchTableRefs.current, isJamSimulating);
    }
  }, [isJamSimulating]);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  // Player state
  const playerState = useRef({
    position: new THREE.Vector3(playerPos?.x ?? -6, 1.6, playerPos?.z ?? 11.5),
    velocity: new THREE.Vector3(),
    pitch: 0,
    yaw: playerPos?.rotationY ?? Math.PI / 2, // Facing left initially
    isGrounded: true,
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    speed: 6.5,
  });

  // Skaters simulation state
  const skatersRef = useRef<
    {
      mesh: THREE.Group;
      progress: number;
      lane: number;
      speed: number;
      isOpponent: boolean;
      role: string;
      legL: THREE.Mesh;
      legR: THREE.Mesh;
      armL: THREE.Mesh;
      armR: THREE.Mesh;
    }[]
  >([]);

  // Beacons references
  const beaconsRef = useRef<{ mesh: THREE.Group; id: string; basePos: THREE.Vector3 }[]>([]);
  const spectatorsRef = useRef<{ mesh: THREE.Mesh; initialY: number; speed: number; phase: number }[]>([]);
  
  // Left-click mouse drag camera look state
  const isMouseDownRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const dragDistanceRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  // Helper to compute oval track position from progress (0 to 1) and lane offset (-1 inner to +1 outer)
  const getTrackPosition = (progress: number, laneOffset: number = 0) => {
    // Standard flat oval track
    // Straight length = 32 (X from -16 to 16)
    // Turn radius = 11.5 (inner 9.4, outer 13.6 => center 11.5, lane width 4.2)
    const baseRadius = 11.5;
    const r = baseRadius + laneOffset * 1.8;
    const straightLen = 32;
    const curveLen = Math.PI * r;
    const totalLoop = 2 * straightLen + 2 * curveLen;

    const currentDist = (progress % 1) * totalLoop;

    let x = 0;
    let z = 0;
    let tangent = new THREE.Vector3();

    // Section 1: Bottom Straight (Z = +r, moving from X = +16 down to X = -16)
    if (currentDist < straightLen) {
      const t = currentDist / straightLen;
      x = 16 - t * 32;
      z = r;
      tangent.set(-1, 0, 0);
    }
    // Section 2: Turn 1 (Left turn around X = -16, from angle +PI/2 to -PI/2)
    else if (currentDist < straightLen + curveLen) {
      const t = (currentDist - straightLen) / curveLen;
      const angle = Math.PI / 2 + t * Math.PI;
      x = -16 + Math.cos(angle) * r;
      z = Math.sin(angle) * r;
      tangent.set(-Math.sin(angle), 0, Math.cos(angle));
    }
    // Section 3: Top Straight (Z = -r, moving from X = -16 up to X = +16)
    else if (currentDist < 2 * straightLen + curveLen) {
      const t = (currentDist - (straightLen + curveLen)) / straightLen;
      x = -16 + t * 32;
      z = -r;
      tangent.set(1, 0, 0);
    }
    // Section 4: Turn 2 (Right turn around X = +16, from angle -PI/2 to +PI/2)
    else {
      const t = (currentDist - (2 * straightLen + curveLen)) / curveLen;
      const angle = -Math.PI / 2 + t * Math.PI;
      x = 16 + Math.cos(angle) * r;
      z = Math.sin(angle) * r;
      tangent.set(-Math.sin(angle), 0, Math.cos(angle));
    }

    return { pos: new THREE.Vector3(x, 0, z), tangent };
  };

  // Physical ground elevation calculation for arena floor, bleacher tiers, illuminated aisles, and team benches
  const getGroundElevation = (x: number, z: number): number => {
    const absX = Math.abs(x);
    const absZ = Math.abs(z);

    // Beyond outer arena perimeter
    if (absX > 40.5 || absZ > 35.5) return 0;

    // Bleachers (Symmetric on North and South sides)
    if (absZ >= 20.2 && absZ <= 34.6 && absX <= 37.0) {
      // Check if player is inside one of the 3 stair aisles:
      // Center aisle: |x| <= 1.9
      // Left/Right aisles: |x| between 13.6 and 16.4
      const isAisle = absX <= 1.9 || (absX >= 13.6 && absX <= 16.4);

      if (isAisle) {
        // 11 gentle step treads (each 0.30m elevation)
        if (absZ < 21.3) return 0.30;
        if (absZ < 22.4) return 0.60;
        if (absZ < 23.5) return 0.90;
        if (absZ < 24.6) return 1.20;
        if (absZ < 25.7) return 1.50;
        if (absZ < 26.8) return 1.80;
        if (absZ < 27.9) return 2.10;
        if (absZ < 29.0) return 2.40;
        if (absZ < 30.1) return 2.70;
        if (absZ < 31.2) return 3.00;
        if (absZ < 32.3) return 3.30;
        return 3.60; // Top concourse platform
      } else {
        // Seating tiers (each tier is 0.60m elevation)
        if (absZ < 22.4) return 0.60; // Tier 0
        if (absZ < 24.6) return 1.20; // Tier 1
        if (absZ < 26.8) return 1.80; // Tier 2
        if (absZ < 29.0) return 2.40; // Tier 3
        if (absZ < 31.2) return 3.00; // Tier 4
        return 3.60; // Tier 5 (Top Concourse Walkway)
      }
    }

    // Team benches elevation (Z between 17.5 and 19.5, X between 7.5 and 16.5)
    if (z >= 17.5 && z <= 19.5) {
      if ((x >= -16.5 && x <= -7.5) || (x >= 7.5 && x <= 16.5)) {
        return 0.45;
      }
    }

    return 0.0;
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color('#0c0e17');
    scene.fog = new THREE.FogExp2('#0c0e17', 0.015);

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 200);
    cameraRef.current = camera;
    camera.position.set(
      playerState.current.position.x,
      playerState.current.position.y,
      playerState.current.position.z
    );

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    container.replaceChildren(renderer.domElement);

    // 4. Lighting setup
    const ambientLight = new THREE.AmbientLight('#262a45', 1.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight('#ffffff', 2.0);
    dirLight.position.set(20, 35, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 100;
    dirLight.shadow.camera.left = -40;
    dirLight.shadow.camera.right = 40;
    dirLight.shadow.camera.top = 40;
    dirLight.shadow.camera.bottom = -40;
    scene.add(dirLight);

    // Arena Floodlights & Spotlights
    const spotColors = ['#ec4899', '#06b6d4', '#8b5cf6', '#eab308'];
    const spotPositions = [
      [-16, 18, 12],
      [16, 18, -12],
      [-16, 18, -12],
      [16, 18, 12],
    ];
    spotPositions.forEach((pos, idx) => {
      const spot = new THREE.SpotLight(spotColors[idx % spotColors.length], 3.5, 50, Math.PI / 4, 0.4, 1.2);
      spot.position.set(pos[0], pos[1], pos[2]);
      spot.target.position.set(pos[0] * 0.3, 0, pos[2] * 0.3);
      scene.add(spot);
      scene.add(spot.target);

      // Visual spotlight fixture
      const fixtureGeo = new THREE.ConeGeometry(0.6, 1.2, 8);
      const fixtureMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.8 });
      const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
      fixture.position.set(pos[0], pos[1], pos[2]);
      fixture.rotation.x = Math.PI;
      scene.add(fixture);
    });

    // 5. Construct Arena Building
    createArenaStructure(scene);

    // 6. Construct Oval Roller Derby Track
    createDerbyTrack(scene);

    // 7. Add Center Infield Elements (Cyber Touch Table, Penalty Box, Scoreboard, Benches)
    touchTableRefs.current = createInfieldAndScoreboard(scene, isJamSimulatingRef.current);

    // 8. Add Spectator Stands & Bleachers
    createStandsAndSpectators(scene, spectatorsRef);

    // 9. Add Kings League Arcade Portal on North Wall
    kingsPortalRefs.current = createKingsLeaguePortal(scene);

    // 10. Add Skaters (Jammers, Pivots, Blockers)
    skatersRef.current = createSkaterPack(scene);

    // 11. Add Referees (Jam Ref, Pack Refs, NSOs)
    createReferees(scene);

    // 12. Add Holographic Interactive Info Beacons
    beaconsRef.current = createInfoBeacons(scene);

    // Handle Window Resize
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Left-Click and Drag Camera Controls (Câmera condicionada ao clique com o botão esquerdo e arrasto do mouse)
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleMouseDown = (e: MouseEvent) => {
      // Condition camera control strictly on left mouse button (e.button === 0)
      if (e.button !== 0) return;
      isMouseDownRef.current = true;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      dragDistanceRef.current = 0;
      setIsDragging(true);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDownRef.current) return;
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      dragDistanceRef.current += Math.abs(dx) + Math.abs(dy);

      const sensitivity = 0.0032;
      playerState.current.yaw -= dx * sensitivity;
      playerState.current.pitch -= dy * sensitivity;
      // Clamp pitch to prevent flipping
      playerState.current.pitch = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, playerState.current.pitch));
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isMouseDownRef.current) return;
      const wasDrag = dragDistanceRef.current >= 6;
      isMouseDownRef.current = false;
      setIsDragging(false);

      // If user clicked without dragging (< 6px movement), check interactive objects
      if (!wasDrag) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        // 1. Check if Kings League Portal on North Wall was clicked directly
        if (kingsPortalRefs.current) {
          const portalIntersects = raycaster.intersectObject(kingsPortalRefs.current.group, true);
          if (portalIntersects.length > 0) {
            onOpenKingsLeagueRef.current?.();
            soundManager.playTeleport();
            return;
          }
        }

        // 2. Check if Touch Table in center of track was clicked directly
        if (touchTableRefs.current) {
          const tableIntersects = raycaster.intersectObject(touchTableRefs.current.group, true);
          if (tableIntersects.length > 0) {
            onToggleJamSimRef.current();
            soundManager.playClick();
            return;
          }
        }

        // 3. Check if an interactive beacon was clicked
        const beaconMeshes = beaconsRef.current.map((b) => b.mesh);
        const intersects = raycaster.intersectObjects(beaconMeshes, true);

        if (intersects.length > 0) {
          let rootObj = intersects[0].object;
          while (rootObj.parent && !rootObj.userData.infoPointId) {
            rootObj = rootObj.parent as THREE.Object3D;
          }
          const pointId = rootObj.userData.infoPointId;
          if (pointId) {
            const pt = INFO_POINTS.find((p) => p.id === pointId);
            if (pt) {
              onSelectInfoPoint(pt);
              soundManager.playClick();
            }
          }
        }
      }
    };

    renderer.domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Keyboard controls
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea'].includes((e.target as HTMLElement).tagName.toLowerCase())) return;

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          playerState.current.moveForward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          playerState.current.moveBackward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          playerState.current.moveLeft = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          playerState.current.moveRight = true;
          break;
        case 'Space':
          if (playerState.current.isGrounded) {
            playerState.current.velocity.y = 5.8;
            playerState.current.isGrounded = false;
            soundManager.playClick(800);
          }
          break;
        case 'KeyE':
          if (isNearKingsPortalRef.current) {
            onOpenKingsLeagueRef.current?.();
            soundManager.playTeleport();
          } else if (isNearTouchTableRef.current) {
            onToggleJamSimRef.current();
            soundManager.playClick();
          } else {
            onInteractNearestRef.current();
          }
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          playerState.current.moveForward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          playerState.current.moveBackward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          playerState.current.moveLeft = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          playerState.current.moveRight = false;
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Main Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsedTime = clock.getElapsedTime();

      // Update Touch Look vector if active
      if (touchLookVector.x !== 0 || touchLookVector.y !== 0) {
        playerState.current.yaw -= touchLookVector.x * 2.2 * delta;
        playerState.current.pitch -= touchLookVector.y * 2.2 * delta;
        playerState.current.pitch = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, playerState.current.pitch));
      }

      // Jump requested via touch
      if (isJumpRequested && playerState.current.isGrounded) {
        playerState.current.velocity.y = 5.8;
        playerState.current.isGrounded = false;
        soundManager.playClick(800);
      }

      // Compute Movement Vector
      const forward = new THREE.Vector3(-Math.sin(playerState.current.yaw), 0, -Math.cos(playerState.current.yaw));
      const right = new THREE.Vector3(Math.cos(playerState.current.yaw), 0, -Math.sin(playerState.current.yaw));

      const moveDir = new THREE.Vector3(0, 0, 0);

      // Keyboard input
      if (playerState.current.moveForward) moveDir.add(forward);
      if (playerState.current.moveBackward) moveDir.sub(forward);
      if (playerState.current.moveRight) moveDir.add(right);
      if (playerState.current.moveLeft) moveDir.sub(right);

      // Touch Joystick input
      if (joystickVector.x !== 0 || joystickVector.y !== 0) {
        moveDir.addScaledVector(forward, -joystickVector.y);
        moveDir.addScaledVector(right, joystickVector.x);
      }

      const moveSpeed = (isSprintActive ? 11.0 : playerState.current.speed) * delta;
      const currentFootY = playerState.current.position.y - 1.6;

      if (moveDir.lengthSq() > 0) {
        moveDir.normalize();

        // Target candidate position within stadium perimeter
        const candidateX = Math.max(-39.8, Math.min(39.8, playerState.current.position.x + moveDir.x * moveSpeed));
        const candidateZ = Math.max(-34.5, Math.min(34.5, playerState.current.position.z + moveDir.z * moveSpeed));

        const targetGround = getGroundElevation(candidateX, candidateZ);
        const MAX_STEP_UP = 0.75; // Allows smooth step-up on aisle stairs (0.30m) and bleacher tiers (0.60m)

        if (playerState.current.isGrounded) {
          if (targetGround <= currentFootY + MAX_STEP_UP) {
            playerState.current.position.x = candidateX;
            playerState.current.position.z = candidateZ;

            // Height adaptation (stairs & bleachers climbing)
            if (targetGround >= currentFootY) {
              // Smooth step up
              const newFootY = THREE.MathUtils.lerp(currentFootY, targetGround, Math.min(1.0, 24.0 * delta));
              playerState.current.position.y = newFootY + 1.6;
            } else {
              // Stepping down
              if (currentFootY - targetGround < 0.65) {
                const newFootY = THREE.MathUtils.lerp(currentFootY, targetGround, Math.min(1.0, 20.0 * delta));
                playerState.current.position.y = newFootY + 1.6;
              } else {
                // High drop off: start falling
                playerState.current.isGrounded = false;
              }
            }
          } else {
            // Ledge too high to step up without jumping; test sliding along X or Z
            const groundX = getGroundElevation(candidateX, playerState.current.position.z);
            if (groundX <= currentFootY + MAX_STEP_UP) {
              playerState.current.position.x = candidateX;
            }
            const groundZ = getGroundElevation(playerState.current.position.x, candidateZ);
            if (groundZ <= currentFootY + MAX_STEP_UP) {
              playerState.current.position.z = candidateZ;
            }
          }
        } else {
          // In the air (jumping/falling): allow airborne directional control
          playerState.current.position.x = candidateX;
          playerState.current.position.z = candidateZ;
        }
      } else if (playerState.current.isGrounded) {
        // When stationary and grounded, gently settle eye height to exact physical surface
        const groundUnder = getGroundElevation(playerState.current.position.x, playerState.current.position.z);
        if (Math.abs(playerState.current.position.y - (groundUnder + 1.6)) > 0.005) {
          playerState.current.position.y = THREE.MathUtils.lerp(
            playerState.current.position.y,
            groundUnder + 1.6,
            Math.min(1.0, 20.0 * delta)
          );
        }
      }

      // Gravity and jump physics
      if (!playerState.current.isGrounded) {
        playerState.current.velocity.y -= 15.0 * delta;
        playerState.current.position.y += playerState.current.velocity.y * delta;

        const groundUnder = getGroundElevation(playerState.current.position.x, playerState.current.position.z);
        if (playerState.current.position.y <= groundUnder + 1.6) {
          playerState.current.position.y = groundUnder + 1.6;
          playerState.current.velocity.y = 0;
          playerState.current.isGrounded = true;
          soundManager.playClick(400);
        }
      }

      // Hard arena boundary clamping
      playerState.current.position.x = Math.max(-39.8, Math.min(39.8, playerState.current.position.x));
      playerState.current.position.z = Math.max(-34.5, Math.min(34.5, playerState.current.position.z));

      // Update camera positioning based on view mode or active preset
      if (viewModeRef.current === 'fps') {
        camera.position.copy(playerState.current.position);
        const lookTarget = new THREE.Vector3(
          playerState.current.position.x - Math.sin(playerState.current.yaw) * Math.cos(playerState.current.pitch),
          playerState.current.position.y + Math.sin(playerState.current.pitch),
          playerState.current.position.z - Math.cos(playerState.current.yaw) * Math.cos(playerState.current.pitch)
        );
        camera.lookAt(lookTarget);
      } else if (viewModeRef.current === 'third_person') {
        // Third-person skater chase cam
        const chaseDist = 3.5;
        const chaseHeight = 1.8;
        const camX = playerState.current.position.x + Math.sin(playerState.current.yaw) * chaseDist;
        const camZ = playerState.current.position.z + Math.cos(playerState.current.yaw) * chaseDist;
        camera.position.set(camX, playerState.current.position.y + chaseHeight, camZ);
        camera.lookAt(
          playerState.current.position.x,
          playerState.current.position.y + 0.6,
          playerState.current.position.z
        );
      } else if (viewModeRef.current === 'drone') {
        // High aerial drone view
        camera.position.set(0, 36, 12);
        camera.lookAt(0, 0, 0);
      }

      // Animate Spectators cheering
      spectatorsRef.current.forEach((spec) => {
        spec.mesh.position.y = spec.initialY + Math.sin(elapsedTime * spec.speed + spec.phase) * 0.15;
      });

      // Animate Holographic Beacons (float, rotate, pulse)
      beaconsRef.current.forEach((beacon) => {
        beacon.mesh.position.y = beacon.basePos.y + Math.sin(elapsedTime * 2.5 + beacon.basePos.x) * 0.18;
        beacon.mesh.rotation.y = elapsedTime * 1.2;
      });

      // Animate Skaters in Jam Simulation
      skatersRef.current.forEach((skater) => {
        if (isJamSimulatingRef.current) {
          skater.progress += (skater.speed * delta) / 100;
          if (skater.progress > 1) skater.progress -= 1;
        }

        const { pos, tangent } = getTrackPosition(skater.progress, skater.lane);
        skater.mesh.position.set(pos.x, 0.45, pos.z);

        // Skater looks in direction of track tangent
        const lookAngle = Math.atan2(tangent.x, tangent.z);
        skater.mesh.rotation.y = lookAngle;

        // Skater leg and arm pumping animation
        if (isJamSimulatingRef.current) {
          const stride = Math.sin(elapsedTime * 8 * skater.speed);
          skater.legL.rotation.x = stride * 0.4;
          skater.legR.rotation.x = -stride * 0.4;
          skater.armL.rotation.x = -stride * 0.5;
          skater.armR.rotation.x = stride * 0.5;
          // Inward body lean on curves
          const isCurve = Math.abs(pos.x) > 15;
          skater.mesh.rotation.z = isCurve ? (pos.x > 0 ? 0.15 : -0.15) : 0;
        }
      });

      // Animate Central Interactive Touch Table
      if (touchTableRefs.current) {
        const tData = touchTableRefs.current;
        tData.holoRing.rotation.y = elapsedTime * 1.6;
        tData.holoRing.rotation.z = Math.sin(elapsedTime * 1.5) * 0.15;
        tData.holoIcon.rotation.y = -elapsedTime * 1.4;

        // Subtle glow breathing
        const basePulse = isJamSimulatingRef.current ? 2.8 : 1.6;
        tData.glowLight.intensity = basePulse + Math.sin(elapsedTime * 4) * 0.6;
      }

      // Check proximity to Touch Table at (0, 0.9, 0)
      const distToTouchTable = playerState.current.position.distanceTo(new THREE.Vector3(0, 0.9, 0));
      const nearTable = distToTouchTable <= 3.8;
      if (nearTable !== isNearTouchTableRef.current) {
        isNearTouchTableRef.current = nearTable;
        setIsNearTouchTable?.(nearTable);
      }

      // Animate Kings League Portal on North Wall
      if (kingsPortalRefs.current) {
        const kp = kingsPortalRefs.current;
        kp.crown.rotation.y = Math.sin(elapsedTime * 1.5) * 0.18;
        kp.holoCube.rotation.x = elapsedTime * 1.2;
        kp.holoCube.rotation.y = elapsedTime * 1.6;
        kp.vortex.rotation.z = -elapsedTime * 0.9;
        kp.light.intensity = 2.8 + Math.sin(elapsedTime * 3.5) * 0.7;
      }

      // Check proximity to Kings League Portal on North Wall (0, y, -35.2)
      const distToKingsPortal = playerState.current.position.distanceTo(
        new THREE.Vector3(0, playerState.current.position.y, -35.2)
      );
      const nearKings =
        distToKingsPortal <= 6.5 &&
        Math.abs(playerState.current.position.x) <= 4.0 &&
        playerState.current.position.z < -28.0;
      if (nearKings !== isNearKingsPortalRef.current) {
        isNearKingsPortalRef.current = nearKings;
        setIsNearKingsPortal?.(nearKings);
      }

      // Animate 360° Curved Halo Rings & Stadium Perimeter LED Displays
      if (globalRibbonTex) {
        globalRibbonTex.offset.x = (elapsedTime * 0.035) % 1;
      }
      if (globalStadiumLedTex) {
        globalStadiumLedTex.offset.x = (elapsedTime * 0.045) % 1;
      }

      // Find nearest info point to the player
      let closestPt: InfoPoint | null = null;
      let minDistance = 4.2; // Interaction radius in units

      INFO_POINTS.forEach((pt) => {
        const ptPos = new THREE.Vector3(pt.position3D[0], pt.position3D[1], pt.position3D[2]);
        const dist = playerState.current.position.distanceTo(ptPos);
        if (dist < minDistance) {
          minDistance = dist;
          closestPt = pt;
        }
      });
      setNearestPoint(closestPt);

      // Sync player position for HUD compass
      setPlayerPos({
        x: playerState.current.position.x,
        z: playerState.current.position.z,
        rotationY: playerState.current.yaw,
      });

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      renderer.dispose();
    };
  }, []);

  // Teleport to selected preset when preset changes
  useEffect(() => {
    if (!selectedPreset) return;
    const ground = getGroundElevation(selectedPreset.position[0], selectedPreset.position[2]);
    const posY = Math.max(selectedPreset.position[1], ground + 1.6);

    playerState.current.position.set(
      selectedPreset.position[0],
      posY,
      selectedPreset.position[2]
    );
    playerState.current.velocity.set(0, 0, 0);
    playerState.current.isGrounded = true;

    // Compute look angle towards lookAt
    const dx = selectedPreset.lookAt[0] - selectedPreset.position[0];
    const dz = selectedPreset.lookAt[2] - selectedPreset.position[2];
    playerState.current.yaw = Math.atan2(-dx, -dz);
    playerState.current.pitch = 0;

    soundManager.playWhistle('start');
    onClearPreset();
  }, [selectedPreset]);

  // If active info point is selected from menu, focus near it
  useEffect(() => {
    if (!activeInfoPoint) return;
    const pt = activeInfoPoint;
    // Position player slightly back from the point
    const targetGround = getGroundElevation(pt.position3D[0], pt.position3D[2] + 2.2);
    const targetPos = new THREE.Vector3(pt.position3D[0], targetGround + 1.6, pt.position3D[2] + 2.2);
    playerState.current.position.copy(targetPos);
    playerState.current.velocity.set(0, 0, 0);
    playerState.current.isGrounded = true;

    const dx = pt.position3D[0] - targetPos.x;
    const dz = pt.position3D[2] - targetPos.z;
    playerState.current.yaw = Math.atan2(-dx, -dz);
    playerState.current.pitch = -0.1;
    soundManager.playWhistle(pt.whistleCue || 'start');
  }, [activeInfoPoint]);

  return (
    <div
      ref={containerRef}
      id="roller-derby-3d-canvas-container"
      className={`relative w-full h-full overflow-hidden select-none ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    />
  );
};

// -------------------------------------------------------------
// Procedural Three.js Builders for Low-Poly Roller Derby Arena
// -------------------------------------------------------------

function createArenaStructure(scene: THREE.Scene) {
  // Main Arena Sports Floor (Polished high-grip maple wood court texture with grid lines)
  const floorGeo = new THREE.PlaneGeometry(84, 72, 16, 16);
  const floorMat = new THREE.MeshStandardMaterial({
    color: '#1a1d2e',
    roughness: 0.35,
    metalness: 0.1,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Infield polished wood court mat
  const infieldMatGeo = new THREE.PlaneGeometry(36, 18);
  const infieldMatMat = new THREE.MeshStandardMaterial({
    color: '#0f172a',
    roughness: 0.4,
    metalness: 0.05,
  });
  const infieldMat = new THREE.Mesh(infieldMatGeo, infieldMatMat);
  infieldMat.rotation.x = -Math.PI / 2;
  infieldMat.position.set(0, 0.01, 0);
  infieldMat.receiveShadow = true;
  scene.add(infieldMat);

  // Arena Walls with industrial LED trim
  const wallMat = new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.8 });

  // North/South Walls
  const wallZ1 = new THREE.Mesh(new THREE.BoxGeometry(84, 18, 1), wallMat);
  wallZ1.position.set(0, 9, 36);
  scene.add(wallZ1);

  const wallZ2 = new THREE.Mesh(new THREE.BoxGeometry(84, 18, 1), wallMat);
  wallZ2.position.set(0, 9, -36);
  scene.add(wallZ2);

  // East/West Walls
  const wallX1 = new THREE.Mesh(new THREE.BoxGeometry(1, 18, 72), wallMat);
  wallX1.position.set(42, 9, 0);
  scene.add(wallX1);

  const wallX2 = new THREE.Mesh(new THREE.BoxGeometry(1, 18, 72), wallMat);
  wallX2.position.set(-42, 9, 0);
  scene.add(wallX2);

  // Ceiling Steel Truss Grid
  const trussMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.9, roughness: 0.4 });
  for (let x = -36; x <= 36; x += 12) {
    const truss = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 72), trussMat);
    truss.position.set(x, 18, 0);
    scene.add(truss);
  }
  for (let z = -30; z <= 30; z += 15) {
    const trussCross = new THREE.Mesh(new THREE.BoxGeometry(84, 0.8, 0.5), trussMat);
    trussCross.position.set(0, 18, z);
    scene.add(trussCross);
  }

  // Stadium-Wide Continuous LED Ribbon with "Synthetica Arena" running all around
  createSyntheticaArenaPerimeterLED(scene);

  // Decorative Championship Pennants (arranged flanking the stadium concourse)
  const bannerColors = ['#ec4899', '#06b6d4', '#8b5cf6', '#eab308', '#10b981'];
  const bannerNames = ['CYBER SIRENS', 'NEON VALKYRIES', 'CAMPEONATO WFTDA', 'SEM PENALIDADES', 'ORGULHO DO DERBY'];
  const bannerXPositions = [-36, -31, 0, 31, 36];
  for (let i = 0; i < 5; i++) {
    if (i === 2) continue; // Keep center clear
    const bannerGeo = new THREE.PlaneGeometry(4.5, 2.5);
    const bannerMat = new THREE.MeshStandardMaterial({
      color: bannerColors[i],
      side: THREE.DoubleSide,
      roughness: 0.6,
    });
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.set(bannerXPositions[i], 15.5, -35.2);
    scene.add(banner);
  }
}

// -------------------------------------------------------------
// Global Ribbon Texture References for Live Animation
// -------------------------------------------------------------
let globalRibbonTex: THREE.CanvasTexture | null = null;
let globalStadiumLedTex: THREE.CanvasTexture | null = null;

// -------------------------------------------------------------
// Curved Geometry Utility Builders (True Concave / Convex Curves)
// -------------------------------------------------------------

function createCurvedPlaneGeometry(
  width: number,
  height: number,
  depth: number, // positive = convex curve (bulges towards viewer), negative = concave (wraps around)
  segmentsX = 42,
  segmentsY = 6,
  tiltAngle = 0 // downward pitch in radians (tilts face toward spectators below)
): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(width, height, segmentsX, segmentsY);
  const pos = geo.attributes.position;
  const halfW = width / 2;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);

    // Quadratic curved profile across width
    const nx = x / halfW;
    const curveZ = (1 - nx * nx) * depth;

    // Pitch/tilt rotation around X axis
    const tiltedY = y * Math.cos(tiltAngle) - curveZ * Math.sin(tiltAngle);
    const tiltedZ = curveZ * Math.cos(tiltAngle) + y * Math.sin(tiltAngle);

    pos.setXYZ(i, x, tiltedY, tiltedZ);
  }
  geo.computeVertexNormals();
  return geo;
}

function createCurvedEdgeTube(
  width: number,
  depth: number,
  yPos: number,
  tiltAngle: number,
  colorHex: string,
  tubeRadius = 0.07,
  segments = 40
): THREE.Mesh {
  const points: THREE.Vector3[] = [];
  const halfW = width / 2;
  for (let i = 0; i <= segments; i++) {
    const x = -halfW + (i / segments) * width;
    const nx = x / halfW;
    const curveZ = (1 - nx * nx) * depth;
    const tiltedY = yPos * Math.cos(tiltAngle) - curveZ * Math.sin(tiltAngle);
    const tiltedZ = curveZ * Math.cos(tiltAngle) + yPos * Math.sin(tiltAngle);
    points.push(new THREE.Vector3(x, tiltedY, tiltedZ));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const tubeGeo = new THREE.TubeGeometry(curve, segments, tubeRadius, 8, false);
  const tubeMat = new THREE.MeshBasicMaterial({ color: colorHex });
  return new THREE.Mesh(tubeGeo, tubeMat);
}

// -------------------------------------------------------------
// Synthetica Arena Perimeter LED Ribbon & Jumbotron Builders
// -------------------------------------------------------------

function createSyntheticaArenaLedRibbonTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 3072;
  canvas.height = 180;
  const ctx = canvas.getContext('2d')!;

  // 1. Deep futuristic stadium navy background
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Digital LED Matrix Scanlines & Dot Matrix Grid
  ctx.fillStyle = 'rgba(6, 182, 212, 0.05)';
  for (let y = 0; y < canvas.height; y += 4) {
    ctx.fillRect(0, y, canvas.width, 2);
  }
  for (let x = 0; x < canvas.width; x += 16) {
    ctx.fillRect(x, 0, 1, canvas.height);
  }

  // 3. Glowing Neon Top & Bottom Guide Rails
  ctx.shadowColor = '#06b6d4';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#06b6d4';
  ctx.fillRect(0, 0, canvas.width, 6);

  ctx.shadowColor = '#ec4899';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#ec4899';
  ctx.fillRect(0, canvas.height - 6, canvas.width, 6);

  // 4. Repeating "SYNTHETICA ARENA" LED Banners (2 main blocks across width)
  const blockW = canvas.width / 2;
  for (let b = 0; b < 2; b++) {
    const startX = b * blockW;
    const centerX = startX + blockW / 2;

    // Chevrons left
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#06b6d4';
    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 48px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('» » »', centerX - 480, 108);

    // Glowing Main Title: "SYNTHETICA ARENA"
    ctx.textAlign = 'center';
    ctx.shadowBlur = 35;
    ctx.shadowColor = '#06b6d4';
    const titleGrad = ctx.createLinearGradient(centerX - 350, 0, centerX + 350, 0);
    titleGrad.addColorStop(0, '#38bdf8');
    titleGrad.addColorStop(0.3, '#ffffff');
    titleGrad.addColorStop(0.5, '#f472b6');
    titleGrad.addColorStop(0.7, '#ffffff');
    titleGrad.addColorStop(1, '#06b6d4');

    ctx.font = '900 78px "Arial Black", Impact, sans-serif';
    ctx.fillStyle = titleGrad;
    ctx.fillText('★ SYNTHETICA ARENA ★', centerX, 114);

    // Subtle bright outline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2.5;
    ctx.strokeText('★ SYNTHETICA ARENA ★', centerX, 114);

    // Chevrons right
    ctx.shadowColor = '#ec4899';
    ctx.fillStyle = '#f472b6';
    ctx.textAlign = 'left';
    ctx.fillText('« « «', centerX + 480, 108);

    // Subtitle mini badges
    ctx.shadowBlur = 0;
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText('WFTDA ROLLER DERBY SPEEDWAY • AO VIVO • DOMO 360°', centerX, 155);

    // Equalizer audio visualizer bars between blocks
    const eqColors = ['#06b6d4', '#38bdf8', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
    const eqStartX = startX + 35;
    for (let i = 0; i < 8; i++) {
      const h = 25 + ((i * 19) % 65);
      ctx.fillStyle = eqColors[i % eqColors.length];
      ctx.fillRect(eqStartX + i * 14, 130 - h, 9, h);
    }

    const eqEndX = startX + blockW - 150;
    for (let i = 0; i < 8; i++) {
      const h = 25 + (((i + 3) * 19) % 65);
      ctx.fillStyle = eqColors[(i + 2) % eqColors.length];
      ctx.fillRect(eqEndX + i * 14, 130 - h, 9, h);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(2, 1);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  globalStadiumLedTex = texture;
  return texture;
}

function createRibbonBoardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

  ctx.textAlign = 'center';
  ctx.font = '900 38px "Arial Black", Impact, sans-serif';
  ctx.fillStyle = '#38bdf8';
  ctx.shadowColor = '#06b6d4';
  ctx.shadowBlur = 20;
  ctx.fillText(
    '★ SYNTHETICA ARENA ★ CAMPEONATO OFICIAL WFTDA ★ CYBER SIRENS [142] ✕ [138] NEON VALKYRIES ★ VELOCIDADE MÁXIMA ★',
    canvas.width / 2,
    78
  );

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(2, 1);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  globalRibbonTex = texture;
  return texture;
}

function createJumbotronScreenTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Deep dark stadium navy background
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle digital scanline matrix
  ctx.fillStyle = 'rgba(6, 182, 212, 0.04)';
  for (let y = 0; y < canvas.height; y += 4) {
    ctx.fillRect(0, y, canvas.width, 2);
  }
  for (let x = 0; x < canvas.width; x += 16) {
    ctx.fillRect(x, 0, 1, canvas.height);
  }

  // Outer Neon border
  ctx.shadowColor = '#06b6d4';
  ctx.shadowBlur = 25;
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 10;
  ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

  // Inner Pink accent border
  ctx.shadowColor = '#ec4899';
  ctx.shadowBlur = 15;
  ctx.strokeStyle = '#ec4899';
  ctx.lineWidth = 4;
  ctx.strokeRect(26, 26, canvas.width - 52, canvas.height - 52);

  // Header Title
  ctx.shadowBlur = 35;
  ctx.shadowColor = '#06b6d4';
  ctx.textAlign = 'center';
  ctx.font = '900 82px "Arial Black", Impact, sans-serif';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('★ SYNTHETICA ARENA ★', canvas.width / 2, 115);

  ctx.font = 'bold 32px sans-serif';
  ctx.fillStyle = '#a5f3fc';
  ctx.fillText('PLACAR ELETRÔNICO GIGANTE • TELÃO CURVO 360°', canvas.width / 2, 168);

  // Middle Scores Container
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(50, 200, canvas.width - 100, 360);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(50, 200, canvas.width - 100, 360);

  // Team 1 (Sirens)
  ctx.textAlign = 'left';
  ctx.font = '900 68px sans-serif';
  ctx.fillStyle = '#06b6d4';
  ctx.fillText('CYBER SIRENS', 90, 310);
  ctx.font = '900 135px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('142', 170, 460);
  ctx.font = 'bold 28px sans-serif';
  ctx.fillStyle = '#67e8f9';
  ctx.fillText('FALTAS: ● ● ○ ○ ○ ○ ○ (2/7)', 90, 515);

  // Digital Clock Center
  ctx.textAlign = 'center';
  ctx.font = '900 140px monospace';
  ctx.fillStyle = '#f59e0b';
  ctx.fillText('01:45', canvas.width / 2, 380);

  ctx.font = '900 36px monospace';
  ctx.fillStyle = '#f8fafc';
  ctx.fillText('JAM 04 • 2º TEMPO', canvas.width / 2, 445);

  ctx.font = 'bold 28px sans-serif';
  ctx.fillStyle = '#34d399';
  ctx.fillText('CRONÔMETRO ATIVO', canvas.width / 2, 495);

  // Team 2 (Valkyries)
  ctx.textAlign = 'right';
  ctx.font = '900 68px sans-serif';
  ctx.fillStyle = '#ec4899';
  ctx.fillText('NEON VALKYRIES', canvas.width - 90, 310);
  ctx.font = '900 135px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('138', canvas.width - 170, 460);
  ctx.font = 'bold 28px sans-serif';
  ctx.fillStyle = '#f472b6';
  ctx.fillText('FALTAS: ● ● ● ○ ○ ○ ○ (3/7)', canvas.width - 90, 515);

  // Lead Jammer & Jam Status Bar
  ctx.fillStyle = 'rgba(2, 6, 23, 0.95)';
  ctx.fillRect(50, 580, canvas.width - 100, 150);
  ctx.strokeStyle = '#f43f5e';
  ctx.lineWidth = 3;
  ctx.strokeRect(50, 580, canvas.width - 100, 150);

  ctx.textAlign = 'center';
  ctx.shadowColor = '#f43f5e';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#f43f5e';
  ctx.font = '900 48px sans-serif';
  ctx.fillText('★ LEAD JAMMER: #77 STELLA NOVA (SIRENS) ★', canvas.width / 2, 650);

  ctx.shadowBlur = 0;
  ctx.font = 'bold 30px monospace';
  ctx.fillStyle = '#fcd34d';
  ctx.fillText('STATUS: POWER JAM ATIVO • PISTA LIVRE NA LINHA DE CORDA', canvas.width / 2, 700);

  // Telemetry row
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fillRect(50, 750, canvas.width - 100, 110);
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 2;
  ctx.strokeRect(50, 750, canvas.width - 100, 110);

  ctx.font = 'bold 32px monospace';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('VELOCIDADE: 39.4 KM/H  •  ÚLTIMA VOLTA: 9.6s  •  PISTA OFICIAL WFTDA', canvas.width / 2, 818);

  // Bottom Live broadcast badge
  ctx.fillStyle = '#10b981';
  ctx.font = '900 32px sans-serif';
  ctx.fillText('● TRANSMISSÃO AO VIVO • DOMO SYNTHETICA SPEEDWAY • 4K HDR ●', canvas.width / 2, 940);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function createJumbotronCornerTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1536;
  const ctx = canvas.getContext('2d')!;

  // Deep dark stadium navy background
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Digital Scanlines
  ctx.fillStyle = 'rgba(6, 182, 212, 0.04)';
  for (let y = 0; y < canvas.height; y += 4) {
    ctx.fillRect(0, y, canvas.width, 2);
  }

  // Outer Neon border
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

  // Inner Pink accent
  ctx.strokeStyle = '#ec4899';
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  // Badge Header
  ctx.textAlign = 'center';
  ctx.font = '900 52px "Arial Black", Impact, sans-serif';
  ctx.fillStyle = '#38bdf8';
  ctx.shadowColor = '#06b6d4';
  ctx.shadowBlur = 20;
  ctx.fillText('★ WFTDA ★', canvas.width / 2, 90);

  ctx.shadowBlur = 0;
  ctx.font = 'bold 28px monospace';
  ctx.fillStyle = '#ec4899';
  ctx.fillText('SYNTHETICA SPEEDWAY', canvas.width / 2, 135);

  // Penalty Box Panel
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fillRect(35, 170, canvas.width - 70, 520);
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 2;
  ctx.strokeRect(35, 170, canvas.width - 70, 520);

  ctx.font = '900 38px sans-serif';
  ctx.fillStyle = '#06b6d4';
  ctx.fillText('PENALTY BOX', canvas.width / 2, 230);

  ctx.font = 'bold 26px sans-serif';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('CYBER SIRENS', canvas.width / 2, 290);
  ctx.font = 'bold 22px monospace';
  ctx.fillStyle = '#fca5a5';
  ctx.fillText('1 EM PENALIDADE (18s)', canvas.width / 2, 330);
  ctx.fillStyle = '#67e8f9';
  ctx.fillText('FALTAS: ● ● ○ ○ ○ (2/7)', canvas.width / 2, 370);

  // Divider line
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(60, 410);
  ctx.lineTo(canvas.width - 60, 410);
  ctx.stroke();

  ctx.font = 'bold 26px sans-serif';
  ctx.fillStyle = '#ec4899';
  ctx.fillText('NEON VALKYRIES', canvas.width / 2, 460);
  ctx.font = 'bold 22px monospace';
  ctx.fillStyle = '#86efac';
  ctx.fillText('SEM PENALIDADE (0s)', canvas.width / 2, 500);
  ctx.fillStyle = '#f472b6';
  ctx.fillText('FALTAS: ● ● ● ○ ○ (3/7)', canvas.width / 2, 540);

  ctx.font = '900 32px sans-serif';
  ctx.fillStyle = '#f59e0b';
  ctx.fillText('POWER JAM: SIRENS', canvas.width / 2, 630);

  // Middle Telemetry Status
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fillRect(35, 720, canvas.width - 70, 390);
  ctx.strokeStyle = '#ec4899';
  ctx.lineWidth = 2;
  ctx.strokeRect(35, 720, canvas.width - 70, 390);

  ctx.font = '900 36px monospace';
  ctx.fillStyle = '#f59e0b';
  ctx.fillText('VOLTA: 24 / 48', canvas.width / 2, 790);

  ctx.font = 'bold 24px monospace';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('VEL: 39.4 KM/H', canvas.width / 2, 850);
  ctx.fillText('ÚLT. VOLTA: 9.6s', canvas.width / 2, 895);

  ctx.font = '900 28px sans-serif';
  ctx.fillStyle = '#10b981';
  ctx.fillText('★ 360° LIVE CAM ★', canvas.width / 2, 970);
  ctx.font = 'bold 20px monospace';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('TELEMETRIA EM TEMPO REAL', canvas.width / 2, 1020);

  // Equalizer VU-Meter Bars
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(35, 1140, canvas.width - 70, 330);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.strokeRect(35, 1140, canvas.width - 70, 330);

  ctx.font = '900 24px sans-serif';
  ctx.fillStyle = '#a5f3fc';
  ctx.fillText('ÁUDIO DA ARENA • dB', canvas.width / 2, 1180);

  const colors = ['#06b6d4', '#38bdf8', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981'];
  const numBars = 10;
  const barWidth = 32;
  const barSpacing = 10;
  const startX = (canvas.width - (numBars * barWidth + (numBars - 1) * barSpacing)) / 2;
  for (let i = 0; i < numBars; i++) {
    const barH = 50 + ((i * 37) % 180);
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(startX + i * (barWidth + barSpacing), 1430 - barH, barWidth, barH);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function createJumbotronUnderbellyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Dark Navy
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  // Concentric Neon Circles
  const drawRing = (r: number, color: string, width: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  };

  drawRing(480, '#06b6d4', 8);
  drawRing(450, '#ec4899', 4);
  drawRing(360, '#38bdf8', 6);
  drawRing(260, '#8b5cf6', 4);
  drawRing(140, '#f59e0b', 6);
  drawRing(60, '#ffffff', 4);

  // Radial compass / telemetry ticks
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
  ctx.lineWidth = 3;
  for (let a = 0; a < 360; a += 15) {
    const rad = (a * Math.PI) / 180;
    const r1 = a % 45 === 0 ? 340 : 420;
    const r2 = 470;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rad) * r1, cy + Math.sin(rad) * r1);
    ctx.lineTo(cx + Math.cos(rad) * r2, cy + Math.sin(rad) * r2);
    ctx.stroke();
  }

  // Circular Center Emblem
  ctx.textAlign = 'center';
  ctx.font = '900 48px "Arial Black", Impact, sans-serif';
  ctx.fillStyle = '#38bdf8';
  ctx.shadowColor = '#06b6d4';
  ctx.shadowBlur = 25;
  ctx.fillText('SYNTHETICA', cx, cy - 20);
  ctx.font = '900 36px monospace';
  ctx.fillStyle = '#ec4899';
  ctx.fillText('SPEEDWAY CORE', cx, cy + 30);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function createSyntheticaArenaPerimeterLED(scene: THREE.Scene) {
  const stadiumLedTex = createSyntheticaArenaLedRibbonTexture();
  const ribbonTex = createRibbonBoardTexture();

  // Vibrant emissive LED materials
  const ledMat = new THREE.MeshBasicMaterial({
    map: stadiumLedTex,
    side: THREE.DoubleSide,
  });

  const ribbonMat = new THREE.MeshBasicMaterial({
    map: ribbonTex,
    side: THREE.DoubleSide,
  });

  const casingMat = new THREE.MeshStandardMaterial({
    color: '#090d16',
    metalness: 0.9,
    roughness: 0.25,
  });

  const neonCyanMat = new THREE.MeshBasicMaterial({ color: '#06b6d4' });
  const neonPinkMat = new THREE.MeshBasicMaterial({ color: '#ec4899' });

  // -------------------------------------------------------------
  // 1. Continuous 360° Upper Stadium Perimeter LED Ribbon (Y = 10.5m)
  // Perfectly aligned flat against walls (thickness 0.05m) - NO wall clipping
  // -------------------------------------------------------------
  const ribbonHeight = 2.3;
  const halfH = ribbonHeight / 2;

  // --- North Wall Ribbon (Width = 83.6m, Z = -35.42) ---
  const northGroup = new THREE.Group();
  northGroup.position.set(0, 10.5, -35.42);
  scene.add(northGroup);

  // Mounting Backplate
  const northCasing = new THREE.Mesh(new THREE.BoxGeometry(83.8, ribbonHeight + 0.15, 0.06), casingMat);
  northCasing.position.z = -0.04;
  northGroup.add(northCasing);

  // LED Screen
  const northScreen = new THREE.Mesh(new THREE.PlaneGeometry(83.6, ribbonHeight), ledMat);
  northGroup.add(northScreen);

  // Top & Bottom Glowing Neon Edge Strips
  const northTopNeon = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 83.6, 8), neonCyanMat);
  northTopNeon.rotation.z = Math.PI / 2;
  northTopNeon.position.set(0, halfH + 0.04, 0.02);
  northGroup.add(northTopNeon);

  const northBottomNeon = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 83.6, 8), neonPinkMat);
  northBottomNeon.rotation.z = Math.PI / 2;
  northBottomNeon.position.set(0, -halfH - 0.04, 0.02);
  northGroup.add(northBottomNeon);

  // --- South Wall Ribbon (Width = 83.6m, Z = 35.42) ---
  const southGroup = new THREE.Group();
  southGroup.position.set(0, 10.5, 35.42);
  southGroup.rotation.y = Math.PI;
  scene.add(southGroup);

  const southCasing = new THREE.Mesh(new THREE.BoxGeometry(83.8, ribbonHeight + 0.15, 0.06), casingMat);
  southCasing.position.z = -0.04;
  southGroup.add(southCasing);

  const southScreen = new THREE.Mesh(new THREE.PlaneGeometry(83.6, ribbonHeight), ledMat);
  southGroup.add(southScreen);

  const southTopNeon = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 83.6, 8), neonCyanMat);
  southTopNeon.rotation.z = Math.PI / 2;
  southTopNeon.position.set(0, halfH + 0.04, 0.02);
  southGroup.add(southTopNeon);

  const southBottomNeon = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 83.6, 8), neonPinkMat);
  southBottomNeon.rotation.z = Math.PI / 2;
  southBottomNeon.position.set(0, -halfH - 0.04, 0.02);
  southGroup.add(southBottomNeon);

  // --- East Wall Ribbon (Width = 70.6m, X = 41.42) ---
  const eastGroup = new THREE.Group();
  eastGroup.position.set(41.42, 10.5, 0);
  eastGroup.rotation.y = -Math.PI / 2;
  scene.add(eastGroup);

  const eastCasing = new THREE.Mesh(new THREE.BoxGeometry(70.8, ribbonHeight + 0.15, 0.06), casingMat);
  eastCasing.position.z = -0.04;
  eastGroup.add(eastCasing);

  const eastScreen = new THREE.Mesh(new THREE.PlaneGeometry(70.6, ribbonHeight), ledMat);
  eastGroup.add(eastScreen);

  const eastTopNeon = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 70.6, 8), neonCyanMat);
  eastTopNeon.rotation.z = Math.PI / 2;
  eastTopNeon.position.set(0, halfH + 0.04, 0.02);
  eastGroup.add(eastTopNeon);

  const eastBottomNeon = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 70.6, 8), neonPinkMat);
  eastBottomNeon.rotation.z = Math.PI / 2;
  eastBottomNeon.position.set(0, -halfH - 0.04, 0.02);
  eastGroup.add(eastBottomNeon);

  // --- West Wall Ribbon (Width = 70.6m, X = -41.42) ---
  const westGroup = new THREE.Group();
  westGroup.position.set(-41.42, 10.5, 0);
  westGroup.rotation.y = Math.PI / 2;
  scene.add(westGroup);

  const westCasing = new THREE.Mesh(new THREE.BoxGeometry(70.8, ribbonHeight + 0.15, 0.06), casingMat);
  westCasing.position.z = -0.04;
  westGroup.add(westCasing);

  const westScreen = new THREE.Mesh(new THREE.PlaneGeometry(70.6, ribbonHeight), ledMat);
  westGroup.add(westScreen);

  const westTopNeon = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 70.6, 8), neonCyanMat);
  westTopNeon.rotation.z = Math.PI / 2;
  westTopNeon.position.set(0, halfH + 0.04, 0.02);
  westGroup.add(westTopNeon);

  const westBottomNeon = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 70.6, 8), neonPinkMat);
  westBottomNeon.rotation.z = Math.PI / 2;
  westBottomNeon.position.set(0, -halfH - 0.04, 0.02);
  westGroup.add(westBottomNeon);

  // -------------------------------------------------------------
  // 2. Corner Joint Pylons (Seamless connection at all 4 corners)
  // -------------------------------------------------------------
  const corners = [
    [-41.42, -35.42],
    [41.42, -35.42],
    [-41.42, 35.42],
    [41.42, 35.42],
  ];
  corners.forEach(([cx, cz]) => {
    const cornerPylon = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, ribbonHeight + 0.3, 12), casingMat);
    cornerPylon.position.set(cx, 10.5, cz);
    scene.add(cornerPylon);

    const cornerNeon = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, ribbonHeight + 0.2, 8), neonCyanMat);
    cornerNeon.position.set(cx, 10.5, cz);
    scene.add(cornerNeon);
  });

  // -------------------------------------------------------------
  // 3. Lower Concourse LED Fascia Ribbons (Above stands at Y = 4.8m)
  // -------------------------------------------------------------
  const northRibbon = new THREE.Mesh(new THREE.PlaneGeometry(76, 1.4), ribbonMat);
  northRibbon.position.set(0, 4.8, -35.2);
  scene.add(northRibbon);

  const southRibbon = new THREE.Mesh(new THREE.PlaneGeometry(76, 1.4), ribbonMat);
  southRibbon.position.set(0, 4.8, 35.2);
  southRibbon.rotation.y = Math.PI;
  scene.add(southRibbon);

  // -------------------------------------------------------------
  // 4. Soft Cyberpunk Atmospheric Ambient Wall Glow
  // -------------------------------------------------------------
  const northLight = new THREE.PointLight('#06b6d4', 2.0, 40);
  northLight.position.set(0, 10.5, -28);
  scene.add(northLight);

  const southLight = new THREE.PointLight('#ec4899', 2.0, 40);
  southLight.position.set(0, 10.5, 28);
  scene.add(southLight);

  const eastLight = new THREE.PointLight('#38bdf8', 1.8, 35);
  eastLight.position.set(34, 10.5, 0);
  scene.add(eastLight);

  const westLight = new THREE.PointLight('#a855f7', 1.8, 35);
  westLight.position.set(-34, 10.5, 0);
  scene.add(westLight);
}

function createDerbyTrack(scene: THREE.Scene) {
  // Track geometry parameters (WFTDA Flat Track proportions)
  const trackGroup = new THREE.Group();
  scene.add(trackGroup);

  const innerR = 9.4;
  const outerR = 13.6;
  const straightLength = 32;

  // Track Surface Ribbon (Straightaways + Curves)
  const trackMat = new THREE.MeshStandardMaterial({
    color: '#131b2e',
    roughness: 0.2,
    metalness: 0.15,
  });

  // Bottom Straight Track Mesh
  const straightGeo = new THREE.PlaneGeometry(straightLength, outerR - innerR);
  const bottomStraight = new THREE.Mesh(straightGeo, trackMat);
  bottomStraight.rotation.x = -Math.PI / 2;
  bottomStraight.position.set(0, 0.02, (innerR + outerR) / 2);
  bottomStraight.receiveShadow = true;
  trackGroup.add(bottomStraight);

  // Top Straight Track Mesh
  const topStraight = new THREE.Mesh(straightGeo, trackMat);
  topStraight.rotation.x = -Math.PI / 2;
  topStraight.position.set(0, 0.02, -((innerR + outerR) / 2));
  topStraight.receiveShadow = true;
  trackGroup.add(topStraight);

  // Left Turn Curve Mesh (Ring Geometry)
  const leftCurveGeo = new THREE.RingGeometry(innerR, outerR, 32, 1, Math.PI / 2, Math.PI);
  const leftCurve = new THREE.Mesh(leftCurveGeo, trackMat);
  leftCurve.rotation.x = -Math.PI / 2;
  leftCurve.position.set(-16, 0.02, 0);
  leftCurve.receiveShadow = true;
  trackGroup.add(leftCurve);

  // Right Turn Curve Mesh
  const rightCurveGeo = new THREE.RingGeometry(innerR, outerR, 32, 1, -Math.PI / 2, Math.PI);
  const rightCurve = new THREE.Mesh(rightCurveGeo, trackMat);
  rightCurve.rotation.x = -Math.PI / 2;
  rightCurve.position.set(16, 0.02, 0);
  rightCurve.receiveShadow = true;
  trackGroup.add(rightCurve);

  // Boundary Lines (Inner Boundary: Glowing Cyan, Outer Boundary: Glowing Magenta)
  const innerLineMat = new THREE.MeshBasicMaterial({ color: '#06b6d4' });
  const outerLineMat = new THREE.MeshBasicMaterial({ color: '#ec4899' });

  // Draw inner and outer boundary lines with tubular / ribbon geometry
  createBoundaryTape(trackGroup, innerR, 0.08, innerLineMat);
  createBoundaryTape(trackGroup, outerR, 0.08, outerLineMat);

  // Pivot Line (at X = -15, across the track from innerR to outerR on the bottom straight)
  const pivotLineGeo = new THREE.PlaneGeometry(outerR - innerR, 0.25);
  const pivotLineMat = new THREE.MeshBasicMaterial({ color: '#06b6d4' });
  const pivotLine = new THREE.Mesh(pivotLineGeo, pivotLineMat);
  pivotLine.rotation.x = -Math.PI / 2;
  pivotLine.rotation.z = Math.PI / 2;
  pivotLine.position.set(-15, 0.03, (innerR + outerR) / 2);
  trackGroup.add(pivotLine);

  // Jammer Line (30ft behind Pivot Line, at X = -6)
  const jammerLineGeo = new THREE.PlaneGeometry(outerR - innerR, 0.25);
  const jammerLineMat = new THREE.MeshBasicMaterial({ color: '#ec4899' });
  const jammerLine = new THREE.Mesh(jammerLineGeo, jammerLineMat);
  jammerLine.rotation.x = -Math.PI / 2;
  jammerLine.rotation.z = Math.PI / 2;
  jammerLine.position.set(-6, 0.03, (innerR + outerR) / 2);
  trackGroup.add(jammerLine);

  // 10-ft Track Hash Marks around the loop
  const hashMat = new THREE.MeshBasicMaterial({ color: '#94a3b8' });
  for (let step = 0; step < 24; step++) {
    const frac = step / 24;
    const { pos, tangent } = getTrackPositionStatic(frac, 0);
    const hash = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.15), hashMat);
    hash.rotation.x = -Math.PI / 2;
    hash.rotation.z = Math.atan2(tangent.x, tangent.z) + Math.PI / 2;
    hash.position.set(pos.x, 0.025, pos.z);
    trackGroup.add(hash);
  }

  // Safety Track Pylons / Cones on Apex corners
  const coneGeo = new THREE.ConeGeometry(0.3, 0.6, 6);
  const coneMat = new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.3 });
  const conePositions = [
    [-16, 0.3, innerR - 0.2],
    [-16, 0.3, -innerR + 0.2],
    [16, 0.3, innerR - 0.2],
    [16, 0.3, -innerR + 0.2],
    [-25.4, 0.3, 0],
    [25.4, 0.3, 0],
  ];
  conePositions.forEach((pos) => {
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(pos[0], pos[1], pos[2]);
    trackGroup.add(cone);
  });
}

function createBoundaryTape(group: THREE.Group, radius: number, thickness: number, material: THREE.Material) {
  // Straight 1
  const straight1 = new THREE.Mesh(new THREE.PlaneGeometry(32, thickness), material);
  straight1.rotation.x = -Math.PI / 2;
  straight1.position.set(0, 0.028, radius);
  group.add(straight1);

  // Straight 2
  const straight2 = new THREE.Mesh(new THREE.PlaneGeometry(32, thickness), material);
  straight2.rotation.x = -Math.PI / 2;
  straight2.position.set(0, 0.028, -radius);
  group.add(straight2);

  // Curve 1
  const curve1Geo = new THREE.RingGeometry(radius - thickness / 2, radius + thickness / 2, 32, 1, Math.PI / 2, Math.PI);
  const curve1 = new THREE.Mesh(curve1Geo, material);
  curve1.rotation.x = -Math.PI / 2;
  curve1.position.set(-16, 0.028, 0);
  group.add(curve1);

  // Curve 2
  const curve2Geo = new THREE.RingGeometry(radius - thickness / 2, radius + thickness / 2, 32, 1, -Math.PI / 2, Math.PI);
  const curve2 = new THREE.Mesh(curve2Geo, material);
  curve2.rotation.x = -Math.PI / 2;
  curve2.position.set(16, 0.028, 0);
  group.add(curve2);
}

// -------------------------------------------------------------
// Interactive Cyber Touch Table (Central Infield Simulator Console)
// -------------------------------------------------------------
export interface TouchTableData {
  group: THREE.Group;
  screenMesh: THREE.Mesh;
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  holoRing: THREE.Mesh;
  holoIcon: THREE.Mesh;
  glowLight: THREE.PointLight;
  floorRingMat: THREE.MeshBasicMaterial;
}

function drawTouchTableCanvas(canvas: HTMLCanvasElement, isSimulating: boolean) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // Background Gradient
  const grad = ctx.createLinearGradient(0, 0, w, h);
  if (isSimulating) {
    grad.addColorStop(0, '#021813');
    grad.addColorStop(0.5, '#052a20');
    grad.addColorStop(1, '#02161b');
  } else {
    grad.addColorStop(0, '#040714');
    grad.addColorStop(0.5, '#0b1329');
    grad.addColorStop(1, '#1b0d24');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Cyber Grid Scanlines
  ctx.fillStyle = isSimulating ? 'rgba(52, 211, 153, 0.06)' : 'rgba(56, 189, 248, 0.06)';
  for (let y = 0; y < h; y += 4) {
    ctx.fillRect(0, y, w, 2);
  }
  for (let x = 0; x < w; x += 24) {
    ctx.fillRect(x, 0, 1, h);
  }

  // Outer Glowing Neon Frame
  ctx.shadowColor = isSimulating ? '#10b981' : '#06b6d4';
  ctx.shadowBlur = 24;
  ctx.strokeStyle = isSimulating ? '#34d399' : '#38bdf8';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(18, 18, w - 36, h - 36, 20);
  ctx.stroke();

  // Corner tech markers
  const cornerSize = 36;
  ctx.lineWidth = 10;
  ctx.strokeStyle = isSimulating ? '#6ee7b7' : '#93c5fd';
  // Top-left
  ctx.beginPath();
  ctx.moveTo(18, 18 + cornerSize);
  ctx.lineTo(18, 18);
  ctx.lineTo(18 + cornerSize, 18);
  ctx.stroke();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(w - 18 - cornerSize, 18);
  ctx.lineTo(w - 18, 18);
  ctx.lineTo(w - 18, 18 + cornerSize);
  ctx.stroke();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(18, h - 18 - cornerSize);
  ctx.lineTo(18, h - 18);
  ctx.lineTo(18 + cornerSize, h - 18);
  ctx.stroke();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(w - 18 - cornerSize, h - 18);
  ctx.lineTo(w - 18, h - 18);
  ctx.lineTo(w - 18, h - 18 - cornerSize);
  ctx.stroke();

  // Top Header Banner
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.beginPath();
  ctx.roundRect(32, 32, w - 64, 68, 12);
  ctx.fill();
  ctx.strokeStyle = isSimulating ? 'rgba(52, 211, 153, 0.4)' : 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Header Title
  ctx.textAlign = 'left';
  ctx.font = '900 22px monospace';
  ctx.fillStyle = isSimulating ? '#6ee7b7' : '#7dd3fc';
  ctx.fillText('◈ SYNTHETICA ARENA • MESA TOUCH CENTRAL', 56, 74);

  // Status Badge
  ctx.textAlign = 'right';
  ctx.font = 'bold 18px monospace';
  if (isSimulating) {
    ctx.fillStyle = '#34d399';
    ctx.fillText('● JAM ATIVO [ONLINE]', w - 56, 74);
  } else {
    ctx.fillStyle = '#f472b6';
    ctx.fillText('⏸ SIMULAÇÃO PAUSADA', w - 56, 74);
  }

  // Large Central Touch Button
  const btnX = 80;
  const btnY = 125;
  const btnW = w - 160;
  const btnH = 410;

  const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH);
  if (isSimulating) {
    btnGrad.addColorStop(0, '#064e3b');
    btnGrad.addColorStop(0.5, '#047857');
    btnGrad.addColorStop(1, '#065f46');
  } else {
    btnGrad.addColorStop(0, '#0f172a');
    btnGrad.addColorStop(0.5, '#1e293b');
    btnGrad.addColorStop(1, '#1e1b4b');
  }
  ctx.fillStyle = btnGrad;
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, 26);
  ctx.fill();

  ctx.shadowColor = isSimulating ? '#34d399' : '#38bdf8';
  ctx.shadowBlur = 36;
  ctx.strokeStyle = isSimulating ? '#34d399' : '#38bdf8';
  ctx.lineWidth = 6;
  ctx.stroke();

  // Button Icon and Text
  ctx.textAlign = 'center';
  ctx.shadowBlur = 20;

  if (isSimulating) {
    // Pause symbol
    ctx.shadowColor = '#fef08a';
    ctx.fillStyle = '#fef08a';
    ctx.font = '900 84px sans-serif';
    ctx.fillText('❚❚', w / 2, btnY + 115);

    // Main Title
    ctx.font = '900 44px "Arial Black", Impact, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('SIMULAÇÃO DO JAM ATIVA', w / 2, btnY + 195);

    // Subtitle
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = '#a7f3d0';
    ctx.fillText('Pelotão em movimento em volta da pista oval', w / 2, btnY + 250);

    // Call to Action Pill
    const pillW = 600;
    const pillH = 64;
    const pillX = w / 2 - pillW / 2;
    const pillY = btnY + 300;

    ctx.shadowBlur = 18;
    ctx.shadowColor = '#f43f5e';
    ctx.fillStyle = 'rgba(225, 29, 72, 0.85)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 32);
    ctx.fill();
    ctx.strokeStyle = '#fda4af';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.font = '900 24px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('» TOQUE NA MESA PARA PAUSAR O JAM «', w / 2, pillY + 41);
  } else {
    // Play symbol
    ctx.shadowColor = '#38bdf8';
    ctx.fillStyle = '#38bdf8';
    ctx.font = '900 84px sans-serif';
    ctx.fillText('▶', w / 2, btnY + 115);

    // Main Title
    ctx.font = '900 44px "Arial Black", Impact, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('SIMULAÇÃO DO JAM PAUSADA', w / 2, btnY + 195);

    // Subtitle
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = '#fbcfe8';
    ctx.fillText('Patinadoras aguardando na Pivot Line e Jammer Line', w / 2, btnY + 250);

    // Call to Action Pill
    const pillW = 600;
    const pillH = 64;
    const pillX = w / 2 - pillW / 2;
    const pillY = btnY + 300;

    ctx.shadowBlur = 18;
    ctx.shadowColor = '#10b981';
    ctx.fillStyle = 'rgba(5, 150, 105, 0.85)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 32);
    ctx.fill();
    ctx.strokeStyle = '#6ee7b7';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.font = '900 24px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('» TOQUE NA MESA PARA INICIAR O JAM «', w / 2, pillY + 41);
  }

  // Footer Instructions
  ctx.shadowBlur = 0;
  ctx.textAlign = 'center';
  ctx.font = 'bold 17px monospace';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('CONTROLE TÁTIL • CLIQUE COM O MOUSE OU PRESSIONE [E] AO SE APROXIMAR', w / 2, h - 40);
}

function updateTouchTableScreen(data: TouchTableData, isSimulating: boolean) {
  drawTouchTableCanvas(data.canvas, isSimulating);
  data.texture.needsUpdate = true;

  const colorHex = isSimulating ? '#10b981' : '#06b6d4';
  data.glowLight.color.set(colorHex);
  data.floorRingMat.color.set(colorHex);

  const holoMat = data.holoRing.material as THREE.MeshBasicMaterial;
  holoMat.color.set(isSimulating ? '#34d399' : '#38bdf8');
  const iconMat = data.holoIcon.material as THREE.MeshBasicMaterial;
  iconMat.color.set(isSimulating ? '#fef08a' : '#67e8f9');
}

function createCyberTouchTable(scene: THREE.Scene, isSimulating: boolean): TouchTableData {
  const tableGroup = new THREE.Group();
  tableGroup.position.set(0, 0, 0);
  tableGroup.userData = { isTouchTable: true };
  scene.add(tableGroup);

  // 1. Floor Hologram Ring
  const ringGeo = new THREE.RingGeometry(1.6, 2.3, 36);
  const floorRingMat = new THREE.MeshBasicMaterial({
    color: isSimulating ? '#10b981' : '#06b6d4',
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  });
  const floorRing = new THREE.Mesh(ringGeo, floorRingMat);
  floorRing.rotation.x = -Math.PI / 2;
  floorRing.position.y = 0.02;
  tableGroup.add(floorRing);

  // 2. Base Pedestal (Octagonal dark brushed steel)
  const baseGeo = new THREE.CylinderGeometry(1.35, 1.55, 0.22, 8);
  const baseMat = new THREE.MeshStandardMaterial({
    color: '#090d16',
    metalness: 0.85,
    roughness: 0.3,
  });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.11;
  base.castShadow = true;
  base.receiveShadow = true;
  base.userData = { isTouchTable: true };
  tableGroup.add(base);

  // Glowing base ring
  const baseRimGeo = new THREE.TorusGeometry(1.42, 0.035, 8, 32);
  const baseRimMat = new THREE.MeshBasicMaterial({ color: isSimulating ? '#34d399' : '#38bdf8' });
  const baseRim = new THREE.Mesh(baseRimGeo, baseRimMat);
  baseRim.rotation.x = Math.PI / 2;
  baseRim.position.y = 0.21;
  tableGroup.add(baseRim);

  // 3. Support Columns (Twin cyber pillars)
  const pillarGeo = new THREE.BoxGeometry(0.35, 0.75, 0.45);
  const pillarMat = new THREE.MeshStandardMaterial({
    color: '#111827',
    metalness: 0.9,
    roughness: 0.3,
  });

  const pillarL = new THREE.Mesh(pillarGeo, pillarMat);
  pillarL.position.set(-0.65, 0.58, 0);
  pillarL.castShadow = true;
  pillarL.userData = { isTouchTable: true };
  tableGroup.add(pillarL);

  const pillarR = new THREE.Mesh(pillarGeo, pillarMat);
  pillarR.position.set(0.65, 0.58, 0);
  pillarR.castShadow = true;
  pillarR.userData = { isTouchTable: true };
  tableGroup.add(pillarR);

  // Neon Conduits on pillars
  const conduitGeo = new THREE.BoxGeometry(0.04, 0.65, 0.47);
  const conduitMat = new THREE.MeshBasicMaterial({ color: isSimulating ? '#10b981' : '#06b6d4' });
  const conduitL = new THREE.Mesh(conduitGeo, conduitMat);
  conduitL.position.set(-0.65, 0.58, 0);
  tableGroup.add(conduitL);
  const conduitR = new THREE.Mesh(conduitGeo, conduitMat);
  conduitR.position.set(0.65, 0.58, 0);
  tableGroup.add(conduitR);

  // 4. Console Top (Tilted toward player standing in front at +Z)
  const consoleAngle = 0.42; // ~24 degrees tilted toward +Z
  const consoleGroup = new THREE.Group();
  consoleGroup.position.set(0, 0.95, 0);
  consoleGroup.rotation.x = consoleAngle;
  consoleGroup.userData = { isTouchTable: true };
  tableGroup.add(consoleGroup);

  // Console housing body
  const bodyGeo = new THREE.BoxGeometry(2.8, 0.16, 1.6);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: '#0f172a',
    metalness: 0.8,
    roughness: 0.35,
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyMesh.userData = { isTouchTable: true };
  consoleGroup.add(bodyMesh);

  // Console Neon Border Trim
  const trimGeo = new THREE.BoxGeometry(2.84, 0.04, 1.64);
  const trimMat = new THREE.MeshBasicMaterial({ color: isSimulating ? '#34d399' : '#38bdf8' });
  const trimMesh = new THREE.Mesh(trimGeo, trimMat);
  trimMesh.position.y = 0.05;
  consoleGroup.add(trimMesh);

  // 5. High-Resolution Touch Screen Canvas & Texture
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 640;
  drawTouchTableCanvas(canvas, isSimulating);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;

  const screenGeo = new THREE.PlaneGeometry(2.55, 1.4);
  const screenMat = new THREE.MeshBasicMaterial({
    map: texture,
    toneMapped: false,
  });
  const screenMesh = new THREE.Mesh(screenGeo, screenMat);
  screenMesh.rotation.x = -Math.PI / 2;
  screenMesh.position.y = 0.088;
  screenMesh.userData = { isTouchTable: true };
  consoleGroup.add(screenMesh);

  // Protective glass sheen overlay
  const glassGeo = new THREE.PlaneGeometry(2.57, 1.42);
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    transmission: 0.88,
    roughness: 0.1,
    transparent: true,
    opacity: 0.25,
  });
  const glassMesh = new THREE.Mesh(glassGeo, glassMat);
  glassMesh.rotation.x = -Math.PI / 2;
  glassMesh.position.y = 0.091;
  glassMesh.userData = { isTouchTable: true };
  consoleGroup.add(glassMesh);

  // 6. Floating 3D Hologram Projector Node & Ring
  const projGeo = new THREE.CylinderGeometry(0.12, 0.18, 0.08, 16);
  const projMat = new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.9 });
  const projector = new THREE.Mesh(projGeo, projMat);
  projector.position.set(0, 0.11, -0.72);
  consoleGroup.add(projector);

  // Floating Hologram Ring in world space above the table
  const holoGroup = new THREE.Group();
  holoGroup.position.set(0, 1.85, 0);
  holoGroup.userData = { isTouchTable: true };
  tableGroup.add(holoGroup);

  const holoRingGeo = new THREE.TorusGeometry(0.48, 0.024, 8, 32);
  const holoRingMat = new THREE.MeshBasicMaterial({
    color: isSimulating ? '#34d399' : '#38bdf8',
    wireframe: true,
    transparent: true,
    opacity: 0.85,
  });
  const holoRing = new THREE.Mesh(holoRingGeo, holoRingMat);
  holoRing.userData = { isTouchTable: true };
  holoGroup.add(holoRing);

  // Floating Hologram Center 3D Icon (Diamond/Octahedron)
  const iconGeo = new THREE.OctahedronGeometry(0.24, 0);
  const iconMat = new THREE.MeshBasicMaterial({
    color: isSimulating ? '#fef08a' : '#67e8f9',
    wireframe: true,
    transparent: true,
    opacity: 0.9,
  });
  const holoIcon = new THREE.Mesh(iconGeo, iconMat);
  holoIcon.userData = { isTouchTable: true };
  holoGroup.add(holoIcon);

  // 7. Interactive Downward Glow Light
  const glowLight = new THREE.PointLight(isSimulating ? '#10b981' : '#06b6d4', 2.5, 9.0);
  glowLight.position.set(0, 1.9, 0.2);
  tableGroup.add(glowLight);

  return {
    group: tableGroup,
    screenMesh,
    canvas,
    texture,
    holoRing,
    holoIcon,
    glowLight,
    floorRingMat,
  };
}

function createInfieldAndScoreboard(scene: THREE.Scene, isSimulating: boolean): TouchTableData {
  // 1. Central Interactive Cyber Touch Table Console
  const touchTableData = createCyberTouchTable(scene, isSimulating);

  // 2. Penalty Box Area (Shifted back slightly to leave center infield clear for touch table)
  const pboxGroup = new THREE.Group();
  pboxGroup.position.set(0, 0, -2.4);
  scene.add(pboxGroup);

  // Whiteboard with penalty records
  const boardGeo = new THREE.BoxGeometry(3, 1.8, 0.1);
  const boardMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.3 });
  const board = new THREE.Mesh(boardGeo, boardMat);
  board.position.set(0, 1.6, -0.6);
  pboxGroup.add(board);

  // Penalty Box Chairs (3 for Valkyries, 3 for Sirens)
  // WFTDA Official Layout: 1 Jammer chair with Star + 2 Blocker chairs per team
  const chairMatSirens = new THREE.MeshStandardMaterial({ color: '#06b6d4', roughness: 0.4 });
  const chairMatValks = new THREE.MeshStandardMaterial({ color: '#ec4899', roughness: 0.4 });

  for (let i = -1; i <= 1; i++) {
    // i = -1 is the designated Jammer chair featuring the Star!
    const isJammerSeat = i === -1;

    // Sirens chairs (Cyan) - 1 with Star, 2 regular
    const chairS = createFoldingChair(chairMatSirens, isJammerSeat, '#fef08a');
    chairS.position.set(-1.8 + i * 0.75, 0, 0.4);
    pboxGroup.add(chairS);

    // Valkyries chairs (Pink) - 1 with Star, 2 regular
    const chairV = createFoldingChair(chairMatValks, isJammerSeat, '#fef08a');
    chairV.position.set(1.0 + i * 0.75, 0, 0.4);
    pboxGroup.add(chairV);
  }

  // =========================================================================
  // MEGA JUMBOTRON: Curved 8-Sided Halo Centerhung Display & Scoreboard
  // =========================================================================
  const jumbotronGroup = new THREE.Group();
  jumbotronGroup.position.set(0, 13.0, 0);
  scene.add(jumbotronGroup);

  // Central Core Housing Framework (Octagonal / Dark Steel)
  const coreHousingGeo = new THREE.CylinderGeometry(6.4, 5.4, 6.8, 8, 1, false);
  const coreHousingMat = new THREE.MeshStandardMaterial({
    color: '#030712',
    metalness: 0.9,
    roughness: 0.25,
  });
  const coreHousing = new THREE.Mesh(coreHousingGeo, coreHousingMat);
  coreHousing.rotation.y = Math.PI / 8;
  jumbotronGroup.add(coreHousing);

  // Textures
  const jumboTex = createJumbotronScreenTexture();
  const cornerTex = createJumbotronCornerTexture();
  const underbellyTex = createJumbotronUnderbellyTexture();
  const ribbonTex = createRibbonBoardTexture();

  const jumboScreenMat = new THREE.MeshBasicMaterial({ map: jumboTex, side: THREE.DoubleSide });
  const cornerScreenMat = new THREE.MeshBasicMaterial({ map: cornerTex, side: THREE.DoubleSide });
  const ribbonScreenMat = new THREE.MeshBasicMaterial({ map: ribbonTex, side: THREE.DoubleSide });
  const underbellyMat = new THREE.MeshBasicMaterial({ map: underbellyTex, side: THREE.DoubleSide });
  const frameBackMat = new THREE.MeshStandardMaterial({ color: '#090d16', metalness: 0.85, roughness: 0.3 });

  // 1. Four Main Curved LED Displays (North, South, East, West)
  // Scaled width (10.4m) so cardinal faces never overlap corner screens
  const mainScreenGeo = createCurvedPlaneGeometry(10.4, 5.6, 0.85, 36, 6, 0.08);
  const mainBackingGeo = createCurvedPlaneGeometry(10.5, 5.7, 0.85, 36, 6, 0.08);

  const cardinalFaces = [
    { name: 'South', pos: new THREE.Vector3(0, 0, 6.8), rotY: 0 },
    { name: 'North', pos: new THREE.Vector3(0, 0, -6.8), rotY: Math.PI },
    { name: 'East', pos: new THREE.Vector3(6.8, 0, 0), rotY: Math.PI / 2 },
    { name: 'West', pos: new THREE.Vector3(-6.8, 0, 0), rotY: -Math.PI / 2 },
  ];

  const edgeTubeGeo = new THREE.CylinderGeometry(0.06, 0.06, 5.6, 8);
  const edgeTubeMat = new THREE.MeshBasicMaterial({ color: '#06b6d4' });

  cardinalFaces.forEach((face) => {
    const faceGroup = new THREE.Group();
    faceGroup.position.copy(face.pos);
    faceGroup.rotation.y = face.rotY;

    // Backing housing frame
    const backing = new THREE.Mesh(mainBackingGeo, frameBackMat);
    backing.position.z = -0.1;
    faceGroup.add(backing);

    // Glowing curved LED display
    const screen = new THREE.Mesh(mainScreenGeo, jumboScreenMat);
    screen.position.z = 0.04;
    faceGroup.add(screen);

    // Glowing neon top & bottom curved tubes
    const topTube = createCurvedEdgeTube(10.4, 0.85, 2.82, 0.08, '#06b6d4', 0.07, 32);
    topTube.position.z = 0.06;
    faceGroup.add(topTube);

    const bottomTube = createCurvedEdgeTube(10.4, 0.85, -2.82, 0.08, '#ec4899', 0.07, 32);
    bottomTube.position.z = 0.06;
    faceGroup.add(bottomTube);

    // Left & right edge vertical neon tubes
    const leftEdge = new THREE.Mesh(edgeTubeGeo, edgeTubeMat);
    leftEdge.position.set(-5.2, 0, 0.06);
    faceGroup.add(leftEdge);

    const rightEdge = new THREE.Mesh(edgeTubeGeo, edgeTubeMat);
    rightEdge.position.set(5.2, 0, 0.06);
    faceGroup.add(rightEdge);

    jumbotronGroup.add(faceGroup);
  });

  // 2. Four Diagonal Curved Corner Displays (SE, SW, NE, NW)
  // Calibrated width (1.85m) at radius 8.5m with clean seams and zero overlap!
  const cornerScreenGeo = createCurvedPlaneGeometry(1.85, 5.6, 0.12, 16, 6, 0.08);
  const cornerBackingGeo = createCurvedPlaneGeometry(1.9, 5.7, 0.12, 16, 6, 0.08);
  const cornerEdgeTubeGeo = new THREE.CylinderGeometry(0.05, 0.05, 5.6, 8);
  const cornerEdgeTubeMat = new THREE.MeshBasicMaterial({ color: '#38bdf8' });

  const cornerFaces = [
    { angle: Math.PI / 4, rotY: Math.PI / 4 }, // SE
    { angle: -Math.PI / 4, rotY: -Math.PI / 4 }, // SW
    { angle: (3 * Math.PI) / 4, rotY: (3 * Math.PI) / 4 }, // NE
    { angle: -(3 * Math.PI) / 4, rotY: -(3 * Math.PI) / 4 }, // NW
  ];

  const cornerRadius = 8.5;
  cornerFaces.forEach((c) => {
    const cornerGroup = new THREE.Group();
    cornerGroup.position.set(Math.sin(c.angle) * cornerRadius, 0, Math.cos(c.angle) * cornerRadius);
    cornerGroup.rotation.y = c.rotY;

    // Corner structural anchor post behind the seam
    const postGeo = new THREE.BoxGeometry(2.1, 5.8, 0.5);
    const postMesh = new THREE.Mesh(postGeo, frameBackMat);
    postMesh.position.z = -0.3;
    cornerGroup.add(postMesh);

    const backing = new THREE.Mesh(cornerBackingGeo, frameBackMat);
    backing.position.z = -0.08;
    cornerGroup.add(backing);

    const screen = new THREE.Mesh(cornerScreenGeo, cornerScreenMat);
    screen.position.z = 0.04;
    cornerGroup.add(screen);

    const topTube = createCurvedEdgeTube(1.85, 0.12, 2.82, 0.08, '#38bdf8', 0.06, 16);
    topTube.position.z = 0.06;
    cornerGroup.add(topTube);

    const bottomTube = createCurvedEdgeTube(1.85, 0.12, -2.82, 0.08, '#ec4899', 0.06, 16);
    bottomTube.position.z = 0.06;
    cornerGroup.add(bottomTube);

    const leftEdge = new THREE.Mesh(cornerEdgeTubeGeo, cornerEdgeTubeMat);
    leftEdge.position.set(-0.925, 0, 0.06);
    cornerGroup.add(leftEdge);

    const rightEdge = new THREE.Mesh(cornerEdgeTubeGeo, cornerEdgeTubeMat);
    rightEdge.position.set(0.925, 0, 0.06);
    cornerGroup.add(rightEdge);

    jumbotronGroup.add(cornerGroup);
  });

  // 3. Upper 360° Circular Halo Ring Display (Radius 7.6m, Height 0.85m)
  const upperHaloGeo = new THREE.CylinderGeometry(7.6, 7.6, 0.85, 64, 1, true);
  const upperHalo = new THREE.Mesh(upperHaloGeo, ribbonScreenMat);
  upperHalo.position.set(0, 3.35, 0);
  jumbotronGroup.add(upperHalo);

  // Upper halo metallic rims
  const rimMat = new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.9, roughness: 0.2 });
  const upperRimGeo = new THREE.TorusGeometry(7.62, 0.07, 8, 64);
  const topUpperRim = new THREE.Mesh(upperRimGeo, rimMat);
  topUpperRim.rotation.x = Math.PI / 2;
  topUpperRim.position.set(0, 3.77, 0);
  jumbotronGroup.add(topUpperRim);

  const bottomUpperRim = new THREE.Mesh(upperRimGeo, rimMat);
  bottomUpperRim.rotation.x = Math.PI / 2;
  bottomUpperRim.position.set(0, 2.93, 0);
  jumbotronGroup.add(bottomUpperRim);

  // 4. Lower 360° Circular Halo Ring Display (Radius 6.0m, Height 0.75m)
  const lowerHaloGeo = new THREE.CylinderGeometry(6.0, 6.0, 0.75, 64, 1, true);
  const lowerHalo = new THREE.Mesh(lowerHaloGeo, ribbonScreenMat);
  lowerHalo.position.set(0, -3.3, 0);
  jumbotronGroup.add(lowerHalo);

  // Lower halo metallic rims
  const lowerRimGeo = new THREE.TorusGeometry(6.02, 0.07, 8, 64);
  const topLowerRim = new THREE.Mesh(lowerRimGeo, rimMat);
  topLowerRim.rotation.x = Math.PI / 2;
  topLowerRim.position.set(0, -2.93, 0);
  jumbotronGroup.add(topLowerRim);

  const bottomLowerRim = new THREE.Mesh(lowerRimGeo, rimMat);
  bottomLowerRim.rotation.x = Math.PI / 2;
  bottomLowerRim.position.set(0, -3.67, 0);
  jumbotronGroup.add(bottomLowerRim);

  // 5. High-Tech Circular Underbelly Display (Facing down into the infield)
  const underbellyGeo = new THREE.CircleGeometry(5.95, 48);
  const underbelly = new THREE.Mesh(underbellyGeo, underbellyMat);
  underbelly.rotation.x = Math.PI / 2;
  underbelly.position.set(0, -3.7, 0);
  jumbotronGroup.add(underbelly);

  // Underbelly illuminated concentric neon ring
  const underbellyRingGeo = new THREE.TorusGeometry(5.97, 0.08, 8, 64);
  const underbellyRingMat = new THREE.MeshBasicMaterial({ color: '#06b6d4' });
  const underbellyRing = new THREE.Mesh(underbellyRingGeo, underbellyRingMat);
  underbellyRing.rotation.x = Math.PI / 2;
  underbellyRing.position.set(0, -3.71, 0);
  jumbotronGroup.add(underbellyRing);

  // High-intensity central downlight beaming into the infield
  const jumboLight = new THREE.PointLight('#38bdf8', 3.5, 35);
  jumboLight.position.set(0, -4.0, 0);
  jumbotronGroup.add(jumboLight);

  const jumboSpot = new THREE.SpotLight('#06b6d4', 4.0, 40, 0.6, 0.5);
  jumboSpot.position.set(0, -3.75, 0);
  jumboSpot.target.position.set(0, 0, 0);
  jumbotronGroup.add(jumboSpot);
  jumbotronGroup.add(jumboSpot.target);

  // 6. Heavy Industrial Suspension Rigging & Steel Hoist Cables
  const cableMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.95, roughness: 0.1 });
  const cableAnchorPoints = [
    [-6.8, 3.8, 6.8],
    [6.8, 3.8, 6.8],
    [-6.8, 3.8, -6.8],
    [6.8, 3.8, -6.8],
    [0, 3.8, 7.8],
    [0, 3.8, -7.8],
    [7.8, 3.8, 0],
    [-7.8, 3.8, 0],
  ];

  cableAnchorPoints.forEach(([ax, ay, az]) => {
    const cableGeo = new THREE.CylinderGeometry(0.045, 0.045, 4.4, 8);
    const cable = new THREE.Mesh(cableGeo, cableMat);
    cable.position.set(ax * 0.85, ay + 2.2, az * 0.85);
    jumbotronGroup.add(cable);
  });

  // Team Benches (Along the outer boundary Z = 17)
  const benchSirens = createTeamBench('#06b6d4', 'CYBER SIRENS BENCH');
  benchSirens.position.set(-12, 0, 18.5);
  scene.add(benchSirens);

  const benchValks = createTeamBench('#ec4899', 'NEON VALKYRIES BENCH');
  benchValks.position.set(12, 0, 18.5);
  scene.add(benchValks);

  // Announcers' Elevated Skybox atop the South bleachers concourse
  const skyboxGeo = new THREE.BoxGeometry(10, 4, 3.5);
  const skyboxMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.5 });
  const skybox = new THREE.Mesh(skyboxGeo, skyboxMat);
  skybox.position.set(0, 8.5, 33.2);
  scene.add(skybox);

  // Support columns down to bleachers concourse
  const pillarMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.8, roughness: 0.3 });
  const pillar1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5, 0.4), pillarMat);
  pillar1.position.set(-4.5, 5.5, 33.2);
  scene.add(pillar1);
  const pillar2 = pillar1.clone();
  pillar2.position.x = 4.5;
  scene.add(pillar2);

  // Skybox Glass Window facing arena
  const glassGeo = new THREE.PlaneGeometry(9, 2.5);
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#38bdf8',
    transparent: true,
    opacity: 0.4,
    roughness: 0.1,
  });
  const glass = new THREE.Mesh(glassGeo, glassMat);
  glass.position.set(0, 8.8, 31.42);
  glass.rotation.y = Math.PI;
  scene.add(glass);

  return touchTableData;
}

function createStarShape(outerRadius: number, innerRadius: number, points = 5): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function createFoldingChair(material: THREE.Material, hasJammerStar = false, starColor = '#fef08a') {
  const group = new THREE.Group();
  // Seat
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.5), material);
  seat.position.y = 0.45;
  seat.castShadow = true;
  seat.receiveShadow = true;
  group.add(seat);

  // Backrest
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.05), material);
  back.position.set(0, 0.72, -0.22);
  back.castShadow = true;
  group.add(back);

  // Legs (Steel)
  const legMat = new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.8 });
  const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45), legMat);
  leg1.position.set(-0.2, 0.22, 0.2);
  group.add(leg1);

  const leg2 = leg1.clone();
  leg2.position.set(0.2, 0.22, 0.2);
  group.add(leg2);

  const leg3 = leg1.clone();
  leg3.position.set(-0.2, 0.22, -0.2);
  group.add(leg3);

  const leg4 = leg1.clone();
  leg4.position.set(0.2, 0.22, -0.2);
  group.add(leg4);

  // If this is the designated Jammer seat in the Penalty Box:
  // Add a prominent golden star on the front of the backrest and on top of the seat!
  if (hasJammerStar) {
    const starShapeBack = createStarShape(0.14, 0.058, 5);
    const starExtrudeBack = new THREE.ExtrudeGeometry(starShapeBack, {
      depth: 0.016,
      bevelEnabled: false,
    });
    const starMat = new THREE.MeshStandardMaterial({
      color: starColor,
      emissive: starColor,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.2,
    });

    // Star on the front face of the backrest
    const backStar = new THREE.Mesh(starExtrudeBack, starMat);
    backStar.position.set(0, 0.72, -0.19);
    group.add(backStar);

    // Star on the top surface of the seat cushion
    const starShapeSeat = createStarShape(0.12, 0.05, 5);
    const starExtrudeSeat = new THREE.ExtrudeGeometry(starShapeSeat, {
      depth: 0.014,
      bevelEnabled: false,
    });
    const seatStar = new THREE.Mesh(starExtrudeSeat, starMat);
    seatStar.rotation.x = -Math.PI / 2;
    seatStar.position.set(0, 0.48, 0);
    group.add(seatStar);

    // Subtle neon highlight glow for the Jammer star seat
    const starGlow = new THREE.PointLight(starColor, 0.85, 2.0);
    starGlow.position.set(0, 0.45, 0);
    group.add(starGlow);
  }

  return group;
}

function createTeamBench(color: string, label: string) {
  const group = new THREE.Group();
  const benchGeo = new THREE.BoxGeometry(8, 0.5, 1.2);
  const benchMat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  const bench = new THREE.Mesh(benchGeo, benchMat);
  bench.position.y = 0.35;
  bench.castShadow = true;
  group.add(bench);

  // Water cooler
  const coolerGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.9, 12);
  const coolerMat = new THREE.MeshStandardMaterial({ color: '#f97316', roughness: 0.3 });
  const cooler = new THREE.Mesh(coolerGeo, coolerMat);
  cooler.position.set(-4.5, 0.45, 0);
  group.add(cooler);

  // Skate toolbox
  const toolboxGeo = new THREE.BoxGeometry(0.8, 0.4, 0.5);
  const toolboxMat = new THREE.MeshStandardMaterial({ color: '#ef4444', metalness: 0.7 });
  const toolbox = new THREE.Mesh(toolboxGeo, toolboxMat);
  toolbox.position.set(4.5, 0.2, 0);
  group.add(toolbox);

  return group;
}

// -------------------------------------------------------------
// Kings League Arcade Portal on North Wall
// -------------------------------------------------------------
function createKingsCrownShape(): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-1.2, -0.4);
  shape.lineTo(1.2, -0.4);
  shape.lineTo(1.2, 0.25);
  shape.lineTo(0.9, 0.0);
  shape.lineTo(0.6, 0.65);
  shape.lineTo(0.25, 0.1);
  shape.lineTo(0.0, 0.95); // Center crown spike
  shape.lineTo(-0.25, 0.1);
  shape.lineTo(-0.6, 0.65);
  shape.lineTo(-0.9, 0.0);
  shape.lineTo(-1.2, 0.25);
  shape.closePath();
  return shape;
}

function createKingsLeagueMarqueeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 340;
  const ctx = canvas.getContext('2d')!;

  // Dark brushed carbon / slate background with glowing border
  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

  // Inner subtle neon grid
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.15)';
  ctx.lineWidth = 1;
  for (let x = 20; x < canvas.width; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, 10);
    ctx.lineTo(x, canvas.height - 10);
    ctx.stroke();
  }

  // Header
  ctx.textAlign = 'center';
  ctx.font = '900 38px monospace';
  ctx.fillStyle = '#fef08a';
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 18;
  ctx.fillText('★ KINGS DERBY LEAGUE ★', canvas.width / 2, 70);

  // Main text
  ctx.font = '900 68px "Arial Black", Impact, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#06b6d4';
  ctx.shadowBlur = 24;
  ctx.fillText('SALA SECRETA ARCADE', canvas.width / 2, 160);

  // Subtitle / Kings League gimmick
  ctx.font = 'bold 36px monospace';
  ctx.fillStyle = '#f472b6';
  ctx.shadowColor = '#ec4899';
  ctx.shadowBlur = 16;
  ctx.fillText('REGRAS MALUCAS & CARTAS SECRETAS', canvas.width / 2, 235);

  // Prompt CTA
  ctx.font = '900 28px sans-serif';
  ctx.fillStyle = '#facc15';
  ctx.shadowColor = '#eab308';
  ctx.shadowBlur = 12;
  ctx.fillText('▶ PRESSIONE [E] OU CLIQUE PARA ENTRAR ◀', canvas.width / 2, 295);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function createPortalVortexTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#05070e';
  ctx.fillRect(0, 0, 512, 512);

  const cx = 256;
  const cy = 256;

  // Concentric pulsing rings of cyan, gold, and magenta
  const colors = ['#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#38bdf8', '#facc15'];
  for (let r = 240; r > 10; r -= 18) {
    ctx.strokeStyle = colors[Math.floor(r / 18) % colors.length];
    ctx.lineWidth = 7;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Spiral swirl arms
  ctx.lineWidth = 4;
  for (let arm = 0; arm < 6; arm++) {
    ctx.strokeStyle = arm % 2 === 0 ? '#facc15' : '#06b6d4';
    ctx.shadowColor = ctx.strokeStyle;
    ctx.beginPath();
    for (let theta = 0; theta < Math.PI * 3; theta += 0.1) {
      const radius = theta * 25;
      const angle = theta + (arm * Math.PI) / 3;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      if (theta === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function createKingsLeaguePortal(scene: THREE.Scene): KingsPortalData {
  const group = new THREE.Group();
  group.position.set(0, 3.6, -35.2);
  group.userData = { isKingsPortal: true };
  scene.add(group);

  // Materials
  const pillarMat = new THREE.MeshStandardMaterial({
    color: '#0f172a',
    metalness: 0.9,
    roughness: 0.25,
  });

  const goldNeonMat = new THREE.MeshStandardMaterial({
    color: '#f59e0b',
    emissive: '#f59e0b',
    emissiveIntensity: 1.8,
    roughness: 0.1,
  });

  const cyanNeonMat = new THREE.MeshStandardMaterial({
    color: '#06b6d4',
    emissive: '#06b6d4',
    emissiveIntensity: 1.6,
    roughness: 0.1,
  });

  const goldCrownMat = new THREE.MeshStandardMaterial({
    color: '#facc15',
    emissive: '#eab308',
    emissiveIntensity: 0.8,
    metalness: 0.85,
    roughness: 0.2,
  });

  // 1. Two Portal Columns (Left & Right)
  const pillarGeo = new THREE.BoxGeometry(0.55, 4.8, 0.5);
  const leftPillar = new THREE.Mesh(pillarGeo, pillarMat);
  leftPillar.position.set(-2.4, 2.4, 0);
  group.add(leftPillar);

  const rightPillar = new THREE.Mesh(pillarGeo, pillarMat);
  rightPillar.position.set(2.4, 2.4, 0);
  group.add(rightPillar);

  // Vertical Neon Tubes on pillars
  const tubeGeo = new THREE.CylinderGeometry(0.05, 0.05, 4.8, 8);
  const leftTube = new THREE.Mesh(tubeGeo, goldNeonMat);
  leftTube.position.set(-2.4, 2.4, 0.27);
  group.add(leftTube);

  const rightTube = new THREE.Mesh(tubeGeo, goldNeonMat);
  rightTube.position.set(2.4, 2.4, 0.27);
  group.add(rightTube);

  // 2. Top Arch Crossbeam
  const archGeo = new THREE.BoxGeometry(5.4, 0.6, 0.55);
  const archBeam = new THREE.Mesh(archGeo, pillarMat);
  archBeam.position.set(0, 4.8, 0);
  group.add(archBeam);

  const archNeon = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 5.4, 8), cyanNeonMat);
  archNeon.rotation.z = Math.PI / 2;
  archNeon.position.set(0, 4.8, 0.3);
  group.add(archNeon);

  // 3. Illuminated Marquee Signboard
  const marqueeTex = createKingsLeagueMarqueeTexture();
  const marqueeMat = new THREE.MeshBasicMaterial({ map: marqueeTex, side: THREE.DoubleSide });
  const marqueeGeo = new THREE.PlaneGeometry(5.2, 1.6);
  const marquee = new THREE.Mesh(marqueeGeo, marqueeMat);
  marquee.position.set(0, 5.8, 0.1);
  group.add(marquee);

  // 4. Grand 3D Golden Crown on top of arch
  const crownShape = createKingsCrownShape();
  const crownGeo = new THREE.ExtrudeGeometry(crownShape, { depth: 0.12, bevelEnabled: false });
  const crown = new THREE.Mesh(crownGeo, goldCrownMat);
  crown.position.set(0, 6.7, 0.12);
  group.add(crown);

  // Crown Jewels (cyan & pink gems on crown peaks)
  const gemMatCyan = new THREE.MeshBasicMaterial({ color: '#06b6d4' });
  const gemMatPink = new THREE.MeshBasicMaterial({ color: '#ec4899' });
  const gemGeo = new THREE.SphereGeometry(0.08, 8, 8);

  const gem1 = new THREE.Mesh(gemGeo, gemMatCyan);
  gem1.position.set(0, 7.6, 0.2);
  group.add(gem1);

  const gem2 = new THREE.Mesh(gemGeo, gemMatPink);
  gem2.position.set(-0.6, 7.3, 0.2);
  group.add(gem2);

  const gem3 = new THREE.Mesh(gemGeo, gemMatPink);
  gem3.position.set(0.6, 7.3, 0.2);
  group.add(gem3);

  // 5. Swirling Vortex Energy Doorway
  const vortexTex = createPortalVortexTexture();
  const vortexMat = new THREE.MeshBasicMaterial({
    map: vortexTex,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.95,
  });
  const vortexGeo = new THREE.PlaneGeometry(4.2, 4.2);
  const vortex = new THREE.Mesh(vortexGeo, vortexMat);
  vortex.position.set(0, 2.3, 0.05);
  group.add(vortex);

  // Doorway back dark plane
  const doorBackGeo = new THREE.PlaneGeometry(4.3, 4.6);
  const doorBackMat = new THREE.MeshStandardMaterial({ color: '#02040a', roughness: 0.9 });
  const doorBack = new THREE.Mesh(doorBackGeo, doorBackMat);
  doorBack.position.set(0, 2.3, 0.01);
  group.add(doorBack);

  // 6. Floating Holographic Die / Cube in front of portal
  const cubeGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const cubeMat = new THREE.MeshStandardMaterial({
    color: '#f59e0b',
    emissive: '#f59e0b',
    emissiveIntensity: 0.9,
    metalness: 0.8,
    roughness: 0.2,
  });
  const holoCube = new THREE.Mesh(cubeGeo, cubeMat);
  holoCube.position.set(0, 2.2, 0.9);
  group.add(holoCube);

  // Floating Kings League mini-crown above cube
  const miniCrown = new THREE.Mesh(
    new THREE.ExtrudeGeometry(createKingsCrownShape(), { depth: 0.04, bevelEnabled: false }),
    goldNeonMat
  );
  miniCrown.scale.set(0.25, 0.25, 0.25);
  miniCrown.position.set(0, 2.7, 0.9);
  group.add(miniCrown);

  // 7. Floor Runway Guide Strips (leading down the aisle)
  const runwayMat = new THREE.MeshStandardMaterial({
    color: '#f59e0b',
    emissive: '#f59e0b',
    emissiveIntensity: 1.5,
  });
  for (let z = 0.5; z <= 4.0; z += 1.0) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.12), runwayMat);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(0, 0.02, z);
    group.add(strip);
  }

  // 8. Glowing PointLight casting rich VIP golden radiance
  const light = new THREE.PointLight('#f59e0b', 3.0, 14, 1.2);
  light.position.set(0, 3.2, 1.6);
  group.add(light);

  return {
    group,
    crown,
    vortex,
    light,
    holoCube,
  };
}

function createStandsAndSpectators(
  scene: THREE.Scene,
  spectatorsRef: React.MutableRefObject<{ mesh: THREE.Mesh; initialY: number; speed: number; phase: number }[]>
) {
  const concreteMat = new THREE.MeshStandardMaterial({ color: '#151c2a', roughness: 0.8, metalness: 0.1 });
  const stepMat = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.7, metalness: 0.2 });
  const trimMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.3, metalness: 0.8 });
  const railMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.2, metalness: 0.9 });
  
  // Neon safety step nosing materials (Cyan for North under Synthetica board, Pink for South)
  const neonCyanMat = new THREE.MeshStandardMaterial({
    color: '#06b6d4',
    emissive: '#06b6d4',
    emissiveIntensity: 1.2,
    roughness: 0.2,
  });
  const neonPinkMat = new THREE.MeshStandardMaterial({
    color: '#ec4899',
    emissive: '#ec4899',
    emissiveIntensity: 1.2,
    roughness: 0.2,
  });

  const seatColors = ['#0284c7', '#ec4899', '#8b5cf6', '#10b981', '#f59e0b', '#06b6d4', '#ef4444'];
  const spectatorColors = ['#ec4899', '#06b6d4', '#8b5cf6', '#eab308', '#10b981', '#f97316', '#3b82f6', '#f43f5e', '#a855f7'];

  // Four seating section blocks across the bleachers width (leaving 3 aisles at X=0, X=-15, X=+15)
  const seatBlocks = [
    { xMin: -35.5, xMax: -16.5, xCenter: -26.0, width: 19.0 },
    { xMin: -13.5, xMax: -2.0, xCenter: -7.75, width: 11.5 },
    { xMin: 2.0, xMax: 13.5, xCenter: 7.75, width: 11.5 },
    { xMin: 16.5, xMax: 35.5, xCenter: 26.0, width: 19.0 },
  ];

  const aisleDefs = [
    { xCenter: 0, width: 3.8, isCenter: true },
    { xCenter: -15.0, width: 2.8, isCenter: false },
    { xCenter: 15.0, width: 2.8, isCenter: false },
  ];

  // Build both South (side = 1) and North (side = -1) bleachers
  [1, -1].forEach((side) => {
    const neonAisleMat = side === -1 ? neonCyanMat : neonPinkMat;

    // 1. Five Main Seating Tiers for each of the 4 seating blocks
    seatBlocks.forEach((block) => {
      for (let tier = 0; tier < 5; tier++) {
        const tierHeight = 0.60 * (tier + 1);
        const zCenter = side * (21.3 + tier * 2.2);

        // Concrete Tier Base
        const tierMesh = new THREE.Mesh(
          new THREE.BoxGeometry(block.width, tierHeight, 2.2),
          concreteMat
        );
        tierMesh.position.set(block.xCenter, tierHeight / 2, zCenter);
        tierMesh.receiveShadow = true;
        tierMesh.castShadow = true;
        scene.add(tierMesh);

        // Metallic Front Edge Trim
        const trimMesh = new THREE.Mesh(
          new THREE.BoxGeometry(block.width, 0.05, 0.08),
          trimMat
        );
        trimMesh.position.set(block.xCenter, tierHeight, side * (21.3 + tier * 2.2 - 1.05 * side));
        scene.add(trimMesh);

        // Stadium Seats & Spectators along this row
        // Leave the front 0.85m as a clear walking aisle so the player can walk along the row
        const seatZ = side * (21.3 + tier * 2.2 + 0.45 * side);
        const seatY = tierHeight;

        for (let x = block.xMin + 0.8; x <= block.xMax - 0.8; x += 1.3) {
          // Add Stadium Seat Mesh
          const seatColor = seatColors[(tier + Math.floor(Math.abs(x) * 3)) % seatColors.length];
          const seatMesh = createStadiumSeat(seatColor);
          seatMesh.position.set(x, seatY, seatZ);
          if (side === 1) {
            seatMesh.rotation.y = Math.PI; // Face north towards track
          }
          scene.add(seatMesh);

          // Spawn spectator with 65% occupancy
          if (Math.random() > 0.35) {
            const specColor = spectatorColors[Math.floor(Math.random() * spectatorColors.length)];
            const specMesh = createLowPolySpectator(specColor);
            const specY = seatY + 0.45;
            specMesh.position.set(x, specY, seatZ);
            if (side === 1) {
              specMesh.rotation.y = Math.PI; // Face towards track
            }
            scene.add(specMesh);

            spectatorsRef.current.push({
              mesh: specMesh,
              initialY: specY,
              speed: 2.2 + Math.random() * 2.5,
              phase: Math.random() * Math.PI * 2,
            });
          }
        }
      }
    });

    // 2. Top Concourse Walkway Platform (Tier 5: 3.60m elevation, spans full width)
    const concourseDepth = 2.6;
    const concourseZ = side * 33.1;
    const concourseMesh = new THREE.Mesh(
      new THREE.BoxGeometry(73.0, 3.60, concourseDepth),
      concreteMat
    );
    concourseMesh.position.set(0, 1.80, concourseZ);
    concourseMesh.receiveShadow = true;
    concourseMesh.castShadow = true;
    scene.add(concourseMesh);

    // Concourse edge trim
    const concourseTrim = new THREE.Mesh(
      new THREE.BoxGeometry(73.0, 0.05, 0.08),
      trimMat
    );
    concourseTrim.position.set(0, 3.60, side * (33.1 - (concourseDepth / 2) * side));
    scene.add(concourseTrim);

    // 3. Three Illuminated Stair Aisle Systems (11 steps each, 0.30m elevation per step)
    aisleDefs.forEach((aisle) => {
      for (let s = 0; s < 11; s++) {
        const stepElevation = 0.30 * (s + 1);
        const stepZ = side * (20.75 + s * 1.1);

        // Step tread
        const stepMesh = new THREE.Mesh(
          new THREE.BoxGeometry(aisle.width, stepElevation, 1.1),
          stepMat
        );
        stepMesh.position.set(aisle.xCenter, stepElevation / 2, stepZ);
        stepMesh.receiveShadow = true;
        scene.add(stepMesh);

        // Glowing Neon Safety Step Nosing
        const neonStrip = new THREE.Mesh(
          new THREE.BoxGeometry(aisle.width, 0.04, 0.08),
          neonAisleMat
        );
        neonStrip.position.set(aisle.xCenter, stepElevation, side * (20.75 + s * 1.1 - 0.52 * side));
        scene.add(neonStrip);
      }

      // Handrails along the aisles
      if (aisle.isCenter) {
        // Central dividing handrail for center aisle
        for (let p = 0; p < 6; p++) {
          const postZ = side * (21.0 + p * 2.2);
          const postBaseY = 0.60 * p + 0.30;
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.95, 8), railMat);
          post.position.set(0, postBaseY + 0.475, postZ);
          scene.add(post);
        }

        // Continuous sloping handrail tube
        const railLength = 13.5;
        const handrail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, railLength, 8), railMat);
        const railMidZ = side * 26.6;
        const railMidY = 2.75;
        handrail.position.set(0, railMidY, railMidZ);
        handrail.rotation.x = side * 0.28; // Slopes up the stairs
        scene.add(handrail);
      }
    });

    // 4. Back Safety Guardrail along the Top Concourse (Z = side * 34.3)
    const backRailZ = side * 34.3;
    const postCount = 18;
    for (let i = 0; i <= postCount; i++) {
      const postX = -36.0 + (i / postCount) * 72.0;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 8), railMat);
      post.position.set(postX, 3.60 + 0.55, backRailZ);
      scene.add(post);
    }
    // Top horizontal safety rail
    const topBar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 72.0, 8), railMat);
    topBar.rotation.z = Math.PI / 2;
    topBar.position.set(0, 3.60 + 1.05, backRailZ);
    scene.add(topBar);
    // Mid horizontal safety wire
    const midBar = topBar.clone();
    midBar.position.y = 3.60 + 0.55;
    scene.add(midBar);

    // Side safety guardrails (at X = -36.5 and X = 36.5)
    [-36.5, 36.5].forEach((sideX) => {
      const sideRail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 14.0), railMat);
      sideRail.position.set(sideX, 2.8, side * 27.2);
      scene.add(sideRail);
    });
  });
}

function createStadiumSeat(colorHex: string) {
  const seatGroup = new THREE.Group();
  const seatMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.4, metalness: 0.1 });
  const metalMat = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.3, metalness: 0.8 });

  // Base mounting bracket
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.25, 0.3), metalMat);
  bracket.position.set(0, 0.125, 0);
  seatGroup.add(bracket);

  // Seat bottom cushion
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.44), seatMat);
  bottom.position.set(0, 0.24, 0.05);
  seatGroup.add(bottom);

  // Seat curved backrest
  const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.06), seatMat);
  backrest.position.set(0, 0.48, -0.15);
  backrest.rotation.x = -0.08;
  seatGroup.add(backrest);

  return seatGroup;
}

function createLowPolySpectator(colorHex: string) {
  const group = new THREE.Group() as unknown as THREE.Mesh;
  const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.6 });
  const skinMat = new THREE.MeshStandardMaterial({ color: '#fed7aa', roughness: 0.5 });
  const hatMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.5 });

  // Torso / Jersey
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.55, 0.32), bodyMat);
  torso.position.y = 0.28;
  torso.castShadow = true;
  group.add(torso);

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.3), skinMat);
  head.position.y = 0.7;
  head.castShadow = true;
  group.add(head);

  // Cap / Beanie on some spectators
  if (Math.random() > 0.4) {
    const hat = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.32), hatMat);
    hat.position.y = 0.86;
    group.add(hat);
  }

  // Cheering arms
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.1), bodyMat);
  armL.position.set(0.28, 0.48, 0);
  armL.rotation.z = -0.6 - Math.random() * 0.4;
  group.add(armL);

  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.1), bodyMat);
  armR.position.set(-0.28, 0.48, 0);
  armR.rotation.z = 0.6 + Math.random() * 0.4;
  group.add(armR);

  // Foam finger or cheer pompom on some spectators
  if (Math.random() > 0.6) {
    const foamFinger = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.28, 0.05),
      new THREE.MeshStandardMaterial({ color: '#3b82f6', roughness: 0.3 })
    );
    foamFinger.position.set(-0.35, 0.72, 0);
    group.add(foamFinger);
  }

  return group;
}

function createSkaterPack(scene: THREE.Scene) {
  const skaters: {
    mesh: THREE.Group;
    progress: number;
    lane: number;
    speed: number;
    isOpponent: boolean;
    role: string;
    legL: THREE.Mesh;
    legR: THREE.Mesh;
    armL: THREE.Mesh;
    armR: THREE.Mesh;
  }[] = [];

  // Skaters configuration:
  // 1. Sirens Star Jammer (#07 Neon Fury)
  // 2. Sirens Stripe Pivot (#24 Apex Anchor)
  // 3. Sirens Blocker Wall 1 (#33 Quad Crusher)
  // 4. Sirens Blocker Wall 2 (#45 Brick House)
  // 5. Sirens Blocker Wall 3 (#88 Velocity)
  // 6. Valkyries Star Jammer (#99 Star Shatter)
  // 7. Valkyries Pivot (#12 Iron Siren)
  // 8. Valkyries Blocker 1 (#77 Slamina)
  // 9. Valkyries Blocker 2 (#50 Roller Rage)

  const skaterConfigs = [
    { role: 'jammer', team: 'sirens', color: '#06b6d4', star: true, progress: 0.14, lane: 0.3, speed: 6.5, id: 'jammer-star' },
    { role: 'pivot', team: 'sirens', color: '#06b6d4', stripe: true, progress: 0.28, lane: -0.2, speed: 4.8, id: 'pivot-stripe' },
    { role: 'blocker', team: 'sirens', color: '#06b6d4', progress: 0.24, lane: 0.0, speed: 4.8, id: 'blocker-wall' },
    { role: 'blocker', team: 'sirens', color: '#06b6d4', progress: 0.24, lane: 0.5, speed: 4.8, id: 'blocker-wall' },
    { role: 'blocker', team: 'sirens', color: '#06b6d4', progress: 0.25, lane: -0.5, speed: 4.8, id: 'blocker-wall' },
    { role: 'jammer', team: 'valkyries', color: '#ec4899', star: true, progress: 0.65, lane: -0.4, speed: 6.2, id: 'jammer-star' },
    { role: 'pivot', team: 'valkyries', color: '#ec4899', stripe: true, progress: 0.78, lane: 0.1, speed: 4.6, id: 'pivot-stripe' },
    { role: 'blocker', team: 'valkyries', color: '#ec4899', progress: 0.75, lane: -0.3, speed: 4.6, id: 'blocker-wall' },
    { role: 'blocker', team: 'valkyries', color: '#ec4899', progress: 0.75, lane: 0.3, speed: 4.6, id: 'blocker-wall' },
  ];

  skaterConfigs.forEach((cfg) => {
    const { skaterGroup, legL, legR, armL, armR } = createSkaterMesh(cfg.color, cfg.role, cfg.star, cfg.stripe);
    skaterGroup.userData = { infoPointId: cfg.id };
    scene.add(skaterGroup);

    const { pos, tangent } = getTrackPositionStatic(cfg.progress, cfg.lane);
    skaterGroup.position.set(pos.x, 0.45, pos.z);
    skaterGroup.rotation.y = Math.atan2(tangent.x, tangent.z);

    skaters.push({
      mesh: skaterGroup,
      progress: cfg.progress,
      lane: cfg.lane,
      speed: cfg.speed,
      isOpponent: cfg.team === 'valkyries',
      role: cfg.role,
      legL,
      legR,
      armL,
      armR,
    });
  });

  return skaters;
}

function createSkaterMesh(teamColor: string, role: string, hasStar?: boolean, hasStripe?: boolean) {
  const skaterGroup = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color: '#fed7aa', roughness: 0.6 });
  const jerseyMat = new THREE.MeshStandardMaterial({ color: teamColor, roughness: 0.4 });
  const padMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.5, metalness: 0.2 });
  const skatePlateMat = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.9 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: teamColor, roughness: 0.3 });

  // Athletic Derby Torso in low stance
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.35), jerseyMat);
  torso.position.y = 0.65;
  torso.rotation.x = 0.25; // Lean forward in derby stance
  torso.castShadow = true;
  skaterGroup.add(torso);

  // Head and Helmet
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.32), skinMat);
  head.position.set(0, 1.15, 0.12);
  head.castShadow = true;
  skaterGroup.add(head);

  // Helmet Base (Team color for authentic WFTDA uniform aesthetic)
  let helmetColor = teamColor;
  const helmetMat = new THREE.MeshStandardMaterial({ color: helmetColor, roughness: 0.25 });
  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.38), helmetMat);
  helmet.position.set(0, 1.28, 0.12);
  skaterGroup.add(helmet);

  // 1. STAR HELMET COVER (JAMMER) - Official WFTDA 2 Stars on side + top crown + forehead
  if (hasStar || role === 'jammer') {
    const starMat = new THREE.MeshStandardMaterial({
      color: '#fef08a',
      emissive: '#facc15',
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.15,
    });

    // Side Star Geometry (left & right sides of helmet)
    const starShapeSide = createStarShape(0.088, 0.038, 5);
    const starSideGeo = new THREE.ExtrudeGeometry(starShapeSide, { depth: 0.015, bevelEnabled: false });

    // Right Side Star
    const starR = new THREE.Mesh(starSideGeo, starMat);
    starR.position.set(0.185, 1.28, 0.12);
    starR.rotation.y = Math.PI / 2;
    skaterGroup.add(starR);

    // Left Side Star
    const starL = new THREE.Mesh(starSideGeo, starMat);
    starL.position.set(-0.185, 1.28, 0.12);
    starL.rotation.y = -Math.PI / 2;
    skaterGroup.add(starL);

    // Top Crown Star
    const starTopShape = createStarShape(0.095, 0.042, 5);
    const starTopGeo = new THREE.ExtrudeGeometry(starTopShape, { depth: 0.016, bevelEnabled: false });
    const starTop = new THREE.Mesh(starTopGeo, starMat);
    starTop.position.set(0, 1.395, 0.12);
    starTop.rotation.x = -Math.PI / 2;
    skaterGroup.add(starTop);

    // Forehead Star Emblem
    const starFrontShape = createStarShape(0.052, 0.022, 5);
    const starFrontGeo = new THREE.ExtrudeGeometry(starFrontShape, { depth: 0.012, bevelEnabled: false });
    const starFront = new THREE.Mesh(starFrontGeo, starMat);
    starFront.position.set(0, 1.30, 0.315);
    skaterGroup.add(starFront);

    // Floating 3D Star Crest directly above the Jammer's head
    const beaconStarShape = createStarShape(0.12, 0.052, 5);
    const beaconStarGeo = new THREE.ExtrudeGeometry(beaconStarShape, { depth: 0.025, bevelEnabled: false });
    const beaconStar = new THREE.Mesh(beaconStarGeo, starMat);
    beaconStar.position.set(0, 1.62, 0.12);
    skaterGroup.add(beaconStar);
  }

  // 2. STRIPE HELMET COVER (PIVOT) - Official WFTDA continuous center stripe from front to back
  if (hasStripe || role === 'pivot') {
    const stripeMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#ffffff',
      emissiveIntensity: 0.45,
      roughness: 0.2,
    });

    // Top crown longitudinal stripe (front to back)
    const topStripe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.022, 0.40), stripeMat);
    topStripe.position.set(0, 1.395, 0.12);
    skaterGroup.add(topStripe);

    // Front forehead vertical stripe
    const frontStripe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.22, 0.022), stripeMat);
    frontStripe.position.set(0, 1.28, 0.315);
    skaterGroup.add(frontStripe);

    // Back of helmet vertical stripe
    const backStripe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.22, 0.022), stripeMat);
    backStripe.position.set(0, 1.28, -0.075);
    skaterGroup.add(backStripe);

    // Thin dark side pinstripes framing the white stripe
    const pinstripeMat = new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.4 });
    const pinstripeL = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.024, 0.40), pinstripeMat);
    pinstripeL.position.set(-0.06, 1.396, 0.12);
    skaterGroup.add(pinstripeL);

    const pinstripeR = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.024, 0.40), pinstripeMat);
    pinstripeR.position.set(0.06, 1.396, 0.12);
    skaterGroup.add(pinstripeR);

    // Floating Pivot Crest Badge (Diamond with center stripe)
    const pivotBadgeMat = new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      emissive: '#0284c7',
      emissiveIntensity: 0.65,
      roughness: 0.2,
    });
    const pivotBadge = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), pivotBadgeMat);
    pivotBadge.position.set(0, 1.60, 0.12);
    pivotBadge.scale.set(0.6, 1.2, 0.6);
    skaterGroup.add(pivotBadge);
  }

  // Arms and Elbow / Wrist Guards
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), skinMat);
  armL.position.set(0.34, 0.75, 0.05);
  armL.rotation.x = -0.3;
  armL.castShadow = true;
  skaterGroup.add(armL);

  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), skinMat);
  armR.position.set(-0.34, 0.75, 0.05);
  armR.rotation.x = 0.3;
  armR.castShadow = true;
  skaterGroup.add(armR);

  // Legs with Heavy Duty Knee Pads
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18), jerseyMat);
  legL.position.set(0.18, 0.35, -0.05);
  legL.castShadow = true;
  skaterGroup.add(legL);

  // Knee pad cap
  const kneeCapL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.12), padMat);
  kneeCapL.position.set(0.18, 0.35, 0.08);
  skaterGroup.add(kneeCapL);

  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18), jerseyMat);
  legR.position.set(-0.18, 0.35, 0.05);
  legR.castShadow = true;
  skaterGroup.add(legR);

  const kneeCapR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.12), padMat);
  kneeCapR.position.set(-0.18, 0.35, 0.18);
  skaterGroup.add(kneeCapR);

  // Quad Roller Skates (Left & Right Boots + 4 wheels each)
  const skateBootL = createQuadSkate(skatePlateMat, wheelMat);
  skateBootL.position.set(0.18, 0.05, -0.05);
  skaterGroup.add(skateBootL);

  const skateBootR = createQuadSkate(skatePlateMat, wheelMat);
  skateBootR.position.set(-0.18, 0.05, 0.05);
  skaterGroup.add(skateBootR);

  return { skaterGroup, legL, legR, armL, armR };
}

function createQuadSkate(plateMat: THREE.Material, wheelMat: THREE.Material) {
  const group = new THREE.Group();

  // Derby Boot (Low cut)
  const bootMat = new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.4 });
  const boot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.38), bootMat);
  boot.position.y = 0.1;
  group.add(boot);

  // Aluminum Plate
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.36), plateMat);
  plate.position.y = 0.04;
  group.add(plate);

  // Front Toe Stop (Rubber)
  const toeStopMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.8 });
  const toeStop = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 8), toeStopMat);
  toeStop.position.set(0, 0.03, 0.18);
  toeStop.rotation.x = Math.PI / 4;
  group.add(toeStop);

  // 4 Quad Wheels (Cylinders)
  const wheelGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.05, 10);
  const wheelFL = new THREE.Mesh(wheelGeo, wheelMat);
  wheelFL.rotation.z = Math.PI / 2;
  wheelFL.position.set(0.11, 0.04, 0.1);
  group.add(wheelFL);

  const wheelFR = wheelFL.clone();
  wheelFR.position.set(-0.11, 0.04, 0.1);
  group.add(wheelFR);

  const wheelBL = wheelFL.clone();
  wheelBL.position.set(0.11, 0.04, -0.1);
  group.add(wheelBL);

  const wheelBR = wheelFL.clone();
  wheelBR.position.set(-0.11, 0.04, -0.1);
  group.add(wheelBR);

  return group;
}

function createReferees(scene: THREE.Scene) {
  const refConfigs = [
    { role: 'Jam Referee', pos: [-4, 0, 5], angle: Math.PI / 2, id: 'jam-referee', arm: 'lead' },
    { role: 'Pack Referee', pos: [12, 0, -14.5], angle: -Math.PI / 2, id: 'pack-referee', arm: 'penalty' },
    { role: 'Head Referee', pos: [0, 0, -5], angle: 0, id: 'jam-referee' },
  ];

  refConfigs.forEach((cfg) => {
    const zebraRef = createZebraRefereeMesh(cfg.arm);
    zebraRef.position.set(cfg.pos[0], 0.45, cfg.pos[2]);
    zebraRef.rotation.y = cfg.angle;
    zebraRef.userData = { infoPointId: cfg.id };
    scene.add(zebraRef);
  });
}

function createZebraRefereeMesh(armPose?: string) {
  const refGroup = new THREE.Group();

  // Zebra striped jersey material (Black & White stripes pattern)
  const zebraMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.5 });
  const blackMat = new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.5 });
  const skinMat = new THREE.MeshStandardMaterial({ color: '#fed7aa', roughness: 0.6 });

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.7, 0.32), zebraMat);
  torso.position.y = 0.7;
  torso.castShadow = true;
  refGroup.add(torso);

  // Black stripes overlay
  for (let i = -0.16; i <= 0.16; i += 0.08) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.702, 0.322), blackMat);
    stripe.position.set(i, 0.7, 0);
    refGroup.add(stripe);
  }

  // Black Referee Shorts / Pants
  const pants = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.34), blackMat);
  pants.position.y = 0.35;
  pants.castShadow = true;
  refGroup.add(pants);

  // Head and Black Cap
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.3), skinMat);
  head.position.set(0, 1.2, 0);
  head.castShadow = true;
  refGroup.add(head);

  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.15, 0.36), blackMat);
  cap.position.set(0, 1.34, 0.02);
  refGroup.add(cap);

  // Silver Whistle in mouth
  const whistleMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.9 });
  const whistle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.12), whistleMat);
  whistle.position.set(0, 1.15, 0.2);
  refGroup.add(whistle);

  // Raised Arm for Lead Jammer Signal or Penalty
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), zebraMat);
  armL.position.set(0.32, 0.85, 0);
  if (armPose === 'lead') {
    armL.rotation.z = -2.2; // Hand pointed up high!
  } else {
    armL.rotation.z = -0.2;
  }
  refGroup.add(armL);

  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), zebraMat);
  armR.position.set(-0.32, 0.85, 0);
  if (armPose === 'lead') {
    armR.rotation.x = -1.5; // Pointing forward at jammer!
  }
  refGroup.add(armR);

  return refGroup;
}

function createInfoBeacons(scene: THREE.Scene) {
  const beacons: { mesh: THREE.Group; id: string; basePos: THREE.Vector3 }[] = [];

  INFO_POINTS.forEach((pt) => {
    const beaconGroup = new THREE.Group();
    beaconGroup.position.set(pt.position3D[0], pt.position3D[1] + 1.2, pt.position3D[2]);
    beaconGroup.userData = { infoPointId: pt.id };

    // Holographic Diamond Crystal
    const crystalGeo = new THREE.OctahedronGeometry(0.38, 0);
    const crystalMat = new THREE.MeshBasicMaterial({
      color: pt.color,
      wireframe: false,
      transparent: true,
      opacity: 0.85,
    });
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.userData = { infoPointId: pt.id };
    beaconGroup.add(crystal);

    // Glowing Wireframe Outer Halo
    const wireGeo = new THREE.OctahedronGeometry(0.55, 0);
    const wireMat = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      wireframe: true,
      transparent: true,
      opacity: 0.45,
    });
    const wireHalo = new THREE.Mesh(wireGeo, wireMat);
    wireHalo.userData = { infoPointId: pt.id };
    beaconGroup.add(wireHalo);

    // Light beam down to ground
    const beamGeo = new THREE.CylinderGeometry(0.04, 0.12, pt.position3D[1] + 1.2, 8);
    const beamMat = new THREE.MeshBasicMaterial({
      color: pt.color,
      transparent: true,
      opacity: 0.25,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = -(pt.position3D[1] + 1.2) / 2;
    beaconGroup.add(beam);

    scene.add(beaconGroup);

    beacons.push({
      mesh: beaconGroup,
      id: pt.id,
      basePos: new THREE.Vector3(pt.position3D[0], pt.position3D[1] + 1.2, pt.position3D[2]),
    });
  });

  return beacons;
}

// Static math helper for initial skater placements
function getTrackPositionStatic(progress: number, laneOffset: number = 0) {
  const baseRadius = 11.5;
  const r = baseRadius + laneOffset * 1.8;
  const straightLen = 32;
  const curveLen = Math.PI * r;
  const totalLoop = 2 * straightLen + 2 * curveLen;

  const currentDist = (progress % 1) * totalLoop;

  let x = 0;
  let z = 0;
  let tangent = new THREE.Vector3();

  if (currentDist < straightLen) {
    const t = currentDist / straightLen;
    x = 16 - t * 32;
    z = r;
    tangent.set(-1, 0, 0);
  } else if (currentDist < straightLen + curveLen) {
    const t = (currentDist - straightLen) / curveLen;
    const angle = Math.PI / 2 + t * Math.PI;
    x = -16 + Math.cos(angle) * r;
    z = Math.sin(angle) * r;
    tangent.set(-Math.sin(angle), 0, Math.cos(angle));
  } else if (currentDist < 2 * straightLen + curveLen) {
    const t = (currentDist - (straightLen + curveLen)) / straightLen;
    x = -16 + t * 32;
    z = -r;
    tangent.set(1, 0, 0);
  } else {
    const t = (currentDist - (2 * straightLen + curveLen)) / curveLen;
    const angle = -Math.PI / 2 + t * Math.PI;
    x = 16 + Math.cos(angle) * r;
    z = Math.sin(angle) * r;
    tangent.set(-Math.sin(angle), 0, Math.cos(angle));
  }

  return { pos: new THREE.Vector3(x, 0, z), tangent };
}

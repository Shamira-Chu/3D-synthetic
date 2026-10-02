import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import {
  Trophy,
  Dices,
  Play,
  RotateCcw,
  Sparkles,
  Zap,
  Star,
  Flame,
  ArrowLeft,
  Volume2,
  VolumeX,
  Camera,
  Eye,
  ChevronRight,
  Shield,
  Gauge,
  Flag,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { KingsLeagueRule } from '../types';
import { KINGS_LEAGUE_RULES } from '../data/kingsLeagueRules';
import { soundManager } from '../utils/audioEngine';

interface KingsLeagueMiniGameProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BlockerSkater {
  mesh: THREE.Group;
  progress: number;
  laneOffset: number; // -0.8 (inside) to +0.8 (outside)
  speed: number;
  baseSpeed: number;
  legL: THREE.Mesh;
  legR: THREE.Mesh;
  armL: THREE.Mesh;
  armR: THREE.Mesh;
  wheels: THREE.Mesh[];
  passed: boolean;
  isHit: boolean;
  isPenalty: boolean;
  isStunned: boolean;
  stunTimer: number;
  starsGroup: THREE.Group;
}

interface TrackPowerup {
  mesh: THREE.Group;
  type: 'turbo' | 'shield' | 'star' | 'time';
  progress: number;
  laneOffset: number;
  active: boolean;
  respawnTimer: number;
}

interface TrackTransform {
  pos: THREE.Vector3;
  tangent: THREE.Vector3;
  normal: THREE.Vector3;
  isCurve: boolean;
}

// Pre-allocated vectors for GC-free math inside render loop
const vCamDesired = new THREE.Vector3();
const vCamLookTarget = new THREE.Vector3();

export function KingsLeagueMiniGame({ isOpen, onClose }: KingsLeagueMiniGameProps) {
  // Game Configuration & State
  const [selectedRule, setSelectedRule] = useState<KingsLeagueRule>(KINGS_LEAGUE_RULES[0]);
  const [isRollingRule, setIsRollingRule] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem('kings_derby_3d_highscore') || '0', 10);
    } catch {
      return 0;
    }
  });
  const [timeLeft, setTimeLeft] = useState<number>(45);
  const [isLeadJammer, setIsLeadJammer] = useState<boolean>(false);
  const [cameraMode, setCameraMode] = useState<'chase' | 'visor'>('chase');
  const [isMuted, setIsMuted] = useState<boolean>(soundManager.getMuted());
  const [showSoundConfig, setShowSoundConfig] = useState<boolean>(false);
  const [volumeLevel, setVolumeLevel] = useState<number>(Math.round(soundManager.getVolume() * 100));
  const [skateSoundEnabled, setSkateSoundEnabled] = useState<boolean>(soundManager.getSkateSoundEnabled());
  const [lastPopup, setLastPopup] = useState<{ text: string; color: string; id: number } | null>(null);
  const [combo, setCombo] = useState<number>(0);
  const [gameOverSummary, setGameOverSummary] = useState<{
    score: number;
    blockersPassed: number;
    apexJumps: number;
    blockersStunned: number;
    powerupsCollected: number;
    isNewHigh: boolean;
  } | null>(null);
  const [showCardsDrawer, setShowCardsDrawer] = useState<boolean>(false);
  const [stadiumLightBoost, setStadiumLightBoost] = useState<boolean>(true);
  const [activeKeyIndicator, setActiveKeyIndicator] = useState<'left' | 'right' | null>(null);

  // Direct DOM reference for speed display: NO React re-renders in 60fps loop!
  const speedGaugeSpanRef = useRef<HTMLSpanElement | null>(null);
  const lastDisplayedKmhRef = useRef<number>(-1);

  // Active keyboard tracking for fluid, responsive continuous steering
  const keysPressed = useRef<{ left: boolean; right: boolean; pump: boolean; brake: boolean }>({
    left: false,
    right: false,
    pump: false,
    brake: false,
  });

  // Stats in current jam
  const statsRef = useRef({
    blockersPassed: 0,
    apexJumps: 0,
    blockersStunned: 0,
    powerupsCollected: 0,
    score: 0,
    combo: 0,
    lapCount: 0,
  });

  // 3D Canvas & Engine references
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Synchronized state refs so render loop never requires tearing down the WebGL scene
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const cameraModeRef = useRef(cameraMode);
  cameraModeRef.current = cameraMode;

  const isLeadJammerRef = useRef(isLeadJammer);
  isLeadJammerRef.current = isLeadJammer;

  const selectedRuleRef = useRef(selectedRule);
  selectedRuleRef.current = selectedRule;

  const timeLeftRef = useRef(timeLeft);
  timeLeftRef.current = timeLeft;

  const stadiumLightBoostRef = useRef(stadiumLightBoost);
  stadiumLightBoostRef.current = stadiumLightBoost;

  // Dynamic follow-spotlight & player aura light references
  const playerFollowSpotRef = useRef<THREE.SpotLight | null>(null);
  const playerAuraLightRef = useRef<THREE.PointLight | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);

  // Player 3D Jammer physics state
  const playerState = useRef({
    progress: 0.05, // 0 to 1 loop around track
    laneOffset: 0.0, // -1.0 (inside line) to +1.0 (outside boundary)
    targetLane: 0.0,
    speed: 7.2, // base forward speed
    maxSpeed: 10.8,
    isPumping: false,
    isBraking: false,
    isJumping: false,
    jumpY: 0,
    jumpVelY: 0,
    stridePhase: 0,
    bankAngle: 0,
    cameraShake: 0,
    nitroActive: false,
    hasPassedInitialPack: false,
    activeRule: KINGS_LEAGUE_RULES[0],
    isGameOver: true,
    // Hip Check Stun Action
    isHipChecking: false,
    hipCheckTimer: 0,
    hipCheckCooldown: 0,
    // Active Power-ups
    shieldTimer: 0,
    turboTimer: 0,
  });

  // Skaters meshes & simulation references
  const playerMeshRef = useRef<{
    group: THREE.Group;
    torso: THREE.Mesh;
    legL: THREE.Mesh;
    legR: THREE.Mesh;
    armL: THREE.Mesh;
    armR: THREE.Mesh;
    wheels: THREE.Mesh[];
    starBeacon: THREE.Mesh;
    nitroParticles: THREE.Points;
    shieldBubble: THREE.Mesh | null;
  } | null>(null);

  const blockersRef = useRef<BlockerSkater[]>([]);
  const trackPowerupsRef = useRef<TrackPowerup[]>([]);
  const rivalJammerRef = useRef<{
    mesh: THREE.Group;
    progress: number;
    laneOffset: number;
    speed: number;
    wheels: THREE.Mesh[];
    legL: THREE.Mesh;
    legR: THREE.Mesh;
    armL: THREE.Mesh;
    armR: THREE.Mesh;
  } | null>(null);

  const goldenStarMeshRef = useRef<THREE.Group | null>(null);
  const jumbotronCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const jumbotronTexRef = useRef<THREE.CanvasTexture | null>(null);

  // Shared reusable transform object to eliminate garbage collection allocations
  const tempTransformRef = useRef<TrackTransform>({
    pos: new THREE.Vector3(),
    tangent: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    isCurve: false,
  });

  // Standard Oval Track Math Helper
  // Straight length = 28m, Turn radius = 10.5m. Centerline radius = 10.5.
  // Track lane width = 4.0m => -1.0 is inner boundary (r=8.5m), +1.0 is outer boundary (r=12.5m).
  const getTrackTransform = useCallback(
    (progress: number, laneOffset: number = 0, isReverse: boolean = false, out?: TrackTransform): TrackTransform => {
      const result = out || tempTransformRef.current;
      let p = progress % 1;
      if (p < 0) p += 1;
      if (isReverse) p = 1 - p;

      const baseRadius = 10.5;
      const laneWidth = 4.0;
      const r = baseRadius + (laneOffset * laneWidth) / 2;
      const straightLen = 28.0;
      const curveLen = Math.PI * r;
      const totalLoop = 2 * straightLen + 2 * curveLen;

      const currentDist = p * totalLoop;
      let x = 0;
      let z = 0;
      result.isCurve = false;

      // Straight 1: Bottom Straight (Z = +r, moving from X = +14 down to X = -14)
      if (currentDist < straightLen) {
        const t = currentDist / straightLen;
        x = 14.0 - t * 28.0;
        z = r;
        result.tangent.set(-1, 0, 0);
        result.normal.set(0, 0, -1);
      }
      // Turn 1: Left Curve around X = -14 (from angle +PI/2 to -PI/2)
      else if (currentDist < straightLen + curveLen) {
        result.isCurve = true;
        const t = (currentDist - straightLen) / curveLen;
        const angle = Math.PI / 2 + t * Math.PI;
        x = -14.0 + Math.cos(angle) * r;
        z = Math.sin(angle) * r;
        result.tangent.set(-Math.sin(angle), 0, Math.cos(angle));
        result.normal.set(-Math.cos(angle), 0, -Math.sin(angle));
      }
      // Straight 2: Top Straight (Z = -r, moving from X = -14 up to X = +14)
      else if (currentDist < 2 * straightLen + curveLen) {
        const t = (currentDist - (straightLen + curveLen)) / straightLen;
        x = -14.0 + t * 28.0;
        z = -r;
        result.tangent.set(1, 0, 0);
        result.normal.set(0, 0, 1);
      }
      // Turn 2: Right Curve around X = +14 (from angle -PI/2 to +PI/2)
      else {
        result.isCurve = true;
        const t = (currentDist - (2 * straightLen + curveLen)) / curveLen;
        const angle = -Math.PI / 2 + t * Math.PI;
        x = 14.0 + Math.cos(angle) * r;
        z = Math.sin(angle) * r;
        result.tangent.set(-Math.sin(angle), 0, Math.cos(angle));
        result.normal.set(-Math.cos(angle), 0, -Math.sin(angle));
      }

      if (isReverse) {
        result.tangent.negate();
      }

      result.pos.set(x, 0, z);
      return result;
    },
    []
  );

  // Roll Random Kings League Rule
  const rollRandomRule = useCallback(() => {
    if (isPlaying || isRollingRule) return;
    setIsRollingRule(true);
    soundManager.playClick(800);

    let count = 0;
    const maxCount = 18;
    const interval = setInterval(() => {
      count++;
      const randomIdx = Math.floor(Math.random() * KINGS_LEAGUE_RULES.length);
      setSelectedRule(KINGS_LEAGUE_RULES[randomIdx]);
      soundManager.playCardTick();

      if (count >= maxCount) {
        clearInterval(interval);
        const finalRule = KINGS_LEAGUE_RULES[Math.floor(Math.random() * KINGS_LEAGUE_RULES.length)];
        setSelectedRule(finalRule);
        setIsRollingRule(false);
        soundManager.playCardFanfare();
      }
    }, 80);
  }, [isPlaying, isRollingRule]);

  // Trigger Score / Event Popup
  const showEventPopup = (text: string, color: string) => {
    setLastPopup({ text, color, id: Date.now() });
  };

  // Perform Apex Jump
  const executeApexJump = useCallback(() => {
    if (!isPlayingRef.current) return;
    const pState = playerState.current;
    if (pState.isJumping) return;

    pState.isJumping = true;
    pState.jumpVelY = 7.6;
    soundManager.playApexWhoosh();
    statsRef.current.apexJumps++;

    // Extra burst speed during apex jump
    pState.speed = Math.min(pState.maxSpeed * 1.3, pState.speed + 2.0);
    showEventPopup('★ APEX JUMP!', '#ec4899');
  }, []);

  // Perform Hip Check / Blocker Stun
  const executeHipCheck = useCallback(() => {
    if (!isPlayingRef.current) return;
    const pState = playerState.current;
    if (pState.hipCheckCooldown > 0) return;

    pState.hipCheckCooldown = 2.4;
    pState.isHipChecking = true;
    pState.hipCheckTimer = 0.35;
    pState.cameraShake = 0.22;
    soundManager.playStunHit();

    let hitCount = 0;
    blockersRef.current.forEach((blocker) => {
      if (blocker.progress < 0) return;

      let progDiff = pState.progress - blocker.progress;
      if (progDiff < -0.5) progDiff += 1.0;
      if (progDiff > 0.5) progDiff -= 1.0;

      const laneDiff = Math.abs(pState.laneOffset - blocker.laneOffset);

      if (Math.abs(progDiff) < 0.045 && laneDiff < 0.75) {
        hitCount++;
        blocker.isStunned = true;
        blocker.stunTimer = 3.6;
        blocker.speed = 0.9;
        if (blocker.starsGroup) blocker.starsGroup.visible = true;

        const shoveDir = blocker.laneOffset >= pState.laneOffset ? 0.38 : -0.38;
        blocker.laneOffset = Math.max(-0.85, Math.min(0.85, blocker.laneOffset + shoveDir));

        statsRef.current.blockersStunned++;
        const pts = 15 * selectedRuleRef.current.pointMultiplier;
        statsRef.current.score += pts;
        statsRef.current.combo++;
        setScore(statsRef.current.score);
        setCombo(statsRef.current.combo);
        soundManager.playPointChime(statsRef.current.combo);
      }
    });

    if (hitCount > 0) {
      showEventPopup(`💥 HIP CHECK! ${hitCount}x ATORDOADA(S) +${hitCount * 15 * selectedRuleRef.current.pointMultiplier} PTS`, '#f59e0b');
    } else {
      showEventPopup('💨 TROMBADA NO VÁCUO!', '#64748b');
    }
  }, []);

  // Steer Jammer: dir = -1 for LEFT, dir = 1 for RIGHT
  // On this oval track with camera behind the skater, moving LEFT on screen requires +laneOffset,
  // and moving RIGHT on screen requires -laneOffset.
  const steer = useCallback((dir: number, isImmediateNudge = false) => {
    if (!isPlayingRef.current) return;
    const pState = playerState.current;
    const activeRule = selectedRuleRef.current;
    // dir = -1 (LEFT) -> +step (moves LEFT on screen)
    // dir = 1 (RIGHT) -> -step (moves RIGHT on screen)
    const screenAdjustedDir = activeRule.isReverse ? dir : -dir;
    const step = isImmediateNudge ? 0.35 : 0.45;
    pState.targetLane = Math.max(-0.95, Math.min(0.95, pState.targetLane + screenAdjustedDir * step));
    soundManager.playClick(680);
  }, []);

  // Call-Off Jam privilege when Lead Jammer
  const callOffJam = useCallback(() => {
    if (!isPlaying || !isLeadJammer) return;
    soundManager.playWhistle('calloff');
    soundManager.playCheer();
    showEventPopup('🏁 JAM ENCERRADO PELO LEAD JAMMER!', '#38bdf8');
    setTimeout(() => {
      endGame(true);
    }, 600);
  }, [isPlaying, isLeadJammer]);

  // End Game Routine
  const endGame = useCallback((isCallOff = false) => {
    setIsPlaying(false);
    playerState.current.isGameOver = true;
    keysPressed.current.left = false;
    keysPressed.current.right = false;
    keysPressed.current.pump = false;
    keysPressed.current.brake = false;
    setActiveKeyIndicator(null);
    soundManager.stopSkateLoop();

    if (!isCallOff) {
      soundManager.playBuzzer();
      soundManager.playCheer();
    }

    const finalScore = statsRef.current.score;
    let isNew = false;
    if (finalScore > highScore) {
      setHighScore(finalScore);
      try {
        localStorage.setItem('kings_derby_3d_highscore', finalScore.toString());
      } catch {
        // Ignored
      }
      isNew = true;
      try {
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.6 },
        });
      } catch {
        // Ignored
      }
    }

    setGameOverSummary({
      score: finalScore,
      blockersPassed: statsRef.current.blockersPassed,
      apexJumps: statsRef.current.apexJumps,
      blockersStunned: statsRef.current.blockersStunned,
      powerupsCollected: statsRef.current.powerupsCollected,
      isNewHigh: isNew,
    });
  }, [highScore]);

  // Start the 3D Mini-Game
  const startJam = () => {
    soundManager.playWhistle('start');
    soundManager.startSkateLoop();

    setScore(0);
    setCombo(0);
    setTimeLeft(45);
    setIsLeadJammer(false);
    setIsPlaying(true);
    setGameOverSummary(null);

    statsRef.current = {
      blockersPassed: 0,
      apexJumps: 0,
      blockersStunned: 0,
      powerupsCollected: 0,
      score: 0,
      combo: 0,
      lapCount: 0,
    };

    const baseSpeed = 7.4 * selectedRule.jammerSpeedMultiplier;
    playerState.current = {
      progress: 0.04,
      laneOffset: 0.0,
      targetLane: 0.0,
      speed: baseSpeed,
      maxSpeed: 11.5 * selectedRule.jammerSpeedMultiplier,
      isPumping: false,
      isBraking: false,
      isJumping: false,
      jumpY: 0,
      jumpVelY: 0,
      stridePhase: 0,
      bankAngle: 0,
      cameraShake: 0,
      nitroActive: selectedRule.id === 'super_nitro',
      hasPassedInitialPack: false,
      activeRule: selectedRule,
      isGameOver: false,
      isHipChecking: false,
      hipCheckTimer: 0,
      hipCheckCooldown: 0,
      shieldTimer: 0,
      turboTimer: 0,
    };

    // If instant lead jammer card
    if (selectedRule.id === 'steal_lead') {
      setTimeout(() => {
        setIsLeadJammer(true);
        soundManager.playWhistle('lead');
        showEventPopup('👑 LEAD JAMMER CONQUISTADO!', '#facc15');
      }, 1000);
    }

    // Reposition Blockers Pack ahead of Jammer (at progress 0.22 - 0.32)
    const is1v1 = selectedRule.is1v1Duel;
    const is2v2 = selectedRule.is2v2Reduced;
    const isPenalty = selectedRule.instantPenalty;

    blockersRef.current.forEach((blocker, idx) => {
      blocker.passed = false;
      blocker.isHit = false;
      blocker.isPenalty = false;
      blocker.isStunned = false;
      blocker.stunTimer = 0;
      if (blocker.starsGroup) blocker.starsGroup.visible = false;
      blocker.mesh.rotation.z = 0;

      if (is1v1) {
        blocker.mesh.visible = false;
        blocker.progress = -1;
      } else if (is2v2 && idx >= 2) {
        blocker.mesh.visible = false;
        blocker.progress = -1;
      } else if (isPenalty && idx === 0) {
        blocker.isPenalty = true;
        blocker.mesh.visible = true;
        blocker.mesh.position.set(0, 0.45, -3.2);
        blocker.progress = -1;
      } else {
        blocker.mesh.visible = true;
        const packBase = 0.24 + (idx % 3) * 0.035;
        blocker.progress = packBase;
        blocker.laneOffset = (idx % 2 === 0 ? -0.45 : 0.45) * ((idx % 3) * 0.4 + 0.5);
        blocker.speed = 4.2 + (idx % 2) * 0.6;
        blocker.baseSpeed = blocker.speed;
      }
    });

    // Reset Track Powerups
    trackPowerupsRef.current.forEach((pUp, idx) => {
      pUp.active = true;
      pUp.mesh.visible = true;
      pUp.respawnTimer = 0;
      const baseProg = [0.15, 0.42, 0.68, 0.88][idx % 4];
      pUp.progress = baseProg;
      pUp.laneOffset = idx % 2 === 0 ? -0.5 : 0.5;
    });

    // Position Rival Jammer
    if (rivalJammerRef.current) {
      if (is1v1) {
        rivalJammerRef.current.mesh.visible = true;
        rivalJammerRef.current.progress = 0.08;
        rivalJammerRef.current.laneOffset = 0.5;
        rivalJammerRef.current.speed = baseSpeed * 0.96;
      } else {
        rivalJammerRef.current.mesh.visible = true;
        rivalJammerRef.current.progress = 0.65;
        rivalJammerRef.current.laneOffset = -0.3;
        rivalJammerRef.current.speed = 5.8;
      }
    }
  };

  // Keyboard controls listener: Supports [A] for LEFT and [D] for RIGHT + Arrow keys
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      const key = e.key.toLowerCase();

      // [A] or ArrowLeft = STEER LEFT
      if (code === 'KeyA' || key === 'a' || code === 'ArrowLeft' || key === 'arrowleft') {
        if (!keysPressed.current.left) {
          keysPressed.current.left = true;
          setActiveKeyIndicator('left');
          steer(-1, true);
        }
      }
      // [D] or ArrowRight = STEER RIGHT
      else if (code === 'KeyD' || key === 'd' || code === 'ArrowRight' || key === 'arrowright') {
        if (!keysPressed.current.right) {
          keysPressed.current.right = true;
          setActiveKeyIndicator('right');
          steer(1, true);
        }
      }
      // [W] or ArrowUp or Shift = ACCELERATE / PUMP
      else if (code === 'KeyW' || key === 'w' || code === 'ArrowUp' || key === 'arrowup' || code === 'ShiftLeft' || code === 'ShiftRight') {
        keysPressed.current.pump = true;
        playerState.current.isPumping = true;
      }
      // [S] or ArrowDown = BRAKE
      else if (code === 'KeyS' || key === 's' || code === 'ArrowDown' || key === 'arrowdown') {
        keysPressed.current.brake = true;
        playerState.current.isBraking = true;
      }
      // [Spacebar] = APEX JUMP
      else if (code === 'Space' || key === ' ') {
        e.preventDefault();
        executeApexJump();
      }
      // [E] or [J] = HIP CHECK / STUN BLOCKERS
      else if (code === 'KeyE' || key === 'e' || code === 'KeyJ' || key === 'j') {
        e.preventDefault();
        executeHipCheck();
      }
      // [C] = CAMERA PERSPECTIVE
      else if (code === 'KeyC' || key === 'c') {
        setCameraMode((prev) => (prev === 'chase' ? 'visor' : 'chase'));
        soundManager.playClick(900);
      }
      // [Enter] = START JAM
      else if (code === 'Enter') {
        if (!isPlayingRef.current) startJam();
      }
      // [R] = ROLL RULE
      else if (code === 'KeyR' || key === 'r') {
        if (!isPlayingRef.current) rollRandomRule();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      const key = e.key.toLowerCase();

      if (code === 'KeyA' || key === 'a' || code === 'ArrowLeft' || key === 'arrowleft') {
        keysPressed.current.left = false;
        setActiveKeyIndicator((prev) => (prev === 'left' ? null : prev));
      } else if (code === 'KeyD' || key === 'd' || code === 'ArrowRight' || key === 'arrowright') {
        keysPressed.current.right = false;
        setActiveKeyIndicator((prev) => (prev === 'right' ? null : prev));
      } else if (code === 'KeyW' || key === 'w' || code === 'ArrowUp' || key === 'arrowup' || code === 'ShiftLeft' || code === 'ShiftRight') {
        keysPressed.current.pump = false;
        playerState.current.isPumping = false;
      } else if (code === 'KeyS' || key === 's' || code === 'ArrowDown' || key === 'arrowdown') {
        keysPressed.current.brake = false;
        playerState.current.isBraking = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isOpen, steer, executeApexJump, executeHipCheck, rollRandomRule]);

  // 1-second countdown timer
  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isPlaying, endGame]);

  // =========================================================================
  // 3D SCENE CREATION & HIGH-PERFORMANCE RENDER LOOP
  // =========================================================================
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene setup: High-energy indoor stadium environment
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color('#080e1e');
    scene.fog = new THREE.Fog('#080e1e', 45, 130);

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(70, width / height, 0.1, 180);
    cameraRef.current = camera;
    camera.position.set(0, 4, 18);

    // 3. WebGL Renderer: Highly optimized (mediump, clamp pixelRatio to 1.25)
    // Prevents mobile/retina GPU stalls and screen freezes
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      precision: 'mediump',
      stencil: false,
      depth: true,
      alpha: false,
    });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.shadowMap.enabled = false; // Disabled for maximum 60FPS fluidity
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. Bright Stadium Lighting System (Optimized light count prevents WebGL fragment freeze)
    // (a) Broad Hemisphere Light: Crisp overhead white, reflective blue ground
    const hemiLight = new THREE.HemisphereLight('#ffffff', '#334155', 2.6);
    scene.add(hemiLight);
    hemiLightRef.current = hemiLight;

    // (b) Primary Overhead Stadium Directional Floodlight
    const mainSun = new THREE.DirectionalLight('#ffffff', 3.2);
    mainSun.position.set(16, 36, 16);
    scene.add(mainSun);
    dirLightRef.current = mainSun;

    // (c) Secondary Fill Light for far bleachers and turn apexes
    const fillSun = new THREE.DirectionalLight('#bae6fd', 1.8);
    fillSun.position.set(-18, 30, -18);
    scene.add(fillSun);

    // (d) Dynamic Follow-Spotlight tracking the player Jammer & pack
    const jammerSpot = new THREE.SpotLight('#ffffff', 4.5, 36, Math.PI / 3.4, 0.4);
    jammerSpot.position.set(0, 10, 0);
    scene.add(jammerSpot);
    scene.add(jammerSpot.target);
    playerFollowSpotRef.current = jammerSpot;

    // (e) Player Jammer Golden Glow Aura Light
    const playerAura = new THREE.PointLight('#facc15', 2.0, 12);
    playerAura.position.set(0, 2.5, 0);
    scene.add(playerAura);
    playerAuraLightRef.current = playerAura;

    // (f) 4 Stadium Floodlight Towers with Visible Volumetric Beams
    buildStadiumLightTowers(scene);

    // 5. Construct Arena Stadium & Oval Track
    build3DDerbyArena(scene);

    // 6. Build Jumbotron Screen in Infield Rafters
    const jumbotron = buildJumbotron(scene);
    jumbotronCanvasRef.current = jumbotron.canvas;
    jumbotronTexRef.current = jumbotron.texture;

    // 7. Build Golden Star in Turn 2 Apex Curve (for Golden Star Card)
    const starMesh = buildGoldenStarMesh();
    starMesh.position.set(14.0, 1.8, 9.2);
    scene.add(starMesh);
    goldenStarMeshRef.current = starMesh;

    // 8. Build Player Jammer Mesh
    const playerM = buildSkaterModel('#ec4899', 'jammer', true, false, true);
    scene.add(playerM.group);
    playerMeshRef.current = playerM;

    // 9. Build Pack Blockers (5 Opponent Cyber Sirens Blockers)
    const blockers: BlockerSkater[] = [];
    const blockerColors = ['#06b6d4', '#06b6d4', '#06b6d4', '#06b6d4', '#06b6d4'];
    for (let i = 0; i < 5; i++) {
      const bModel = buildSkaterModel(blockerColors[i], i === 0 ? 'pivot' : 'blocker', false, i === 0, false);
      const starsGroup = createDizzyStarsGroup();
      bModel.group.add(starsGroup);
      scene.add(bModel.group);
      const bSpeed = 4.2 + (i % 2) * 0.6;
      blockers.push({
        mesh: bModel.group,
        progress: 0.22 + (i % 3) * 0.04,
        laneOffset: (i % 2 === 0 ? -0.4 : 0.4) * (0.4 + i * 0.15),
        speed: bSpeed,
        baseSpeed: bSpeed,
        legL: bModel.legL,
        legR: bModel.legR,
        armL: bModel.armL,
        armR: bModel.armR,
        wheels: bModel.wheels,
        passed: false,
        isHit: false,
        isPenalty: false,
        isStunned: false,
        stunTimer: 0,
        starsGroup,
      });
    }
    blockersRef.current = blockers;

    // 9b. Build Track Power-Up Pickups (Turbo, Shield, Star, Time)
    const powerups: TrackPowerup[] = [];
    const pTypes: Array<'turbo' | 'shield' | 'star' | 'time'> = ['turbo', 'shield', 'star', 'time'];
    const pProgs = [0.15, 0.42, 0.68, 0.88];
    const pLanes = [-0.5, 0.5, -0.3, 0.4];
    for (let i = 0; i < 4; i++) {
      const pMesh = buildPowerupMesh(pTypes[i]);
      scene.add(pMesh);
      powerups.push({
        mesh: pMesh,
        type: pTypes[i],
        progress: pProgs[i],
        laneOffset: pLanes[i],
        active: true,
        respawnTimer: 0,
      });
    }
    trackPowerupsRef.current = powerups;

    // 10. Build Rival Jammer Mesh (Valkyrie Star Rival)
    const rivalM = buildSkaterModel('#f43f5e', 'jammer', true, false, false);
    scene.add(rivalM.group);
    rivalJammerRef.current = {
      mesh: rivalM.group,
      progress: 0.65,
      laneOffset: -0.3,
      speed: 5.8,
      wheels: rivalM.wheels,
      legL: rivalM.legL,
      legR: rivalM.legR,
      armL: rivalM.armL,
      armR: rivalM.armR,
    };

    // 11. Resize Handler
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // -------------------------------------------------------------
    // ANIMATION & PHYSICS TICK LOOP (ZERO STATE RE-RENDERS!)
    // -------------------------------------------------------------
    let lastTime = performance.now();
    let lastJumboTime = -1;
    let lastJumboScore = -1;
    let lastJumboLead = false;
    let lastAudioUpdate = 0;

    // Local cached transform structures to avoid GC vector allocations
    const tPlayer: TrackTransform = {
      pos: new THREE.Vector3(),
      tangent: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      isCurve: false,
    };
    const tBlocker: TrackTransform = {
      pos: new THREE.Vector3(),
      tangent: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      isCurve: false,
    };
    const tRival: TrackTransform = {
      pos: new THREE.Vector3(),
      tangent: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      isCurve: false,
    };

    const animate = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.08);
      lastTime = now;

      const pState = playerState.current;
      const activeRule = selectedRuleRef.current;

      // Rotate Golden Star
      if (goldenStarMeshRef.current) {
        goldenStarMeshRef.current.rotation.y += 2.0 * dt;
        goldenStarMeshRef.current.position.y = 1.8 + Math.sin(now * 0.004) * 0.35;
      }

      // Update 3D Jumbotron screen ONLY when clock or score changes
      const curTime = timeLeftRef.current;
      const curScore = statsRef.current.score;
      const curLead = isLeadJammerRef.current;
      if (
        (curTime !== lastJumboTime || curScore !== lastJumboScore || curLead !== lastJumboLead) &&
        jumbotronCanvasRef.current &&
        jumbotronTexRef.current
      ) {
        lastJumboTime = curTime;
        lastJumboScore = curScore;
        lastJumboLead = curLead;
        updateJumbotronCanvas(
          jumbotronCanvasRef.current,
          activeRule,
          curScore,
          curTime,
          curLead,
          pState.isGameOver
        );
        jumbotronTexRef.current.needsUpdate = true;
      }

      // ---------------------------------------------------------
      // GAMEPLAY RUNNING PHYSICS
      // ---------------------------------------------------------
      if (isPlayingRef.current && !pState.isGameOver) {
        // Continuous steering when holding [A] for LEFT or [D] for RIGHT
        const steerSpeed = 2.4; // lane units per second
        const curReverse = activeRule.isReverse;
        if (keysPressed.current.left) {
          // Left moves LEFT on screen (+laneOffset)
          const d = curReverse ? -1 : 1;
          pState.targetLane = Math.max(-0.95, Math.min(0.95, pState.targetLane + d * steerSpeed * dt));
        }
        if (keysPressed.current.right) {
          // Right moves RIGHT on screen (-laneOffset)
          const d = curReverse ? 1 : -1;
          pState.targetLane = Math.max(-0.95, Math.min(0.95, pState.targetLane + d * steerSpeed * dt));
        }

        // Decay power-up & stun action timers
        if (pState.shieldTimer > 0) {
          pState.shieldTimer = Math.max(0, pState.shieldTimer - dt);
        }
        if (playerMeshRef.current?.shieldBubble) {
          const sActive = pState.shieldTimer > 0;
          playerMeshRef.current.shieldBubble.visible = sActive;
          if (sActive) {
            playerMeshRef.current.shieldBubble.rotation.y += 3.5 * dt;
            playerMeshRef.current.shieldBubble.rotation.x += 1.5 * dt;
          }
        }

        if (pState.turboTimer > 0) {
          pState.turboTimer = Math.max(0, pState.turboTimer - dt);
        }
        if (pState.hipCheckCooldown > 0) {
          pState.hipCheckCooldown = Math.max(0, pState.hipCheckCooldown - dt);
        }
        if (pState.hipCheckTimer > 0) {
          pState.hipCheckTimer = Math.max(0, pState.hipCheckTimer - dt);
        }

        // Dynamic speed adjustments
        let targetSpeed = 7.4 * activeRule.jammerSpeedMultiplier;
        if (pState.turboTimer > 0) targetSpeed = Math.max(targetSpeed, 13.5);
        else if (pState.isPumping) targetSpeed *= 1.25;
        if (pState.isBraking) targetSpeed *= 0.55;
        if (pState.nitroActive) targetSpeed *= 1.45;

        // Smooth acceleration
        pState.speed = THREE.MathUtils.lerp(pState.speed, targetSpeed, Math.min(1.0, 4.0 * dt));

        // OPTIMIZATION: Update Speed Gauge via Direct DOM Ref (0 React re-renders!)
        const kmh = Math.round(pState.speed * 3.4);
        if (speedGaugeSpanRef.current && lastDisplayedKmhRef.current !== kmh) {
          lastDisplayedKmhRef.current = kmh;
          speedGaugeSpanRef.current.textContent = `${kmh} KM/H`;
        }

        // Throttled audio pitch update (every 100ms) to prevent audio worklet stutter
        if (now - lastAudioUpdate > 100) {
          lastAudioUpdate = now;
          soundManager.updateSkateSpeed(pState.speed / 8.0);
        }

        // Smooth lane change steering
        pState.laneOffset = THREE.MathUtils.lerp(
          pState.laneOffset,
          pState.targetLane,
          Math.min(1.0, 9.0 * dt)
        );

        // Calculate progress around the loop
        const loopLength = 120.0;
        const progressDelta = (pState.speed / loopLength) * dt;
        pState.progress = (pState.progress + progressDelta) % 1.0;

        // Jump physics
        if (pState.isJumping) {
          pState.jumpY += pState.jumpVelY * dt;
          pState.jumpVelY -= 19.0 * dt; // Gravity

          if (pState.jumpY <= 0) {
            pState.jumpY = 0;
            pState.isJumping = false;
            pState.jumpVelY = 0;
            soundManager.playSkateSlide();
          }
        }

        // Check Apex Golden Star collision
        if (goldenStarMeshRef.current && activeRule.id === 'golden_star') {
          const starPos = goldenStarMeshRef.current.position;
          getTrackTransform(pState.progress, pState.laneOffset, activeRule.isReverse, tPlayer);
          if (tPlayer.pos.distanceTo(starPos) < 2.4 && pState.isJumping) {
            statsRef.current.score += 5;
            setScore(statsRef.current.score);
            soundManager.playCardFanfare();
            showEventPopup('★ GOLDEN STAR +5 BÔNUS!', '#f59e0b');
            goldenStarMeshRef.current.position.y = -10;
            setTimeout(() => {
              if (goldenStarMeshRef.current) goldenStarMeshRef.current.position.y = 1.8;
            }, 5000);
          }
        }

        // Update Track Power-ups
        trackPowerupsRef.current.forEach((pUp, pIdx) => {
          if (pUp.active) {
            pUp.mesh.rotation.y += 2.8 * dt;
            pUp.mesh.rotation.z = Math.sin(now * 0.003 + pIdx) * 0.2;

            getTrackTransform(pUp.progress, pUp.laneOffset, activeRule.isReverse, tBlocker);
            pUp.mesh.position.set(
              tBlocker.pos.x,
              0.85 + Math.sin(now * 0.004 + pIdx) * 0.18,
              tBlocker.pos.z
            );

            // Collision check with Jammer
            let progDiff = pState.progress - pUp.progress;
            if (progDiff < -0.5) progDiff += 1.0;
            if (progDiff > 0.5) progDiff -= 1.0;
            const laneDiff = Math.abs(pState.laneOffset - pUp.laneOffset);

            if (Math.abs(progDiff) < 0.026 && laneDiff < 0.44) {
              pUp.active = false;
              pUp.mesh.visible = false;
              pUp.respawnTimer = 11.0;
              statsRef.current.powerupsCollected++;
              soundManager.playPowerupPickup();

              if (pUp.type === 'turbo') {
                pState.turboTimer = 4.5;
                pState.speed = Math.min(pState.maxSpeed * 1.45, 14.2);
                soundManager.playNitro();
                showEventPopup('⚡ SUPER TURBO COLETADO! 14 KM/H', '#06b6d4');
              } else if (pUp.type === 'shield') {
                pState.shieldTimer = 5.5;
                showEventPopup('🛡️ ESCUDO IMPENETRÁVEL (5s)!', '#ec4899');
              } else if (pUp.type === 'star') {
                const pts = 25 * activeRule.pointMultiplier;
                statsRef.current.score += pts;
                statsRef.current.combo += 2;
                setScore(statsRef.current.score);
                setCombo(statsRef.current.combo);
                soundManager.playCardFanfare();
                showEventPopup(`⭐ SUPER ESTRELA! +${pts} PTS`, '#fbbf24');
              } else if (pUp.type === 'time') {
                setTimeLeft((prev) => Math.min(60, prev + 5));
                soundManager.playWhistle('start');
                showEventPopup('⏱️ +5 SEGUNDOS DE JAM!', '#10b981');
              }
            }
          } else {
            pUp.respawnTimer -= dt;
            if (pUp.respawnTimer <= 0) {
              pUp.active = true;
              pUp.mesh.visible = true;
              pUp.laneOffset = (Math.random() - 0.5) * 1.3;
            }
          }
        });

        // Update Blockers & Collisions
        let currentPassedCount = 0;
        blockersRef.current.forEach((blocker, bIdx) => {
          if (blocker.progress < 0) return; // Inactive or penalty

          // Advance blocker along track
          const blockerDelta = (blocker.speed / loopLength) * dt;
          blocker.progress = (blocker.progress + blockerDelta) % 1.0;

          // Blockers subtly weave to block lanes (if not stunned)
          if (!blocker.isStunned) {
            blocker.laneOffset += Math.sin(now * 0.002 + bIdx) * 0.25 * dt;
            blocker.laneOffset = Math.max(-0.8, Math.min(0.8, blocker.laneOffset));
          }

          // Position blocker mesh
          getTrackTransform(blocker.progress, blocker.laneOffset, activeRule.isReverse, tBlocker);
          blocker.mesh.position.set(tBlocker.pos.x, 0.45, tBlocker.pos.z);
          blocker.mesh.rotation.y = Math.atan2(tBlocker.tangent.x, tBlocker.tangent.z);

          // Handle Blocker Stun State & Dizzy stars
          if (blocker.isStunned) {
            blocker.stunTimer -= dt;
            blocker.speed = 1.0;
            if (blocker.starsGroup) {
              blocker.starsGroup.visible = true;
              blocker.starsGroup.rotation.y += 8.0 * dt;
            }
            blocker.mesh.rotation.z = Math.sin(now * 0.02) * 0.28;
            if (blocker.stunTimer <= 0) {
              blocker.isStunned = false;
              blocker.speed = blocker.baseSpeed;
              if (blocker.starsGroup) blocker.starsGroup.visible = false;
              blocker.mesh.rotation.z = 0;
            }
          } else {
            if (blocker.starsGroup) blocker.starsGroup.visible = false;
          }

          // Animate blocker skate strides
          const bStride = Math.sin(now * 0.008 * blocker.speed + bIdx);
          blocker.legL.rotation.x = bStride * 0.4;
          blocker.legR.rotation.x = -bStride * 0.4;
          blocker.armL.rotation.x = -bStride * 0.35;
          blocker.armR.rotation.x = bStride * 0.35;
          blocker.wheels.forEach((w) => (w.rotation.x += blocker.speed * 2.0 * dt));

          // Collision detection between Player Jammer and Blocker
          let progDiff = pState.progress - blocker.progress;
          if (progDiff < -0.5) progDiff += 1.0;
          if (progDiff > 0.5) progDiff -= 1.0;

          const laneDiff = Math.abs(pState.laneOffset - blocker.laneOffset);

          // In passing zone (-0.024 to +0.024 progress ~ 3.5m)
          if (Math.abs(progDiff) < 0.024 && laneDiff < 0.38) {
            if (pState.shieldTimer > 0) {
              // Shield active: knock blocker down / deflect
              if (!blocker.isStunned) {
                blocker.isStunned = true;
                blocker.stunTimer = 4.0;
                blocker.speed = 0.9;
                if (blocker.starsGroup) blocker.starsGroup.visible = true;
                const shoveDir = blocker.laneOffset >= pState.laneOffset ? 0.38 : -0.38;
                blocker.laneOffset = Math.max(-0.85, Math.min(0.85, blocker.laneOffset + shoveDir));
                statsRef.current.blockersStunned++;
                const pts = 20 * activeRule.pointMultiplier;
                statsRef.current.score += pts;
                setScore(statsRef.current.score);
                soundManager.playStunHit();
                showEventPopup(`🛡️ ESCUDO DESTRUIDOR! +${pts} PTS`, '#06b6d4');
              }
            } else if (pState.isJumping) {
              if (!blocker.passed) {
                blocker.passed = true;
                const pts = 2 * activeRule.pointMultiplier;
                statsRef.current.score += pts;
                statsRef.current.blockersPassed++;
                statsRef.current.combo++;
                setScore(statsRef.current.score);
                setCombo(statsRef.current.combo);
                soundManager.playPointChime(statsRef.current.combo);
                showEventPopup(`+${pts} APEX LEAP OVER!`, '#a855f7');
              }
            } else if (!blocker.isHit && !blocker.isStunned) {
              blocker.isHit = true;
              pState.cameraShake = 0.35;
              pState.speed = Math.max(3.5, pState.speed - 3.2);
              soundManager.playImpact();
              statsRef.current.combo = 0;
              setCombo(0);
              showEventPopup('💥 IMPACTO! -BLOQUEIO', '#ef4444');

              setTimeout(() => {
                blocker.isHit = false;
              }, 1200);
            }
          }

          // Check if cleanly passed blocker from behind
          if (progDiff > 0.025 && progDiff < 0.15 && !blocker.passed) {
            blocker.passed = true;
            const pts = 1 * activeRule.pointMultiplier;
            statsRef.current.score += pts;
            statsRef.current.blockersPassed++;
            statsRef.current.combo++;
            setScore(statsRef.current.score);
            setCombo(statsRef.current.combo);
            soundManager.playPointChime(statsRef.current.combo);
            showEventPopup(`+${pts} ULTRAPASSAGEM!`, '#38bdf8');
          }

          if (blocker.passed) currentPassedCount++;
        });

        // Check Lead Jammer breakout status
        if (!isLeadJammerRef.current && currentPassedCount >= Math.min(3, blockersRef.current.length)) {
          setIsLeadJammer(true);
          soundManager.playWhistle('lead');
          soundManager.playCheer();
          showEventPopup('👑 LEAD JAMMER DECLARADA!', '#facc15');
        }

        // Update Rival Jammer
        if (rivalJammerRef.current && rivalJammerRef.current.mesh.visible) {
          const rival = rivalJammerRef.current;
          const rivalDelta = (rival.speed / loopLength) * dt;
          rival.progress = (rival.progress + rivalDelta) % 1.0;
          getTrackTransform(rival.progress, rival.laneOffset, activeRule.isReverse, tRival);
          rival.mesh.position.set(tRival.pos.x, 0.45, tRival.pos.z);
          rival.mesh.rotation.y = Math.atan2(tRival.tangent.x, tRival.tangent.z);

          const rStride = Math.sin(now * 0.008 * rival.speed);
          rival.legL.rotation.x = rStride * 0.4;
          rival.legR.rotation.x = -rStride * 0.4;
          rival.armL.rotation.x = -rStride * 0.35;
          rival.armR.rotation.x = rStride * 0.35;
          rival.wheels.forEach((w) => (w.rotation.x += rival.speed * 2.0 * dt));
        }

        // Stride phase for player jammer
        pState.stridePhase += pState.speed * 3.5 * dt;
      }

      // ---------------------------------------------------------
      // PLAYER MESH ORIENTATION & DYNAMICS
      // ---------------------------------------------------------
      if (playerMeshRef.current) {
        getTrackTransform(pState.progress, pState.laneOffset, activeRule.isReverse, tPlayer);

        // Position player at ground level + jump height
        playerMeshRef.current.group.position.set(tPlayer.pos.x, 0.45 + pState.jumpY, tPlayer.pos.z);

        // Update Dynamic Follow-Spotlight tracking player Jammer & pack
        if (playerFollowSpotRef.current) {
          playerFollowSpotRef.current.position.set(
            tPlayer.pos.x - tPlayer.tangent.x * 3.5,
            tPlayer.pos.y + 9.5,
            tPlayer.pos.z - tPlayer.tangent.z * 3.5
          );
          playerFollowSpotRef.current.target.position.set(
            tPlayer.pos.x + tPlayer.tangent.x * 2.5,
            0.4,
            tPlayer.pos.z + tPlayer.tangent.z * 2.5
          );
          playerFollowSpotRef.current.target.updateMatrixWorld();
        }

        // Update Player Jammer Aura Light
        if (playerAuraLightRef.current) {
          playerAuraLightRef.current.position.set(tPlayer.pos.x, 2.0 + pState.jumpY, tPlayer.pos.z);
        }

        // Base forward orientation
        const targetRotY = Math.atan2(tPlayer.tangent.x, tPlayer.tangent.z);
        playerMeshRef.current.group.rotation.y = targetRotY;

        // Centrifugal banking / leaning into track corners
        const bankTarget = tPlayer.isCurve ? -0.28 * (activeRule.isReverse ? -1 : 1) : 0;
        pState.bankAngle = THREE.MathUtils.lerp(pState.bankAngle, bankTarget, Math.min(1.0, 5.0 * dt));
        playerMeshRef.current.group.rotation.z = pState.bankAngle;

        // Animate skate strides and arm sways
        const stride = Math.sin(pState.stridePhase);
        playerMeshRef.current.legL.rotation.x = stride * 0.55;
        playerMeshRef.current.legR.rotation.x = -stride * 0.55;
        playerMeshRef.current.armL.rotation.x = -stride * 0.45;
        playerMeshRef.current.armR.rotation.x = stride * 0.45;

        // Rotate wheels
        playerMeshRef.current.wheels.forEach((w) => {
          w.rotation.x += pState.speed * 2.5 * dt;
        });

        // Rotate Star Crest above Jammer helmet
        playerMeshRef.current.starBeacon.rotation.y += 3.0 * dt;
        playerMeshRef.current.starBeacon.visible = isLeadJammerRef.current || activeRule.id === 'double_points';

        // Nitro rocket particle thrusters
        if (playerMeshRef.current.nitroParticles) {
          playerMeshRef.current.nitroParticles.visible = activeRule.id === 'super_nitro' || pState.isPumping;
        }

        // Camera positioning (Optimized vector math with zero new object allocations)
        if (cameraRef.current) {
          const cam = cameraRef.current;

          pState.cameraShake = Math.max(0, pState.cameraShake - 1.2 * dt);
          const shakeX = (Math.random() - 0.5) * pState.cameraShake;
          const shakeY = (Math.random() - 0.5) * pState.cameraShake;

          if (cameraModeRef.current === 'chase') {
            const camOffsetDist = pState.nitroActive ? 5.2 : 4.4;
            const camHeight = 2.1;

            vCamDesired
              .copy(tPlayer.pos)
              .addScaledVector(tPlayer.tangent, -camOffsetDist)
              .addScaledVector(tPlayer.normal, -pState.bankAngle * 1.5);
            vCamDesired.x += shakeX;
            vCamDesired.y += camHeight + pState.jumpY * 0.4 + shakeY;

            cam.position.lerp(vCamDesired, Math.min(1.0, 14.0 * dt));

            vCamLookTarget
              .copy(tPlayer.pos)
              .addScaledVector(tPlayer.tangent, 5.5);
            vCamLookTarget.y += 1.2;
            cam.lookAt(vCamLookTarget);
          } else {
            // First-Person Helmet Visor Cam ("Visor Mode")
            const headY = 1.35 + pState.jumpY;
            cam.position.set(tPlayer.pos.x + shakeX, headY + shakeY, tPlayer.pos.z);

            vCamLookTarget
              .copy(tPlayer.pos)
              .addScaledVector(tPlayer.tangent, 10.0);
            vCamLookTarget.y += 1.1;
            cam.lookAt(vCamLookTarget);
          }
        }
      }

      // Render Three.js Scene
      renderer.render(scene, camera);
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      soundManager.stopSkateLoop();
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, [isOpen, getTrackTransform]);

  if (!isOpen) return null;

  return (
    <div
      id="kings-league-3d-root"
      className="fixed inset-0 z-50 flex flex-col bg-black select-none overflow-hidden font-sans"
    >
      {/* Top Professional Broadcast Scoreboard HUD Bar */}
      <header className="relative z-30 flex items-center justify-between px-3 sm:px-6 py-2.5 bg-gradient-to-r from-slate-950/95 via-slate-900/90 to-slate-950/95 border-b border-amber-500/40 backdrop-blur-md shadow-2xl">
        {/* Left: Tempo de Jam & Pontuação */}
        <div className="flex items-center gap-3 sm:gap-6">
          {/* Tempo de Jam */}
          <div className="flex flex-col items-start sm:items-center">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">
              TEMPO DE JAM
            </span>
            <div
              className={`px-3.5 py-0.5 rounded-lg border font-mono font-black text-base sm:text-lg ${
                timeLeft <= 10
                  ? 'border-red-500 bg-red-950/60 text-red-400 animate-pulse'
                  : 'border-slate-700 bg-black/60 text-amber-400'
              }`}
            >
              ⏱ 0:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}
            </div>
          </div>

          {/* Pontuação */}
          <div className="flex flex-col items-start sm:items-center">
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">
              PONTUAÇÃO
            </span>
            <div className="px-4 py-0.5 rounded-lg border border-amber-500/50 bg-amber-500/20 font-black text-amber-300 text-base sm:text-lg flex items-center gap-1 shadow-lg shadow-amber-500/20">
              <Star className="w-4 h-4 fill-amber-300 text-amber-300" />
              <span>{score} PTS</span>
            </div>
          </div>

          {/* Combo Multiplier (Active only when combo > 1) */}
          {combo > 1 && (
            <div className="hidden md:flex flex-col items-center animate-bounce">
              <span className="text-[9px] font-mono uppercase tracking-widest text-pink-400 font-bold">
                COMBO ATIVO
              </span>
              <div className="px-2.5 py-0.5 rounded-lg border border-pink-500/60 bg-pink-500/20 font-black text-pink-300 text-xs">
                🔥 {combo}X
              </div>
            </div>
          )}
        </div>

        {/* Right: Sound Configuration & Voltar à Arena */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Sound Configuration Button */}
          <button
            onClick={() => setShowSoundConfig(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700 hover:border-amber-400 text-slate-300 hover:text-white text-xs sm:text-sm font-bold transition-all shadow-md active:scale-95"
            title="Configurações de Som"
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-red-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-amber-400" />
            )}
            <span>Som</span>
          </button>

          {/* Return to Main Arena */}
          <button
            onClick={() => {
              soundManager.stopSkateLoop();
              soundManager.playTeleport();
              onClose();
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar à Arena</span>
          </button>
        </div>
      </header>

      {/* Main 3D Interactive Viewport */}
      <div className="relative flex-1 w-full h-full overflow-hidden bg-black">
        {/* Three.js Canvas Container */}
        <div ref={containerRef} className="absolute inset-0 w-full h-full block" />

        {/* 1st-Person Helmet Visor Frame Overlay (When in 'visor' mode) */}
        {cameraMode === 'visor' && (
          <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between">
            {/* Top Helmet Visor Rim */}
            <div className="h-16 w-full bg-gradient-to-b from-black via-slate-950/80 to-transparent flex items-start justify-center pt-2">
              <div className="flex items-center gap-3 px-4 py-1 rounded-full bg-black/60 border border-cyan-500/30 text-[11px] font-mono text-cyan-300 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span>HUD DE VISEIRA DA JAMMER • SYNTHETICA OPTICS</span>
              </div>
            </div>

            {/* Subtle Peripheral Helmet Vignette */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_65%,rgba(0,0,0,0.75)_100%)] pointer-events-none" />

            {/* Visor Speed & G-Force Reticle */}
            <div className="absolute bottom-24 left-6 flex flex-col gap-1 text-cyan-400 font-mono text-xs drop-shadow-md">
              <div className="flex items-center gap-1.5 font-black text-lg text-white">
                <Gauge className="w-5 h-5 text-cyan-400" />
                <span ref={speedGaugeSpanRef}>25 KM/H</span>
              </div>
              <div className="text-[10px] text-slate-400 uppercase">
                VELOCIDADE DOS PATINS • TRACK GRIP 98%
              </div>
            </div>
          </div>
        )}

        {/* In-Game 3D Track HUD Floating Info Elements */}
        {isPlaying && (
          <div className="absolute top-4 left-4 z-20 pointer-events-none flex flex-col gap-2">
            {/* Lead Jammer Badge Status (Clickable to Call Off Jam) */}
            {isLeadJammer && (
              <button
                onClick={callOffJam}
                className="pointer-events-auto flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-500/25 hover:bg-amber-500/40 active:scale-95 backdrop-blur-md border-2 border-amber-400 text-amber-300 font-black text-xs uppercase tracking-wider shadow-[0_0_25px_rgba(245,158,11,0.5)] animate-pulse transition-all cursor-pointer"
                title="Clique para encerrar o Jam (Call-Off)"
              >
                <Star className="w-4 h-4 fill-amber-300" />
                <span>👑 LEAD JAMMER ATIVA • ENCERRAR JAM (CALL-OFF)</span>
              </button>
            )}

            {/* Active Card description pill */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-slate-700 text-[11px] font-mono text-slate-300">
              <span className="font-bold" style={{ color: selectedRule.color }}>
                {selectedRule.name}:
              </span>
              <span>{selectedRule.tagline}</span>
            </div>

            {/* In-Game Commands Banner ([A] Left, [D] Right, [Space] Jump, [E] Stun) */}
            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-300 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg border border-slate-800 w-fit">
              <span className={`px-1.5 py-0.5 rounded font-black border ${activeKeyIndicator === 'left' ? 'bg-cyan-500 text-black border-cyan-400' : 'bg-slate-800 text-cyan-300 border-slate-700'}`}>
                A
              </span>
              <span>ESQUERDA</span>
              <span className="text-slate-600">|</span>
              <span className={`px-1.5 py-0.5 rounded font-black border ${activeKeyIndicator === 'right' ? 'bg-pink-500 text-black border-pink-400' : 'bg-slate-800 text-pink-300 border-slate-700'}`}>
                D
              </span>
              <span>DIREITA</span>
              <span className="text-slate-600">|</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 font-black text-amber-300 border border-slate-700">
                ESPAÇO
              </span>
              <span>JUMP</span>
              <span className="text-slate-600">|</span>
              <button
                onClick={executeHipCheck}
                className="pointer-events-auto px-1.5 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-black border border-amber-300 shadow cursor-pointer active:scale-95 transition-all"
                title="Trombada de Quadril / Atordoar Bloqueadoras Próximas"
              >
                E
              </button>
              <span className="text-amber-300 font-bold">TROMBADA</span>
            </div>
          </div>
        )}

        {/* Dynamic Combo & Scoring Popups */}
        {lastPopup && (
          <div
            key={lastPopup.id}
            className="absolute top-1/4 inset-x-0 z-30 flex justify-center pointer-events-none animate-bounce"
          >
            <span
              className="px-5 py-2 rounded-2xl text-lg sm:text-2xl font-black tracking-wide shadow-[0_0_30px_rgba(0,0,0,0.8)] bg-black/90 backdrop-blur-md border-2"
              style={{ borderColor: lastPopup.color, color: lastPopup.color }}
            >
              {lastPopup.text}
            </span>
          </div>
        )}

        {/* Pre-Game & Game-Over Overlay Screen */}
        {!isPlaying && (
          <div className="absolute inset-0 z-40 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center">
            {gameOverSummary ? (
              /* Game Over Summary Screen */
              <div className="w-full max-w-md bg-slate-900/90 border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(245,158,11,0.3)] animate-fadeIn">
                <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-400 shadow-xl">
                  <Trophy className="w-9 h-9" />
                </div>
                <div className="text-xs uppercase tracking-widest text-slate-400 font-mono">
                  RESULTADO OFICIAL DO JAM 3D
                </div>
                <div className="text-5xl font-black text-amber-300 mt-2 tracking-tight">
                  {gameOverSummary.score} PTS
                </div>

                {gameOverSummary.isNewHigh && (
                  <div className="mt-3 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-400 text-amber-300 font-black text-xs uppercase animate-pulse inline-block">
                    🏆 NOVO RECORDE DA SALA!
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-4">
                  <div className="p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
                    <div className="text-xl font-black text-cyan-400">{gameOverSummary.blockersPassed}</div>
                    <div className="text-[9px] font-mono text-slate-400 uppercase mt-0.5">
                      Passagens
                    </div>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
                    <div className="text-xl font-black text-pink-400">{gameOverSummary.apexJumps}</div>
                    <div className="text-[9px] font-mono text-slate-400 uppercase mt-0.5">
                      Apex Jumps
                    </div>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
                    <div className="text-xl font-black text-amber-400">{gameOverSummary.blockersStunned}</div>
                    <div className="text-[9px] font-mono text-slate-400 uppercase mt-0.5">
                      Trombadas
                    </div>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-center">
                    <div className="text-xl font-black text-emerald-400">{gameOverSummary.powerupsCollected}</div>
                    <div className="text-[9px] font-mono text-slate-400 uppercase mt-0.5">
                      Power-Ups
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={startJam}
                    className="flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-base shadow-[0_0_30px_rgba(245,158,11,0.5)] transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-5 h-5 fill-slate-950" />
                    <span>JOGAR NOVAMENTE</span>
                  </button>
                  <button
                    onClick={rollRandomRule}
                    disabled={isRollingRule}
                    className="py-3.5 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-600 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Dices className="w-4 h-4 text-amber-400" />
                    <span>TROCAR CARTA</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Pre-Game Briefing Screen */
              <div className="w-full max-w-md bg-slate-900/95 border-2 border-amber-500/50 rounded-3xl p-5 sm:p-6 shadow-[0_0_60px_rgba(245,158,11,0.3)] animate-fadeIn">
                <div className="w-12 h-12 mx-auto mb-2 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/40">
                  <Flame className="w-7 h-7 fill-slate-950" />
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                  ROLLER DERBY 3D ARCADE
                </h2>
                <p className="text-xs text-slate-300 mt-1 max-w-sm mx-auto">
                  Ultrapasse as bloqueadoras adversárias, atordoe com trombadas e colete power-ups na pista!
                </p>

                {/* Minimized Compact Commands Bar */}
                <div className="my-3 py-2 px-3 rounded-xl bg-black/60 border border-slate-800 flex items-center justify-center flex-wrap gap-x-3.5 gap-y-1.5 text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded bg-cyan-500 text-slate-950 font-black text-[11px] flex items-center justify-center shadow-sm">
                      A
                    </span>
                    <span className="text-slate-300 font-bold text-[11px]">Esquerda</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded bg-pink-500 text-slate-950 font-black text-[11px] flex items-center justify-center shadow-sm">
                      D
                    </span>
                    <span className="text-slate-300 font-bold text-[11px]">Direita</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 h-5 rounded bg-amber-400 text-slate-950 font-black text-[10px] flex items-center justify-center shadow-sm">
                      Espaço
                    </span>
                    <span className="text-slate-300 font-bold text-[11px]">Apex Jump</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded bg-amber-500 text-slate-950 font-black text-[11px] flex items-center justify-center shadow-sm">
                      E
                    </span>
                    <span className="text-amber-300 font-bold text-[11px]">Trombada (Stun)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded bg-indigo-500 text-white font-black text-[11px] flex items-center justify-center shadow-sm">
                      W
                    </span>
                    <span className="text-slate-300 font-bold text-[11px]">Turbo</span>
                  </div>
                </div>

                {/* Active Card Showcase Box */}
                <div
                  className="my-3 p-3.5 rounded-2xl border-2 text-left bg-slate-950/80 shadow-lg relative overflow-hidden"
                  style={{ borderColor: selectedRule.color }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider"
                      style={{ backgroundColor: `${selectedRule.color}33`, color: selectedRule.color }}
                    >
                      {selectedRule.badge}
                    </span>
                    <button
                      onClick={rollRandomRule}
                      disabled={isRollingRule}
                      className="flex items-center gap-1.5 text-xs font-mono font-bold text-amber-400 hover:text-amber-300 bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-500/40 transition-all active:scale-95"
                    >
                      <Dices className={`w-3.5 h-3.5 ${isRollingRule ? 'animate-spin' : ''}`} />
                      <span>{isRollingRule ? 'Sorteando...' : 'Sortear Outra'}</span>
                    </button>
                  </div>
                  <div className="text-base font-black text-white mt-1.5">{selectedRule.name}</div>
                  <p className="text-xs text-slate-300 mt-0.5 leading-relaxed line-clamp-2">
                    {selectedRule.description}
                  </p>
                </div>

                {/* Primary CTA */}
                <button
                  id="kings-3d-start-btn"
                  onClick={startJam}
                  className="w-full py-4 px-8 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-lg shadow-[0_0_35px_rgba(245,158,11,0.5)] transition-all active:scale-95 flex items-center justify-center gap-2 mt-2"
                >
                  <Play className="w-6 h-6 fill-slate-950" />
                  <span>INICIAR JAM 3D (45 SEGUNDOS)</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cards Drawer (Allows user to inspect or choose all Kings League cards) */}
      {showCardsDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fadeIn">
          <div className="w-full max-w-2xl bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Dices className="w-6 h-6 text-amber-400" />
                <h3 className="text-xl font-black text-white">CARTAS SECRETAS DA KINGS LEAGUE</h3>
              </div>
              <button
                onClick={() => setShowCardsDrawer(false)}
                className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                Fechar
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {KINGS_LEAGUE_RULES.map((rule) => {
                const isSelected = selectedRule.id === rule.id;
                return (
                  <button
                    key={rule.id}
                    onClick={() => {
                      if (isPlaying) return;
                      setSelectedRule(rule);
                      soundManager.playClick(650);
                      setShowCardsDrawer(false);
                    }}
                    className={`text-left p-3.5 rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-400 text-white shadow-lg'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-950'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black" style={{ color: rule.color }}>
                        {rule.badge}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {rule.pointMultiplier}x Pts
                      </span>
                    </div>
                    <div className="text-sm font-black text-white mt-1">{rule.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                      {rule.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {/* Sound Configuration Modal */}
      {showSoundConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="w-full max-w-sm bg-slate-900 border-2 border-amber-500/60 rounded-3xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-black text-lg">
                <Volume2 className="w-5 h-5 text-amber-400" />
                <span>CONFIGURAÇÃO DE SOM</span>
              </div>
              <button
                onClick={() => setShowSoundConfig(false)}
                className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
              >
                Fechar
              </button>
            </div>

            {/* Mute Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div>
                <div className="text-sm font-bold text-white">Silenciar Tudo</div>
                <div className="text-[11px] text-slate-400">Desativa todos os efeitos e apitos</div>
              </div>
              <button
                onClick={() => {
                  const muted = soundManager.toggleMute();
                  setIsMuted(muted);
                }}
                className={`px-3.5 py-1.5 rounded-xl font-black text-xs transition-all ${
                  isMuted
                    ? 'bg-rose-500 text-white shadow-rose-500/30 shadow-md'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                }`}
              >
                {isMuted ? 'MUDO' : 'LIGADO'}
              </button>
            </div>

            {/* Volume Slider */}
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span>Volume Geral</span>
                <span className="font-mono text-amber-400 text-sm font-black">{volumeLevel}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={volumeLevel}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setVolumeLevel(val);
                  soundManager.setVolume(val / 100);
                  if (val === 0 && !isMuted) {
                    setIsMuted(soundManager.toggleMute());
                  } else if (val > 0 && isMuted) {
                    setIsMuted(soundManager.toggleMute());
                  }
                }}
                className="w-full accent-amber-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
            </div>

            {/* Skate sound effect toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800">
              <div>
                <div className="text-sm font-bold text-white">Rolamento de Patins</div>
                <div className="text-[11px] text-slate-400">Som dinâmico das rodas na quadra</div>
              </div>
              <button
                onClick={() => {
                  const next = !skateSoundEnabled;
                  setSkateSoundEnabled(next);
                  soundManager.setSkateSoundEnabled(next);
                }}
                className={`px-3.5 py-1.5 rounded-xl font-black text-xs transition-all ${
                  skateSoundEnabled
                    ? 'bg-amber-500 text-slate-950 shadow-amber-500/30 shadow-md'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {skateSoundEnabled ? 'ATIVO' : 'DESLIGADO'}
              </button>
            </div>

            {/* Test Sound Button */}
            <button
              onClick={() => {
                soundManager.playWhistle('lead');
              }}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs flex items-center justify-center gap-2 border border-slate-700 active:scale-95 transition-all mt-1"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Testar Apito de Derby</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 3D ARENA & SKATER GENERATOR FUNCTIONS (OPTIMIZED FOR ZERO STALLS)
// =========================================================================

function build3DDerbyArena(scene: THREE.Scene) {
  // 1. Polished Arena Hardwood / Sport Court Floor
  const floorGeo = new THREE.PlaneGeometry(90, 70);
  const floorMat = new THREE.MeshStandardMaterial({
    color: '#152038',
    roughness: 0.28,
    metalness: 0.15,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // 2. Track Surface (Oval Track Ribbon Mesh)
  // Straight length 28, Turn radius 10.5, Width 4.0
  const segments = 100; // Optimized segment count
  const trackGeo = new THREE.BufferGeometry();
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const getTrackPt = (p: number, offset: number) => {
    const baseR = 10.5 + offset * 2.0;
    const straightLen = 28.0;
    const curveLen = Math.PI * baseR;
    const total = 2 * straightLen + 2 * curveLen;
    const d = (p % 1) * total;

    if (d < straightLen) {
      const t = d / straightLen;
      return new THREE.Vector3(14.0 - t * 28.0, 0.015, baseR);
    } else if (d < straightLen + curveLen) {
      const t = (d - straightLen) / curveLen;
      const angle = Math.PI / 2 + t * Math.PI;
      return new THREE.Vector3(-14.0 + Math.cos(angle) * baseR, 0.015, Math.sin(angle) * baseR);
    } else if (d < 2 * straightLen + curveLen) {
      const t = (d - (straightLen + curveLen)) / straightLen;
      return new THREE.Vector3(-14.0 + t * 28.0, 0.015, -baseR);
    } else {
      const t = (d - (2 * straightLen + curveLen)) / curveLen;
      const angle = -Math.PI / 2 + t * Math.PI;
      return new THREE.Vector3(14.0 + Math.cos(angle) * baseR, 0.015, Math.sin(angle) * baseR);
    }
  };

  for (let i = 0; i <= segments; i++) {
    const p = i / segments;
    const ptInner = getTrackPt(p, -1.0);
    const ptOuter = getTrackPt(p, 1.0);

    positions.push(ptInner.x, ptInner.y, ptInner.z);
    positions.push(ptOuter.x, ptOuter.y, ptOuter.z);

    uvs.push(0, p * 16);
    uvs.push(1, p * 16);

    if (i < segments) {
      const v0 = i * 2;
      const v1 = i * 2 + 1;
      const v2 = (i + 1) * 2;
      const v3 = (i + 1) * 2 + 1;
      indices.push(v0, v1, v2);
      indices.push(v1, v3, v2);
    }
  }

  trackGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  trackGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  trackGeo.setIndex(indices);
  trackGeo.computeVertexNormals();

  const trackMat = new THREE.MeshStandardMaterial({
    color: '#1e3d6b',
    roughness: 0.22,
    metalness: 0.2,
  });
  const trackMesh = new THREE.Mesh(trackGeo, trackMat);
  scene.add(trackMesh);

  // 3. Center Dashed Lane Divider (Radius 10.5m)
  const centerLinePts: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const p = i / segments;
    const ptCenter = getTrackPt(p, 0.0);
    centerLinePts.push(ptCenter.x, 0.022, ptCenter.z);
  }
  const centerLineGeo = new THREE.BufferGeometry();
  centerLineGeo.setAttribute('position', new THREE.Float32BufferAttribute(centerLinePts, 3));
  const centerLineMat = new THREE.LineDashedMaterial({
    color: '#ffffff',
    dashSize: 1.5,
    gapSize: 1.0,
  });
  const centerLine = new THREE.Line(centerLineGeo, centerLineMat);
  centerLine.computeLineDistances();
  scene.add(centerLine);

  // 4. Glowing Track Boundary Neon Tubes (MeshBasicMaterial = ZERO fragment shader lighting cost)
  const lineMatInner = new THREE.MeshBasicMaterial({ color: '#22d3ee' });
  const lineMatOuter = new THREE.MeshBasicMaterial({ color: '#f472b6' });

  const innerLineGeo = new THREE.BufferGeometry();
  const innerLinePts: number[] = [];
  const outerLineGeo = new THREE.BufferGeometry();
  const outerLinePts: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const p = i / segments;
    const ptIn = getTrackPt(p, -1.0);
    innerLinePts.push(ptIn.x, 0.025, ptIn.z);

    const ptOut = getTrackPt(p, 1.0);
    outerLinePts.push(ptOut.x, 0.025, ptOut.z);
  }

  innerLineGeo.setAttribute('position', new THREE.Float32BufferAttribute(innerLinePts, 3));
  outerLineGeo.setAttribute('position', new THREE.Float32BufferAttribute(outerLinePts, 3));

  const innerLine = new THREE.Line(innerLineGeo, lineMatInner);
  scene.add(innerLine);

  const outerLine = new THREE.Line(outerLineGeo, lineMatOuter);
  scene.add(outerLine);

  // 5. 8 Track Perimeter Glowing Neon Beacon Markers (MeshBasicMaterial - brilliant & 0 GPU stall)
  const beaconConfigs = [
    { p: 0.12, lane: -1.0, color: '#06b6d4' },
    { p: 0.38, lane: -1.0, color: '#06b6d4' },
    { p: 0.62, lane: -1.0, color: '#06b6d4' },
    { p: 0.88, lane: -1.0, color: '#06b6d4' },
    { p: 0.12, lane: 1.0, color: '#ec4899' },
    { p: 0.38, lane: 1.0, color: '#ec4899' },
    { p: 0.62, lane: 1.0, color: '#ec4899' },
    { p: 0.88, lane: 1.0, color: '#ec4899' },
  ];
  const beaconGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.3, 8);
  beaconConfigs.forEach((cfg) => {
    const pt = getTrackPt(cfg.p, cfg.lane);
    const mat = new THREE.MeshBasicMaterial({ color: cfg.color });
    const bMesh = new THREE.Mesh(beaconGeo, mat);
    bMesh.position.set(pt.x, 0.15, pt.z);
    scene.add(bMesh);
  });

  // 6. Jammer & Pivot Start Lines across the track (Straight 1)
  const jammerLineGeo = new THREE.BoxGeometry(0.14, 0.03, 4.0);
  const jammerLineMat = new THREE.MeshBasicMaterial({ color: '#facc15' });
  const jammerLine = new THREE.Mesh(jammerLineGeo, jammerLineMat);
  jammerLine.position.set(0, 0.02, 10.5);
  scene.add(jammerLine);

  // 7. Surrounding Arena Bleachers & Tiered Seating
  const bleacherMat = new THREE.MeshStandardMaterial({ color: '#24324d', roughness: 0.5 });
  const bleacherSeatMat = new THREE.MeshStandardMaterial({ color: '#38bdf8', roughness: 0.4 });

  [-1, 1].forEach((side) => {
    for (let tier = 0; tier < 3; tier++) {
      const zPos = side * (19.0 + tier * 2.5);
      const tierH = 0.8 * (tier + 1);
      const bTier = new THREE.Mesh(new THREE.BoxGeometry(68, tierH, 2.2), bleacherMat);
      bTier.position.set(0, tierH / 2, zPos);
      scene.add(bTier);

      const seat = new THREE.Mesh(new THREE.BoxGeometry(66, 0.1, 0.9), bleacherSeatMat);
      seat.position.set(0, tierH + 0.05, zPos);
      scene.add(seat);
    }
  });

  // 8. Perimeter LED Ribbon Boards
  const ribbonGeo = new THREE.BoxGeometry(86, 1.8, 0.2);
  const ribbonMat = new THREE.MeshBasicMaterial({ color: '#0284c7' });
  const ribbonSouth = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribbonSouth.position.set(0, 3.8, 27.5);
  scene.add(ribbonSouth);

  const ribbonNorth = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribbonNorth.position.set(0, 3.8, -27.5);
  scene.add(ribbonNorth);
}

// 4 High-Mast Physical Stadium Floodlight Towers with Visible Volumetric Beams
function buildStadiumLightTowers(scene: THREE.Scene) {
  const towerConfigs = [
    { x: -24, z: 20, tx: -14, tz: 8 },
    { x: 24, z: 20, tx: 14, tz: 8 },
    { x: -24, z: -20, tx: -14, tz: -8 },
    { x: 24, z: -20, tx: 14, tz: -8 },
  ];

  const mastMat = new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.85, roughness: 0.3 });
  const lampMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const beamMat = new THREE.MeshBasicMaterial({
    color: '#e0f2fe',
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
  });

  const mastGeo = new THREE.CylinderGeometry(0.28, 0.45, 15, 8);
  const barGeo = new THREE.BoxGeometry(3.2, 0.25, 0.4);
  const housingGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.35, 8);
  const bulbGeo = new THREE.CircleGeometry(0.16, 8);

  towerConfigs.forEach((tp) => {
    const towerGroup = new THREE.Group();
    towerGroup.position.set(tp.x, 0, tp.z);
    scene.add(towerGroup);

    // Main steel vertical mast (15m tall)
    const mast = new THREE.Mesh(mastGeo, mastMat);
    mast.position.y = 7.5;
    towerGroup.add(mast);

    // Crossbar assembly
    const bar = new THREE.Mesh(barGeo, mastMat);
    bar.position.set(0, 15, 0);
    towerGroup.add(bar);

    // 6 Floodlight lamp housings & glowing bulbs
    for (let i = -1.2; i <= 1.2; i += 0.48) {
      const housing = new THREE.Mesh(housingGeo, mastMat);
      housing.rotation.x = Math.PI / 2 + 0.35;
      housing.position.set(i, 15.1, 0.2);
      towerGroup.add(housing);

      const bulb = new THREE.Mesh(bulbGeo, lampMat);
      bulb.position.set(i, 15.1, 0.38);
      towerGroup.add(bulb);
    }

    // Visible translucent light beam cone
    const beamDist = Math.hypot(tp.x - tp.tx, 15, tp.z - tp.tz);
    const beamGeo = new THREE.CylinderGeometry(0.4, 4.5, beamDist, 8, 1, true);
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set((tp.x + tp.tx) / 2, 7.5, (tp.z + tp.tz) / 2);
    beam.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(tp.tx - tp.x, -15, tp.tz - tp.z).normalize()
    );
    scene.add(beam);
  });
}

// Build 4-sided Suspended Rafter Jumbotron Screen
function buildJumbotron(scene: THREE.Scene) {
  const jumboGroup = new THREE.Group();
  jumboGroup.position.set(0, 10.5, 0);
  scene.add(jumboGroup);

  // Center housing
  const housingGeo = new THREE.BoxGeometry(6.5, 3.2, 6.5);
  const housingMat = new THREE.MeshStandardMaterial({ color: '#090d16', metalness: 0.9, roughness: 0.2 });
  const housing = new THREE.Mesh(housingGeo, housingMat);
  jumboGroup.add(housing);

  // 4 LED Screen Planes (Optimized 512x256 texture for zero GPU memory hitching)
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const screenMat = new THREE.MeshBasicMaterial({ map: texture });
  const screenGeo = new THREE.PlaneGeometry(6.2, 2.9);

  // Screen 1 (South)
  const screenS = new THREE.Mesh(screenGeo, screenMat);
  screenS.position.set(0, 0, 3.26);
  jumboGroup.add(screenS);

  // Screen 2 (North)
  const screenN = new THREE.Mesh(screenGeo, screenMat);
  screenN.position.set(0, 0, -3.26);
  screenN.rotation.y = Math.PI;
  jumboGroup.add(screenN);

  // Screen 3 (East)
  const screenE = new THREE.Mesh(screenGeo, screenMat);
  screenE.position.set(3.26, 0, 0);
  screenE.rotation.y = Math.PI / 2;
  jumboGroup.add(screenE);

  // Screen 4 (West)
  const screenW = new THREE.Mesh(screenGeo, screenMat);
  screenW.position.set(-3.26, 0, 0);
  screenW.rotation.y = -Math.PI / 2;
  jumboGroup.add(screenW);

  // Steel suspension cables
  const cableMat = new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.9 });
  const cableGeo = new THREE.CylinderGeometry(0.04, 0.04, 12, 6);
  [
    [-3, 3],
    [3, 3],
    [-3, -3],
    [3, -3],
  ].forEach(([cx, cz]) => {
    const cable = new THREE.Mesh(cableGeo, cableMat);
    cable.position.set(cx, 6.0, cz);
    jumboGroup.add(cable);
  });

  return { canvas, texture };
}

// Update Jumbotron 2D Canvas Graphics (Fast, lightweight 512x256 rendering)
function updateJumbotronCanvas(
  canvas: HTMLCanvasElement,
  rule: KingsLeagueRule,
  score: number,
  timeLeft: number,
  isLead: boolean,
  isGameOver: boolean
) {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;

  // Background
  ctx.fillStyle = '#060a14';
  ctx.fillRect(0, 0, w, h);

  // Top Broadcast Bar
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, w, 42);

  ctx.fillStyle = '#f59e0b';
  ctx.font = '900 18px Impact, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('👑 KINGS DERBY 3D', 15, 28);

  // Jam Timer
  ctx.textAlign = 'right';
  ctx.font = '900 20px monospace';
  ctx.fillStyle = timeLeft <= 10 ? '#ef4444' : '#facc15';
  ctx.fillText(`JAM 0:${timeLeft < 10 ? `0${timeLeft}` : timeLeft}`, w - 15, 28);

  // Left Box: Rule
  ctx.strokeStyle = rule.color;
  ctx.lineWidth = 2;
  ctx.strokeRect(15, 52, 230, 190);
  ctx.fillStyle = `${rule.color}22`;
  ctx.fillRect(15, 52, 230, 190);

  ctx.fillStyle = rule.color;
  ctx.font = '900 14px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`CARTA: ${rule.badge}`, 25, 78);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 20px sans-serif';
  ctx.fillText(rule.name, 25, 110);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(rule.tagline, 25, 136);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '12px sans-serif';
  ctx.fillText(`${rule.pointMultiplier}x Pts • ${rule.jammerSpeedMultiplier}x Vel`, 25, 175);

  // Right Box: Score
  ctx.strokeStyle = '#38bdf8';
  ctx.strokeRect(260, 52, 235, 190);
  ctx.fillStyle = '#0f172a88';
  ctx.fillRect(260, 52, 235, 190);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('PONTUAÇÃO', 377, 82);

  ctx.fillStyle = '#facc15';
  ctx.font = '900 52px Impact, sans-serif';
  ctx.fillText(`${score} PTS`, 377, 146);

  ctx.fillStyle = isLead ? '#10b981' : '#38bdf8';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(isLead ? '★ LEAD JAMMER ★' : isGameOver ? 'JAM FINALIZADO' : 'CORRENDO NO PACK', 377, 195);
}

// Build 3D Golden Star for Bonus Apex Points
function buildGoldenStarMesh() {
  const group = new THREE.Group();

  const shape = new THREE.Shape();
  const points = 5;
  const outerR = 0.7;
  const innerR = 0.32;

  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  const starGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: false });
  const starMat = new THREE.MeshBasicMaterial({ color: '#facc15' });

  const starMesh = new THREE.Mesh(starGeo, starMat);
  group.add(starMesh);

  return group;
}

// Build Authentic Roller Derby Skater 3D Model
function buildSkaterModel(
  teamColor: string,
  role: 'jammer' | 'pivot' | 'blocker',
  hasStar = false,
  hasStripe = false,
  isPlayer = false
) {
  const skaterGroup = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({
    color: '#fed7aa',
    roughness: 0.35,
    emissive: '#fed7aa',
    emissiveIntensity: 0.15,
  });
  const jerseyMat = new THREE.MeshStandardMaterial({
    color: teamColor,
    roughness: 0.3,
    emissive: teamColor,
    emissiveIntensity: 0.45,
  });
  const padMat = new THREE.MeshStandardMaterial({
    color: '#0f172a',
    roughness: 0.4,
    emissive: '#1e293b',
    emissiveIntensity: 0.15,
  });
  const skatePlateMat = new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    metalness: 0.9,
    roughness: 0.15,
    emissive: '#64748b',
    emissiveIntensity: 0.2,
  });

  // 1. Torso in derby low stance
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.35), jerseyMat);
  torso.position.y = 0.65;
  torso.rotation.x = 0.25; // Athletic forward crouch
  skaterGroup.add(torso);

  // 2. Head & Helmet
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.32), skinMat);
  head.position.set(0, 1.15, 0.12);
  skaterGroup.add(head);

  // Helmet base
  const helmetMat = new THREE.MeshStandardMaterial({
    color: teamColor,
    roughness: 0.2,
    emissive: teamColor,
    emissiveIntensity: 0.45,
  });
  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.38), helmetMat);
  helmet.position.set(0, 1.28, 0.12);
  skaterGroup.add(helmet);

  // Star Helmet Cover (Jammer)
  let starBeacon: THREE.Mesh;
  if (hasStar || role === 'jammer') {
    const starMat = new THREE.MeshBasicMaterial({ color: '#facc15' });

    // Side Star L
    const starShape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const r = i % 2 === 0 ? 0.08 : 0.035;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) starShape.moveTo(x, y);
      else starShape.lineTo(x, y);
    }
    const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.015, bevelEnabled: false });

    const starR = new THREE.Mesh(starGeo, starMat);
    starR.position.set(0.185, 1.28, 0.12);
    starR.rotation.y = Math.PI / 2;
    skaterGroup.add(starR);

    const starL = new THREE.Mesh(starGeo, starMat);
    starL.position.set(-0.185, 1.28, 0.12);
    starL.rotation.y = -Math.PI / 2;
    skaterGroup.add(starL);

    // Floating 3D Star Crest over head
    const beaconGeo = new THREE.OctahedronGeometry(0.14, 0);
    starBeacon = new THREE.Mesh(beaconGeo, starMat);
    starBeacon.position.set(0, 1.62, 0.12);
    skaterGroup.add(starBeacon);
  } else {
    starBeacon = new THREE.Mesh();
  }

  // Stripe Helmet Cover (Pivot)
  if (hasStripe || role === 'pivot') {
    const stripeMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const topStripe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.02, 0.4), stripeMat);
    topStripe.position.set(0, 1.395, 0.12);
    skaterGroup.add(topStripe);
  }

  // 3. Arms
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), skinMat);
  armL.position.set(0.34, 0.75, 0.05);
  skaterGroup.add(armL);

  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.45, 0.14), skinMat);
  armR.position.set(-0.34, 0.75, 0.05);
  skaterGroup.add(armR);

  // 4. Legs with Heavy Duty Knee Pads
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18), jerseyMat);
  legL.position.set(0.18, 0.35, -0.05);
  skaterGroup.add(legL);

  const kneeCapL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.12), padMat);
  kneeCapL.position.set(0.18, 0.35, 0.08);
  skaterGroup.add(kneeCapL);

  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18), jerseyMat);
  legR.position.set(-0.18, 0.35, 0.05);
  skaterGroup.add(legR);

  const kneeCapR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.12), padMat);
  kneeCapR.position.set(-0.18, 0.35, 0.18);
  skaterGroup.add(kneeCapR);

  // 5. Quad Roller Skates (Derby boots, aluminum plate & 4 rotating wheels)
  const allWheels: THREE.Mesh[] = [];
  const bootMat = new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.3 });
  const wheelMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });

  const addSkate = (xPos: number, zPos: number) => {
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.38), bootMat);
    boot.position.set(xPos, 0.1, zPos);
    skaterGroup.add(boot);

    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.36), skatePlateMat);
    plate.position.set(xPos, 0.04, zPos);
    skaterGroup.add(plate);

    // 4 Polyurethane wheels
    const wheelGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.055, 8);
    wheelGeo.rotateZ(Math.PI / 2);

    const wPositions = [
      [xPos - 0.1, 0.065, zPos - 0.11],
      [xPos + 0.1, 0.065, zPos - 0.11],
      [xPos - 0.1, 0.065, zPos + 0.11],
      [xPos + 0.1, 0.065, zPos + 0.11],
    ];

    wPositions.forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(wx, wy, wz);
      skaterGroup.add(wheel);
      allWheels.push(wheel);
    });
  };

  addSkate(0.18, -0.05);
  addSkate(-0.18, 0.05);

  // 6. Thruster effect for player
  let nitroParticles: THREE.Points | null = null;
  let shieldBubble: THREE.Mesh | null = null;

  if (isPlayer) {
    const pCount = 18;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 0.3;
      pPos[i * 3 + 1] = Math.random() * 0.4;
      pPos[i * 3 + 2] = -0.3 - Math.random() * 0.8;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: '#f59e0b',
      size: 0.12,
      transparent: true,
      opacity: 0.85,
    });
    nitroParticles = new THREE.Points(pGeo, pMat);
    nitroParticles.position.set(0, 0.4, 0);
    nitroParticles.visible = false;
    skaterGroup.add(nitroParticles);

    // Holographic Energy Shield Bubble
    const sGeo = new THREE.SphereGeometry(1.05, 16, 12);
    const sMat = new THREE.MeshBasicMaterial({
      color: '#06b6d4',
      wireframe: true,
      transparent: true,
      opacity: 0.55,
    });
    shieldBubble = new THREE.Mesh(sGeo, sMat);
    shieldBubble.position.set(0, 0.75, 0);
    shieldBubble.visible = false;
    skaterGroup.add(shieldBubble);
  }

  return {
    group: skaterGroup,
    torso,
    legL,
    legR,
    armL,
    armR,
    wheels: allWheels,
    starBeacon,
    nitroParticles: nitroParticles as THREE.Points,
    shieldBubble,
  };
}

// Helper to create rotating cartoon stars above stunned blocker's helmet
function createDizzyStarsGroup(): THREE.Group {
  const g = new THREE.Group();
  g.position.set(0, 1.55, 0.12);
  const starGeo = new THREE.OctahedronGeometry(0.09);
  const starMat = new THREE.MeshBasicMaterial({ color: '#facc15' });
  for (let s = 0; s < 3; s++) {
    const star = new THREE.Mesh(starGeo, starMat);
    const angle = (s / 3) * Math.PI * 2;
    star.position.set(Math.cos(angle) * 0.28, 0, Math.sin(angle) * 0.28);
    g.add(star);
  }
  g.visible = false;
  return g;
}

// Helper to create 3D floating Track Power-Up meshes
function buildPowerupMesh(type: 'turbo' | 'shield' | 'star' | 'time'): THREE.Group {
  const g = new THREE.Group();

  if (type === 'turbo') {
    // Glowing cyan rocket battery with twin energy rings
    const coreMat = new THREE.MeshStandardMaterial({
      color: '#06b6d4',
      emissive: '#06b6d4',
      emissiveIntensity: 0.8,
      metalness: 0.2,
      roughness: 0.2,
    });
    const boltGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.55, 8);
    const bolt = new THREE.Mesh(boltGeo, coreMat);
    g.add(bolt);

    const ringMat = new THREE.MeshBasicMaterial({ color: '#38bdf8' });
    const ringGeo = new THREE.TorusGeometry(0.3, 0.04, 8, 16);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
  } else if (type === 'shield') {
    // Neon magenta energetic diamond
    const mat = new THREE.MeshStandardMaterial({
      color: '#ec4899',
      emissive: '#ec4899',
      emissiveIntensity: 0.9,
      roughness: 0.1,
    });
    const geo = new THREE.OctahedronGeometry(0.34);
    const shield = new THREE.Mesh(geo, mat);
    g.add(shield);
  } else if (type === 'star') {
    // Glowing golden star
    const mat = new THREE.MeshStandardMaterial({
      color: '#facc15',
      emissive: '#f59e0b',
      emissiveIntensity: 0.9,
    });
    const geo = new THREE.DodecahedronGeometry(0.3);
    const star = new THREE.Mesh(geo, mat);
    g.add(star);
  } else {
    // Time extension (emerald hourglass / clock)
    const mat = new THREE.MeshStandardMaterial({
      color: '#10b981',
      emissive: '#10b981',
      emissiveIntensity: 0.9,
    });
    const geo = new THREE.ConeGeometry(0.22, 0.32, 6);
    const top = new THREE.Mesh(geo, mat);
    top.position.y = 0.16;
    g.add(top);
    const bottom = new THREE.Mesh(geo, mat);
    bottom.position.y = -0.16;
    bottom.rotation.x = Math.PI;
    g.add(bottom);
  }

  return g;
}

import { useEffect, useMemo, useRef, useState } from "react";

const PLAYBACK_PRESETS = [0.25, 0.5, 0.75, 1];
const TRACE_TOP = 0;
const TRACE_BOTTOM = 100;
const CAMERA_PROFILES = {
  range_tight: {
    label: "Range Tight",
    detail: "Tripod, zoomed, ball stays larger in frame.",
    sampleWidth: 352,
    frameStep: 1 / 48,
    trackWindowSeconds: 1.7,
    initialVelocityX: 0.03,
    initialVelocityY: -0.055,
    brightnessThreshold: 124,
    diffThreshold: 30,
  },
  range_standard: {
    label: "Range Standard",
    detail: "Typical down-the-line practice video.",
    sampleWidth: 320,
    frameStep: 1 / 45,
    trackWindowSeconds: 1.85,
    initialVelocityX: 0.028,
    initialVelocityY: -0.052,
    brightnessThreshold: 122,
    diffThreshold: 34,
  },
  wide_fairway: {
    label: "Wide Fairway",
    detail: "Ball is tiny in a large course frame.",
    sampleWidth: 384,
    frameStep: 1 / 54,
    trackWindowSeconds: 2.05,
    initialVelocityX: 0.024,
    initialVelocityY: -0.046,
    brightnessThreshold: 96,
    diffThreshold: 24,
    acceptScore: 42,
  },
};
const STEPS = [
  { id: 0, label: "Import", title: "Choose video" },
  { id: 1, label: "Impact", title: "Mark ball" },
  { id: 2, label: "Landing", title: "Set finish" },
  { id: 3, label: "Shape", title: "Adjust arc" },
];
const PRODUCT_DROPS = [
  {
    name: "Performance Polo",
    tag: "Concept 01",
    image: "/brand/ifonlyicouldputt-performance-polo.png",
    detail: "Forest performance knit, cream embroidery, rust side tab, course-ready fit.",
  },
  {
    name: "Bold Vintage Tee",
    tag: "Concept 02",
    image: "/brand/ifonlyicouldputt-vintage-tee.png",
    detail: "Heavy cotton tee with club badge, full back graphic, and custom neck print.",
  },
  {
    name: "Rope Hat",
    tag: "Concept 03",
    image: "/brand/ifonlyicouldputt-rope-hat.png",
    detail: "Deep green rope hat with brass hardware and crossed-club badge.",
  },
  {
    name: "Practice Crew",
    tag: "Concept 04",
    image: "/brand/ifonlyicouldputt-practice-crew.png",
    detail: "Cream heavyweight layer with oversized putting graphic on the back.",
  },
];

function App() {
  const uploadInputRef = useRef(null);
  const liveInputRef = useRef(null);
  const videoRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const videoFrameRef = useRef(null);
  const overlayRef = useRef(null);
  const dragRef = useRef(null);
  const previewRafRef = useRef(0);

  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceMode, setSourceMode] = useState("upload");
  const [videoAspect, setVideoAspect] = useState("16 / 9");
  const [videoOrientation, setVideoOrientation] = useState("landscape");
  const [videoDimensions, setVideoDimensions] = useState({ width: 16, height: 9 });
  const [stageDimensions, setStageDimensions] = useState({ width: 320, height: 180 });
  const [duration, setDuration] = useState(0);
  const [timelineValue, setTimelineValue] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(0.5);
  const [isPlaying, setIsPlaying] = useState(false);
  const [exportState, setExportState] = useState("idle");
  const [exportProgress, setExportProgress] = useState(0);
  const [videoError, setVideoError] = useState("");
  const [status, setStatus] = useState("Import or record one swing video. Then the editor walks you through the shot trace one step at a time.");
  const [detectState, setDetectState] = useState("idle");
  const [detectProgress, setDetectProgress] = useState(0);
  const [detectConfidence, setDetectConfidence] = useState(null);
  const [detectStage, setDetectStage] = useState("Waiting for impact point.");
  const [detectStats, setDetectStats] = useState(null);
  const [detectPoints, setDetectPoints] = useState([]);
  const [autoTracePoints, setAutoTracePoints] = useState([]);
  const [swingAssistState, setSwingAssistState] = useState("idle");
  const [swingAssistProgress, setSwingAssistProgress] = useState(0);
  const [swingWindow, setSwingWindow] = useState(null);
  const [cameraProfile, setCameraProfile] = useState("wide_fairway");
  const [showTrackingLab, setShowTrackingLab] = useState(true);
  const [frameViewport, setFrameViewport] = useState({ left: 0, top: 0, width: 100, height: 100 });
  const [workflowMode, setWorkflowMode] = useState("course_quick");

  const [impactTime, setImpactTime] = useState(null);
  const [startPoint, setStartPoint] = useState(null);
  const [launchPoint, setLaunchPoint] = useState(null);
  const [apexPoint, setApexPoint] = useState(null);
  const [carryPoint, setCarryPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [impactFrame, setImpactFrame] = useState(null);
  const [landingFrame, setLandingFrame] = useState(null);
  const [placementMode, setPlacementMode] = useState(null);
  const [selectedHandle, setSelectedHandle] = useState(null);
  const [editingTrace, setEditingTrace] = useState(false);
  const [fps, setFps] = useState(60);
  const [curveSettings, setCurveSettings] = useState({
    ballSpeed: 62,
    flightTime: 1.25,
    glow: 82,
  });
  const sampleSeedAppliedRef = useRef(false);
  const sampleAutoRunPendingRef = useRef(false);
  const swingAssistAutoRunRef = useRef(false);

  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      if (previewRafRef.current) cancelAnimationFrame(previewRafRef.current);
    };
  }, [sourceUrl]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sample = params.get("sample");
    if (sample === "test-swing") {
      loadVideoSource("/test-swing.mov", "test-swing.mov", "sample", false);
    } else if (sample === "golf-tryon") {
      loadVideoSource("/golf-tryon.mp4", "golf-tryon.mp4", "sample", false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (sampleSeedAppliedRef.current || !sourceUrl || duration <= 0) return;
    const sample = params.get("sample");
    const seed = params.get("seed");

    if (sample === "test-swing" && seed === "putt56") {
      sampleSeedAppliedRef.current = true;
      sampleAutoRunPendingRef.current = true;
      setCameraProfile("range_tight");
      setTimelineValue(56);
      setImpactTime(56);
      setImpactFrame(Math.round(56 * fps));
      setStartPoint({ x: 49.2, y: 71.1 });
      setStatus("Loaded test seed at impact. Running Track Assist Beta on the sample swing.");

      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 56;
      }
      return;
    }

    if (sample === "golf-tryon" && seed === "tryon1") {
      sampleSeedAppliedRef.current = true;
      setCameraProfile("wide_fairway");
      setShowTrackingLab(false);
      setTimelineValue(6.25);
      setImpactTime(6.25);
      setImpactFrame(Math.round(6.25 * fps));
      const seededStart = { x: 55.4, y: 79.2 };
      const seededApex = { x: 73.8, y: 28.4 };
      const seededEnd = { x: 93.2, y: 81.8 };
      const seededControls = buildDefaultShapeControls(seededStart, seededApex, seededEnd, {
        launchPoint: { x: 62.2, y: 59.8 },
        carryPoint: { x: 84.1, y: 59.4 },
      });
      setStartPoint(seededStart);
      setLaunchPoint(seededControls.launchPoint);
      setApexPoint(seededApex);
      setCarryPoint(seededControls.carryPoint);
      setEndPoint(seededEnd);
      setLandingFrame(Math.round(7.35 * fps));
      setCurveSettings((current) => ({
        ...current,
        ballSpeed: 95.6,
        flightTime: 1.34,
        glow: 74,
      }));
      setStatus("Loaded the try-on seed for your course clip. Drag all five flight dots to shape the shot the way you want.");

      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 6.25;
      }
    }
  }, [duration, fps, sourceUrl]);

  useEffect(() => {
    if (!sampleAutoRunPendingRef.current || !sourceUrl || !startPoint || impactTime == null || detectState === "running") return;
    sampleAutoRunPendingRef.current = false;
    runTrackAssistBeta();
  }, [detectState, impactTime, sourceUrl, startPoint]);

  const currentFrame = Math.max(0, Math.round(timelineValue * fps));
  const activeStep = !sourceUrl ? 0 : !startPoint ? 1 : !endPoint ? 2 : 3;
  const readyToTrace = Boolean(sourceUrl && startPoint && apexPoint && endPoint && impactTime != null);
  const flightEndTime = impactTime == null ? curveSettings.flightTime : impactTime + curveSettings.flightTime;
  const placementFocusMode = Boolean(sourceUrl && (placementMode === "start" || placementMode === "end"));
  const hasSuggestedWindow = Boolean(swingWindow?.impactGuess != null);
  const editorOpen = Boolean(sourceUrl);
  const cinematicReplay = Boolean(sourceUrl && readyToTrace && isPlaying && !placementMode);
  const shapeMode = Boolean(
    sourceUrl &&
      !isPlaying &&
      placementMode !== "start" &&
      placementMode !== "end" &&
      (placementMode === "apex" || selectedHandle === "apex" || readyToTrace)
  );

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    function handleResize() {
      syncStageDimensions();
      updateFrameViewport();
    }

    syncStageDimensions();
    updateFrameViewport();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [sourceUrl, videoAspect, shapeMode, videoDimensions]);

  const apexHandle = useMemo(() => {
    return apexPoint;
  }, [apexPoint]);

  const fullTracePoints = useMemo(() => {
    if (autoTracePoints.length >= 3) return autoTracePoints;
    if (!startPoint || !apexPoint || !endPoint || impactTime == null) return [];

    return buildManualTracePoints(startPoint, launchPoint, apexPoint, carryPoint, endPoint, impactTime, curveSettings.flightTime);
  }, [autoTracePoints, startPoint, launchPoint, apexPoint, carryPoint, endPoint, impactTime, curveSettings.flightTime]);

  const displayTracePoints = useMemo(() => {
    if (!readyToTrace) return [];
    if (editingTrace || autoTracePoints.length >= 3) return fullTracePoints;
    return buildBroadcastTracePoints(startPoint, launchPoint, apexPoint, carryPoint, impactTime, curveSettings.flightTime);
  }, [readyToTrace, editingTrace, autoTracePoints.length, fullTracePoints, startPoint, launchPoint, apexPoint, carryPoint, impactTime, curveSettings.flightTime]);

  const stageFullTracePoints = useMemo(() => displayTracePoints.map(mapLogicalPointToStagePoint), [displayTracePoints, frameViewport]);

  const visibleTracePoints = useMemo(() => {
    if (!readyToTrace) return [];
    if (timelineValue < impactTime) return [];

    if (displayTracePoints.length < 2) return displayTracePoints;

    const previewTime = !isPlaying && activeStep === 3
      ? displayTracePoints[displayTracePoints.length - 1]?.time ?? timelineValue
      : timelineValue;
    const visible = displayTracePoints.filter((point) => point.time <= previewTime);

    if (visible.length >= 2) return visible;
    return displayTracePoints.slice(0, 2);
  }, [activeStep, displayTracePoints, impactTime, isPlaying, readyToTrace, timelineValue]);

  const stageVisibleTracePoints = useMemo(() => visibleTracePoints.map(mapLogicalPointToStagePoint), [visibleTracePoints, frameViewport]);

  const guidePath = useMemo(() => {
    if (stageFullTracePoints.length < 2) return "";
    return buildSmoothPath(stageFullTracePoints);
  }, [stageFullTracePoints]);

  const tracePath = useMemo(() => buildSmoothPath(stageVisibleTracePoints), [stageVisibleTracePoints]);

  const stageStartPoint = startPoint ? mapLogicalPointToStagePoint(startPoint) : null;
  const stageLaunchPoint = launchPoint ? mapLogicalPointToStagePoint(launchPoint) : null;
  const stageApexPoint = apexPoint ? mapLogicalPointToStagePoint(apexPoint) : null;
  const stageCarryPoint = carryPoint ? mapLogicalPointToStagePoint(carryPoint) : null;
  const stageEndPoint = endPoint ? mapLogicalPointToStagePoint(endPoint) : null;
  const stageDetectPoints = useMemo(() => detectPoints.map((point) => ({ ...mapLogicalPointToStagePoint(point), type: point.type })), [detectPoints, frameViewport]);
  const showTraceHandles = Boolean(editingTrace || placementMode || !readyToTrace);
  const traceTelemetry = useMemo(() => {
    if (!startPoint || !launchPoint || !apexPoint || !endPoint) return null;

    const rise = Math.max(startPoint.y - apexPoint.y, 0);
    const run = Math.max(endPoint.x - startPoint.x, 1);
    const launchRise = Math.max(startPoint.y - launchPoint.y, 0.1);
    const launchRun = Math.max(launchPoint.x - startPoint.x, 0.1);
    const launchAngle = Math.round((Math.atan2(launchRise, launchRun) * 180) / Math.PI);
    const apexHeight = Math.round(mapRange(rise, 10, 50, 18, 122));
    const carryEstimate = Math.round(mapRange(run, 12, 46, 92, 262));

    return {
      apexLabel: `${apexHeight} FT`,
      speedLabel: `${curveSettings.ballSpeed.toFixed(1)} MPH`,
      carryLabel: `${carryEstimate} YD`,
      angleLabel: `${clamp(launchAngle, 8, 36)} DEG`,
    };
  }, [startPoint, launchPoint, apexPoint, endPoint, curveSettings.ballSpeed]);

  function syncStageDimensions(nextWidth = videoDimensions.width, nextHeight = videoDimensions.height) {
    if (typeof window === "undefined" || !nextWidth || !nextHeight) return;

    const aspectRatio = nextWidth / Math.max(nextHeight, 1);
    const compactViewport = window.innerWidth < 900;
    const horizontalPadding = compactViewport ? 36 : 120;
    const maxWidth = Math.max(260, window.innerWidth - horizontalPadding);
    const preferredWidth = nextHeight > nextWidth ? (compactViewport ? maxWidth : 430) : (compactViewport ? maxWidth : 820);
    const maxHeight = Math.max(260, Math.min(window.innerHeight * (compactViewport ? 0.52 : 0.72), compactViewport ? 560 : 760));

    let fittedWidth = Math.min(maxWidth, preferredWidth);
    let fittedHeight = fittedWidth / aspectRatio;

    if (fittedHeight > maxHeight) {
      fittedHeight = maxHeight;
      fittedWidth = fittedHeight * aspectRatio;
    }

    setStageDimensions({
      width: Math.round(fittedWidth),
      height: Math.round(fittedHeight),
    });
  }

  function resetLoadedVideoState() {
    setDuration(0);
    setVideoAspect("16 / 9");
    setVideoOrientation("landscape");
    setVideoDimensions({ width: 16, height: 9 });
    setStageDimensions({ width: 320, height: 180 });
    setTimelineValue(0);
    setPlaybackRate(0.5);
    setIsPlaying(false);
    setExportState("idle");
    setExportProgress(0);
    setVideoError("");
    setDetectState("idle");
    setDetectProgress(0);
    setDetectConfidence(null);
    setDetectStage("Waiting for impact point.");
    setDetectStats(null);
    setDetectPoints([]);
    setAutoTracePoints([]);
    setSwingAssistState("idle");
    setSwingAssistProgress(0);
    setSwingWindow(null);
    setImpactTime(null);
    setImpactFrame(null);
    setLandingFrame(null);
    setStartPoint(null);
    setLaunchPoint(null);
    setApexPoint(null);
    setCarryPoint(null);
    setEndPoint(null);
    setPlacementMode(null);
    setSelectedHandle(null);
    setEditingTrace(false);
    sampleSeedAppliedRef.current = false;
    sampleAutoRunPendingRef.current = false;
    swingAssistAutoRunRef.current = false;
  }

  function loadVideoSource(nextUrl, nextName, mode, revokeExisting = true) {
    if (sourceUrl && revokeExisting) URL.revokeObjectURL(sourceUrl);

    setSourceUrl(nextUrl);
    setSourceName(nextName);
    setSourceMode(mode);
    resetLoadedVideoState();
    setWorkflowMode("course_quick");
    setStatus("Video loaded. Quick Trace is the fastest path on the course: scrub to contact, mark the ball, then mark landing.");
  }

  function activateQuickTrace() {
    setWorkflowMode("course_quick");
    setCameraProfile("wide_fairway");
    setShowTrackingLab(false);
    setDetectState("idle");
    setDetectProgress(0);
    setDetectConfidence(null);
    setDetectStage("Quick Trace mode is active. Mark the ball first, then mark landing.");
    setDetectStats(null);
    setDetectPoints([]);
    setAutoTracePoints([]);
    setStatus("Quick Trace mode is active. Scrub to impact, mark the ball, then mark landing. Auto detect is optional after that.");
  }

  function activateAssistMode() {
    setWorkflowMode("assist");
    setShowTrackingLab(true);
    setStatus("Assist mode is active. Use swing window and auto detect if this clip is clean enough for analysis.");
  }

  function syncVideoPreview() {
    const video = videoRef.current;
    const canvas = previewCanvasRef.current;
    if (!video || !canvas || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return false;

    const context = canvas.getContext("2d");
    if (!context) return false;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return true;
  }

  function scheduleVideoPreview() {
    if (previewRafRef.current) cancelAnimationFrame(previewRafRef.current);
    const paint = () => {
      if (syncVideoPreview()) {
        previewRafRef.current = 0;
        return;
      }

      if (videoRef.current?.readyState < 2) {
        previewRafRef.current = requestAnimationFrame(paint);
        return;
      }

      previewRafRef.current = 0;
    };

    previewRafRef.current = requestAnimationFrame(paint);
  }

  function startPreviewLoop() {
    if (previewRafRef.current) cancelAnimationFrame(previewRafRef.current);
    const tick = () => {
      syncVideoPreview();
      if (videoRef.current && !videoRef.current.paused) {
        previewRafRef.current = requestAnimationFrame(tick);
      } else {
        previewRafRef.current = 0;
      }
    };
    previewRafRef.current = requestAnimationFrame(tick);
  }

  async function runSwingWindowAssist(trigger = "manual", aroundTime = null) {
    if (!sourceUrl || swingAssistState === "running") return;

    setSwingAssistState("running");
    setSwingAssistProgress(0);
    setSwingWindow(null);
    setStatus("Scanning the clip for the strongest swing motion so you do not have to scrub through dead time.");

    try {
      const analysisVideo = document.createElement("video");
      analysisVideo.src = sourceUrl;
      analysisVideo.preload = "auto";
      analysisVideo.muted = true;
      analysisVideo.playsInline = true;

      await loadVideoMetadata(analysisVideo);

      const result = await findSwingWindow(analysisVideo, ({ progress }) => {
        setSwingAssistProgress(progress);
      }, { aroundTime });

      setSwingAssistState("done");
      setSwingAssistProgress(100);
      setSwingWindow(result);
      setTimelineValue(result.impactGuess);

      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = result.impactGuess;
      }

      setStatus(
        result.montageLikely
          ? "Swing window found, but this upload looks like a multi-shot reel. The app jumped to the strongest swing section first."
          : trigger === "auto"
            ? "Swing window found automatically. You are parked near impact now, so marking the ball should be much faster."
            : aroundTime != null
              ? "Swing window refined around your current scrub position. You should be much closer to the exact swing you want to trace."
              : "Swing window found. You are parked near impact now, so you can start tracing without scrubbing the whole video."
      );
    } catch (error) {
      setSwingAssistState("error");
      setSwingAssistProgress(0);
      setStatus("Swing window assist could not isolate the shot on this clip. You can still scrub manually and trace it.");
    }
  }

  function jumpToSuggestedImpact() {
    if (!swingWindow || !videoRef.current) return;

    videoRef.current.pause();
    videoRef.current.currentTime = swingWindow.impactGuess;
    setTimelineValue(swingWindow.impactGuess);
    setStatus("Jumped to the suggested impact area. Fine tune with Frame +/- and then mark the ball.");
  }

  function refineSwingWindowAroundCurrentTime() {
    runSwingWindowAssist("manual", timelineValue);
  }

  function handleVideoSelect(event, mode) {
    const [file] = event.target.files || [];
    if (!file) return;

    loadVideoSource(URL.createObjectURL(file), file.name, mode);
    event.target.value = "";
  }

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      await video.play().catch(() => {
        setStatus("Safari blocked autoplay. Tap the native video play button once, then use the app controls.");
      });
      return;
    }
    video.pause();
  }

  function jumpToImpact() {
    if (impactTime == null || !videoRef.current) return;
    videoRef.current.currentTime = impactTime;
    setTimelineValue(impactTime);
  }

  function replayTrace() {
    if (impactTime == null || !videoRef.current) return;
    setSelectedHandle(null);
    videoRef.current.currentTime = impactTime;
    setTimelineValue(impactTime);
    videoRef.current.playbackRate = playbackRate;
    videoRef.current.play().catch(() => {});
  }

  function stepFrame(direction) {
    const video = videoRef.current;
    if (!video) return;

    const nextFrame = Math.max(0, Math.round(video.currentTime * fps) + direction);
    const nextTime = clamp(nextFrame / fps, 0, duration || video.duration || 0);
    video.pause();
    video.currentTime = nextTime;
    setTimelineValue(nextTime);
  }

  function getFrameContentRect() {
    const frameBounds = videoFrameRef.current?.getBoundingClientRect();
    if (!frameBounds) return null;
    return frameBounds;
  }

  function updateFrameViewport() {
    setFrameViewport({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
    });
  }

  function mapLogicalPointToStagePoint(point) {
    if (!point) return { x: 0, y: 0 };

    return {
      x: clamp(point.x, 0, 100),
      y: clamp(point.y, TRACE_TOP, 100),
    };
  }

  function getOverlayPoint(event, zone = "frame") {
    const bounds = zone === "shape" ? overlayRef.current?.getBoundingClientRect() : getFrameContentRect();
    if (!bounds) {
      return { x: 0, y: 0 };
    }

    const rawX = ((event.clientX - bounds.left) / bounds.width) * 100;
    const rawY = ((event.clientY - bounds.top) / bounds.height) * 100;

    return {
      x: clamp(rawX, 0, 100),
      y: clamp(rawY, TRACE_TOP, TRACE_BOTTOM),
    };
  }

  function beginImpactPlacement() {
    setDetectState("idle");
    setDetectProgress(0);
    setDetectConfidence(null);
    setDetectStage("Waiting for a new impact point.");
    setDetectStats(null);
    setDetectPoints([]);
    setAutoTracePoints([]);
    setStartPoint(null);
    setLaunchPoint(null);
    setApexPoint(null);
    setCarryPoint(null);
    setEndPoint(null);
    setLandingFrame(null);
    setPlacementMode("start");
    setSelectedHandle(null);
    setStatus("Tap directly on the ball inside the visible video frame. The app now locks placement to the actual video area.");
  }

  function handleOverlayPointerDown(event) {
    if (!overlayRef.current) return;

    if (placementMode === "start") {
      const point = getOverlayPoint(event, "frame");
      const time = videoRef.current?.currentTime ?? timelineValue;
      setDetectState("idle");
      setDetectProgress(0);
      setDetectConfidence(null);
      setImpactTime(time);
      setImpactFrame(Math.round(time * fps));
      setStartPoint(point);
      setLaunchPoint(null);
      setApexPoint(null);
      setCarryPoint(null);
      setDetectStats(null);
      setDetectPoints([]);
      setAutoTracePoints([]);
      setPlacementMode(null);
      setSelectedHandle("start");
      setEditingTrace(true);
      setStatus("Start point locked. Step 2: scrub forward, tap Mark Landing, then tap where the ball lands or disappears.");
      return;
    }

    if (placementMode === "end") {
      const point = getOverlayPoint(event, "frame");
      const time = videoRef.current?.currentTime ?? timelineValue;
      const flightTime = startPoint ? estimateFlightTime(startPoint, point, curveSettings.ballSpeed) : 1.25;
      setEndPoint(point);
      if (startPoint) {
        const nextApex = apexPoint || defaultApexFromShot(startPoint, point);
        const controls = buildDefaultShapeControls(startPoint, nextApex, point);
        setApexPoint(nextApex);
        setLaunchPoint(controls.launchPoint);
        setCarryPoint(controls.carryPoint);
      }
      setLandingFrame(Math.round(time * fps));
      setCurveSettings((current) => ({ ...current, flightTime }));
      setAutoTracePoints([]);
      setPlacementMode(null);
      setSelectedHandle("end");
      setEditingTrace(false);
      setStatus("Trace is ready. Drag the flight dots to shape launch, height, carry, and finish.");
      return;
    }

    if (placementMode === "apex") {
      const point = getOverlayPoint(event, "shape");
      setApexPoint(point);
      setPlacementMode(null);
      setSelectedHandle("apex");
      setEditingTrace(true);
      setStatus(endPoint ? "Apex updated. Replay or export when the arc matches the shot." : "Apex saved. Now set the landing point.");
    }
  }

  function beginDrag(event, handle) {
    event.stopPropagation();
    dragRef.current = handle;
    setSelectedHandle(handle);
    setEditingTrace(true);
  }

  function moveDraggedHandle(event) {
    if (!dragRef.current || !overlayRef.current) return;

    const point = getOverlayPoint(event, dragRef.current === "apex" ? "shape" : "frame");
    if (dragRef.current === "start") {
      setDetectState("idle");
      setDetectProgress(0);
      setDetectConfidence(null);
      setDetectStage("Impact point moved. Auto detect is ready to re-run from the new ball position.");
      setDetectStats(null);
      setDetectPoints([]);
      setAutoTracePoints([]);
      const nextPoint = constrainHandlePoint("start", point, { startPoint, launchPoint, apexPoint, carryPoint, endPoint });
      setStartPoint(nextPoint);
      if (apexPoint && endPoint) {
        const controls = buildDefaultShapeControls(nextPoint, apexPoint, endPoint);
        setLaunchPoint(controls.launchPoint);
        setCarryPoint(controls.carryPoint);
      }
      return;
    }
    if (dragRef.current === "launch") {
      setAutoTracePoints([]);
      setLaunchPoint(constrainHandlePoint("launch", point, { startPoint, launchPoint, apexPoint, carryPoint, endPoint }));
      return;
    }
    if (dragRef.current === "apex") {
      setAutoTracePoints([]);
      const nextPoint = constrainHandlePoint("apex", point, { startPoint, launchPoint, apexPoint, carryPoint, endPoint });
      setApexPoint(nextPoint);
      if (startPoint && endPoint) {
        const controls = buildDefaultShapeControls(startPoint, nextPoint, endPoint);
        setLaunchPoint((current) => current || controls.launchPoint);
        setCarryPoint((current) => current || controls.carryPoint);
      }
      return;
    }
    if (dragRef.current === "carry") {
      setAutoTracePoints([]);
      setCarryPoint(constrainHandlePoint("carry", point, { startPoint, launchPoint, apexPoint, carryPoint, endPoint }));
      return;
    }
    if (dragRef.current === "end") {
      setAutoTracePoints([]);
      const nextPoint = constrainHandlePoint("end", point, { startPoint, launchPoint, apexPoint, carryPoint, endPoint });
      setEndPoint(nextPoint);
      if (startPoint && apexPoint) {
        const controls = buildDefaultShapeControls(startPoint, apexPoint, nextPoint);
        setLaunchPoint((current) => current || controls.launchPoint);
        setCarryPoint((current) => current || controls.carryPoint);
      }
      return;
    }
  }

  function stopDrag() {
    dragRef.current = null;
  }

  function resetTrace() {
    setDetectState("idle");
    setDetectProgress(0);
    setDetectConfidence(null);
    setDetectStage("Waiting for impact point.");
    setDetectStats(null);
    setDetectPoints([]);
    setAutoTracePoints([]);
    setImpactTime(null);
    setImpactFrame(null);
    setLandingFrame(null);
    setStartPoint(null);
    setLaunchPoint(null);
    setApexPoint(null);
    setCarryPoint(null);
    setEndPoint(null);
    setPlacementMode(null);
    setSelectedHandle(null);
    setEditingTrace(false);
    setStatus("Trace reset. Scrub to impact and place the start, apex, and landing points again.");
  }

  async function runTrackAssistBeta() {
    if (!sourceUrl || !startPoint || impactTime == null || detectState === "running") return;

    setDetectState("running");
    setDetectProgress(0);
    setDetectConfidence(null);
    setDetectStage("Preparing video frames...");
    setDetectStats(null);
    setDetectPoints([]);
    setAutoTracePoints([]);
    setPlacementMode(null);
    setSelectedHandle(null);
    setStatus("Track Assist Beta is starting from your marked ball and following the first part of the flight.");

    try {
      const analysisVideo = document.createElement("video");
      analysisVideo.src = sourceUrl;
      analysisVideo.preload = "auto";
      analysisVideo.muted = true;
      analysisVideo.playsInline = true;

      await loadVideoMetadata(analysisVideo);

      const result = await trackBallFromSeed(analysisVideo, { impactTime, startPoint, profile: CAMERA_PROFILES[cameraProfile] }, ({ progress, stage }) => {
        setDetectProgress(progress);
        if (stage) setDetectStage(stage);
      });

      const nextLandingFrame = Math.max(impactFrame ?? 0, Math.round(result.landingTime * fps));
      const nextControls = buildDefaultShapeControls(startPoint, result.apexPoint, result.endPoint);
      setLaunchPoint(nextControls.launchPoint);
      setApexPoint(result.apexPoint);
      setCarryPoint(nextControls.carryPoint);
      setEndPoint(result.endPoint);
      setLandingFrame(nextLandingFrame);
      setCurveSettings((current) => ({
        ...current,
        flightTime: result.flightTime,
      }));
      setDetectConfidence(result.confidence);
      setDetectStage(result.stage);
      setDetectStats({
        framesScanned: result.framesScanned,
        detectionsFound: result.detectionsFound,
      });
      setDetectPoints(result.debugPoints);
      setAutoTracePoints(result.tracePoints);
      setDetectState("done");
      setDetectProgress(100);
      setSelectedHandle("apex");
      setEditingTrace(false);
      setTimelineValue(impactTime);

      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = impactTime;
      }

      setStatus(
        result.confidence >= 68
          ? "Track Assist Beta found a solid first arc from your marked ball. Replay it, then drag any dot if it needs tuning."
          : "Track Assist Beta found a rough first arc. Keep the start point, then drag apex and landing to clean it up."
      );
    } catch (error) {
      setDetectState("error");
      setDetectProgress(0);
      setDetectStage("Analysis stopped before a usable flight path was found.");
      setDetectPoints([]);
      setAutoTracePoints([]);
      setStatus("Track Assist Beta could not hold the ball on this clip. Keep using Mark Landing manually, or try a tighter/steadier clip.");
    }
  }

  function handleTrackAssistPress() {
    if (!sourceUrl) {
      setStatus("Upload or record a swing first.");
      return;
    }

    if (!startPoint || impactTime == null) {
      beginImpactPlacement();
      return;
    }

    runTrackAssistBeta();
  }

  async function exportTracerSnapshot() {
    const video = videoRef.current;
    if (!video || !readyToTrace) return;

    const canvas = document.createElement("canvas");
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(video, 0, 0, width, height);
    context.strokeStyle = "#f07a24";
    context.shadowColor = "rgba(109, 52, 14, 0.9)";
    context.shadowBlur = Math.max(18, width * 0.016);
    context.lineWidth = Math.max(8, width * 0.006);
    context.lineCap = "round";
    context.lineJoin = "round";
    drawSmoothCanvasPath(context, fullTracePoints, width, height);

    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = url;
    link.download = "ifonlyicouldputt-shot-tracer.png";
    link.click();
  }

  async function exportTracerVideo() {
    const video = videoRef.current;
    if (!video || !readyToTrace) return;

    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
      setExportState("error");
      setStatus("This browser cannot export a video from the web app. Try desktop Chrome/Safari, or use Export Still as a backup.");
      return;
    }

    const canvas = document.createElement("canvas");
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) return;

    const stream = canvas.captureStream(30);
    const mimeType = getBestRecordingMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks = [];
    const exportStart = Math.max(0, impactTime - 0.45);
    const exportEnd = Math.min(duration || video.duration || flightEndTime + 1, flightEndTime + 1.25);
    const restoreTime = video.currentTime;
    const restoreRate = video.playbackRate;
    const restoreMuted = video.muted;

    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data);
    };

    setExportState("recording");
    setExportProgress(0);
    setStatus("Exporting tracer video. Keep this tab open while the replay is recorded.");

    await seekVideo(video, exportStart);
    video.muted = true;
    video.playbackRate = 1;

    const blobPromise = new Promise((resolve, reject) => {
      recorder.onerror = () => reject(new Error("Video recorder failed."));
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || "video/webm" }));
    });

    let animationFrame = 0;
    const drawFrame = () => {
      const time = video.currentTime;
      drawExportFrame(context, video, fullTracePoints, {
        width,
        height,
        time,
        impactTime,
        flightTime: curveSettings.flightTime,
        glow: curveSettings.glow,
      });

      const progress = clamp((time - exportStart) / Math.max(exportEnd - exportStart, 0.01), 0, 1);
      setExportProgress(Math.round(progress * 100));

      if (time >= exportEnd || video.ended) {
        video.pause();
        if (recorder.state !== "inactive") recorder.stop();
        return;
      }

      animationFrame = requestAnimationFrame(drawFrame);
    };

    try {
      recorder.start(250);
      await video.play();
      drawFrame();
      const blob = await blobPromise;
      cancelAnimationFrame(animationFrame);
      await seekVideo(video, restoreTime);
      video.playbackRate = restoreRate;
      video.muted = restoreMuted;
      setTimelineValue(restoreTime);

      if (!blob.size) throw new Error("Empty export.");

      const extension = blob.type.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `ifonlyicouldputt-shot-tracer.${extension}`, { type: blob.type });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "ifonlyicouldputt shot tracer",
          text: "Shot tracer replay by ifonlyicouldputt",
          files: [file],
        });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        link.click();
        URL.revokeObjectURL(url);
      }

      setExportState("done");
      setExportProgress(100);
      setStatus("Tracer video exported. If your phone downloaded a WebM, upload from desktop or use Safari/Chrome depending on which format your device supports.");
    } catch (error) {
      console.error(error);
      cancelAnimationFrame(animationFrame);
      if (recorder.state !== "inactive") recorder.stop();
      video.pause();
      video.playbackRate = restoreRate;
      video.muted = restoreMuted;
      setExportState("error");
      setStatus("Video export failed in this browser. The tracer still works, but this device may block browser video recording.");
    }
  }

  return (
    <main className={editorOpen ? "site-shell editor-open" : "site-shell tracer-shell"}>
      <header className="brand-nav tracer-nav">
        <a className="wordmark" href="#tracker" aria-label="ifonlyicouldputt tracer">ifonlyicouldputt</a>
        <nav className="nav-links" aria-label="Primary navigation">
          <a href="#tracker">Tracer</a>
          <a href="mailto:ifonlyicouldputt@icloud.com">Contact</a>
        </nav>
      </header>

      {!editorOpen ? (
        <section className="tool-home">
          <div className="tool-home-copy">
            <span>Shot tracer</span>
            <h1>Build the tracer fast.</h1>
            <p>
              Upload a golf video, mark impact, mark landing, shape the flight, and replay it. No extra clutter.
            </p>
          </div>

          <div className="tool-home-actions">
            <button className="primary-button" type="button" onClick={() => uploadInputRef.current?.click()}>
              Upload Swing Video
            </button>
            <button className="secondary-button record-button" type="button" onClick={() => liveInputRef.current?.click()}>
              Record Live Swing
            </button>
            <input ref={liveInputRef} className="sr-only" type="file" accept="video/*" capture="environment" onChange={(event) => handleVideoSelect(event, "live")} />
            <input ref={uploadInputRef} className="sr-only" type="file" accept="video/*" onChange={(event) => handleVideoSelect(event, "upload")} />
          </div>

          <div className="tool-home-steps">
            <div><span>01</span><strong>Mark impact</strong></div>
            <div><span>02</span><strong>Mark landing</strong></div>
            <div><span>03</span><strong>Shape and replay</strong></div>
          </div>
        </section>
      ) : null}

      <section id="tracker" className={editorOpen ? "tracker-section editor-open tracer-app-open" : "tracker-section"}>
        {editorOpen ? (
          <div className="course-editor">
            <div className="course-editor-head">
              <div>
                <span>Tracer workspace</span>
                <h2>Impact. Landing. Shape.</h2>
                <p>{status}</p>
              </div>
              <div className="course-editor-stats">
                <span>{formatTime(timelineValue)} / {formatTime(duration)}</span>
                <strong>{playbackRate}x</strong>
              </div>
            </div>

            <div className="course-editor-stage">
              <div
                className={[
                  "video-stage",
                  "course-stage",
                  shapeMode ? "shape-mode" : "",
                  videoOrientation === "portrait" ? "portrait-stage" : "landscape-stage",
                ].filter(Boolean).join(" ")}
                style={{
                  "--video-aspect": videoAspect,
                  width: `${stageDimensions.width}px`,
                  height: `${stageDimensions.height}px`,
                }}
              >
                <div ref={videoFrameRef} className="video-frame">
                  <video
                    ref={videoRef}
                    className="tracer-video"
                    src={sourceUrl}
                    playsInline
                    preload="metadata"
                    controls={false}
                    onLoadedMetadata={(event) => {
                      const nextDuration = event.currentTarget.duration || 0;
                      const width = event.currentTarget.videoWidth || 16;
                      const height = event.currentTarget.videoHeight || 9;
                      setDuration(nextDuration);
                      setVideoAspect(`${width} / ${height}`);
                      setVideoOrientation(height > width ? "portrait" : "landscape");
                      setVideoDimensions({ width, height });
                      syncStageDimensions(width, height);
                      setTimelineValue(0);
                      event.currentTarget.playbackRate = playbackRate;
                      if (modeLooksLikeCourseClip(nextDuration, width, height, sourceMode)) {
                        setWorkflowMode("course_quick");
                        setCameraProfile("wide_fairway");
                        setShowTrackingLab(false);
                        setStatus("Course clip loaded. Start with Quick Trace: scrub to impact, mark the ball, then mark landing.");
                      } else {
                        setStatus("Video loaded. Scrub to the exact contact frame, then tap Mark Impact + Ball and place the dot on the ball.");
                      }
                      requestAnimationFrame(() => updateFrameViewport());
                    }}
                    onLoadedData={() => {
                      scheduleVideoPreview();
                    }}
                    onCanPlay={() => {
                      scheduleVideoPreview();
                    }}
                    onSeeked={() => {
                      scheduleVideoPreview();
                    }}
                    onTimeUpdate={(event) => {
                      setTimelineValue(event.currentTarget.currentTime);
                      scheduleVideoPreview();
                    }}
                    onPlay={() => {
                      setIsPlaying(true);
                      startPreviewLoop();
                    }}
                    onPause={() => {
                      setIsPlaying(false);
                      scheduleVideoPreview();
                    }}
                    onError={() => {
                      setVideoError("This video format is not loading in this browser. If it is an iPhone HEVC .MOV, try exporting as H.264 MP4.");
                      setStatus("The video could not load here. The tracer works best with H.264 MP4 or Safari-compatible MOV files.");
                    }}
                  />
                </div>
                <div
                  ref={overlayRef}
                  className={placementMode ? "trace-overlay placing" : "trace-overlay"}
                  onPointerDown={handleOverlayPointerDown}
                  onPointerMove={moveDraggedHandle}
                  onPointerUp={stopDrag}
                  onPointerCancel={stopDrag}
                  onPointerLeave={stopDrag}
                >
                  <svg className="trace-svg" viewBox={`0 ${TRACE_TOP} 100 ${TRACE_BOTTOM - TRACE_TOP}`} preserveAspectRatio="none">
                    {!cinematicReplay && showTrackingLab && stageDetectPoints.map((point, index) => (
                      <circle
                        key={`${point.type}-${index}`}
                        cx={point.x}
                        cy={point.y}
                        r={point.type === "projected" ? 0.48 : 0.62}
                        className={point.type === "projected" ? "track-point projected" : "track-point detected"}
                      />
                    ))}
                    {!cinematicReplay && editingTrace && guidePath ? <path d={guidePath} className="trace-guide" /> : null}
                    {tracePath ? (
                      <>
                        <path d={tracePath} className="trace-line-shadow" style={{ "--trace-glow": `${curveSettings.glow / 100}` }} />
                        <path d={tracePath} className="trace-line" style={{ "--trace-glow": `${curveSettings.glow / 100}` }} />
                      </>
                    ) : null}
                    {!cinematicReplay && !editingTrace && readyToTrace && traceTelemetry && stageApexPoint ? (
                      <TraceTag point={{ x: stageApexPoint.x + 2.5, y: Math.max(stageApexPoint.y - 10, 8) }} tone="cool" label="APEX" value={traceTelemetry.apexLabel} />
                    ) : null}
                    {!cinematicReplay && !editingTrace && readyToTrace && traceTelemetry && stageStartPoint ? (
                      <TraceTag point={{ x: Math.max(stageStartPoint.x - 1, 14), y: Math.min(stageStartPoint.y + 9, 92) }} tone="warm" label="BALL SPEED" value={traceTelemetry.speedLabel} />
                    ) : null}
                    {!cinematicReplay && !editingTrace && readyToTrace && traceTelemetry && stageCarryPoint ? (
                      <TraceTag point={{ x: Math.min(stageCarryPoint.x + 6, 87), y: Math.min(stageCarryPoint.y + 4, 92) }} tone="cool" label="CARRY" value={traceTelemetry.carryLabel} />
                    ) : null}
                    {!cinematicReplay && showTraceHandles && stageStartPoint ? <TraceHandle point={stageStartPoint} type="start" active={selectedHandle === "start"} onPointerDown={(event) => beginDrag(event, "start")} /> : null}
                    {!cinematicReplay && showTraceHandles && stageLaunchPoint ? <TraceHandle point={stageLaunchPoint} type="launch" active={selectedHandle === "launch"} onPointerDown={(event) => beginDrag(event, "launch")} /> : null}
                    {!cinematicReplay && showTraceHandles && stageApexPoint ? <TraceHandle point={stageApexPoint} type="apex" active={selectedHandle === "apex"} onPointerDown={(event) => beginDrag(event, "apex")} /> : null}
                    {!cinematicReplay && showTraceHandles && stageCarryPoint ? <TraceHandle point={stageCarryPoint} type="carry" active={selectedHandle === "carry"} onPointerDown={(event) => beginDrag(event, "carry")} /> : null}
                    {!cinematicReplay && showTraceHandles && stageEndPoint ? <TraceHandle point={stageEndPoint} type="end" active={selectedHandle === "end"} onPointerDown={(event) => beginDrag(event, "end")} /> : null}
                  </svg>
                  {placementMode ? (
                    <div className="placement-banner">
                      <strong>{placementMode === "start" ? "Tap the ball at impact" : placementMode === "end" ? "Tap the landing point" : "Tap the apex point"}</strong>
                      <span>{placementMode === "end" ? "If the ball leaves frame, tap where it disappeared." : "The app is locked to the visible video area only."}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {videoError ? <div className="notice error">{videoError}</div> : null}

            <div className="course-editor-controls">
              <div className="transport-panel course-transport">
                <button className="secondary-button" type="button" onClick={togglePlayback} disabled={!sourceUrl}>{isPlaying ? "Pause" : "Play"}</button>
                <button className="secondary-button" type="button" onClick={() => stepFrame(-1)} disabled={!sourceUrl}>Frame -</button>
                <button className="secondary-button" type="button" onClick={() => stepFrame(1)} disabled={!sourceUrl}>Frame +</button>
                <button className="secondary-button" type="button" onClick={() => setEditingTrace((current) => !current)} disabled={!readyToTrace}>
                  {editingTrace ? "Preview Trace" : "Edit Trace"}
                </button>
                <button className="primary-button" type="button" onClick={replayTrace} disabled={!readyToTrace}>Replay Trace</button>
              </div>

              <label className="field timeline-field">
                <div className="range-row">
                  <span>{formatTime(timelineValue)}</span>
                  <strong>{formatTime(duration)}</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  step="0.01"
                  value={timelineValue}
                  onInput={(event) => {
                    const nextValue = Number(event.target.value);
                    setTimelineValue(nextValue);
                    if (videoRef.current) videoRef.current.currentTime = nextValue;
                  }}
                />
              </label>

              <div className="course-step-grid">
                <button className="instruction-card active" type="button" onClick={beginImpactPlacement}>
                  <span>01</span>
                  <h3>Mark Impact</h3>
                  <p>Tap the ball at contact.</p>
                </button>
                <button
                  className={startPoint ? "instruction-card active" : "instruction-card"}
                  type="button"
                  disabled={!startPoint}
                  onClick={() => {
                    setSelectedHandle(null);
                    setPlacementMode("end");
                    setStatus("Tap the landing point inside the visible video frame. If the ball leaves frame, tap where it disappeared.");
                  }}
                >
                  <span>02</span>
                  <h3>Mark Landing</h3>
                  <p>Tap where the shot ends.</p>
                </button>
                <button
                  className={readyToTrace ? "instruction-card active" : "instruction-card"}
                  type="button"
                  disabled={!startPoint}
                  onClick={() => {
                    setPlacementMode("apex");
                    setStatus("Tap the highest point of the tracer arc.");
                  }}
                >
                  <span>03</span>
                  <h3>Shape Arc</h3>
                  <p>Set the flight height.</p>
                </button>
              </div>

              <div className="course-editor-actions">
                <button className="primary-button record-button" type="button" onClick={() => liveInputRef.current?.click()}>Record Live Swing</button>
                <button className="secondary-button" type="button" onClick={() => uploadInputRef.current?.click()}>Upload New Video</button>
                <button className="secondary-button" type="button" onClick={resetTrace} disabled={!startPoint && !apexPoint && !endPoint}>Reset Trace</button>
                <button className="secondary-button" type="button" disabled={detectState === "running"} onClick={handleTrackAssistPress}>
                  {detectState === "running" ? `Auto Detect ${detectProgress}%` : "Auto Detect"}
                </button>
                <input ref={liveInputRef} className="sr-only" type="file" accept="video/*" capture="environment" onChange={(event) => handleVideoSelect(event, "live")} />
                <input ref={uploadInputRef} className="sr-only" type="file" accept="video/*" onChange={(event) => handleVideoSelect(event, "upload")} />
              </div>

              <details className="advanced-tools">
                <summary>Advanced</summary>
                <div className="advanced-grid">
                  <div className="quick-trace-panel">
                    <div className="range-row">
                      <span>Workflow</span>
                      <strong>{workflowMode === "course_quick" ? "Quick Trace" : "Assist"}</strong>
                    </div>
                    <div className="tiny-grid">
                      <button className={workflowMode === "course_quick" ? "secondary-button active-lab" : "secondary-button"} type="button" onClick={activateQuickTrace}>Quick Trace</button>
                      <button className={workflowMode === "assist" ? "secondary-button active-lab" : "secondary-button"} type="button" onClick={activateAssistMode}>Assist Mode</button>
                      <button className="secondary-button" type="button" disabled={!sourceUrl || swingAssistState === "running"} onClick={() => runSwingWindowAssist("manual")}>
                        {swingAssistState === "running" ? `Finding Swing ${swingAssistProgress}%` : "Find Swing Window"}
                      </button>
                      <button className="secondary-button" type="button" onClick={() => setShowTrackingLab((current) => !current)}>
                        {showTrackingLab ? "Hide Tracking Lab" : "Show Tracking Lab"}
                      </button>
                    </div>
                  </div>

                  <div className="shape-panel">
                    <RangeField label="Ball speed" value={curveSettings.ballSpeed} min={20} max={100} disabled={!readyToTrace} onChange={(value) => setCurveSettings((current) => ({ ...current, ballSpeed: value, flightTime: startPoint && endPoint ? estimateFlightTime(startPoint, endPoint, value) : current.flightTime }))} />
                    <RangeField label="Tracer glow" value={curveSettings.glow} min={20} max={100} disabled={!readyToTrace} onChange={(value) => setCurveSettings((current) => ({ ...current, glow: value }))} />
                  </div>
                </div>
              </details>
            </div>
          </div>
        ) : (
        <>
        <div className="tracker-head">
          <div>
            <span>Tracer workspace</span>
            <h2>{editorOpen ? "Mark it. Shape it. Replay it." : "Simple golf tracer."}</h2>
            <p>{status}</p>
          </div>
          <div className="tracker-metrics">
            <div><span>Frame</span><strong>{currentFrame}</strong></div>
            <div><span>Speed</span><strong>{playbackRate}x</strong></div>
            <div><span>Mode</span><strong>{sourceMode === "live" ? "Live" : "Upload"}</strong></div>
            <div><span>Assist</span><strong>{detectConfidence == null ? "--" : `${detectConfidence}%`}</strong></div>
          </div>
        </div>

        <div className="studio-card">
          <div className="stepper" aria-label="Shot tracer steps">
            {STEPS.map((step) => (
              <button
                key={step.id}
                type="button"
                className={activeStep >= step.id ? "step-button active" : "step-button"}
                disabled
              >
                <span>{step.label}</span>
                <strong>{step.title}</strong>
              </button>
            ))}
          </div>

          <div className={placementFocusMode ? "studio-layout placement-focus" : "studio-layout"}>
            <section className={placementFocusMode ? "video-column placement-focus" : "video-column"}>
              <div
                className={[
                  "video-stage",
                  shapeMode ? "shape-mode" : "",
                  videoOrientation === "portrait" ? "portrait-stage" : "landscape-stage",
                ].filter(Boolean).join(" ")}
                style={{
                  "--video-aspect": videoAspect,
                  width: `${stageDimensions.width}px`,
                  height: `${stageDimensions.height}px`,
                }}
              >
                {sourceUrl ? (
                  <>
                    <div ref={videoFrameRef} className="video-frame">
                      <video
                        ref={videoRef}
                        className="tracer-video"
                        src={sourceUrl}
                        playsInline
                        preload="metadata"
                        controls={false}
                        onLoadedMetadata={(event) => {
                          const nextDuration = event.currentTarget.duration || 0;
                          const width = event.currentTarget.videoWidth || 16;
                          const height = event.currentTarget.videoHeight || 9;
                          setDuration(nextDuration);
                          setVideoAspect(`${width} / ${height}`);
                          setVideoOrientation(height > width ? "portrait" : "landscape");
                          setTimelineValue(0);
                          event.currentTarget.playbackRate = playbackRate;
                          if (modeLooksLikeCourseClip(nextDuration, width, height, sourceMode)) {
                            setWorkflowMode("course_quick");
                            setCameraProfile("wide_fairway");
                            setShowTrackingLab(false);
                            setStatus("Course clip loaded. Start with Quick Trace: scrub to impact, mark the ball, then mark landing.");
                          } else {
                            setStatus("Video loaded. Scrub to the exact contact frame, then tap Mark Impact + Ball and place the dot on the ball.");
                          }
                          requestAnimationFrame(() => updateFrameViewport());
                          requestAnimationFrame(() => syncVideoPreview());
                        }}
                        onLoadedData={() => {
                          scheduleVideoPreview();
                        }}
                        onCanPlay={() => {
                          scheduleVideoPreview();
                        }}
                        onSeeked={() => {
                          scheduleVideoPreview();
                        }}
                        onTimeUpdate={(event) => {
                          setTimelineValue(event.currentTarget.currentTime);
                          scheduleVideoPreview();
                        }}
                        onPlay={() => {
                          setIsPlaying(true);
                          startPreviewLoop();
                        }}
                        onPause={() => {
                          setIsPlaying(false);
                          scheduleVideoPreview();
                        }}
                        onError={() => {
                          setVideoError("This video format is not loading in this browser. If it is an iPhone HEVC .MOV, try exporting as H.264 MP4.");
                          setStatus("The video could not load here. The tracer works best with H.264 MP4 or Safari-compatible MOV files.");
                        }}
                      />
                    </div>
                    <div
                      ref={overlayRef}
                      className={placementMode ? "trace-overlay placing" : "trace-overlay"}
                      onPointerDown={handleOverlayPointerDown}
                      onPointerMove={moveDraggedHandle}
                      onPointerUp={stopDrag}
                      onPointerCancel={stopDrag}
                      onPointerLeave={stopDrag}
                    >
                      <svg className="trace-svg" viewBox={`0 ${TRACE_TOP} 100 ${TRACE_BOTTOM - TRACE_TOP}`} preserveAspectRatio="none">
                        {!cinematicReplay && showTrackingLab && stageDetectPoints.map((point, index) => (
                          <circle
                            key={`${point.type}-${index}`}
                            cx={point.x}
                            cy={point.y}
                            r={point.type === "projected" ? 0.48 : 0.62}
                            className={point.type === "projected" ? "track-point projected" : "track-point detected"}
                          />
                        ))}
                        {!cinematicReplay && editingTrace && guidePath ? <path d={guidePath} className="trace-guide" /> : null}
                        {tracePath ? (
                          <>
                            <path d={tracePath} className="trace-line-shadow" style={{ "--trace-glow": `${curveSettings.glow / 100}` }} />
                            <path d={tracePath} className="trace-line" style={{ "--trace-glow": `${curveSettings.glow / 100}` }} />
                          </>
                        ) : null}
                        {!cinematicReplay && showTraceHandles && stageStartPoint ? <TraceHandle point={stageStartPoint} type="start" active={selectedHandle === "start"} onPointerDown={(event) => beginDrag(event, "start")} /> : null}
                        {!cinematicReplay && showTraceHandles && stageLaunchPoint ? <TraceHandle point={stageLaunchPoint} type="launch" active={selectedHandle === "launch"} onPointerDown={(event) => beginDrag(event, "launch")} /> : null}
                        {!cinematicReplay && showTraceHandles && stageApexPoint ? <TraceHandle point={stageApexPoint} type="apex" active={selectedHandle === "apex"} onPointerDown={(event) => beginDrag(event, "apex")} /> : null}
                        {!cinematicReplay && showTraceHandles && stageCarryPoint ? <TraceHandle point={stageCarryPoint} type="carry" active={selectedHandle === "carry"} onPointerDown={(event) => beginDrag(event, "carry")} /> : null}
                        {!cinematicReplay && showTraceHandles && stageEndPoint ? <TraceHandle point={stageEndPoint} type="end" active={selectedHandle === "end"} onPointerDown={(event) => beginDrag(event, "end")} /> : null}
                      </svg>
                      {placementMode ? (
                        <div className="placement-banner">
                          <strong>{placementMode === "start" ? "Tap the ball at impact" : placementMode === "end" ? "Tap the landing point" : "Tap the apex point"}</strong>
                          <span>{placementMode === "end" ? "If the ball leaves frame, tap where it disappeared." : "The app is locked to the visible video area only."}</span>
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="empty-stage">
                    <div className="camera-guide">
                      <span />
                      <span />
                    </div>
                    <h3>Upload or record a golf swing video.</h3>
                    <p>Use landscape if you can. Tripod and 60fps makes tracing much easier.</p>
                  </div>
                )}
              </div>

              {videoError ? <div className="notice error">{videoError}</div> : null}

              <div className="transport-panel">
                <button className="secondary-button" type="button" onClick={togglePlayback} disabled={!sourceUrl}>{isPlaying ? "Pause" : "Play"}</button>
                <button className="secondary-button" type="button" onClick={() => stepFrame(-1)} disabled={!sourceUrl}>Frame -</button>
                <button className="secondary-button" type="button" onClick={() => stepFrame(1)} disabled={!sourceUrl}>Frame +</button>
                <button className="secondary-button" type="button" onClick={() => setEditingTrace((current) => !current)} disabled={!readyToTrace}>
                  {editingTrace ? "Preview Trace" : "Edit Trace"}
                </button>
                <button className="primary-button" type="button" onClick={replayTrace} disabled={!readyToTrace}>Replay Trace</button>
              </div>

              {sourceUrl ? (
                <label className="field timeline-field">
                  <div className="range-row">
                    <span>{formatTime(timelineValue)}</span>
                    <strong>{formatTime(duration)}</strong>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    step="0.01"
                    value={timelineValue}
                    onInput={(event) => {
                      const nextValue = Number(event.target.value);
                      setTimelineValue(nextValue);
                      if (videoRef.current) videoRef.current.currentTime = nextValue;
                    }}
                  />
                </label>
              ) : null}

              {sourceUrl && swingWindow ? (
                <div className="notice">
                  <strong>Swing window</strong>
                  <span>{`${formatTime(swingWindow.start)} - ${formatTime(swingWindow.end)} · impact guess ${formatTime(swingWindow.impactGuess)}`}</span>
                  {swingWindow.montageLikely ? <span>This clip looks like a reel with multiple swings, so the app focused on the strongest section first.</span> : null}
                </div>
              ) : null}

              {placementFocusMode ? (
                <div className="focus-panel">
                  <div>
                    <span>{placementMode === "start" ? "Impact placement" : "Landing placement"}</span>
                    <strong>{placementMode === "start" ? "Tap the ball inside the large video." : "Tap the finish point inside the large video."}</strong>
                  </div>
                  <button className="secondary-button" type="button" onClick={() => setPlacementMode(null)}>Cancel Placement</button>
                </div>
              ) : null}

              {editorOpen ? (
                <div className="editor-actions">
                  <button className="primary-button record-button" type="button" onClick={() => liveInputRef.current?.click()}>Record Live Swing</button>
                  <button className="secondary-button" type="button" onClick={() => uploadInputRef.current?.click()}>Upload Existing Video</button>
                  <input ref={liveInputRef} className="sr-only" type="file" accept="video/*" capture="environment" onChange={(event) => handleVideoSelect(event, "live")} />
                  <input ref={uploadInputRef} className="sr-only" type="file" accept="video/*" onChange={(event) => handleVideoSelect(event, "upload")} />
                </div>
              ) : null}

              <div className={placementFocusMode ? "notice focus-notice" : "notice"}>
                Smart assist now starts after you mark the ball at impact. That is much more reliable than guessing the whole swing from a huge frame.
              </div>

              {sourceUrl ? (
                <div className="quick-trace-panel">
                  <div className="range-row">
                    <span>Workflow</span>
                    <strong>{workflowMode === "course_quick" ? "Quick Trace" : "Assist"}</strong>
                  </div>
                  <p className="shape-note">
                    On-course clips are usually fastest with manual impact and landing. Use assist only if the video is clean and the ball stays visible.
                  </p>
                  <div className="tiny-grid">
                    <button
                      className={workflowMode === "course_quick" ? "secondary-button active-lab" : "secondary-button"}
                      type="button"
                      onClick={activateQuickTrace}
                    >
                      Quick Trace
                    </button>
                    <button
                      className={workflowMode === "assist" ? "secondary-button active-lab" : "secondary-button"}
                      type="button"
                      onClick={activateAssistMode}
                    >
                      Assist Mode
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={!sourceUrl || swingAssistState === "running"}
                      onClick={() => runSwingWindowAssist("manual")}
                    >
                      {swingAssistState === "running" ? `Finding Swing ${swingAssistProgress}%` : "Find Swing Window"}
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={detectState === "running"}
                      onClick={handleTrackAssistPress}
                    >
                      {detectState === "running" ? `Auto Detect ${detectProgress}%` : "Auto Detect From Ball"}
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="manual-steps">
                <article className={activeStep === 1 ? "instruction-card active" : "instruction-card"}>
                  <span>01</span>
                  <h3>Find impact</h3>
                  <p>Scrub or tap Frame +/- until the club meets the ball.</p>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={!sourceUrl}
                    onClick={beginImpactPlacement}
                  >
                    Mark Impact + Ball
                  </button>
                </article>

                <article className={activeStep === 2 ? "instruction-card active" : "instruction-card"}>
                  <span>02</span>
                  <h3>Set landing</h3>
                  <p>After you mark the ball, either let Track Assist build a first pass or scrub forward and tap the landing point yourself.</p>
                  <div className="tiny-grid">
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={detectState === "running"}
                      onClick={handleTrackAssistPress}
                    >
                      {detectState === "running" ? `Auto Detect ${detectProgress}%` : "Auto Detect From Ball"}
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={!startPoint}
                      onClick={() => {
                        setSelectedHandle(null);
                        setPlacementMode("end");
                        setStatus("Tap the landing point inside the visible video frame. If the ball leaves frame, tap where it disappeared.");
                      }}
                    >
                      Mark Landing
                    </button>
                  </div>
                </article>

                <article className={readyToTrace ? "instruction-card active" : "instruction-card"}>
                  <span>03</span>
                  <h3>Shape the flight</h3>
                  <p>Drag any dot, or tap Mark Apex to set the highest point manually.</p>
                  <div className="tiny-grid">
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={!startPoint}
                      onClick={() => {
                        setPlacementMode("apex");
                        setStatus("Tap the highest point of the tracer arc. This is optional but helps match real ball flight.");
                      }}
                    >
                      Mark Apex
                    </button>
                    <button className="secondary-button" type="button" onClick={jumpToImpact} disabled={!readyToTrace}>Go to Impact</button>
                    <button className="secondary-button" type="button" onClick={resetTrace} disabled={!startPoint && !apexPoint && !endPoint}>Reset</button>
                  </div>
                </article>
              </div>

              {!placementFocusMode ? (
              <details className="advanced-tools">
                <summary>Tracking assist, speed, and export</summary>
                <div className="advanced-grid">
                  <div className="lab-panel">
                    <div className="range-row">
                      <span>Swing window assist</span>
                      <strong>{swingAssistState === "running" ? `${swingAssistProgress}%` : swingWindow ? "Ready" : "Idle"}</strong>
                    </div>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={!sourceUrl || swingAssistState === "running"}
                      onClick={() => runSwingWindowAssist("manual")}
                    >
                      {swingAssistState === "running" ? `Finding Swing ${swingAssistProgress}%` : "Find Swing Window"}
                    </button>
                    <div className="tiny-grid">
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={!hasSuggestedWindow}
                        onClick={jumpToSuggestedImpact}
                      >
                        Go to Impact Guess
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={!hasSuggestedWindow}
                        onClick={beginImpactPlacement}
                      >
                        Mark Ball There
                      </button>
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={!sourceUrl || swingAssistState === "running"}
                        onClick={refineSwingWindowAroundCurrentTime}
                      >
                        Refine Around Here
                      </button>
                    </div>
                    <p className="shape-note">
                      Best for long clips and stitched reels. The app scans for the strongest swing motion and jumps you near contact first.
                    </p>
                  </div>

                  <div className="detect-panel">
                    <div className="range-row">
                      <span>Auto detect assist</span>
                      <strong>{detectConfidence == null ? "Ready" : `${detectConfidence}%`}</strong>
                    </div>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={detectState === "running"}
                      onClick={handleTrackAssistPress}
                    >
                      {detectState === "running" ? `Auto Detect ${detectProgress}%` : "Auto Detect From Ball"}
                    </button>
                    <p className="shape-note">{detectStage}</p>
                    {detectStats ? (
                      <div className="detect-stats">
                        <span>{detectStats.framesScanned} frames scanned</span>
                        <span>{detectStats.detectionsFound} flight hits</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="lab-panel">
                    <div className="range-row">
                      <span>Camera setup</span>
                      <strong>{CAMERA_PROFILES[cameraProfile].label}</strong>
                    </div>
                    <div className="profile-grid">
                      {Object.entries(CAMERA_PROFILES).map(([key, profile]) => (
                        <button
                          key={key}
                          type="button"
                          className={cameraProfile === key ? "profile-pill active" : "profile-pill"}
                          onClick={() => setCameraProfile(key)}
                        >
                          {profile.label}
                        </button>
                      ))}
                    </div>
                    <p className="shape-note">{CAMERA_PROFILES[cameraProfile].detail}</p>
                    <button
                      className={showTrackingLab ? "secondary-button active-lab" : "secondary-button"}
                      type="button"
                      onClick={() => setShowTrackingLab((current) => !current)}
                    >
                      {showTrackingLab ? "Hide Tracking Lab" : "Show Tracking Lab"}
                    </button>
                  </div>

                  <div className="shape-panel">
                    <RangeField label="Ball speed" value={curveSettings.ballSpeed} min={20} max={100} disabled={!readyToTrace} onChange={(value) => setCurveSettings((current) => ({ ...current, ballSpeed: value, flightTime: startPoint && endPoint ? estimateFlightTime(startPoint, endPoint, value) : current.flightTime }))} />
                    <RangeField label="Tracer glow" value={curveSettings.glow} min={20} max={100} disabled={!readyToTrace} onChange={(value) => setCurveSettings((current) => ({ ...current, glow: value }))} />
                    <p className="shape-note">Use all five dots to shape launch, bend, carry, and finish. Use speed for how fast the tracer appears during replay and export.</p>
                  </div>

                  <div className="speed-panel">
                    <div className="range-row">
                      <span>Replay speed</span>
                      <strong>{playbackRate}x</strong>
                    </div>
                    <div className="preset-row">
                      {PLAYBACK_PRESETS.map((preset) => (
                        <button key={preset} type="button" className={preset === playbackRate ? "speed-pill active" : "speed-pill"} onClick={() => setPlaybackRate(preset)}>
                          {preset}x
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="anchor-grid">
                    <div><span>Impact</span><strong>{impactFrame ?? "--"}</strong></div>
                    <div><span>Launch</span><strong>{launchPoint ? "Set" : "--"}</strong></div>
                    <div><span>Apex</span><strong>{apexPoint ? "Set" : "--"}</strong></div>
                    <div><span>Carry</span><strong>{carryPoint ? "Set" : "--"}</strong></div>
                    <div><span>Landing</span><strong>{landingFrame ?? "--"}</strong></div>
                    <div><span>Flight</span><strong>{readyToTrace ? `${curveSettings.flightTime.toFixed(2)}s` : "--"}</strong></div>
                    <div><span>End</span><strong>{impactTime == null ? "--" : formatTime(flightEndTime)}</strong></div>
                    <div><span>Assist</span><strong>{detectConfidence == null ? "--" : `${detectConfidence}%`}</strong></div>
                  </div>

                  <div className="export-panel">
                    <button className="primary-button export-button" type="button" disabled={!readyToTrace || exportState === "recording"} onClick={exportTracerVideo}>
                      {exportState === "recording" ? `Exporting ${exportProgress}%` : "Export Tracer Video"}
                    </button>
                    <button className="secondary-button" type="button" disabled={!readyToTrace || exportState === "recording"} onClick={exportTracerSnapshot}>
                      Export Still Backup
                    </button>
                    <p>
                      Pro mode exports a replay clip with the red tracer drawn into the video. Still export is only a fallback.
                    </p>
                  </div>
                </div>
              </details>
              ) : null}
            </section>
          </div>
        </div>
        </>
        )}
      </section>
    </main>
  );
}

function TraceHandle({ point, type, active, onPointerDown }) {
  return (
    <g className={`trace-handle ${type} ${active ? "active" : ""}`} onPointerDown={onPointerDown}>
      <circle cx={point.x} cy={point.y} r={active ? 3.1 : 2.45} />
      <circle cx={point.x} cy={point.y} r={0.72} />
    </g>
  );
}

function TraceTag({ point, tone = "cool", label, value }) {
  return (
    <foreignObject x={point.x - 7} y={point.y - 4} width="22" height="10" className={`trace-tag-fo ${tone}`}>
      <div className={`trace-tag ${tone}`}>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </foreignObject>
  );
}

function RangeField({ label, value, min, max, disabled, onChange }) {
  return (
    <label className="field">
      <div className="range-row">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <input type="range" min={min} max={max} value={value} disabled={disabled} onInput={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function modeLooksLikeCourseClip(duration, width, height, sourceMode) {
  const portrait = height > width;
  return sourceMode === "live" || duration > 20 || portrait;
}

async function findSwingWindow(video, onUpdate, options = {}) {
  const aspect = (video.videoWidth || 16) / Math.max(video.videoHeight || 9, 1);
  const sampleWidth = 144;
  const sampleHeight = Math.max(220, Math.round(sampleWidth / Math.max(aspect, 0.2)));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Swing window assist unavailable.");

  canvas.width = sampleWidth;
  canvas.height = sampleHeight;

  const duration = Math.max(video.duration || 0, 0);
  const aroundTime = Number.isFinite(options.aroundTime) ? options.aroundTime : null;
  const step = duration > 90 ? 0.6 : duration > 45 ? 0.4 : 0.25;
  const baseStart = duration > 20 ? 4 : step;
  const startTime = aroundTime == null ? baseStart : clamp(aroundTime - 10, 0, Math.max(duration - step, 0));
  const endTime = aroundTime == null
    ? Math.max(duration - Math.min(3, duration * 0.08), startTime + step)
    : clamp(Math.max(aroundTime + 10, startTime + step), step, duration);
  const samples = [];
  let previousFrame = await captureVideoFrame(video, Math.max(startTime - step, 0), canvas, context);

  for (let time = startTime; time <= endTime; time += step) {
    const frame = await captureVideoFrame(video, time, canvas, context);
    const score = measureSwingMotion(previousFrame, frame, sampleWidth, sampleHeight);
    samples.push({ time, score });
    previousFrame = frame;
    onUpdate?.({ progress: Math.round(mapRange(time, startTime, Math.max(endTime, startTime), 6, 100)) });
  }

  if (!samples.length) {
    throw new Error("No samples collected.");
  }

  const smoothed = samples.map((sample, index) => {
    const prev = samples[index - 1]?.score ?? sample.score;
    const next = samples[index + 1]?.score ?? sample.score;
    return {
      ...sample,
      score: prev * 0.2 + sample.score * 0.6 + next * 0.2,
    };
  });

  const sorted = [...smoothed].sort((a, b) => b.score - a.score);
  const peak = sorted[0];
  const baseline = smoothed.reduce((sum, sample) => sum + sample.score, 0) / smoothed.length;
  const topPeaks = sorted.filter((sample) => sample.score >= peak.score * 0.72);
  const separatedPeaks = topPeaks.filter((sample, index) => topPeaks.findIndex((candidate) => Math.abs(candidate.time - sample.time) < 8) === index);
  const montageLikely = duration > 30 && separatedPeaks.length >= 3;
  const preRoll = montageLikely ? 0.9 : 1.3;
  const postRoll = montageLikely ? 1.8 : 2.5;
  const impactGuess = clamp(peak.time, 0, duration);
  const start = clamp(impactGuess - preRoll, 0, duration);
  const end = clamp(Math.max(impactGuess + postRoll, start + 2.2), 0, duration);

  return {
    impactGuess,
    start,
    end,
    montageLikely,
    confidence: Math.round(clamp(mapRange(peak.score / Math.max(baseline, 0.001), 1.4, 5.5, 28, 96), 24, 96)),
  };
}

function measureSwingMotion(previousFrame, currentFrame, width, height) {
  let weighted = 0;
  let sampleCount = 0;
  const centerLeft = width * 0.12;
  const centerRight = width * 0.88;
  const swingTop = height * 0.3;
  const swingBottom = height * 0.92;

  for (let y = Math.floor(swingTop); y < Math.floor(swingBottom); y += 2) {
    for (let x = Math.floor(centerLeft); x < Math.floor(centerRight); x += 2) {
      const index = (y * width + x) * 4;
      const previousLuma =
        previousFrame.data[index] * 0.299 +
        previousFrame.data[index + 1] * 0.587 +
        previousFrame.data[index + 2] * 0.114;
      const currentLuma =
        currentFrame.data[index] * 0.299 +
        currentFrame.data[index + 1] * 0.587 +
        currentFrame.data[index + 2] * 0.114;
      const diff = Math.abs(currentLuma - previousLuma);
      const verticalWeight = y > height * 0.56 ? 1.5 : y > height * 0.42 ? 1.18 : 0.82;
      const horizontalWeight = x > width * 0.28 && x < width * 0.72 ? 1.28 : 1;
      weighted += diff * verticalWeight * horizontalWeight;
      sampleCount += 1;
    }
  }

  return weighted / Math.max(sampleCount, 1);
}

function loadVideoMetadata(video) {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 1 && Number.isFinite(video.duration)) {
      resolve(video);
      return;
    }

    const handleLoaded = () => {
      cleanup();
      resolve(video);
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Video metadata failed to load."));
    };
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", handleLoaded);
      video.removeEventListener("error", handleError);
    };

    video.addEventListener("loadedmetadata", handleLoaded, { once: true });
    video.addEventListener("error", handleError, { once: true });
  });
}

function defaultApexFromShot(start, end) {
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const lift = clamp(distance * 0.44, 16, 58);

  return {
    x: clamp((start.x + end.x) / 2, 0, 100),
    y: clamp(Math.min(start.y, end.y) - lift, TRACE_TOP, TRACE_BOTTOM),
  };
}

function buildManualTracePoints(start, launch, apex, carry, end, impactTime, flightTime) {
  const shape = sanitizeFlightShape(start, launch, apex, carry, end);
  const anchors = [
    { ...shape.start, time: impactTime },
    { ...shape.launchPoint, time: impactTime + flightTime * 0.18 },
    { ...shape.apexPoint, time: impactTime + flightTime * 0.48 },
    { ...shape.carryPoint, time: impactTime + flightTime * 0.76 },
    { ...shape.endPoint, time: impactTime + flightTime },
  ];

  return buildGolfFlightFromAnchors(anchors, 120);
}

function buildBroadcastTracePoints(start, launch, apex, carry, impactTime, flightTime) {
  if (!start || !apex || !carry || impactTime == null) return [];

  const safeStart = {
    x: clamp(start.x, 0, 100),
    y: clamp(start.y, 40, 92),
  };
  const safeLaunch = launch
    ? {
        x: clamp(launch.x, safeStart.x + 2, 96),
        y: clamp(launch.y, 12, safeStart.y - 4),
      }
    : {
        x: clamp(safeStart.x + 6, 0, 96),
        y: clamp(safeStart.y - 20, 12, 88),
      };
  const safeApex = {
    x: clamp(apex.x, safeLaunch.x + 4, 96),
    y: clamp(apex.y, 4, Math.min(safeLaunch.y, safeStart.y) - 10),
  };
  const safeCarry = {
    x: clamp(carry.x, safeApex.x + 5, 98),
    y: clamp(carry.y, safeApex.y + 6, 64),
  };
  const tracerLaneX = clamp(lerp(safeApex.x, safeCarry.x, 0.2), safeApex.x + 1, Math.max(safeApex.x + 2, safeCarry.x));
  const exitPoint = {
    x: clamp(tracerLaneX + 2.2, 0, 100),
    y: clamp(Math.min(safeCarry.y - 38, safeApex.y + 3), 0, 40),
    time: impactTime + flightTime,
  };
  const verticalLiftPoint = {
    x: clamp(lerp(safeLaunch.x, tracerLaneX, 0.78), safeLaunch.x + 1, tracerLaneX),
    y: clamp(lerp(safeStart.y, safeApex.y, 0.34), safeApex.y + 10, safeStart.y - 8),
  };
  const apexControl = {
    x: clamp(tracerLaneX - 0.6, safeApex.x, tracerLaneX + 2),
    y: clamp(safeApex.y + 1.2, safeApex.y, safeApex.y + 8),
  };
  const topHookControl = {
    x: clamp(exitPoint.x - 1.8, tracerLaneX - 1, exitPoint.x),
    y: clamp(lerp(safeCarry.y, exitPoint.y, 0.32), exitPoint.y + 2, safeCarry.y - 6),
  };
  const samples = [];
  const sampleCount = 84;

  for (let index = 0; index < sampleCount; index += 1) {
    const progress = index / Math.max(sampleCount - 1, 1);

    if (progress <= 0.42) {
      const localT = progress / 0.42;
      const point = cubicBezierPoint(safeStart, safeLaunch, verticalLiftPoint, {
        x: tracerLaneX - 1.2,
        y: clamp(lerp(safeStart.y, safeApex.y, 0.64), safeApex.y + 6, safeStart.y - 12),
      }, localT);
      samples.push({
        ...point,
        time: impactTime + flightTime * progress,
      });
      continue;
    }

    const localT = (progress - 0.42) / 0.58;
    const point = cubicBezierPoint(
      {
        x: tracerLaneX - 1.2,
        y: clamp(lerp(safeStart.y, safeApex.y, 0.64), safeApex.y + 6, safeStart.y - 12),
      },
      apexControl,
      topHookControl,
      exitPoint,
      localT
    );
    samples.push({
      ...point,
      time: impactTime + flightTime * progress,
    });
  }

  return samples;
}

function buildDefaultShapeControls(start, apex, end, overrides = {}) {
  const rise = Math.max(start.y - apex.y, 8);
  const fall = Math.max(end.y - apex.y, 8);
  const launchPoint = overrides.launchPoint || {
    x: clamp(start.x + (apex.x - start.x) * 0.36, 0, 100),
    y: clamp(start.y - rise * 0.48, TRACE_TOP, TRACE_BOTTOM),
  };
  const carryPoint = overrides.carryPoint || {
    x: clamp(apex.x + (end.x - apex.x) * 0.44, 0, 100),
    y: clamp(apex.y + fall * 0.58, TRACE_TOP, TRACE_BOTTOM),
  };

  return { launchPoint, carryPoint };
}

function constrainHandlePoint(handle, point, shape) {
  const fallbackStart = shape.startPoint || { x: 48, y: 76 };
  const fallbackEnd = shape.endPoint || { x: 84, y: 80 };
  const fallbackApex = shape.apexPoint || defaultApexFromShot(fallbackStart, fallbackEnd);
  const safeShape = sanitizeFlightShape(
    fallbackStart,
    shape.launchPoint,
    fallbackApex,
    shape.carryPoint,
    fallbackEnd
  );

  if (handle === "start") {
    return {
      x: clamp(point.x, 0, Math.max((shape.endPoint?.x ?? 100) - 12, 40)),
      y: clamp(point.y, 40, 92),
    };
  }

  if (handle === "end") {
    return {
      x: clamp(Math.max(point.x, safeShape.start.x + 10), 8, 100),
      y: clamp(Math.max(point.y, safeShape.start.y - 6), 48, 96),
    };
  }

  if (handle === "apex") {
    return {
      x: clamp(point.x, safeShape.start.x + 6, safeShape.endPoint.x - 6),
      y: clamp(point.y, 6, Math.min(safeShape.start.y, safeShape.endPoint.y) - 12),
    };
  }

  if (handle === "launch") {
    return {
      x: clamp(point.x, safeShape.start.x + 2, safeShape.apexPoint.x - 2),
      y: clamp(point.y, safeShape.apexPoint.y + 5, safeShape.start.y - 4),
    };
  }

  if (handle === "carry") {
    return {
      x: clamp(point.x, safeShape.apexPoint.x + 2, safeShape.endPoint.x - 2),
      y: clamp(point.y, safeShape.apexPoint.y + 10, safeShape.endPoint.y - 2),
    };
  }

  return point;
}

function sanitizeFlightShape(start, launch, apex, carry, end) {
  const safeStart = {
    x: clamp(start.x, 0, 100),
    y: clamp(start.y, 40, 92),
  };
  const safeEnd = {
    x: clamp(Math.max(end.x, safeStart.x + 10), 8, 100),
    y: clamp(Math.max(end.y, safeStart.y - 6), 48, 96),
  };
  const safeApex = {
    x: clamp(apex.x, safeStart.x + 6, safeEnd.x - 6),
    y: clamp(apex.y, 6, Math.min(safeStart.y, safeEnd.y) - 12),
  };
  const defaults = buildDefaultShapeControls(safeStart, safeApex, safeEnd);
  const safeLaunch = {
    x: clamp((launch || defaults.launchPoint).x, safeStart.x + 2, safeApex.x - 2),
    y: clamp((launch || defaults.launchPoint).y, safeApex.y + 5, safeStart.y - 4),
  };
  const safeCarry = {
    x: clamp((carry || defaults.carryPoint).x, safeApex.x + 2, safeEnd.x - 2),
    y: clamp((carry || defaults.carryPoint).y, safeApex.y + 10, safeEnd.y - 2),
  };

  return {
    start: safeStart,
    launchPoint: safeLaunch,
    apexPoint: safeApex,
    carryPoint: safeCarry,
    endPoint: safeEnd,
  };
}

function buildGolfFlightFromAnchors(anchors, targetSamples = 120) {
  if (anchors.length < 2) return anchors;

  const spline = sampleCatmullRomFlight(anchors, targetSamples);
  const apexAnchorIndex = anchors.reduce((best, point, index) => (point.y < anchors[best].y ? index : best), 0);
  const apexProgress = clamp(apexAnchorIndex / Math.max(anchors.length - 1, 1), 0.2, 0.8);

  const blended = spline.map((point, index) => {
    const progress = index / Math.max(spline.length - 1, 1);
    const baselineY = sampleFlightEnvelopeY(anchors[0], anchors[2], anchors[4], progress, apexProgress);
    const previous = spline[index - 1];
    const x = previous ? Math.max(point.x, previous.x - 0.12) : point.x;

    return {
      x: clamp(x, 0, 100),
      y: clamp(lerp(point.y, baselineY, 0.42), TRACE_TOP, TRACE_BOTTOM),
      time: point.time,
    };
  });

  return enforceFlightCurve(blended, anchors[0], anchors[4]);
}

function sampleCatmullRomFlight(points, targetSamples = 120) {
  if (points.length < 2) return points;

  const segmentCount = points.length - 1;
  const samplesPerSegment = Math.max(8, Math.ceil(targetSamples / segmentCount));
  const sampled = [];

  for (let segment = 0; segment < segmentCount; segment += 1) {
    const p0 = points[Math.max(0, segment - 1)];
    const p1 = points[segment];
    const p2 = points[segment + 1];
    const p3 = points[Math.min(points.length - 1, segment + 2)];

    for (let step = 0; step < samplesPerSegment; step += 1) {
      if (segment > 0 && step === 0) continue;
      const t = step / samplesPerSegment;
      sampled.push(sampleCatmullRomPoint(p0, p1, p2, p3, t));
    }
  }

  sampled.push({ ...points[points.length - 1] });
  return sampled;
}

function sampleCatmullRomPoint(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;

  return {
    x: clamp(
      0.5 *
        ((2 * p1.x) +
          (-p0.x + p2.x) * t +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      0,
      100
    ),
    y: clamp(
      0.5 *
        ((2 * p1.y) +
          (-p0.y + p2.y) * t +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      TRACE_TOP,
      TRACE_BOTTOM
    ),
    time: lerp(p1.time, p2.time, t),
  };
}

function sampleFlightEnvelopeY(start, apex, end, progress, apexProgress) {
  if (progress <= apexProgress) {
    const riseProgress = easeOutCubic(progress / Math.max(apexProgress, 0.001));
    return lerp(start.y, apex.y, riseProgress);
  }

  const fallProgress = easeInQuad((progress - apexProgress) / Math.max(1 - apexProgress, 0.001));
  return lerp(apex.y, end.y, fallProgress);
}

function enforceFlightCurve(points, start, end) {
  if (points.length < 3) return points;

  const output = points.map((point) => ({ ...point }));
  let apexIndex = 0;
  for (let index = 1; index < output.length; index += 1) {
    if (output[index].y < output[apexIndex].y) apexIndex = index;
  }

  output[0] = { ...output[0], x: start.x, y: start.y };
  output[output.length - 1] = { ...output[output.length - 1], x: end.x, y: end.y };

  for (let index = 1; index <= apexIndex; index += 1) {
    output[index].x = Math.max(output[index].x, output[index - 1].x - 0.1);
    output[index].y = Math.min(output[index].y, output[index - 1].y + 0.2);
  }

  for (let index = apexIndex + 1; index < output.length; index += 1) {
    output[index].x = Math.max(output[index].x, output[index - 1].x - 0.1);
    output[index].y = Math.max(output[index].y, output[index - 1].y - 0.1);
  }

  return output;
}

function quadraticPoint(start, apex, end, t) {
  const inv = 1 - t;

  return {
    x: clamp(inv * inv * start.x + 2 * inv * t * apex.x + t * t * end.x, 0, 100),
    y: clamp(inv * inv * start.y + 2 * inv * t * apex.y + t * t * end.y, TRACE_TOP, TRACE_BOTTOM),
  };
}

function cubicBezierPoint(start, controlA, controlB, end, t) {
  const inv = 1 - t;

  return {
    x: clamp(
      inv * inv * inv * start.x +
        3 * inv * inv * t * controlA.x +
        3 * inv * t * t * controlB.x +
        t * t * t * end.x,
      0,
      100
    ),
    y: clamp(
      inv * inv * inv * start.y +
        3 * inv * inv * t * controlA.y +
        3 * inv * t * t * controlB.y +
        t * t * t * end.y,
      TRACE_TOP,
      TRACE_BOTTOM
    ),
  };
}

function mapRange(value, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) return outMin;
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function easeInQuad(value) {
  return value * value;
}

function easeInOutSine(value) {
  return -(Math.cos(Math.PI * clamp(value, 0, 1)) - 1) / 2;
}

function estimateFlightTime(start, end, speed) {
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const speedFactor = clamp(speed / 62, 0.4, 1.9);
  return clamp((distance / 36) / speedFactor, 0.55, 3.2);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatTime(value) {
  if (!Number.isFinite(value)) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getBestRecordingMimeType() {
  const options = [
    "video/mp4;codecs=h264",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];

  return options.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function seekVideo(video, time) {
  return new Promise((resolve, reject) => {
    const targetTime = clamp(time, 0, video.duration || time);
    if (Math.abs(video.currentTime - targetTime) < 0.01) {
      resolve();
      return;
    }

    const handleSeeked = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Video seek failed."));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("error", handleError);
    };

    video.addEventListener("seeked", handleSeeked, { once: true });
    video.addEventListener("error", handleError, { once: true });
    video.currentTime = targetTime;
  });
}

async function trackBallFromSeed(video, seed, onUpdate) {
  const { impactTime, startPoint, profile } = seed;
  const aspect = (video.videoWidth || 16) / Math.max(video.videoHeight || 9, 1);
  const sampleWidth = profile?.sampleWidth || 320;
  const sampleHeight = Math.max(162, Math.round(sampleWidth / aspect));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas analysis unavailable.");

  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const frameStep = profile?.frameStep || 1 / 45;
  const trackLimit = Math.min(video.duration || impactTime + (profile?.trackWindowSeconds || 1.85), impactTime + (profile?.trackWindowSeconds || 1.85));
  const trackFrameCount = Math.max(26, Math.min(64, Math.round((trackLimit - impactTime) / frameStep)));
  const detections = [];
  let previousFrame = await captureVideoFrame(video, Math.max(impactTime - frameStep, 0), canvas, context);
  let lastDetection = denormalizePoint(startPoint, sampleWidth, sampleHeight);
  let velocity = {
    x: sampleWidth * (profile?.initialVelocityX || 0.028),
    y: sampleHeight * (profile?.initialVelocityY || -0.052),
  };
  let misses = 0;

  for (let index = 1; index <= trackFrameCount; index += 1) {
    if (index === 1) onUpdate?.({ progress: 4, stage: "Scanning post-impact frames..." });
    if (index === Math.round(trackFrameCount * 0.35)) onUpdate?.({ progress: 36, stage: "Locking early launch direction..." });
    if (index === Math.round(trackFrameCount * 0.7)) onUpdate?.({ progress: 72, stage: "Projecting the carry path..." });

    const time = Math.min(impactTime + frameStep * index, video.duration || impactTime + frameStep * index);
    const frame = await captureVideoFrame(video, time, canvas, context);
    const candidate = findSeededBallCandidate(previousFrame, frame, sampleWidth, sampleHeight, lastDetection, velocity, index, misses, profile);

    if (candidate) {
      const nextDetection = { ...candidate, time };
      detections.push(nextDetection);
      misses = 0;

      velocity = {
        x: clamp(nextDetection.x - lastDetection.x, sampleWidth * -0.02, sampleWidth * 0.18),
        y: clamp(nextDetection.y - lastDetection.y, -sampleHeight * 0.2, sampleHeight * 0.05),
      };

      lastDetection = nextDetection;
    } else {
      misses += 1;
      lastDetection = {
        x: clamp(lastDetection.x + velocity.x, 0, sampleWidth),
        y: clamp(lastDetection.y + velocity.y, 0, sampleHeight),
      };
      velocity = {
        x: clamp(velocity.x * 1.03, sampleWidth * 0.008, sampleWidth * 0.18),
        y: clamp(velocity.y + sampleHeight * 0.006, -sampleHeight * 0.18, sampleHeight * 0.04),
      };
    }

    previousFrame = frame;
    onUpdate?.({ progress: Math.round(mapRange(index, 1, trackFrameCount, 8, 100)) });
  }

  if (detections.length < 3) {
    throw new Error("Not enough ball detections.");
  }

  const smoothedDetections = smoothDetections(detections);
  const primaryFlightDetections = keepPrimaryFlightDetections(smoothedDetections, sampleHeight);
  const normalizedEnd = normalizePoint(estimateExitPoint(primaryFlightDetections, sampleWidth, sampleHeight, startPoint), sampleWidth, sampleHeight);
  const normalizedApex = estimateApexPoint(primaryFlightDetections, startPoint, normalizedEnd, sampleWidth, sampleHeight);
  const lastDetectionTime = primaryFlightDetections[primaryFlightDetections.length - 1]?.time ?? impactTime + 1;
  const flightTime = clamp(lastDetectionTime - impactTime + 0.34, 0.65, 3.4);
  const landingTime = Math.min(impactTime + flightTime, video.duration || impactTime + flightTime);
  const confidence = computeDetectConfidence(primaryFlightDetections, sampleWidth, sampleHeight, true);
  const tracePoints = buildTrackedTracePoints(startPoint, primaryFlightDetections, sampleWidth, sampleHeight, impactTime, landingTime);

  if (!isPlausibleFlightPath(tracePoints)) {
    throw new Error("Tracked path failed golf-flight sanity checks.");
  }

  return {
    impactTime,
    landingTime,
    apexPoint: normalizedApex,
    endPoint: normalizedEnd,
    flightTime,
    confidence,
    framesScanned: trackFrameCount,
    detectionsFound: primaryFlightDetections.length,
    stage: "Analysis complete. Review the first pass and drag the dots if the tracer needs correction.",
    debugPoints: buildDebugPoints(primaryFlightDetections, sampleWidth, sampleHeight),
    tracePoints,
  };
}

async function captureVideoFrame(video, time, canvas, context) {
  await seekVideo(video, time);
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function findSeededBallCandidate(previousFrame, currentFrame, width, height, lastDetection, velocity, frameIndex, misses, profile) {
  const cellSize = 4;
  const cells = new Map();
  const projection = {
    x: lastDetection.x + velocity.x,
    y: lastDetection.y + velocity.y,
  };

  const windowBoost = Math.min(misses, 5);
  const horizontalLead = frameIndex < 4 ? width * 0.2 : width * 0.16;
  const startX = clamp(Math.floor(lastDetection.x - width * (0.05 + windowBoost * 0.01)), 0, width - 1);
  const endX = clamp(Math.ceil(projection.x + horizontalLead + width * windowBoost * 0.015), 1, width);
  const startY = clamp(Math.floor(projection.y - height * (0.18 + windowBoost * 0.02)), 0, height - 1);
  const endY = clamp(Math.ceil(lastDetection.y + height * (0.06 + windowBoost * 0.015)), 1, height);

  for (let y = startY; y < endY; y += 2) {
    for (let x = startX; x < endX; x += 2) {
      const index = (y * width + x) * 4;
      const red = currentFrame.data[index];
      const green = currentFrame.data[index + 1];
      const blue = currentFrame.data[index + 2];
      const brightness = (red + green + blue) / 3;
      const diff =
        Math.abs(red - previousFrame.data[index]) +
        Math.abs(green - previousFrame.data[index + 1]) +
        Math.abs(blue - previousFrame.data[index + 2]);

      const greenAdvantage = green - Math.max(red, blue);
      const isSkyRegion = y < height * 0.68;
      const brightBall = brightness >= (profile?.brightnessThreshold || 122);
      const darkSkyBall = isSkyRegion && brightness >= 55 && brightness <= 185 && diff >= (profile?.diffThreshold || 34) * 1.9;
      const brightGrassBall = !isSkyRegion && brightness >= (profile?.brightnessThreshold || 122) - 18 && diff >= (profile?.diffThreshold || 34) * 1.25;
      if ((!brightBall && !darkSkyBall && !brightGrassBall) || diff < (profile?.diffThreshold || 34) || greenAdvantage > 34) continue;

      const cellX = Math.floor(x / cellSize);
      const cellY = Math.floor(y / cellSize);
      const key = `${cellX}:${cellY}`;
      const current = cells.get(key) || { count: 0, xSum: 0, ySum: 0, diffSum: 0, brightSum: 0 };
      current.count += 1;
      current.xSum += x;
      current.ySum += y;
      current.diffSum += diff;
      current.brightSum += brightness;
      cells.set(key, current);
    }
  }

  let best = null;

  cells.forEach((cell) => {
    if (cell.count < 1 || cell.count > 30) return;
    const x = cell.xSum / cell.count;
    const y = cell.ySum / cell.count;
    const sizePenalty = Math.abs(cell.count - 4) * 11;
    let score = cell.diffSum * 0.34 + cell.brightSum * 0.68 - sizePenalty;
    score -= Math.hypot(x - projection.x, y - projection.y) * 3.2;
    score -= x < lastDetection.x - width * 0.02 ? 24 : 0;
    score -= y > lastDetection.y + height * 0.04 ? 18 : 0;
    score += frameIndex < 5 && y < lastDetection.y ? 18 : 0;
    score += y < height * 0.68 ? 12 : 0;
    score += cell.count <= 8 ? 10 : 0;

    if (!best || score > best.score) {
      best = {
        x,
        y,
        size: cell.count,
        score,
      };
    }
  });

  return best && best.score > (profile?.acceptScore || 64) ? best : null;
}

function smoothDetections(detections) {
  return detections.map((detection, index) => {
    const previous = detections[index - 1] || detection;
    const next = detections[index + 1] || detection;

    return {
      ...detection,
      x: previous.x * 0.2 + detection.x * 0.6 + next.x * 0.2,
      y: previous.y * 0.2 + detection.y * 0.6 + next.y * 0.2,
    };
  });
}

function keepPrimaryFlightDetections(detections, height) {
  if (detections.length < 4) return detections;

  let highestIndex = 0;
  for (let index = 1; index < detections.length; index += 1) {
    if (detections[index].y < detections[highestIndex].y) {
      highestIndex = index;
    }
  }

  const cutoffIndex = Math.max(2, highestIndex);
  const kept = detections.slice(0, cutoffIndex + 1);

  if (kept.length >= 2) {
    const last = kept[kept.length - 1];
    const previous = kept[kept.length - 2];
    const dropAfterPeak = detections[cutoffIndex + 1];

    if (
      dropAfterPeak &&
      dropAfterPeak.x >= previous.x &&
      dropAfterPeak.y <= last.y + height * 0.012
    ) {
      kept.push(dropAfterPeak);
    }
  }

  return kept.length >= 3 ? kept : detections.slice(0, Math.min(4, detections.length));
}

function estimateExitPoint(detections, width, height, startPoint) {
  const last = detections[detections.length - 1];
  const previous = detections[detections.length - 2] || last;
  const velocity = {
    x: last.x - previous.x,
    y: last.y - previous.y,
  };
  const startPx = denormalizePoint(startPoint, width, height);
  const projected = {
    x: clamp(last.x + Math.max(velocity.x * 5.2, width * 0.1), 0, width),
    y: clamp(
      Math.max(last.y + Math.max(Math.abs(velocity.y) * 7.5, height * 0.22), startPx.y + height * 0.02),
      height * 0.54,
      height * 0.96
    ),
  };
  return {
    x: projected.x,
    y: projected.y,
  };
}

function estimateApexPoint(detections, startPoint, endPoint, width, height) {
  const highestDetection = detections.reduce((best, current) => (current.y < best.y ? current : best), detections[0]);
  const highestNormalized = normalizePoint(highestDetection, width, height);
  const defaultApex = defaultApexFromShot(startPoint, endPoint);

  return {
    x: clamp(highestNormalized.x * 0.58 + defaultApex.x * 0.42, 0, 100),
    y: clamp(Math.min(highestNormalized.y - 3, defaultApex.y), TRACE_TOP, TRACE_BOTTOM),
  };
}

function normalizePoint(point, width, height) {
  return {
    x: clamp((point.x / width) * 100, 0, 100),
    y: clamp((point.y / height) * 100, 0, 100),
  };
}

function denormalizePoint(point, width, height) {
  return {
    x: clamp((point.x / 100) * width, 0, width),
    y: clamp((point.y / 100) * height, 0, height),
  };
}

function buildDebugPoints(detections, width, height) {
  return detections.flatMap((point, index) => {
    const normalized = normalizePoint(point, width, height);
    const debug = [{ ...normalized, type: "detected" }];

    if (index === detections.length - 1 && detections.length > 1) {
      const previous = detections[index - 1];
      const projected = {
        x: clamp(point.x + (point.x - previous.x) * 2.2, 0, width),
        y: clamp(point.y + (point.y - previous.y) * 2.2, 0, height),
      };
      debug.push({ ...normalizePoint(projected, width, height), type: "projected" });
    }

    return debug;
  });
}

function buildTrackedTracePoints(startPoint, detections, width, height, impactTime, landingTime) {
  const normalizedDetections = detections.map((point) => ({
    ...normalizePoint(point, width, height),
    time: point.time,
  }));

  const anchors = [{ ...startPoint, time: impactTime }, ...normalizedDetections];
  if (anchors.length < 2) return anchors;

  const last = anchors[anchors.length - 1];
  const projectedEnd = estimateTrackedTraceEnd(anchors, landingTime, startPoint);

  if (projectedEnd.time > last.time + 0.01) {
    anchors.push({
      x: lerp(last.x, projectedEnd.x, 0.45),
      y: lerp(last.y, projectedEnd.y, 0.45),
      time: lerp(last.time, projectedEnd.time, 0.45),
    });
    anchors.push(projectedEnd);
  }

  return densifyTimedTracePoints(anchors, 96);
}

function estimateTrackedTraceEnd(points, landingTime, startPoint) {
  const last = points[points.length - 1];
  const previous = points[points.length - 2] || last;
  const velocityX = last.x - previous.x;
  const carryX = Math.max(velocityX * 3.6, 10);
  const groundY = clamp(Math.max(startPoint.y + 2, last.y + 18), 54, 96);

  return {
    x: clamp(last.x + carryX, 0, 100),
    y: groundY,
    time: landingTime,
  };
}

function densifyTimedTracePoints(points, targetSamples = 96) {
  if (points.length < 2) return points;

  const timedPoints = [];
  for (let index = 0; index < targetSamples; index += 1) {
    const progress = index / Math.max(targetSamples - 1, 1);
    const position = progress * (points.length - 1);
    const baseIndex = Math.min(points.length - 2, Math.floor(position));
    const localT = easeInOutSine(position - baseIndex);
    const from = points[baseIndex];
    const to = points[baseIndex + 1];

    timedPoints.push({
      x: lerp(from.x, to.x, localT),
      y: lerp(from.y, to.y, localT),
      time: lerp(from.time, to.time, localT),
    });
  }

  return timedPoints;
}

function isPlausibleFlightPath(points) {
  if (!points || points.length < 4) return false;

  let highestIndex = 0;
  for (let index = 1; index < points.length; index += 1) {
    if (points[index].y < points[highestIndex].y) highestIndex = index;
  }

  if (highestIndex < 1 || highestIndex > points.length - 2) return false;

  let backwardMoves = 0;
  for (let index = 1; index < points.length; index += 1) {
    if (points[index].x < points[index - 1].x - 0.8) backwardMoves += 1;
  }

  if (backwardMoves > 1) return false;

  let ascentBreaks = 0;
  for (let index = 1; index <= highestIndex; index += 1) {
    if (points[index].y > points[index - 1].y + 1.6) ascentBreaks += 1;
  }

  let descentBreaks = 0;
  for (let index = highestIndex + 1; index < points.length; index += 1) {
    if (points[index].y < points[index - 1].y - 1.6) descentBreaks += 1;
  }

  if (ascentBreaks > 2 || descentBreaks > 2) return false;
  if (points[points.length - 1].y < points[0].y - 6) return false;
  if (points[points.length - 1].y < points[highestIndex].y + 12) return false;

  return true;
}

function computeDetectConfidence(detections, width, height, seeded = false) {
  const averageScore = detections.reduce((sum, detection) => sum + (detection.score || 0), 0) / Math.max(detections.length, 1);
  const pathSpread = detections.length > 1
    ? Math.hypot(detections[detections.length - 1].x - detections[0].x, detections[detections.length - 1].y - detections[0].y)
    : 0;

  return Math.round(
    clamp(
      detections.length * 7 +
        mapRange(averageScore, seeded ? 72 : 90, seeded ? 210 : 240, 20, 54) +
        mapRange(pathSpread, width * 0.06, width * 0.42, 6, 18) +
        (seeded ? 8 : 0),
      14,
      94
    )
  );
}

function drawExportFrame(context, video, fullTracePoints, settings) {
  const { width, height, time, impactTime, flightTime, glow } = settings;
  context.clearRect(0, 0, width, height);
  context.drawImage(video, 0, 0, width, height);

  if (time >= impactTime) {
    const progress = clamp((time - impactTime) / Math.max(flightTime, 0.01), 0, 1);
    const visibleCount = Math.max(2, Math.ceil(fullTracePoints.length * progress));
    const visiblePoints = fullTracePoints.slice(0, visibleCount);

    if (visiblePoints.length > 1) {
      context.save();
      context.strokeStyle = "#f07a24";
      context.shadowColor = "rgba(109, 52, 14, 0.92)";
      context.shadowBlur = Math.max(18, width * 0.018) * (glow / 100);
      context.lineWidth = Math.max(7, width * 0.006);
      context.lineCap = "round";
      context.lineJoin = "round";
      drawSmoothCanvasPath(context, visiblePoints, width, height);
      context.restore();
    }
  }

  drawWatermark(context, width, height);
}

function drawWatermark(context, width, height) {
  const padding = Math.max(22, width * 0.022);
  const fontSize = Math.max(22, width * 0.024);
  context.save();
  context.font = `700 ${fontSize}px Arial, sans-serif`;
  context.textBaseline = "bottom";
  const text = "ifonlyicouldputt";
  const metrics = context.measureText(text);
  const boxWidth = metrics.width + padding * 1.4;
  const boxHeight = fontSize + padding * 0.8;
  const x = padding;
  const y = height - padding - boxHeight;

  context.fillStyle = "rgba(0, 0, 0, 0.56)";
  roundRect(context, x, y, boxWidth, boxHeight, boxHeight / 2);
  context.fill();
  context.fillStyle = "rgba(243, 234, 216, 0.92)";
  context.fillText(text, x + padding * 0.7, y + boxHeight - padding * 0.36);
  context.restore();
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function buildSmoothPath(points) {
  if (points.length < 2) return "";
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const controlX = current.x;
    const controlY = current.y;
    const endX = (current.x + next.x) / 2;
    const endY = (current.y + next.y) / 2;
    path += ` Q ${controlX} ${controlY} ${endX} ${endY}`;
  }

  const penultimate = points[points.length - 2];
  const last = points[points.length - 1];
  path += ` Q ${penultimate.x} ${penultimate.y} ${last.x} ${last.y}`;
  return path;
}

function drawSmoothCanvasPath(context, points, width, height) {
  if (points.length < 2) return;
  context.beginPath();
  context.moveTo((points[0].x / 100) * width, (points[0].y / 100) * height);

  if (points.length === 2) {
    context.lineTo((points[1].x / 100) * width, (points[1].y / 100) * height);
    context.stroke();
    return;
  }

  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    context.quadraticCurveTo(
      (current.x / 100) * width,
      (current.y / 100) * height,
      ((current.x + next.x) / 200) * width,
      ((current.y + next.y) / 200) * height
    );
  }

  const penultimate = points[points.length - 2];
  const last = points[points.length - 1];
  context.quadraticCurveTo(
    (penultimate.x / 100) * width,
    (penultimate.y / 100) * height,
    (last.x / 100) * width,
    (last.y / 100) * height
  );
  context.stroke();
}

export default App;

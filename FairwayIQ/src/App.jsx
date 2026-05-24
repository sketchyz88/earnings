import { useEffect, useMemo, useRef, useState } from "react";

const PLAYBACK_PRESETS = [0.25, 0.5, 0.75, 1];
const PRODUCT_DROPS = [
  {
    name: "Performance Polo",
    price: "Concept 01",
    status: "Coming soon",
    image: "/brand/ifonlyicouldputt-performance-polo.png",
    detail: "Forest green performance polo with premium embroidery, side tab, and interior neck print.",
  },
  {
    name: "Bold Vintage Club-Style Tee",
    price: "Concept 02",
    status: "Coming soon",
    image: "/brand/ifonlyicouldputt-vintage-tee.png",
    detail: "Cream cotton tee with left chest club badge, full back short-game society graphic, and custom neck print.",
  },
  {
    name: "Short Game Rope Hat",
    price: "Concept 03",
    status: "Coming soon",
    motif: "Cap",
    detail: "Evergreen rope hat with cream stitching, brass buckle, and a small crossed-clubs badge.",
  },
  {
    name: "Practice Green Crewneck",
    price: "Concept 04",
    status: "Coming soon",
    motif: "Crew",
    detail: "Heavyweight cream crewneck with a small front wordmark and oversized back putting graphic.",
  },
  {
    name: "If Only Quarter-Zip",
    price: "Concept 05",
    status: "Coming soon",
    motif: "Zip",
    detail: "Course-ready quarter-zip in deep green with rust zipper pull and subtle sleeve tab.",
  },
  {
    name: "Short Game Society Towel",
    price: "Concept 06",
    status: "Coming soon",
    motif: "Towel",
    detail: "Cream waffle towel with forest green border, rust label, and club badge corner mark.",
  },
];

function App() {
  const uploadInputRef = useRef(null);
  const liveInputRef = useRef(null);
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const dragRef = useRef(null);

  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceMode, setSourceMode] = useState("upload");
  const [timelineValue, setTimelineValue] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fps, setFps] = useState(30);
  const [playbackRate, setPlaybackRate] = useState(0.5);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoError, setVideoError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [trimWindow, setTrimWindow] = useState(null);
  const [status, setStatus] = useState(
    "Upload a golf video, scrub to contact, place the ball start point, then place the landing point.",
  );

  const [impactTime, setImpactTime] = useState(null);
  const [impactFrame, setImpactFrame] = useState(null);
  const [startPoint, setStartPoint] = useState(null);
  const [startFrame, setStartFrame] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [endFrame, setEndFrame] = useState(null);
  const [workflowStep, setWorkflowStep] = useState(0);
  const [placementMode, setPlacementMode] = useState(null);
  const [selectedHandle, setSelectedHandle] = useState(null);
  const [curveSettings, setCurveSettings] = useState({
    endTime: 0,
    apexLift: 24,
    sideBend: 0,
    ballSpeed: 55,
  });

  useEffect(() => {
    return () => {
      if (sourceUrl) {
        URL.revokeObjectURL(sourceUrl);
      }
    };
  }, [sourceUrl]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  function openUploadPicker() {
    uploadInputRef.current?.click();
  }

  function openLivePicker() {
    liveInputRef.current?.click();
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function formatTime(value) {
    if (!Number.isFinite(value)) {
      return "0:00";
    }

    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60)
      .toString()
      .padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function resetVideo(url, name, mode) {
    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
    }

    setSourceUrl(url);
    setSourceName(name);
    setSourceMode(mode);
    setTimelineValue(0);
    setDuration(0);
    setPlaybackRate(0.5);
    setIsPlaying(false);
    setVideoError("");
    setIsAnalyzing(false);
    setTrimWindow(null);
    setImpactTime(null);
    setImpactFrame(null);
    setStartPoint(null);
    setStartFrame(null);
    setEndPoint(null);
    setEndFrame(null);
    setWorkflowStep(1);
    setPlacementMode(null);
    setSelectedHandle(null);
    setCurveSettings({
      endTime: 0,
      apexLift: 24,
      sideBend: 0,
      ballSpeed: 55,
    });
    setStatus(
      `Step 1 of 3. ${mode === "live" ? "Your live capture is ready." : "Your uploaded clip is ready."} Scrub to contact, set impact, then place the ball start point on that exact frame.`,
    );
  }

  function handleVideoSelect(event, mode) {
    const [file] = event.target.files || [];

    if (!file) {
      return;
    }

    resetVideo(URL.createObjectURL(file), file.name, mode);
    event.target.value = "";
  }

  async function togglePlayback() {
    if (!videoRef.current) {
      return;
    }

    if (videoRef.current.paused) {
      await videoRef.current.play().catch(() => {});
      return;
    }

    videoRef.current.pause();
  }

  async function analyzeSwingWindow(url = sourceUrl, clipDuration = duration) {
    if (!url || !clipDuration || isAnalyzing) {
      return;
    }

    setIsAnalyzing(true);
    setStatus("Analyzing the clip to find the swing window and cut out the waiting time.");

    try {
      const windowGuess = await detectSwingWindow(url, clipDuration);
      setTrimWindow(windowGuess);

      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = windowGuess.start;
      }

      setTimelineValue(windowGuess.start);
      setStatus(
        `AI suggested a swing window from ${formatTime(windowGuess.start)} to ${formatTime(windowGuess.end)}. Adjust Trim Start and Trim End if needed, then set impact.`,
      );
    } catch (error) {
      console.error(error);
      setStatus("The AI could not confidently isolate the swing window, so the full clip is still available for manual editing.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function getOverlayPoint(event) {
    const bounds = overlayRef.current.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - bounds.left) / bounds.width) * 100, 0, 100),
      y: clamp(((event.clientY - bounds.top) / bounds.height) * 100, 0, 100),
    };
  }

  function currentVideoTime() {
    return videoRef.current?.currentTime ?? 0;
  }

  function timeToFrame(time) {
    return Math.max(0, Math.round(time * fps));
  }

  function frameToTime(frame) {
    return frame / fps;
  }

  function currentVideoFrame() {
    return timeToFrame(currentVideoTime());
  }

  async function stepFrame(direction) {
    if (!videoRef.current) {
      return;
    }

    const nextFrame = Math.max(0, currentVideoFrame() + direction);
    const minTime = trimWindow?.start ?? 0;
    const maxTime = trimWindow?.end ?? duration ?? 0;
    const nextTime = clamp(frameToTime(nextFrame), minTime, maxTime);
    videoRef.current.pause();
    videoRef.current.currentTime = nextTime;
    setTimelineValue(nextTime);
  }

  function placeStartPoint(event) {
    if (workflowStep !== 1) {
      return;
    }

    const point = getOverlayPoint(event);
    const currentTime = currentVideoTime();
    const frame = currentVideoFrame();
    setImpactTime(currentTime);
    setImpactFrame(frame);
    setStartPoint(point);
    setStartFrame(frame);
    setWorkflowStep(2);
    setPlacementMode(null);
    setSelectedHandle("start");
    setStatus(`Step 1 complete. Start point set on frame ${frame}. Step 2 of 3: scrub forward and place the landing point.`);
  }

  function placeEndPoint(event) {
    if (workflowStep !== 2) {
      return;
    }

    const point = getOverlayPoint(event);
    const currentTime = currentVideoTime();
    const frame = currentVideoFrame();
    const shotDistance = startPoint
      ? Math.sqrt(Math.pow(point.x - startPoint.x, 2) + Math.pow(point.y - startPoint.y, 2))
      : 20;
    const speedFactor = clamp(curveSettings.ballSpeed / 55, 0.35, 2);
    const flightSeconds = clamp((shotDistance / 34) / speedFactor, 0.45, 2.6);
    setEndPoint(point);
    setEndFrame(frame);
    setCurveSettings((current) => ({
      ...current,
      endTime: (impactTime ?? currentTime) + flightSeconds,
    }));
    setWorkflowStep(3);
    setPlacementMode(null);
    setSelectedHandle("end");
    setStatus(`Step 2 complete. Landing point set on frame ${frame}. Step 3 of 3: shape the arc and tune the tracer speed.`);
  }

  function handleOverlayClick(event) {
    if (!overlayRef.current) {
      return;
    }

    if (placementMode === "start") {
      placeStartPoint(event);
      return;
    }

    if (placementMode === "end") {
      placeEndPoint(event);
    }
  }

  const apexHandle = useMemo(() => {
    if (!startPoint || !endPoint) {
      return null;
    }

    const midX = (startPoint.x + endPoint.x) / 2;
    const midY = (startPoint.y + endPoint.y) / 2;
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const length = Math.max(Math.sqrt(dx * dx + dy * dy), 0.001);
    const normalX = -dy / length;
    const normalY = dx / length;

    return {
      x: midX + curveSettings.sideBend * 0.18,
      y: midY - curveSettings.apexLift + normalY * curveSettings.sideBend * 0.08 - Math.abs(dx) * 0.04,
      normalX,
      normalY,
    };
  }, [startPoint, endPoint, curveSettings]);

  const generatedTrace = useMemo(() => {
    if (!startPoint || !endPoint || impactTime == null) {
      return [];
    }

    const endTime = Math.max(curveSettings.endTime || impactTime + 0.6, impactTime + 0.2);
    const control = apexHandle;

    if (!control) {
      return [];
    }

    const points = [];
    const totalSamples = 28;

    for (let index = 0; index <= totalSamples; index += 1) {
      const t = index / totalSamples;
      const inv = 1 - t;
      const x = inv * inv * startPoint.x + 2 * inv * t * control.x + t * t * endPoint.x;
      const y = inv * inv * startPoint.y + 2 * inv * t * control.y + t * t * endPoint.y;
      points.push({
        id: `trace-${index}`,
        time: impactTime + (endTime - impactTime) * t,
        x,
        y,
      });
    }

    return points;
  }, [startPoint, endPoint, impactTime, curveSettings.endTime, apexHandle]);

  const currentStep = workflowStep || 1;

  const stepLabel = useMemo(() => {
    if (workflowStep <= 1) {
      return "Locate Start";
    }
    if (workflowStep === 2) {
      return "Locate Landing";
    }
    return "Shape Shot";
  }, [workflowStep]);

  const visibleTracePoints = useMemo(() => {
    if (impactTime == null || timelineValue < impactTime) {
      return [];
    }

    return generatedTrace.filter((point) => point.time <= timelineValue);
  }, [generatedTrace, timelineValue, impactTime]);

  const tracePath = useMemo(() => {
    if (visibleTracePoints.length < 2) {
      return "";
    }

    return buildSmoothPath(visibleTracePoints);
  }, [visibleTracePoints]);

  function startHandleDrag(event, handle) {
    if (workflowStep < 3) {
      return;
    }

    event.stopPropagation();
    dragRef.current = handle;
    setSelectedHandle(handle);
  }

  function moveDraggedHandle(event) {
    if (workflowStep < 3 || !dragRef.current || !overlayRef.current) {
      return;
    }

    const point = getOverlayPoint(event);

    if (dragRef.current === "start") {
      setStartPoint(point);
      return;
    }

    if (dragRef.current === "end") {
      setEndPoint(point);
      return;
    }

    if (dragRef.current === "apex" && startPoint && endPoint) {
      const midX = (startPoint.x + endPoint.x) / 2;
      const midY = (startPoint.y + endPoint.y) / 2;
      const dx = endPoint.x - startPoint.x;
      const lift = clamp(midY - point.y + Math.abs(dx) * 0.04, 0, 60);
      const bend = clamp((point.x - midX) * 5.2, -40, 40);
      setCurveSettings((current) => ({
        ...current,
        apexLift: lift,
        sideBend: bend,
      }));
    }
  }

  function stopHandleDrag() {
    dragRef.current = null;
  }

  async function exportSocialVideo() {
    const video = videoRef.current;

    if (!video || generatedTrace.length < 2) {
      return;
    }

    const canvas = document.createElement("canvas");
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm",
    });
    const chunks = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    const restoreTime = video.currentTime;
    video.pause();
    recorder.start();

    const step = 1 / 30;
    for (let time = 0; time <= duration; time += step) {
      await seekVideo(video, time);
      context.drawImage(video, 0, 0, width, height);

      if (impactTime != null && time >= impactTime) {
        const active = generatedTrace.filter((point) => point.time <= time);
        if (active.length > 1) {
          context.strokeStyle = "#ff3b30";
          context.shadowColor = "rgba(255, 59, 48, 0.8)";
          context.shadowBlur = Math.max(16, width * 0.01);
          context.lineWidth = Math.max(7, width * 0.005);
          context.lineJoin = "round";
          context.lineCap = "round";
          drawSmoothCanvasPath(context, active, width, height);
          context.shadowBlur = 0;
        }
      }

      await waitFrame(12);
    }

    const blob = await new Promise((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || "video/webm" }));
      recorder.stop();
    });

    await seekVideo(video, restoreTime);
    if (!blob) {
      return;
    }

    const file = new File([blob], "fairwayiq-tracer.webm", { type: blob.type || "video/webm" });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          title: "FairwayIQ tracer replay",
          text: "Golf tracer replay by ifonlyicouldputt",
          files: [file],
        });
        return;
      } catch (error) {
        console.error(error);
      }
    }

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = "fairwayiq-tracer.webm";
    link.click();
    URL.revokeObjectURL(downloadUrl);
  }

  return (
    <main className="app-shell tracer-shell premium-shell">
      <header className="brand-nav">
        <a className="wordmark" href="#top" aria-label="ifonlyicouldputt home">
          ifonlyicouldputt
        </a>
        <nav className="nav-links" aria-label="Primary navigation">
          <a href="#drop">Drop</a>
          <a href="#tracker">Shot tracker</a>
          <a href="mailto:ifonlyicouldputt@gmail.com">Contact</a>
        </nav>
      </header>

      <section id="top" className="brand-hero">
        <div className="brand-hero-copy">
          <p className="eyebrow">Golf clothes for people who know exactly why they missed.</p>
          <h1>ifonlyicouldputt</h1>
          <p>
            A short-game clothing line with vintage club energy, performance details, and a shot-tracing tool built into the same world. Coming soon.
          </p>
          <div className="brand-actions">
            <a className="primary-button" href="#drop">
              View the first drop
            </a>
            <a className="secondary-button" href="#tracker">
              Open shot tracker
            </a>
          </div>
        </div>
        <div className="hero-product-card" aria-label="Featured clothing preview">
          <img
            src="/brand/ifonlyicouldputt-vintage-tee.png"
            alt="ifonlyicouldputt vintage club-style tee concept"
          />
          <p>The short game. Shorter.</p>
        </div>
      </section>

      <section id="drop" className="drop-section">
        <div className="section-heading">
          <p className="eyebrow">Clothing line</p>
          <h2>First drop coming soon</h2>
        </div>
        <div className="product-grid">
          {PRODUCT_DROPS.map((product) => (
            <article className="product-card" key={product.name}>
              {product.image ? (
                <img src={product.image} alt={`${product.name} design board`} />
              ) : (
                <div className="product-art">
                  <span>{product.motif}</span>
                  <strong>Coming soon</strong>
                </div>
              )}
              <div>
                <span className="coming-soon-pill">{product.status}</span>
                <h3>{product.name}</h3>
                <p>{product.detail}</p>
              </div>
              <strong>{product.price}</strong>
            </article>
          ))}
        </div>
      </section>

      <section id="tracker" className="tracker-intro">
        <div>
          <p className="eyebrow">Shot tracker</p>
          <h2>Trace your shot after the round.</h2>
          <p>{status}</p>
        </div>
        <div className="hero-stats">
          <div className="hero-stat">
            <span>Step</span>
            <strong>{stepLabel}</strong>
          </div>
          <div className="hero-stat">
            <span>Impact</span>
            <strong>{impactTime == null ? "--" : formatTime(impactTime)}</strong>
          </div>
          <div className="hero-stat">
            <span>Frame</span>
            <strong>{currentVideoFrame()}</strong>
          </div>
        </div>
      </section>

      <section className="hero-banner premium-hero">
        <div className="step-strip" aria-label="Tracer steps">
          <div className={currentStep >= 1 ? "step-chip active" : "step-chip"}>1. Start</div>
          <div className={currentStep >= 2 ? "step-chip active" : "step-chip"}>2. Landing</div>
          <div className={currentStep >= 3 ? "step-chip active" : "step-chip"}>3. Shape</div>
        </div>
        <div className="hero-actions">
          <button className="primary-button record-button" type="button" onClick={openLivePicker}>
            Record Live Swing
          </button>
          <button className="secondary-button" type="button" onClick={openUploadPicker}>
            Trace Existing Video
          </button>
          <button
            className={placementMode === "start" ? "primary-button" : "secondary-button"}
            type="button"
            onClick={() => {
              if (workflowStep !== 1) {
                return;
              }
              setPlacementMode("start");
              setStatus("Step 1 of 3. Tap directly on the ball on the impact frame to set the tracer starting point.");
            }}
            disabled={!sourceUrl || workflowStep !== 1}
          >
            Set Ball Start
          </button>
          <button
            className={placementMode === "end" ? "primary-button" : "secondary-button"}
            type="button"
            onClick={() => {
              if (workflowStep !== 2) {
                return;
              }
              setPlacementMode("end");
              setStatus("Step 2 of 3. Scrub to where the shot finishes, then tap the landing or ending point.");
            }}
            disabled={!sourceUrl || workflowStep !== 2}
          >
            Set Landing Point
          </button>
          <input
            ref={liveInputRef}
            className="sr-only"
            type="file"
            accept="video/*"
            capture="environment"
            onChange={(event) => handleVideoSelect(event, "live")}
          />
          <input
            ref={uploadInputRef}
            className="sr-only"
            type="file"
            accept="video/*"
            onChange={(event) => handleVideoSelect(event, "upload")}
          />
        </div>
      </section>

      <section className="content-grid advanced-layout">
        <section className="panel replay-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Replay</p>
              <h2>{sourceName || "No video loaded yet"}</h2>
            </div>
            <span className="pill">
              {workflowStep >= 3
                ? `${sourceMode === "live" ? "Live" : "Post"} curve ready`
                : workflowStep === 2
                  ? "Need landing point"
                  : "Need start point"}
            </span>
          </div>

          <div className="video-stage replay-stage">
            {sourceUrl ? (
              <>
                <video
                  ref={videoRef}
                  className="tracer-video"
                  src={sourceUrl}
                  playsInline
                  controls
                  onLoadedMetadata={(event) => {
                    const nextDuration = event.currentTarget.duration || 0;
                    setDuration(nextDuration);
                    setTimelineValue(0);
                    setTrimWindow(null);
                    setCurveSettings((current) => ({
                      ...current,
                      endTime: Math.max(nextDuration * 0.55, 0.8),
                    }));
                    event.currentTarget.playbackRate = playbackRate;
                    window.setTimeout(() => {
                      analyzeSwingWindow(sourceUrl, nextDuration);
                    }, 120);
                  }}
                  onTimeUpdate={(event) => setTimelineValue(event.currentTarget.currentTime)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onError={() => {
                    setVideoError("This video format is not decoding in the in-app browser. HEVC/H.265 .MOV files often fail here.");
                    setStatus("This clip is likely HEVC/H.265. Try Safari or convert the video to H.264 MP4 first.");
                  }}
                />
                <div
                  ref={overlayRef}
                  className={placementMode ? "trace-overlay manual" : "trace-overlay"}
                  onClick={handleOverlayClick}
                  onPointerMove={moveDraggedHandle}
                  onPointerUp={stopHandleDrag}
                  onPointerLeave={stopHandleDrag}
                >
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="trace-svg">
                    {startPoint && apexHandle ? (
                      <path
                        d={`M ${startPoint.x} ${startPoint.y} L ${apexHandle.x} ${apexHandle.y} L ${endPoint?.x ?? apexHandle.x} ${endPoint?.y ?? apexHandle.y}`}
                        className="trace-guide-line"
                      />
                    ) : null}
                    {tracePath ? <path d={tracePath} className="trace-line red" /> : null}
                    {startPoint ? (
                      <circle
                        cx={startPoint.x}
                        cy={startPoint.y}
                        r={selectedHandle === "start" ? "2.8" : "2.2"}
                        className="trace-point start"
                        onPointerDown={(event) => startHandleDrag(event, "start")}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedHandle("start");
                        }}
                      />
                    ) : null}
                    {endPoint ? (
                      <circle
                        cx={endPoint.x}
                        cy={endPoint.y}
                        r={selectedHandle === "end" ? "2.8" : "2.2"}
                        className="trace-point end"
                        onPointerDown={(event) => startHandleDrag(event, "end")}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedHandle("end");
                        }}
                      />
                    ) : null}
                    {apexHandle ? (
                      <circle
                        cx={apexHandle.x}
                        cy={apexHandle.y}
                        r={selectedHandle === "apex" ? "2.6" : "2.0"}
                        className="trace-point apex"
                        onPointerDown={(event) => startHandleDrag(event, "apex")}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedHandle("apex");
                        }}
                      />
                    ) : null}
                  </svg>
                </div>
              </>
            ) : (
              <div className="empty-stage">
                <h3>Start by uploading one golf video.</h3>
                <p>This version begins with a start point and end point, then generates the tracer curve between them.</p>
              </div>
            )}
          </div>

          {sourceUrl ? (
            <div className="stack">
              {videoError ? <div className="notice error">{videoError}</div> : null}
              <div className="transport-row tracer-controls advanced-controls">
                <button className="secondary-button" type="button" onClick={togglePlayback}>
                  {isPlaying ? "Pause Replay" : "Play Replay"}
                </button>
                <button className="secondary-button" type="button" onClick={() => stepFrame(-1)} disabled={!sourceUrl}>
                  Frame -
                </button>
                <button className="secondary-button" type="button" onClick={() => stepFrame(1)} disabled={!sourceUrl}>
                  Frame +
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    if (workflowStep !== 1) {
                      return;
                    }
                    const currentTime = currentVideoTime();
                    const frame = currentVideoFrame();
                    setImpactTime(currentTime);
                    setImpactFrame(frame);
                    setStatus(`Impact set on frame ${frame}. Step 1 of 3: now tap Set Ball Start and place the point on the ball.`);
                  }}
                  disabled={!sourceUrl || workflowStep !== 1}
                >
                  Set Impact
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setStartPoint(null);
                    setStartFrame(null);
                    setEndPoint(null);
                    setEndFrame(null);
                    setSelectedHandle(null);
                    setImpactTime(null);
                    setImpactFrame(null);
                    setWorkflowStep(1);
                    setPlacementMode(null);
                    setStatus("Tracer reset. Step 1 of 3: scrub to contact, set impact, then place the ball start point.");
                  }}
                  disabled={!startPoint && !endPoint}
                >
                  Reset Trace
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={exportSocialVideo}
                  disabled={workflowStep < 3 || generatedTrace.length < 2}
                >
                  Export Social Video
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={analyzeSwingWindow}
                  disabled={!sourceUrl || !duration || isAnalyzing}
                >
                  {isAnalyzing ? "Analyzing..." : "Suggest Swing Window"}
                </button>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setTrimWindow(null);
                    setStatus("Using the full clip again. You can resuggest the swing window or trim it manually.");
                  }}
                  disabled={!trimWindow}
                >
                  Use Full Clip
                </button>
              </div>

              <div className="field">
                <div className="range-row">
                  <span>Timeline</span>
                  <span>
                    {formatTime(timelineValue)} / {formatTime(duration)} • Frame {currentVideoFrame()}
                  </span>
                </div>
                <input
                  type="range"
                  min={trimWindow?.start ?? 0}
                  max={trimWindow?.end ?? duration ?? 0}
                  step="0.01"
                  value={timelineValue}
                  onInput={(event) => {
                    const nextValue = Number(event.target.value);
                    setTimelineValue(nextValue);
                    if (videoRef.current) {
                      videoRef.current.currentTime = nextValue;
                    }
                  }}
                />
              </div>

              <div className="feed-card point-card">
                <div className="point-card-header">
                  <h3>Swing Window</h3>
                </div>
                <label className="field">
                  <div className="range-row">
                    <span>Trim Start</span>
                    <span>{formatTime(trimWindow?.start ?? 0)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(duration - 0.1, 0)}
                    step="0.01"
                    value={trimWindow?.start ?? 0}
                    onInput={(event) => {
                      const nextStart = Number(event.target.value);
                      setTrimWindow((current) => {
                        const end = current?.end ?? duration;
                        return { start: Math.min(nextStart, Math.max(end - 0.1, 0)), end };
                      });
                      if (videoRef.current) {
                        videoRef.current.currentTime = nextStart;
                      }
                      setTimelineValue(nextStart);
                    }}
                  />
                </label>
                <label className="field">
                  <div className="range-row">
                    <span>Trim End</span>
                    <span>{formatTime(trimWindow?.end ?? duration)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    step="0.01"
                    value={trimWindow?.end ?? duration}
                    onInput={(event) => {
                      const nextEnd = Number(event.target.value);
                      setTrimWindow((current) => {
                        const start = current?.start ?? 0;
                        return { start, end: Math.max(nextEnd, Math.min(start + 0.1, duration)) };
                      });
                    }}
                  />
                </label>
              </div>

              <div className="field">
                <div className="range-row">
                  <span>Playback Speed</span>
                  <span>{playbackRate.toFixed(2).replace(/0$/, "").replace(/\.0$/, ".0")}x</span>
                </div>
                <div className="preset-row">
                  {PLAYBACK_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={preset === playbackRate ? "speed-pill active" : "speed-pill"}
                      onClick={() => setPlaybackRate(preset)}
                    >
                      {preset}x
                    </button>
                  ))}
                </div>
              </div>

              <div className="notice">
                {sourceMode === "live"
                  ? "Live mode: record the swing first, then step through the clip and place start and landing points."
                  : "Post mode: upload a saved swing clip, then place start and landing points frame by frame."}
              </div>

              {trimWindow ? (
                <div className="notice">
                  Swing window suggestion: {formatTime(trimWindow.start)} to {formatTime(trimWindow.end)}. Adjust it if the AI guessed wrong.
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <aside className="panel side-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Shape Controls</p>
              <h2>Adjust the shot</h2>
            </div>
          </div>

          <div className="stack compact">
            <article className={currentStep === 1 ? "feed-card active" : "feed-card"}>
              <h3>1. Set contact</h3>
              <p>Step frame by frame to the strike frame and tap <code>Set Impact</code>.</p>
            </article>
            <article className={currentStep === 1 ? "feed-card active" : "feed-card"}>
              <h3>2. Place the ball start</h3>
              <p>On that exact frame, tap <code>Set Ball Start</code> and place the point directly over the ball.</p>
            </article>
            <article className={currentStep === 2 ? "feed-card active" : "feed-card"}>
              <h3>3. Place the landing point</h3>
              <p>Scrub forward frame by frame, tap <code>Set Landing Point</code>, and place where the ball finished.</p>
            </article>
            <article className={currentStep === 3 ? "feed-card active" : "feed-card"}>
              <h3>4. Shape the flight</h3>
              <p>Drag the start, landing, or apex handle. Then use the sliders below to tune height, curve, and ball speed.</p>
            </article>
          </div>

          <div className="stack point-editor-stack">
            <article className="feed-card point-card">
              <div className="point-card-header">
                <h3>Frame Anchors</h3>
              </div>
              <div className="point-grid">
                <label className="field">
                  <span>Impact Frame</span>
                  <input value={impactFrame ?? ""} readOnly />
                </label>
                <label className="field">
                  <span>Start Frame</span>
                  <input value={startFrame ?? ""} readOnly />
                </label>
                <label className="field">
                  <span>Landing Frame</span>
                  <input value={endFrame ?? ""} readOnly />
                </label>
                <label className="field">
                  <span>FPS</span>
                  <input value={fps} readOnly />
                </label>
              </div>
            </article>

            <article className="feed-card point-card">
              <div className="point-card-header">
                <h3>Curve</h3>
              </div>
              <label className="field">
                <span>Apex Height</span>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="1"
                  value={curveSettings.apexLift}
                  onInput={(event) =>
                    setCurveSettings((current) => ({
                      ...current,
                      apexLift: Number(event.target.value),
                    }))
                  }
                  disabled={workflowStep < 3 || !startPoint || !endPoint}
                />
              </label>
              <label className="field">
                <span>Draw / Fade Bend</span>
                <input
                  type="range"
                  min="-40"
                  max="40"
                  step="1"
                  value={curveSettings.sideBend}
                  onInput={(event) =>
                    setCurveSettings((current) => ({
                      ...current,
                      sideBend: Number(event.target.value),
                    }))
                  }
                  disabled={workflowStep < 3 || !startPoint || !endPoint}
                />
              </label>
              <label className="field">
                <span>Ball Speed</span>
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="1"
                  value={curveSettings.ballSpeed}
                  onInput={(event) =>
                    setCurveSettings((current) => {
                      const nextSpeed = Number(event.target.value);
                      if (!impactTime || !startPoint || !endPoint) {
                        return {
                          ...current,
                          ballSpeed: nextSpeed,
                        };
                      }

                      const shotDistance = Math.sqrt(
                        Math.pow(endPoint.x - startPoint.x, 2) + Math.pow(endPoint.y - startPoint.y, 2),
                      );
                      const speedFactor = clamp(nextSpeed / 55, 0.35, 2);
                      const flightSeconds = clamp((shotDistance / 34) / speedFactor, 0.45, 2.6);

                      return {
                        ...current,
                        ballSpeed: nextSpeed,
                        endTime: impactTime + flightSeconds,
                      };
                    })
                  }
                  disabled={workflowStep < 3 || !startPoint || !endPoint}
                />
              </label>
              <label className="field">
                <span>Flight End Time</span>
                <input
                  type="range"
                  min={impactTime ?? 0}
                  max={duration || Math.max((impactTime ?? 0) + 2, 2)}
                  step="0.01"
                  value={curveSettings.endTime}
                  onInput={(event) =>
                    setCurveSettings((current) => ({
                      ...current,
                      endTime: Number(event.target.value),
                    }))
                  }
                  disabled={workflowStep < 3 || !startPoint || !endPoint}
                />
              </label>
            </article>

            <article className="feed-card point-card">
              <div className="point-card-header">
                <h3>Anchor Positions</h3>
              </div>
              <div className="point-grid">
                <label className="field">
                  <span>Start X</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={startPoint ? startPoint.x.toFixed(1) : ""}
                    onChange={(event) =>
                      setStartPoint((current) =>
                        current ? { ...current, x: clamp(Number(event.target.value), 0, 100) } : current,
                      )
                    }
                    disabled={workflowStep < 3 || !startPoint}
                  />
                </label>
                <label className="field">
                  <span>Start Y</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={startPoint ? startPoint.y.toFixed(1) : ""}
                    onChange={(event) =>
                      setStartPoint((current) =>
                        current ? { ...current, y: clamp(Number(event.target.value), 0, 100) } : current,
                      )
                    }
                    disabled={workflowStep < 3 || !startPoint}
                  />
                </label>
                <label className="field">
                  <span>End X</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={endPoint ? endPoint.x.toFixed(1) : ""}
                    onChange={(event) =>
                      setEndPoint((current) =>
                        current ? { ...current, x: clamp(Number(event.target.value), 0, 100) } : current,
                      )
                    }
                    disabled={workflowStep < 3 || !endPoint}
                  />
                </label>
                <label className="field">
                  <span>End Y</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={endPoint ? endPoint.y.toFixed(1) : ""}
                    onChange={(event) =>
                      setEndPoint((current) =>
                        current ? { ...current, y: clamp(Number(event.target.value), 0, 100) } : current,
                      )
                    }
                    disabled={workflowStep < 3 || !endPoint}
                  />
                </label>
              </div>
            </article>
          </div>
        </aside>
      </section>
    </main>
  );
}

function seekVideo(video, time) {
  return new Promise((resolve) => {
    const handleSeeked = () => {
      video.removeEventListener("seeked", handleSeeked);
      resolve();
    };

    video.addEventListener("seeked", handleSeeked, { once: true });
    video.currentTime = Math.min(time, Math.max(video.duration - 0.02, 0));
  });
}

function waitFrame(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function detectSwingWindow(sourceUrl, duration) {
  const probeVideo = document.createElement("video");
  probeVideo.src = sourceUrl;
  probeVideo.muted = true;
  probeVideo.playsInline = true;
  probeVideo.preload = "auto";

  await waitForVideoReady(probeVideo);

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 36;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Canvas context unavailable.");
  }

  const totalSamples = Math.min(90, Math.max(24, Math.floor(duration * 12)));
  const sampleStep = duration / totalSamples;
  const samples = [];
  let previousFrame = null;

  for (let index = 0; index <= totalSamples; index += 1) {
    const time = Math.min(duration, index * sampleStep);
    await seekVideo(probeVideo, time);
    context.drawImage(probeVideo, 0, 0, canvas.width, canvas.height);
    const frame = context.getImageData(0, 0, canvas.width, canvas.height).data;

    if (!previousFrame) {
      previousFrame = frame;
      samples.push({ time, energy: 0 });
      continue;
    }

    let energy = 0;
    for (let pixel = 0; pixel < frame.length; pixel += 16) {
      const currentGray = (frame[pixel] + frame[pixel + 1] + frame[pixel + 2]) / 3;
      const previousGray = (previousFrame[pixel] + previousFrame[pixel + 1] + previousFrame[pixel + 2]) / 3;
      energy += Math.abs(currentGray - previousGray);
    }

    samples.push({ time, energy });
    previousFrame = frame;
  }

  const energies = samples.map((sample) => sample.energy).sort((a, b) => a - b);
  const baseline = energies[Math.floor(energies.length * 0.35)] || 0;
  const peak = Math.max(...energies, baseline);

  if (peak <= baseline * 1.2) {
    return {
      start: Math.max(0, duration * 0.2),
      end: Math.min(duration, duration * 0.8),
    };
  }

  const threshold = baseline + (peak - baseline) * 0.24;
  const peakIndex = samples.findIndex((sample) => sample.energy === peak);

  let startIndex = peakIndex;
  while (startIndex > 0 && samples[startIndex].energy > threshold) {
    startIndex -= 1;
  }

  let endIndex = peakIndex;
  while (endIndex < samples.length - 1 && samples[endIndex].energy > threshold * 0.82) {
    endIndex += 1;
  }

  const leadIn = Math.max(0.45, duration * 0.03);
  const tailOut = Math.max(0.75, duration * 0.05);

  return {
    start: Math.max(0, (samples[startIndex]?.time ?? 0) - leadIn),
    end: Math.min(duration, (samples[endIndex]?.time ?? duration) + tailOut),
  };
}

function waitForVideoReady(video) {
  return new Promise((resolve, reject) => {
    const done = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(new Error("Video metadata failed to load."));
    };
    const cleanup = () => {
      video.removeEventListener("loadeddata", done);
      video.removeEventListener("error", fail);
    };

    video.addEventListener("loadeddata", done, { once: true });
    video.addEventListener("error", fail, { once: true });
  });
}

function buildSmoothPath(points) {
  if (points.length < 2) {
    return "";
  }

  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] || points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }

  return path;
}

function drawSmoothCanvasPath(context, points, width, height) {
  if (points.length < 2) {
    return;
  }

  context.beginPath();
  context.moveTo((points[0].x / 100) * width, (points[0].y / 100) * height);

  if (points.length === 2) {
    context.lineTo((points[1].x / 100) * width, (points[1].y / 100) * height);
    context.stroke();
    return;
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] || points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] || p2;

    const cp1x = (p1.x + (p2.x - p0.x) / 6) / 100 * width;
    const cp1y = (p1.y + (p2.y - p0.y) / 6) / 100 * height;
    const cp2x = (p2.x - (p3.x - p1.x) / 6) / 100 * width;
    const cp2y = (p2.y - (p3.y - p1.y) / 6) / 100 * height;
    const endX = (p2.x / 100) * width;
    const endY = (p2.y / 100) * height;

    context.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endX, endY);
  }

  context.stroke();
}

export default App;

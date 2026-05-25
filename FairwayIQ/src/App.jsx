import { useEffect, useMemo, useRef, useState } from "react";

const PLAYBACK_PRESETS = [0.25, 0.5, 0.75, 1];
const STEPS = [
  { id: 0, label: "Import", title: "Choose video" },
  { id: 1, label: "Impact", title: "Mark ball" },
  { id: 2, label: "Apex", title: "Set curve" },
  { id: 3, label: "Landing", title: "Set finish" },
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
    motif: "HAT",
    detail: "Deep green rope hat with brass hardware and crossed-club badge.",
  },
  {
    name: "Practice Crew",
    tag: "Concept 04",
    motif: "CREW",
    detail: "Cream heavyweight layer with oversized putting graphic on the back.",
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
  const [videoAspect, setVideoAspect] = useState("16 / 9");
  const [duration, setDuration] = useState(0);
  const [timelineValue, setTimelineValue] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(0.5);
  const [isPlaying, setIsPlaying] = useState(false);
  const [exportState, setExportState] = useState("idle");
  const [exportProgress, setExportProgress] = useState(0);
  const [videoError, setVideoError] = useState("");
  const [status, setStatus] = useState("Import or record one swing video. Then the editor walks you through the shot trace one step at a time.");

  const [impactTime, setImpactTime] = useState(null);
  const [startPoint, setStartPoint] = useState(null);
  const [apexPoint, setApexPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [impactFrame, setImpactFrame] = useState(null);
  const [landingFrame, setLandingFrame] = useState(null);
  const [placementMode, setPlacementMode] = useState(null);
  const [selectedHandle, setSelectedHandle] = useState(null);
  const [fps, setFps] = useState(60);
  const [curveSettings, setCurveSettings] = useState({
    ballSpeed: 62,
    flightTime: 1.25,
    glow: 82,
  });

  useEffect(() => {
    return () => {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    };
  }, [sourceUrl]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const currentFrame = Math.max(0, Math.round(timelineValue * fps));
  const activeStep = !sourceUrl ? 0 : !startPoint ? 1 : !apexPoint ? 2 : !endPoint ? 3 : 4;
  const readyToTrace = Boolean(sourceUrl && startPoint && apexPoint && endPoint && impactTime != null);
  const flightEndTime = impactTime == null ? curveSettings.flightTime : impactTime + curveSettings.flightTime;

  const apexHandle = useMemo(() => {
    return apexPoint;
  }, [apexPoint]);

  const fullTracePoints = useMemo(() => {
    if (!startPoint || !apexPoint || !endPoint || impactTime == null) return [];

    return buildManualTracePoints(startPoint, apexPoint, endPoint, impactTime, curveSettings.flightTime);
  }, [startPoint, apexPoint, endPoint, impactTime, curveSettings.flightTime]);

  const visibleTracePoints = useMemo(() => {
    if (!readyToTrace) return [];
    if (timelineValue < impactTime) return [];

    const progress = clamp((timelineValue - impactTime) / curveSettings.flightTime, 0, 1);
    const minimumPreview = isPlaying ? progress : Math.max(progress, activeStep === 3 ? 1 : 0);
    const visibleCount = Math.max(2, Math.ceil(fullTracePoints.length * minimumPreview));
    return fullTracePoints.slice(0, visibleCount);
  }, [activeStep, curveSettings.flightTime, fullTracePoints, impactTime, isPlaying, readyToTrace, timelineValue]);

  const guidePath = useMemo(() => {
    if (fullTracePoints.length < 2) return "";
    return buildSmoothPath(fullTracePoints);
  }, [fullTracePoints]);

  const tracePath = useMemo(() => buildSmoothPath(visibleTracePoints), [visibleTracePoints]);

  function handleVideoSelect(event, mode) {
    const [file] = event.target.files || [];
    if (!file) return;

    if (sourceUrl) URL.revokeObjectURL(sourceUrl);

    setSourceUrl(URL.createObjectURL(file));
    setSourceName(file.name);
    setSourceMode(mode);
    setDuration(0);
    setVideoAspect("16 / 9");
    setTimelineValue(0);
    setPlaybackRate(0.5);
    setIsPlaying(false);
    setExportState("idle");
    setExportProgress(0);
    setVideoError("");
    setImpactTime(null);
    setImpactFrame(null);
    setLandingFrame(null);
    setStartPoint(null);
    setApexPoint(null);
    setEndPoint(null);
    setPlacementMode(null);
    setSelectedHandle(null);
    setStatus("Video loaded. Scrub to the exact contact frame, then tap Mark Impact + Ball and place the dot on the ball.");
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

  function getOverlayPoint(event) {
    const bounds = overlayRef.current.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - bounds.left) / bounds.width) * 100, 0, 100),
      y: clamp(((event.clientY - bounds.top) / bounds.height) * 100, 0, 100),
    };
  }

  function handleOverlayPointerDown(event) {
    if (!overlayRef.current) return;

    if (placementMode === "start") {
      const point = getOverlayPoint(event);
      const time = videoRef.current?.currentTime ?? timelineValue;
      setImpactTime(time);
      setImpactFrame(Math.round(time * fps));
      setStartPoint(point);
      setApexPoint((current) => current ?? defaultApexFromStart(point));
      setPlacementMode(null);
      setSelectedHandle("start");
      setStatus("Start point locked. Step 2: tap Set Apex and place the highest point of the ball flight.");
      return;
    }

    if (placementMode === "apex") {
      const point = getOverlayPoint(event);
      setApexPoint(point);
      setPlacementMode(null);
      setSelectedHandle("apex");
      setStatus("Apex locked. Step 3: scrub to where the ball lands or disappears and tap Mark Landing.");
      return;
    }

    if (placementMode === "end") {
      const point = getOverlayPoint(event);
      const time = videoRef.current?.currentTime ?? timelineValue;
      const flightTime = startPoint ? estimateFlightTime(startPoint, point, curveSettings.ballSpeed) : 1.25;
      setEndPoint(point);
      setLandingFrame(Math.round(time * fps));
      setCurveSettings((current) => ({ ...current, flightTime }));
      setPlacementMode(null);
      setSelectedHandle("end");
      setStatus("Trace is ready. Drag the start, apex, or landing dot until it matches the shot.");
    }
  }

  function beginDrag(event, handle) {
    event.stopPropagation();
    dragRef.current = handle;
    setSelectedHandle(handle);
  }

  function moveDraggedHandle(event) {
    if (!dragRef.current || !overlayRef.current) return;

    const point = getOverlayPoint(event);
    if (dragRef.current === "start") {
      setStartPoint(point);
      return;
    }
    if (dragRef.current === "apex") {
      setApexPoint(point);
      return;
    }
    if (dragRef.current === "end") {
      setEndPoint(point);
      return;
    }
  }

  function stopDrag() {
    dragRef.current = null;
  }

  function resetTrace() {
    setImpactTime(null);
    setImpactFrame(null);
    setLandingFrame(null);
    setStartPoint(null);
    setApexPoint(null);
    setEndPoint(null);
    setPlacementMode(null);
    setSelectedHandle(null);
    setStatus("Trace reset. Scrub to impact and place the start, apex, and landing points again.");
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
    context.strokeStyle = "#ff2d24";
    context.shadowColor = "rgba(255, 45, 36, 0.88)";
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
    <main className="site-shell">
      <header className="brand-nav">
        <a className="wordmark" href="#top" aria-label="ifonlyicouldputt home">ifonlyicouldputt</a>
        <nav className="nav-links" aria-label="Primary navigation">
          <a href="#drop">Drop</a>
          <a href="#tracker">Tracer</a>
          <a href="mailto:ifonlyicouldputt@icloud.com">Contact</a>
        </nav>
      </header>

      <section id="top" className="hero-grid">
        <div className="hero-copy">
          <p className="hero-script">The short game. Shorter.</p>
          <h1>Golf clothing and shot tracing built for everyday players.</h1>
          <p>
            ifonlyicouldputt is a golf brand building premium short-game apparel and a simple tracer studio for turning real swing videos into clean red ball-flight edits.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#tracker">Open shot tracer</a>
            <a className="secondary-button" href="#drop">View coming soon drop</a>
          </div>
        </div>
        <div className="hero-board">
          <img src="/brand/ifonlyicouldputt-performance-polo.png" alt="ifonlyicouldputt performance polo design board" />
          <div className="hero-board-card">
            <span>EST. 2026</span>
            <strong>ifonlyicouldputt</strong>
          </div>
        </div>
      </section>

      <section id="drop" className="drop-section">
        <div className="section-heading">
          <span>Coming soon</span>
          <h2>First drop, built around the short game.</h2>
        </div>
        <div className="product-grid">
          {PRODUCT_DROPS.map((product) => (
            <article className="product-card" key={product.name}>
              {product.image ? (
                <img src={product.image} alt={`${product.name} design concept`} />
              ) : (
                <div className="product-art"><strong>{product.motif}</strong></div>
              )}
              <div className="product-card-copy">
                <span>{product.tag} · Coming soon</span>
                <h3>{product.name}</h3>
                <p>{product.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="tracker" className="tracker-section">
        <div className="tracker-head">
          <div>
            <span>Shot tracer studio</span>
            <h2>Step by step, no guessing.</h2>
            <p>{status}</p>
          </div>
          <div className="tracker-metrics">
            <div><span>Frame</span><strong>{currentFrame}</strong></div>
            <div><span>Speed</span><strong>{playbackRate}x</strong></div>
            <div><span>Mode</span><strong>{sourceMode === "live" ? "Live" : "Upload"}</strong></div>
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

          <div className="studio-layout">
            <section className="video-column">
              <div className="video-stage" style={{ "--video-aspect": videoAspect }}>
                {sourceUrl ? (
                  <>
                    <video
                      ref={videoRef}
                      className="tracer-video"
                      src={sourceUrl}
                      playsInline
                      controls
                      preload="metadata"
                      onLoadedMetadata={(event) => {
                        const nextDuration = event.currentTarget.duration || 0;
                        const width = event.currentTarget.videoWidth || 16;
                        const height = event.currentTarget.videoHeight || 9;
                        setDuration(nextDuration);
                        setVideoAspect(`${width} / ${height}`);
                        setTimelineValue(0);
                        event.currentTarget.playbackRate = playbackRate;
                      }}
                      onTimeUpdate={(event) => setTimelineValue(event.currentTarget.currentTime)}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onError={() => {
                        setVideoError("This video format is not loading in this browser. If it is an iPhone HEVC .MOV, try exporting as H.264 MP4.");
                        setStatus("The video could not load here. The tracer works best with H.264 MP4 or Safari-compatible MOV files.");
                      }}
                    />
                    <div
                      ref={overlayRef}
                      className={placementMode ? "trace-overlay placing" : "trace-overlay"}
                      onPointerDown={handleOverlayPointerDown}
                      onPointerMove={moveDraggedHandle}
                      onPointerUp={stopDrag}
                      onPointerCancel={stopDrag}
                      onPointerLeave={stopDrag}
                    >
                      <svg className="trace-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {guidePath ? <path d={guidePath} className="trace-guide" /> : null}
                        {tracePath ? <path d={tracePath} className="trace-line" style={{ "--trace-glow": `${curveSettings.glow / 100}` }} /> : null}
                        {startPoint ? <TraceHandle point={startPoint} type="start" active={selectedHandle === "start"} onPointerDown={(event) => beginDrag(event, "start")} /> : null}
                        {apexHandle ? <TraceHandle point={apexHandle} type="apex" active={selectedHandle === "apex"} onPointerDown={(event) => beginDrag(event, "apex")} /> : null}
                        {endPoint ? <TraceHandle point={endPoint} type="end" active={selectedHandle === "end"} onPointerDown={(event) => beginDrag(event, "end")} /> : null}
                      </svg>
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
            </section>

            <aside className="control-column">
              <div className="import-actions">
                <button className="primary-button record-button" type="button" onClick={() => liveInputRef.current?.click()}>Record Live Swing</button>
                <button className="secondary-button" type="button" onClick={() => uploadInputRef.current?.click()}>Upload Existing Video</button>
                <input ref={liveInputRef} className="sr-only" type="file" accept="video/*" capture="environment" onChange={(event) => handleVideoSelect(event, "live")} />
                <input ref={uploadInputRef} className="sr-only" type="file" accept="video/*" onChange={(event) => handleVideoSelect(event, "upload")} />
              </div>

              <div className="instruction-stack">
                <article className={activeStep === 1 ? "instruction-card active" : "instruction-card"}>
                  <span>01</span>
                  <h3>Find impact</h3>
                  <p>Scrub or tap Frame +/- until the club meets the ball.</p>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={!sourceUrl}
                    onClick={() => {
                      setPlacementMode("start");
                      setStatus("Tap the ball on the video. That point becomes the tracer start and the impact frame.");
                    }}
                  >
                    Mark Impact + Ball
                  </button>
                </article>

                <article className={activeStep === 2 ? "instruction-card active" : "instruction-card"}>
                  <span>02</span>
                  <h3>Set apex</h3>
                  <p>Tap the highest point of the shot. This controls the curve directly.</p>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={!startPoint}
                    onClick={() => {
                      setPlacementMode("apex");
                      setStatus("Tap the highest point of the tracer. You can drag it again later.");
                    }}
                  >
                    Mark Apex
                  </button>
                </article>

                <article className={activeStep === 3 ? "instruction-card active" : "instruction-card"}>
                  <span>03</span>
                  <h3>Set landing</h3>
                  <p>Scrub forward to where the ball finishes, then tap the landing point.</p>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={!apexPoint}
                    onClick={() => {
                      setPlacementMode("end");
                      setStatus("Tap where the ball landed or disappeared. You can adjust the curve after.");
                    }}
                  >
                    Mark Landing
                  </button>
                </article>

                <article className={readyToTrace ? "instruction-card active" : "instruction-card"}>
                  <span>04</span>
                  <h3>Shape the flight</h3>
                  <p>Drag any dot. The replay and export use this exact same path.</p>
                  <div className="tiny-grid">
                    <button className="secondary-button" type="button" onClick={jumpToImpact} disabled={!readyToTrace}>Go to Impact</button>
                    <button className="secondary-button" type="button" onClick={resetTrace} disabled={!startPoint && !apexPoint && !endPoint}>Reset</button>
                  </div>
                </article>
              </div>

              <div className="shape-panel">
                <RangeField label="Ball speed" value={curveSettings.ballSpeed} min={20} max={100} disabled={!readyToTrace} onChange={(value) => setCurveSettings((current) => ({ ...current, ballSpeed: value, flightTime: startPoint && endPoint ? estimateFlightTime(startPoint, endPoint, value) : current.flightTime }))} />
                <RangeField label="Tracer glow" value={curveSettings.glow} min={20} max={100} disabled={!readyToTrace} onChange={(value) => setCurveSettings((current) => ({ ...current, glow: value }))} />
                <p className="shape-note">Use the dots for shape. Use speed for how fast the tracer appears during replay/export.</p>
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
                <div><span>Apex</span><strong>{apexPoint ? "Set" : "--"}</strong></div>
                <div><span>Landing</span><strong>{landingFrame ?? "--"}</strong></div>
                <div><span>Flight</span><strong>{readyToTrace ? `${curveSettings.flightTime.toFixed(2)}s` : "--"}</strong></div>
                <div><span>End</span><strong>{impactTime == null ? "--" : formatTime(flightEndTime)}</strong></div>
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
            </aside>
          </div>
        </div>
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

function defaultApexFromStart(start) {
  return {
    x: clamp(start.x + 18, 0, 100),
    y: clamp(start.y - 28, 0, 100),
  };
}

function buildManualTracePoints(start, apex, end, impactTime, flightTime) {
  const points = [];
  const totalSamples = 72;

  for (let index = 0; index <= totalSamples; index += 1) {
    const t = index / totalSamples;
    const point = quadraticPoint(start, apex, end, t);
    points.push({
      ...point,
      time: impactTime + flightTime * t,
    });
  }

  return points;
}

function quadraticPoint(start, apex, end, t) {
  const inv = 1 - t;

  return {
    x: clamp(inv * inv * start.x + 2 * inv * t * apex.x + t * t * end.x, 0, 100),
    y: clamp(inv * inv * start.y + 2 * inv * t * apex.y + t * t * end.y, 0, 100),
  };
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
      context.strokeStyle = "#ff2d24";
      context.shadowColor = "rgba(255, 45, 36, 0.9)";
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
  for (let index = 0; index < points.length - 1; index += 1) {
    const p2 = points[index + 1];
    path += ` L ${p2.x} ${p2.y}`;
  }
  return path;
}

function drawSmoothCanvasPath(context, points, width, height) {
  if (points.length < 2) return;
  context.beginPath();
  context.moveTo((points[0].x / 100) * width, (points[0].y / 100) * height);

  for (let index = 1; index < points.length; index += 1) {
    context.lineTo((points[index].x / 100) * width, (points[index].y / 100) * height);
  }
  context.stroke();
}

export default App;

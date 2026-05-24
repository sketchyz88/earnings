import { useRef, useState } from "react";

function VideoLibrary({ videos, onUploadVideo, busy }) {
  const inputRef = useRef(null);
  const [caption, setCaption] = useState("");

  async function handleFileChange(event) {
    const [file] = event.target.files || [];

    if (!file) {
      return;
    }

    await onUploadVideo(file, caption.trim());
    setCaption("");
    event.target.value = "";
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Swing Vault</p>
          <h2>Video library</h2>
        </div>
        <span className="pill">{videos.length} clips</span>
      </div>

      <div className="stack">
        <label className="field">
          <span>Clip note</span>
          <input
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Face-on driver swing"
          />
        </label>

        <button className="primary-button" type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? "Uploading..." : "Upload Swing Video"}
        </button>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept="video/*"
          onChange={handleFileChange}
        />

        <div className="video-list">
          {videos.length ? (
            videos.map((video) => (
              <article className="video-card" key={video.id}>
                <div className="video-thumb">
                  {video.file_url ? (
                    <video src={video.file_url} controls playsInline preload="metadata" />
                  ) : (
                    <div className="video-placeholder">Processing</div>
                  )}
                </div>
                <div className="video-copy">
                  <h3>{video.title || "Untitled swing"}</h3>
                  <p>{video.notes || "Stored in your FairwayIQ swing vault."}</p>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-state">Upload your first swing to build a private review library.</div>
          )}
        </div>
      </div>
    </section>
  );
}

export default VideoLibrary;

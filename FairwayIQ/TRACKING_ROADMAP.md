# Shot Tracer Roadmap

## Goal

Build a golf tracer that is respectable on real uploaded swing videos, especially wide course clips where the ball is tiny and disappears quickly.

## Current Product Direction

The web app should behave like an assisted tracer studio:

1. User scrubs to impact.
2. User marks the ball at impact.
3. Tracking assist analyzes post-impact frames.
4. App proposes apex + carry direction + landing estimate.
5. User corrects only when needed.

This is more realistic than promising fully automatic ball tracking on every clip.

## Near-Term Priorities

### 1. Tracking Lab

- Camera profile selection
- Detection stage feedback
- Frames scanned
- Detection hit count
- Visible debug points overlay

### 2. Smarter Web Tracking

- Better post-impact search windows
- Bright moving-object scoring
- Prediction through temporary misses
- Separate tuning for range clips vs wide fairway clips
- Landing projection when the ball disappears

### 3. Dataset and Evaluation

We need a repeatable test pack of real swings.

Recommended first dataset:

- 10 range videos
- 10 wide-course videos
- 10 different lighting conditions if possible

For each clip, label:

- impact frame
- ball start point
- 3-5 visible ball flight points
- landing/disappear point

This gives us something measurable to tune against.

## Medium-Term Upgrade

Add OpenCV-backed analysis pass in the browser:

- frame differencing
- background subtraction
- contour extraction
- candidate ranking

Keep manual correction as a core feature even after this improves.

## Best Long-Term Version

Build the actual tracking engine as a native iPhone app using Apple Vision / Metal / native video processing.

The website remains:

- brand site
- upload/demo studio
- merch/storefront
- lightweight tracer editor

The native app becomes:

- high-quality tracking
- better performance
- more reliable video analysis
- future live capture workflows

## Success Criteria

The tracer is good enough when:

- it finds a usable first pass on most well-shot range clips
- it produces a believable carry direction on wide clips
- the user only needs small manual correction, not full redraw
- replay and export look premium


import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export class GestureService {
  private handLandmarker: HandLandmarker | null = null;
  private video: HTMLVideoElement | null = null;
  private lastVideoTime = -1;

  async init() {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
    );
    this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numHands: 1
    });
  }

  setVideo(video: HTMLVideoElement) {
    this.video = video;
  }

  process() {
    if (!this.handLandmarker || !this.video || this.video.readyState < 2) return null;

    const startTimeMs = performance.now();
    if (this.lastVideoTime !== this.video.currentTime) {
      this.lastVideoTime = this.video.currentTime;
      const results = this.handLandmarker.detectForVideo(this.video, startTimeMs);
      return results;
    }
    return null;
  }
}

export const gestureService = new GestureService();

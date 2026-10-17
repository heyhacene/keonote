/**
 * Gestionnaire d'enregistrement vocal & reconnaissance vocale temps réel
 */

export interface AudioRecordingResult {
  audioBlob: Blob;
  audioDataUrl: string;
  durationSec: number;
}

export class VoiceRecordingManager {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private recognition: any = null;
  private startTime = 0;

  public isRecording = false;

  /**
   * Démarre l'enregistrement audio et la reconnaissance vocale simultanée
   */
  public async start(
    onLiveTranscript: (text: string) => void,
    onWaveformData: (amplitudes: number[]) => void
  ): Promise<boolean> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.startTime = Date.now();

      // 1. Initialisation MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      this.mediaRecorder = mimeType
        ? new MediaRecorder(this.stream, { mimeType })
        : new MediaRecorder(this.stream);

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.mediaRecorder.start(250);

      // 2. Initialisation Web Audio API pour la forme d'onde animée
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
        const source = this.audioContext.createMediaStreamSource(this.stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 64;
        source.connect(this.analyser);

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        const updateWaveform = () => {
          if (!this.analyser || !this.isRecording) return;
          this.analyser.getByteFrequencyData(dataArray);

          // Sélectionner 12 barres d'amplitude normalisées entre 0 et 100
          const bars: number[] = [];
          const step = Math.floor(dataArray.length / 12) || 1;
          for (let i = 0; i < 12; i++) {
            const val = dataArray[i * step] || 0;
            bars.push(Math.max(10, Math.round((val / 255) * 100)));
          }
          onWaveformData(bars);
          this.animFrameId = requestAnimationFrame(updateWaveform);
        };
        this.isRecording = true;
        updateWaveform();
      } else {
        this.isRecording = true;
      }

      // 3. Reconnaissance vocale native (Web Speech API)
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'fr-FR';

        let fullTranscript = '';
        this.recognition.onresult = (event: any) => {
          let interim = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              fullTranscript += event.results[i][0].transcript + ' ';
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          onLiveTranscript((fullTranscript + interim).trim());
        };

        this.recognition.onerror = (e: any) => {
          console.warn('Speech recognition status:', e?.error);
        };

        try {
          this.recognition.start();
        } catch (recErr) {
          console.warn('Could not start native speech recognition:', recErr);
        }
      }

      return true;
    } catch (err) {
      console.error('Erreur accès microphone:', err);
      this.isRecording = false;
      return false;
    }
  }

  /**
   * Arrête l'enregistrement et retourne l'audio + durée
   */
  public async stop(): Promise<AudioRecordingResult | null> {
    this.isRecording = false;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        await this.audioContext.close();
      } catch (e) {}
      this.audioContext = null;
    }

    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
      this.recognition = null;
    }

    const durationSec = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));

    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        this.cleanupStream();
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, {
          type: this.mediaRecorder?.mimeType || 'audio/webm',
        });
        const reader = new FileReader();
        reader.onloadend = () => {
          const audioDataUrl = reader.result as string;
          this.cleanupStream();
          resolve({ audioBlob, audioDataUrl, durationSec });
        };
        reader.readAsDataURL(audioBlob);
      };

      try {
        this.mediaRecorder.stop();
      } catch (e) {
        this.cleanupStream();
        resolve(null);
      }
    });
  }

  private cleanupStream() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
  }
}

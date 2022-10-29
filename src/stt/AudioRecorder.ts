const PCM32fToPCM16i = (input: Float32Array) => {
    const result = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        const val = input[i];
        result[i] = Math.max(-32768, Math.min(32767, Math.floor(32767 * val)));
    }
    return result;
};

type onAudioChunkCb = (chunk: Int16Array) => void;

const oldBrowser = true;
// const oldBrowser = !AudioWorkletNode;

class AudioRecorder {
    protected inited: boolean;
    protected audioStream: MediaStream | null;
    protected audioContext: AudioContext | null;
    protected audioChunks: Array<Int16Array>;
    protected recordingLength: number;
    protected audioChunk: Int16Array;
    protected audioChunkCursor = 0;
    protected recorder: ScriptProcessorNode | AudioWorkletNode | null;
    protected audioChunkSize: number
    onAudioChunk: onAudioChunkCb | null;

    constructor(audioChunkSize?: number) {
        this.inited = false;
        this.audioStream = null;
        this.audioContext = null;
        this.audioChunks = [];
        this.recordingLength = 0;
        this.audioChunk = new Int16Array(audioChunkSize || 2048);
        this.audioChunkCursor = 0;
        this.recorder = null;
        this.onAudioChunk = null;
    }

    protected onAudioChunkPart = (chunkPart: Int16Array) => {
        this.audioChunk.set(chunkPart, this.audioChunkCursor);
        this.audioChunkCursor += chunkPart.length;
        if (this.audioChunkCursor >= this.audioChunk.length) {
            if (this.onAudioChunk) {
                this.onAudioChunk(this.audioChunk.slice());
            }
            this.audioChunks.push(this.audioChunk);
            this.recordingLength += this.audioChunk.length;
            this.audioChunkCursor = 0;
        }
    };

    async init() {
        if (this.inited) {
            console.warn('AudioRecorder already initialized!');
            return;
        }

        this.audioContext = new AudioContext();
        this.audioStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
        });
        const audioInput = this.audioContext.createMediaStreamSource(
            this.audioStream
        );
        const volume = this.audioContext.createGain();
        audioInput.connect(volume);
        const bufferSize = 2048;

        if (oldBrowser) {
            this.recorder = this.audioContext.createScriptProcessor(
                bufferSize,
                1,
                1
            );
            this.recorder.onaudioprocess = (event: AudioProcessingEvent) => {
                const samples = event.inputBuffer.getChannelData(0);
                const PCM16ifSamples = PCM32fToPCM16i(samples);
                this.onAudioChunkPart(PCM16ifSamples);
            };
        } else {
            await this.audioContext.audioWorklet.addModule(
                '/listen-processor.js'
            );
            this.recorder = new AudioWorkletNode(
                this.audioContext,
                'listen-processor',
                {
                    numberOfInputs: 1,
                }
            );
            this.recorder.port.onmessage = (ev: MessageEvent<Float32Array>) => {
                const PCM16ifSamples = PCM32fToPCM16i(ev.data);
                this.onAudioChunkPart(PCM16ifSamples);
            };
        }
        volume.connect(this.recorder);
        this.inited = true;
    }

    start = async () => {
        this.audioChunks = [];
        this.recordingLength = 0;
        this.audioChunkCursor = 0;
        if (!this.inited) {
            await this.init();
        }
        this.recorder.connect(this.audioContext.destination);
    };

    stop = () => {
        if (!this.inited) {
            return;
        }
        this.recorder.disconnect();
        console.log('Recorder stopped');
    };

    getSampleRate = () =>
        this.audioContext ? this.audioContext.sampleRate : null;

    isInited = () => this.inited;

    getAudioData = () =>
        new Blob(this.audioChunks, { type: 'audio/raw; codecs=pcm_s16le' });

    setAudioChunkSize = (chunkSize: number) => {
        this.audioChunk = new Int16Array(chunkSize);
        this.audioChunkCursor = 0;
    }

    close = () => {
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
        // Maybe not needed
        if (this.audioStream) {
            this.audioStream.getTracks().forEach((track: MediaStreamTrack) => {
                track.stop();
            });
        }
        this.inited = false;
    };
}

export default AudioRecorder;

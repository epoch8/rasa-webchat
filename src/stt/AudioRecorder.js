"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const PCM32fToPCM16i = (input) => {
    const result = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
        const val = input[i];
        result[i] = Math.max(-32768, Math.min(32767, Math.floor(32767 * val)));
    }
    return result;
};
const oldBrowser = true;
// const oldBrowser = !AudioWorkletNode;
class AudioRecorder {
    constructor() {
        this.start = () => __awaiter(this, void 0, void 0, function* () {
            this.audioChunks = [];
            this.recordingLength = 0;
            if (!this.inited) {
                yield this.init();
            }
            this.recorder.connect(this.audioContext.destination);
        });
        this.stop = () => {
            if (!this.inited) {
                return;
            }
            this.recorder.disconnect();
            console.log('Recorder stopped');
        };
        this.getSampleRate = () => this.audioContext ? this.audioContext.sampleRate : null;
        this.isInited = () => this.inited;
        this.getAudioData = () => new Blob(this.audioChunks, { type: 'audio/raw; codecs=pcm_s16le' });
        this.close = () => {
            if (this.audioContext && this.audioContext.state !== 'closed') {
                this.audioContext.close();
            }
            // Maybe not needed
            if (this.audioStream) {
                this.audioStream.getTracks().forEach((track) => {
                    track.stop();
                });
            }
            this.inited = false;
        };
        this.inited = false;
        this.audioStream = null;
        this.audioContext = null;
        this.audioChunks = [];
        this.recordingLength = 0;
        this.recorder = null;
        this.onAudioChunk = null;
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.inited) {
                console.warn('AudioRecorder already initialized!');
                return;
            }
            this.audioContext = new AudioContext();
            this.audioStream = yield navigator.mediaDevices.getUserMedia({
                audio: true,
            });
            const audioInput = this.audioContext.createMediaStreamSource(this.audioStream);
            const volume = this.audioContext.createGain();
            audioInput.connect(volume);
            const bufferSize = 2048;
            if (oldBrowser) {
                this.recorder = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
                this.recorder.onaudioprocess = (event) => {
                    const samples = event.inputBuffer.getChannelData(0);
                    const PCM16ifSamples = PCM32fToPCM16i(samples);
                    this.audioChunks.push(PCM16ifSamples);
                    this.recordingLength += bufferSize;
                    if (this.onAudioChunk) {
                        this.onAudioChunk(PCM16ifSamples);
                    }
                };
            }
            else {
                yield this.audioContext.audioWorklet.addModule('/listen-processor.js');
                this.recorder = new AudioWorkletNode(this.audioContext, 'listen-processor', {
                    numberOfInputs: 1,
                });
                this.recorder.port.onmessage = (ev) => {
                    const PCM16ifSamples = PCM32fToPCM16i(ev.data);
                    this.audioChunks.push(PCM16ifSamples);
                    this.recordingLength += PCM16ifSamples.length;
                    if (this.onAudioChunk) {
                        this.onAudioChunk(PCM16ifSamples);
                    }
                };
            }
            volume.connect(this.recorder);
            this.inited = true;
        });
    }
}
exports.default = AudioRecorder;
//# sourceMappingURL=AudioRecorder.js.map
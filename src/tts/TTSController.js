"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
class TTSController {
    constructor(ttsServerUrl) {
        this.playNextTrack = () => {
            if (this.playing || this.tracks.length === 0) {
                // console.log('this.playing || this.tracks.length === 0');
                return;
            }
            console.log('Playing next track');
            this.playing = true;
            const track = this.tracks.pop();
            const audioURL = window.URL.createObjectURL(track);
            this.audioElement = new Audio(audioURL);
            this.audioElement.oncanplaythrough = event => {
                console.log('oncanplaythrough');
                this.audioElement.play();
            };
            this.audioElement.onended = event => {
                window.URL.revokeObjectURL(audioURL);
                this.playing = false;
                this.audioElement = null;
                console.log('onended');
                this.playNextTrack();
            };
        };
        this.isActive = () => this.active;
        this.enqueue = (text, config) => {
            this.tasks.push({ text, config });
            if (!this.ws) {
                this.processNextTask();
            }
        };
        this.cleanup = () => {
            if (this.ws) {
                this.ws.onopen = null;
                this.ws.onmessage = null;
                this.ws.onclose = null;
                this.ws.onerror = null;
                this.ws.close();
            }
            if (this.audioElement) {
                this.audioElement.pause();
                this.audioElement = null;
            }
            this.audioChunks = [];
            this.tracks = [];
            this.tasks = [];
        };
        this.active = false;
        this.ttsServerUrl = ttsServerUrl || 'ws://localhost:2700';
        this.ws = null;
        this.audioChunks = [];
        this.tracks = [];
        this.tasks = [];
        this.playing = false;
        this.audioElement = null;
        this.onActiveChange = null;
    }
    processNextTask() {
        if (this.ws) {
            console.error('WS alredy openned!');
            return;
        }
        const task = this.tasks.pop();
        if (!task) {
            return;
        }
        this.ws = new WebSocket(this.ttsServerUrl);
        this.ws.onopen = (ev) => {
            this.setActive(true);
            if (task.config) {
                const _a = task.config, { apiKey } = _a, config = __rest(_a, ["apiKey"]);
                if (apiKey) {
                    this.ws.send(apiKey);
                }
                this.ws.send(JSON.stringify({ config }));
            }
            this.ws.send(task.text);
        };
        this.ws.onmessage = (ev) => {
            // console.log('Response:', ev.data);
            const audioData = ev.data;
            this.audioChunks.push(audioData);
        };
        this.ws.onclose = (ev) => {
            console.info('Socket closed');
            console.info(ev);
            this.setActive(false);
            this.ws = null;
            this.tracks.push(new Blob(this.audioChunks));
            this.audioChunks = [];
            this.playNextTrack();
            this.processNextTask();
        };
        this.ws.onerror = (ev) => {
            console.error('WS error:', ev);
        };
    }
    setActive(active) {
        this.active = active;
        if (this.onActiveChange) {
            this.onActiveChange(active);
        }
    }
}
exports.default = TTSController;
//# sourceMappingURL=TTSController.js.map
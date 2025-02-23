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
            if (this.playing || this.audioTasks.length === 0) {
                return;
            }
            console.log('Playing next track');
            this.playing = true;
            const audioTask = this.audioTasks.pop();
            this.audioURL = window.URL.createObjectURL(audioTask.audioData);
            this.audioElement.src = this.audioURL;
            this.audioElement.onended = event => {
                this.closeAudio();
                console.log('onended');
                if (audioTask.ttsTask.cb) {
                    audioTask.ttsTask.cb(audioTask.ttsTask);
                }
                if (this.audioTasks.length === 0) {
                    if (this.onTracksPlayed) {
                        this.onTracksPlayed();
                    }
                }
                else {
                    this.playNextTrack();
                }
            };
            this.audioElement.load();
            this.audioElement.play();
            console.log('playing');
        };
        this.isActive = () => this.active;
        this.enqueue = (text, config, onTrackPlayed) => {
            this.ttsTasks.push({ text, config, cb: onTrackPlayed });
            if (!this.ws) {
                this.processNextTask();
            }
        };
        this.cleanup = () => {
            this.closeSocket();
            this.closeAudio();
            this.audioChunks = [];
            this.audioTasks = [];
            this.ttsTasks = [];
        };
        this.active = false;
        this.ttsServerUrl = ttsServerUrl || 'ws://localhost:2700';
        this.ws = null;
        this.audioChunks = [];
        this.audioTasks = [];
        this.ttsTasks = [];
        this.playing = false;
        this.audioElement = new Audio();
        this.audioURL = null;
        this.onActiveChange = null;
    }
    processNextTask() {
        if (this.ws) {
            console.error('WS alredy openned!');
            return;
        }
        const task = this.ttsTasks.pop();
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
            this.audioTasks.push({ audioData: new Blob(this.audioChunks), ttsTask: task });
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
    closeSocket() {
        if (this.ws) {
            this.ws.onopen = null;
            this.ws.onmessage = null;
            this.ws.onclose = null;
            this.ws.onerror = null;
            this.ws.close();
            this.ws = null;
        }
    }
    closeAudio() {
        this.audioElement.src = '';
        if (this.audioURL) {
            window.URL.revokeObjectURL(this.audioURL);
            this.audioURL = null;
        }
        this.playing = false;
    }
}
exports.default = TTSController;
//# sourceMappingURL=TTSController.js.map
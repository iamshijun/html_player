interface HTMLVideoElement extends HTMLMediaElement {
    webkitEnterFullscreen?: () => void;
    webkitExitFullscreen?: () => void;
    webkitSupportsFullscreen?: boolean;
    webkitDisplayingFullscreen?: boolean;
}
declare module 'dplayer' {
    class DPlayer {
        constructor(options: any);
        play(): void;
        pause(): void;
        destroy(): void;
        // 添加其他需要的方法声明
    }
    export default DPlayer;
}
interface ScreenOrientation {
    lock(orientation: OrientationLockType): Promise<void>;
}

type OrientationLockType = 
    | "any"
    | "natural"
    | "landscape"
    | "portrait"
    | "portrait-primary"
    | "portrait-secondary"
    | "landscape-primary"
    | "landscape-secondary";

interface Screen {
    orientation: ScreenOrientation;
}
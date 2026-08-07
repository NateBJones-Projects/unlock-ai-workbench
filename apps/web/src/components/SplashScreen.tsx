export function SplashScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div
        className="flex size-24 items-center justify-center"
        aria-label="Unlock AI Workbench splash screen"
      >
        <img
          alt="Unlock AI Workbench"
          className="size-16 object-contain"
          src="/unlock-ai-touch-icon.png"
        />
      </div>
    </div>
  );
}

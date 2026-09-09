// Shell readiness precedes the preset command's startup. Wait for its output to
// settle too, without depending on Claude/Codex-specific prompt text.
export function waitForTerminalStartup(terminalId: string, hasCommand: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    let quietTimer: ReturnType<typeof setTimeout> | undefined;
    let shellReady = false;
    let finished = false;
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(quietTimer);
      clearTimeout(timeout);
      unsubscribeData();
      unsubscribeExit();
      if (error) reject(error);
      else resolve();
    };
    const settle = () => {
      if (!shellReady || finished) return;
      clearTimeout(quietTimer);
      quietTimer = setTimeout(() => finish(), hasCommand ? 1000 : 150);
    };
    const unsubscribeData = window.terminal.onData(terminalId, settle);
    const unsubscribeExit = window.terminal.onExit(terminalId, () =>
      finish(new Error('The terminal closed before the todo could be sent.'))
    );
    const timeout = setTimeout(
      () => finish(new Error('Terminal startup timed out. The todo is saved in the new worktree.')),
      30000
    );
    window.terminal.waitForReady(terminalId).then(
      () => {
        shellReady = true;
        settle();
      },
      (error: unknown) =>
        finish(error instanceof Error ? error : new Error('Terminal startup failed.'))
    );
  });
}

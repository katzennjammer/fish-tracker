// App-styled pop-ups. Screens call confirm/notice/toast; <DialogHost/> at
// the root draws them. Kept free of UI imports so ui.tsx can re-export it.

export type DialogTone = 'primary' | 'danger';

export type DialogRequest =
  | {
      kind: 'confirm';
      title: string;
      message: string;
      confirmLabel: string;
      tone: DialogTone;
      resolve: (ok: boolean) => void;
    }
  | { kind: 'notice'; title: string; message: string; tone: 'info' | 'error'; resolve: (ok: boolean) => void };

type Listener = {
  dialog: (req: DialogRequest) => void;
  toast: (message: string) => void;
};

let host: Listener | null = null;

export function attachDialogHost(listener: Listener) {
  host = listener;
  return () => {
    if (host === listener) host = null;
  };
}

/** Words that mean "this throws something away" get the red button. */
const DESTRUCTIVE = /delete|remove|turn off|replace|hide/i;

export function confirm(title: string, message: string, confirmLabel = 'Delete', tone?: DialogTone): Promise<boolean> {
  return new Promise((resolve) => {
    if (!host) return resolve(false);
    host.dialog({
      kind: 'confirm',
      title,
      message,
      confirmLabel,
      tone: tone ?? (DESTRUCTIVE.test(confirmLabel) ? 'danger' : 'primary'),
      resolve,
    });
  });
}

/** A message that needs reading (errors, explanations). */
export function notice(title: string, message: string, tone: 'info' | 'error' = 'info'): Promise<void> {
  return new Promise((resolve) => {
    if (!host) return resolve();
    host.dialog({ kind: 'notice', title, message, tone, resolve: () => resolve() });
  });
}

/** A short "Saved ✓" that fades by itself. */
export function toast(message: string) {
  host?.toast(message);
}

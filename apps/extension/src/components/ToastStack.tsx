interface Toast {
  id: string;
  message: string;
}

interface ToastStackProps {
  toasts: Toast[];
}

export function ToastStack(props: ToastStackProps) {
  if (!props.toasts.length) {
    return null;
  }

  return (
    <div className="sb-toast-stack">
      {props.toasts.map((toast) => (
        <div key={toast.id} className="sb-toast">
          {toast.message}
        </div>
      ))}
    </div>
  );
}

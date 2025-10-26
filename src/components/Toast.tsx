import React, { useEffect } from "react";

type ToastType = "info" | "success" | "error";

interface ToastProps {
	message: string;
	type?: ToastType;
	duration?: number; // ms
	onClose?: () => void;
}

const Toast: React.FC<ToastProps> = ({
	message,
	type = "info",
	duration = 3000,
	onClose,
}) => {
	useEffect(() => {
		const id = window.setTimeout(() => {
			onClose?.();
		}, duration);
		return () => window.clearTimeout(id);
	}, [duration, onClose]);

	return (
		<div
			className={`toast toast-${type} fade-in`}
			role="status"
			aria-live="polite"
		>
			{message}
		</div>
	);
};

export default Toast;

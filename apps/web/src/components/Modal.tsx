import { X } from "lucide-react";
import type React from "react";

interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: React.ReactNode;
}

export default function Modal({
	isOpen,
	onClose,
	title,
	children,
}: ModalProps) {
	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 overflow-y-auto">
			<div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
				<div className="fixed inset-0 transition-opacity" aria-hidden="true">
					<button
						type="button"
						className="absolute inset-0 bg-gray-500 opacity-75 w-full h-full cursor-default"
						onClick={onClose}
						onKeyDown={(e) => e.key === "Escape" && onClose()}
						aria-label="Close modal"
					/>
				</div>

				<span
					className="hidden sm:inline-block sm:align-middle sm:h-screen"
					aria-hidden="true"
				>
					&#8203;
				</span>

				<div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
					<div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
						<div className="flex justify-between items-start">
							<h3
								className="text-lg leading-6 font-medium text-gray-900"
								id="modal-title"
							>
								{title}
							</h3>
							<button
								type="button"
								onClick={onClose}
								className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
							>
								<X className="h-6 w-6" />
							</button>
						</div>
						<div className="mt-2">{children}</div>
					</div>
				</div>
			</div>
		</div>
	);
}

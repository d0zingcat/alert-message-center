import {
	AlertCircle,
	CheckCircle2,
	Loader2,
	Paperclip,
	Send,
	X,
} from "lucide-react";
import { useRef, useState } from "react";

interface SendAlertFormProps {
	webhookUrl: string;
	onSuccess?: () => void;
	placeholder?: string;
	title?: string;
}

export default function SendAlertForm({
	webhookUrl,
	onSuccess,
	placeholder = "Type your message here...",
	title = "Send Quick Alert",
}: SendAlertFormProps) {
	const [content, setContent] = useState("");
	const [file, setFile] = useState<File | null>(null);
	const [isSending, setIsSending] = useState(false);
	const [status, setStatus] = useState<{
		type: "success" | "error";
		message: string;
	} | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files?.[0]) {
			setFile(e.target.files[0]);
			setStatus(null);
		}
	};

	const removeFile = () => {
		setFile(null);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!content.trim() && !file) return;

		setIsSending(true);
		setStatus(null);

		try {
			const formData = new FormData();
			if (content.trim()) {
				// We send content as a stringified JSON if it's elaborate,
				// but for "Pure Proxy", simple text is just a field.
				// Our backend getRequestBody handles both.
				formData.append("content", JSON.stringify({ text: content }));
				formData.append("msg_type", "text");
			}

			if (file) {
				const isImage = file.type.startsWith("image/");
				formData.append(isImage ? "image" : "file", file);
				if (!content.trim()) {
					formData.append("msg_type", isImage ? "image" : "file");
				}
			}

			const response = await fetch(webhookUrl, {
				method: "POST",
				body: formData,
			});

			if (response.ok) {
				setStatus({ type: "success", message: "Alert sent successfully!" });
				setContent("");
				setFile(null);
				if (fileInputRef.current) fileInputRef.current.value = "";
				onSuccess?.();
				setTimeout(() => setStatus(null), 3000);
			} else {
				const error = await response.json();
				setStatus({
					type: "error",
					message: error.error || "Failed to send alert",
				});
			}
		} catch (_err) {
			setStatus({ type: "error", message: "Network error. Please try again." });
		} finally {
			setIsSending(false);
		}
	};

	return (
		<div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
			<div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
				<h3 className="text-sm font-bold text-gray-700 uppercase tracking-tight">
					{title}
				</h3>
			</div>
			<form onSubmit={handleSubmit} className="p-5">
				<div className="relative">
					<textarea
						className="w-full min-h-[100px] p-3 text-sm text-gray-800 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400 resize-none"
						placeholder={placeholder}
						value={content}
						onChange={(e) => setContent(e.target.value)}
						disabled={isSending}
					/>
				</div>

				<div className="mt-4 space-y-3">
					{file && (
						<div className="flex items-center justify-between p-2 px-3 bg-indigo-50 rounded-lg border border-indigo-100 animate-in fade-in slide-in-from-top-2">
							<div className="flex items-center">
								<Paperclip className="w-4 h-4 text-indigo-500 mr-2" />
								<span className="text-xs font-medium text-indigo-700 truncate max-w-[200px]">
									{file.name}
								</span>
								<span className="ml-2 text-[10px] text-indigo-400">
									({(file.size / 1024).toFixed(1)} KB)
								</span>
							</div>
							<button
								type="button"
								onClick={removeFile}
								className="text-indigo-400 hover:text-indigo-600 p-1 transition-colors"
							>
								<X className="w-4 h-4" />
							</button>
						</div>
					)}

					<div className="flex items-center justify-between gap-4">
						<div className="flex items-center gap-2">
							<input
								type="file"
								ref={fileInputRef}
								onChange={handleFileChange}
								className="hidden"
								id="alert-file-upload"
							/>
							<label
								htmlFor="alert-file-upload"
								className="cursor-pointer inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors border border-gray-200"
							>
								<Paperclip className="w-3.5 h-3.5 mr-1.5" />
								Attach File
							</label>
						</div>

						<button
							type="submit"
							disabled={isSending || (!content.trim() && !file)}
							className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-indigo-500/20"
						>
							{isSending ? (
								<>
									<Loader2 className="w-4 h-4 mr-2 animate-spin" />
									Sending...
								</>
							) : (
								<>
									<Send className="w-4 h-4 mr-2" />
									Send Alert
								</>
							)}
						</button>
					</div>
				</div>

				{status && (
					<div
						className={`mt-4 p-3 rounded-lg flex items-start animate-in fade-in zoom-in-95 ${status.type === "success"
							? "bg-green-50 text-green-700 border border-green-100"
							: "bg-red-50 text-red-700 border border-red-100"
							}`}
					>
						{status.type === "success" ? (
							<CheckCircle2 className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
						) : (
							<AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
						)}
						<span className="text-xs font-medium">{status.message}</span>
					</div>
				)}
			</form>
		</div>
	);
}

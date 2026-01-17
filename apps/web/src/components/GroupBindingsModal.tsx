import { MessageCircle, Plus, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { client } from "../lib/client";
import Modal from "./Modal";

interface GroupBinding {
	id: string;
	chatId: string;
	name: string;
	status: "pending" | "approved" | "rejected";
}

interface KnownGroup {
	chatId: string;
	name: string;
	lastActiveAt: string;
}

interface GroupBindingsModalProps {
	isOpen: boolean;
	onClose: () => void;
	topicId: string;
	topicName: string;
}

export default function GroupBindingsModal({
	isOpen,
	onClose,
	topicId,
	topicName,
}: GroupBindingsModalProps) {
	const [bindings, setBindings] = useState<GroupBinding[]>([]);
	const [knownGroups, setKnownGroups] = useState<KnownGroup[]>([]);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedChatId, setSelectedChatId] = useState("");
	const [loading, setLoading] = useState(false);
	const [isSearching, setIsSearching] = useState(false);
	const [showDropdown, setShowDropdown] = useState(false);
	const [status, setStatus] = useState<{
		type: "success" | "error";
		message: string;
	} | null>(null);

	const dropdownRef = useRef<HTMLDivElement>(null);
	const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const fetchBindings = useCallback(async () => {
		try {
			const res = await client.api.topics[":id"].groups.$get(
				{
					param: { id: topicId },
				},
				{
					init: { credentials: "include" },
				},
			);
			const data = (await res.json()) as GroupBinding[];
			if (Array.isArray(data)) {
				setBindings(data);
			}
		} catch (err) {
			console.error(err);
		}
	}, [topicId]);

	const fetchKnownGroups = useCallback(async (q?: string) => {
		setIsSearching(true);
		try {
			const res = await client.api.groups.$get(
				{
					query: q ? { q } : undefined,
				},
				{
					init: { credentials: "include" },
				},
			);
			const data = (await res.json()) as KnownGroup[];
			if (Array.isArray(data)) {
				setKnownGroups(data);
			}
		} catch (err) {
			console.error(err);
		} finally {
			setIsSearching(false);
		}
	}, []);

	useEffect(() => {
		if (isOpen && topicId) {
			fetchBindings();
			fetchKnownGroups();
			setStatus(null);
			setSelectedChatId("");
			setSearchQuery("");
			setShowDropdown(false);
		}
	}, [isOpen, topicId, fetchBindings, fetchKnownGroups]);

	// Handle click outside to close dropdown
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node)
			) {
				setShowDropdown(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setSearchQuery(value);
		setSelectedChatId("");
		setShowDropdown(true);

		if (searchTimeoutRef.current) {
			clearTimeout(searchTimeoutRef.current);
		}

		searchTimeoutRef.current = setTimeout(() => {
			fetchKnownGroups(value);
		}, 300);
	};

	const handleSelectGroup = (group: KnownGroup) => {
		setSelectedChatId(group.chatId);
		setSearchQuery(group.name);
		setShowDropdown(false);
	};

	const handleBind = async () => {
		if (!selectedChatId) return;
		setLoading(true);
		setStatus(null);

		const groupName = searchQuery;

		try {
			const res = await client.api.topics[":id"].groups.$post(
				{
					param: { id: topicId },
					json: {
						chatId: selectedChatId,
						name: groupName,
					},
				},
				{
					init: { credentials: "include" },
				},
			);

			if (res.ok) {
				const data = (await res.json()) as GroupBinding;
				setStatus({
					type: "success",
					message:
						data.status === "approved"
							? "Group bound successfully!"
							: "Request submitted! Waiting for approval.",
				});
				fetchBindings();
				setSelectedChatId("");
				setSearchQuery("");
			} else {
				await res.json();
				setStatus({ type: "error", message: "Failed to bind group" });
			}
		} catch (_) {
			setStatus({ type: "error", message: "An error occurred" });
		} finally {
			setLoading(false);
		}
	};

	const handleUnbind = async (bindingId: string) => {
		if (!confirm("Are you sure you want to remove this group binding?")) return;

		try {
			const res = await client.api.topics[":id"].groups[":bindingId"].$delete(
				{
					param: { id: topicId, bindingId },
				},
				{
					init: { credentials: "include" },
				},
			);

			if (res.ok) {
				setBindings((prev) => prev.filter((b) => b.id !== bindingId));
			}
		} catch (err) {
			console.error(err);
		}
	};

	const availableGroups = knownGroups.filter(
		(kg) => !bindings.some((b) => b.chatId === kg.chatId),
	);

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={`Manage Group Chats for ${topicName}`}
		>
			<div className="space-y-6">
				<div>
					<h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
						<MessageCircle className="w-4 h-4 mr-2 text-indigo-500" />
						Bound Groups
					</h4>
					{bindings.length === 0 ? (
						<div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
							<p className="text-sm text-gray-400">
								No groups bound to this topic yet.
							</p>
						</div>
					) : (
						<ul className="divide-y divide-gray-100 border rounded-lg overflow-hidden bg-white shadow-sm">
							{bindings.map((binding) => (
								<li
									key={binding.id}
									className="flex justify-between items-center p-3 hover:bg-gray-50 transition-colors"
								>
									<div className="flex items-center flex-1 min-w-0">
										<div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center mr-3 flex-shrink-0">
											<MessageCircle className="w-4 h-4 text-indigo-600" />
										</div>
										<div className="flex flex-col min-w-0">
											<span className="text-sm font-medium text-gray-900 truncate">
												{binding.name}
											</span>
											<span className="text-[10px] text-gray-400 font-mono truncate">
												{binding.chatId}
											</span>
										</div>
										<span
											className={`ml-3 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${binding.status === "approved"
													? "bg-green-100 text-green-700"
													: binding.status === "rejected"
														? "bg-red-100 text-red-700"
														: "bg-amber-100 text-amber-700"
												}`}
										>
											{binding.status}
										</span>
									</div>
									<button
										type="button"
										onClick={() => handleUnbind(binding.id)}
										className="ml-2 text-gray-400 hover:text-red-500 p-1.5 rounded-md hover:bg-red-50 transition-colors"
										title="Remove binding"
									>
										<Trash2 className="w-4.5 h-4.5" />
									</button>
								</li>
							))}
						</ul>
					)}
				</div>

				<div className="bg-indigo-50/50 p-5 rounded-xl border border-indigo-100 shadow-sm">
					<h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center">
						<Plus className="w-4 h-4 mr-2 text-indigo-500" />
						Add Group Binding
					</h4>
					<p className="text-xs text-gray-500 mb-4 leading-relaxed">
						Search and select a group where the <strong>Alert Messenger</strong> bot
						has been added.
					</p>

					<div className="flex flex-col gap-3">
						<div className="relative" ref={dropdownRef}>
							<div className="relative">
								<div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
									{isSearching ? (
										<div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
									) : (
										<Search className="h-4 w-4 text-gray-400" />
									)}
								</div>
								<input
									type="text"
									className="block w-full pl-10 pr-10 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm text-gray-900 placeholder-gray-400 transition-all"
									placeholder="Search for a group name..."
									value={searchQuery}
									onChange={handleSearchChange}
									onFocus={() => knownGroups.length > 0 && setShowDropdown(true)}
									disabled={loading}
								/>
								{searchQuery && (
									<button
										type="button"
										onClick={() => {
											setSearchQuery("");
											setSelectedChatId("");
											fetchKnownGroups();
										}}
										className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
									>
										<X className="h-4 w-4" />
									</button>
								)}
							</div>

							{showDropdown && (
								<div className="absolute z-10 mt-1 w-full bg-white shadow-xl max-h-60 rounded-lg py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm border border-gray-100">
									{availableGroups.length > 0 ? (
										availableGroups.map((group) => (
											<button
												key={group.chatId}
												type="button"
												className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 cursor-pointer flex items-center group transition-colors"
												onClick={() => handleSelectGroup(group)}
											>
												<div className="flex-1 min-w-0">
													<div className="font-medium text-gray-900 truncate group-hover:text-indigo-700">
														{group.name}
													</div>
													<div className="text-xs text-gray-400 font-mono truncate">
														{group.chatId}
													</div>
												</div>
												{selectedChatId === group.chatId && (
													<Plus className="w-4 h-4 text-indigo-600 ml-2" />
												)}
											</button>
										))
									) : (
										<div className="px-4 py-6 text-center text-gray-500">
											<p className="text-sm font-medium">No results found</p>
											<p className="text-xs mt-1">
												Try a different search term or check if the bot is in
												the group.
											</p>
										</div>
									)}
								</div>
							)}
						</div>

						<button
							type="button"
							onClick={handleBind}
							disabled={!selectedChatId || loading}
							className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-semibold rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-[0.98]"
						>
							{loading ? (
								<>
									<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
									Processing...
								</>
							) : (
								<>
									<Plus className="w-4 h-4 mr-2" />
									Bind This Group
								</>
							)}
						</button>
					</div>

					{status && (
						<div
							className={`mt-4 p-3 rounded-lg flex items-start gap-2 ${status.type === "success"
									? "bg-green-50 text-green-700 border border-green-100"
									: "bg-red-50 text-red-700 border border-red-100"
								}`}
						>
							<div className="text-sm font-medium">{status.message}</div>
						</div>
					)}
				</div>
			</div>
		</Modal>
	);
}

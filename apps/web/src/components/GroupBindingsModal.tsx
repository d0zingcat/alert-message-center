import { MessageCircle, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { client } from "../lib/client";
import Modal from "./Modal";

interface GroupBinding {
	id: string;
	chatId: string;
	name: string;
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
	// const { user } = useAuth(); // Unused
	const [bindings, setBindings] = useState<GroupBinding[]>([]);
	const [knownGroups, setKnownGroups] = useState<KnownGroup[]>([]);
	const [selectedChatId, setSelectedChatId] = useState("");
	const [loading, setLoading] = useState(false);
	const [status, setStatus] = useState<{
		type: "success" | "error";
		message: string;
	} | null>(null);

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

	const fetchKnownGroups = useCallback(async () => {
		try {
			const res = await client.api.groups.$get(undefined, {
				init: { credentials: "include" },
			});
			const data = (await res.json()) as KnownGroup[];
			if (Array.isArray(data)) {
				setKnownGroups(data);
			}
		} catch (err) {
			console.error(err);
		}
	}, []);

	useEffect(() => {
		if (isOpen && topicId) {
			fetchBindings();
			fetchKnownGroups();
			setStatus(null);
			setSelectedChatId("");
		}
	}, [isOpen, topicId, fetchBindings, fetchKnownGroups]);

	const handleBind = async () => {
		if (!selectedChatId) return;
		setLoading(true);
		setStatus(null);

		const group = knownGroups.find((g) => g.chatId === selectedChatId);
		if (!group) return;

		try {
			const res = await client.api.topics[":id"].groups.$post(
				{
					param: { id: topicId },
					json: {
						chatId: group.chatId,
						name: group.name,
					},
				},
				{
					init: { credentials: "include" },
				},
			);

			if (res.ok) {
				setStatus({ type: "success", message: "Group bound successfully!" });
				fetchBindings();
				setSelectedChatId("");
			} else {
				await res.json(); // Consume body
				setStatus({ type: "error", message: "Failed to bind group" });
			}
		} catch (_) {
			// Ignore error
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

	// Filter out groups that are already bound
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
					<h4 className="text-sm font-medium text-gray-900 mb-2">
						Bound Groups
					</h4>
					{bindings.length === 0 ? (
						<p className="text-sm text-gray-500 italic">
							No groups bound to this topic yet.
						</p>
					) : (
						<ul className="divide-y divide-gray-200 border rounded-md">
							{bindings.map((binding) => (
								<li
									key={binding.id}
									className="flex justify-between items-center p-3"
								>
									<div className="flex items-center">
										<MessageCircle className="w-4 h-4 text-gray-400 mr-2" />
										<span className="text-sm text-gray-700">
											{binding.name}
										</span>
									</div>
									<button
										type="button"
										onClick={() => handleUnbind(binding.id)}
										className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
										title="Remove binding"
									>
										<Trash2 className="w-4 h-4" />
									</button>
								</li>
							))}
						</ul>
					)}
				</div>

				<div className="bg-gray-50 p-4 rounded-md border border-gray-200">
					<h4 className="text-sm font-medium text-gray-900 mb-3">
						Add Group Binding
					</h4>
					<p className="text-xs text-gray-500 mb-3">
						Select a group where the Feishu Bot has been added. If your group is
						not listed, try removing and re-adding the bot to the group.
					</p>

					<div className="flex gap-2">
						<select
							className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 text-gray-900"
							value={selectedChatId}
							onChange={(e) => setSelectedChatId(e.target.value)}
							disabled={loading}
						>
							<option value="">Select a group...</option>
							{availableGroups.map((group) => (
								<option key={group.chatId} value={group.chatId}>
									{group.name}
								</option>
							))}
						</select>
						<button
							type="button"
							onClick={handleBind}
							disabled={!selectedChatId || loading}
							className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							<Plus className="w-4 h-4 mr-1" />
							Add
						</button>
					</div>
					{status && (
						<p
							className={`mt-2 text-xs ${status.type === "success" ? "text-green-600" : "text-red-600"}`}
						>
							{status.message}
						</p>
					)}
				</div>
			</div>
		</Modal>
	);
}

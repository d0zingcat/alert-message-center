import {
	Check,
	Copy,
	Plus,
	Settings,
	ShieldCheck,
	User,
	UserMinus,
	UserPlus,
	Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import GroupBindingsModal from "../components/GroupBindingsModal";
import Modal from "../components/Modal";
import { useAuth } from "../contexts/AuthContext";
import { client } from "../lib/client";

interface TopicUser {
	id: string;
	name: string;
	email?: string | null;
}

interface Subscription {
	userId: string;
	user: TopicUser;
}

interface Topic {
	id: string;
	name: string;
	slug: string;
	description?: string;
	subscriptions: Subscription[];
	creator?: TopicUser;
	approver?: TopicUser;
	createdBy?: string;
	isGlobal?: boolean;
	status?: string;
	createdAt?: string;
}

export default function TopicsView() {
	const { user: currentUser } = useAuth();
	const [topics, setTopics] = useState<Topic[]>([]);
	const [myRequests, setMyRequests] = useState<Topic[]>([]);
	const [users, setUsers] = useState<TopicUser[]>([]);
	const [loading, setLoading] = useState(true);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isSubModalOpen, setIsSubModalOpen] = useState(false);
	const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
	const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
	const [copiedId, setCopiedId] = useState<string | null>(null);

	const [formData, setFormData] = useState<Partial<Topic>>({
		name: "",
		slug: "",
		description: "",
		isGlobal: false,
	});
	const [submitStatus, setSubmitStatus] = useState<{
		type: "success" | "error";
		message: string;
	} | null>(null);

	const fetchTopics = useCallback(async () => {
		setLoading(true);
		try {
			const res = await client.api.topics.$get(undefined, {
				init: { credentials: "include" },
			});
			if (res.ok) {
				const data = await res.json();
				if (Array.isArray(data)) {
					setTopics(data as unknown as Topic[]);
				} else {
					console.error("Topics data is not an array:", data);
					setTopics([]);
				}
			} else {
				console.error("Failed to fetch topics:", res.status);
				setTopics([]);
			}
		} catch (err) {
			console.error(err);
			setTopics([]);
		} finally {
			setLoading(false);
		}
	}, []);

	const fetchMyRequests = useCallback(async () => {
		try {
			const res = await client.api.topics["my-requests"].$get(undefined, {
				init: { credentials: "include" },
			});
			if (res.ok) {
				const data = await res.json();
				if (Array.isArray(data)) {
					setMyRequests(data as unknown as Topic[]);
				}
			}
		} catch (err) {
			console.error(err);
		}
	}, []);

	const fetchUsers = useCallback(async () => {
		try {
			const res = await client.api.users.$get(undefined, {
				init: { credentials: "include" },
			});
			if (res.ok) {
				const data = await res.json();
				if (Array.isArray(data)) {
					setUsers(data as unknown as TopicUser[]);
				}
			}
		} catch (err) {
			console.error(err);
		}
	}, []);

	useEffect(() => {
		fetchTopics();
		fetchMyRequests();
		if (currentUser?.isAdmin) {
			fetchUsers();
		}
	}, [currentUser, fetchMyRequests, fetchTopics, fetchUsers]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSubmitStatus(null);
		try {
			const res = await client.api.topics.$post(
				{
					json: formData as {
						name: string;
						slug: string;
						description?: string;
						isGlobal?: boolean;
					},
				},
				{
					init: { credentials: "include" },
				},
			);

			if (res.ok) {
				setSubmitStatus({
					type: "success",
					message: currentUser?.isAdmin
						? "Topic created successfully!"
						: "Request submitted! Waiting for approval.",
				});
				setFormData({ name: "", slug: "", description: "", isGlobal: false });
				fetchTopics();
				fetchMyRequests();
				setTimeout(() => {
					setIsModalOpen(false);
					setSubmitStatus(null);
				}, 1500);
			} else {
				const error = (await res.json()) as { message?: string };
				setSubmitStatus({
					type: "error",
					message: error.message || "Failed to submit request.",
				});
			}
		} catch (error) {
			console.error("Error creating topic:", error);
			setSubmitStatus({
				type: "error",
				message: "An unexpected error occurred.",
			});
		}
	};

	const handleSubscriptionClick = (topic: Topic) => {
		setSelectedTopic(topic);
		setIsSubModalOpen(true);
	};

	const handleGroupClick = (topic: Topic) => {
		setSelectedTopic(topic);
		setIsGroupModalOpen(true);
	};

	const toggleSubscription = async (
		topicId: string,
		userId: string,
		isSubscribed: boolean,
	) => {
		try {
			console.log("Toggling subscription:", { topicId, userId, isSubscribed });

			if (isSubscribed) {
				await client.api.topics[":topicId"].subscribe[":userId"].$delete(
					{
						param: { topicId, userId },
					},
					{
						init: { credentials: "include" },
					},
				);
			} else {
				await client.api.topics[":topicId"].subscribe[":userId"].$post(
					{
						param: { topicId, userId },
					},
					{
						init: { credentials: "include" },
					},
				);
			}

			// Optimistic update for the main list
			setTopics((prevTopics) =>
				prevTopics.map((t) => {
					if (t.id === topicId) {
						const updatedSubs = isSubscribed
							? t.subscriptions.filter((s) => s.userId !== userId)
							: [
									...t.subscriptions,
									{
										userId,
										user:
											users.find((u) => u.id === userId) ||
											(currentUser
												? {
														id: currentUser.id,
														name: currentUser.name,
														email: currentUser.email,
													}
												: { id: "unknown", name: "Unknown" }),
									},
								];
						return { ...t, subscriptions: updatedSubs };
					}
					return t;
				}),
			);

			// Also update selectedTopic if it's open
			if (selectedTopic && selectedTopic.id === topicId) {
				const updatedSubs = isSubscribed
					? selectedTopic.subscriptions.filter((s) => s.userId !== userId)
					: [
							...selectedTopic.subscriptions,
							{
								userId,
								user:
									users.find((u) => u.id === userId) ||
									(currentUser
										? {
												id: currentUser.id,
												name: currentUser.name,
												email: currentUser.email,
											}
										: { id: "unknown", name: "Unknown" }),
							},
						];
				setSelectedTopic({ ...selectedTopic, subscriptions: updatedSubs });
			}

			fetchTopics(); // Re-fetch to ensure consistency
		} catch (error) {
			console.error("Error toggling subscription:", error);
		}
	};

	const isSubscribedToTopic = (topic: Topic) => {
		return topic.subscriptions.some((sub) => sub.userId === currentUser?.id);
	};

	const handleSelfSubscribe = async (topic: Topic) => {
		if (!currentUser) return;
		const subscribed = isSubscribedToTopic(topic);
		await toggleSubscription(topic.id, currentUser.id, subscribed);
	};

	const copyToClipboard = (text: string, topicId: string) => {
		navigator.clipboard.writeText(text);
		setCopiedId(topicId);
		setTimeout(() => setCopiedId(null), 2000);
	};

	const getWebhookUrl = (topicSlug: string) => {
		if (!currentUser?.personalToken) return "";
		// Use an environment variable if available, otherwise fallback to current origin
		// biome-ignore lint/suspicious/noExplicitAny: Vite env access
		const meta = import.meta as any;
		const baseUrl = (
			meta.env?.VITE_WEBHOOK_BASE_URL || window.location.origin
		).replace(/\/$/, "");
		return `${baseUrl}/webhook/${currentUser.personalToken}/topic/${topicSlug}`;
	};

	const getGlobalWebhookUrl = (topicSlug: string) => {
		// biome-ignore lint/suspicious/noExplicitAny: Vite env access
		const meta = import.meta as any;
		const baseUrl = (
			meta.env?.VITE_WEBHOOK_BASE_URL || window.location.origin
		).replace(/\/$/, "");
		return `${baseUrl}/webhook/topic/${topicSlug}`;
	};

	const getDmWebhookUrl = () => {
		if (!currentUser?.personalToken) return "";
		// biome-ignore lint/suspicious/noExplicitAny: Vite env access
		const meta = import.meta as any;
		const baseUrl = (
			meta.env?.VITE_WEBHOOK_BASE_URL || window.location.origin
		).replace(/\/$/, "");
		return `${baseUrl}/webhook/${currentUser.personalToken}/dm`;
	};

	if (loading) return <div className="p-4">Loading...</div>;

	return (
		<div>
			<div className="bg-indigo-50 border-l-4 border-indigo-400 p-4 mb-8 rounded-r-md shadow-sm">
				<div className="flex">
					<div className="ml-3">
						<h3 className="text-sm font-bold text-indigo-800">How it works?</h3>
						<div className="mt-2 text-sm text-indigo-700">
							<ul className="list-disc pl-5 space-y-1">
								<li>
									<strong>Subscribe:</strong> Click{" "}
									<span className="text-green-700 font-semibold">
										Subscribe
									</span>{" "}
									on any topic to start receiving alerts via Feishu private
									message.
								</li>
								<li>
									<strong>Personal Webhook:</strong> Use topic-specific URLs to
									notify all subscribers, or use your{" "}
									<span className="font-semibold text-indigo-900">
										Personal Inbox
									</span>{" "}
									to notify only yourself.
								</li>
								<li>
									<strong>Need more?</strong> If you can't find a suitable
									topic, click{" "}
									<span className="font-semibold">Request Topic</span> to ask
									admins for a new one.
								</li>
							</ul>
						</div>
					</div>
				</div>
			</div>

			<div className="mb-10">
				<div className="flex items-center mb-4">
					<ShieldCheck className="w-6 h-6 text-indigo-600 mr-2" />
					<h2 className="text-xl font-bold text-gray-900">Personal Inbox</h2>
				</div>
				<div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-xl p-6 text-white shadow-lg border-b-4 border-indigo-800">
					<div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
						<div className="flex-1">
							<p className="text-indigo-100 text-sm mb-2 font-medium">
								Your private alert endpoint. No topic required.
							</p>
							<div className="bg-indigo-900/40 rounded-lg p-3 border border-indigo-400/30 backdrop-blur-sm">
								<div className="flex items-center justify-between mb-2">
									<span className="text-[10px] uppercase tracking-widest text-indigo-300 font-bold">
										Inbox Webhook URL
									</span>
									<button
										type="button"
										onClick={() =>
											copyToClipboard(getDmWebhookUrl(), "personal-dm")
										}
										className="flex items-center text-xs hover:text-indigo-200 transition-colors"
									>
										{copiedId === "personal-dm" ? (
											<>
												<Check className="w-3 h-3 mr-1 text-green-400" />
												Copied!
											</>
										) : (
											<>
												<Copy className="w-3 h-3 mr-1" />
												Copy URL
											</>
										)}
									</button>
								</div>
								<div className="font-mono text-xs break-all select-all text-indigo-100 leading-relaxed">
									{getDmWebhookUrl()}
								</div>
							</div>
						</div>
						<div className="flex items-center gap-4 bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/10">
							<div className="bg-indigo-500/30 p-2.5 rounded-lg border border-white/20">
								<Copy className="w-6 h-6" />
							</div>
							<div className="text-sm">
								<div className="font-bold">Direct Push</div>
								<div className="text-indigo-200 text-xs">
									Always delivered to you
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div className="flex justify-between items-center mb-6">
				<h2 className="text-2xl font-bold text-gray-900">Topics</h2>
				<div className="flex gap-2">
					{currentUser && (
						<button
							type="button"
							onClick={() => setIsModalOpen(true)}
							className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center"
						>
							<Plus className="w-4 h-4 mr-2" />
							{currentUser.isAdmin ? "Add Topic" : "Request Topic"}
						</button>
					)}
				</div>
			</div>

			<div className="bg-white shadow overflow-hidden sm:rounded-md">
				<ul className="divide-y divide-gray-200">
					{topics.map((topic) => (
						<li key={topic.id}>
							<div className="px-4 py-4 sm:px-6">
								<div className="flex items-center justify-between">
									<div className="flex-1">
										<div className="flex items-center justify-between">
											<p className="text-sm font-medium text-indigo-600 truncate">
												{topic.name}
												{topic.isGlobal && (
													<span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
														Global
													</span>
												)}
											</p>
											<div className="flex items-center space-x-2">
												<button
													type="button"
													onClick={() => handleSelfSubscribe(topic)}
													className={`inline-flex items-center px-3 py-1 border text-xs font-medium rounded-md ${
														isSubscribedToTopic(topic)
															? "border-red-300 text-red-700 bg-red-50 hover:bg-red-100"
															: "border-green-300 text-green-700 bg-green-50 hover:bg-green-100"
													}`}
												>
													{isSubscribedToTopic(topic) ? (
														<>
															<UserMinus className="w-3 h-3 mr-1" />
															Unsubscribe
														</>
													) : (
														<>
															<UserPlus className="w-3 h-3 mr-1" />
															Subscribe
														</>
													)}
												</button>
												{currentUser &&
													(currentUser.isAdmin ||
														currentUser.id === topic.createdBy) && (
														<>
															{currentUser.isAdmin && (
																<button
																	type="button"
																	onClick={() => handleSubscriptionClick(topic)}
																	className="text-gray-400 hover:text-gray-500"
																	title="Manage Subscriptions"
																>
																	<Settings className="w-5 h-5" />
																</button>
															)}
															<button
																type="button"
																onClick={() => handleGroupClick(topic)}
																className="text-gray-400 hover:text-gray-500"
																title="Manage Group Chats"
															>
																<Users className="w-5 h-5" />
															</button>
														</>
													)}
											</div>
										</div>
										<div className="mt-2 sm:flex sm:justify-between">
											<div className="sm:flex flex-col">
												<p className="flex items-center text-sm text-gray-500">
													Slug:{" "}
													<span className="font-mono ml-1 bg-gray-100 px-1 rounded">
														{topic.slug}
													</span>
												</p>
												<p className="flex items-center text-sm text-gray-500 mt-1">
													{topic.description}
												</p>
												<div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
													{topic.creator && (
														<div className="flex items-center text-xs text-gray-500">
															<User className="w-3 h-3 mr-1 text-gray-400" />
															<span>
																Created by:{" "}
																<span className="text-gray-900 font-medium">
																	{topic.creator.name}
																</span>
															</span>
														</div>
													)}
													{topic.approver && (
														<div className="flex items-center text-xs text-gray-500">
															<ShieldCheck className="w-3 h-3 mr-1 text-indigo-400" />
															<span>
																Approved by:{" "}
																<span className="text-gray-900 font-medium">
																	{topic.approver.name}
																</span>
															</span>
														</div>
													)}
												</div>
												{currentUser && (
													<div className="mt-3 space-y-3">
														<div className="bg-gray-50 p-2 rounded border border-gray-200">
															<div className="flex justify-between items-center">
																<span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
																	Your Personal Webhook
																</span>
																<button
																	type="button"
																	onClick={() =>
																		copyToClipboard(
																			getWebhookUrl(topic.slug),
																			topic.id,
																		)
																	}
																	className="text-indigo-600 hover:text-indigo-800 flex items-center text-xs font-medium"
																>
																	{copiedId === topic.id ? (
																		<>
																			<Check className="w-3 h-3 mr-1" />
																			Copied!
																		</>
																	) : (
																		<>
																			<Copy className="w-3 h-3 mr-1" />
																			Copy URL
																		</>
																	)}
																</button>
															</div>
															<div className="mt-1 text-xs font-mono text-gray-600 break-all select-all">
																{getWebhookUrl(topic.slug)}
															</div>
														</div>

														{topic.isGlobal && (
															<div className="bg-purple-50 p-2 rounded border border-purple-100">
																<div className="flex justify-between items-center">
																	<span className="text-xs font-semibold text-purple-600 uppercase tracking-wider">
																		Global Webhook (No Token Required)
																	</span>
																	<button
																		type="button"
																		onClick={() =>
																			copyToClipboard(
																				getGlobalWebhookUrl(topic.slug),
																				`${topic.id}-global`,
																			)
																		}
																		className="text-purple-600 hover:text-purple-800 flex items-center text-xs font-medium"
																	>
																		{copiedId === `${topic.id}-global` ? (
																			<>
																				<Check className="w-3 h-3 mr-1" />
																				Copied!
																			</>
																		) : (
																			<>
																				<Copy className="w-3 h-3 mr-1" />
																				Copy URL
																			</>
																		)}
																	</button>
																</div>
																<div className="mt-1 text-xs font-mono text-purple-700 break-all select-all">
																	{getGlobalWebhookUrl(topic.slug)}
																</div>
															</div>
														)}
													</div>
												)}
											</div>
										</div>
									</div>
								</div>
							</div>
						</li>
					))}
					{topics.length === 0 && (
						<li className="px-4 py-12 text-center">
							<div className="flex flex-col items-center">
								<div className="bg-gray-100 p-3 rounded-full mb-4">
									<Plus className="w-8 h-8 text-gray-400" />
								</div>
								<p className="text-gray-900 font-medium">
									No topics available yet.
								</p>
								<p className="text-gray-500 text-sm mt-1 max-w-xs mx-auto">
									{currentUser?.isAdmin
										? "Click 'Add Topic' above to create the first alert topic for your team."
										: "There are no approved topics yet. You can request one by clicking 'Request Topic' above."}
								</p>
							</div>
						</li>
					)}
				</ul>
			</div>

			{myRequests.length > 0 && (
				<div className="mt-12">
					<h3 className="text-lg font-bold text-gray-900 mb-4">My Requests</h3>
					<div className="bg-white shadow overflow-hidden sm:rounded-md">
						<ul className="divide-y divide-gray-200">
							{myRequests.map((req) => (
								<li key={req.id}>
									<div className="px-4 py-4 sm:px-6">
										<div className="flex items-center justify-between">
											<div className="flex-1">
												<div className="flex items-center justify-between">
													<p className="text-sm font-medium text-indigo-600 truncate">
														{req.name}
													</p>
													<div className="flex items-center">
														<span
															className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
																req.status === "approved"
																	? "bg-green-100 text-green-800"
																	: req.status === "rejected"
																		? "bg-red-100 text-red-800"
																		: "bg-yellow-100 text-yellow-800"
															}`}
														>
															{req.status === "approved"
																? "Approved"
																: req.status === "rejected"
																	? "Rejected"
																	: "Pending"}
														</span>
													</div>
												</div>
												<div className="mt-2 text-sm text-gray-500">
													<p>
														Slug: <span className="font-mono">{req.slug}</span>
													</p>
													{req.description && (
														<p className="mt-1">{req.description}</p>
													)}
													<p className="mt-1 text-xs text-gray-400">
														Requested on:{" "}
														{req.createdAt
															? new Date(req.createdAt).toLocaleDateString()
															: "Unknown"}
														{req.approver && (
															<span className="ml-2">
																| Approved by: {req.approver.name}
															</span>
														)}
													</p>
												</div>
											</div>
										</div>
									</div>
								</li>
							))}
						</ul>
					</div>
				</div>
			)}

			<Modal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				title={currentUser?.isAdmin ? "Add New Topic" : "Request New Topic"}
			>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label
							htmlFor="topic-name"
							className="block text-sm font-medium text-gray-700"
						>
							Name
						</label>
						<input
							id="topic-name"
							type="text"
							required
							className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 text-gray-900"
							value={formData.name}
							onChange={(e) =>
								setFormData({ ...formData, name: e.target.value })
							}
						/>
					</div>
					<div>
						<label
							htmlFor="topic-slug"
							className="block text-sm font-medium text-gray-700"
						>
							Slug (Unique ID)
						</label>
						<input
							id="topic-slug"
							type="text"
							required
							pattern="[a-zA-Z0-9-]+"
							title="Slug must only contain alphanumeric characters and hyphens"
							className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 text-gray-900"
							value={formData.slug}
							onChange={(e) =>
								setFormData({ ...formData, slug: e.target.value })
							}
						/>
					</div>
					{currentUser?.isAdmin && (
						<div className="flex items-center">
							<input
								id="is-global"
								type="checkbox"
								className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
								checked={formData.isGlobal || false}
								onChange={(e) =>
									setFormData({ ...formData, isGlobal: e.target.checked })
								}
							/>
							<label
								htmlFor="is-global"
								className="ml-2 block text-sm text-gray-900 font-medium"
							>
								Global Topic (Bypass personal token authentication)
							</label>
						</div>
					)}
					<div>
						<label
							htmlFor="topic-description"
							className="block text-sm font-medium text-gray-700"
						>
							Description
						</label>
						<textarea
							id="topic-description"
							className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 text-gray-900"
							value={formData.description}
							onChange={(e) =>
								setFormData({ ...formData, description: e.target.value })
							}
						/>
					</div>
					{submitStatus && (
						<div
							className={`p-3 rounded-md text-sm ${
								submitStatus.type === "success"
									? "bg-green-50 text-green-800"
									: "bg-red-50 text-red-800"
							}`}
						>
							{submitStatus.message}
						</div>
					)}
					<div className="flex justify-end pt-4">
						<button
							type="button"
							onClick={() => setIsModalOpen(false)}
							className="mr-3 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
						>
							Cancel
						</button>
						<button
							type="submit"
							className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700"
						>
							Create Topic
						</button>
					</div>
				</form>
			</Modal>

			<Modal
				isOpen={isSubModalOpen}
				onClose={() => setIsSubModalOpen(false)}
				title={`Manage Subscribers for ${selectedTopic?.name}`}
			>
				<div className="mt-4">
					<p className="text-sm text-gray-500 mb-4">
						Select users who should receive alerts for this topic.
					</p>
					<div className="space-y-2 max-h-60 overflow-y-auto">
						{users.map((user) => {
							const isSubscribed = selectedTopic?.subscriptions.some(
								(s) => s.userId === user.id,
							);
							return (
								<div key={user.id} className="flex items-center">
									<input
										id={`user-${user.id}`}
										type="checkbox"
										className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
										checked={isSubscribed || false}
										onChange={() =>
											selectedTopic &&
											toggleSubscription(
												selectedTopic.id,
												user.id,
												isSubscribed || false,
											)
										}
									/>
									<label
										htmlFor={`user-${user.id}`}
										className="ml-2 block text-sm text-gray-900"
									>
										{user.name}{" "}
										<span className="text-gray-500 text-xs">
											({user.email})
										</span>
									</label>
								</div>
							);
						})}
						{users.length === 0 && (
							<p className="text-sm text-gray-500">No users available.</p>
						)}
					</div>
					<div className="mt-6 flex justify-end">
						<button
							type="button"
							onClick={() => setIsSubModalOpen(false)}
							className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
						>
							Close
						</button>
					</div>
				</div>
			</Modal>

			{selectedTopic && (
				<GroupBindingsModal
					isOpen={isGroupModalOpen}
					onClose={() => setIsGroupModalOpen(false)}
					topicId={selectedTopic.id}
					topicName={selectedTopic.name}
				/>
			)}
		</div>
	);
}

import { useCallback, useEffect, useState } from "react";
import { client } from "../lib/client";
import SystemLoadView from "./SystemLoadView";

export default function AdminView() {
	const [activeTab, setActiveTab] = useState("load");

	return (
		<div>
			<div className="flex justify-between items-center mb-6">
				<h2 className="text-2xl font-bold text-gray-900">Admin Dashboard</h2>
			</div>

			<div className="bg-white shadow rounded-lg p-6">
				<div className="border-b border-gray-200 mb-6">
					<nav className="-mb-px flex space-x-8">
						<button
							type="button"
							onClick={() => setActiveTab("load")}
							className={`${
								activeTab === "load"
									? "border-indigo-500 text-indigo-600"
									: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
							} whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm`}
						>
							System Load
						</button>
						<button
							type="button"
							onClick={() => setActiveTab("requests")}
							className={`${
								activeTab === "requests"
									? "border-indigo-500 text-indigo-600"
									: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
							} whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm`}
						>
							Topic Requests
						</button>
						<button
							type="button"
							onClick={() => setActiveTab("topics")}
							className={`${
								activeTab === "topics"
									? "border-indigo-500 text-indigo-600"
									: "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
							} whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm`}
						>
							All Topics
						</button>
					</nav>
				</div>

				{activeTab === "load" && <SystemLoadView />}
				{activeTab === "requests" && <TopicRequestsList />}
				{activeTab === "topics" && <TopicsManagement />}
			</div>
		</div>
	);
}

function TopicsManagement() {
	const [topics, setTopics] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);

	const fetchAllTopics = useCallback(async () => {
		setLoading(true);
		try {
			const res = await client.api.topics.all.$get(undefined, {
				init: { credentials: "include" },
			});
			const data = await res.json();
			setTopics(data);
		} catch (error) {
			console.error(error);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchAllTopics();
	}, [fetchAllTopics]);

	const handleDelete = async (id: string, name: string) => {
		if (
			!confirm(
				`Are you sure you want to delete topic "${name}"? This will also remove all subscriptions.`,
			)
		) {
			return;
		}

		try {
			await client.api.topics[":id"].$delete(
				{ param: { id } },
				{ init: { credentials: "include" } },
			);
			fetchAllTopics();
		} catch (error) {
			console.error(error);
		}
	};

	if (loading) return <div>Loading topics...</div>;

	return (
		<div className="overflow-hidden">
			<table className="min-w-full divide-y divide-gray-200">
				<thead className="bg-gray-50">
					<tr>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Topic
						</th>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Status
						</th>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Subscribers
						</th>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Created By
						</th>
						<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
							Approved By
						</th>
						<th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
							Actions
						</th>
					</tr>
				</thead>
				<tbody className="bg-white divide-y divide-gray-200">
					{topics.map((topic) => (
						<tr key={topic.id}>
							<td className="px-6 py-4 whitespace-nowrap">
								<div className="text-sm font-medium text-gray-900">
									{topic.name}
								</div>
								<div className="text-sm text-gray-500 font-mono">
									{topic.slug}
								</div>
							</td>
							<td className="px-6 py-4 whitespace-nowrap">
								<span
									className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
										topic.status === "approved"
											? "bg-green-100 text-green-800"
											: topic.status === "rejected"
												? "bg-red-100 text-red-800"
												: "bg-yellow-100 text-yellow-800"
									}`}
								>
									{topic.status}
								</span>
							</td>
							<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
								{topic.subscriptions?.length || 0}
							</td>
							<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
								{topic.creator?.name || "Unknown"}
							</td>
							<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
								{topic.approver?.name || "-"}
							</td>
							<td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
								<button
									type="button"
									onClick={() => handleDelete(topic.id, topic.name)}
									className="text-red-600 hover:text-red-900"
								>
									Delete
								</button>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function TopicRequestsList() {
	const [requests, setRequests] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);

	const fetchRequests = useCallback(async () => {
		setLoading(true);
		try {
			const res = await client.api.topics.requests.$get(undefined, {
				init: { credentials: "include" },
			});
			const data = await res.json();
			setRequests(data);
		} catch (error) {
			console.error(error);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchRequests();
	}, [fetchRequests]);

	const handleAction = async (
		id: string,
		action: "approve" | "reject" | "delete",
		name?: string,
	) => {
		try {
			if (action === "approve") {
				await client.api.topics[":id"].approve.$post(
					{ param: { id } },
					{ init: { credentials: "include" } },
				);
			} else if (action === "reject") {
				await client.api.topics[":id"].reject.$post(
					{ param: { id } },
					{ init: { credentials: "include" } },
				);
			} else if (action === "delete") {
				if (!confirm(`Are you sure you want to delete request "${name}"?`))
					return;
				await client.api.topics[":id"].$delete(
					{ param: { id } },
					{ init: { credentials: "include" } },
				);
			}
			fetchRequests();
		} catch (error) {
			console.error(error);
		}
	};

	if (loading) return <div>Loading requests...</div>;

	if (requests.length === 0) {
		return (
			<div className="text-center py-8 text-gray-500">
				No pending topic requests.
			</div>
		);
	}

	return (
		<div className="overflow-hidden">
			<ul className="divide-y divide-gray-200">
				{requests.map((req) => (
					<li key={req.id} className="py-4 flex justify-between items-center">
						<div>
							<p className="font-medium text-gray-900">{req.name}</p>
							<p className="text-sm text-gray-500">
								Slug: <span className="font-mono">{req.slug}</span>
							</p>
							<p className="text-sm text-gray-500">
								Requested by: {req.creator?.name || "Unknown"}
								{req.creator?.email ? ` (${req.creator.email})` : ""}
							</p>
							{req.description && (
								<p className="text-sm text-gray-500 mt-1 italic">
									"{req.description}"
								</p>
							)}
						</div>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={() => handleAction(req.id, "approve")}
								className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium shadow-sm transition-colors"
							>
								Approve
							</button>
							<button
								type="button"
								onClick={() => handleAction(req.id, "reject")}
								className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm font-medium transition-colors"
							>
								Reject
							</button>
							<button
								type="button"
								onClick={() => handleAction(req.id, "delete", req.name)}
								className="px-4 py-2 border border-gray-300 text-gray-600 rounded hover:bg-gray-50 text-sm font-medium transition-colors"
							>
								Delete
							</button>
						</div>
					</li>
				))}
			</ul>
		</div>
	);
}

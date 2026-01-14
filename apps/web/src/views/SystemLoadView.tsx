import { Activity, BarChart3, CheckCircle, Clock, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { client } from "../lib/client";

interface Stats {
	topics: {
		topicSlug: string;
		totalTasks: number;
		totalRecipients: number;
		totalSuccess: number;
	}[];
	recent: {
		alertsReceived: number;
		plannedMessages: number;
		successCount: number;
		failedCount: number;
		successRate: number;
	};
	tasks: any[];
}

export default function SystemLoadView() {
	const [stats, setStats] = useState<Stats | null>(null);
	const [loading, setLoading] = useState(true);
	const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

	const fetchStats = async () => {
		try {
			const res = await client.api.stats.$get(undefined, {
				init: { credentials: "include" },
			});
			const data = await res.json();

			// Fetch recent tasks as well
			const tasksRes = await client.api.alerts.tasks.$get(
				{ query: { limit: "10" } },
				{
					init: { credentials: "include" },
				},
			);
			const tasks = await tasksRes.json();

			setStats({ ...data, tasks } as Stats);
			setLastUpdated(new Date());
		} catch (error) {
			console.error("Failed to fetch stats:", error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchStats();
		const interval = setInterval(fetchStats, 10000); // 10s refresh for dynamic feel
		return () => clearInterval(interval);
	}, []);

	if (loading)
		return (
			<div className="flex justify-center items-center h-64">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
			</div>
		);

	if (!stats)
		return (
			<div className="text-center py-12 text-gray-500">
				Failed to load statistics.
			</div>
		);

	return (
		<div className="space-y-8 animate-fade-in">
			<div className="flex justify-between items-center">
				<div className="flex items-center gap-2">
					<span className="relative flex h-3 w-3">
						<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
						<span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
					</span>
					<span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
						Live Feedback
					</span>
				</div>
				<span className="text-xs text-gray-400">
					Last updated: {lastUpdated.toLocaleTimeString()}
				</span>
			</div>

			{/* Top Row: General Metrics */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
				<MetricCard
					title="Alerts Received"
					value={stats.recent.alertsReceived}
					icon={<Activity className="w-5 h-5 text-purple-500" />}
					color="purple"
					description="Total webhook hits"
				/>
				<MetricCard
					title="Planned Deliveries"
					value={stats.recent.plannedMessages}
					icon={<Clock className="w-5 h-5 text-blue-500" />}
					color="blue"
					description="Total subscribers"
				/>
				<MetricCard
					title="Success"
					value={stats.recent.successCount}
					icon={<CheckCircle className="w-5 h-5 text-green-500" />}
					color="green"
					description="Successfully sent"
				/>
				<MetricCard
					title="Failed"
					value={stats.recent.failedCount}
					icon={<XCircle className="w-5 h-5 text-red-500" />}
					color="red"
					description="API errors/failures"
				/>
				<div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
					<span className="text-xs font-medium text-gray-500 mb-2">
						Success Rate
					</span>
					<Gauge value={stats.recent.successRate} />
				</div>
			</div>

			{/* Middle Row: Topic Message Counts */}
			<div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
				<div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<BarChart3 className="w-5 h-5 text-indigo-500" />
						<h3 className="font-semibold text-gray-800">
							Historical Topic Metrics
						</h3>
					</div>
				</div>
				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-gray-200">
						<thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-500">
							<tr>
								<th className="px-6 py-4 text-left tracking-wider">Topic</th>
								<th className="px-6 py-4 text-left tracking-wider">
									Alerts (Tasks)
								</th>
								<th className="px-6 py-4 text-left tracking-wider">
									Planned (Recipients)
								</th>
								<th className="px-6 py-4 text-left tracking-wider">
									Distributed (Success)
								</th>
								<th className="px-6 py-4 text-left tracking-wider">
									Health Rate
								</th>
								<th className="px-6 py-4 text-left tracking-wider">Status</th>
							</tr>
						</thead>
						<tbody className="bg-white divide-y divide-gray-200">
							{stats.topics.map((topic) => {
								const rate =
									topic.totalRecipients > 0
										? (topic.totalSuccess / topic.totalRecipients) * 100
										: 100;
								return (
									<tr
										key={topic.topicSlug}
										className="hover:bg-gray-50 transition-colors"
									>
										<td className="px-6 py-4 whitespace-nowrap">
											<span
												className={`font-mono text-xs font-bold ${topic.topicSlug ? "text-indigo-600 bg-indigo-50" : "text-gray-600 bg-gray-100"} px-2 py-1 rounded-md`}
											>
												{topic.topicSlug || "[Private DM]"}
											</span>
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
											{topic.totalTasks}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
											{topic.totalRecipients}
										</td>
										<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
											{topic.totalSuccess}
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<div className="flex items-center gap-3">
												<div className="w-20 bg-gray-100 rounded-full h-1.5">
													<div
														className={`h-1.5 rounded-full transition-all duration-1000 ${rate > 90 ? "bg-green-500" : rate > 70 ? "bg-yellow-500" : "bg-red-500"}`}
														style={{ width: `${rate}%` }}
													></div>
												</div>
												<span className="text-[11px] font-bold text-gray-700">
													{rate.toFixed(1)}%
												</span>
											</div>
										</td>
										<td className="px-6 py-4 whitespace-nowrap">
											<span
												className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
													rate === 100
														? "bg-green-100 text-green-700"
														: "bg-red-100 text-red-700"
												}`}
											>
												{rate === 100 ? "Healthy" : "Errors"}
											</span>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>

			{/* Bottom Row: Recent Alerts with Sender Info */}
			<div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
				<div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Clock className="w-5 h-5 text-indigo-500" />
						<h3 className="font-semibold text-gray-800">
							Recent Alerts (Audit Log)
						</h3>
					</div>
				</div>
				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-gray-200">
						<thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-500">
							<tr>
								<th className="px-6 py-4 text-left tracking-wider">Time</th>
								<th className="px-6 py-4 text-left tracking-wider">Topic</th>
								<th className="px-6 py-4 text-left tracking-wider">Sender</th>
								<th className="px-6 py-4 text-left tracking-wider">
									Recipients
								</th>
								<th className="px-6 py-4 text-left tracking-wider">Status</th>
							</tr>
						</thead>
						<tbody className="bg-white divide-y divide-gray-200">
							{stats.tasks.map((task: any) => (
								<tr
									key={task.id}
									className="hover:bg-gray-50 transition-colors"
								>
									<td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-medium">
										{new Date(task.createdAt).toLocaleString()}
									</td>
									<td className="px-6 py-4 whitespace-nowrap">
										<span
											className={`font-mono text-xs font-bold ${task.topicSlug ? "text-indigo-600 bg-indigo-50" : "text-gray-600 bg-gray-100"} px-2 py-1 rounded-md`}
										>
											{task.topicSlug || "[Private DM]"}
										</span>
									</td>
									<td className="px-6 py-4 whitespace-nowrap">
										<div className="flex flex-col">
											<span className="text-sm font-medium text-gray-900">
												{task.sender?.name || "Unknown"}
											</span>
											<span className="text-[10px] text-gray-400">
												{task.sender?.email || "N/A"}
											</span>
										</div>
									</td>
									<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
										{task.successCount} / {task.recipientCount}
									</td>
									<td className="px-6 py-4 whitespace-nowrap">
										<span
											className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
												task.status === "completed"
													? "bg-green-100 text-green-700"
													: task.status === "failed"
														? "bg-red-100 text-red-700"
														: "bg-blue-100 text-blue-700"
											}`}
										>
											{task.status}
										</span>
									</td>
								</tr>
							))}
							{stats.tasks.length === 0 && (
								<tr>
									<td
										colSpan={5}
										className="px-6 py-8 text-center text-gray-500 italic text-sm"
									>
										No alerts sent yet.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}

function MetricCard({
	title,
	value,
	icon,
	color,
	description,
}: {
	title: string;
	value: number;
	icon: React.ReactNode;
	color: string;
	description?: string;
}) {
	return (
		<div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col transition-all hover:shadow-md hover:-translate-y-1">
			<div className="flex items-start justify-between mb-4">
				<div className={`p-2.5 rounded-xl bg-${color}-50`}>{icon}</div>
				<div className="text-right">
					<p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
						{title}
					</p>
					<h3 className="text-2xl font-black text-gray-900 leading-none mt-1">
						{value.toLocaleString()}
					</h3>
				</div>
			</div>
			{description && (
				<p className="text-[10px] text-gray-500 font-medium italic">
					/ {description}
				</p>
			)}
		</div>
	);
}

function Gauge({ value }: { value: number }) {
	const radius = 40;
	const circumference = 2 * Math.PI * radius;
	const offset = circumference - (value / 100) * circumference;

	// Determine color based on value
	const getColor = (v: number) => {
		if (v >= 95) return "#10b981"; // green-500
		if (v >= 80) return "#f59e0b"; // yellow-500
		return "#ef4444"; // red-500
	};

	return (
		<div className="relative flex items-center justify-center">
			<svg className="w-32 h-32 transform -rotate-90">
				<circle
					className="text-gray-100"
					strokeWidth="8"
					stroke="currentColor"
					fill="transparent"
					r={radius}
					cx="64"
					cy="64"
				/>
				<circle
					className="transition-all duration-1000 ease-out"
					strokeWidth="8"
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					strokeLinecap="round"
					stroke={getColor(value)}
					fill="transparent"
					r={radius}
					cx="64"
					cy="64"
				/>
			</svg>
			<div className="absolute inset-0 flex flex-col items-center justify-center -mt-1">
				<span className="text-2xl font-bold text-gray-900">
					{value.toFixed(1)}%
				</span>
			</div>
		</div>
	);
}

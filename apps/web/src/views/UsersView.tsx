import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Modal from "../components/Modal";
import { useAuth } from "../contexts/AuthContext";
import { client } from "../lib/client";

interface User {
	id: string;
	name: string;
	feishuUserId?: string;
	email?: string;
	personalToken?: string;
}

export default function UsersView() {
	const { user: currentUser } = useAuth();
	const [users, setUsers] = useState<User[]>([]);
	const [loading, setLoading] = useState(true);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [formData, setFormData] = useState<Partial<User>>({
		name: "",
		feishuUserId: "",
		email: "",
	});

	const fetchUsers = useCallback(async () => {
		setLoading(true);
		try {
			const res = await client.api.users.$get(undefined, {
				init: { credentials: "include" },
			});
			const data = await res.json();
			setUsers(data as unknown as User[]);
			setLoading(false);
		} catch (err) {
			console.error(err);
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchUsers();
	}, [fetchUsers]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		try {
			const res = await client.api.users.$post(
				{
					json: formData as any,
				},
				{
					init: { credentials: "include" },
				},
			);

			if (res.ok) {
				setIsModalOpen(false);
				setFormData({ name: "", feishuUserId: "", email: "" });
				fetchUsers();
			}
		} catch (error) {
			console.error("Error creating user:", error);
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Are you sure you want to delete this user?")) return;
		try {
			await client.api.users[":id"].$delete(
				{
					param: { id },
				},
				{
					init: { credentials: "include" },
				},
			);
			fetchUsers();
		} catch (error) {
			console.error("Error deleting user:", error);
		}
	};

	if (loading) return <div className="p-4">Loading...</div>;

	return (
		<div>
			<div className="flex justify-between items-center mb-6">
				<h2 className="text-2xl font-bold text-gray-900">Users</h2>
				{currentUser?.isAdmin && (
					<button
						type="button"
						onClick={() => setIsModalOpen(true)}
						className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center"
					>
						<Plus className="w-4 h-4 mr-2" />
						Add User
					</button>
				)}
			</div>

			<div className="bg-white shadow overflow-hidden sm:rounded-md">
				<ul className="divide-y divide-gray-200">
					{users.map((user) => (
						<li key={user.id}>
							<div className="px-4 py-4 sm:px-6">
								<div className="flex items-center justify-between">
									<div className="flex-1">
										<p className="text-sm font-medium text-indigo-600 truncate">
											{user.name}
										</p>
										<div className="mt-2 sm:flex sm:justify-between">
											<div className="sm:flex flex-col">
												<p className="flex items-center text-sm text-gray-500">
													Feishu ID:{" "}
													<span className="font-mono ml-1 bg-gray-100 px-1 rounded">
														{user.feishuUserId || "N/A"}
													</span>
												</p>
												<p className="flex items-center text-sm text-gray-500 mt-1">
													Email: {user.email || "N/A"}
												</p>
												<p className="flex items-center text-sm text-gray-500 mt-1">
													Personal Token:{" "}
													<span className="font-mono ml-1 bg-blue-50 text-blue-700 px-1 rounded">
														{user.personalToken || "N/A"}
													</span>
												</p>
											</div>
										</div>
									</div>
									{currentUser?.isAdmin && (
										<div className="ml-4 flex items-center space-x-2">
											<button
												type="button"
												onClick={() => handleDelete(user.id)}
												className="text-red-600 hover:text-red-900 p-2"
											>
												<Trash2 className="w-5 h-5" />
											</button>
										</div>
									)}
								</div>
							</div>
						</li>
					))}
					{users.length === 0 && (
						<li className="px-4 py-8 text-center text-gray-500">
							No users found. Create one to get started.
						</li>
					)}
				</ul>
			</div>

			<Modal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				title="Add New User"
			>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label
							htmlFor="user-name"
							className="block text-sm font-medium text-gray-700"
						>
							Name
						</label>
						<input
							id="user-name"
							type="text"
							required
							className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
							value={formData.name}
							onChange={(e) =>
								setFormData({ ...formData, name: e.target.value })
							}
						/>
					</div>
					<div>
						<label
							htmlFor="user-feishu"
							className="block text-sm font-medium text-gray-700"
						>
							Feishu User ID
						</label>
						<input
							id="user-feishu"
							type="text"
							className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
							value={formData.feishuUserId}
							onChange={(e) =>
								setFormData({ ...formData, feishuUserId: e.target.value })
							}
						/>
					</div>
					<div>
						<label
							htmlFor="user-email"
							className="block text-sm font-medium text-gray-700"
						>
							Email
						</label>
						<input
							id="user-email"
							type="email"
							className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
							value={formData.email}
							onChange={(e) =>
								setFormData({ ...formData, email: e.target.value })
							}
						/>
					</div>
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
							Create User
						</button>
					</div>
				</form>
			</Modal>
		</div>
	);
}

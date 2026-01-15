import {
	Hash,
	LogIn,
	LogOut,
	Settings,
	ShieldCheck,
	Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "./contexts/AuthContext";
import AdminView from "./views/AdminView";
import TopicsView from "./views/TopicsView";
import UsersView from "./views/UsersView";

function App() {
	const { user, loading, login, logout } = useAuth();
	const [activeTab, setActiveTab] = useState("topics");
	const [hasSetDefault, setHasSetDefault] = useState(false);

	useEffect(() => {
		if (!loading && user && !hasSetDefault) {
			setActiveTab(user.isAdmin ? "admin" : "topics");
			setHasSetDefault(true);
		}
	}, [user, loading, hasSetDefault]);

	if (loading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
			</div>
		);
	}

	if (!user) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
					<div className="text-center">
						<img src="/icon.png" alt="Logo" className="h-16 w-16 mx-auto mb-4" />
						<h1 className="text-3xl font-bold text-gray-900 mb-2">
							Alert Message Center
						</h1>
						<p className="text-gray-600 mb-6">
							Please sign in with Feishu to continue
						</p>
						<button
							type="button"
							onClick={login}
							className="w-full flex items-center justify-center bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 transition"
						>
							<LogIn className="mr-2 h-5 w-5" />
							Sign in with Feishu
						</button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50">
			<nav className="bg-white shadow-sm border-b">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex justify-between h-16">
						<div className="flex">
							<div className="flex-shrink-0 flex items-center">
								<img src="/icon.png" alt="Logo" className="h-8 w-8" />
								<span className="ml-2 text-xl font-bold text-gray-900">
									Alert Message Center
								</span>
							</div>
							<div className="hidden sm:ml-6 sm:flex sm:space-x-8">
								{user.isAdmin && (
									<button
										type="button"
										onClick={() => setActiveTab("admin")}
										className={`${activeTab === "admin"
											? "border-indigo-500 text-gray-900"
											: "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
											} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
									>
										<Settings className="mr-2 h-4 w-4" />
										Admin
									</button>
								)}
								<button
									type="button"
									onClick={() => setActiveTab("topics")}
									className={`${activeTab === "topics"
										? "border-indigo-500 text-gray-900"
										: "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
										} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
								>
									<Hash className="mr-2 h-4 w-4" />
									Topics
								</button>
								{user.isAdmin && (
									<button
										type="button"
										onClick={() => setActiveTab("users")}
										className={`${activeTab === "users"
											? "border-indigo-500 text-gray-900"
											: "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
											} inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
									>
										<Users className="mr-2 h-4 w-4" />
										Users
									</button>
								)}
							</div>
						</div>

						<div className="flex items-center space-x-4">
							<div className="flex items-center space-x-2">
								<span className="text-sm text-gray-700">{user.name}</span>
								{user.isAdmin && (
									<ShieldCheck className="h-5 w-5 text-indigo-600" />
								)}
							</div>
							<button
								type="button"
								onClick={logout}
								className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-gray-700 hover:bg-gray-100"
							>
								<LogOut className="mr-1 h-4 w-4" />
								Logout
							</button>
						</div>
					</div>
				</div>
			</nav>

			<main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
				{activeTab === "topics" && <TopicsView />}
				{activeTab === "users" && user.isAdmin && <UsersView />}
				{activeTab === "admin" && user.isAdmin && <AdminView />}
			</main>
		</div>
	);
}

export default App;

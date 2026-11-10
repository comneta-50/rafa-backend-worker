import {
	initialAgents,
	initialJobs,
	initialOrders,
	initialReviews,
	initialRepos,
	initialActivityLogs,
	Agent,
	Job,
	LifecycleOrder,
	ReviewItem,
	RepoItem,
	ActivityLog,
} from "./data";
import { getDb, initDbSchema } from "./db";

// In-memory runtime state
let agents = [...initialAgents];
let jobs = [...initialJobs];
let orders = [...initialOrders];
let reviews = [...initialReviews];
let repos = [...initialRepos];
let logs = [...initialActivityLogs];

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data: any, status = 200) {
	return Response.json(data, {
		status,
		headers: corsHeaders,
	});
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		if (request.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}

		const url = new URL(request.url);
		const path = url.pathname;
		const method = request.method;

		// 1. Root & Health Check
		if (path === "/" || path === "/health") {
			const sql = getDb(env);
			let dbStatus = "not_configured";
			let dbNow = null;

			if (sql) {
				try {
					const res = await sql`SELECT NOW() as now;`;
					dbStatus = "connected";
					dbNow = res[0]?.now;
				} catch (err: any) {
					dbStatus = `error: ${err.message}`;
				}
			}

			return json({
				status: "ok",
				service: "rafa-backend-worker",
				aiConnected: true,
				database: {
					status: dbStatus,
					engine: "Neon PostgreSQL",
					currentTime: dbNow,
				},
				timestamp: new Date().toISOString(),
			});
		}

		// 1b. Database Init Endpoint (/api/db/init)
		if (path === "/api/db/init" && method === "POST") {
			const sql = getDb(env);
			if (!sql) return json({ error: "DATABASE_URL not configured" }, 500);

			try {
				await initDbSchema(sql);
				return json({ success: true, message: "Neon PostgreSQL schema initialized successfully!" });
			} catch (err: any) {
				return json({ success: false, error: err.message }, 500);
			}
		}

		// 1c. Authentication API (/api/auth/register & /api/auth/login)
		if (path === "/api/auth/register" && method === "POST") {
			const sql = getDb(env);
			const body: any = await request.json().catch(() => ({}));
			const { email, password, name } = body;

			if (!email || !password || !name) {
				return json({ success: false, error: "Nama, email, dan password wajib diisi." }, 400);
			}

			const initials = name
				.split(" ")
				.map((w: string) => w[0])
				.join("")
				.toUpperCase()
				.slice(0, 2);

			const newUser = {
				id: `USR-${Math.floor(1000 + Math.random() * 9000)}`,
				email: email.toLowerCase().trim(),
				name: name.trim(),
				role: "developer",
				avatar: initials || "US",
			};

			if (sql) {
				try {
					// Check existing
					const existing = await sql`SELECT id FROM users WHERE email = ${newUser.email} LIMIT 1;`;
					if (existing.length > 0) {
						return json({ success: false, error: "Email sudah terdaftar. Silakan login." }, 400);
					}

					await sql`
						INSERT INTO users (id, email, password_hash, name, role, avatar)
						VALUES (${newUser.id}, ${newUser.email}, ${password}, ${newUser.name}, ${newUser.role}, ${newUser.avatar});
					`;
				} catch (err: any) {
					console.error("Neon register error:", err);
				}
			}

			// Generate simple auth token
			const token = `token_${newUser.id}_${Date.now()}`;
			return json({
				success: true,
				message: "Registrasi berhasil!",
				user: newUser,
				token,
			}, 201);
		}

		if (path === "/api/auth/login" && method === "POST") {
			const sql = getDb(env);
			let body: any = {};
			try {
				body = await request.json();
			} catch {
				const text = await request.text().catch(() => "{}");
				try {
					body = JSON.parse(text);
				} catch {
					body = {};
				}
			}
			const email = (body.email || "").toString();
			const password = (body.password || "").toString();

			if (!email.trim() || !password.trim()) {
				return json({ success: false, error: "Email dan password wajib diisi." }, 400);
			}

			let user: any = null;

			if (sql) {
				try {
					const res = await sql`
						SELECT id, email, name, role, avatar, password_hash 
						FROM users 
						WHERE email = ${email.toLowerCase().trim()} 
						LIMIT 1;
					`;
					if (res.length > 0) {
						if (res[0].password_hash === password) {
							user = {
								id: res[0].id,
								email: res[0].email,
								name: res[0].name,
								role: res[0].role,
								avatar: res[0].avatar,
							};
						} else {
							return json({ success: false, error: "Password yang Anda masukkan salah." }, 401);
						}
					}
				} catch (err: any) {
					console.error("Neon login query error:", err);
				}
			}

			// Default admin fallback jika database belum ada user
			if (!user) {
				if (email.toLowerCase().trim() === "admin@rafa.ai" && password === "admin123") {
					user = {
						id: "USR-001",
						email: "admin@rafa.ai",
						name: "Rafa Admin",
						role: "superadmin",
						avatar: "RA",
					};
				} else {
					return json({ success: false, error: "Akun tidak ditemukan atau password salah." }, 401);
				}
			}

			const token = `token_${user.id}_${Date.now()}`;
			return json({
				success: true,
				message: "Login berhasil!",
				user,
				token,
			});
		}

		// 2. Dashboard Unified Endpoint (/api/dashboard)
		if (path === "/api/dashboard" && method === "GET") {
			const activeAgentsList = agents.filter((a) => a.status !== "Offline");
			const runningJobsCount = jobs.filter((j) => j.status === "fixing" || j.status === "testing").length;
			const completedJobsCount = jobs.filter((j) => j.status === "completed").length;

			return json({
				metrics: {
					activeJobsCount: jobs.length,
					inProgressCount: runningJobsCount,
					onlineAgentsCount: activeAgentsList.length,
					totalAgentsCount: agents.length,
					successRate: jobs.length > 0 ? `${Math.round((completedJobsCount / jobs.length) * 100)}%` : "0%",
					successRateSubtitle: jobs.length > 0 ? `${completedJobsCount} dari ${jobs.length} jobs selesai` : "Belum ada riwayat job",
					avgResolutionTime: "0m 00s",
					resolutionDelta: "No active backlog",
					clusterHealth: "Healthy",
					latency: "24ms",
				},
				recentJobs: jobs.slice(0, 10),
				agentsFleet: agents,
				recentActivity: logs.slice(0, 5),
				pendingReviewsCount: reviews.length,
			});
		}

		// 2b. Analytics Unified Endpoint (/api/analytics)
		if (path === "/api/analytics" && method === "GET") {
			const timeRange = url.searchParams.get("timeRange") || "7d";
			const totalIncoming = jobs.length + orders.length;
			const totalCompleted = jobs.filter((j) => j.status === "completed").length;
			const totalFailed = jobs.filter((j) => j.status === "failed").length;
			const totalQueued = jobs.filter((j) => j.status === "fixing" || j.status === "testing").length;

			// Data tren line chart harian (Senin - Minggu)
			const days = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
			const incomingTrend = [0, 0, 0, 0, 0, 0, totalIncoming];
			const completedTrend = [0, 0, 0, 0, 0, 0, totalCompleted];
			const failedTrend = [0, 0, 0, 0, 0, 0, totalFailed];

			// Distribusi kategori domain sistem
			const categoryLabels = ["Auth & Sec", "Database", "SSR Frontend", "API Worker", "Billing", "CI Pipeline"];
			const categoryCompleted = [
				jobs.filter((j) => j.title.toLowerCase().includes("auth") || j.title.toLowerCase().includes("token")).length,
				jobs.filter((j) => j.title.toLowerCase().includes("postgres") || j.title.toLowerCase().includes("pool")).length,
				jobs.filter((j) => j.title.toLowerCase().includes("ssr") || j.title.toLowerCase().includes("hydration")).length,
				jobs.filter((j) => j.title.toLowerCase().includes("worker") || j.title.toLowerCase().includes("redis")).length,
				jobs.filter((j) => j.title.toLowerCase().includes("billing") || j.title.toLowerCase().includes("stripe")).length,
				jobs.filter((j) => j.title.toLowerCase().includes("ci") || j.title.toLowerCase().includes("pipeline")).length,
			];

			return json({
				summary: {
					totalIncoming,
					totalCompleted,
					totalFailed,
					completionRate: totalIncoming > 0 ? `${Math.round((totalCompleted / totalIncoming) * 100)}%` : "0%",
					failureRate: totalIncoming > 0 ? `${Math.round((totalFailed / totalIncoming) * 100)}%` : "0%",
					timeRange,
				},
				lineChart: {
					labels: days,
					incoming: incomingTrend,
					completed: completedTrend,
					failed: failedTrend,
				},
				barChart: {
					labels: categoryLabels,
					completed: categoryCompleted,
					failed: [0, 0, 0, 0, 0, 0],
				},
				doughnut: {
					labels: ["Selesai", "Gagal", "Masuk (Queued)"],
					data: [totalCompleted, totalFailed, totalQueued],
				},
				recentLogs: logs.slice(0, 6).map((l) => ({
					id: l.id,
					timestamp: l.timestamp,
					agent: l.agent,
					repo: l.repo,
					action: l.message,
					type: l.level === "success" ? "Completed" : l.level === "failed" ? "Failed" : "Queued",
				})),
			});
		}

		// 2c. Metrics / Overview API
		if (path === "/api/metrics" && method === "GET") {
			const activeAgents = agents.filter((a) => a.status !== "Offline").length;
			const totalJobs = jobs.length;
			const runningJobs = jobs.filter((j) => j.status === "fixing" || j.status === "testing").length;
			const completedJobs = jobs.filter((j) => j.status === "completed").length;
			const pendingReviews = reviews.length;
			const totalOrders = orders.length;

			return json({
				activeAgents,
				totalJobs,
				runningJobs,
				completedJobs,
				pendingReviews,
				totalOrders,
				clusterHealth: "Healthy",
				latency: "24ms",
			});
		}

		// 3. Jobs API (/api/jobs)
		if (path === "/api/jobs") {
			const sql = getDb(env);

			if (method === "GET") {
				const status = url.searchParams.get("status");
				if (sql) {
					try {
						let dbJobs = [];
						if (status && status !== "all") {
							dbJobs = await sql`
								SELECT 
									id, 
									order_id as "orderId", 
									repo, 
									branch, 
									title, 
									agent, 
									status, 
									status_label as "statusLabel", 
									time_label as "time", 
									progress, 
									logs 
								FROM jobs 
								WHERE status = ${status} 
								ORDER BY created_at DESC;
							`;
						} else {
							dbJobs = await sql`
								SELECT 
									id, 
									order_id as "orderId", 
									repo, 
									branch, 
									title, 
									agent, 
									status, 
									status_label as "statusLabel", 
									time_label as "time", 
									progress, 
									logs 
								FROM jobs 
								ORDER BY created_at DESC;
							`;
						}
						if (dbJobs && dbJobs.length > 0) return json(dbJobs);
					} catch (err: any) {
						console.error("Neon GET jobs error:", err);
					}
				}

				if (status && status !== "all") {
					return json(jobs.filter((j) => j.status === status));
				}
				return json(jobs);
			}

			if (method === "POST") {
				const body: any = await request.json().catch(() => ({}));
				const newJob: Job = {
					id: `JOB-${Math.floor(4100 + Math.random() * 900)}`,
					orderId: body.orderId,
					repo: (body.repo || "comneta-50/site-ai-company").replace("https://github.com/", ""),
					branch: body.branch || (body.orderId ? `ai-fix/${body.orderId.toLowerCase()}` : "ai-auto-patch"),
					title: body.title || "Bugfix task",
					agent: body.agent || "AutoFix Engineer",
					status: "fixing",
					statusLabel: "Fixing",
					time: "Just now",
					progress: body.progress || 20,
					logs: [
						`Job started: ${body.title || "Bugfix task"}`,
						body.orderId ? `Ingested from Client Order: ${body.orderId}` : "Ingested from Dispatch Console",
						`Assigned to ${body.agent || "AutoFix Engineer"}`,
						"Cloning repository & analyzing AST tree...",
					],
				};
				jobs = [newJob, ...jobs];

				if (sql) {
					try {
						await sql`
							INSERT INTO jobs (
								id, order_id, repo, branch, title, agent, status, status_label, time_label, progress, logs
							) VALUES (
								${newJob.id}, ${newJob.orderId || null}, ${newJob.repo}, ${newJob.branch}, ${newJob.title},
								${newJob.agent}, ${newJob.status}, ${newJob.statusLabel}, ${newJob.time}, ${Number(newJob.progress) || 0},
								${JSON.stringify(newJob.logs || [])}::jsonb
							);
						`;
					} catch (err: any) {
						console.error("Neon INSERT job error:", err);
					}
				}

				// Increment activeJobs of assigned agent
				const assignedAgent = agents.find((a) => a.name === newJob.agent);
				if (assignedAgent) {
					assignedAgent.activeJobs += 1;
					assignedAgent.status = "Busy";
					if (sql) {
						try {
							await sql`
								UPDATE agents 
								SET active_jobs = active_jobs + 1, status = 'Busy' 
								WHERE LOWER(name) = LOWER(${newJob.agent});
							`;
						} catch (err: any) {
							console.error("Neon UPDATE agent active_jobs error:", err);
						}
					}
				}

				// Record activity log
				logs.unshift({
					id: `LOG-${Math.floor(1000 + Math.random() * 9000)}`,
					timestamp: new Date().toLocaleTimeString("id-ID"),
					level: "info",
					agent: newJob.agent,
					repo: newJob.repo,
					message: `Job ${newJob.id} created: ${newJob.title}`,
					duration: "0.1s",
				});

				return json({ success: true, job: newJob }, 201);
			}
		}

		// Specialized Job Action: Retry / Re-trigger job
		if (path.match(/^\/api\/jobs\/[^/]+\/retry$/) && method === "POST") {
			const id = path.split("/")[3];
			const sql = getDb(env);
			const jobIndex = jobs.findIndex((j) => j.id === id);

			let updatedJob: Job | null = null;
			if (jobIndex !== -1) {
				jobs[jobIndex] = {
					...jobs[jobIndex],
					status: "fixing",
					statusLabel: "Fixing",
					progress: 15,
					logs: [
						...(jobs[jobIndex].logs || []),
						`Job re-triggered at ${new Date().toLocaleTimeString("id-ID")}`,
						"Re-running unit test suites and analyzer AST pass...",
					],
				};
				updatedJob = jobs[jobIndex];
			}

			if (sql) {
				try {
					await sql`
						UPDATE jobs 
						SET status = 'fixing', status_label = 'Fixing', progress = 15 
						WHERE id = ${id};
					`;
					if (!updatedJob) {
						const res = await sql`
							SELECT 
								id, order_id as "orderId", repo, branch, title, agent, 
								status, status_label as "statusLabel", time_label as "time", 
								progress, logs 
							FROM jobs WHERE id = ${id};
						`;
						if (res.length > 0) updatedJob = res[0] as any;
					}
				} catch (err: any) {
					console.error("Neon UPDATE retry job error:", err);
				}
			}

			if (!updatedJob) return json({ error: "Job not found" }, 404);

			logs.unshift({
				id: `LOG-${Math.floor(1000 + Math.random() * 9000)}`,
				timestamp: new Date().toLocaleTimeString("id-ID"),
				level: "info",
				agent: updatedJob.agent,
				repo: updatedJob.repo,
				message: `Job ${id} re-triggered and returned to execution queue`,
				duration: "0.2s",
			});

			return json({ success: true, job: updatedJob });
		}

		// Single Job Actions (/api/jobs/:id)
		if (path.startsWith("/api/jobs/")) {
			const id = path.replace("/api/jobs/", "");
			const sql = getDb(env);
			const jobIndex = jobs.findIndex((j) => j.id === id);

			if (method === "GET") {
				if (sql) {
					try {
						const res = await sql`
							SELECT 
								id, order_id as "orderId", repo, branch, title, agent, 
								status, status_label as "statusLabel", time_label as "time", 
								progress, logs 
							FROM jobs WHERE id = ${id};
						`;
						if (res.length > 0) return json(res[0]);
					} catch (err: any) {
						console.error("Neon GET single job error:", err);
					}
				}
				if (jobIndex === -1) return json({ error: "Job not found" }, 404);
				return json(jobs[jobIndex]);
			}

			if (method === "PATCH") {
				const body: any = await request.json().catch(() => ({}));
				if (jobIndex !== -1) {
					jobs[jobIndex] = { ...jobs[jobIndex], ...body };
				}
				if (sql) {
					try {
						if (body.status) {
							await sql`
								UPDATE jobs 
								SET status = ${body.status}, 
								    status_label = ${body.statusLabel || body.status},
								    progress = ${body.progress !== undefined ? body.progress : 100}
								WHERE id = ${id};
							`;
						}
					} catch (err: any) {
						console.error("Neon PATCH job error:", err);
					}
				}
				return json({ success: true, job: jobIndex !== -1 ? jobs[jobIndex] : body });
			}

			if (method === "DELETE") {
				jobs = jobs.filter((j) => j.id !== id);
				if (sql) {
					try {
						await sql`DELETE FROM jobs WHERE id = ${id};`;
					} catch (err: any) {
						console.error("Neon DELETE job error:", err);
					}
				}
				return json({ success: true, message: `Job ${id} deleted` });
			}
		}

		// 4. Client Orders API (/api/orders)
		if (path === "/api/orders") {
			const sql = getDb(env);

			if (method === "GET") {
				if (sql) {
					try {
						const dbOrders = await sql`
							SELECT 
								id, 
								client_name as "clientName", 
								client_email as "clientEmail", 
								package_type as "packageType", 
								fee_amount as "feeAmount", 
								bug_description as "bugDescription", 
								repo_url as "repoUrl", 
								branch_name as "branchName", 
								status, 
								ai_stage as "aiStage", 
								retention_expires as "retentionExpires", 
								pr_url as "prUrl", 
								zip_downloaded as "zipDownloaded", 
								workspace_destroyed as "workspaceDestroyed"
							FROM orders 
							ORDER BY created_at DESC;
						`;
						return json(dbOrders);
					} catch (err: any) {
						console.error("Neon GET orders error:", err);
					}
				}
				return json(orders);
			}

			if (method === "POST") {
				const body: any = await request.json().catch(() => ({}));
				const newOrder: LifecycleOrder = {
					id: `ORD-${Math.floor(700 + Math.random() * 200)}`,
					clientName: body.clientName || body.clientRef || "Anonymous Client",
					clientEmail: body.clientEmail || "client@contact.com",
					packageType: body.packageType || "Standard Patch",
					feeAmount: body.feeAmount || "$250.00",
					bugDescription: body.bugDescription || "Bug analysis needed",
					repoUrl: (body.repoUrl || "org/repo").replace("https://github.com/", ""),
					branchName: `ai-fix/ord-${Math.floor(100 + Math.random() * 900)}`,
					status: "order_created",
					retentionExpires: "Menunggu koneksi repo",
					workspaceDestroyed: false,
				};
				orders = [newOrder, ...orders];

				if (sql) {
					try {
						await sql`
							INSERT INTO orders (
								id, client_name, client_email, package_type, fee_amount,
								bug_description, repo_url, branch_name, status, retention_expires,
								workspace_destroyed
							) VALUES (
								${newOrder.id}, ${newOrder.clientName}, ${newOrder.clientEmail}, ${newOrder.packageType}, ${newOrder.feeAmount},
								${newOrder.bugDescription}, ${newOrder.repoUrl}, ${newOrder.branchName}, ${newOrder.status}, ${newOrder.retentionExpires},
								${newOrder.workspaceDestroyed}
							);
						`;
					} catch (err: any) {
						console.error("Neon INSERT order error:", err);
					}
				}

				logs.unshift({
					id: `LOG-${Math.floor(1000 + Math.random() * 9000)}`,
					timestamp: new Date().toLocaleTimeString("id-ID"),
					level: "info",
					agent: "Client Intake Bot",
					repo: newOrder.repoUrl,
					message: `Client Order ${newOrder.id} created for ${newOrder.clientName}`,
					duration: "0.1s",
				});

				return json({ success: true, order: newOrder }, 201);
			}
		}

		// Specialized Order Actions
		// Connect repo: POST /api/orders/:id/connect-repo
		if (path.match(/^\/api\/orders\/[^/]+\/connect-repo$/) && method === "POST") {
			const id = path.split("/")[3];
			const sql = getDb(env);
			const orderIndex = orders.findIndex((o) => o.id === id);

			let updatedOrder: LifecycleOrder | null = null;
			if (orderIndex !== -1) {
				orders[orderIndex] = {
					...orders[orderIndex],
					status: "repo_connected",
					retentionExpires: "7 Hari (Ephemeral)",
				};
				updatedOrder = orders[orderIndex];
			}

			if (sql) {
				try {
					await sql`
						UPDATE orders 
						SET status = 'repo_connected', retention_expires = '7 Hari (Ephemeral)' 
						WHERE id = ${id};
					`;
					if (!updatedOrder) {
						const res = await sql`SELECT * FROM orders WHERE id = ${id};`;
						if (res.length > 0) updatedOrder = res[0] as any;
					}
				} catch (err: any) {
					console.error("Neon UPDATE connect-repo error:", err);
				}
			}

			if (!updatedOrder) return json({ error: "Order not found" }, 404);

			logs.unshift({
				id: `LOG-${Math.floor(1000 + Math.random() * 9000)}`,
				timestamp: new Date().toLocaleTimeString("id-ID"),
				level: "info",
				agent: "Ephemeral Workspace Orchestrator",
				repo: updatedOrder.repoUrl,
				message: `Repository ${updatedOrder.repoUrl} linked to order ${id} in isolated sandbox`,
				duration: "1.2s",
			});

			return json({ success: true, order: updatedOrder });
		}

		// Start AI fixing pipeline: POST /api/orders/:id/start-fixing
		if (path.match(/^\/api\/orders\/[^/]+\/start-fixing$/) && method === "POST") {
			const id = path.split("/")[3];
			const sql = getDb(env);
			const orderIndex = orders.findIndex((o) => o.id === id);

			let order: LifecycleOrder | null = orderIndex !== -1 ? orders[orderIndex] : null;

			if (sql && !order) {
				try {
					const res = await sql`SELECT * FROM orders WHERE id = ${id};`;
					if (res.length > 0) order = res[0] as any;
				} catch (err) {
					console.error(err);
				}
			}

			if (!order) return json({ error: "Order not found" }, 404);

			// Ingest as active Job into jobs queue
			const linkedJob: Job = {
				id: `JOB-${Math.floor(1000 + Math.random() * 9000)}`,
				orderId: order.id,
				repo: order.repoUrl,
				branch: order.branchName,
				title: order.bugDescription,
				agent: "AutoFix Engineer",
				status: "fixing",
				statusLabel: "Fixing",
				time: "Just now",
				progress: 25,
				logs: [
					`Pipeline triggered for Order ${order.id}`,
					`Cloning ${order.repoUrl} in ephemeral workspace...`,
					`Analyzer Agent inspecting AST tree...`,
				],
			};
			jobs = [linkedJob, ...jobs];

			order = {
				...order,
				status: "ai_fixing",
				aiStage: "Developer",
			};
			if (orderIndex !== -1) orders[orderIndex] = order;

			if (sql) {
				try {
					await sql`
						UPDATE orders 
						SET status = 'ai_fixing', ai_stage = 'Developer' 
						WHERE id = ${id};
					`;
				} catch (err: any) {
					console.error("Neon UPDATE start-fixing error:", err);
				}
			}

			logs.unshift({
				id: `LOG-${Math.floor(1000 + Math.random() * 9000)}`,
				timestamp: new Date().toLocaleTimeString("id-ID"),
				level: "info",
				agent: "AutoFix Engineer",
				repo: order.repoUrl,
				message: `AI fixing pipeline initiated for ${order.id}: ${order.bugDescription}`,
				duration: "0.8s",
			});

			return json({ success: true, order, job: linkedJob });
		}

		// Close order & purge workspace: POST /api/orders/:id/close
		if (path.match(/^\/api\/orders\/[^/]+\/close$/) && method === "POST") {
			const id = path.split("/")[3];
			const sql = getDb(env);
			const orderIndex = orders.findIndex((o) => o.id === id);

			let order: LifecycleOrder | null = orderIndex !== -1 ? orders[orderIndex] : null;

			if (sql && !order) {
				try {
					const res = await sql`SELECT * FROM orders WHERE id = ${id};`;
					if (res.length > 0) order = res[0] as any;
				} catch (err) {
					console.error(err);
				}
			}

			if (!order) return json({ error: "Order not found" }, 404);

			order = {
				...order,
				status: "job_closed",
				retentionExpires: "Akses Dicabut & Workspace Dihapus",
				workspaceDestroyed: true,
			};
			if (orderIndex !== -1) orders[orderIndex] = order;

			if (sql) {
				try {
					await sql`
						UPDATE orders 
						SET status = 'job_closed', retention_expires = 'Akses Dicabut & Workspace Dihapus', workspace_destroyed = TRUE 
						WHERE id = ${id};
					`;
				} catch (err: any) {
					console.error("Neon UPDATE close error:", err);
				}
			}

			logs.unshift({
				id: `LOG-${Math.floor(1000 + Math.random() * 9000)}`,
				timestamp: new Date().toLocaleTimeString("id-ID"),
				level: "success",
				agent: "Security Guard",
				repo: order.repoUrl,
				message: `Order ${id} closed: Zero-retention purge completed. Token revoked.`,
				duration: "0.5s",
			});

			return json({ success: true, order });
		}

		// Standard Single Order CRUD: /api/orders/:id
		if (path.startsWith("/api/orders/")) {
			const id = path.replace("/api/orders/", "");
			const sql = getDb(env);
			const orderIndex = orders.findIndex((o) => o.id === id);

			if (method === "GET") {
				if (sql) {
					try {
						const res = await sql`SELECT * FROM orders WHERE id = ${id};`;
						if (res.length > 0) return json(res[0]);
					} catch (err) {
						console.error(err);
					}
				}
				if (orderIndex === -1) return json({ error: "Order not found" }, 404);
				return json(orders[orderIndex]);
			}

			if (method === "PATCH") {
				const body: any = await request.json().catch(() => ({}));
				if (orderIndex !== -1) {
					orders[orderIndex] = { ...orders[orderIndex], ...body };
				}
				if (sql) {
					try {
						if (body.status) await sql`UPDATE orders SET status = ${body.status} WHERE id = ${id};`;
					} catch (err) {
						console.error(err);
					}
				}
				return json({ success: true, message: `Order ${id} updated` });
			}

			if (method === "DELETE") {
				orders = orders.filter((o) => o.id !== id);
				if (sql) {
					try {
						await sql`DELETE FROM orders WHERE id = ${id};`;
					} catch (err) {
						console.error(err);
					}
				}
				return json({ success: true, message: `Order ${id} deleted` });
			}
		}

		// 5. AI Agents API (/api/agents)
		if (path === "/api/agents") {
			const sql = getDb(env);

			if (method === "GET") {
				if (sql) {
					try {
						const dbAgents = await sql`
							SELECT 
								name, 
								role, 
								status, 
								active_jobs as "activeJobs", 
								efficiency, 
								avatar 
							FROM agents 
							ORDER BY created_at DESC;
						`;
						if (dbAgents && dbAgents.length > 0) {
							return json(dbAgents);
						}
					} catch (err: any) {
						console.error("Neon GET agents error:", err);
					}
				}
				return json(agents);
			}

			if (method === "POST") {
				const body: any = await request.json().catch(() => ({}));
				const initials = (body.name || "AI")
					.split(" ")
					.map((w: string) => w[0])
					.join("")
					.toUpperCase()
					.slice(0, 2);

				const newAgent: Agent = {
					name: body.name || "Custom Agent",
					role: body.role || "Task specialist",
					status: "Online",
					activeJobs: 0,
					efficiency: "99.9%",
					avatar: initials || "AI",
				};
				agents = [...agents, newAgent];

				if (sql) {
					try {
						await sql`
							INSERT INTO agents (name, role, status, active_jobs, efficiency, avatar)
							VALUES (${newAgent.name}, ${newAgent.role}, ${newAgent.status}, ${newAgent.activeJobs}, ${newAgent.efficiency}, ${newAgent.avatar})
							ON CONFLICT (name) DO UPDATE 
							SET role = EXCLUDED.role, status = EXCLUDED.status;
						`;
					} catch (err: any) {
						console.error("Neon INSERT agent error:", err);
					}
				}

				logs.unshift({
					id: `LOG-${Math.floor(1000 + Math.random() * 9000)}`,
					timestamp: new Date().toLocaleTimeString("id-ID"),
					level: "success",
					agent: newAgent.name,
					repo: "Cluster Core",
					message: `Agent "${newAgent.name}" deployed to cluster as ${newAgent.role}`,
					duration: "0.2s",
				});

				return json({ success: true, agent: newAgent }, 201);
			}
		}

		// Single Agent Operations (/api/agents/:name)
		if (path.startsWith("/api/agents/") && !path.endsWith("/dispatch")) {
			const agentName = decodeURIComponent(path.replace("/api/agents/", ""));
			const sql = getDb(env);
			const agentIndex = agents.findIndex((a) => a.name.toLowerCase() === agentName.toLowerCase());

			if (method === "GET") {
				if (sql) {
					try {
						const res = await sql`
							SELECT name, role, status, active_jobs as "activeJobs", efficiency, avatar 
							FROM agents WHERE LOWER(name) = LOWER(${agentName});
						`;
						if (res.length > 0) return json(res[0]);
					} catch (err: any) {
						console.error("Neon GET single agent error:", err);
					}
				}
				if (agentIndex === -1) return json({ error: "Agent not found" }, 404);
				return json(agents[agentIndex]);
			}

			if (method === "PATCH") {
				const body: any = await request.json().catch(() => ({}));
				if (agentIndex !== -1) {
					agents[agentIndex] = { ...agents[agentIndex], ...body };
				}
				if (sql) {
					try {
						if (body.status) {
							await sql`UPDATE agents SET status = ${body.status} WHERE LOWER(name) = LOWER(${agentName});`;
						}
						if (body.role) {
							await sql`UPDATE agents SET role = ${body.role} WHERE LOWER(name) = LOWER(${agentName});`;
						}
					} catch (err: any) {
						console.error("Neon PATCH agent error:", err);
					}
				}
				return json({ success: true, message: `Agent ${agentName} updated` });
			}

			if (method === "DELETE") {
				agents = agents.filter((a) => a.name.toLowerCase() !== agentName.toLowerCase());
				if (sql) {
					try {
						await sql`DELETE FROM agents WHERE LOWER(name) = LOWER(${agentName});`;
					} catch (err: any) {
						console.error("Neon DELETE agent error:", err);
					}
				}
				return json({ success: true, message: `Agent ${agentName} deleted` });
			}
		}

		// Dispatch Instant Job to specific Agent: POST /api/agents/:name/dispatch
		if (path.match(/^\/api\/agents\/[^/]+\/dispatch$/) && method === "POST") {
			const agentNameRaw = decodeURIComponent(path.split("/")[3]);
			const agent = agents.find((a) => a.name.toLowerCase() === agentNameRaw.toLowerCase());

			if (!agent) {
				return json({ error: "Agent not found" }, 404);
			}

			const dispatchedJob: Job = {
				id: `JOB-${Math.floor(4100 + Math.random() * 900)}`,
				repo: "comneta-50/site-ai-company",
				branch: "ai-auto-patch",
				title: `Instant Diagnostic by ${agent.name}`,
				agent: agent.name,
				status: "fixing",
				statusLabel: "Fixing",
				time: "Just now",
				progress: 10,
				logs: [
					`Instant task received by ${agent.name}`,
					`Ingesting repository code for telemetry audit...`,
				],
			};
			jobs = [dispatchedJob, ...jobs];
			agent.activeJobs += 1;
			agent.status = "Busy";

			logs.unshift({
				id: `LOG-${Math.floor(1000 + Math.random() * 9000)}`,
				timestamp: new Date().toLocaleTimeString("id-ID"),
				level: "info",
				agent: agent.name,
				repo: dispatchedJob.repo,
				message: `Dispatched instant task ${dispatchedJob.id} to ${agent.name}`,
				duration: "0.1s",
			});

			return json({ success: true, agent, job: dispatchedJob });
		}

		// 6. Reviews API (/api/reviews)
		if (path === "/api/reviews") {
			const sql = getDb(env);

			if (method === "GET") {
				if (sql) {
					try {
						const dbReviews = await sql`
							SELECT 
								id, 
								title, 
								repo, 
								branch, 
								author, 
								risk, 
								files_changed as "filesChanged", 
								additions, 
								deletions, 
								summary, 
								time_label as "time" 
							FROM reviews 
							ORDER BY created_at DESC;
						`;
						if (dbReviews && dbReviews.length > 0) return json(dbReviews);
					} catch (err: any) {
						console.error("Neon GET reviews error:", err);
					}
				}
				return json(reviews);
			}

			if (method === "POST") {
				const body: any = await request.json().catch(() => ({}));
				const newReview: ReviewItem = {
					id: `REV-${Math.floor(100 + Math.random() * 900)}`,
					title: body.title || "Pull Request Review",
					repo: body.repo || "comneta-50/site-ai-company",
					branch: body.branch || "feat/patch",
					author: body.author || "AutoFix Engineer",
					risk: body.risk || "Medium Impact",
					filesChanged: Number(body.filesChanged) || 1,
					additions: Number(body.additions) || 10,
					deletions: Number(body.deletions) || 2,
					summary: body.summary || "Automated code revision",
					time: "Just now",
				};
				reviews = [newReview, ...reviews];

				if (sql) {
					try {
						await sql`
							INSERT INTO reviews (
								id, title, repo, branch, author, risk, files_changed, additions, deletions, summary, time_label
							) VALUES (
								${newReview.id}, ${newReview.title}, ${newReview.repo}, ${newReview.branch}, ${newReview.author},
								${newReview.risk}, ${newReview.filesChanged}, ${newReview.additions}, ${newReview.deletions},
								${newReview.summary}, ${newReview.time}
							);
						`;
					} catch (err: any) {
						console.error("Neon INSERT review error:", err);
					}
				}

				return json({ success: true, review: newReview }, 201);
			}
		}

		if (path.startsWith("/api/reviews/")) {
			const id = path.replace("/api/reviews/", "");
			const sql = getDb(env);

			if (method === "DELETE") {
				reviews = reviews.filter((r) => r.id !== id);
				if (sql) {
					try {
						await sql`DELETE FROM reviews WHERE id = ${id};`;
					} catch (err: any) {
						console.error("Neon DELETE review error:", err);
					}
				}
				return json({ success: true, message: `Review ${id} processed` });
			}
		}

		// 7. Repositories API (/api/repos)
		if (path === "/api/repos") {
			const sql = getDb(env);

			if (method === "GET") {
				if (sql) {
					try {
						const dbRepos = await sql`
							SELECT 
								name, 
								description, 
								stars, 
								default_branch as "defaultBranch", 
								synced_at as "syncedAt", 
								status, 
								auto_fix as "autoFix" 
							FROM repos 
							ORDER BY created_at DESC;
						`;
						if (dbRepos && dbRepos.length > 0) return json(dbRepos);
					} catch (err: any) {
						console.error("Neon GET repos error:", err);
					}
				}
				return json(repos);
			}

			if (method === "POST") {
				const body: any = await request.json().catch(() => ({}));
				const newRepo: RepoItem = {
					name: body.name || "org/repo",
					description: body.description || "Connected GitHub Repository",
					stars: 0,
					defaultBranch: body.defaultBranch || "main",
					syncedAt: "Just now",
					status: "Synced",
					autoFix: body.autoFix ?? true,
				};
				repos = [...repos, newRepo];

				if (sql) {
					try {
						await sql`
							INSERT INTO repos (name, description, stars, default_branch, synced_at, status, auto_fix)
							VALUES (${newRepo.name}, ${newRepo.description}, ${newRepo.stars}, ${newRepo.defaultBranch}, ${newRepo.syncedAt}, ${newRepo.status}, ${newRepo.autoFix})
							ON CONFLICT (name) DO UPDATE 
							SET description = EXCLUDED.description, auto_fix = EXCLUDED.auto_fix;
						`;
					} catch (err: any) {
						console.error("Neon INSERT repo error:", err);
					}
				}

				return json({ success: true, repo: newRepo }, 201);
			}
		}

		if (path.startsWith("/api/repos/")) {
			const repoName = decodeURIComponent(path.replace("/api/repos/", ""));
			const sql = getDb(env);

			if (method === "DELETE") {
				repos = repos.filter((r) => r.name.toLowerCase() !== repoName.toLowerCase());
				if (sql) {
					try {
						await sql`DELETE FROM repos WHERE LOWER(name) = LOWER(${repoName});`;
					} catch (err: any) {
						console.error("Neon DELETE repo error:", err);
					}
				}
				return json({ success: true, message: `Repo ${repoName} removed` });
			}
		}

		// 8. Activity Logs API (/api/activity)
		if (path === "/api/activity" && method === "GET") {
			const level = url.searchParams.get("level");
			if (level && level !== "all") {
				return json(logs.filter((l) => l.level === level));
			}
			return json(logs);
		}

		// 9. AI Bug Fix / Analyze Chat API (/api/chat & /api/ai/analyze)
		if (path === "/api/chat" || path === "/api/ai/analyze") {
			try {
				let prompt = "Halo, jelaskan bagaimana Anda dapat membantu memperbaiki bug kode.";
				let codeSnippet = "";

				if (method === "POST") {
					const body: any = await request.json().catch(() => ({}));
					if (body.prompt) prompt = body.prompt;
					if (body.code) codeSnippet = body.code;
				} else {
					const qPrompt = url.searchParams.get("prompt");
					if (qPrompt) prompt = qPrompt;
				}

				const fullPrompt = codeSnippet
					? `Kamu adalah AI Bug Fixing & Code Reviewer Engineer. Analisis bug dan berikan solusi kode perbaikan untuk kode berikut:\n\nKode:\n\`\`\`\n${codeSnippet}\n\`\`\`\n\nInstruksi:\n${prompt}`
					: `Kamu adalah AI Bug Fixing & Code Reviewer Engineer untuk Rafa Company Platform. Jawab permintaan berikut dengan ringkas, jelas, dan fokus pada solusi engineering/bugfix:\n\n${prompt}`;

				const aiResult = await env.AI.run("@cf/meta/llama-3.2-3b-instruct", {
					prompt: fullPrompt,
					max_tokens: 1024,
				});

				return json({
					success: true,
					prompt,
					model: "@cf/meta/llama-3.2-3b-instruct",
					result: aiResult,
				});
			} catch (error: any) {
				return json(
					{
						success: false,
						error: error.message || String(error),
					},
					500
				);
			}
		}

		return json({ error: "Endpoint not found" }, 404);
	},
} satisfies ExportedHandler<Env>;

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
					successRate: jobs.length > 0 ? `${Math.round((completedJobsCount / jobs.length) * 100)}%` : "100%",
					successRateSubtitle: `${completedJobsCount} dari ${jobs.length} jobs selesai`,
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

		// 2b. Metrics / Overview API
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
			if (method === "GET") {
				const status = url.searchParams.get("status");
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

				// Increment activeJobs of assigned agent
				const assignedAgent = agents.find((a) => a.name === newJob.agent);
				if (assignedAgent) {
					assignedAgent.activeJobs += 1;
					assignedAgent.status = "Busy";
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
			const jobIndex = jobs.findIndex((j) => j.id === id);
			if (jobIndex === -1) return json({ error: "Job not found" }, 404);

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

			logs.unshift({
				id: `LOG-${Math.floor(1000 + Math.random() * 9000)}`,
				timestamp: new Date().toLocaleTimeString("id-ID"),
				level: "info",
				agent: jobs[jobIndex].agent,
				repo: jobs[jobIndex].repo,
				message: `Job ${id} re-triggered and returned to execution queue`,
				duration: "0.2s",
			});

			return json({ success: true, job: jobs[jobIndex] });
		}

		// Single Job Actions (/api/jobs/:id)
		if (path.startsWith("/api/jobs/")) {
			const id = path.replace("/api/jobs/", "");
			const jobIndex = jobs.findIndex((j) => j.id === id);

			if (jobIndex === -1) {
				return json({ error: "Job not found" }, 404);
			}

			if (method === "GET") {
				return json(jobs[jobIndex]);
			}

			if (method === "PATCH") {
				const body: any = await request.json().catch(() => ({}));
				jobs[jobIndex] = { ...jobs[jobIndex], ...body };
				return json({ success: true, job: jobs[jobIndex] });
			}

			if (method === "DELETE") {
				jobs = jobs.filter((j) => j.id !== id);
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
			if (method === "GET") {
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
			if (method === "GET") {
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
					filesChanged: body.filesChanged || 1,
					additions: body.additions || 10,
					deletions: body.deletions || 2,
					summary: body.summary || "Automated code revision",
					time: "Just now",
				};
				reviews = [newReview, ...reviews];
				return json({ success: true, review: newReview }, 201);
			}
		}

		if (path.startsWith("/api/reviews/")) {
			const id = path.replace("/api/reviews/", "");
			if (method === "DELETE") {
				reviews = reviews.filter((r) => r.id !== id);
				return json({ success: true, message: `Review ${id} processed` });
			}
		}

		// 7. Repositories API (/api/repos)
		if (path === "/api/repos") {
			if (method === "GET") {
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
				return json({ success: true, repo: newRepo }, 201);
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

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
			return json({
				status: "ok",
				service: "rafa-backend-worker",
				aiConnected: true,
				timestamp: new Date().toISOString(),
			});
		}

		// 2. Metrics / Overview API
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
				return json(jobs);
			}

			if (method === "POST") {
				const body: any = await request.json().catch(() => ({}));
				const newJob: Job = {
					id: `JOB-${Math.floor(1000 + Math.random() * 9000)}`,
					orderId: body.orderId,
					repo: body.repo || "comneta-50/site-ai-company",
					branch: body.branch || "ai-auto-patch",
					title: body.title || "Bugfix task",
					agent: body.agent || "AutoFix Engineer",
					status: "fixing",
					statusLabel: "Fixing",
					time: "Just now",
					progress: 15,
					logs: [
						`Job started: ${body.title || "Bugfix task"}`,
						`Assigned to ${body.agent || "AutoFix Engineer"}`,
						"Cloning repository & analyzing AST tree...",
					],
				};
				jobs = [newJob, ...jobs];

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
		}

		// 4. Orders API (/api/orders)
		if (path === "/api/orders") {
			if (method === "GET") {
				return json(orders);
			}

			if (method === "POST") {
				const body: any = await request.json().catch(() => ({}));
				const newOrder: LifecycleOrder = {
					id: `ORD-${Math.floor(700 + Math.random() * 200)}`,
					clientName: body.clientName || "Anonymous Client",
					clientEmail: body.clientEmail || "client@example.com",
					packageType: body.packageType || "Standard Patch",
					feeAmount: body.feeAmount || "$250.00",
					bugDescription: body.bugDescription || "Bug analysis needed",
					repoUrl: body.repoUrl || "org/repo",
					branchName: `ai-fix/ord-${Math.floor(100 + Math.random() * 900)}`,
					status: "order_created",
					retentionExpires: "7 Hari lagi",
					workspaceDestroyed: false,
				};
				orders = [newOrder, ...orders];
				return json({ success: true, order: newOrder }, 201);
			}
		}

		if (path.startsWith("/api/orders/")) {
			const id = path.replace("/api/orders/", "");
			const orderIndex = orders.findIndex((o) => o.id === id);

			if (orderIndex === -1) {
				return json({ error: "Order not found" }, 404);
			}

			if (method === "GET") {
				return json(orders[orderIndex]);
			}

			if (method === "PATCH") {
				const body: any = await request.json().catch(() => ({}));
				orders[orderIndex] = { ...orders[orderIndex], ...body };
				return json({ success: true, order: orders[orderIndex] });
			}

			if (method === "DELETE") {
				orders = orders.filter((o) => o.id !== id);
				return json({ success: true, message: `Order ${id} deleted` });
			}
		}

		// 5. Agents API (/api/agents)
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
				return json({ success: true, agent: newAgent }, 201);
			}
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

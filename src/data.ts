/**
 * Mock & In-Memory Data Store for Rafa Company AI Platform
 */

export interface Agent {
	name: string;
	role: string;
	status: "Online" | "Busy" | "Offline";
	activeJobs: number;
	efficiency: string;
	avatar: string;
}

export interface Job {
	id: string;
	orderId?: string;
	repo: string;
	branch: string;
	title: string;
	agent: string;
	status: "fixing" | "testing" | "review" | "completed" | "failed";
	statusLabel: string;
	time: string;
	progress: number | string;
	logs?: string[];
	diff?: string;
}

export interface LifecycleOrder {
	id: string;
	clientName: string;
	clientEmail: string;
	packageType: string;
	feeAmount: string;
	bugDescription: string;
	repoUrl: string;
	branchName: string;
	status: "order_created" | "repo_connected" | "ai_fixing" | "client_review" | "job_closed";
	aiStage?: "Analyzer" | "Approval" | "Developer" | "QA" | "Ready";
	retentionExpires: string;
	prUrl?: string;
	zipDownloaded?: boolean;
	workspaceDestroyed?: boolean;
}

export interface ReviewItem {
	id: string;
	title: string;
	repo: string;
	branch: string;
	author: string;
	risk: string;
	filesChanged: number;
	additions: number;
	deletions: number;
	summary: string;
	time: string;
}

export interface RepoItem {
	name: string;
	description: string;
	stars: number;
	defaultBranch: string;
	syncedAt: string;
	status: string;
	autoFix: boolean;
}

export interface ActivityLog {
	id: string;
	timestamp: string;
	level: "success" | "info" | "warn" | "failed";
	agent: string;
	repo: string;
	message: string;
	duration?: string;
}

export const initialAgents: Agent[] = [
	{
		name: "AI Code Reviewer",
		role: "Static analysis & AST audit",
		status: "Online",
		activeJobs: 3,
		efficiency: "99.4%",
		avatar: "CR",
	},
	{
		name: "AutoFix Engineer",
		role: "Automated patch generation",
		status: "Busy",
		activeJobs: 5,
		efficiency: "96.8%",
		avatar: "AF",
	},
	{
		name: "Security Guard",
		role: "Dependency & secret scanning audit",
		status: "Online",
		activeJobs: 0,
		efficiency: "99.8%",
		avatar: "SG",
	},
	{
		name: "Docstring Writer",
		role: "Automated API & TSDoc generation",
		status: "Online",
		activeJobs: 1,
		efficiency: "97.5%",
		avatar: "DW",
	},
	{
		name: "Performance Profiler",
		role: "Memory & CPU footprint analyzer",
		status: "Busy",
		activeJobs: 2,
		efficiency: "98.2%",
		avatar: "PP",
	},
];

export const initialJobs: Job[] = [
	{
		id: "JOB-4092",
		orderId: "ORD-781",
		repo: "comneta-50/site-ai-company",
		branch: "feat/auth-middleware",
		title: "Fix Token Expiration & Race Condition in Auth Guard",
		agent: "Analyzer Agent #04",
		status: "fixing",
		statusLabel: "Fixing",
		time: "2m ago",
		progress: 68,
		logs: [
			"Cloning repo: comneta-50/site-ai-company",
			"Scanning AST trees in src/middleware.ts",
			"Found potential race condition in token renewal loop",
			"Generating synchronized mutex lock patch...",
		],
	},
	{
		id: "JOB-4089",
		orderId: "ORD-780",
		repo: "comneta-50/core-api-service",
		branch: "main",
		title: "Optimize PostgreSQL connection pooling under heavy load",
		agent: "Optimizer Bot",
		status: "testing",
		statusLabel: "Testing",
		time: "14m ago",
		progress: 92,
		logs: [
			"Analyzing slow query telemetry",
			"Tuned max pool connection from 10 to 35",
			"Running load test simulation: 2000 rps",
			"P99 latency down from 420ms to 48ms",
		],
	},
	{
		id: "JOB-4085",
		orderId: "ORD-779",
		repo: "comneta-50/web-frontend",
		branch: "fix/hydration-error",
		title: "Resolve SSR hydration mismatch on localized landing route",
		agent: "CodeReviewer v2",
		status: "review",
		statusLabel: "Review",
		time: "48m ago",
		progress: 100,
	},
	{
		id: "JOB-4081",
		repo: "comneta-50/analytics-worker",
		branch: "release/v1.2",
		title: "Patch Redis pipeline buffer overflow in batch consumer",
		agent: "Security Guard",
		status: "completed",
		statusLabel: "Completed",
		time: "2h ago",
		progress: 100,
	},
];

export const initialOrders: LifecycleOrder[] = [
	{
		id: "ORD-781",
		clientName: "PT Fintek Nusantara",
		clientEmail: "tech@finteknusantara.id",
		packageType: "Critical Bugfix (24h SLA)",
		feeAmount: "$450.00",
		bugDescription: "Race condition saat refresh token user di middleware Next.js",
		repoUrl: "client-fintek/auth-service",
		branchName: "ai-fix/ord-781",
		status: "client_review",
		aiStage: "Ready",
		retentionExpires: "23 Jam lagi",
		prUrl: "https://github.com/client-fintek/auth-service/pull/42",
		zipDownloaded: false,
		workspaceDestroyed: false,
	},
	{
		id: "ORD-780",
		clientName: "Karya Studio Global",
		clientEmail: "dev@karyastudio.com",
		packageType: "Standard Patch",
		feeAmount: "$200.00",
		bugDescription: "PostgreSQL connection pool exhaustion ketika webhook payload melonjak",
		repoUrl: "karya-studio/core-api",
		branchName: "ai-fix/ord-780",
		status: "ai_fixing",
		aiStage: "Developer",
		retentionExpires: "3 Hari lagi",
		workspaceDestroyed: false,
	},
	{
		id: "ORD-779",
		clientName: "Logistik Pintar ID",
		clientEmail: "admin@logistikpintar.id",
		packageType: "Security Hotfix",
		feeAmount: "$350.00",
		bugDescription: "Hydration mismatch & buffer overflow pada batch consumer worker",
		repoUrl: "logistik-id/tracking-worker",
		branchName: "ai-fix/ord-779",
		status: "order_created",
		retentionExpires: "7 Hari lagi",
		workspaceDestroyed: false,
	},
];

export const initialReviews: ReviewItem[] = [
	{
		id: "REV-104",
		title: "Fix Token Expiration & Race Condition in Auth Guard",
		repo: "comneta-50/site-ai-company",
		branch: "feat/auth-middleware",
		author: "AutoFix Engineer",
		risk: "High Impact",
		filesChanged: 3,
		additions: 42,
		deletions: 14,
		summary:
			"Added synchronized token lock to prevent concurrent refresh token invalidation in Next.js middleware and API routes.",
		time: "24m ago",
	},
	{
		id: "REV-103",
		title: "Optimize PostgreSQL connection pooling under heavy load",
		repo: "comneta-50/core-api-service",
		branch: "perf/pg-pool-opt",
		author: "Optimizer Bot",
		risk: "Medium Impact",
		filesChanged: 2,
		additions: 18,
		deletions: 5,
		summary:
			"Tuned max pool size from 10 to 35 with dynamic backoff retry logic for timeout resilience.",
		time: "1h ago",
	},
	{
		id: "REV-102",
		title: "Resolve SSR hydration mismatch on localized landing route",
		repo: "comneta-50/web-frontend",
		branch: "fix/hydration-error",
		author: "CodeReviewer v2",
		risk: "Low Impact",
		filesChanged: 1,
		additions: 8,
		deletions: 8,
		summary:
			"Deferred client locale detection until mounted state to ensure deterministic server HTML rendering.",
		time: "3h ago",
	},
];

export const initialRepos: RepoItem[] = [
	{
		name: "comneta-50/Rafa_Company",
		description: "Official workspace and AI orchestration dashboard",
		stars: 12,
		defaultBranch: "main",
		syncedAt: "Just now",
		status: "Synced",
		autoFix: true,
	},
	{
		name: "comneta-50/core-api-service",
		description: "High throughput NestJS backend & microservices",
		stars: 34,
		defaultBranch: "main",
		syncedAt: "12m ago",
		status: "Synced",
		autoFix: true,
	},
	{
		name: "comneta-50/web-frontend",
		description: "Customer-facing Next.js portal application",
		stars: 8,
		defaultBranch: "main",
		syncedAt: "45m ago",
		status: "Synced",
		autoFix: false,
	},
	{
		name: "comneta-50/analytics-worker",
		description: "Kafka & Redis event streaming pipeline",
		stars: 19,
		defaultBranch: "main",
		syncedAt: "2h ago",
		status: "Synced",
		autoFix: true,
	},
];

export const initialActivityLogs: ActivityLog[] = [
	{
		id: "LOG-9821",
		timestamp: "19:34:12",
		level: "success",
		agent: "AI Code Reviewer",
		repo: "comneta-50/site-ai-company",
		message: "Completed AST traversal and validated zero memory leak vectors on auth middleware.",
		duration: "1.2s",
	},
	{
		id: "LOG-9820",
		timestamp: "19:33:04",
		level: "info",
		agent: "AutoFix Engineer",
		repo: "comneta-50/site-ai-company",
		message: "Generated patch diff for token expiration synchronization #PR-104.",
		duration: "4.8s",
	},
	{
		id: "LOG-9819",
		timestamp: "19:30:45",
		level: "warn",
		agent: "Test Runner Bot",
		repo: "comneta-50/core-api-service",
		message: "High latency detected on Redis cluster test container (spike to 184ms).",
		duration: "12.4s",
	},
	{
		id: "LOG-9818",
		timestamp: "19:28:11",
		level: "info",
		agent: "AI Code Reviewer",
		repo: "comneta-50/web-frontend",
		message: "Analyzing pull request #89: hydration mismatch detection on SSR root.",
		duration: "2.1s",
	},
	{
		id: "LOG-9817",
		timestamp: "19:25:00",
		level: "success",
		agent: "AutoFix Engineer",
		repo: "comneta-50/analytics-worker",
		message: "Applied batch buffer backpressure patch and verified green test suite.",
		duration: "3.7s",
	},
	{
		id: "LOG-9816",
		timestamp: "19:20:19",
		level: "info",
		agent: "Security Guard",
		repo: "comneta-50/core-api-service",
		message: "Completed vulnerability audit against CVE database. Zero vulnerabilities found.",
		duration: "8.5s",
	},
];
